import { create } from 'zustand'
import { socket } from '../lib/socket'
import type { Bill, PaymentMethod } from '../types'

interface BillingStoreState {
  lastBill: Bill | null
  loyaltyPointsAfterPayment: number | null
  loyaltyLookup: { phone: string; points: number } | null
  reviewSubmitted: boolean
  lastError: string | null
  payBill: (input: {
    tableId: string
    paymentMethod: PaymentMethod
    splitCount: number
    customerPhone?: string
    redeemPoints?: boolean
  }) => void
  submitReview: (input: { billId: string; rating: number; comment: string }) => void
  lookupLoyalty: (phone: string) => void
  reset: () => void
  clearError: () => void
}

export const useBillingStore = create<BillingStoreState>((set) => {
  socket.onMessage((msg) => {
    if (msg.type === 'bill') {
      set({ lastBill: msg.bill, loyaltyPointsAfterPayment: msg.loyaltyPoints })
    }
    if (msg.type === 'loyalty') {
      set({ loyaltyLookup: { phone: msg.phone, points: msg.points } })
    }
    if (msg.type === 'reviewAck') {
      set({ reviewSubmitted: true })
    }
    if (msg.type === 'error') {
      set({ lastError: msg.message })
    }
  })
  socket.start()

  return {
    lastBill: null,
    loyaltyPointsAfterPayment: null,
    loyaltyLookup: null,
    reviewSubmitted: false,
    lastError: null,

    payBill: (input) => socket.send({ type: 'payBill', ...input }),
    submitReview: (input) => socket.send({ type: 'submitReview', ...input }),
    lookupLoyalty: (phone) => socket.send({ type: 'lookupLoyalty', phone }),
    reset: () =>
      set({
        lastBill: null,
        loyaltyPointsAfterPayment: null,
        loyaltyLookup: null,
        reviewSubmitted: false,
        lastError: null,
      }),
    clearError: () => set({ lastError: null }),
  }
})
