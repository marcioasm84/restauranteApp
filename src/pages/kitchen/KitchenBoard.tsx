import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ChefHat, Clock, LogOut } from 'lucide-react'
import { useRestaurantStore } from '../../store/useRestaurantStore'
import Logo from '../../components/Logo'
import { SHELL_WIDTH } from '../../lib/layout'
import { clearToken } from '../../lib/auth'
import type { Order, OrderStatus } from '../../types'

const COLUMNS: { status: OrderStatus; label: string; next?: OrderStatus; action?: string }[] = [
  { status: 'recebido', label: 'Recebido', next: 'preparando', action: 'Iniciar preparo' },
  { status: 'preparando', label: 'Em preparo', next: 'pronto', action: 'Marcar como pronto' },
  { status: 'pronto', label: 'Pronto', next: 'entregue', action: 'Marcar como entregue' },
]

function minutesAgo(timestamp: number, now: number) {
  const mins = Math.max(0, Math.floor((now - timestamp) / 60000))
  return mins === 0 ? 'agora' : `${mins} min`
}

function OrderTicket({
  order,
  tableNumber,
  now,
  onAdvance,
  action,
}: {
  order: Order
  tableNumber: number
  now: number
  onAdvance: () => void
  action?: string
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-border bg-surface p-3.5">
      <div className="flex items-center justify-between">
        <span className="font-display text-base font-semibold text-ink">Mesa {tableNumber}</span>
        <span className="flex items-center gap-1 font-mono text-[11px] text-ink-soft">
          <Clock size={11} /> {minutesAgo(order.createdAt, now)}
        </span>
      </div>
      <span className="font-mono text-[10.5px] text-ink-soft">{order.id}</span>
      <ul className="flex flex-col gap-1 border-t border-border pt-2">
        {order.lines.map((line) => {
          const details = [line.pontoCarne, ...line.removidos.map((r) => `sem ${r}`)].filter(
            Boolean,
          )
          return (
            <li key={line.lineId} className="text-[13px] text-ink">
              <span className="font-semibold">{line.quantity}×</span> {line.name}
              {details.length > 0 && (
                <span className="block text-[11.5px] text-ink-soft">{details.join(' · ')}</span>
              )}
              {line.observacao && (
                <span className="block text-[11.5px] italic text-copper">"{line.observacao}"</span>
              )}
            </li>
          )
        })}
      </ul>
      {action && (
        <button
          onClick={onAdvance}
          className="mt-1 flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-accent py-2.5 text-[12.5px] font-semibold text-white hover:bg-accent/90"
        >
          {action} <ArrowRight size={13} />
        </button>
      )}
    </div>
  )
}

export default function KitchenBoard() {
  const navigate = useNavigate()
  const orders = useRestaurantStore((s) => s.orders)
  const tables = useRestaurantStore((s) => s.tables)
  const setOrderStatus = useRestaurantStore((s) => s.setOrderStatus)
  const [now, setNow] = useState(Date.now())

  const handleLogout = () => {
    clearToken()
    navigate('/login', { replace: true })
  }

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  const tableNumber = (tableId: string) => tables.find((t) => t.id === tableId)?.number ?? 0

  return (
    <div
      className={`mx-auto flex min-h-full w-full ${SHELL_WIDTH} flex-col px-5 py-6 md:px-8 md:py-8`}
    >
      <header className="mb-5 flex items-center justify-between md:mb-7">
        <div>
          <Logo size="sm" />
          <h1 className="mt-1.5 flex items-center gap-2 font-display text-2xl font-semibold text-ink md:text-3xl">
            <ChefHat size={22} className="text-accent" /> Painel da cozinha
          </h1>
        </div>
        <button
          onClick={handleLogout}
          className="flex min-h-11 items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-[12.5px] font-semibold text-ink-soft hover:text-ink"
        >
          <LogOut size={15} /> Sair
        </button>
      </header>

      <div className="grid flex-1 gap-4 md:grid-cols-3 md:gap-5">
        {COLUMNS.map((col) => {
          const columnOrders = orders
            .filter((o) => o.status === col.status)
            .sort((a, b) => a.createdAt - b.createdAt)
          return (
            <div key={col.status} className="flex flex-col gap-3">
              <div className="flex items-center justify-between rounded-xl bg-surface-alt px-3.5 py-2.5">
                <span className="text-[13px] font-semibold uppercase tracking-wide text-ink">
                  {col.label}
                </span>
                <span className="font-mono text-[12px] font-semibold text-ink-soft">
                  {columnOrders.length}
                </span>
              </div>
              <div className="flex flex-col gap-3 xl:grid xl:grid-cols-2">
                {columnOrders.length === 0 && (
                  <p className="rounded-xl border border-dashed border-border p-4 text-center text-[12.5px] text-ink-soft xl:col-span-2">
                    Nenhum pedido
                  </p>
                )}
                {columnOrders.map((order) => (
                  <OrderTicket
                    key={order.id}
                    order={order}
                    tableNumber={tableNumber(order.tableId)}
                    now={now}
                    action={col.action}
                    onAdvance={() => col.next && setOrderStatus(order.id, col.next)}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
