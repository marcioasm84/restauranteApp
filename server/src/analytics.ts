import { getAllBills } from './billingStore.ts'
import { getAllReviews } from './reviewStore.ts'
import type { AnalyticsSummary } from './types.ts'

function isToday(timestamp: number): boolean {
  const d = new Date(timestamp)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  const [bills, reviews] = await Promise.all([getAllBills(), getAllReviews()])

  const todayBillsList = bills.filter((b) => isToday(b.createdAt))
  const todayRevenue = todayBillsList.reduce((sum, b) => sum + b.total, 0)
  const averageTicket = todayBillsList.length > 0 ? todayRevenue / todayBillsList.length : 0

  const prepSamples = bills.flatMap((b) => b.prepMinutesSamples ?? [])
  const averagePrepMinutes =
    prepSamples.length > 0 ? prepSamples.reduce((s, v) => s + v, 0) / prepSamples.length : null

  const averageRating =
    reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null

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

  return {
    todayRevenue,
    todayBills: todayBillsList.length,
    averageTicket,
    averagePrepMinutes,
    averageRating,
    reviewCount: reviews.length,
    topDishes,
  }
}
