import { Bell, Receipt } from 'lucide-react'
import type { RestaurantTable } from '../types'

const STATUS_STYLE: Record<RestaurantTable['status'], string> = {
  livre: 'border-border bg-surface text-ink-soft',
  ocupada: 'border-accent bg-accent-soft text-accent',
  aguardando_pedido: 'border-accent bg-accent-soft text-accent',
  aguardando_conta: 'border-copper bg-copper-soft text-copper',
}

const STATUS_LABEL: Record<RestaurantTable['status'], string> = {
  livre: 'Livre',
  ocupada: 'Ocupada',
  aguardando_pedido: 'Aguardando pedido',
  aguardando_conta: 'Aguardando conta',
}

export default function TableCard({
  table,
  orderCount,
  onClick,
}: {
  table: RestaurantTable
  orderCount: number
  onClick: () => void
}) {
  const needsAttention = table.callingWaiter || table.requestingBill

  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${STATUS_STYLE[table.status]} ${
        needsAttention ? 'ring-2 ring-copper ring-offset-2 ring-offset-bg' : ''
      }`}
    >
      {needsAttention && (
        <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 animate-pulse items-center justify-center rounded-full bg-copper text-white">
          {table.callingWaiter ? <Bell size={12} /> : <Receipt size={12} />}
        </span>
      )}
      <span className="font-display text-2xl font-semibold text-ink">{table.number}</span>
      <span className="text-[11.5px] font-semibold uppercase tracking-wide">
        {STATUS_LABEL[table.status]}
      </span>
      {orderCount > 0 && (
        <span className="font-mono text-[11px] text-ink-soft">
          {orderCount} {orderCount === 1 ? 'pedido' : 'pedidos'}
        </span>
      )}
    </button>
  )
}
