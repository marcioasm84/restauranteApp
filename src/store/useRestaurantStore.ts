import { create } from 'zustand'
import { socket } from '../lib/socket'
import { getToken } from '../lib/auth'
import { INITIAL_TABLES } from '../data/tables'
import type { CartLine, Order, OrderStatus } from '../types'
import type { RestaurantTable } from '../types'

interface RestaurantStoreState {
  tables: RestaurantTable[]
  orders: Order[]
  connected: boolean
  placeOrder: (tableId: string, lines: CartLine[]) => void
  setOrderStatus: (orderId: string, status: OrderStatus) => void
  callWaiter: (tableId: string) => void
  acknowledgeCall: (tableId: string) => void
  requestBill: (tableId: string) => void
  closeTable: (tableId: string) => void
}

export const useRestaurantStore = create<RestaurantStoreState>((set) => {
  socket.onMessage((msg) => {
    if (msg.type === 'state') {
      set({ tables: msg.tables, orders: msg.orders })
    }
  })
  socket.onStatusChange((connected) => set({ connected }))
  socket.start()

  return {
    // Optimistic defaults so the UI has something to render before the
    // first 'state' message arrives from the server.
    tables: INITIAL_TABLES,
    orders: [],
    connected: false,

    placeOrder: (tableId, lines) =>
      socket.send({ type: 'placeOrder', tableId, lines, token: getToken() ?? undefined }),
    setOrderStatus: (orderId, status) => socket.send({ type: 'setOrderStatus', orderId, status }),
    callWaiter: (tableId) => socket.send({ type: 'callWaiter', tableId }),
    acknowledgeCall: (tableId) => socket.send({ type: 'acknowledgeCall', tableId }),
    requestBill: (tableId) => socket.send({ type: 'requestBill', tableId }),
    closeTable: (tableId) => socket.send({ type: 'closeTable', tableId }),
  }
})
