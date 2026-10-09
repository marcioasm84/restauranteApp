# Meu Restaurante

Plataforma multi-cliente de pedidos para restaurante — cardápio visual, pedido pelo garçom ou pelo cliente, comanda digital direto para a cozinha, pagamento com fidelidade, avaliações e um painel administrativo com relatórios. Cada cliente (restaurante/bar) cadastrado na plataforma tem seu próprio cardápio, mesas, pedidos e equipe, totalmente isolados dos demais — ver [PRD_multiclientes.md](./PRD_multiclientes.md) para o modelo multi-tenant, [PRD.md](./PRD.md) para o produto em si, e [ARQUITETURA.md](./ARQUITETURA.md) para como a aplicação funciona e por que cada tecnologia foi escolhida.

"Diferente D+" é o primeiro cliente real cadastrado na plataforma, usado como exemplo ao longo deste README.

Cliente, garçom e cozinha podem rodar em dispositivos diferentes (tablet da mesa, celular do garçom, tablet da cozinha) na mesma rede Wi-Fi e ver os pedidos, o cardápio **e a conta** sincronizados em tempo real. Os dados (mesas, pedidos, cardápio, contas fechadas, fidelidade e avaliações) ficam em **PostgreSQL**, com **Redis** cuidando da distribuição em tempo real do WebSocket — a mesma arquitetura que sobe na nuvem (ver seção 12 do PRD), só que rodando localmente via Docker.

## Rodando o projeto (Docker — recomendado)

Primeira vez:

```bash
cp .env.example .env
npm run docker:up
```

Isso sobe quatro containers: PostgreSQL, Redis, backend (aplica as migrations e semeia o cardápio automaticamente no primeiro boot) e frontend.

- **Frontend:** http://localhost:8090
- **Backend (API + WebSocket):** http://localhost:4000
- **Postgres:** localhost:5433 (porta diferente da padrão 5432, para não colidir com um Postgres já instalado na sua máquina)

Para parar: `npm run docker:down`. Para apagar também os dados (Postgres do zero): `npm run docker:reset`.

## Rodando o projeto (desenvolvimento, sem Docker para o frontend)

Útil para ter hot-reload do frontend enquanto o backend/banco rodam containerizados:

```bash
npm run docker:up -- postgres redis backend   # só a infra + API
npm install && npm run dev:client             # frontend com Vite, hot-reload
```

O frontend detecta o backend automaticamente pela URL (`window.location.hostname:4000`), então não precisa configurar nada extra.

### Sem Docker (avançado)

Se preferir instalar Postgres e Redis localmente: copie `server/.env.example` para `server/.env`, ajuste `DATABASE_URL`/`REDIS_URL`, rode `npm run install:server`, depois `npm run prisma:deploy --prefix server` para aplicar as migrations, e então `npm run dev` na raiz como antes.

## Multi-cliente: como acessar cada restaurante

Cada cliente cadastrado na plataforma tem seu próprio subdomínio — localmente, isso funciona sem nenhuma configuração extra de DNS graças a `*.localhost`, que todo navegador moderno já resolve para a própria máquina:

```
http://diferentedmais.localhost:8090   # cliente de exemplo já cadastrado
http://<slug-do-cliente>.localhost:8090
```

Acessar só `http://localhost:8090` (sem subdomínio) mostra "restaurante não encontrado" — é o endereço da plataforma em si, não de um cliente.

### Painel da plataforma (Super Admin)

Cadastra novos clientes (nome, subdomínio, logo, senha inicial de cada papel) e permite suspender/reativar o acesso de qualquer um:

```
http://localhost:8090/super-admin
usuário: superadmin
senha:   superadmin123
```

Troque via `SUPER_ADMIN_USERNAME`/`SUPER_ADMIN_PASSWORD` no `.env` da raiz antes de subir o backend.

## Usando o app (dentro de um cliente)

