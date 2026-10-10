# Implantação na AWS — Lightsail em 2 fases (piloto → produção)

Guia passo a passo para colocar a plataforma **Meu Restaurante** no ar usando a infraestrutura escrita em [infra/](./infra) (AWS CDK), em **duas fases**:

- **Fase 1 — Piloto**: o mínimo necessário para testar. Uma instância Lightsail pequena (1 GB), **sem domínio, sem Cloudflare, sem HTTPS**. Você acessa pelo IP público da máquina.
- **Fase 2 — Produção**: o desenho completo — Lightsail de 2 GB, domínio próprio no Cloudflare, Caddy com HTTPS wildcard (um subdomínio por cliente) e backup diário no S3.

Desenhado para **até ~10 clientes pequenos** — prioriza o menor custo possível sobre automação/redundância que esse tamanho ainda não precisa. Ver também [PRD.md](./PRD.md) seção 12.4 para o raciocínio por trás de cada escolha, [PRD_multiclientes.md](./PRD_multiclientes.md) para o modelo multi-tenant (cada cliente em `<slug>.<seu-domínio>`), e [ARQUITETURA.md](./ARQUITETURA.md) para o porquê de cada tecnologia do projeto.

Este documento assume que você nunca usou a AWS antes.

> **Histórico do desenho:** substitui um desenho anterior baseado em EC2 + Route 53 (que, por sua vez, já tinha substituído ECS Fargate + RDS + ElastiCache + ALB + CloudFront, ~100–140 USD/mês). A troca para **Lightsail + Cloudflare** aconteceu por dois motivos: (1) desde fev/2024 a AWS cobra por todo endereço IPv4 público, inclusive um Elastic IP — o pacote do Lightsail já embute o IP no preço fechado; (2) o Lightsail não tem IAM Instance Role, então o certificado wildcard do Caddy passou a usar o Cloudflare (token de API escopado só a DNS) em vez do Route 53.

## Sumário

