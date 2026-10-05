# PRD — Aplicativo de Pedidos para Restaurante

**Versão:** 1.0
**Data:** 29/09/2026
**Status:** Rascunho para validação

---

## 1. Visão Geral

### 1.1 Problema
O processo tradicional de atendimento em restaurantes depende inteiramente do garçom para apresentar o cardápio, anotar pedidos à mão e levá-los até a cozinha. Isso gera:
- Erros de pedido (letra ilegível, item errado, esquecimento de observações);
- Demora no atendimento em horários de pico, já que cada mesa exige atenção presencial do garçom;
- Pouca informação visual sobre os pratos — o cliente decide "no escuro", sem ver o prato antes de pedir;
- Dificuldade em medir dados do negócio (o que vende mais, tempo de preparo, ticket médio) sem um sistema digital.

### 1.2 Visão de Produto
Criar um aplicativo de pedidos digital para um restaurante, com um cardápio visual e apetitoso (fotos em destaque, descrições completas), que pode ser operado tanto pelo **garçom** (lançando pedidos rapidamente pelo seu dispositivo) quanto pelo **próprio cliente** (pedindo de forma autônoma pelo tablet da mesa). O pedido vai direto para um painel digital da cozinha (KDS), eliminando papel, reduzindo erros e acelerando o ciclo pedido → preparo → entrega.

### 1.3 Objetivos do Produto
- Reduzir o tempo médio entre o cliente sentar e o pedido ser confirmado na cozinha.
- Reduzir a taxa de erros de pedido a praticamente zero (pedido digital, sem transcrição manual).
- Aumentar o ticket médio por meio de fotos atrativas, upsell e recomendações.
- Melhorar a experiência do cliente com autonomia, transparência de status e agilidade.
- Gerar dados de negócio (pratos mais vendidos, horários de pico, tempo de preparo) para decisões do gerente.

---

## 2. Personas

| Persona | Descrição | Necessidade principal |
|---|---|---|
| **Cliente na mesa** | Pessoa sentada à mesa, com ou sem experiência em apps | Ver o cardápio de forma atraente, pedir sem esperar o garçom, saber o status do pedido |
| **Garçom** | Atende múltiplas mesas simultaneamente | Lançar pedidos rápido, ver o status de todas as mesas, fechar contas sem erro |
| **Cozinha (KDS)** | Chef/equipe de cozinha preparando os pratos | Ver pedidos assim que chegam, priorizar por ordem/tempo, marcar como pronto |
| **Gerente/Admin** | Dono ou gerente do restaurante | Gerenciar cardápio, preços, mesas, ver relatórios e métricas do negócio |

---

## 3. Fluxos Principais

### 3.1 Fluxo do Cliente (tablet da mesa)
1. Cliente senta à mesa e ativa o tablet (ou abre o app já vinculado à mesa).
2. Navega pelo cardápio digital por categorias (Entradas, Pratos Principais, Bebidas, Sobremesas etc.), com fotos e filtros (vegetariano, sem glúten, picante).
3. Toca em um item para ver detalhes: foto ampliada, ingredientes, alérgenos, opções de customização (ponto da carne, remover ingrediente, observações).
4. Adiciona ao carrinho; pode ver o carrinho a qualquer momento com subtotal.
5. Confirma o pedido → pedido é enviado automaticamente para a cozinha (KDS) e para o app do garçom responsável pela mesa.
6. Acompanha o status do pedido em tempo real: **Recebido → Em preparo → Pronto → Entregue**.
7. Pode chamar o garçom ou pedir a conta com um toque, a qualquer momento.
8. Ao final, revisa a conta (com opção de dividir) e fecha o pagamento.

### 3.2 Fluxo do Garçom (app mobile)
1. Garçom faz login e vê o mapa de mesas do salão (livre, ocupada, aguardando pedido, aguardando conta).
2. Abre uma mesa para lançar itens em nome do cliente (quando o cliente prefere pedir por ele) ou apenas acompanha pedidos feitos pelo próprio cliente no tablet.
3. Envia pedido para a cozinha com um toque.
4. Recebe notificação quando um prato fica pronto, para levá-lo à mesa.
5. Gerencia fechamento de conta, incluindo divisão entre pessoas e aplicação de descontos/cupons quando autorizado.

