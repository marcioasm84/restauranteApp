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
9. [Fase 8 — Gestão Avançada do Estabelecimento](#9-fase-8--gestão-avançada-do-estabelecimento)

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

**Infraestrutura (Fase 5 / `infra/`)**: resolvido — o desenho de implantação atual (ver `AWS_DEPLOYMENT.md`) já nasce com domínio próprio e certificado **wildcard** de fábrica, via Caddy (desafio DNS no Cloudflare), em vez de ser um passo opcional posterior. Isso inclui:
- Um domínio próprio da plataforma, com a zona DNS hospedada no Cloudflare (ex. `meurestaurante.app`).
- Certificado **wildcard** (`*.meurestaurante.app`) emitido e renovado automaticamente pelo Caddy — não um certificado de domínio único.
- Registro DNS wildcard apontando pro IP estático da instância Lightsail.
- O backend resolve o tenant a partir do `Host` do request recebido (repassado pelo Caddy sem alteração).

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

- **Planos/tiers**: ex. *Básico* (até N mesas, 1 conta de cada papel, sem domínio próprio) e *Profissional* (mais mesas, múltiplas contas de garçom, domínio próprio, suporte prioritário). Dá direção comercial clara e justifica a diferença de preço. Hoje isso ainda é só uma trava de UI — contas individuais de garçom (ver seção 9.2) são o que torna esse limite tecnicamente real, não só estética.
- **Carência antes de suspender por atraso** (ex. 5–7 dias em `past_due` antes de `suspended`) — evita suspender um cliente por uma falha pontual de cartão.
- **LGPD**: a plataforma passa a guardar dados de clientes finais (telefone no programa de fidelidade, avaliações) de *múltiplos negócios diferentes* ao mesmo tempo. Vale deixar pronto desde já: uma política de privacidade própria da plataforma, e a possibilidade de um tenant exportar ou apagar os dados dos seus próprios clientes finais sob pedido.
- **Migração do tenant atual**: o "Diferente D+" de hoje já está em produção com dados reais (cardápio, e potencialmente pedidos/contas). Ele precisa virar o **primeiro tenant cadastrado** no novo modelo — é preciso um script de migração que crie esse tenant e preencha `tenant_id` em todas as linhas já existentes, não só meter a feature nova e deixar os dados antigos "órfãos".
- **Usar o Customer Portal do gateway escolhido** em vez de construir uma tela de "gerenciar assinatura" do zero — acelera muito a Fase 7.
- **Limites de plano aplicados no backend**, não só escondidos/desabilitados no front — senão vira só estética, não controle de verdade.
- **Auto-cadastro público** (um cliente novo se cadastra sozinho, sem você precisar criar manualmente): não recomendo para o lançamento da Fase 6 — comece com cadastro manual pelo super admin, valide o modelo com os primeiros clientes reais, e só depois automatize a entrada de novos clientes quando o volume justificar.

## 7. Roadmap

Numeração em sequência com o `PRD.md` original (que vai até a Fase 5):

**Fase 6 — Multi-tenancy** ✅ Implementada (local/Docker) — falta o domínio wildcard em produção
Entidade `Tenant`, `tenant_id` em todas as tabelas operacionais, login de equipe por tenant (com senha com hash, substituindo as variáveis de ambiente globais), resolução por subdomínio (frontend + backend + WebSocket/Redis escopados por tenant — Redis agora usa um canal por tenant via `psubscribe`), área de Super Admin (`/super-admin`) para cadastrar cliente e logo, migração do "Diferente D+" para o novo modelo. Testado de ponta a ponta com um segundo cliente de exemplo, confirmando isolamento total (cardápio, pedidos e broadcast em tempo real de um cliente nunca aparecem no outro). Pré-requisito: Fases 4 e 5 já implementadas.

Ainda falta para produção: comprar o domínio da plataforma e configurar o certificado/DNS wildcard na infraestrutura AWS (`infra/`) — hoje a Fase 5 só provisiona um domínio único, não `*.meurestaurante.app`. Local/Docker já funciona via `*.localhost`, sem precisar de domínio nenhum.

**Fase 7 — SaaS (Cobrança e Liberação de Acesso)**
Campos de plano/status no `Tenant`, integração com gateway de pagamento recorrente (ver seção 5.2), webhook de confirmação/falha de pagamento, middleware de bloqueio por status, período de carência. Pré-requisito: Fase 6 completa e validada com pelo menos um cliente real além do "Diferente D+".

**Fase 8 — Gestão Avançada do Estabelecimento**
Relatórios de vendas com filtro de período (hoje/7d/30d/mês/personalizado), gráfico de faturamento ao longo do tempo, comparação com o período anterior, quebra por categoria de prato e por forma de pagamento, exportação CSV; contas individuais de garçom/cozinha substituindo as 3 contas fixas de hoje, com nome próprio, atribuição de autoria em pedidos/contas e relatório de vendas por garçom (ver seção 9). É melhoria de produto, não de infraestrutura de cobrança — pode ser priorizada em paralelo à Fase 7, sem depender dela.

## 8. Riscos

- **Vazamento de dado entre tenants** é o risco técnico central desta mudança — qualquer query no backend que esqueça o filtro `tenant_id` expõe dado de um cliente para outro. Mitigação recomendada: usar uma [Prisma Client Extension](https://www.prisma.io/docs/orm/prisma-client/client-extensions) (ou middleware equivalente) que injeta o filtro `tenant_id` automaticamente em toda query das tabelas multi-tenant, em vez de confiar que cada desenvolvedor vai lembrar de adicionar `where: { tenantId }` manualmente em cada chamada.
- **WebSocket/Redis sem segmentação por tenant** é o mesmo risco, só que em tempo real: se o canal de broadcast não for separado por tenant (seção 3), um pedido de um cliente pode aparecer na tela de outro.
- **Instância única sem alta disponibilidade**: o desenho de baixo custo da Fase 5 (ver `AWS_DEPLOYMENT.md`) roda tudo numa única máquina — uma falha dela é downtime até restauração manual (snapshot diário mitiga perda de dado, não o tempo de recuperação). Aceitável para até ~10 clientes; o caminho pra alta disponibilidade real está documentado na seção 16 desse guia.
- **Gateway de pagamento mal integrado** pode suspender cliente pagante por erro de webhook — por isso o período de carência (seção 6) e logs claros de cada mudança de status são importantes desde o começo da Fase 7.

## 9. Fase 8 — Gestão Avançada do Estabelecimento

As Fases 6 e 7 resolvem a plataforma (multi-tenant, cobrança). Esta fase resolve o produto: dar ao dono de cada estabelecimento ferramentas de gestão de verdade, não só o fluxo de pedido em si. É melhoria que todo cliente sente diretamente — diferente das Fases 4/5 (infraestrutura), que já foram tratadas como paralelizáveis à Fase 3 no PRD original, esta fase pode ser priorizada em paralelo à Fase 7 (SaaS), sem depender dela.

### 9.1 Relatórios de Vendas com Histórico

**Hoje**: `getAnalyticsSummary` (`server/src/analytics.ts`) só calcula métricas de **hoje** (faturamento, contas fechadas, ticket médio), misturadas com métricas **all-time** (prato mais pedido, avaliação média) — sem parâmetro de período. `src/pages/admin/AdminAnalytics.tsx` reflete isso: a própria página diz "Visão geral do desempenho do dia", sem seletor de data, sem gráfico, sem exportação.

Proposto:
- **Seletor de período** no painel admin: hoje / 7 dias / 30 dias / mês atual / intervalo personalizado.
- `GET /api/analytics` passa a aceitar `from`/`to`, filtrando por `Bill.createdAt` dentro do tenant já resolvido — a base (tenant-scoping) já existe, só falta o filtro de data.
- **Gráfico de faturamento por dia** ao longo do período selecionado. O projeto não usa nenhuma biblioteca de gráficos hoje; algo leve como Recharts resolveria sem pesar muito o bundle — decisão técnica a confirmar na implementação, não travada aqui.
- **Comparação com o período anterior equivalente** (ex.: "+12% vs. semana passada").
- **Quebra por categoria de prato**, não só por item individual — `MenuItem.category` já existe, só falta agrupar por ela no relatório.
- **Fechamento de caixa por forma de pagamento** (Pix / cartão / carteira) — o dado já existe em `Bill.paymentMethod`, só falta esse corte no relatório.
- **Exportação em CSV** do período selecionado (vendas por dia, por prato, por forma de pagamento) — útil para levar à contabilidade.

### 9.2 Equipe com Contas Individuais (múltiplos garçons)

**Hoje**: existe só **uma conta de garçom por cliente** — `TenantUser.username` é sempre literalmente a string do papel (`"garcom"`, `"admin"`, `"cozinha"`; ver `server/src/tenantStore.ts`), criada uma única vez no cadastro do tenant. O schema (`@@unique([tenantId, username])` em `server/prisma/schema.prisma`) não impede múltiplas contas do mesmo papel, mas nenhum código hoje cria uma segunda. O JWT (`server/src/auth.ts`) carrega só `{ role, tenantId }` — nunca o nome de uma pessoa. `Order`, `StatusEvent` e `Bill` não têm nenhum campo de autoria: toda ação (lançar pedido, marcar pronto, fechar conta) é anônima por papel, nunca por indivíduo.

Proposto:
- `TenantUser` ganha um campo **`displayName`** (nome da pessoa, ex. "Rafaela"), além de `username`/senha/`role` que já existem.
- Tela **"Equipe"** no admin do próprio tenant (ex. `/admin/equipe`) para criar, renomear, trocar senha e desativar contas de garçom e cozinha — deixa de ficar restrito às 3 contas fixas criadas no cadastro.
- O **login (JWT) passa a carregar o nome** de quem está logado, não só o papel.
- `Order`, `StatusEvent` e `Bill` ganham um **campo opcional de autoria** (qual garçom lançou o pedido, qual fechou a conta) — pré-requisito direto do relatório de vendas por garçom abaixo.
- **Relatório de vendas por garçom** (quem vendeu quanto, quantas contas fechou, ticket médio por garçom) — conecta direto com a seção 9.1.
- Isso é o gancho técnico real para o limite de plano que a seção 6 já sugeria ("Profissional: múltiplas contas de garçom") — hoje essa diferenciação não existe de fato no sistema.

### 9.3 Outras sugestões de valor

Pontos que não foram pedidos explicitamente, mas que recomendo considerar junto com o resto desta fase:

- **Pausar item do cardápio temporariamente** ("esgotado hoje") sem precisar apagar e recriar o prato — hoje esse estado não existe, o item só existe ou não.
- **Alerta automático** (e-mail/WhatsApp) para o admin quando o faturamento do dia ficar abaixo de uma meta configurável.
- **Relatório de horário de pico** (pedidos por hora do dia / dia da semana) — ajuda a planejar escala de equipe.
- **Indicador de giro de mesa** (tempo médio que uma mesa fica ocupada) — já dá para calcular a partir do histórico de status de `RestaurantTable` e timestamps de pedido, mas não é exibido hoje.
- **Exportação em PDF**, além do CSV — mais prático para levar a um contador que não mexe em planilha.
- **Metas de venda mensais** por estabelecimento, com acompanhamento visual de progresso no painel admin.
