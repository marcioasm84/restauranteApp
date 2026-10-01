import { ShoppingBag } from 'lucide-react'
import { formatBRL } from '../lib/format'
import { SHELL_WIDTH } from '../lib/layout'

export default function FloatingCartButton({
  count,
  total,
  onClick,
}: {
  count: number
  total: number
  onClick: () => void
}) {
  if (count === 0) return null

  return (
    <div
      className={`fixed inset-x-0 z-30 mx-auto w-full ${SHELL_WIDTH} px-4`}
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 84px)' }}
    >
      <button
        onClick={onClick}
        className="flex w-full items-center justify-between rounded-full bg-accent px-5 py-3.5 text-white shadow-xl shadow-accent/30 transition hover:bg-accent/90 animate-slide-up"
      >
        <span className="flex items-center gap-2 font-semibold">
          <ShoppingBag size={18} />
          {count} {count === 1 ? 'item' : 'itens'}
        </span>
        <span className="font-mono font-semibold">{formatBRL(total)}</span>
      </button>
    </div>
  )
}