### 3.3 Fluxo da Cozinha (KDS)
1. Pedido aparece automaticamente na tela da cozinha, organizado por mesa e ordem de chegada.
2. Equipe marca cada item como "Em preparo" e depois "Pronto".
3. Sistema notifica automaticamente o cliente (tablet) e o garçom quando o prato está pronto.

### 3.4 Fluxo do Gerente (painel administrativo)
1. Cadastra e edita itens do cardápio (nome, descrição, preço, foto, categoria, alérgenos, disponibilidade).
2. Gerencia mesas, garçons e permissões de acesso.
3. Acompanha relatórios: vendas do dia, pratos mais pedidos, tempo médio de preparo, ticket médio, avaliações dos clientes.

---

## 4. Funcionalidades — MVP (Fase 1)

Essenciais para o primeiro lançamento:

1. **Cardápio digital visual** — fotos em alta qualidade, categorias, descrição, preço, badges (vegetariano, picante, mais pedido).
2. **Filtros e busca** — por categoria, restrição alimentar, faixa de preço.
3. **Carrinho de compras** — adicionar/remover itens, ajustar quantidade, customizações e observações por item.
4. **Envio do pedido para a cozinha (KDS)** — em tempo real, sem papel.
5. **Status do pedido em tempo real** — visível para cliente e garçom (Recebido, Em preparo, Pronto, Entregue).
6. **App do garçom** — mapa de mesas, lançamento de pedido, fechamento de conta.
7. **Botões de ação rápida** — "Chamar garçom" e "Pedir a conta".
8. **Painel administrativo básico** — CRUD de itens do cardápio, mesas e usuários (garçons).

---

## 5. Funcionalidades Avançadas (Fase 2+) — Diferenciais de Experiência

Sugestões para elevar a experiência além do básico:

- **Recomendações inteligentes / upsell** — ex.: "Que tal uma sobremesa para acompanhar?" baseado no que já está no carrinho.
- **Divisão de conta entre pessoas da mesa** — por item consumido ou split igualitário.
- **Pagamento integrado no app** — Pix, cartão e carteiras digitais, sem precisar de maquininha física.
- **Programa de fidelidade** — pontos por pedido, cupons de desconto, cashback.
- **Avaliação pós-refeição** — nota rápida por prato e comentário, alimentando o painel do gerente.
- **Cardápio multi-idioma** — importante para restaurantes com público turista.
- **Notificações push** — pedido confirmado, prato saindo da cozinha, tempo estimado de espera.
- **Harmonização e combos sugeridos** — ex.: vinho recomendado para o prato escolhido, combo com desconto.
- **Modo acessibilidade** — alto contraste, fonte ampliada, leitura em voz alta do cardápio (ideal para idosos e pessoas com deficiência visual).
- **Fila de espera / reserva de mesa** — antes mesmo do cliente chegar ao restaurante.
- **Modo "repetir pedido"** — para clientes recorrentes, um toque para pedir o de sempre.
- **Chat/aviso direto com a cozinha** via garçom para pedidos especiais fora do padrão.

---

## 6. Requisitos Não Funcionais

- **Performance:** carregamento do cardápio com imagens otimizadas em menos de 2s em conexão de restaurante padrão.
- **Tempo real:** comunicação via WebSockets (ou equivalente) entre cliente, garçom e cozinha, com atualização de status em menos de 1s.
- **Responsividade:** interface adaptada para tablet (cliente/mesa), celular (garçom) e tela grande (KDS da cozinha).
- **Disponibilidade:** sistema deve funcionar durante todo o horário de operação do restaurante, com tolerância mínima a falhas (idealmente 99,5%+) — viabilizado em produção pelo banco de dados Multi-AZ e múltiplas instâncias do backend descritos na seção 12.
- **Modo offline básico:** app do garçom deve permitir lançar pedidos mesmo com instabilidade momentânea de rede, sincronizando assim que a conexão voltar.
- **Segurança:** dados de pagamento tratados via gateway certificado (PCI-DSS), nunca armazenados diretamente pelo app.
- **Multiusuário simultâneo:** suporte a múltiplas mesas e garçons operando ao mesmo tempo sem conflito de dados — em produção, múltiplas instâncias do backend atrás de um load balancer (seção 12), sincronizadas via Redis.

---

## 7. Sugestão de Arquitetura Técnica (alto nível)