Acesse pelo subdomínio do cliente (ex. `diferentedmais.localhost:8090`) e escolha um dos perfis:

- **Cliente** (`/mesa/:id`) — cardápio com fotos, carrinho, customização de itens, acompanhamento do pedido com notificações in-app, fechamento de conta (Pix/cartão/carteira, com divisão e fidelidade) e avaliação pós-refeição.
- **Garçom** (`/garcom`) — mapa de mesas, lançamento de pedidos e fechamento de conta (mesmo fluxo de pagamento do cliente).
- **Cozinha** (`/cozinha`) — painel (KDS) para avançar o status dos pedidos.
- **Administração** (`/login` → `/admin`) — cadastro/edição/remoção de produtos do cardápio e relatórios (`/admin/analytics`).

### Login da equipe

Cada cliente tem suas próprias contas de admin/garçom/cozinha, criadas pelo Super Admin no cadastro (não são mais variáveis de ambiente globais). O cliente de exemplo "Diferente D+" já vem com:

```
admin:   admin   / mesaviva123
garçom:  garcom  / garcom123
cozinha: cozinha / cozinha123
```

### Pagamento, fidelidade e avaliações

- **Pagamento**: simulado (sem gateway real) — o cliente ou o garçom escolhe Pix, cartão ou carteira digital, o valor é "cobrado" na hora e a mesa é liberada.
- **Divisão de conta**: igualitária, entre o número de pessoas informado.
- **Fidelidade**: informar um celular no pagamento acumula 1 ponto por R$1 gasto; pontos acumulados podem ser usados no próximo pagamento (1 ponto = R$0,10 de desconto). O saldo persiste por número de telefone, sem precisar de cadastro/conta.
- **Avaliação**: depois de pagar (fluxo do cliente), aparece um convite para avaliar de 1 a 5 estrelas com comentário opcional.
- **Relatórios** (`/admin/analytics`): faturamento e contas fechadas do dia, ticket médio, tempo médio de preparo (recebido → pronto), avaliação média e pratos mais pedidos — calculados a partir do histórico real de contas fechadas.

### Testando em vários dispositivos (tablet, celular)

Com os containers rodando, descubra o IP da sua máquina na Wi-Fi e acesse, em qualquer tablet/celular **na mesma rede**:

```
http://<seu-ip-local>:8090
```

Cada dispositivo pode abrir um perfil diferente e tudo fica sincronizado em tempo real.

## Stack

- **Frontend**: React + TypeScript + Vite, Tailwind CSS v4, React Router, Zustand (sincronizado com o backend via WebSocket). Build estático servido por Nginx no container. Tema único, escuro, inspirado em pizzaria (verde-manjericão + vermelho-tomate).
- **Backend**: Node.js + Express + WebSocket (`ws`), em `server/`. Login com **JWT** assinado (sem estado em memória — funciona igual com uma ou várias instâncias do backend rodando).
- **Banco de dados**: **PostgreSQL** via **Prisma** (schema em `server/prisma/schema.prisma`, migrations em `server/prisma/migrations/`).
- **Tempo real entre instâncias**: **Redis Pub/Sub** — toda mudança de estado é publicada num canal Redis; cada instância do backend se inscreve nesse canal e retransmite para os WebSockets conectados nela. Com um só container isso é transparente; com várias instâncias (ex.: várias tasks do ECS na AWS), é o que garante que uma mudança feita numa instância chegue aos clientes conectados em outra.

## Como funciona a sincronização

Cada cliente (navegador) abre uma conexão WebSocket com o backend (`ws://<host>:4000/ws`). Ao conectar, recebe o estado atual (mesas, pedidos e cardápio). Toda ação (pedir, chamar garçom, avançar status na cozinha, fechar conta e pagar, avaliar, ou — logado como admin — criar/editar/excluir um produto) é enviada ao servidor, que grava no Postgres e publica a mudança no Redis — de onde é retransmitida para **todos** os clientes conectados, em qualquer instância do backend. O cliente também recebe notificações in-app (toasts) quando o próprio pedido muda de status.

