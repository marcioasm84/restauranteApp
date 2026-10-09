import { createServer } from 'node:http'
import express from 'express'
import cors from 'cors'
import { WebSocketServer, type WebSocket } from 'ws'
import { getStaffIdentity, hasRole, isSuperAdmin, login, superAdminLogin } from './auth.ts'
import { buildAnalyticsCsv, getAnalyticsSummary } from './analytics.ts'
import { createBill, getBill } from './billingStore.ts'
import { getAccount, settleBill } from './loyaltyStore.ts'
import { addReview } from './reviewStore.ts'
import { createMenuItem, deleteMenuItem, getMenu, updateMenuItem } from './menuStore.ts'
import { onBroadcast, publishBroadcast } from './redis.ts'
import {
  createStaffMember,
  createTenant,
  getTenantById,
  listPublicTenants,
  listStaffUsers,
  listTenants,
  removeStaffMember,
  resetStaffPasswords,
  setStaffMemberPassword,
  updateStaffMember,
  updateTenant,
} from './tenantStore.ts'
import { getTenantBySlug, resolveTenantSlug, tenantMiddleware } from './tenant.ts'
import { sendWelcomeEmail } from './email.ts'
import { UPLOAD_ROOT, uploadLogo } from './uploads.ts'
import { geocodeAddress } from './geocode.ts'
import {
  acknowledgeCall,
  callWaiter,
  closeTable,
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
app.use('/api/uploads', express.static(UPLOAD_ROOT))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

// Public: lets the frontend render the right name/logo before anything
// else loads, based purely on which subdomain it was opened from.
app.get('/api/tenant', tenantMiddleware, (req, res) => {
  const t = req.tenant!
  res.json({ name: t.name, slug: t.slug, logoUrl: t.logoUrl, primaryColor: t.primaryColor, accentColor: t.accentColor })
})

// Public: the "choose a restaurant" directory shown when the above fails
// to resolve a tenant (bare platform domain, or a typo'd subdomain).
app.get('/api/tenants', async (_req, res) => {
  res.json(await listPublicTenants())
})

app.post('/api/login', tenantMiddleware, async (req, res) => {
  const { username, password } = req.body ?? {}
  if (typeof username !== 'string' || typeof password !== 'string') {
    res.status(400).json({ message: 'Usuário e senha são obrigatórios' })
    return
  }
  const result = await login(req.tenant!.id, username, password)
  if (!result) {
    res.status(401).json({ message: 'Usuário ou senha inválidos' })
    return
  }
  res.json(result)
})

app.get('/api/state', tenantMiddleware, async (req, res) => {
  res.json(await getState(req.tenant!.id))
})

// Default range is "hoje" (local midnight to now), matching the behavior
// before the Fase 8 period selector existed — /api/analytics?from=&to=
// (epoch ms) overrides it.
function startOfTodayMs(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function parseRange(req: express.Request): { from: number; to: number } {
  const fromParam = req.query.from
  const toParam = req.query.to
  const from = typeof fromParam === 'string' && fromParam ? Number(fromParam) : startOfTodayMs()
  const to = typeof toParam === 'string' && toParam ? Number(toParam) : Date.now()
  return { from, to }
}

app.get('/api/analytics', tenantMiddleware, async (req, res) => {
  const auth = req.header('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : undefined
  if (!hasRole(token, req.tenant!.id, ['admin'])) {
    res.status(401).json({ message: 'Não autorizado' })
    return
  }
  const { from, to } = parseRange(req)
  res.json(await getAnalyticsSummary(req.tenant!.id, from, to))
})

app.get('/api/analytics/export', tenantMiddleware, async (req, res) => {
  const auth = req.header('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : undefined
  if (!hasRole(token, req.tenant!.id, ['admin'])) {
    res.status(401).json({ message: 'Não autorizado' })
    return
  }
  const { from, to } = parseRange(req)
  const csv = await buildAnalyticsCsv(req.tenant!.id, from, to)
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="relatorio-${req.tenant!.slug}-${new Date(from).toISOString().slice(0, 10)}-a-${new Date(to).toISOString().slice(0, 10)}.csv"`,
  )
  res.send('﻿' + csv) // BOM na frente: Excel abre acentuação em UTF-8 corretamente
})

// --- Equipe (contas individuais de garçom/cozinha, Fase 8) -----------------
// Tenant-scoped, gerido pelo próprio admin do restaurante — distinto do
// Super Admin (plataforma) abaixo.

function requireTenantAdmin(req: express.Request, res: express.Response, tenantId: string): boolean {
  const auth = req.header('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : undefined
  if (!hasRole(token, tenantId, ['admin'])) {
    res.status(401).json({ message: 'Não autorizado' })
    return false
  }
  return true
}

app.get('/api/staff', tenantMiddleware, async (req, res) => {
  if (!requireTenantAdmin(req, res, req.tenant!.id)) return
  res.json(await listStaffUsers(req.tenant!.id))
})

app.post('/api/staff', tenantMiddleware, async (req, res) => {
  if (!requireTenantAdmin(req, res, req.tenant!.id)) return
  const { username, displayName, role, password } = req.body ?? {}
  if (
    typeof username !== 'string' ||
    !username.trim() ||
    typeof displayName !== 'string' ||
    !displayName.trim() ||
    typeof password !== 'string' ||
    !password ||
    !['admin', 'garcom', 'cozinha'].includes(role)
  ) {
    res.status(400).json({ message: 'Nome, usuário, papel e senha são obrigatórios' })
    return
  }
  try {
    const member = await createStaffMember(req.tenant!.id, {
      username: username.trim(),
      displayName: displayName.trim(),
      role,
      password,
    })
    res.status(201).json(member)
  } catch (err) {
    const message =
      err instanceof Error && err.message.includes('Unique constraint')
        ? 'Já existe uma conta com esse usuário'
        : err instanceof Error
          ? err.message
          : 'Não foi possível criar a conta'
    res.status(400).json({ message })
  }
})

app.patch('/api/staff/:id', tenantMiddleware, async (req, res) => {
  if (!requireTenantAdmin(req, res, req.tenant!.id)) return
  const { displayName, role, active } = req.body ?? {}
  try {
    const member = await updateStaffMember(req.tenant!.id, req.params.id, {
      ...(displayName !== undefined ? { displayName } : {}),
      ...(role !== undefined ? { role } : {}),
      ...(active !== undefined ? { active } : {}),
    })
    res.json(member)
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : 'Não foi possível atualizar' })
  }
})

app.post('/api/staff/:id/password', tenantMiddleware, async (req, res) => {
  if (!requireTenantAdmin(req, res, req.tenant!.id)) return
  const { password } = req.body ?? {}
  if (typeof password !== 'string' || !password) {
    res.status(400).json({ message: 'Informe a nova senha' })
    return
  }
  try {
    await setStaffMemberPassword(req.tenant!.id, req.params.id, password)
    res.json({ ok: true })
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : 'Não foi possível trocar a senha' })
  }
})

app.delete('/api/staff/:id', tenantMiddleware, async (req, res) => {
  if (!requireTenantAdmin(req, res, req.tenant!.id)) return
  try {
    await removeStaffMember(req.tenant!.id, req.params.id)
    res.json({ ok: true })
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : 'Não foi possível remover' })
  }
})

// --- Super Admin (platform-level, not scoped to any one tenant) ---------

function requireSuperAdmin(req: express.Request, res: express.Response): boolean {
  const auth = req.header('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : undefined
  if (!isSuperAdmin(token)) {
    res.status(401).json({ message: 'Não autorizado' })
    return false
  }
  return true
}

app.post('/api/super-admin/login', (req, res) => {
  const { username, password } = req.body ?? {}
  if (typeof username !== 'string' || typeof password !== 'string') {
    res.status(400).json({ message: 'Usuário e senha são obrigatórios' })
    return
  }
  const token = superAdminLogin(username, password)
  if (!token) {
    res.status(401).json({ message: 'Usuário ou senha inválidos' })
    return
  }
  res.json({ token })
})

// Auth is checked before multer touches the request, so an unauthenticated
// caller can't get this far enough to write a file to disk.
app.post('/api/super-admin/upload-logo', (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  uploadLogo(req, res, (err) => {
    if (err) {
      res.status(400).json({ message: err instanceof Error ? err.message : 'Não foi possível enviar a imagem' })
      return
    }
    if (!req.file) {
      res.status(400).json({ message: 'Nenhum arquivo enviado' })
      return
    }
    res.status(201).json({ url: `/api/uploads/logos/${req.file.filename}` })
  })
})

// Lets the map picker center on the client's address before the admin has
// marked any point — just a thin, authenticated proxy to Nominatim.
app.get('/api/super-admin/geocode', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  const address = typeof req.query.address === 'string' ? req.query.address.trim() : ''
  if (!address) {
    res.status(400).json({ message: 'Informe um endereço' })
    return
  }
  try {
    const result = await geocodeAddress(address)
    if (!result) {
      res.status(404).json({ message: 'Endereço não encontrado' })
      return
    }
    res.json(result)
  } catch {
    res.status(502).json({ message: 'Não foi possível buscar o endereço agora' })
  }
})

app.get('/api/super-admin/tenants', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  res.json(await listTenants())
})

app.post('/api/super-admin/tenants', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  const {
    name,
    slug,
    logoUrl,
    primaryColor,
    accentColor,
    responsibleName,
    phone,
    email,
    address,
    latitude,
    longitude,
    notes,
    tableCount,
    staff,
  } = req.body ?? {}
  if (typeof name !== 'string' || !name.trim() || typeof slug !== 'string' || !slug.trim()) {
    res.status(400).json({ message: 'Nome e slug são obrigatórios' })
    return
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    res.status(400).json({ message: 'Slug só pode ter letras minúsculas, números e hífen' })
    return
  }
  const existing = await getTenantBySlug(slug)
  if (existing) {
    res.status(409).json({ message: 'Já existe um cliente com esse slug' })
    return
  }
  if (!staff?.admin || !staff?.garcom || !staff?.cozinha) {
    res.status(400).json({ message: 'Informe a senha inicial de admin, garçom e cozinha' })
    return
  }
  try {
    const tenant = await createTenant({
      name,
      slug,
      logoUrl,
      primaryColor,
      accentColor,
      responsibleName,
      phone,
      email,
      address,
      latitude,
      longitude,
      notes,
      tableCount,
      staff,
    })
    sendWelcomeEmail(tenant, staff).catch((err) => console.error('[email] welcome:', err))
    res.status(201).json(tenant)
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Erro ao criar cliente' })
  }
})

app.patch('/api/super-admin/tenants/:id', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  const {
    name,
    logoUrl,
    primaryColor,
    accentColor,
    responsibleName,
    phone,
    email,
    address,
    latitude,
    longitude,
    notes,
    status,
    plan,
  } = req.body ?? {}
  try {
    const tenant = await updateTenant(req.params.id, {
      ...(name !== undefined ? { name } : {}),
      ...(logoUrl !== undefined ? { logoUrl } : {}),
      ...(primaryColor !== undefined ? { primaryColor } : {}),
      ...(accentColor !== undefined ? { accentColor } : {}),
      ...(responsibleName !== undefined ? { responsibleName } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(email !== undefined ? { email } : {}),
      ...(address !== undefined ? { address } : {}),
      ...(latitude !== undefined ? { latitude } : {}),
      ...(longitude !== undefined ? { longitude } : {}),
      ...(notes !== undefined ? { notes } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(plan !== undefined ? { plan } : {}),
    })
    res.json(tenant)
  } catch (err) {
    res.status(404).json({ message: err instanceof Error ? err.message : 'Cliente não encontrado' })
  }
})

// Generates fresh passwords for admin/garçom/cozinha and emails them to
// the client's contact address — doesn't expose the new passwords in the
// response, since this is meant to go out by email, not be read off-screen.
app.post('/api/super-admin/tenants/:id/resend-credentials', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  const tenant = await getTenantById(req.params.id)
  if (!tenant) {
    res.status(404).json({ message: 'Cliente não encontrado' })
    return
  }
  if (!tenant.email) {
    res.status(400).json({ message: 'Este cliente não tem e-mail cadastrado' })
    return
  }
  const credentials = await resetStaffPasswords(tenant.id)
  await sendWelcomeEmail(tenant, credentials)
  res.json({ ok: true })
})

// --- WebSocket -------------------------------------------------------------

const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

interface TenantSocket extends WebSocket {
  tenantId?: string
}

function send(ws: WebSocket, message: ServerMessage) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message))
}

// Every broadcast goes out through Redis instead of straight to `wss.clients`:
// that's what lets a change made on one backend instance reach clients
// connected to a *different* instance once this runs as more than one
// container (see onBroadcast below), and it's scoped to one tenant's
// channel so a change at one client never reaches another client's screens.
function broadcast(tenantId: string, message: ServerMessage) {
  publishBroadcast(tenantId, message)
}

onBroadcast((tenantId, message) => {
  const payload = JSON.stringify(message)
  for (const client of wss.clients as Set<TenantSocket>) {
    if (client.readyState === client.OPEN && client.tenantId === tenantId) {
      client.send(payload)
    }
  }
})

async function broadcastState(tenantId: string) {
  const { tables, orders } = await getState(tenantId)
  broadcast(tenantId, { type: 'state', tables, orders })
}

async function broadcastMenu(tenantId: string) {
  broadcast(tenantId, { type: 'menu', items: await getMenu(tenantId) })
}

wss.on('connection', async (ws: TenantSocket, req) => {
  const slug = resolveTenantSlug(req.headers.host)
  const tenant = slug ? await getTenantBySlug(slug) : null
  if (!tenant) {
    send(ws, { type: 'error', message: 'Cliente não encontrado' })
    ws.close()
    return
  }
  ws.tenantId = tenant.id

  const { tables, orders } = await getState(tenant.id)
  send(ws, { type: 'state', tables, orders })
  send(ws, { type: 'menu', items: await getMenu(tenant.id) })

  ws.on('message', async (raw) => {
    const tenantId = ws.tenantId!
    let msg: ClientMessage
    try {
      msg = JSON.parse(raw.toString())
    } catch {
      send(ws, { type: 'error', message: 'Mensagem inválida' })
      return
    }

    try {
      switch (msg.type) {
        case 'placeOrder': {
          const staff = getStaffIdentity(msg.token, tenantId)
          await placeOrder(tenantId, msg.tableId, msg.lines, staff ? { id: staff.id, name: staff.name } : undefined)
          await broadcastState(tenantId)
          break
        }
        case 'setOrderStatus':
          await setOrderStatus(tenantId, msg.orderId, msg.status)
          await broadcastState(tenantId)
          break
        case 'callWaiter':
          await callWaiter(tenantId, msg.tableId)
          await broadcastState(tenantId)
          break
        case 'acknowledgeCall':
          await acknowledgeCall(tenantId, msg.tableId)
          await broadcastState(tenantId)
          break
        case 'requestBill':
          await requestBill(tenantId, msg.tableId)
          await broadcastState(tenantId)
          break
        case 'closeTable':
          await closeTable(tenantId, msg.tableId)
          await broadcastState(tenantId)
          break
        case 'createMenuItem':
          if (!hasRole(msg.token, tenantId, ['admin'])) {
            send(ws, { type: 'error', message: 'Não autorizado' })
            return
          }
          await createMenuItem(tenantId, msg.item)
          await broadcastMenu(tenantId)
          break
        case 'updateMenuItem':
          if (!hasRole(msg.token, tenantId, ['admin'])) {
            send(ws, { type: 'error', message: 'Não autorizado' })
            return
          }
          await updateMenuItem(tenantId, msg.id, msg.item)
          await broadcastMenu(tenantId)
          break
        case 'deleteMenuItem':
          if (!hasRole(msg.token, tenantId, ['admin'])) {
            send(ws, { type: 'error', message: 'Não autorizado' })
            return
          }
          await deleteMenuItem(tenantId, msg.id)
          await broadcastMenu(tenantId)
          break
        case 'payBill': {
          const { tables } = await getState(tenantId)
          const table = tables.find((t) => t.id === msg.tableId)
          if (!table) {
            send(ws, { type: 'error', message: 'Mesa não encontrada' })
            return
          }
          const tableOrders = await getOrdersForTable(tenantId, msg.tableId)
          if (tableOrders.length === 0) {
            send(ws, { type: 'error', message: 'Não há pedidos para fechar nesta mesa' })
            return
          }
          const subtotal = tableOrders.reduce(
            (sum, o) => sum + o.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0),
            0,
          )
          const settlement = await settleBill(
            tenantId,
            msg.customerPhone,
            subtotal,
            !!msg.redeemPoints,
          )
          const staff = getStaffIdentity(msg.token, tenantId)
          const bill = await createBill(tenantId, {
            tableId: msg.tableId,
            tableNumber: table.number,
            orders: tableOrders,
            paymentMethod: msg.paymentMethod,
            splitCount: msg.splitCount,
            customerPhone: msg.customerPhone,
            staff: staff ? { id: staff.id, name: staff.name } : undefined,
            loyaltyDiscount: settlement.discount,
            pointsEarned: settlement.pointsEarned,
            pointsRedeemed: settlement.pointsRedeemed,
          })
          await closeTable(tenantId, msg.tableId)
          await broadcastState(tenantId)
          send(ws, { type: 'bill', bill, loyaltyPoints: settlement.account?.points ?? 0 })
          break
        }
        case 'submitReview': {
          const bill = await getBill(tenantId, msg.billId)
          if (!bill) {
            send(ws, { type: 'error', message: 'Conta não encontrada para avaliação' })
            return
          }
          await addReview(tenantId, {
            billId: msg.billId,
            tableNumber: bill.tableNumber,
            rating: msg.rating,
            comment: msg.comment,
          })
          send(ws, { type: 'reviewAck' })
          break
        }
        case 'lookupLoyalty': {
          const account = await getAccount(tenantId, msg.phone)
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

server.listen(PORT, () => {
  console.log(`Meu Restaurante API + WebSocket rodando em http://localhost:${PORT}`)
})