> Indicativo, para orientar decisões futuras de implementação — não é uma decisão final.

- **App do cliente (tablet):** Web App / PWA responsiva (acesso via navegador do tablet, sem necessidade de instalação) ou app nativo, conforme decisão de hardware do restaurante.
- **App do garçom:** aplicativo mobile (React Native ou Flutter) para uso em celular/tablet próprio da equipe.
- **Painel da cozinha (KDS):** interface web otimizada para tela grande/tablet fixo na cozinha.
- **Painel administrativo:** aplicação web (dashboard) para o gerente.
- **Backend:** API REST/GraphQL (Node.js ou similar) + camada de tempo real via WebSockets para status de pedidos.
- **Banco de dados:** relacional (PostgreSQL) para cardápio, pedidos e usuários.
- **Armazenamento de imagens:** serviço de storage com CDN para carregamento rápido das fotos dos pratos.

> Ver seção 12 para o plano concreto de evolução desta arquitetura indicativa para um ambiente real (banco de dados, containers e nuvem).

---

## 8. Diretrizes de Design/UX

- **Visual centrado em fotografia:** cada item do cardápio com foto profissional em destaque — o prato é o protagonista da tela.
- **Cards de produto:** foto grande, nome, preço e badges (novo, mais pedido, picante) visíveis sem precisar tocar.
- **Paleta e tipografia:** tons quentes e apetitosos (ex.: tons terrosos, vermelho/laranja para destaque de preço/CTA), tipografia legível à distância de uma mesa.
- **Feedback visual de status:** barra de progresso ou timeline clara mostrando Recebido → Em preparo → Pronto → Entregue.
- **Carrinho sempre acessível:** botão flutuante com contador de itens e valor total.
- **Poucos toques até o pedido:** fluxo enxuto — ver prato, customizar, adicionar, confirmar.

---

## 9. Métricas de Sucesso (KPIs)

- Tempo médio entre o cliente sentar e o primeiro pedido confirmado.
- Tempo médio entre pedido confirmado e prato entregue.
- Taxa de erro de pedido (meta: próxima de zero).
- Ticket médio por mesa (antes vs. depois do app).
- NPS / satisfação do cliente (via avaliação pós-refeição).
- Taxa de adoção do pedido autônomo pelo cliente vs. via garçom.

---

## 10. Roadmap em Fases

**Fase 1 — MVP** ✅ Implementada
Cardápio digital, carrinho, envio para cozinha, status em tempo real, app do garçom, painel admin básico, login.

**Fase 2 — Monetização e Fidelização** ✅ Implementada
Pagamento (simulado — Pix/cartão/carteira, sem gateway real), divisão de conta (igualitária), programa de fidelidade (pontos por telefone), avaliação pós-refeição, notificações in-app (toasts em tempo real), analytics no painel do gerente (faturamento, ticket médio, tempo de preparo, avaliação média, pratos mais pedidos).

**Fase 3 — Inteligência e Expansão**
Recomendações personalizadas (IA), harmonização/combos, multi-idioma, fila de espera/reservas, modo acessibilidade completo.

**Fase 4 — Containerização e Ambiente Local** ✅ Implementada
Docker (backend + frontend), `docker-compose` com PostgreSQL e Redis, migração da persistência de arquivos JSON para banco de dados real. Ver seção 12.

**Fase 5 — Implantação em Produção (AWS)** ✅ Infraestrutura como código pronta — falta rodar o deploy
ECS Fargate, RDS for PostgreSQL, ElastiCache for Redis, S3 + CloudFront, CI/CD via GitHub Actions, infraestrutura como código via AWS CDK (`infra/`). A implantação em si (criar os recursos reais na AWS) é um passo manual, deliberadamente fora do que a automação faz sozinha — ver [AWS_DEPLOYMENT.md](./AWS_DEPLOYMENT.md) para o passo a passo completo, incluindo custo estimado e credenciais geradas.

> As fases 4 e 5 são de infraestrutura, não de produto — não dependem da Fase 3 e podem ser priorizadas em paralelo ou antes dela.

**Fase 6 — Multi-tenancy** e **Fase 7 — SaaS (Cobrança e Liberação de Acesso)**
Transformam o produto de single-tenant em plataforma multi-cliente, com área de Super Admin e cobrança recorrente por mensalidade. Documentadas em detalhe em [PRD_multiclientes.md](./PRD_multiclientes.md), já que mudam decisões estruturais do PRD original (seção 11). Pré-requisito: Fases 4 e 5.