Ações de administração do cardápio, e a leitura dos relatórios, exigem um JWT válido, verificado pelo servidor a cada mensagem/requisição — mesmo que alguém edite o frontend, o servidor recusa sem um login válido.

Se o backend cair ou a rede cair, aparece um aviso no topo do app ("Sem conexão com o servidor") e ele tenta reconectar automaticamente; pedidos não são enviados enquanto estiver desconectado (para não perder o carrinho do cliente sem avisar).

## Estrutura

```
src/                          frontend
  components/                 UI reutilizável (Logo, CategorySidebar, PaymentModal, BillReceiptModal, ReviewModal, ToastHost...)
  data/                       cardápio inicial (fallback antes do servidor responder)
  pages/                      cliente, garçom, cozinha, login e admin
  pages/admin/                lista de produtos, formulário e relatórios (analytics)
  store/                      useRestaurantStore (mesas/pedidos), useMenuStore (cardápio),
                              useBillingStore (pagamento/fidelidade/avaliação), useToastStore
  lib/socket.ts               cliente WebSocket (conexão, reconexão, mensagens)
  lib/auth.ts, lib/api.ts     token de sessão + chamadas REST (login, analytics)
  types.ts                    tipos compartilhados

server/                       backend
  prisma/schema.prisma        modelo de dados (mesas, pedidos, cardápio, contas, fidelidade, avaliações)
  prisma/migrations/          histórico de migrations do banco
  src/index.ts                servidor HTTP + WebSocket + rotas REST (login, analytics)
  src/db.ts                   cliente Prisma compartilhado
  src/redis.ts                publish/subscribe para distribuir o estado entre instâncias
  src/store.ts                mesas e pedidos (Prisma)
  src/menuStore.ts            cardápio — CRUD (Prisma)
  src/billingStore.ts         contas fechadas / histórico (Prisma)
  src/loyaltyStore.ts         saldo de pontos por telefone (Prisma)
  src/reviewStore.ts          avaliações (Prisma)
  src/analytics.ts            cálculo dos KPIs a partir do histórico de contas
  src/auth.ts                 login e verificação de JWT
  src/seedMenu.ts             catálogo padrão, usado só se o banco estiver vazio no primeiro boot
  Dockerfile                  imagem do backend (aplica migrations ao iniciar)

Dockerfile                    imagem do frontend (build Vite + Nginx)
docker-compose.yml            orquestra frontend, backend, Postgres e Redis
nginx.conf                    config do Nginx (SPA fallback para o react-router)
```

## Scripts úteis

| Comando | O que faz |
|---|---|
| `npm run docker:up` | Sobe tudo via Docker (Postgres, Redis, backend, frontend) |
| `npm run docker:down` | Para os containers (mantém os dados) |
| `npm run docker:reset` | Para os containers **e apaga** o volume do Postgres |
| `npm run dev` | Modo antigo: frontend (5173) + backend (4000) direto no host, sem Docker |
| `npm run dev:client` | Só o frontend |
| `npm run build` | Build de produção do frontend |

## Próximos passos

Ver a seção de roadmap do [PRD.md](./PRD.md). A Fase 5 (implantação em produção na AWS) já tem a infraestrutura como código pronta em [infra/](./infra) — passo a passo completo, custo estimado e credenciais geradas em [AWS_DEPLOYMENT.md](./AWS_DEPLOYMENT.md). As Fases 6 e 7 (plataforma multi-cliente e cobrança SaaS) estão planejadas em [PRD_multiclientes.md](./PRD_multiclientes.md). A Fase 3 (recomendações personalizadas, harmonização/combos, multi-idioma, fila de espera/reservas, acessibilidade completa) e um gateway de pagamento real continuam no roadmap de produto.
