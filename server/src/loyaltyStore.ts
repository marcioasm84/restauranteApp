import { prisma } from './db.ts'
import type { LoyaltyAccount } from './types.ts'

// 1 point earned per R$1 spent; each point is worth R$0.10 when redeemed.
const EARN_RATE = 1
const REDEEM_VALUE = 0.1

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

export async function getAccount(phone: string): Promise<LoyaltyAccount> {
  const key = normalizePhone(phone)
  const row = await prisma.loyaltyAccount.findUnique({ where: { phone: key } })
  return row ?? { phone: key, points: 0, totalSpent: 0, visits: 0 }
}

/**
 * Applies a redemption (if requested) then an accrual for a paid bill, in one
 * atomic step. Returns the discount actually applied and the updated account.
 */
export async function settleBill(
  phone: string | undefined,
  subtotal: number,
  redeemPoints: boolean,
): Promise<{
  discount: number
  pointsRedeemed: number
  pointsEarned: number
  account: LoyaltyAccount | null
}> {
  if (!phone || !phone.trim()) {
    return { discount: 0, pointsRedeemed: 0, pointsEarned: 0, account: null }
  }

  const key = normalizePhone(phone)
  const current = (await prisma.loyaltyAccount.findUnique({ where: { phone: key } })) ?? {
    phone: key,
    points: 0,
    totalSpent: 0,
    visits: 0,
  }

  const maxDiscount = current.points * REDEEM_VALUE
  const discount = redeemPoints ? Math.min(maxDiscount, subtotal) : 0
  const pointsRedeemed = Math.round(discount / REDEEM_VALUE)

  const amountPaid = subtotal - discount
  const pointsEarned = Math.floor(amountPaid * EARN_RATE)

  const updated = await prisma.loyaltyAccount.upsert({
    where: { phone: key },
    create: {
      phone: key,
      points: pointsEarned - pointsRedeemed,
      totalSpent: amountPaid,
      visits: 1,
    },
    update: {
      points: { increment: pointsEarned - pointsRedeemed },
      totalSpent: { increment: amountPaid },
      visits: { increment: 1 },
    },
  })

  return { discount, pointsRedeemed, pointsEarned, account: updated }
}
