import { prisma } from './db.ts'
import type { Bill, BillLine, Order, PaymentMethod } from './types.ts'

function toBill(row: {
  id: string
  tableId: string
  tableNumber: number
  subtotal: number
  loyaltyDiscount: number
  total: number
  paymentMethod: string
  splitCount: number
  perPerson: number
  customerPhone: string | null
  pointsEarned: number
  pointsRedeemed: number
  prepMinutesSamples: number[]
  createdAt: Date
  lines: { name: string; quantity: number; unitPrice: number }[]
}): Bill {
  return {
    id: row.id,
    tableId: row.tableId,
    tableNumber: row.tableNumber,
    lines: row.lines,
    subtotal: row.subtotal,
    loyaltyDiscount: row.loyaltyDiscount,
    total: row.total,
    paymentMethod: row.paymentMethod as PaymentMethod,
    splitCount: row.splitCount,
    perPerson: row.perPerson,
    customerPhone: row.customerPhone ?? undefined,
    pointsEarned: row.pointsEarned,
    pointsRedeemed: row.pointsRedeemed,
    prepMinutesSamples: row.prepMinutesSamples,
    createdAt: row.createdAt.getTime(),
  }
}

export async function createBill(input: {
  tableId: string
  tableNumber: number
  orders: Order[]
  paymentMethod: PaymentMethod
  splitCount: number
  customerPhone?: string
  loyaltyDiscount: number
  pointsEarned: number
  pointsRedeemed: number
}): Promise<Bill> {
  const lines: BillLine[] = input.orders.flatMap((o) =>
    o.lines.map((l) => ({ name: l.name, quantity: l.quantity, unitPrice: l.unitPrice })),
  )
  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0)
  const total = Math.max(0, subtotal - input.loyaltyDiscount)
  const splitCount = Math.max(1, input.splitCount)

  const prepMinutesSamples = input.orders.flatMap((o) => {
    const received = o.statusHistory?.find((e) => e.status === 'recebido')?.at
    const ready = o.statusHistory?.find((e) => e.status === 'pronto')?.at
    if (!received || !ready || ready <= received) return []
    return [(ready - received) / 60000]
  })

  const row = await prisma.bill.create({
    data: {
      id: `NF-${Date.now().toString(36).toUpperCase()}`,
      tableId: input.tableId,
      tableNumber: input.tableNumber,
      subtotal,
      loyaltyDiscount: input.loyaltyDiscount,
      total,
      paymentMethod: input.paymentMethod,
      splitCount,
      perPerson: total / splitCount,
      customerPhone: input.customerPhone,
      pointsEarned: input.pointsEarned,
      pointsRedeemed: input.pointsRedeemed,
      prepMinutesSamples,
      lines: { create: lines },
    },
    include: { lines: true },
  })

  return toBill(row)
}

export async function getBill(id: string): Promise<Bill | undefined> {
  const row = await prisma.bill.findUnique({ where: { id }, include: { lines: true } })
  return row ? toBill(row) : undefined
}

export async function getAllBills(): Promise<Bill[]> {
  const rows = await prisma.bill.findMany({ include: { lines: true }, orderBy: { createdAt: 'asc' } })
  return rows.map(toBill)
}
