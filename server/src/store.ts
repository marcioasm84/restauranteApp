import { Prisma } from '@prisma/client'
import { prisma } from './db.ts'
import { getMenuItem } from './menuStore.ts'
import type {
  CartLine,
  Order,
  OrderStatus,
  RestaurantState,
  RestaurantTable,
  StatusEvent,
} from './types.ts'

function toTable(row: {
  id: string
  number: number
  status: string
  callingWaiter: boolean
  requestingBill: boolean
}): RestaurantTable {
  return {
    id: row.id,
    number: row.number,
    status: row.status as RestaurantTable['status'],
    callingWaiter: row.callingWaiter,
    requestingBill: row.requestingBill,
  }
}

function toOrder(row: {
  id: string
  tableId: string
  status: string
  createdAt: Date
  statusHistory: unknown
  lines: {
    id: string
    menuItemId: string
    name: string
    unitPrice: number
    quantity: number
    pontoCarne: string | null
    removidos: string[]
    observacao: string
  }[]
}): Order {
  return {
    id: row.id,
    tableId: row.tableId,
    status: row.status as OrderStatus,
    createdAt: row.createdAt.getTime(),
    statusHistory: (row.statusHistory as StatusEvent[]) ?? [],
    lines: row.lines.map((l) => ({
      lineId: l.id,
      menuItemId: l.menuItemId,
      name: l.name,
      unitPrice: l.unitPrice,
      quantity: l.quantity,
      pontoCarne: l.pontoCarne ?? undefined,
      removidos: l.removidos,
      observacao: l.observacao,
    })),
  }
}

export async function ensureTablesSeeded() {
  const count = await prisma.restaurantTable.count()
  if (count > 0) return
  for (let i = 1; i <= 8; i++) {
    await prisma.restaurantTable.create({
      data: { id: String(i), number: i, status: 'livre', callingWaiter: false, requestingBill: false },
    })
  }
  console.log('[tables] semeadas 8 mesas')
}

export async function getState(): Promise<RestaurantState> {
  const [tables, orders] = await Promise.all([
    prisma.restaurantTable.findMany({ orderBy: { number: 'asc' } }),
    prisma.order.findMany({ include: { lines: true }, orderBy: { createdAt: 'asc' } }),
  ])
  return { tables: tables.map(toTable), orders: orders.map(toOrder) }
}

export async function getOrdersForTable(tableId: string): Promise<Order[]> {
  const orders = await prisma.order.findMany({
    where: { tableId },
    include: { lines: true },
    orderBy: { createdAt: 'asc' },
  })
  return orders.map(toOrder)
}

async function nextOrderCode(): Promise<string> {
  const rows =
    await prisma.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('order_code_seq') AS nextval`
  return `PED-${String(rows[0].nextval).padStart(3, '0')}`
}

export async function placeOrder(tableId: string, lines: CartLine[]): Promise<Order | null> {
  if (lines.length === 0) return null
  const table = await prisma.restaurantTable.findUnique({ where: { id: tableId } })
  if (!table) return null

  const pricedLines = await Promise.all(
    lines.map(async (line) => {
      const priced = await getMenuItem(line.menuItemId)
      return {
        menuItemId: line.menuItemId,
        name: priced?.name ?? line.menuItemId,
        unitPrice: priced?.price ?? 0,
        quantity: line.quantity,
        pontoCarne: line.pontoCarne,
        removidos: line.removidos,
        observacao: line.observacao,
      }
    }),
  )

  const now = new Date()
  const id = await nextOrderCode()

  const created = await prisma.order.create({
    data: {
      id,
      tableId,
      status: 'recebido',
      createdAt: now,
      statusHistory: [{ status: 'recebido', at: now.getTime() }],
      lines: { create: pricedLines },
    },
    include: { lines: true },
  })

  if (table.status === 'livre') {
    await prisma.restaurantTable.update({ where: { id: tableId }, data: { status: 'ocupada' } })
  }

  return toOrder(created)
}

export async function setOrderStatus(orderId: string, status: OrderStatus) {
  const existing = await prisma.order.findUnique({ where: { id: orderId } })
  if (!existing) return
  const history = ((existing.statusHistory as unknown as StatusEvent[]) ?? []).concat({
    status,
    at: Date.now(),
  })
  await prisma.order.update({
    where: { id: orderId },
    data: { status, statusHistory: history as unknown as Prisma.InputJsonValue },
  })
}

export async function callWaiter(tableId: string) {
  await prisma.restaurantTable.update({ where: { id: tableId }, data: { callingWaiter: true } })
}

export async function acknowledgeCall(tableId: string) {
  await prisma.restaurantTable.update({ where: { id: tableId }, data: { callingWaiter: false } })
}

export async function requestBill(tableId: string) {
  await prisma.restaurantTable.update({
    where: { id: tableId },
    data: { requestingBill: true, status: 'aguardando_conta' },
  })
}

export async function closeTable(tableId: string) {
  await prisma.order.deleteMany({ where: { tableId } })
  await prisma.restaurantTable.update({
    where: { id: tableId },
    data: { status: 'livre', callingWaiter: false, requestingBill: false },
  })
}
