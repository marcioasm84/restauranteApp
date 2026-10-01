import type {
  Bill,
  CartLine,
  MenuItem,
  Order,
  OrderStatus,
  PaymentMethod,
  RestaurantTable,
} from '../types'

type MenuItemInput = Omit<MenuItem, 'id'>

export type ClientMessage =
  | { type: 'placeOrder'; tableId: string; lines: CartLine[] }
  | { type: 'setOrderStatus'; orderId: string; status: OrderStatus }
  | { type: 'callWaiter'; tableId: string }
  | { type: 'acknowledgeCall'; tableId: string }
  | { type: 'requestBill'; tableId: string }
  | { type: 'closeTable'; tableId: string }
  | { type: 'createMenuItem'; token: string; item: MenuItemInput }
  | { type: 'updateMenuItem'; token: string; id: string; item: Partial<MenuItemInput> }
  | { type: 'deleteMenuItem'; token: string; id: string }
  | {
      type: 'payBill'
      tableId: string
      paymentMethod: PaymentMethod
      splitCount: number
      customerPhone?: string
      redeemPoints?: boolean
    }
  | { type: 'submitReview'; billId: string; rating: number; comment: string }
  | { type: 'lookupLoyalty'; phone: string }

export type ServerMessage =
  | { type: 'state'; tables: RestaurantTable[]; orders: Order[] }
  | { type: 'menu'; items: MenuItem[] }
  | { type: 'bill'; bill: Bill; loyaltyPoints: number }
  | { type: 'loyalty'; phone: string; points: number }
  | { type: 'reviewAck' }
  | { type: 'error'; message: string }

type MessageListener = (msg: ServerMessage) => void
type StatusListener = (connected: boolean) => void

const WS_PORT = 4000

function buildWsUrl(): string {
  const envUrl = import.meta.env.VITE_WS_URL as string | undefined
  if (envUrl) return envUrl
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${protocol}://${window.location.hostname}:${WS_PORT}/ws`
}

class SocketClient {
  private ws: WebSocket | null = null
  private messageListeners = new Set<MessageListener>()
  private statusListeners = new Set<StatusListener>()
  private retryDelay = 1000
  private started = false

  start() {
    if (this.started) return
    this.started = true
    this.connect()
  }

  private connect() {
    const url = buildWsUrl()
    const ws = new WebSocket(url)
    this.ws = ws

    ws.onopen = () => {
      this.retryDelay = 1000
      this.statusListeners.forEach((fn) => fn(true))
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerMessage
        this.messageListeners.forEach((fn) => fn(msg))
      } catch {
        // ignore malformed frames
      }
    }

    ws.onclose = () => {
      this.statusListeners.forEach((fn) => fn(false))
      const delay = this.retryDelay
      this.retryDelay = Math.min(this.retryDelay * 1.5, 8000)
      setTimeout(() => this.connect(), delay)
    }

    ws.onerror = () => {
      ws.close()
    }
  }

  send(message: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    }
  }

  onMessage(fn: MessageListener) {
    this.messageListeners.add(fn)
    return () => this.messageListeners.delete(fn)
  }

  onStatusChange(fn: StatusListener) {
    this.statusListeners.add(fn)
    return () => this.statusListeners.delete(fn)
  }
}

export const socket = new SocketClient()
