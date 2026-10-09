export interface CartLine {
  lineId: string
  menuItemId: string
  quantity: number
  pontoCarne?: string
  removidos: string[]
  observacao: string
}

export interface OrderLine extends CartLine {
  name: string
  unitPrice: number
}

export type OrderStatus = 'recebido' | 'preparando' | 'pronto' | 'entregue'

export interface StatusEvent {
  status: OrderStatus
  at: number
}

export interface Order {
  id: string
  tableId: string
  lines: OrderLine[]
  status: OrderStatus
  createdAt: number
  statusHistory: StatusEvent[]
  /** Which staff member placed it — undefined for orders customers place themselves. */
  staffId?: string
  staffName?: string
}

export type TableStatus = 'livre' | 'ocupada' | 'aguardando_pedido' | 'aguardando_conta'

export interface RestaurantTable {
  id: string
  number: number
  status: TableStatus
  callingWaiter: boolean
  requestingBill: boolean
}

export interface RestaurantState {
  tables: RestaurantTable[]
  orders: Order[]
}

export type Badge = 'vegetariano' | 'sem-gluten' | 'picante' | 'mais-pedido' | 'novo'

export interface MenuItemCustomization {
  pontoCarne?: string[]
  removiveis?: string[]
}

export interface MenuItem {
  id: string
  name: string
  description: string
  price: number
  category: string
  image: string
  badges: Badge[]
  customization?: MenuItemCustomization
}

export type MenuItemInput = Omit<MenuItem, 'id'>

export type PaymentMethod = 'pix' | 'cartao' | 'carteira'

export interface BillLine {
  name: string
  quantity: number
  unitPrice: number
}

export interface Bill {
  id: string
  tableId: string
  tableNumber: number
  lines: BillLine[]
  subtotal: number
  loyaltyDiscount: number
  total: number
  paymentMethod: PaymentMethod
  splitCount: number
  perPerson: number
  customerPhone?: string
  pointsEarned: number
  pointsRedeemed: number
  /** Minutes between "recebido" and "pronto" for each order in this bill (prep time samples for analytics). */
  prepMinutesSamples: number[]
  createdAt: number
  /** Which staff member closed it — undefined if a customer closed their own table. */
  staffId?: string
  staffName?: string
}

export interface LoyaltyAccount {
  phone: string
  points: number
  totalSpent: number
  visits: number
}

export interface Review {
  id: string
  billId: string
  tableNumber: number
  rating: number
  comment: string
  createdAt: number
}

export interface AnalyticsSummary {
  periodRevenue: number
  periodBills: number
  averageTicket: number
  /** % change vs. the equivalent prior period, or null if that period had no revenue to compare against. */
  revenueChangePct: number | null
  averagePrepMinutes: number | null
  averageRating: number | null
  reviewCount: number
  topDishes: { name: string; quantity: number; revenue: number }[]
  dailyRevenue: { date: string; revenue: number; bills: number }[]
  byCategory: { category: string; quantity: number; revenue: number }[]
  byPaymentMethod: { method: PaymentMethod; count: number; revenue: number }[]
  byStaff: { staffId: string | null; staffName: string; bills: number; revenue: number }[]
}

// Messages the client can send to the server over the WebSocket connection.
export type ClientMessage =
  | { type: 'placeOrder'; tableId: string; lines: CartLine[]; token?: string }
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
      token?: string
    }
  | { type: 'submitReview'; billId: string; rating: number; comment: string }
  | { type: 'lookupLoyalty'; phone: string }

// Messages the server pushes to connected clients.
export type ServerMessage =
  | { type: 'state'; tables: RestaurantTable[]; orders: Order[] }
  | { type: 'menu'; items: MenuItem[] }
  | { type: 'bill'; bill: Bill; loyaltyPoints: number }
  | { type: 'loyalty'; phone: string; points: number }
  | { type: 'reviewAck' }
  | { type: 'error'; message: string }
