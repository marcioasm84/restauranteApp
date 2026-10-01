import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Bell, Check, Plus, Receipt } from 'lucide-react'
import { useRestaurantStore } from '../../store/useRestaurantStore'
import { useMenuStore } from '../../store/useMenuStore'
import { useBillingStore } from '../../store/useBillingStore'
import { formatBRL, orderStatusLabel } from '../../lib/format'
import type { Bill, CartLine, MenuItem } from '../../types'
import CategorySidebar from '../../components/CategorySidebar'
import MenuItemCard from '../../components/MenuItemCard'
import ItemDetailSheet from '../../components/ItemDetailSheet'
import CartDrawer from '../../components/CartDrawer'
import StatusTimeline from '../../components/StatusTimeline'
import PaymentModal from '../../components/PaymentModal'
import BillReceiptModal from '../../components/BillReceiptModal'
import { SHELL_WIDTH } from '../../lib/layout'

export default function TableDetail() {
  const { tableId } = useParams<{ tableId: string }>()
  const navigate = useNavigate()
  const table = useRestaurantStore((s) => s.tables.find((t) => t.id === tableId))
  const allOrders = useRestaurantStore((s) => s.orders)
  const orders = useMemo(() => allOrders.filter((o) => o.tableId === tableId), [allOrders, tableId])
  const placeOrder = useRestaurantStore((s) => s.placeOrder)
  const acknowledgeCall = useRestaurantStore((s) => s.acknowledgeCall)
  const closeTable = useRestaurantStore((s) => s.closeTable)
  const connected = useRestaurantStore((s) => s.connected)

  const menuItems = useMenuStore((s) => s.items)
  const categories = useMenuStore((s) => s.categories)

  const resetBilling = useBillingStore((s) => s.reset)
  const loyaltyPointsAfterPayment = useBillingStore((s) => s.loyaltyPointsAfterPayment)

  const [showMenu, setShowMenu] = useState(false)
  const [category, setCategory] = useState<string>(categories[0] ?? '')
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [cart, setCart] = useState<CartLine[]>([])
  const [paymentOpen, setPaymentOpen] = useState(false)
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
  const grandTotal = orders.reduce(
    (sum, o) => sum + o.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0),
    0,
  )

  if (!table) return <Navigate to="/garcom" replace />

  const handleConfirmOrder = () => {
    if (!connected) return
    placeOrder(table.id, cart)
    setCart([])
    setCartOpen(false)
    setShowMenu(false)
  }

  const handleCloseTable = () => {
    closeTable(table.id)
    navigate('/garcom')
  }

  const handleOpenPayment = () => {
    resetBilling()
    setPaymentOpen(true)
  }

  return (
    <div
      className={`mx-auto flex min-h-full w-full ${SHELL_WIDTH} flex-col px-5 py-6 pb-16 md:px-8 md:py-8`}
    >
      <header className="mb-5 flex items-center gap-3 md:mb-7">
        <button
          onClick={() => navigate('/garcom')}
          className="flex h-11 w-11 flex-none items-center justify-center rounded-full border border-border text-ink-soft hover:text-ink"
          aria-label="Voltar ao mapa de mesas"
        >
          <ArrowLeft size={17} />
        </button>
        <div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-copper">
            Painel do garçom
          </span>
          <h1 className="font-display text-2xl font-semibold text-ink">Mesa {table.number}</h1>
        </div>
      </header>

      {table.callingWaiter && (
        <div className="mb-3 flex items-center justify-between rounded-2xl border border-copper bg-copper-soft px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-semibold text-copper">
            <Bell size={16} className="animate-pulse" /> Cliente está chamando o garçom
          </span>
          <button
            onClick={() => acknowledgeCall(table.id)}
            className="min-h-9 rounded-full bg-surface px-3.5 py-2 text-[12.5px] font-semibold text-copper shadow-sm"
          >
            Atendido
          </button>
        </div>
      )}

      {table.requestingBill && (
        <div className="mb-3 flex items-center justify-between rounded-2xl border border-copper bg-copper-soft px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-semibold text-copper">
            <Receipt size={16} /> Mesa solicitou a conta
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-medium md:text-xl">Pedidos da mesa</h2>
        <button
          onClick={() => setShowMenu(true)}
          className="flex min-h-11 items-center gap-1.5 rounded-full bg-accent px-3.5 py-2.5 text-[12.5px] font-semibold text-white hover:bg-accent/90"
        >
          <Plus size={15} /> Lançar pedido
        </button>
      </div>

      {orders.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-ink-soft">
          Nenhum pedido lançado ainda para esta mesa.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-3 md:grid md:grid-cols-2 md:gap-4 xl:grid-cols-3">
          {orders.map((order) => (
            <div key={order.id} className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-semibold text-ink-soft">
                  {order.id}
                </span>
                <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-semibold text-accent">
                  {orderStatusLabel[order.status]}
                </span>
              </div>
              <div className="mt-3">
                <StatusTimeline status={order.status} />
              </div>
              <ul className="mt-3 flex flex-col gap-1 border-t border-border pt-2.5">
                {order.lines.map((line) => (
                  <li key={line.lineId} className="flex justify-between text-[13px]">
                    <span className="text-ink-soft">
                      {line.quantity}× {line.name}
                    </span>
                    <span className="font-mono text-ink">
                      {formatBRL(line.unitPrice * line.quantity)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="lg:ml-auto lg:w-full lg:max-w-md">
        <div className="mt-6 flex items-center justify-between rounded-2xl border border-border bg-surface-alt px-4 py-3.5">
          <span className="text-sm font-semibold text-ink">Total da mesa</span>
          <span className="font-mono text-lg font-semibold text-copper">
            {formatBRL(grandTotal)}
          </span>
        </div>

        <button
          onClick={orders.length > 0 ? handleOpenPayment : handleCloseTable}
          disabled={orders.length === 0 && table.status === 'livre'}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-accent py-3 text-sm font-semibold text-accent transition hover:bg-accent hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Check size={16} /> {orders.length > 0 ? 'Fechar conta' : 'Liberar mesa'}
        </button>
      </div>

      {showMenu && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center animate-fade-in">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-surface sm:rounded-3xl md:max-w-3xl animate-slide-up">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-display text-lg font-medium">Lançar pedido — Mesa {table.number}</h2>
              <button
                onClick={() => setShowMenu(false)}
                className="text-sm font-semibold text-ink-soft hover:text-ink"
              >
                Fechar
              </button>
            </div>
            <div className="flex flex-1 overflow-hidden">
              <CategorySidebar categories={categories} active={category} onChange={setCategory} />
              <div className="flex-1 overflow-y-auto">
                <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-3">
                  {filtered.map((item) => (
                    <MenuItemCard key={item.id} item={item} onSelect={setSelectedItem} />
                  ))}
                </div>
              </div>
            </div>
            {cart.length > 0 && (
              <div className="flex-none border-t border-border p-4">
                <button
                  onClick={() => setCartOpen(true)}
                  className="w-full rounded-full bg-accent py-3 text-sm font-semibold text-white"
                >
                  Ver comanda ({cart.reduce((s, l) => s + l.quantity, 0)} itens)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedItem && (
        <ItemDetailSheet
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onAdd={(line) => setCart((prev) => [...prev, line])}
        />
      )}

      {cartOpen && (
        <CartDrawer
          lines={cart}
          onClose={() => setCartOpen(false)}
          onChangeQty={(lineId, quantity) =>
            setCart((prev) => prev.map((l) => (l.lineId === lineId ? { ...l, quantity } : l)))
          }
          onRemove={(lineId) => setCart((prev) => prev.filter((l) => l.lineId !== lineId))}
          onConfirm={handleConfirmOrder}
          connected={connected}
        />
      )}

      {paymentOpen && (
        <PaymentModal
          tableId={table.id}
          tableNumber={table.number}
          orders={orders}
          onClose={() => setPaymentOpen(false)}
          onPaid={(bill) => {
            setPaymentOpen(false)
            setPaidBill(bill)
          }}
        />
      )}

      {paidBill && (
        <BillReceiptModal
          bill={paidBill}
          loyaltyPoints={loyaltyPointsAfterPayment}
          onContinue={() => {
            setPaidBill(null)
            navigate('/garcom')
          }}
        />
      )}
    </div>
  )
}