---

## 11. Riscos e Fora de Escopo

**Riscos:**
- Resistência de clientes menos familiarizados com tecnologia → mitigar mantendo sempre a opção de pedir via garçom.
- Dependência de conectividade Wi-Fi estável no restaurante.
- Custo de hardware (tablets) para mesas, se optado por dispositivos dedicados.

**Fora de escopo (nesta versão):**
- ~~Suporte a múltiplos restaurantes/franquias (modelo SaaS) — produto é sob medida para um único estabelecimento.~~ Decisão revertida — ver [PRD_multiclientes.md](./PRD_multiclientes.md) (Fases 6 e 7).
- Delivery/pedido para retirada fora do restaurante.
- Integração com sistemas de estoque/compras.

---

## 12. Arquitetura de Implantação

O protótipo atual (Fases 1 e 2) roda em modo demonstração: backend Node/Express/WebSocket persistindo em arquivos JSON soltos em disco, sem containers e sem caminho para produção. Esta seção descreve como evoluir isso para um ambiente real, em duas etapas (Fases 4 e 5 do roadmap).

### 12.1 Banco de dados e armazenamento

- **PostgreSQL** como banco relacional principal, via **Prisma** (ORM TypeScript-first, com migrations versionadas — combina com o backend atual em TypeScript). Substitui os cinco arquivos JSON de hoje (cardápio, mesas/pedidos, contas fechadas, fidelidade, avaliações) por tabelas relacionais equivalentes: `tables`, `orders`, `order_lines`, `menu_items`, `bills`, `bill_lines`, `loyalty_accounts`, `reviews`.
- **Redis** para duas limitações conhecidas do protótipo atual, que só aparecem ao rodar mais de uma instância do backend:
  - **Fan-out do WebSocket:** hoje o broadcast de estado (`wss.clients`) só alcança conexões do próprio processo. Com múltiplas instâncias atrás de um load balancer, é preciso um canal compartilhado (Redis Pub/Sub) para que uma mudança feita numa instância chegue a clientes conectados em outra.
  - **Sessão do admin:** hoje é um `Set` de tokens em memória, que não sobrevive a um restart nem é visível entre instâncias. Solução mais simples (sem precisar de Redis só para isso): migrar para **JWT assinado** (stateless); Redis só entra se quiser suportar revogação de sessão.

### 12.2 Containerização (Docker)

- **Dockerfile do backend** — Node 20, build do TypeScript, expõe a API HTTP + WebSocket.
- **Dockerfile do frontend** — build do Vite, servido como estático (Nginx em ambiente local; S3 + CloudFront em produção, ver 12.4).
- **`docker-compose.yml`** unindo frontend, backend, PostgreSQL e Redis num único comando, com seed automático do cardápio inicial — a mesma composição serve de base conceitual para os manifests de produção.

### 12.3 Fase 4 — Containerização e Ambiente Local

**Objetivo:** rodar a stack inteira via Docker, simulando a topologia de produção, sem depender do `npm run dev` para validar o comportamento "real".

**Entregas:**
- Dockerfiles do backend e do frontend.
- `docker-compose.yml` (Postgres + Redis + backend + frontend).
- Migração dos stores atuais (`menuStore.ts`, `store.ts`, `billingStore.ts`, `loyaltyStore.ts`, `reviewStore.ts`) de arquivo JSON para Prisma/PostgreSQL, preservando a mesma API pública usada pelo WebSocket.
- Variáveis de ambiente centralizadas em `.env`, documentadas no README.
- Resultado: `docker compose up` sobe o ambiente completo com um comando, pronto para testes de integração antes de ir para a nuvem.

### 12.4 Fase 5 — Implantação em Produção (AWS)

**Objetivo:** hospedar a aplicação em produção na AWS, com serviços gerenciados equivalentes a cada peça da stack.

