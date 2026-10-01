import type { RestaurantTable } from '../types'

export const INITIAL_TABLES: RestaurantTable[] = Array.from({ length: 8 }, (_, i) => ({
  id: String(i + 1),
  number: i + 1,
  status: 'livre',
  callingWaiter: false,
  requestingBill: false,
}))
