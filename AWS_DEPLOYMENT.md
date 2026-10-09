# Implantação na AWS — Lightsail de baixo custo (até ~10 clientes)

Guia passo a passo para colocar a plataforma **Meu Restaurante** no ar usando a infraestrutura escrita em [infra/](./infra) (AWS CDK). Desenhado para um volume de **até ~10 clientes pequenos** — prioriza o menor custo possível sobre automação/redundância que esse tamanho ainda não precisa. Ver também [PRD.md](./PRD.md) seção 12.4 para o raciocínio por trás de cada escolha, [PRD_multiclientes.md](./PRD_multiclientes.md) para o modelo multi-tenant (cada cliente em `<slug>.<seu-domínio>`), e [ARQUITETURA.md](./ARQUITETURA.md) para o porquê de cada tecnologia do projeto.

Este documento assume que você nunca usou a AWS antes. Se já tem conta e CLI configurados, pule direto para a seção 5.

> **Mudou recentemente?** Este guia substitui um desenho anterior baseado em EC2 + Route 53 (que, por sua vez, já tinha substituído um desenho ainda mais antigo de ECS Fargate + RDS + ElastiCache + ALB + CloudFront, ~100–140 USD/mês). A troca para **Lightsail + Cloudflare** aconteceu por dois motivos concretos: (1) desde fev/2024 a AWS cobra por todo endereço IPv4 público, inclusive um Elastic IP associado a uma instância rodando — isso corroía boa parte da vantagem de custo da EC2, enquanto o pacote do Lightsail já embute o IP no preço fechado; (2) o Lightsail não tem IAM Instance Role, então o certificado wildcard do Caddy deixou de depender do Route 53 (que usava a role) e passou a usar o Cloudflare — um token de API escopado só a DNS, que nunca enxerga o resto da sua conta AWS. A seção 16 explica quando vale migrar pra algo com mais redundância.

## Sumário

