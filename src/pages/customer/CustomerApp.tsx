import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, Navigate, Link } from 'react-router-dom'
import { ClipboardList, Lock, UtensilsCrossed } from 'lucide-react'
import { useRestaurantStore } from '../../store/useRestaurantStore'
import { useMenuStore } from '../../store/useMenuStore'
import { useBillingStore } from '../../store/useBillingStore'
import { useToastStore } from '../../store/useToastStore'
import type { Bill, CartLine, MenuItem, OrderStatus } from '../../types'
import CategorySidebar from '../../components/CategorySidebar'
import MenuItemCard from '../../components/MenuItemCard'
import ItemDetailSheet from '../../components/ItemDetailSheet'
import CartDrawer from '../../components/CartDrawer'
import FloatingCartButton from '../../components/FloatingCartButton'
import QuickActions from '../../components/QuickActions'
import Logo from '../../components/Logo'
import PaymentModal from '../../components/PaymentModal'
import BillReceiptModal from '../../components/BillReceiptModal'
import ReviewModal from '../../components/ReviewModal'
import TableUnlockForm from '../../components/TableUnlockForm'
import OrderStatusList from './OrderStatusList'
import { SHELL_WIDTH } from '../../lib/layout'
import { clearUnlockedTableId, isTableUnlocked } from '../../lib/tableSession'

type Tab = 'menu' | 'status'
type CheckoutStep = 'none' | 'payment' | 'receipt' | 'review'

const READY_MESSAGES: Partial<Record<OrderStatus, (id: string) => string>> = {
  preparando: (id) => `Pedido ${id} entrou em preparo na cozinha.`,
  pronto: (id) => `Seu pedido ${id} está pronto!`,
}

