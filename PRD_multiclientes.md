# PRD — Meu Restaurante Multi-clientes (SaaS)

Este documento estende o [PRD.md](./PRD.md) original. Ele **substitui** a exclusão registrada na seção 11 do PRD original ("Suporte a múltiplos restaurantes/franquias (modelo SaaS) — produto é sob medida para um único estabelecimento") — essa decisão mudou, e este é o plano para fazer a mudança.

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Modelo de Dados Multi-tenant](#2-modelo-de-dados-multi-tenant)
3. [Identificação do Tenant (Subdomínio)](#3-identificação-do-tenant-subdomínio)
4. [Área Administrativa da Plataforma (Super Admin)](#4-área-administrativa-da-plataforma-super-admin)
5. [Fase SaaS — Cobrança e Liberação de Acesso](#5-fase-saas--cobrança-e-liberação-de-acesso)
6. [Sugestões](#6-sugestões)
7. [Roadmap](#7-roadmap)
8. [Riscos](#8-riscos)

---

## 1. Visão Geral

Hoje o Meu Restaurante é **single-tenant**: um banco de dados, um cardápio, uma marca, três logins fixos (admin/garçom/cozinha — um usuário cada, via variável de ambiente). Essa versão já está implementada e funcionando (Fases 1–5 do PRD original) — rodando hoje para um único cliente real, o **Diferente D+** (usado como exemplo ao longo deste documento sempre que for preciso ilustrar "um cliente da plataforma").

O objetivo agora é transformar o mesmo sistema numa **plataforma multi-tenant**: vários restaurantes/bares (clientes) usando a mesma aplicação, o mesmo banco de dados, a mesma infraestrutura — mas **sem nenhum cliente ver, acessar ou misturar dados de outro**. Cada cliente tem seu próprio cardápio, suas próprias mesas, seus próprios pedidos, sua própria equipe (admin/garçom/cozinha) e sua própria marca (nome + logo) exibida no app.

Duas fases, nessa ordem:

- **Fase 6 — Multi-tenancy**: a plataforma suporta múltiplos clientes isolados, com uma área administrativa onde você (dono da plataforma) cadastra cada cliente novo e a logo dele. Sem cobrança automática ainda — acesso liberado manualmente.
- **Fase 7 — SaaS**: acesso de cada cliente passa a ser controlado automaticamente pelo pagamento da mensalidade (cobrança recorrente, bloqueio por inadimplência, liberação automática ao pagar).

**Decisões já tomadas** (ver seções 2 e 3 para o raciocínio completo):
- Isolamento de dados: **um banco só, isolado por código** (coluna `tenant_id` em cada tabela) — não um banco físico separado por cliente.
- Identificação do cliente: **subdomínio** (`<slug-do-cliente>.meurestaurante.app`) — não caminho na URL.

## 2. Modelo de Dados Multi-tenant

### 2.1 Nova entidade `Tenant`

Representa cada cliente (restaurante/bar) cadastrado na plataforma.

| Campo | Tipo | Observação |
|---|---|---|
| `id` | uuid | — |
| `name` | string | Nome do estabelecimento, ex. "Diferente Demais Lounge Bar" |
| `slug` | string, único | Vira o subdomínio: `slug.meurestaurante.app` |
| `logoUrl` | string | Logo exibida no `Logo.tsx` (ver seção 3) |
| `primaryColor` / `accentColor` | string, opcional | Para permitir um mínimo de identidade visual além da logo (ver seção 6) |
| `status` | enum | `trial` \| `active` \| `past_due` \| `suspended` (ver seção 5) |
| `plan` | enum | Plano contratado (ver seção 6) |
| `createdAt` | datetime | — |

### 2.2 `tenant_id` em todas as tabelas operacionais

Toda tabela que hoje guarda dado de um restaurante específico ganha uma coluna `tenant_id` (FK para `Tenant`), e **toda query do backend passa a filtrar por ela**:

- `RestaurantTable`, `MenuItem`, `Order`, `OrderLine`, `Bill`, `BillLine`, `Review` — ganham `tenant_id` diretamente.
- `LoyaltyAccount` — hoje a chave única é só o telefone do cliente final. Isso precisa virar **único por `(tenant_id, phone)`**: o mesmo número de celular pode frequentar dois restaurantes diferentes na plataforma sem misturar pontos de fidelidade entre eles.

### 2.3 Login de equipe deixa de ser por variável de ambiente

Hoje (`server/src/auth.ts`) há exatamente 3 contas fixas — admin/garçom/cozinha —, cada uma com usuário/senha vindos de uma variável de ambiente única, compartilhada por todo o sistema. Isso não funciona com múltiplos clientes: cada um precisa da sua própria equipe.

Vira uma tabela `TenantUser` (ou nome equivalente): `tenantId`, `username`, `passwordHash`, `role` (`admin` \| `garcom` \| `cozinha`, os mesmos três papéis já existentes). O JWT passa a carregar `tenantId` além de `role`, e toda ação do backend confere os dois — não só "é admin", mas "é admin **deste** tenant".

O **super admin** (dono da plataforma, seção 4) é um papel à parte, fora dessa tabela — não pertence a nenhum tenant, pertence à plataforma.

### 2.4 Por que coluna `tenant_id` em vez de banco separado por cliente

Avaliadas duas estratégias comuns de isolamento multi-tenant:

| | Banco único + `tenant_id` (escolhida) | Banco separado por cliente |
|---|---|---|
| Custo de infraestrutura | Um RDS, um ECS service — igual ao que já existe hoje (Fase 5) | Um RDS por cliente (ou um banco lógico por cliente no mesmo servidor) — custo cresce com cada cliente novo |
| Migrations | Uma vez, afeta todos os clientes | Precisa rodar em cada banco, a cada deploy |
| Isolamento | Lógico (por código/query) — forte se bem implementado, mas depende de disciplina | Físico — mais forte, bom para exigência contratual/compliance específica |
| Operação | Simples, mesma pipeline de hoje | Cada cliente novo é mais trabalho operacional |

Para o porte de cliente que essa plataforma deve atender (bares/restaurantes individuais, não grandes redes), banco único com `tenant_id` é o padrão de mercado para SaaS pequeno/médio e foi a opção confirmada. Fica registrado aqui como possível evolução futura: se algum cliente grande exigir isolamento físico por contrato, dá para oferecer banco dedicado como diferencial de um plano "Enterprise" (ver seção 6), sem precisar migrar todo mundo.

**Mitigação do risco principal dessa escolha** (uma query esquecer o filtro `tenant_id` e vazar dado entre clientes) — ver seção 8.

## 3. Identificação do Tenant (Subdomínio)

Cada cliente recebe um subdomínio: `<slug>.meurestaurante.app`. Um QR code na mesa de um cliente aponta para `barxyz.meurestaurante.app/mesa/3`, por exemplo.

Domínio próprio do cliente (ex.: `pedidos.barxyz.com.br` apontando via CNAME para a plataforma) fica registrado como extensão natural futura — possivelmente um diferencial de plano pago (ver seção 6) — mas não é necessário para o lançamento da Fase 6.

### O que isso muda em cada parte do sistema já existente

**Infraestrutura (Fase 5 / `infra/`)**: hoje não há domínio próprio configurado (frontend e backend saem em `*.cloudfront.net`, ver `AWS_DEPLOYMENT.md` seção 11). Para suportar subdomínio por cliente, entra:
- Um domínio próprio da plataforma registrado no Route 53 (ex. `meurestaurante.app`).
- Certificado ACM **wildcard** (`*.meurestaurante.app`), não um certificado de domínio único.
- Registro DNS wildcard apontando para o CloudFront do frontend.
- O backend precisa resolver o tenant a partir do `Host` do request recebido (seja direto, seja repassado pelo CloudFront/ALB).

**Frontend**: a marca (nome + logo, hoje fixos em `src/components/Logo.tsx`) passa a ser **carregada dinamicamente** a partir do tenant resolvido pelo subdomínio — a aplicação faz uma chamada inicial (`GET /api/tenant` ou equivalente) para descobrir "qual cliente é esse subdomínio" antes de renderizar o resto.

**WebSocket (`server/src/index.ts`, `server/src/redis.ts`)**: hoje todo cliente conectado recebe todo broadcast (`wss.clients` + um único canal Redis `mesa-viva:broadcast`, implementado na Fase 4 para fan-out entre instâncias). Em multi-tenant, isso **vira vazamento de dado entre clientes** se não for corrigido: um pedido feito no restaurante A não pode chegar na tela de cozinha do restaurante B. Cada conexão WebSocket precisa ser amarrada ao `tenantId` resolvido no momento da conexão (via subdomínio), e o backend só retransmite mensagens daquele tenant para aquela conexão — na prática, um canal Redis por tenant (`mesa-viva:broadcast:<tenantId>`) em vez de um canal global.

## 4. Área Administrativa da Plataforma (Super Admin)

Um papel novo, **acima** de admin/garçom/cozinha: `super_admin`. Não pertence a nenhum tenant — é você, dono da plataforma.

Área própria (sugestão: `painel.meurestaurante.app`, ou `/super-admin` numa rota separada do app comum — subdomínio próprio é mais limpo, já que o app principal passa a resolver tudo por subdomínio de cliente):

- **Listar clientes** cadastrados, com status (trial/ativo/inadimplente/suspenso) e plano.
- **Cadastrar cliente novo**: nome, slug (= subdomínio), logo (upload), plano inicial. Nesta fase o cadastro é **manual**, feito por você — sem auto-cadastro público ainda (ver seção 6 sobre quando isso pode fazer sentido).
- **Editar cliente**: trocar logo, nome, plano.
- **Suspender/reativar cliente manualmente** (independente da Fase SaaS — útil mesmo antes de cobrança automática existir, por qualquer motivo comercial).
- **Ver atividade básica** por cliente: nº de mesas, nº de pedidos no período, último acesso — o suficiente para saber se um cliente está realmente usando o sistema.

## 5. Fase SaaS — Cobrança e Liberação de Acesso

Depois que a Fase 6 estiver no ar (multi-tenant funcionando, com cadastro manual), a Fase 7 automatiza a liberação de acesso de acordo com pagamento.

### 5.1 Status e ciclo de vida do tenant

`Tenant.status`: `trial` → `active` → `past_due` (pagamento atrasado, mas ainda com carência) → `suspended` (acesso bloqueado) — e de volta a `active` assim que o pagamento é regularizado.

Um middleware no backend confere o status do tenant em toda requisição: se `suspended`, a aplicação mostra uma tela "assinatura pendente, entre em contato" em vez do app normal — **os dados do cliente não são apagados**, só o acesso é bloqueado. Isso evita o pior cenário (perder o cliente porque os dados dele sumiram) mesmo em caso de erro de cobrança.

### 5.2 Gateway de pagamento recorrente

Duas famílias de opção, sem travar o documento numa escolha definitiva agora (decisão natural de começo da Fase 7, não da Fase 6):

| | Stripe Billing | Processadora nacional (Asaas, Vindi, Pagar.me, Iugu) |
|---|---|---|
| Integração | APIs e documentação excelentes, muito usado globalmente | Também maduras, pensadas para o mercado brasileiro |
| Pix / boleto | Stripe já suporta Pix e Boleto no Brasil, mas é um recurso mais recente na plataforma | Suporte nativo e maduro a Pix/boleto recorrente — é o core business dessas empresas |
| Nota fiscal (NF-e) | Não emite — precisaria de integração à parte | Algumas (Asaas, por exemplo) já emitem nota fiscal de serviço integrada |
| Customer Portal pronto | Sim (Stripe Customer Portal) — cliente gerencia cartão/fatura sem você construir nada | Varia por provedor; a maioria tem alguma forma de portal/link de pagamento |

**Recomendação**: para um produto 100% em português, vendido no Brasil, com cliente final que provavelmente prefere pagar por Pix — uma processadora nacional (Asaas é um bom ponto de partida: Pix/boleto recorrente maduro, emissão de nota fiscal integrada, bom custo-benefício para negócio pequeno) tende a encaixar melhor do que Stripe. Stripe continua uma opção sólida se a prioridade for robustez de API/documentação e não precisar de nota fiscal automática desde o início.

### 5.3 Fluxo de cobrança

1. Cliente assina um plano (criado manualmente pelo super admin na Fase 6, ou via fluxo de assinatura se/quando existir auto-cadastro).
2. Cobrança recorrente mensal via o gateway escolhido.
3. Webhook do gateway avisa a plataforma quando um pagamento é confirmado ou falha.
4. Falha de pagamento → `Tenant.status = past_due`, com um período de carência (ver seção 6) antes de `suspended`.
5. Pagamento confirmado → `Tenant.status = active` de novo, automaticamente.

## 6. Sugestões

Pontos que não foram pedidos explicitamente, mas que recomendo considerar:

- **Planos/tiers**: ex. *Básico* (até N mesas, 1 conta de cada papel, sem domínio próprio) e *Profissional* (mais mesas, múltiplas contas de garçom, domínio próprio, suporte prioritário). Dá direção comercial clara e justifica a diferença de preço.
- **Carência antes de suspender por atraso** (ex. 5–7 dias em `past_due` antes de `suspended`) — evita suspender um cliente por uma falha pontual de cartão.
- **LGPD**: a plataforma passa a guardar dados de clientes finais (telefone no programa de fidelidade, avaliações) de *múltiplos negócios diferentes* ao mesmo tempo. Vale deixar pronto desde já: uma política de privacidade própria da plataforma, e a possibilidade de um tenant exportar ou apagar os dados dos seus próprios clientes finais sob pedido.
- **Migração do tenant atual**: o "Diferente D+" de hoje já está em produção com dados reais (cardápio, e potencialmente pedidos/contas). Ele precisa virar o **primeiro tenant cadastrado** no novo modelo — é preciso um script de migração que crie esse tenant e preencha `tenant_id` em todas as linhas já existentes, não só meter a feature nova e deixar os dados antigos "órfãos".
- **Usar o Customer Portal do gateway escolhido** em vez de construir uma tela de "gerenciar assinatura" do zero — acelera muito a Fase 7.
- **Limites de plano aplicados no backend**, não só escondidos/desabilitados no front — senão vira só estética, não controle de verdade.
- **Auto-cadastro público** (um cliente novo se cadastra sozinho, sem você precisar criar manualmente): não recomendo para o lançamento da Fase 6 — comece com cadastro manual pelo super admin, valide o modelo com os primeiros clientes reais, e só depois automatize a entrada de novos clientes quando o volume justificar.

## 7. Roadmap

Numeração em sequência com o `PRD.md` original (que vai até a Fase 5):

**Fase 6 — Multi-tenancy**
Entidade `Tenant`, `tenant_id` em todas as tabelas operacionais, login de equipe por tenant, resolução por subdomínio (frontend + backend + WebSocket/Redis escopados por tenant), área de Super Admin para cadastrar cliente e logo, migração do tenant atual para o novo modelo. Pré-requisito: Fases 4 e 5 (containerização e infraestrutura AWS) já implementadas.

**Fase 7 — SaaS (Cobrança e Liberação de Acesso)**
Campos de plano/status no `Tenant`, integração com gateway de pagamento recorrente (ver seção 5.2), webhook de confirmação/falha de pagamento, middleware de bloqueio por status, período de carência. Pré-requisito: Fase 6 completa e validada com pelo menos um cliente real além do "Diferente D+".

## 8. Riscos

- **Vazamento de dado entre tenants** é o risco técnico central desta mudança — qualquer query no backend que esqueça o filtro `tenant_id` expõe dado de um cliente para outro. Mitigação recomendada: usar uma [Prisma Client Extension](https://www.prisma.io/docs/orm/prisma-client/client-extensions) (ou middleware equivalente) que injeta o filtro `tenant_id` automaticamente em toda query das tabelas multi-tenant, em vez de confiar que cada desenvolvedor vai lembrar de adicionar `where: { tenantId }` manualmente em cada chamada.
- **WebSocket/Redis sem segmentação por tenant** é o mesmo risco, só que em tempo real: se o canal de broadcast não for separado por tenant (seção 3), um pedido de um cliente pode aparecer na tela de outro.
- **Custo de infraestrutura por certificado/domínio wildcard**: pequeno, mas é uma peça nova na Fase 5 que precisa ser orçada (ver `AWS_DEPLOYMENT.md`).
- **Gateway de pagamento mal integrado** pode suspender cliente pagante por erro de webhook — por isso o período de carência (seção 6) e logs claros de cada mudança de status são importantes desde o começo da Fase 7.