1. [O que vai para o ar, e por quê cada peça](#1-o-que-vai-para-o-ar-e-por-quê-cada-peça)
2. [Quanto isso custa por mês](#2-quanto-isso-custa-por-mês)
3. [Pré-requisitos](#3-pré-requisitos)
4. [Criar e proteger a conta AWS](#4-criar-e-proteger-a-conta-aws)
5. [Configurar as ferramentas localmente](#5-configurar-as-ferramentas-localmente)
6. [Implantar a infraestrutura (cdk deploy)](#6-implantar-a-infraestrutura-cdk-deploy)
7. [Configurar o Cloudflare (DNS + certificado wildcard)](#7-configurar-o-cloudflare-dns--certificado-wildcard)
8. [Preparar os segredos (.env na instância)](#8-preparar-os-segredos-env-na-instância)
9. [Primeira publicação da aplicação](#9-primeira-publicação-da-aplicação)
10. [Buscar as senhas de admin/garçom/cozinha](#10-buscar-as-senhas-de-admingarçomcozinha)
11. [Configurar o GitHub Actions (deploy automático, opcional)](#11-configurar-o-github-actions-deploy-automático-opcional)
12. [Testar tudo](#12-testar-tudo)
13. [Backup e restore do banco de dados](#13-backup-e-restore-do-banco-de-dados)
14. [Atualizações de infraestrutura depois do primeiro deploy](#14-atualizações-de-infraestrutura-depois-do-primeiro-deploy)
15. [Desligar tudo (evitar custo surpresa)](#15-desligar-tudo-evitar-custo-surpresa)
16. [Quando crescer além de ~10 clientes](#16-quando-crescer-além-de-10-clientes)
17. [Resolução de problemas comuns](#17-resolução-de-problemas-comuns)

---

## 1. O que vai para o ar, e por quê cada peça

Tudo roda numa **única instância Lightsail**, com o mesmo `docker-compose.yml` que já usa localmente (`postgres`, `redis`, `backend`, `frontend`) mais um container novo (`caddy`, via `docker-compose.prod.yml`) cuidando do HTTPS.

| Camada | Serviço | Por quê |
|---|---|---|
| Computação | **1x Lightsail, pacote ~2 vCPU/2GB/60GB SSD** | Roda os 5 containers direto — mesmo setup do ambiente local, numa máquina pública. Preço fechado (computação + disco + IP + franquia de tráfego), sem a cobrança de IPv4 avulsa que a EC2 tem hoje. Para ≤10 restaurantes pequenos, uma instância aguenta tranquilamente. |
| IP público | **Static IP do Lightsail** | Incluso no pacote — fixa o IP pro DNS não quebrar num restart, sem linha de custo separada. |
| DNS | **Cloudflare** (plano gratuito) | Hospeda seu domínio e o registro **wildcard** (`*.seu-domínio`) que todo subdomínio de cliente precisa (ver `server/src/tenant.ts`). Gratuito. |
| TLS | **Caddy** (container, `infra/caddy/`) | Emite e renova HTTPS sozinho, **incluindo o certificado wildcard**, via desafio DNS no Cloudflare (token de API escopado só a essa zona — ver seção 7). |
| Fan-out WebSocket | **Redis em container** | `server/src/redis.ts` só precisa de Redis pra sincronizar WS entre instâncias do backend — com uma instância só, continua funcionando igual, de graça. |
| Banco de dados | **Postgres em container** + backup diário pro S3 (seção 13) | Maior economia do desenho. Você assume o backup/restore (documentado); RDS fica como upgrade futuro se preferir trocar tranquilidade por custo extra — ver seção 16. |
| Backup de desastre da instância | **Snapshot automático nativo do Lightsail** | Diário, configurado direto no `infra/lib/platform-stack.ts` (add-on `AutoSnapshot`) — recupera a instância completa (Caddy, certificados, configuração), não só os dados. |
| Segredos | **Arquivo `.env` na própria instância** (nunca no git) | O Lightsail não tem IAM Instance Role, então não há como a instância ler SSM Parameter Store sozinha sem uma credencial — mais simples manter os segredos só localmente na máquina, com permissão `600`. |
| Credencial AWS (só pro backup) | **Usuário IAM com uma única permissão**: gravar no bucket de backup | É a única chamada à API da AWS que a instância faz — por isso a única credencial AWS que existe, e com o menor escopo possível (nem lê, nem mexe em outro bucket ou serviço). |
| Build da imagem | Direto na instância (`git pull && docker compose up --build -d`) | Igual ao fluxo local. Sem ECR, sem pipeline de build. |
| CI/CD | **GitHub Actions via SSH (opcional)** | Um job simples (`.github/workflows/deploy.yml`) que roda o mesmo comando acima por SSH. Comece sem isso (deploy manual) e ligue quando quiser automatizar. |

**Rede**: só as portas 80 e 443 ficam abertas no firewall do Lightsail (e 22, só se você configurar `sshAllowedCidr`) — e, do lado do Docker, só o Caddy publica porta no host em produção (`docker-compose.prod.yml` nunca carrega o `docker-compose.override.yml` que expõe Postgres/Redis/backend/frontend, isso só acontece no ambiente local).

**Não existe mais neste desenho**: VPC própria, Security Group, IAM Instance Role, Elastic IP, Route 53, NAT Gateway, ALB, ECS/Fargate, ElastiCache, CloudFront, ECR, Secrets Manager, SSM Parameter Store, Data Lifecycle Manager.

## 2. Quanto isso custa por mês

Região `sa-east-1` (São Paulo), instância rodando 24/7 o mês inteiro. Conversão a ~R$5,00/USD — **a cotação muda todo dia**, então o valor em reais varia mês a mês mesmo que a cobrança em dólar seja idêntica (ver seção abaixo da tabela).

| Item | USD/mês | BRL/mês (≈R$5,00) |
|---|---|---|
| Pacote Lightsail (computação + disco + IP + tráfego) | ~12-15 | ~R$ 60-75 |
| Backup S3 (poucos MB/dia, expira em 30 dias) | ~0,10 | ~R$ 0,50 |
| DNS (Cloudflare) | 0 | R$ 0 |
| **Total aproximado** | **~12-16** | **~R$ 60-80** |

> A faixa exata do pacote Lightsail em `sa-east-1` precisa ser conferida na [página de preços](https://aws.amazon.com/pt/lightsail/pricing/) no momento da decisão — preços no Brasil costumam rodar um pouco acima dos de `us-east-1`.

**O valor é fixo?** Só em parte:
- O pacote do Lightsail **é** um preço fechado (computação + disco + IP + uma franquia de tráfego generosa já inclusos) — dentro desse uso, o valor em dólar não muda mês a mês.
- Transferência de dados além da franquia, e o pouco de armazenamento do backup no S3, **variam com o uso real** — tendem a ficar bem abaixo do limite nesse volume de clientes, mas não são uma garantia contratual de valor fixo.
- A AWS cobra em **dólar**. O valor em reais que sai da sua conta varia com o câmbio todo mês, mesmo que a cobrança em USD seja idêntica.

Uma otimização opcional, não obrigatória pra começar: se o tráfego crescer e passar a usar a franquia de transferência quase toda, vale conferir se um pacote de nível acima compensa mais que pagar overage por GB.

## 3. Pré-requisitos

- Conta AWS (cartão de crédito necessário, mesmo usando o free tier).
- Conta no [Cloudflare](https://cloudflare.com) (gratuita) — vai hospedar o DNS do seu domínio.
- Um domínio próprio registrado em qualquer registrador (Registro.br, Namecheap, GoDaddy...) — necessário pelo certificado wildcard; não dá pra emitir wildcard pra um domínio que você não controla.
- Node.js 20+ e Docker instalados na sua máquina (pra rodar o CDK).
- `aws-cli` v2 instalado localmente ([instruções oficiais](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)).

## 4. Criar e proteger a conta AWS

1. Crie a conta em [aws.amazon.com](https://aws.amazon.com).
2. Ative a autenticação em dois fatores (MFA) no usuário root — **Account → Security credentials**.
3. Crie um usuário IAM pra uso do dia a dia (não use a conta root depois deste passo): **IAM → Users → Create user**, com a policy `AdministratorAccess` (suficiente pra esse porte de projeto; refine depois se quiser).
4. Gere uma Access Key pra esse usuário e configure localmente:
   ```bash
   aws configure
   ```

## 5. Configurar as ferramentas localmente

```bash
cd infra
npm install
npx cdk bootstrap   # uma vez por conta/região — prepara o ambiente pro CDK
```

## 6. Implantar a infraestrutura (cdk deploy)

```bash
cd infra
npx cdk deploy \
  -c repoUrl=https://github.com/<seu-usuario>/<seu-repo>.git \
  -c sshAllowedCidr=<seu-ip>/32
```

`sshAllowedCidr` é opcional — sem ele, a porta 22 fica fechada e você acessa a instância pelo **console web do Lightsail** (aba "Connect", SSH direto no navegador, sem precisar configurar chave nenhuma).

Antes de rodar de verdade, confirme os dois valores abaixo com a CLI — eles mudam entre gerações e o padrão do `infra/lib/platform-stack.ts` pode não ser o atual:
```bash
aws lightsail get-blueprints --query "blueprints[?platform=='LINUX_UNIX'] | [?contains(blueprintId, 'amazon_linux')]"
aws lightsail get-bundles --query "bundles[?ramSizeInGb==\`2\`]"
```
Se os IDs forem diferentes do padrão (`amazon_linux_2023` / `small_3_0`), passe `-c blueprintId=... -c bundleId=...` no `cdk deploy`.

No fim, o CDK imprime as saídas importantes — anote:
- `InstancePublicIp` — o IP estático da instância.
- `BackupBucketName` — o bucket S3 dos backups.
- `BackupUserName` — o usuário IAM criado só pra gravar backup nesse bucket.
- `NextSteps` — um lembrete dos três passos manuais a seguir (seções 7-8).

## 7. Configurar o Cloudflare (DNS + certificado wildcard)

1. No painel do Cloudflare, **Add a site**, informe seu domínio — o Cloudflare vai mostrar os nameservers dele.
2. No painel do seu registrador de domínio, troque os nameservers (NS) do domínio pelos que o Cloudflare mostrou. A propagação leva de minutos a algumas horas.
3. Ainda no Cloudflare, crie dois registros DNS tipo `A`, apontando pro `InstancePublicIp` do `cdk deploy`: um para `@` (o domínio em si) e outro para `*` (wildcard, cobre todo subdomínio de cliente). **Desative o proxy laranja** ("DNS only") nesses dois — o Caddy precisa falar direto com a instância para emitir o certificado.
4. Gere um token de API em **My Profile → API Tokens → Create Token**, com o template "Edit zone DNS", restrito à zona do seu domínio especificamente (não "All zones"). Guarde esse token — ele entra no `.env` na próxima seção, como `CF_API_TOKEN`.

## 8. Preparar os segredos (.env na instância)

Diferente de um desenho com SSM, aqui o `.env` é colocado **uma vez, manualmente**, na instância — não é buscado automaticamente a cada deploy.

1. Gere a Access Key do usuário de backup (saída `BackupUserName` do passo 6):
   ```bash
   aws iam create-access-key --user-name <BackupUserName>
   ```
   Guarde o `AccessKeyId`/`SecretAccessKey` impressos — só aparecem uma vez.
2. Conecte na instância (console web do Lightsail, aba "Connect") e crie `/opt/app/.env`:
   ```bash
   cat > /opt/app/.env << 'EOF'
   POSTGRES_DB=mesaviva
   POSTGRES_USER=mesaviva
   POSTGRES_PASSWORD=<gere uma senha forte>
   JWT_SECRET=<gere com: openssl rand -base64 48>
   SUPER_ADMIN_USERNAME=superadmin
   SUPER_ADMIN_PASSWORD=<gere uma senha forte>
   DOMAIN=seu-dominio.com.br
   ACME_EMAIL=voce@seu-dominio.com.br
   PLATFORM_URL=https://seu-dominio.com.br
   CF_API_TOKEN=<token do Cloudflare, passo 7>
   BACKUP_BUCKET=<BackupBucketName do cdk deploy>
   AWS_ACCESS_KEY_ID=<AccessKeyId gerado acima>
   AWS_SECRET_ACCESS_KEY=<SecretAccessKey gerado acima>
   AWS_DEFAULT_REGION=sa-east-1

   # Opcionais — deixe em branco se não for usar e-mail transacional agora
   # (sem isso, o app só loga os e-mails no console em vez de enviar).
   SMTP_HOST=
   SMTP_PORT=587
   SMTP_USER=
   SMTP_PASSWORD=
   SMTP_FROM=Meu Restaurante <nao-responda@seu-dominio.com.br>
   EOF
   chmod 600 /opt/app/.env
   ```

## 9. Primeira publicação da aplicação

A instância já clonou o repositório sozinha (launch script do CDK) e tem Docker instalado. Com o `.env` da seção 8 já no lugar:

```bash
sudo su -
bash /opt/app/infra/scripts/deploy.sh
```

Builda as imagens e sobe tudo (`docker-compose.yml` + `docker-compose.prod.yml`). Na primeira vez, o Caddy pode levar um minuto a mais emitindo o certificado wildcard — acompanhe com `docker compose logs -f caddy`.

## 10. Buscar as senhas de admin/garçom/cozinha

Essas senhas **não são geradas automaticamente** — você as define ao cadastrar cada cliente pelo painel Super Admin (`https://seu-dominio.com.br/super-admin`, login com `SUPER_ADMIN_USERNAME`/`SUPER_ADMIN_PASSWORD` do `.env`). Ver README.md para o fluxo de cadastro de cliente.

## 11. Configurar o GitHub Actions (deploy automático, opcional)

Totalmente opcional — sem isso, publique mudanças rodando `infra/scripts/deploy.sh` manualmente via SSH/console sempre que quiser.

Pra automatizar:
1. Gere um par de chaves SSH só pra isso (`ssh-keygen -t ed25519 -f deploy_key -N ""`).
2. Adicione a chave pública em `~/.ssh/authorized_keys` do usuário `ec2-user` na instância (confirme o usuário certo na aba "Connect" do console Lightsail).
3. No repositório GitHub: **Settings → Secrets and variables → Actions**:
   - Secret `DEPLOY_SSH_KEY`: conteúdo da chave privada (`deploy_key`).
   - Variable `INSTANCE_HOST`: o IP estático (ou o domínio) da instância.

A partir daí, todo push em `main` roda `infra/scripts/deploy.sh` na instância via SSH (`.github/workflows/deploy.yml`).

## 12. Testar tudo

```
https://seu-dominio.com.br/super-admin       → painel da plataforma
https://<slug-do-cliente>.seu-dominio.com.br → app de um cliente cadastrado
```

Confira o cadeado (certificado válido, inclusive no subdomínio) e que pedido/WebSocket funcionam de ponta a ponta, igual no ambiente local.

## 13. Backup e restore do banco de dados

**Backup diário automático** — agende na instância:
```bash
sudo crontab -e
# adicione:
0 5 * * * /opt/app/infra/scripts/backup-postgres.sh >> /var/log/backup-postgres.log 2>&1
```
Isso sobe um `pg_dump` compactado por dia pro bucket S3 (`BackupBucketName`), que expira sozinho depois de 30 dias — autenticado com a Access Key da seção 8, a única credencial AWS que existe na instância, escopada só pra gravar nesse bucket.

**Restore** (de um backup específico):
```bash
aws s3 cp s3://<bucket>/postgres/<timestamp>.sql.gz - | gunzip | \
  docker compose exec -T postgres psql -U mesaviva mesaviva
```

**Se preferir não cuidar disso**: trocar o Postgres em container por um banco gerenciado (RDS, ou o próprio "Lightsail Managed Database") é só mudar a `DATABASE_URL` no `.env` — nenhum código da aplicação depende de como o Postgres está hospedado. Ver seção 16.

## 14. Atualizações de infraestrutura depois do primeiro deploy

Mudou algo em `infra/lib/platform-stack.ts`? Rode de novo:
```bash
cd infra && npx cdk diff   # revisa o que vai mudar antes
npx cdk deploy -c repoUrl=... -c sshAllowedCidr=...
```
> Atenção: mudar `hardware`/`bundleId` reinicia a instância (o Lightsail recria o disco de sistema) — não é algo pra fazer em horário de pico.

## 15. Desligar tudo (evitar custo surpresa)

```bash
cd infra && npx cdk destroy
```
Isso remove a instância, o IP estático e o usuário IAM de backup. **O bucket de backup (`BackupBucket`) fica retido de propósito** (`RemovalPolicy.RETAIN`) — apague manualmente pelo console/CLI se não precisar mais dos backups. Lembre de também remover os registros DNS no Cloudflare.

## 16. Quando crescer além de ~10 clientes

Sinais de que vale migrar: a instância frequentemente perto do limite de CPU/memória, ou downtime único vira um risco de negócio inaceitável.
1. Primeiro passo intermediário, barato: só trocar o Postgres em container por um banco gerenciado (RDS ou Lightsail Managed Database) — uma variável de ambiente.
2. Depois, se o tráfego justificar: múltiplas instâncias atrás de um load balancer, com Redis saindo do container e virando um serviço gerenciado (pra sincronizar WebSocket entre elas) — nesse ponto, migrar de Lightsail pra EC2/ECS passa a valer o esforço, porque o volume já paga a complexidade adicional, e o caminho de volta ao Route 53 (pra usar IAM Instance Role de novo) também volta a fazer sentido.

## 17. Resolução de problemas comuns

**Certificado não emite / Caddy fica reiniciando**: confira `docker compose logs caddy` — geralmente é `CF_API_TOKEN` ausente/errado no `.env`, o token sem a permissão certa (precisa de "Edit zone DNS" na zona específica), ou os registros DNS do Cloudflare ainda com o proxy laranja ativado (precisa estar "DNS only" pro desafio funcionar) — ver seção 7.

**Memória apertada durante o deploy**: o momento de maior consumo é o *build* do frontend (`vite build`), que roda com os containers antigos ainda de pé. O `infra/lib/platform-stack.ts` já cria um swap de 2GB na instância como rede de segurança — se mesmo assim o build falhar por falta de memória, considere um pacote Lightsail de 4GB.

**Não consigo conectar via SSH**: se não configurou `sshAllowedCidr`, a porta 22 está fechada de propósito — use o console web do Lightsail (aba "Connect").

**Quero ver os logs da aplicação**: `docker compose logs -f backend` (ou `frontend`, `postgres`, `caddy`) na instância.