export default function CustomerApp() {
  const { tableId } = useParams<{ tableId: string }>()
  const navigate = useNavigate()
  const [unlocked, setUnlocked] = useState(() => !!tableId && isTableUnlocked(tableId))
  const table = useRestaurantStore((s) => s.tables.find((t) => t.id === tableId))
  const placeOrder = useRestaurantStore((s) => s.placeOrder)
  const callWaiter = useRestaurantStore((s) => s.callWaiter)
  const requestBill = useRestaurantStore((s) => s.requestBill)
  const connected = useRestaurantStore((s) => s.connected)
  const allOrders = useRestaurantStore((s) => s.orders)
  const orders = useMemo(() => allOrders.filter((o) => o.tableId === tableId), [allOrders, tableId])

  const menuItems = useMenuStore((s) => s.items)
  const categories = useMenuStore((s) => s.categories)

  const resetBilling = useBillingStore((s) => s.reset)
  const loyaltyPointsAfterPayment = useBillingStore((s) => s.loyaltyPointsAfterPayment)
  const pushToast = useToastStore((s) => s.push)

  const [tab, setTab] = useState<Tab>('menu')
  const [category, setCategory] = useState<string>(categories[0] ?? '')
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [cart, setCart] = useState<CartLine[]>([])
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>('none')
  const [paidBill, setPaidBill] = useState<Bill | null>(null)

  useEffect(() => {
    if (categories.length > 0 && !categories.includes(category)) {
      setCategory(categories[0])
    }
  }, [categories, category])

  const filtered = useMemo(
    () => menuItems.filter((m) => m.category === category),
    [menuItems, category],
  )

  const cartTotal = useMemo(
    () =>
      cart.reduce((sum, line) => {
        const item = menuItems.find((m) => m.id === line.menuItemId)
        return sum + (item?.price ?? 0) * line.quantity
      }, 0),
    [cart, menuItems],
  )
  const cartCount = cart.reduce((sum, l) => sum + l.quantity, 0)

  // Notify the customer in-app as their order(s) move through the kitchen.
  const prevStatuses = useRef<Record<string, OrderStatus>>({})
  useEffect(() => {
    orders.forEach((o) => {
      const prev = prevStatuses.current[o.id]
      if (prev && prev !== o.status) {
        const message = READY_MESSAGES[o.status]?.(o.id)
        if (message) pushToast(message)
      }
      prevStatuses.current[o.id] = o.status
    })
  }, [orders, pushToast])

  if (!table) return <Navigate to="/" replace />

  if (!unlocked) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 px-5 py-14">
        <Logo size="md" to="/" />
        <TableUnlockForm
          tableId={table.id}
          tableNumber={table.number}
          onUnlocked={() => setUnlocked(true)}
        />
        <Link to="/cardapio" className="text-[12.5px] font-semibold text-ink-soft hover:text-ink">
          Só quero ver o cardápio
        </Link>
      </div>
    )
  }

  const handleChangeTable = () => {
    clearUnlockedTableId()
    navigate('/liberar-mesa')
  }

  const handleAddLine = (line: CartLine) => setCart((prev) => [...prev, line])
  const handleChangeQty = (lineId: string, quantity: number) =>
    setCart((prev) => prev.map((l) => (l.lineId === lineId ? { ...l, quantity } : l)))
  const handleRemoveLine = (lineId: string) =>
    setCart((prev) => prev.filter((l) => l.lineId !== lineId))

  const handleConfirmOrder = () => {
    if (!connected) return
    placeOrder(table.id, cart)
    setCart([])
    setCartOpen(false)
    setTab('status')
    pushToast('Pedido enviado para a cozinha!')
  }

  const openCheckout = () => {
    resetBilling()
    setCheckoutStep('payment')
  }

  return (
    <div className={`mx-auto flex h-full w-full ${SHELL_WIDTH} flex-col bg-bg`}>
      <header
        className="flex-none border-b border-border bg-surface px-4 pb-3 md:px-6"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 14px)' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="flex items-center gap-3 md:gap-4">
            <Logo size="sm" />
            <span className="h-7 w-px bg-border md:h-8" aria-hidden />
            <h1 className="font-display text-xl font-semibold leading-tight text-ink md:text-2xl">
              Mesa {table.number}
            </h1>
            <button
              onClick={handleChangeTable}
              className="flex items-center gap-1 text-[12px] font-semibold text-ink-soft hover:text-ink"
            >
              <Lock size={12} /> Trocar mesa
            </button>
          </div>
          <QuickActions
            callingWaiter={table.callingWaiter}
            requestingBill={table.requestingBill}
            onCallWaiter={() => callWaiter(table.id)}
            onRequestBill={() => requestBill(table.id)}
          />
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {tab === 'menu' && (
          <CategorySidebar categories={categories} active={category} onChange={setCategory} />
        )}
        <div className="flex-1 overflow-y-auto pb-28">
          {tab === 'menu' ? (
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 md:gap-4 md:p-6 lg:grid-cols-4 2xl:grid-cols-5">
              {filtered.map((item) => (
                <MenuItemCard key={item.id} item={item} onSelect={setSelectedItem} />
              ))}
              {filtered.length === 0 && (
                <p className="col-span-full py-10 text-center text-sm text-ink-soft">
                  Nenhum item nesta categoria ainda.
                </p>
              )}
            </div>
          ) : (
            <OrderStatusList
              orders={orders}
              onOrderMore={() => setTab('menu')}
              onPay={openCheckout}
            />
          )}
        </div>
      </main>

      {tab === 'menu' && (
        <FloatingCartButton count={cartCount} total={cartTotal} onClick={() => setCartOpen(true)} />
      )}

      <div
        className="fixed inset-x-0 bottom-0 z-20 flex justify-center px-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
      >
        <nav className="flex items-center gap-1 rounded-full border border-border bg-surface p-1.5 shadow-lg shadow-black/30">
          <button
            onClick={() => setTab('menu')}
            className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-semibold transition ${
              tab === 'menu' ? 'bg-accent text-white' : 'text-ink-soft hover:text-ink'
            }`}
          >
            <UtensilsCrossed size={17} />
            Cardápio
          </button>
          <button
            onClick={() => setTab('status')}
            className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-semibold transition ${
              tab === 'status' ? 'bg-accent text-white' : 'text-ink-soft hover:text-ink'
            }`}
          >
            <span className="relative inline-flex">
              <ClipboardList size={17} />
              {orders.length > 0 && (
                <span className="absolute -right-2 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-copper text-[9px] font-bold text-white">
                  {orders.length}
                </span>
              )}
            </span>
            Meu pedido
          </button>
        </nav>
      </div>

      {selectedItem && (
        <ItemDetailSheet
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onAdd={handleAddLine}
        />
      )}

      {cartOpen && (
        <CartDrawer
          lines={cart}
          onClose={() => setCartOpen(false)}
          onChangeQty={handleChangeQty}
          onRemove={handleRemoveLine}
          onConfirm={handleConfirmOrder}
          connected={connected}
        />
      )}

      {checkoutStep === 'payment' && (
        <PaymentModal
          tableId={table.id}
          tableNumber={table.number}
          orders={orders}
          onClose={() => setCheckoutStep('none')}
          onPaid={(bill) => {
            setPaidBill(bill)
            setCheckoutStep('receipt')
          }}
        />
      )}

      {checkoutStep === 'receipt' && paidBill && (
        <BillReceiptModal
          bill={paidBill}
          loyaltyPoints={loyaltyPointsAfterPayment}
          onContinue={() => setCheckoutStep('review')}
        />
      )}

      {checkoutStep === 'review' && paidBill && (
        <ReviewModal
          billId={paidBill.id}
          onDone={() => {
            setCheckoutStep('none')
            setPaidBill(null)
            setTab('menu')
          }}
        />
      )}
    </div>
  )
}
