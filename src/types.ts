export type Badge = 'vegetariano' | 'sem-gluten' | 'picante' | 'mais-pedido' | 'novo'

export type Role = 'admin' | 'garcom' | 'cozinha'

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
  staffId?: string
  staffName?: string
}

export interface TenantBranding {
  name: string
  slug: string
  logoUrl: string | null
  primaryColor: string | null
  accentColor: string | null
}

// What the "choose a restaurant" directory shows when no tenant resolves
// from the current host — deliberately a small subset of TenantSummary,
// since this endpoint has no auth and is reachable by anyone.
export interface PublicTenant {
  name: string
  slug: string
  logoUrl: string | null
  address: string | null
}

export interface TenantSummary {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  primaryColor: string | null
  accentColor: string | null
  responsibleName: string | null
  phone: string | null
  email: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  notes: string | null
  status: 'trial' | 'active' | 'past_due' | 'suspended'
  plan: string
  createdAt: number
  tableCount: number
  menuItemCount: number
  orderCount: number
}

export interface AnalyticsSummary {
  periodRevenue: number
  periodBills: number
  averageTicket: number
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

export interface StaffMember {
  id: string
  username: string
  displayName: string
  role: Role
  active: boolean
  createdAt: number
}
