import { prisma } from './db.ts'
import type { Review } from './types.ts'

function toReview(row: {
  id: string
  billId: string
  tableNumber: number
  rating: number
  comment: string
  createdAt: Date
}): Review {
  return {
    id: row.id,
    billId: row.billId,
    tableNumber: row.tableNumber,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.createdAt.getTime(),
  }
}

export async function addReview(
  tenantId: string,
  input: { billId: string; tableNumber: number; rating: number; comment: string },
): Promise<Review> {
  const row = await prisma.review.create({
    data: {
      tenantId,
      billId: input.billId,
      tableNumber: input.tableNumber,
      rating: Math.min(5, Math.max(1, Math.round(input.rating))),
      comment: input.comment.trim().slice(0, 500),
    },
  })
  return toReview(row)
}

export async function getAllReviews(tenantId: string): Promise<Review[]> {
  const rows = await prisma.review.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } })
  return rows.map(toReview)
}

export async function getReviewsInRange(tenantId: string, from: number, to: number): Promise<Review[]> {
  const rows = await prisma.review.findMany({
    where: { tenantId, createdAt: { gte: new Date(from), lt: new Date(to) } },
    orderBy: { createdAt: 'asc' },
  })
  return rows.map(toReview)
}