1. [Visão geral das duas fases](#1-visão-geral-das-duas-fases)
2. [Pré-requisitos comuns: código no GitHub](#2-pré-requisitos-comuns-código-no-github)
3. [Criar e proteger a conta AWS](#3-criar-e-proteger-a-conta-aws)
4. [Fase 1 — Piloto (só Lightsail, sem domínio)](#4-fase-1--piloto-só-lightsail-sem-domínio)
5. [Migrar da Fase 1 para a Fase 2](#5-migrar-da-fase-1-para-a-fase-2)
6. [Fase 2 — Produção (domínio + Cloudflare + Caddy)](#6-fase-2--produção-domínio--cloudflare--caddy)
7. [Backup e restore do banco de dados](#7-backup-e-restore-do-banco-de-dados)
8. [Atualizações de infraestrutura depois do primeiro deploy](#8-atualizações-de-infraestrutura-depois-do-primeiro-deploy)
9. [Desligar tudo (evitar custo surpresa)](#9-desligar-tudo-evitar-custo-surpresa)
10. [Quando crescer além de ~10 clientes](#10-quando-crescer-além-de-10-clientes)
11. [Resolução de problemas comuns](#11-resolução-de-problemas-comuns)

---

## 1. Visão geral das duas fases

Nas duas fases tudo roda numa **única instância Lightsail**, com o mesmo `docker-compose.yml` do ambiente local (`postgres`, `redis`, `backend`, `frontend`). O que muda é o arquivo de override e o tamanho da máquina; a escolha é feita pela variável `DEPLOY_MODE` do `.env` da instância, lida por [infra/scripts/deploy.sh](./infra/scripts/deploy.sh).

| | **Fase 1 — Piloto** | **Fase 2 — Produção** |
|---|---|---|
| `DEPLOY_MODE` | `pilot` | `prod` |
| Override do Docker | [docker-compose.pilot.yml](./docker-compose.pilot.yml) | [docker-compose.prod.yml](./docker-compose.prod.yml) |
| Pacote Lightsail | **1 GB** (+ swap de 2 GB) | **2 GB** (+ swap de 2 GB) |
| Endereço | `http://<ip-com-hifens>.sslip.io` (grátis, sem cadastro) | `https://seu-dominio.com.br` e `https://<slug>.seu-dominio.com.br` |
| DNS | nenhum — [sslip.io](https://sslip.io) devolve o IP embutido no nome | Cloudflare (gratuito), registros `@` e `*` |
| HTTPS | **não** (HTTP puro, porta 80) | sim — Caddy, certificado wildcard automático |
| Backup | snapshot diário do Lightsail | snapshot diário + `pg_dump` diário no S3 |
| Credencial AWS na instância | nenhuma | usuário IAM só-escrita no bucket de backup |
| Domínio necessário | não | sim |
| Custo aproximado | ~US$ 5–8/mês | ~US$ 12–16/mês |

**Camadas comuns às duas fases**

| Camada | Serviço | Por quê |
|---|---|---|
| Computação | Lightsail (Amazon Linux 2023) | Preço fechado (computação + disco + IP + franquia de tráfego), sem a cobrança de IPv4 avulsa da EC2. |
| IP público | Static IP do Lightsail | Incluso no pacote — o IP não muda num restart. |
| Fan-out WebSocket | Redis em container | `server/src/redis.ts` só precisa de Redis para sincronizar WS entre instâncias do backend; com uma instância só, funciona igual, de graça. |
| Banco de dados | Postgres em container | Maior economia do desenho. RDS fica como upgrade futuro (seção 10). |
| Segredos | Arquivo `.env` na própria instância (nunca no git) | O Lightsail não tem IAM Instance Role; manter os segredos só localmente, com permissão `600`, é o mais simples. |
| Build da imagem | Direto na instância (`git pull && docker compose up --build -d`) | Igual ao fluxo local. Sem ECR, sem pipeline de build. |

**Memória** (medida com `docker stats`, containers ociosos): backend ~140 MiB, postgres ~40, redis ~11, frontend ~8, caddy ~30 (estimado). Somando o sistema operacional e o Docker (~400–500 MiB), **1 GB é o menor pacote viável** — em regime sobram só ~150–250 MiB, e o *build* do frontend (`vite build`) só passa apoiado no swap de 2 GB que o CDK configura (o build fica lento, na casa de minutos). 512 MB não serve. Na Fase 2 o Caddy entra e o tráfego cresce, por isso o pacote sobe para 2 GB.

**Não existe neste desenho**: VPC própria, Security Group, IAM Instance Role, Elastic IP, Route 53, NAT Gateway, ALB, ECS/Fargate, ElastiCache, CloudFront, ECR, Secrets Manager, SSM Parameter Store, Data Lifecycle Manager.

## 2. Pré-requisitos comuns: código no GitHub

A instância clona o repositório sozinha no primeiro boot (`repoUrl` do `cdk deploy`) e depois faz `git pull` a cada deploy. Então, **antes de começar**:

1. O código que você quer implantar precisa estar na **branch padrão do repositório** (hoje `main`). Se o trabalho multi-tenant ainda está só em outra branch, faça o merge em `main` (ou ajuste o clone do `infra/lib/platform-stack.ts` para usar `-b <branch>`).
2. O repositório precisa ser **público** — o clone usa HTTPS sem credencial. Se for privado, é preciso configurar uma deploy key e ajustar o `userData` do CDK e o `deploy.sh`.
3. Na sua máquina: Node.js 20+ e `aws-cli` v2 ([instruções oficiais](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)).

## 3. Criar e proteger a conta AWS

1. Crie a conta em [aws.amazon.com](https://aws.amazon.com) (cartão de crédito necessário).
2. Ative a autenticação em dois fatores (MFA) no usuário root — **Account → Security credentials**.
3. Crie um usuário IAM para o dia a dia (não use mais a conta root): **IAM → Users → Create user**, com a policy `AdministratorAccess` (suficiente para esse porte; refine depois se quiser).
4. Gere uma Access Key para esse usuário e configure localmente:
   ```bash
   aws configure
   ```
5. Prepare o CDK (uma vez por conta/região):
   ```bash
   cd infra
   npm install
   npx cdk bootstrap
   ```

---

## 4. Fase 1 — Piloto (só Lightsail, sem domínio)

Objetivo: ter o sistema no ar, acessível pela internet, o mais barato e simples possível — só para testar com pessoas reais, **com dados de teste**.

> **Sem HTTPS.** Sem domínio não há como emitir certificado. Logins e senhas trafegam em HTTP puro (legíveis por quem estiver na mesma rede do usuário). Use senhas descartáveis e **não cadastre dados reais de clientes** nesta fase.

### 4.1 Como o endereço funciona sem domínio

O app identifica o restaurante pelo **primeiro trecho do endereço** (`<slug>.dominio` — ver `server/src/tenant.ts`). Acessar direto por `http://203.0.113.4` **não funciona**: o sistema leria o primeiro número do IP (`203`) como se fosse o nome de um restaurante e não encontraria nada.

A saída gratuita é o [sslip.io](https://sslip.io): um serviço público de DNS que devolve o IP embutido no próprio nome, sem cadastro e sem Cloudflare. Para o IP `203.0.113.4`, escreva-o com **hifens**:

| Endereço | Para quê |
|---|---|
| `http://203-0-113-4.sslip.io/super-admin` | painel da plataforma (cadastro de clientes) |
| `http://203-0-113-4.sslip.io/` | lista de restaurantes cadastrados |
| `http://pizzaria.203-0-113-4.sslip.io/` | app do cliente cujo slug é `pizzaria` |

Qualquer nome na frente do IP funciona — por isso o slug de cada cliente vira o prefixo. O IP estático do Lightsail não muda, então esses endereços ficam estáveis.

### 4.2 Descobrir os IDs do pacote e da imagem

Os IDs mudam entre gerações; confirme com a CLI:
```bash
aws lightsail get-blueprints --query "blueprints[?platform=='LINUX_UNIX'] | [?contains(blueprintId, 'amazon_linux')]"
aws lightsail get-bundles --query "bundles[?ramSizeInGb==\`1\`]"
```
Anote o `blueprintId` (padrão do projeto: `amazon_linux_2023`) e o `bundleId` do pacote de **1 GB** (algo como `micro_3_0`).

### 4.3 Criar a infraestrutura

```bash
cd infra
npx cdk deploy -c phase=pilot
```
`phase=pilot` é o padrão e já escolhe: pacote `micro_3_0` (1 GB), porta 80 aberta (mais a 22 só para o SSH do navegador do console Lightsail), **sem** bucket S3 nem usuário IAM de backup. O repositório padrão é `https://github.com/marcioasm84/restauranteApp.git`; para outro, acrescente `-c repoUrl=...`. Se os IDs confirmados em 4.2 forem diferentes dos padrões, acrescente `-c bundleId=...` e/ou `-c blueprintId=...`. Você acessa a máquina pelo **console web do Lightsail** (aba "Connect", SSH no navegador, sem chaves) — o CDK libera a porta 22 apenas para esse cliente (alias `lightsail-connect`); não é preciso passar `sshAllowedCidr`.

No fim, o CDK imprime duas saídas: **`InstancePublicIp`** (anote) e `NextSteps` (lembrete dos passos 4.4 a 4.6).

### 4.4 Criar o `.env` na instância

No console do Lightsail → sua instância → **Connect**, aguarde 2–3 minutos após o primeiro boot (o script de inicialização instala o Docker e clona o repositório) e rode:
```bash
sudo tee /opt/app/.env > /dev/null << 'EOF'
DEPLOY_MODE=pilot
POSTGRES_DB=mesaviva
POSTGRES_USER=mesaviva
POSTGRES_PASSWORD=<gere uma senha forte>
JWT_SECRET=<gere com: openssl rand -base64 48>
SUPER_ADMIN_USERNAME=superadmin
SUPER_ADMIN_PASSWORD=<gere uma senha forte>
PLATFORM_URL=http://203-0-113-4.sslip.io
EOF
sudo chmod 600 /opt/app/.env
```
Troque `203-0-113-4` pelo seu `InstancePublicIp` com hifens. `PLATFORM_URL` é usado nos e-mails de boas-vindas (`<slug>.<host>`). Sem SMTP configurado o app só **loga** os e-mails em vez de enviar — normal no piloto.

### 4.5 Primeira publicação

```bash
sudo bash /opt/app/infra/scripts/deploy.sh
```
Builda as imagens e sobe `postgres`, `redis`, `backend` e `frontend` (este último publicado na porta 80). **O primeiro build demora** (vários minutos, usando o swap). Acompanhe com `sudo docker compose logs -f backend`. As migrações do banco rodam sozinhas na subida do backend.

### 4.6 Testar

1. Abra `http://<ip-com-hifens>.sslip.io/super-admin` e entre com `SUPER_ADMIN_USERNAME`/`SUPER_ADMIN_PASSWORD`.
2. Cadastre um cliente de teste (slug, ex. `pizzaria`) — é aqui que você define as senhas de admin/garçom/cozinha daquele cliente. Ver README.md para o fluxo.
3. Abra `http://pizzaria.<ip-com-hifens>.sslip.io/` e teste pedido, cozinha e WebSocket de ponta a ponta, igual ao ambiente local.

### 4.7 Backup e operação no piloto

- **Backup**: o CDK já liga o **snapshot diário automático** do Lightsail (add-on `AutoSnapshot`, 05:00) — recupera a máquina inteira, incluindo o banco. Não há `pg_dump`/S3 nesta fase; para dados de teste basta.
- **Publicar mudanças**: `sudo bash /opt/app/infra/scripts/deploy.sh` (faz `git pull` e rebuilda).
- **Logs**: `sudo docker compose logs -f backend` (ou `frontend`, `postgres`).
- **Destruir o piloto**: `cd infra && npx cdk destroy` (seção 9).

---

## 5. Migrar da Fase 1 para a Fase 2

Faça quando o piloto virar algo que você queira manter, com domínio próprio e HTTPS. O pacote muda de 1 GB para 2 GB, e **trocar o pacote recria a instância** (o Lightsail recria o disco de sistema) — por isso o banco precisa de dump/restore.

1. **Prepare a Fase 2 em paralelo** (seções 6.1 e 6.2): domínio no Cloudflare e registros DNS prontos (ainda sem apontar, ou apontando só quando a nova instância existir).
2. **Exporte os dados da instância do piloto** (console Lightsail → Connect):
   ```bash
   cd /opt/app
   sudo docker compose exec -T postgres pg_dump -U mesaviva mesaviva | gzip > /tmp/piloto.sql.gz
   sudo docker run --rm -v restauranteapp_backend_uploads:/data -v /tmp:/backup alpine \
     tar czf /backup/uploads.tgz -C /data .
   ```
   (Confirme o nome do volume com `sudo docker volume ls`; o prefixo é o nome da pasta do projeto.) Baixe os dois arquivos para a sua máquina (por exemplo `scp`, ou copie pelo console) — ou, como alternativa, tire um **snapshot manual** no console do Lightsail antes de seguir.
3. **Suba a instância de 2 GB**: descubra o bundle (`aws lightsail get-bundles --query "bundles[?ramSizeInGb==\`2\`]"`) e rode o `cdk deploy -c phase=prod` (seção 6.3; o pacote de 2 GB já é o padrão dessa fase). O IP estático é reanexado à nova instância, então o IP não muda.
4. **Complete a Fase 2** nos passos 6.4 a 6.6 (token do Cloudflare, `.env` com `DEPLOY_MODE=prod`, `deploy.sh`).
5. **Restaure os dados** na nova instância, depois de o `deploy.sh` ter subido os containers:
   ```bash
   cd /opt/app
   gunzip -c piloto.sql.gz | sudo docker compose exec -T postgres psql -U mesaviva mesaviva
   sudo docker run --rm -v restauranteapp_backend_uploads:/data -v "$PWD":/backup alpine \
     tar xzf /backup/uploads.tgz -C /data
   ```
   Clientes, slugs, cardápios, pedidos e logos permanecem — só muda o endereço (de `<slug>.<ip>.sslip.io` para `<slug>.seu-dominio.com.br`).
6. Confirme em `https://<slug>.seu-dominio.com.br` e então encerre qualquer instância/snapshot antigo que não precise mais.

---

## 6. Fase 2 — Produção (domínio + Cloudflare + Caddy)

### 6.1 Pré-requisitos adicionais

- Conta no [Cloudflare](https://cloudflare.com) (gratuita) — hospeda o DNS do seu domínio.
- Um **domínio próprio** registrado em qualquer registrador (Registro.br, Namecheap, GoDaddy...) — necessário pelo certificado wildcard; não dá para emitir wildcard para um domínio que você não controla.
- Docker na sua máquina não é necessário; só Node.js e `aws-cli`.

### 6.2 Cloudflare (DNS + certificado wildcard)

1. No painel do Cloudflare, **Add a site**, informe seu domínio — ele mostrará os nameservers.
2. No painel do seu registrador, troque os nameservers (NS) do domínio pelos do Cloudflare. A propagação leva de minutos a algumas horas.
3. Depois que a instância existir (6.3), crie dois registros DNS tipo `A` apontando para o `InstancePublicIp`: um para `@` (o domínio em si) e outro para `*` (wildcard, cobre todo subdomínio de cliente). **Desative o proxy laranja** ("DNS only") nos dois — o Caddy precisa falar direto com a instância para emitir o certificado.
4. Gere um token de API em **My Profile → API Tokens → Create Token**, template "Edit zone DNS", restrito à zona do seu domínio (não "All zones"). Guarde-o: entra no `.env` como `CF_API_TOKEN`.

### 6.3 Criar/atualizar a infraestrutura

```bash
cd infra
npx cdk deploy -c phase=prod [-c sshAllowedCidr=<seu-ip>/32]
```
`phase=prod` escolhe: pacote `small_3_0` (2 GB), portas 80 e 443, bucket S3 de backup e usuário IAM de backup. `sshAllowedCidr` é opcional — sem ele, a porta 22 fica liberada só para o SSH do navegador do console Lightsail (alias `lightsail-connect`); com ele, o seu IP também entra. Confirme `blueprintId`/`bundleId` com a CLI (seção 4.2; para 2 GB use `ramSizeInGb==2`) e, se diferirem dos padrões (`amazon_linux_2023` / `small_3_0`), passe `-c blueprintId=...` / `-c bundleId=...`. Para outro repositório, `-c repoUrl=...`.

Anote as saídas:
- `InstancePublicIp` — o IP estático (use no DNS do Cloudflare, 6.2).
- `BackupBucketName` — o bucket S3 dos backups.
- `BackupUserName` — o usuário IAM criado só para gravar backup nesse bucket.

### 6.4 Segredos (`.env` na instância)

O `.env` é colocado **uma vez, manualmente**, na instância — não é buscado automaticamente a cada deploy.

1. Gere a Access Key do usuário de backup:
   ```bash
   aws iam create-access-key --user-name <BackupUserName>
   ```
   Guarde `AccessKeyId`/`SecretAccessKey` — só aparecem uma vez.
2. No console do Lightsail (aba "Connect"), crie/substitua `/opt/app/.env`:
   ```bash
   sudo tee /opt/app/.env > /dev/null << 'EOF'
   DEPLOY_MODE=prod
   POSTGRES_DB=mesaviva
   POSTGRES_USER=mesaviva
   POSTGRES_PASSWORD=<gere uma senha forte>
   JWT_SECRET=<gere com: openssl rand -base64 48>
   SUPER_ADMIN_USERNAME=superadmin
   SUPER_ADMIN_PASSWORD=<gere uma senha forte>
   DOMAIN=seu-dominio.com.br
   ACME_EMAIL=voce@seu-dominio.com.br
   PLATFORM_URL=https://seu-dominio.com.br
   CF_API_TOKEN=<token do Cloudflare, 6.2>
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
   sudo chmod 600 /opt/app/.env
   ```

### 6.5 Publicação

```bash
sudo bash /opt/app/infra/scripts/deploy.sh
```
Builda e sobe tudo (`docker-compose.yml` + `docker-compose.prod.yml`, com o Caddy). Na primeira vez, o Caddy pode levar um minuto emitindo o certificado wildcard — acompanhe com `sudo docker compose logs -f caddy`.

### 6.6 Testar

```
https://seu-dominio.com.br/super-admin       → painel da plataforma
https://<slug-do-cliente>.seu-dominio.com.br → app de um cliente cadastrado
```
Confira o cadeado (certificado válido, inclusive no subdomínio) e que pedido/WebSocket funcionam de ponta a ponta. As senhas de admin/garçom/cozinha são definidas ao cadastrar cada cliente no painel Super Admin (login com `SUPER_ADMIN_USERNAME`/`SUPER_ADMIN_PASSWORD`). Ver README.md.

### 6.7 GitHub Actions (deploy automático, opcional)

Totalmente opcional — sem isso, publique mudanças rodando `infra/scripts/deploy.sh` via console/SSH. Para automatizar:
1. Gere um par de chaves SSH só para isso (`ssh-keygen -t ed25519 -f deploy_key -N ""`).
2. Adicione a chave pública em `~/.ssh/authorized_keys` do usuário `ec2-user` na instância (confirme o usuário na aba "Connect").
3. A porta 22 precisa estar aberta para o GitHub Actions — os IPs dele variam, então `sshAllowedCidr` restrito ao seu IP **não** serve. Pese esse risco antes de ligar.
4. No repositório GitHub: **Settings → Secrets and variables → Actions**: secret `DEPLOY_SSH_KEY` (chave privada) e variable `INSTANCE_HOST` (IP estático ou domínio).

Todo push em `main` passa a rodar `infra/scripts/deploy.sh` na instância via SSH ([.github/workflows/deploy.yml](./.github/workflows/deploy.yml)).

### 6.8 Camadas específicas da Fase 2

| Camada | Serviço | Por quê |
|---|---|---|
| DNS | **Cloudflare** (plano gratuito) | Hospeda o domínio e o registro **wildcard** (`*.seu-domínio`) que todo subdomínio de cliente precisa. |
| TLS | **Caddy** (container, `infra/caddy/`) | Emite e renova HTTPS sozinho, **incluindo o wildcard**, via desafio DNS no Cloudflare. |
| Credencial AWS | Usuário IAM com **uma única permissão**: gravar no bucket de backup | É a única chamada à API da AWS que a instância faz; menor escopo possível. |
| Backup de desastre | Snapshot automático nativo do Lightsail | Diário, add-on `AutoSnapshot` em `infra/lib/platform-stack.ts`. |

**Rede**: só as portas 80 e 443 ficam abertas no firewall do Lightsail (e 22, só se você configurar `sshAllowedCidr`); do lado do Docker, só o Caddy publica porta no host (`docker-compose.prod.yml` nunca carrega o `docker-compose.override.yml` que expõe Postgres/Redis/backend no ambiente local).

### 6.9 Quanto custa por mês (Fase 2)

Região `sa-east-1` (São Paulo), instância 24/7. Conversão a ~R$5,00/USD — **a cotação muda todo dia**.

| Item | USD/mês | BRL/mês (≈R$5,00) |
|---|---|---|
| Pacote Lightsail 2 GB (computação + disco + IP + tráfego) | ~12-15 | ~R$ 60-75 |
| Backup S3 (poucos MB/dia, expira em 30 dias) | ~0,10 | ~R$ 0,50 |
| DNS (Cloudflare) | 0 | R$ 0 |
| **Total aproximado** | **~12-16** | **~R$ 60-80** |

A Fase 1 usa o pacote de 1 GB, sem S3 nem domínio: confira o preço na [página de preços do Lightsail](https://aws.amazon.com/pt/lightsail/pricing/) — em `sa-east-1` costuma ficar um pouco acima do de `us-east-1`.

O valor é fixo só em parte: o pacote é preço fechado, mas transferência além da franquia e o pouco de armazenamento no S3 variam com o uso; e a AWS cobra em **dólar**, então o valor em reais oscila com o câmbio.

---

## 7. Backup e restore do banco de dados

**Fase 1**: só o snapshot diário do Lightsail (console → sua instância → **Snapshots**). Para restaurar, crie uma instância a partir do snapshot.

**Fase 2** — backup diário automático para o S3, agendado na instância:
```bash
sudo crontab -e
# adicione:
0 5 * * * /opt/app/infra/scripts/backup-postgres.sh >> /var/log/backup-postgres.log 2>&1
```
Isso sobe um `pg_dump` compactado por dia para o bucket (`BackupBucketName`), que expira sozinho em 30 dias — autenticado com a Access Key da seção 6.4. Rode uma vez à mão para validar que o arquivo aparece no bucket. O script usa o `aws` CLI na instância; confira com `aws --version` e, se faltar, instale (`sudo dnf install -y awscli`).

**Restore** de um backup específico:
```bash
aws s3 cp s3://<bucket>/postgres/<timestamp>.sql.gz - | gunzip | \
  sudo docker compose exec -T postgres psql -U mesaviva mesaviva
```

**Se preferir não cuidar disso**: trocar o Postgres em container por um banco gerenciado (RDS, ou "Lightsail Managed Database") é só mudar a `DATABASE_URL` — nenhum código da aplicação depende de como o Postgres está hospedado. Ver seção 10.

## 8. Atualizações de infraestrutura depois do primeiro deploy

Mudou algo em `infra/lib/platform-stack.ts`? Rode de novo:
```bash
cd infra && npx cdk diff   # revisa o que vai mudar antes
npx cdk deploy -c phase=<pilot|prod>
```
Passe os mesmos `-c` do deploy anterior (principalmente `phase` e `bundleId`/`repoUrl`, se tiver customizado — sem eles, voltam aos padrões).

> Atenção: mudar `phase`, `bundleId` ou `blueprintId` **recria a instância** (o disco de sistema é recriado) — faça dump do banco antes (seção 5) e não em horário de pico.

## 9. Desligar tudo (evitar custo surpresa)

```bash
cd infra && npx cdk destroy
```
Remove a instância, o IP estático e o usuário IAM de backup. **O bucket de backup (`BackupBucket`) fica retido de propósito** (`RemovalPolicy.RETAIN`) — apague manualmente pelo console/CLI se não precisar mais dos backups. Na Fase 2, lembre de remover também os registros DNS no Cloudflare. Snapshots do Lightsail geram cobrança própria; apague os que não quiser manter.

## 10. Quando crescer além de ~10 clientes

Sinais de que vale migrar: a instância frequentemente perto do limite de CPU/memória, ou downtime único vira um risco de negócio inaceitável.
1. Primeiro passo intermediário, barato: trocar o Postgres em container por um banco gerenciado (RDS ou Lightsail Managed Database) — uma variável de ambiente.
2. Depois, se o tráfego justificar: múltiplas instâncias atrás de um load balancer, com Redis saindo do container e virando serviço gerenciado (para sincronizar WebSocket entre elas). Nesse ponto, migrar de Lightsail para EC2/ECS passa a valer o esforço, e o caminho de volta ao Route 53 (IAM Instance Role de novo) também volta a fazer sentido.

## 11. Resolução de problemas comuns

**Fase 1 — o site abre mas diz "restaurante não encontrado" / lista vazia**: você acessou pelo IP puro ou por um prefixo diferente do slug. Use sempre `http://<slug>.<ip-com-hifens>.sslip.io` (seção 4.1) e confira se o cliente foi cadastrado com esse slug no Super Admin.

**Fase 1 — o endereço não abre**: confira que o firewall do Lightsail tem a porta 80 aberta (o CDK abre 80 e 443), que `docker compose ps` mostra o `frontend` com `0.0.0.0:80->80`, e que você está usando `http://` (não `https://`).

**Fase 2 — certificado não emite / Caddy fica reiniciando**: confira `sudo docker compose logs caddy` — geralmente é `CF_API_TOKEN` ausente/errado, token sem a permissão certa ("Edit zone DNS" na zona específica) ou registros DNS do Cloudflare ainda com o proxy laranja ativado (precisa estar "DNS only"). Ver 6.2.

**Memória apertada durante o deploy**: o pico é o *build* do frontend (`vite build`), que roda com os containers antigos ainda de pé. O CDK cria um swap de 2 GB como rede de segurança. Se o build ainda falhar por falta de memória na Fase 1, ou use temporariamente o pacote de 2 GB, ou reduza a concorrência parando os containers antes do build (`sudo docker compose down` e depois `deploy.sh`).

**`docker compose` não encontrado na instância**: o `userData` do CDK instala os plugins compose e buildx (x86_64) no primeiro boot; se você acessou cedo demais, aguarde alguns minutos e confira `docker compose version` e `docker buildx version`. Se criou a instância antes dessa correção, instale-os manualmente em `/usr/local/lib/docker/cli-plugins/`. O erro `compose build requires buildx 0.17.0 or later` indica buildx faltando.

**Não consigo conectar via SSH / o console diz "Browser-based SSH connections aren't available"**: a regra de firewall da porta 22 com o alias `lightsail-connect` está faltando (instâncias criadas antes dessa regra existir no CDK). Rode `npx cdk deploy` de novo, ou no console: instância → **Networking** → **IPv4 Firewall** → **Add rule** → SSH, marcando "Restrict to Lightsail browser-based SSH/RDP client".

**Quero ver os logs da aplicação**: `sudo docker compose logs -f backend` (ou `frontend`, `postgres`, `caddy` na Fase 2) na instância.
