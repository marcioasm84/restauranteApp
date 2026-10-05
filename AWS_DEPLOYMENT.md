# Implantação na AWS (Fase 5)

Guia passo a passo para colocar o Diferente D+ no ar na AWS, usando a infraestrutura já escrita em [infra/](./infra) (AWS CDK) e o pipeline em [.github/workflows/deploy.yml](./.github/workflows/deploy.yml). Ver também [PRD.md](./PRD.md) seção 12.4 para o raciocínio por trás de cada escolha de serviço.

Este documento assume que você nunca usou a AWS antes. Se já tem conta e CLI configurados, pule direto para a seção 5.

## Sumário

1. [O que vai para o ar, e onde](#1-o-que-vai-para-o-ar-e-onde)
2. [Quanto isso custa por mês](#2-quanto-isso-custa-por-mês)
3. [Pré-requisitos](#3-pré-requisitos)
4. [Criar e proteger a conta AWS](#4-criar-e-proteger-a-conta-aws)
5. [Configurar as ferramentas localmente](#5-configurar-as-ferramentas-localmente)
6. [Implantar a infraestrutura (cdk deploy)](#6-implantar-a-infraestrutura-cdk-deploy)
7. [Buscar as senhas de admin/garçom/cozinha geradas](#7-buscar-as-senhas-de-admingarçomcozinha-geradas)
8. [Primeira publicação da aplicação (manual)](#8-primeira-publicação-da-aplicação-manual)
9. [Configurar o GitHub Actions (deploys automáticos)](#9-configurar-o-github-actions-deploys-automáticos)
10. [Testar tudo](#10-testar-tudo)
11. [(Opcional) Domínio próprio e HTTPS com seu domínio](#11-opcional-domínio-próprio-e-https-com-seu-domínio)
12. [Monitoramento e logs](#12-monitoramento-e-logs)
13. [Atualizações de infraestrutura depois do primeiro deploy](#13-atualizações-de-infraestrutura-depois-do-primeiro-deploy)
14. [Desligar tudo (evitar custo surpresa)](#14-desligar-tudo-evitar-custo-surpresa)
15. [Resolução de problemas comuns](#15-resolução-de-problemas-comuns)

---

## 1. O que vai para o ar, e onde

| Peça | Serviço AWS | Definido em |
|---|---|---|
| Frontend (build do Vite) | S3 + CloudFront (HTTPS automático, grátis, sem precisar de domínio) | `infra/lib/frontend-stack.ts` |
| Backend (API + WebSocket) | ECS Fargate (2 tasks) atrás de um Application Load Balancer, e esse ALB atrás de **outro** CloudFront (mesmo motivo: HTTPS automático sem domínio) | `infra/lib/backend-stack.ts` |
| Banco de dados | RDS PostgreSQL (`db.t4g.micro`) | `infra/lib/data-stack.ts` |
| Fan-out do WebSocket entre as 2 tasks | ElastiCache Redis (`cache.t4g.micro`) | `infra/lib/data-stack.ts` |
| Rede | VPC com subnets públicas/privadas/isoladas, 1 NAT Gateway | `infra/lib/network-stack.ts` |
| Deploy automático (CI/CD) | GitHub Actions autenticando via OIDC (sem chave de acesso fixa) | `infra/lib/cicd-stack.ts` + `.github/workflows/deploy.yml` |
| Imagem Docker do backend | Amazon ECR | `infra/lib/backend-stack.ts` |
| Senhas (JWT, admin, garçom, cozinha, banco) | Secrets Manager (geradas aleatoriamente no primeiro deploy) | `infra/lib/data-stack.ts` |

**Importante — divisão de responsabilidade:** o GitHub Actions só publica a *aplicação* (nova imagem do backend, novo build do frontend) em cima de uma infraestrutura que **já existe**. Criar ou alterar a infraestrutura em si (`cdk deploy`) é sempre um passo manual, rodado do seu computador — de propósito: dar ao workflow automático permissão para criar/destruir recursos AWS livremente é um risco desnecessário para um projeto deste tamanho.

## 2. Quanto isso custa por mês

Estimativa para a região `sa-east-1` (São Paulo), com a infraestrutura rodando 24/7 o mês inteiro:

| Item | Estimativa (USD/mês) |
|---|---|
| NAT Gateway (taxa fixa + processamento) | ~35–50 |
| ECS Fargate (2 tasks pequenas, 0.25 vCPU / 0.5 GB cada) | ~15–25 |
| RDS `db.t4g.micro` + 20 GB de armazenamento | ~15–20 |
| ElastiCache `cache.t4g.micro` | ~13–16 |
| Application Load Balancer | ~20–25 |
| CloudFront + S3 (tráfego baixo) | ~1–5 |
| Secrets Manager (5 segredos) | ~2 |
| ECR (armazenamento de imagens) | <1 |
| **Total aproximado** | **~100–140 USD/mês** |

Isso é só uma estimativa — confirme na [Calculadora de Preços da AWS](https://calculator.aws/) antes de decidir. Dois jeitos simples de reduzir o custo:
- Trocar `desiredCount: 2` por `1` em `infra/lib/backend-stack.ts` (perde a redundância entre tasks, mas o app continua funcionando) — economiza a segunda task do Fargate.
- O maior custo fixo é o **NAT Gateway**. Dá pra eliminá-lo com VPC Endpoints (ECR, S3, Secrets Manager, CloudWatch Logs) no lugar de saída via NAT, mas isso é uma otimização futura, não está implementado agora.

**Configure um alarme de orçamento antes de prosseguir** — seção 4.3 abaixo.

## 3. Pré-requisitos

Instale localmente (no seu computador, não precisa ser na mesma máquina que já tem o projeto):

- [Node.js 20+](https://nodejs.org/) (você já tem, por causa do frontend/backend)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (você já tem, por causa da Fase 4)
- [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- Git e uma conta no GitHub com o repositório deste projeto já publicado (você já tem — `marcioasm84/restauranteApp`)

Você **não** precisa instalar o CDK CLI globalmente — `infra/package.json` já tem `aws-cdk` como dependência local, usado via `npx`.

## 4. Criar e proteger a conta AWS

Pule esta seção se você já tem uma conta AWS com um usuário IAM administrativo.

### 4.1 Conta

Crie uma conta em [aws.amazon.com](https://aws.amazon.com/) — precisa de cartão de crédito. O login inicial ("root user", seu e-mail) tem poder irrestrito sobre a conta; **não o use no dia a dia**.

1. Ative autenticação em dois fatores (MFA) no usuário root (IAM → Dashboard de segurança).
2. Crie um usuário IAM para você mesmo usar (IAM → Users → Create user), com acesso administrativo (`AdministratorAccess`) e login por console + chaves de acesso (access key) para a CLI.
3. Guarde o Access Key ID e Secret Access Key gerados — eles só aparecem uma vez.

### 4.2 Região

Este guia usa `sa-east-1` (São Paulo) por padrão — já configurado em `infra/bin/app.ts`. Se preferir outra região (ex.: `us-east-1`, geralmente mais barata), rode os comandos CDK com `-c awsRegion=us-east-1`.

### 4.3 Alarme de orçamento (recomendado antes de continuar)

AWS Billing → Budgets → Create budget → "Monthly cost budget", defina um valor (ex.: 150 USD) e um e-mail para avisar em 80%/100%. Leva 2 minutos e evita surpresa na fatura.

## 5. Configurar as ferramentas localmente

```bash
aws configure
# AWS Access Key ID: <a que você gerou em 4.1>
# AWS Secret Access Key: <idem>
# Default region name: sa-east-1
# Default output format: json
```

Confirme que funcionou:

```bash
aws sts get-caller-identity
```

Deve devolver seu Account ID, não um erro.

Instale as dependências do CDK:

```bash
cd infra
npm install
```

## 6. Implantar a infraestrutura (cdk deploy)

### 6.1 Bootstrap (só na primeira vez, por conta+região)

Cria um bucket S3 e papéis IAM que o CDK usa internamente para publicar os templates:

```bash
npx cdk bootstrap
```

### 6.2 Revisar o que vai ser criado (opcional, mas recomendado)

```bash
npx cdk diff --all
```

### 6.3 Implantar

```bash
npx cdk deploy --all
```

O CDK vai listar as permissões IAM que cada stack cria e pedir confirmação (`y`) antes de prosseguir — a stack `DiferenteDmais-CiCd`, em especial, cria um papel que o GitHub Actions poderá assumir. Isso é esperado.

**Isso demora.** A primeira vez costuma levar 15–25 minutos — o RDS sozinho leva uns 10 minutos para ficar disponível. As stacks sobem nesta ordem (uma depende da outra): `Network` → `Data` → `Backend` → `Frontend` → `CiCd`.

Ao final, o terminal mostra os **outputs** de cada stack — copie-os, você vai precisar:

```
DiferenteDmais-Backend.BackendUrl = https://xxxxxxxxxxxxxx.cloudfront.net
DiferenteDmais-Backend.BackendWsUrl = wss://xxxxxxxxxxxxxx.cloudfront.net/ws
DiferenteDmais-Backend.EcrRepositoryUri = <account>.dkr.ecr.sa-east-1.amazonaws.com/diferente-dmais-backend
DiferenteDmais-Backend.EcsClusterName = DiferenteDmais-Backend-ClusterXXXX
DiferenteDmais-Backend.EcsServiceName = DiferenteDmais-Backend-ServiceXXXX
DiferenteDmais-Frontend.BucketName = diferentedmais-frontend-sitebucketxxxx
DiferenteDmais-Frontend.DistributionId = EXXXXXXXXXXXX
DiferenteDmais-Frontend.SiteUrl = https://yyyyyyyyyyyyyy.cloudfront.net
DiferenteDmais-CiCd.DeployRoleArn = arn:aws:iam::<account>:role/diferente-dmais-github-deploy
```

Se perder essa saída, reveja qualquer uma delas a qualquer momento com:

```bash
aws cloudformation describe-stacks --stack-name DiferenteDmais-Backend --query "Stacks[0].Outputs"
```

(troque o nome da stack conforme necessário.)

## 7. Buscar as senhas de admin/garçom/cozinha geradas

O deploy gerou 4 segredos aleatórios (ninguém escolheu essas senhas — nem você, nem eu): a chave do JWT e uma senha para cada perfil. Leia os valores:

```bash
aws secretsmanager get-secret-value --secret-id DiferenteDmais-Data-AdminPassword --query SecretString --output text
aws secretsmanager get-secret-value --secret-id DiferenteDmais-Data-WaiterPassword --query SecretString --output text
aws secretsmanager get-secret-value --secret-id DiferenteDmais-Data-KitchenPassword --query SecretString --output text
```

(Os nomes exatos têm um sufixo aleatório da AWS — liste-os com `aws secretsmanager list-secrets --query "SecretList[].Name"` se os comandos acima não encontrarem o segredo pelo nome curto.)

Anote as três senhas — são as credenciais reais de produção para `admin`, `garcom` e `cozinha` (usuários fixos, só a senha é gerada). Quer trocar alguma depois? `aws secretsmanager put-secret-value --secret-id <nome> --secret-string '<nova senha>'`, e depois force um novo deploy do backend (seção 13.2) para a task pegar o valor novo.

## 8. Primeira publicação da aplicação (manual)

Antes de configurar o CI/CD, publique a aplicação uma vez manualmente — mais fácil de depurar problema por problema do que estrear tudo de uma vez via GitHub Actions.

### 8.1 Backend

```bash
# Autentica o Docker no ECR
aws ecr get-login-password --region sa-east-1 | docker login --username AWS --password-stdin <EcrRepositoryUri sem a imagem, só até .amazonaws.com>

cd server
docker build -t diferente-dmais-backend .
docker tag diferente-dmais-backend:latest <EcrRepositoryUri>:latest
docker push <EcrRepositoryUri>:latest

# Força o ECS a buscar a imagem recém-publicada
aws ecs update-service --cluster <EcsClusterName> --service <EcsServiceName> --force-new-deployment
```

Acompanhe até as tasks ficarem `RUNNING` e saudáveis:

```bash
aws ecs describe-services --cluster <EcsClusterName> --services <EcsServiceName> --query "services[0].deployments"
```

Teste:

```bash
curl https://<BackendUrl sem o https:// duplicado>/api/health
# {"ok":true}
```

### 8.2 Frontend

Builda apontando para o backend que acabou de subir:

```bash
cd ..  # raiz do projeto
VITE_API_URL=<BackendUrl> VITE_WS_URL=<BackendWsUrl> npm run build
aws s3 sync dist/ "s3://<BucketName>" --delete
aws cloudfront create-invalidation --distribution-id <DistributionId> --paths "/*"
```

Abra `<SiteUrl>` no navegador — deve carregar a Diferente D+ normalmente, já puxando o cardápio do Postgres de produção.

## 9. Configurar o GitHub Actions (deploys automáticos)

A partir daqui, um `git push` builda e publica sozinho. Configure os valores no GitHub: **Settings → Secrets and variables → Actions → Variables** (aba "Variables", não "Secrets" — nenhum desses valores é sensível, são nomes/IDs de recursos; a única credencial, o papel IAM, é assumida via OIDC, nunca armazenada):

| Nome | Valor |
|---|---|
| `AWS_DEPLOY_ROLE_ARN` | `DiferenteDmais-CiCd.DeployRoleArn` |
| `AWS_REGION` | `sa-east-1` (ou a região escolhida) |
| `ECR_REPOSITORY` | `diferente-dmais-backend` |
| `ECS_CLUSTER_NAME` | `DiferenteDmais-Backend.EcsClusterName` |
| `ECS_SERVICE_NAME` | `DiferenteDmais-Backend.EcsServiceName` |
| `ECS_TASK_FAMILY` | `diferente-dmais-backend` |
| `FRONTEND_BUCKET` | `DiferenteDmais-Frontend.BucketName` |
| `CLOUDFRONT_DISTRIBUTION_ID` | `DiferenteDmais-Frontend.DistributionId` |
| `BACKEND_URL` | `DiferenteDmais-Backend.BackendUrl` |
| `BACKEND_WS_URL` | `DiferenteDmais-Backend.BackendWsUrl` |

Depois, confira `.github/workflows/deploy.yml` — por padrão ele dispara em push para a branch `main`. Seu branch de trabalho atual é `restaurante_diferentedmais`; ajuste a lista em `on.push.branches` para a branch que você realmente trata como produção (ou faça merge dela em `main` antes de confiar no deploy automático).

## 10. Testar tudo

1. Abra `<SiteUrl>` — deve mostrar a tela de escolha de perfil.
2. Clique em "Ver cardápio" — deve carregar os pratos (confirma que o frontend está falando com o backend).
3. Vá em `/login` e entre com as credenciais de garçom/cozinha/admin obtidas na seção 7.
4. Faça um pedido de teste numa mesa liberada e confira se ele aparece na tela da cozinha em tempo real (confirma WebSocket + Redis fan-out entre as 2 tasks).
5. Dê um `git push` numa branch monitorada pelo workflow e acompanhe a aba **Actions** no GitHub — deve rodar `deploy-backend` e `deploy-frontend` com sucesso.

## 11. (Opcional) Domínio próprio e HTTPS com seu domínio

Sem isso, o site fica em `https://xxxx.cloudfront.net` — já funciona, já é HTTPS válido, só não tem o nome do seu restaurante.

1. **Comprar/apontar um domínio**: Route 53 → Registered domains → Register domain (ou, se o domínio já existe em outro registrador, crie uma Hosted Zone no Route 53 e aponte os nameservers do seu domínio para ela).
2. **Certificado**: Certificate Manager (ACM), **na região `us-east-1`** especificamente (exigência do CloudFront, mesmo que o resto esteja em `sa-east-1`) → Request certificate → valide por DNS (o ACM te dá um registro CNAME para criar no Route 53, um clique se a zona já estiver lá).
3. Isso ainda não está automatizado no CDK (`infra/lib/`) — é a próxima extensão natural: adicionar `domainNames` + `certificate` nas duas distribuições CloudFront (`frontend-stack.ts` e `backend-stack.ts`) e um registro `A`/`AAAA` do tipo alias no Route 53 apontando pra cada uma. Avise quando quiser que eu implemente essa parte.

## 12. Monitoramento e logs

- **Logs do backend**: CloudWatch → Log groups → `/diferente-dmais/backend` (ou `aws logs tail /diferente-dmais/backend --follow`).
- **Métricas do ECS**: Container Insights já está ligado (`containerInsights: true` no cluster) — CloudWatch → Container Insights.
- **Saúde do ALB**: EC2 → Load Balancers → Target Groups → aba "Targets" mostra se as tasks estão `healthy`.
- **Banco**: RDS → Databases → `DiferenteDmais-Data-...` → aba "Monitoring".

Nenhum alarme automático está configurado ainda (além do orçamento, seção 4.3) — considere adicionar alarmes de CPU/memória do ECS e de conexões do RDS se o restaurante for depender disso no dia a dia.

## 13. Atualizações de infraestrutura depois do primeiro deploy

### 13.1 Mudou algo em `infra/lib/*.ts`

```bash
cd infra
npx cdk diff --all   # confira o que vai mudar
npx cdk deploy --all
```

Sempre manual, sempre do seu computador — nunca via GitHub Actions (seção 1).

### 13.2 Só quer forçar um redeploy do backend (ex.: trocou uma senha no Secrets Manager)

```bash
aws ecs update-service --cluster <EcsClusterName> --service <EcsServiceName> --force-new-deployment
```

## 14. Desligar tudo (evitar custo surpresa)

```bash
cd infra
npx cdk destroy --all
```

Note que:
- O bucket S3 do frontend e o repositório ECR foram criados com `RemovalPolicy.RETAIN` — não são apagados automaticamente, para não perder imagens/build por engano. Apague-os manualmente depois se não forem mais necessários.
- O banco RDS usa `RemovalPolicy.SNAPSHOT` — ao destruir, a AWS tira um snapshot final antes de apagar a instância (esse snapshot continua existindo, e continua gerando um custo pequeno de armazenamento, até você apagá-lo manualmente em RDS → Snapshots).

## 15. Resolução de problemas comuns

**`cdk deploy` falha com "DB instance already exists" ou nomes duplicados**
Rodou `cdk deploy` duas vezes com stacks parcialmente aplicadas? Rode `npx cdk diff` para ver o estado real antes de tentar de novo.

**As tasks do ECS ficam reiniciando (`STOPPED` em loop)**
```bash
aws ecs describe-tasks --cluster <EcsClusterName> --tasks $(aws ecs list-tasks --cluster <EcsClusterName> --query "taskArns[0]" --output text) --query "tasks[0].stoppedReason"
```
Causas comuns: imagem ainda não publicada no ECR (rode a seção 8.1 primeiro), ou erro de conexão com o banco — confira os logs (seção 12).

**Frontend carrega mas o cardápio não aparece / erro de rede no console do navegador**
`VITE_API_URL`/`VITE_WS_URL` provavelmente não foram passados (ou vieram errados) no build do frontend — esses valores são embutidos no JavaScript **no momento do build**, não dá pra trocar depois sem rebuildar. Confira as variáveis do GitHub Actions (seção 9) ou refaça o build manual (seção 8.2) com os valores corretos.

**GitHub Actions falha em "Could not assume role"**
Confira se `AWS_DEPLOY_ROLE_ARN` está exatamente igual ao output `DiferenteDmais-CiCd.DeployRoleArn`, e se o workflow está rodando a partir do repositório `marcioasm84/restauranteApp` (o papel só confia nesse repo — ver `infra/lib/cicd-stack.ts`).

**Quero saber exatamente quanto já gastei**
AWS Billing → Cost Explorer, ou `aws ce get-cost-and-usage` via CLI.