**Status:** infraestrutura como código implementada em `infra/` (AWS CDK) e pipeline em `.github/workflows/deploy.yml`. Passo a passo completo de implantação, estimativa de custo e credenciais geradas em [AWS_DEPLOYMENT.md](./AWS_DEPLOYMENT.md). Dois ajustes em relação à tabela original: RDS fica Single-AZ (não Multi-AZ) e sem Aurora por enquanto — adequado ao volume de um único restaurante, upgrade possível sem mudar a aplicação; DNS + ACM (linha abaixo) ficou opcional — por padrão tanto o frontend quanto o backend já saem com HTTPS válido via domínios `*.cloudfront.net`, sem precisar comprar domínio algum.

| Componente | Serviço AWS | Por quê |
|---|---|---|
| Frontend (build estático) | S3 + CloudFront | Hospedagem barata e CDN global para a SPA |
| Backend (API + WebSocket) | ECS Fargate + Application Load Balancer | Containers gerenciados sem administrar servidor/cluster; ALB suporta WebSocket |
| Banco de dados | RDS for PostgreSQL (Aurora PostgreSQL se precisar escalar) | Gerenciado, backups automáticos, Multi-AZ |
| Cache / Pub-Sub | ElastiCache for Redis | Fan-out do WebSocket entre as tasks do ECS |
| Imagens do cardápio | S3 (upload) + CloudFront | Evolui do campo "URL da imagem" atual para upload de verdade |
| Registro de containers | Amazon ECR | Guarda as imagens Docker geradas no CI/CD |
| Segredos e configuração | AWS Secrets Manager / SSM Parameter Store | Credenciais do banco, JWT secret, senha do admin — nunca em `.env` versionado |
| DNS + TLS | Route 53 + ACM | Domínio próprio e HTTPS |
| Observabilidade | CloudWatch (logs, métricas, alarmes) | Monitorar erros e disponibilidade |
| Infraestrutura como código | AWS CDK (TypeScript) | Mesma linguagem do projeto, infra versionada junto com o código |
| CI/CD | GitHub Actions → build da imagem → push no ECR → deploy no ECS | Pipeline automático a cada merge |

**Por que ECS Fargate em vez de Kubernetes (EKS):** para uma aplicação de um único restaurante (sem modelo multi-tenant — ver seção 11), ECS Fargate entrega o mesmo benefício de containers gerenciados com bem menos complexidade operacional que administrar um cluster Kubernetes. EKS fica como alternativa válida apenas se o produto evoluir para atender múltiplos restaurantes/clientes no futuro, ou se a equipe já tiver ferramental Kubernetes consolidado em outros projetos.

### 12.5 Segurança

- Autenticação por **perfil** (admin, garçom, cozinha), migrada de token em memória para JWT assinado — ver seção 13 para os acessos de cada perfil.
- HTTPS obrigatório de ponta a ponta (ACM no CloudFront/ALB).
- Segredos (credenciais de banco, JWT secret, senhas de cada perfil) fora do código-fonte, geridos pelo Secrets Manager/SSM.

---

## 13. Acessos e Credenciais (Demonstração)

Garçom, cozinha e administração exigem login (usuário/senha) para entrar. O cliente **nunca loga**: por padrão só vê o cardápio (`/cardapio`); para fazer pedidos numa mesa, um garçom (ou o administrador) precisa "liberar" aquela mesa informando sua própria senha no aparelho do cliente — e isso precisa ser repetido toda vez que o aparelho mudar de mesa (ver seção 3.1 e 5).

Cada perfil só acessa sua própria área — **exceto o administrador, que acessa tudo** (inclusive garçom e cozinha, e pode liberar mesas no lugar de um garçom).

| Perfil | Acessa | Usuário (demo) | Senha (demo) | Variáveis de ambiente |
|---|---|---|---|---|
| Administrador | `/admin` (cardápio, relatórios) + garçom + cozinha + liberar mesas | `admin` | `mesaviva123` | `ADMIN_USERNAME` / `ADMIN_PASSWORD` |
| Garçom | `/garcom` (mapa de mesas, lançar pedidos, fechar conta) + liberar mesas para o cliente | `garcom` | `garcom123` | `WAITER_USERNAME` / `WAITER_PASSWORD` |
| Cozinha | `/cozinha` (painel de pedidos — KDS) | `cozinha` | `cozinha123` | `KITCHEN_USERNAME` / `KITCHEN_PASSWORD` |

As senhas de demonstração ficam nos `.env.example` do projeto; em produção, cada uma é sobrescrita via variável de ambiente (Secrets Manager/SSM na AWS, ver 12.4) e nunca versionada em texto puro.
