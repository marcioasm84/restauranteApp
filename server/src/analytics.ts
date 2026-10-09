import { getBillsInRange } from './billingStore.ts'
import { getMenu } from './menuStore.ts'
import { getReviewsInRange } from './reviewStore.ts'
import type { AnalyticsSummary, Bill } from './types.ts'

function avg(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length
}

function dayKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10)
}

export async function getAnalyticsSummary(
  tenantId: string,
  from: number,
  to: number,
): Promise<AnalyticsSummary> {
  const periodLength = to - from
  const prevFrom = from - periodLength
  const prevTo = from

  const [bills, prevBills, reviews, menu] = await Promise.all([
    getBillsInRange(tenantId, from, to),
    getBillsInRange(tenantId, prevFrom, prevTo),
    getReviewsInRange(tenantId, from, to),
    getMenu(tenantId),
  ])

  const periodRevenue = bills.reduce((sum, b) => sum + b.total, 0)
  const periodBills = bills.length
  const averageTicket = periodBills > 0 ? periodRevenue / periodBills : 0

  const prevRevenue = prevBills.reduce((sum, b) => sum + b.total, 0)
  const revenueChangePct = prevRevenue > 0 ? ((periodRevenue - prevRevenue) / prevRevenue) * 100 : null

  const prepSamples = bills.flatMap((b) => b.prepMinutesSamples ?? [])
  const averagePrepMinutes = prepSamples.length > 0 ? avg(prepSamples) : null

  const averageRating = reviews.length > 0 ? avg(reviews.map((r) => r.rating)) : null

  // Prato mais pedido — agora escopado ao período selecionado, não mais
  // histórico completo (o período em si já é o filtro que importa aqui).
  const dishTotals = new Map<string, { quantity: number; revenue: number }>()
  for (const bill of bills) {
    for (const line of bill.lines) {
      const entry = dishTotals.get(line.name) ?? { quantity: 0, revenue: 0 }
      entry.quantity += line.quantity
      entry.revenue += line.quantity * line.unitPrice
      dishTotals.set(line.name, entry)
    }
  }
  const topDishes = [...dishTotals.entries()]
    .map(([name, v]) => ({ name, quantity: v.quantity, revenue: v.revenue }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5)

  const dailyMap = new Map<string, { revenue: number; bills: number }>()
  for (const bill of bills) {
    const key = dayKey(bill.createdAt)
    const entry = dailyMap.get(key) ?? { revenue: 0, bills: 0 }
    entry.revenue += bill.total
    entry.bills += 1
    dailyMap.set(key, entry)
  }
  const dailyRevenue = [...dailyMap.entries()]
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Categoria é resolvida pelo cardápio ATUAL (nome do prato -> categoria),
  // não guardada em cada linha da conta — um prato renomeado ou removido
  // do cardápio depois da venda aparece como "Sem categoria" nos relatórios
  // antigos, troca aceitável para não precisar de uma coluna nova em
  // BillLine só para isso.
  const categoryByName = new Map(menu.map((m) => [m.name, m.category]))
  const categoryTotals = new Map<string, { quantity: number; revenue: number }>()
  for (const bill of bills) {
    for (const line of bill.lines) {
      const category = categoryByName.get(line.name) ?? 'Sem categoria'
      const entry = categoryTotals.get(category) ?? { quantity: 0, revenue: 0 }
      entry.quantity += line.quantity
      entry.revenue += line.quantity * line.unitPrice
      categoryTotals.set(category, entry)
    }
  }
  const byCategory = [...categoryTotals.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.revenue - a.revenue)

  const paymentTotals = new Map<Bill['paymentMethod'], { count: number; revenue: number }>()
  for (const bill of bills) {
    const entry = paymentTotals.get(bill.paymentMethod) ?? { count: 0, revenue: 0 }
    entry.count += 1
    entry.revenue += bill.total
    paymentTotals.set(bill.paymentMethod, entry)
  }
  const byPaymentMethod = [...paymentTotals.entries()].map(([method, v]) => ({ method, ...v }))

  const staffTotals = new Map<string, { staffName: string; bills: number; revenue: number }>()
  for (const bill of bills) {
    const key = bill.staffId ?? '__none__'
    const entry = staffTotals.get(key) ?? {
      staffName: bill.staffName ?? 'Sem garçom identificado',
      bills: 0,
      revenue: 0,
    }
    entry.bills += 1
    entry.revenue += bill.total
    staffTotals.set(key, entry)
  }
  const byStaff = [...staffTotals.entries()]
    .map(([key, v]) => ({ staffId: key === '__none__' ? null : key, ...v }))
    .sort((a, b) => b.revenue - a.revenue)

  return {
    periodRevenue,
    periodBills,
    averageTicket,
    revenueChangePct,
    averagePrepMinutes,
    averageRating,
    reviewCount: reviews.length,
    topDishes,
    dailyRevenue,
    byCategory,
    byPaymentMethod,
    byStaff,
  }
}

function csvField(value: string | number): string {
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function csvRow(fields: (string | number)[]): string {
  return fields.map(csvField).join(',') + '\r\n'
}

export async function buildAnalyticsCsv(tenantId: string, from: number, to: number): Promise<string> {
  const summary = await getAnalyticsSummary(tenantId, from, to)
  let csv = ''

  csv += csvRow(['Período', `${new Date(from).toISOString()} a ${new Date(to).toISOString()}`])
  csv += '\r\n'

  csv += csvRow(['Faturamento por dia'])
  csv += csvRow(['Data', 'Contas fechadas', 'Faturamento'])
  for (const d of summary.dailyRevenue) csv += csvRow([d.date, d.bills, d.revenue.toFixed(2)])
  csv += '\r\n'

  csv += csvRow(['Por categoria'])
  csv += csvRow(['Categoria', 'Quantidade', 'Faturamento'])
  for (const c of summary.byCategory) csv += csvRow([c.category, c.quantity, c.revenue.toFixed(2)])
  csv += '\r\n'

  csv += csvRow(['Por forma de pagamento'])
  csv += csvRow(['Forma', 'Contas', 'Faturamento'])
  for (const p of summary.byPaymentMethod) csv += csvRow([p.method, p.count, p.revenue.toFixed(2)])
  csv += '\r\n'

  csv += csvRow(['Por garçom'])
  csv += csvRow(['Garçom', 'Contas fechadas', 'Faturamento'])
  for (const s of summary.byStaff) csv += csvRow([s.staffName, s.bills, s.revenue.toFixed(2)])

  return csv
}
