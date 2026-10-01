import { createServer } from 'node:http'
import express from 'express'
import cors from 'cors'
import { WebSocketServer, type WebSocket } from 'ws'
import { isValidToken, login } from './auth.ts'
import { getAnalyticsSummary } from './analytics.ts'
import { createBill, getBill } from './billingStore.ts'
import { getAccount, settleBill } from './loyaltyStore.ts'
import { addReview } from './reviewStore.ts'
import {
  createMenuItem,
  deleteMenuItem,
  ensureMenuSeeded,
  getMenu,
  updateMenuItem,
} from './menuStore.ts'
import { onBroadcast, publishBroadcast } from './redis.ts'
import {
  acknowledgeCall,
  callWaiter,
  closeTable,
  ensureTablesSeeded,
  getOrdersForTable,
  getState,
  placeOrder,
  requestBill,
  setOrderStatus,
} from './store.ts'
import type { ClientMessage, ServerMessage } from './types.ts'

const PORT = Number(process.env.PORT ?? 4000)

const app = express()
app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/state', async (_req, res) => {
  res.json(await getState())
})

app.post('/api/login', (req, res) => {
  const { username, password } = req.body ?? {}
  if (typeof username !== 'string' || typeof password !== 'string') {
    res.status(400).json({ message: 'Usuário e senha são obrigatórios' })
    return
  }
  const token = login(username, password)
  if (!token) {
    res.status(401).json({ message: 'Usuário ou senha inválidos' })
    return
  }
  res.json({ token })
})

app.get('/api/analytics', async (req, res) => {
  const auth = req.header('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : undefined
  if (!isValidToken(token)) {
    res.status(401).json({ message: 'Não autorizado' })
    return
  }
  res.json(await getAnalyticsSummary())
})

const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

function send(ws: WebSocket, message: ServerMessage) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message))
}

// Every broadcast goes out through Redis instead of straight to `wss.clients`:
// that's what lets a change made on one backend instance reach clients
// connected to a *different* instance once this runs as more than one
// container (see onBroadcast below, which is what actually delivers to this
// instance's own sockets — including the one that published the message).
function broadcast(message: ServerMessage) {
  publishBroadcast(message)
}

onBroadcast((message) => {
  const payload = JSON.stringify(message)
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) client.send(payload)
  }
})

async function broadcastState() {
  const { tables, orders } = await getState()
  broadcast({ type: 'state', tables, orders })
}

async function broadcastMenu() {
  broadcast({ type: 'menu', items: await getMenu() })
}

wss.on('connection', async (ws) => {
  const { tables, orders } = await getState()
  send(ws, { type: 'state', tables, orders })
  send(ws, { type: 'menu', items: await getMenu() })

  ws.on('message', async (raw) => {
    let msg: ClientMessage
    try {
      msg = JSON.parse(raw.toString())
    } catch {
      send(ws, { type: 'error', message: 'Mensagem inválida' })
      return
    }

    try {
      switch (msg.type) {
        case 'placeOrder':
          await placeOrder(msg.tableId, msg.lines)
          await broadcastState()
          break
        case 'setOrderStatus':
          await setOrderStatus(msg.orderId, msg.status)
          await broadcastState()
          break
        case 'callWaiter':
          await callWaiter(msg.tableId)
          await broadcastState()
          break
        case 'acknowledgeCall':
          await acknowledgeCall(msg.tableId)
          await broadcastState()
          break
        case 'requestBill':
          await requestBill(msg.tableId)
          await broadcastState()
          break
        case 'closeTable':
          await closeTable(msg.tableId)
          await broadcastState()
          break
        case 'createMenuItem':
          if (!isValidToken(msg.token)) {
            send(ws, { type: 'error', message: 'Não autorizado' })
            return
          }
          await createMenuItem(msg.item)
          await broadcastMenu()
          break
        case 'updateMenuItem':
          if (!isValidToken(msg.token)) {
            send(ws, { type: 'error', message: 'Não autorizado' })
            return
          }
          await updateMenuItem(msg.id, msg.item)
          await broadcastMenu()
          break
        case 'deleteMenuItem':
          if (!isValidToken(msg.token)) {
            send(ws, { type: 'error', message: 'Não autorizado' })
            return
          }
          await deleteMenuItem(msg.id)
          await broadcastMenu()
          break
        case 'payBill': {
          const { tables } = await getState()
          const table = tables.find((t) => t.id === msg.tableId)
          if (!table) {
            send(ws, { type: 'error', message: 'Mesa não encontrada' })
            return
          }
          const tableOrders = await getOrdersForTable(msg.tableId)
          if (tableOrders.length === 0) {
            send(ws, { type: 'error', message: 'Não há pedidos para fechar nesta mesa' })
            return
          }
          const subtotal = tableOrders.reduce(
            (sum, o) => sum + o.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0),
            0,
          )
          const settlement = await settleBill(msg.customerPhone, subtotal, !!msg.redeemPoints)
          const bill = await createBill({
            tableId: msg.tableId,
            tableNumber: table.number,
            orders: tableOrders,
            paymentMethod: msg.paymentMethod,
            splitCount: msg.splitCount,
            customerPhone: msg.customerPhone,
            loyaltyDiscount: settlement.discount,
            pointsEarned: settlement.pointsEarned,
            pointsRedeemed: settlement.pointsRedeemed,
          })
          await closeTable(msg.tableId)
          await broadcastState()
          send(ws, { type: 'bill', bill, loyaltyPoints: settlement.account?.points ?? 0 })
          break
        }
        case 'submitReview': {
          const bill = await getBill(msg.billId)
          if (!bill) {
            send(ws, { type: 'error', message: 'Conta não encontrada para avaliação' })
            return
          }
          await addReview({
            billId: msg.billId,
            tableNumber: bill.tableNumber,
            rating: msg.rating,
            comment: msg.comment,
          })
          send(ws, { type: 'reviewAck' })
          break
        }
        case 'lookupLoyalty': {
          const account = await getAccount(msg.phone)
          send(ws, { type: 'loyalty', phone: account.phone, points: account.points })
          break
        }
        default:
          send(ws, { type: 'error', message: 'Ação desconhecida' })
      }
    } catch (err) {
      send(ws, { type: 'error', message: err instanceof Error ? err.message : 'Erro interno' })
    }
  })
})

async function main() {
  await ensureTablesSeeded()
  await ensureMenuSeeded()

  server.listen(PORT, () => {
    console.log(`Mesa Viva API + WebSocket rodando em http://localhost:${PORT}`)
  })
}

main().catch((err) => {
  console.error('Falha ao iniciar o servidor:', err)
  process.exit(1)
})
