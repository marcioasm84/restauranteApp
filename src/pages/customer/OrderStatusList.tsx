import { useEffect, useState } from 'react'
import { Clock, ClipboardList, CreditCard, Plus } from 'lucide-react'
import { formatBRL, minutesAgo, orderStatusLabel } from '../../lib/format'
import { useMenuStore } from '../../store/useMenuStore'
import type { Order } from '../../types'
import StatusTimeline from '../../components/StatusTimeline'
import DishImage from '../../components/DishImage'

export default function OrderStatusList({
  orders,
  onOrderMore,
  onPay,
}: {
  orders: Order[]
  onOrderMore: () => void
  onPay: () => void
}) {
  const menuItems = useMenuStore((s) => s.items)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-8 pt-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-alt text-ink-soft">
          <ClipboardList size={24} />
        </div>
        <p className="text-sm text-ink-soft">
          Você ainda não fez nenhum pedido nesta mesa. Explore o cardápio e adicione seus pratos
          favoritos.
        </p>
        <button
          onClick={onOrderMore}
          className="mt-1 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white"
        >
          Ver cardápio
        </button>
      </div>
    )
  }

  const sorted = [...orders].sort((a, b) => b.createdAt - a.createdAt)
  const grandTotal = orders.reduce(
    (sum, o) => sum + o.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0),
    0,
  )

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 2xl:grid-cols-3">
      {sorted.map((order) => {
        const total = order.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0)
        return (
          <div key={order.id} className="rounded-3xl border border-border bg-surface p-5 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="font-mono text-[12px] font-semibold text-ink-soft">
                  {order.id}
                </span>
                <p className="mt-0.5 flex items-center gap-1 text-[12px] text-ink-soft">
                  <Clock size={11} /> {minutesAgo(order.createdAt, now)}
                </p>
              </div>
              <span className="rounded-full bg-accent-soft px-3 py-1 text-[12.5px] font-semibold text-accent">
                {orderStatusLabel[order.status]}
              </span>
            </div>

            <div className="mt-5">
              <StatusTimeline status={order.status} />
            </div>

            <ul className="mt-5 flex flex-col divide-y divide-border border-t border-border">
              {order.lines.map((line) => {
                const menuItem = menuItems.find((m) => m.id === line.menuItemId)
                const details = [
                  line.pontoCarne,
                  ...line.removidos.map((r) => `sem ${r}`),
                  line.observacao,
                ].filter(Boolean)
                return (
                  <li key={line.lineId} className="flex items-center gap-3.5 py-3.5">
                    <div className="h-16 w-16 flex-none overflow-hidden rounded-2xl">
                      <DishImage
                        src={menuItem?.image ?? ''}
                        alt={line.name}
                        className="h-full w-full"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-[12.5px] font-semibold text-ink-soft">
                          {line.quantity}×
                        </span>
                        <span className="truncate font-display text-[15px] font-medium text-ink">
                          {line.name}
                        </span>
                      </div>
                      {details.length > 0 && (
                        <p className="mt-0.5 truncate text-[12px] text-ink-soft">
                          {details.join(' · ')}
                        </p>
                      )}
                    </div>
                    <span className="flex-none font-mono text-[14px] font-semibold text-copper">
                      {formatBRL(line.unitPrice * line.quantity)}
                    </span>
                  </li>
                )
              })}
            </ul>

            <div className="mt-3 flex justify-between border-t border-border pt-3.5 text-[14px] font-semibold text-ink">
              <span>Subtotal</span>
              <span className="font-mono text-copper">{formatBRL(total)}</span>
            </div>
          </div>
        )
      })}

      <div className="flex flex-col gap-3 rounded-3xl border border-border bg-surface-alt p-5 md:p-6 lg:col-span-2 2xl:col-span-3">
        <div className="flex items-center justify-between text-[15px] font-semibold text-ink">
          <span>Total da mesa</span>
          <span className="font-mono text-copper">{formatBRL(grandTotal)}</span>
        </div>
        <button
          onClick={onPay}
          className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent text-sm font-semibold text-white transition hover:bg-accent/90"
        >
          <CreditCard size={16} /> Fechar conta
        </button>
      </div>

      <button
        onClick={onOrderMore}
        className="flex min-h-14 items-center justify-center gap-1.5 rounded-full border border-dashed border-border text-sm font-semibold text-ink-soft hover:text-ink lg:col-span-2 2xl:col-span-3"
      >
        <Plus size={16} /> Pedir mais itens
      </button>
    </div>
  )
}
