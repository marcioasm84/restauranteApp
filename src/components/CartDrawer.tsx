import { Minus, Plus, Trash2, X } from 'lucide-react'
import { useMenuStore } from '../store/useMenuStore'
import { formatBRL } from '../lib/format'
import type { CartLine } from '../types'

export default function CartDrawer({
  lines,
  onClose,
  onChangeQty,
  onRemove,
  onConfirm,
  connected = true,
}: {
  lines: CartLine[]
  onClose: () => void
  onChangeQty: (lineId: string, quantity: number) => void
  onRemove: (lineId: string) => void
  onConfirm: () => void
  connected?: boolean
}) {
  const menuItems = useMenuStore((s) => s.items)
  const total = lines.reduce((sum, line) => {
    const item = menuItems.find((m) => m.id === line.menuItemId)
    return sum + (item?.price ?? 0) * line.quantity
  }, 0)

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center sm:p-4 animate-fade-in">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-surface sm:rounded-3xl md:max-w-xl animate-slide-up">
        <div className="flex items-center justify-between border-b border-border px-5 py-4 md:px-7">
          <h2 className="font-display text-lg font-medium md:text-xl">Seu pedido</h2>
          <button
            onClick={onClose}
            aria-label="Fechar carrinho"
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink-soft hover:bg-surface-alt"
          >
            <X size={18} />
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="px-5 py-14 text-center text-sm text-ink-soft">
            Seu carrinho está vazio. Volte ao cardápio para adicionar itens.
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-3 md:px-7">
            <ul className="flex flex-col divide-y divide-border">
              {lines.map((line) => {
                const item = menuItems.find((m) => m.id === line.menuItemId)
                if (!item) return null
                const details = [
                  line.pontoCarne,
                  ...line.removidos.map((r) => `sem ${r}`),
                  line.observacao,
                ].filter(Boolean)
                return (
                  <li key={line.lineId} className="flex gap-3 py-3.5">
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-semibold text-ink">{item.name}</span>
                        <span className="font-mono text-sm font-semibold text-copper">
                          {formatBRL(item.price * line.quantity)}
                        </span>
                      </div>
                      {details.length > 0 && (
                        <p className="mt-0.5 text-[12px] text-ink-soft">{details.join(' · ')}</p>
                      )}
                      <div className="mt-2 flex items-center gap-3">
                        <div className="flex items-center gap-1.5 rounded-full border border-border px-1 py-1">
                          <button
                            onClick={() => onChangeQty(line.lineId, Math.max(1, line.quantity - 1))}
                            aria-label="Diminuir"
                            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft hover:bg-surface-alt"
                          >
                            <Minus size={13} />
                          </button>
                          <span className="w-3 text-center font-mono text-[12.5px] font-semibold">
                            {line.quantity}
                          </span>
                          <button
                            onClick={() => onChangeQty(line.lineId, line.quantity + 1)}
                            aria-label="Aumentar"
                            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft hover:bg-surface-alt"
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                        <button
                          onClick={() => onRemove(line.lineId)}
                          aria-label="Remover item"
                          className="flex min-h-8 items-center gap-1 text-[12px] font-medium text-danger/80 hover:text-danger"
                        >
                          <Trash2 size={13} /> Remover
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        <div className="flex-none border-t border-border px-5 py-4 md:px-7">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="text-ink-soft">Total</span>
            <span className="font-mono text-lg font-semibold text-ink">{formatBRL(total)}</span>
          </div>
          <button
            disabled={lines.length === 0 || !connected}
            onClick={onConfirm}
            className="min-h-12 w-full rounded-full bg-accent py-3.5 text-center font-semibold text-white transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Confirmar pedido
          </button>
          {!connected && lines.length > 0 && (
            <p className="mt-2 text-center text-[12px] text-danger">
              Sem conexão com o servidor — aguarde reconectar para enviar.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
