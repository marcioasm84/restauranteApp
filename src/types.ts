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
}

export type TableStatus = 'livre' | 'ocupada' | 'aguardando_pedido' | 'aguardando_conta'

export interface RestaurantTable {
  id: string
  number: number
  status: TableStatus
  callingWaiter: boolean
  requestingBill: boolean
}

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
  prepMinutesSamples: number[]
  createdAt: number
}

export interface AnalyticsSummary {
  todayRevenue: number
  todayBills: number
  averageTicket: number
  averagePrepMinutes: number | null
  averageRating: number | null
  reviewCount: number
  topDishes: { name: string; quantity: number; revenue: number }[]
}
