import { useState } from 'react'
import { Minus, Plus, X } from 'lucide-react'
import { formatBRL } from '../lib/format'
import type { CartLine, MenuItem } from '../types'
import DishImage from './DishImage'
import ItemBadge from './ItemBadge'

export default function ItemDetailSheet({
  item,
  onClose,
  onAdd,
}: {
  item: MenuItem
  onClose: () => void
  onAdd: (line: CartLine) => void
}) {
  const [quantity, setQuantity] = useState(1)
  const [pontoCarne, setPontoCarne] = useState(item.customization?.pontoCarne?.[1])
  const [removidos, setRemovidos] = useState<string[]>([])
  const [observacao, setObservacao] = useState('')

  const toggleRemovivel = (name: string) => {
    setRemovidos((prev) => (prev.includes(name) ? prev.filter((r) => r !== name) : [...prev, name]))
  }

  const handleAdd = () => {
    onAdd({
      lineId: crypto.randomUUID(),
      menuItemId: item.id,
      quantity,
      pontoCarne,
      removidos,
      observacao: observacao.trim(),
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center sm:p-4 animate-fade-in">
      <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-surface sm:rounded-3xl md:max-w-xl lg:max-w-2xl animate-slide-up">
        <div className="relative h-52 w-full flex-none md:h-64 lg:h-72">
          <DishImage src={item.image} alt={item.name} className="h-full w-full" />
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur"
          >
            <X size={18} />
          </button>
          {item.badges.length > 0 && (
            <div className="absolute left-3 top-3 flex flex-wrap gap-1">
              {item.badges.map((b) => (
                <ItemBadge key={b} badge={b} />
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 md:px-7 md:py-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display text-xl font-medium text-ink md:text-2xl">{item.name}</h2>
            <span className="font-mono text-base font-semibold text-copper md:text-lg">
              {formatBRL(item.price)}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-ink-soft md:text-[15px]">{item.description}</p>

          {item.customization?.pontoCarne && (
            <div className="mt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Ponto da carne
              </h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {item.customization.pontoCarne.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setPontoCarne(opt)}
                    className={`min-h-10 rounded-full border px-4 py-2 text-[13px] font-medium transition ${
                      pontoCarne === opt
                        ? 'border-accent bg-accent text-white'
                        : 'border-border text-ink-soft hover:text-ink'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {item.customization?.removiveis && (
            <div className="mt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Remover ingredientes
              </h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {item.customization.removiveis.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => toggleRemovivel(opt)}
                    className={`min-h-10 rounded-full border px-4 py-2 text-[13px] font-medium transition ${
                      removidos.includes(opt)
                        ? 'border-danger bg-danger/10 text-danger line-through'
                        : 'border-border text-ink-soft hover:text-ink'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
              Observações
            </h3>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: sem cebola, ponto mais seco, alergia a amendoim..."
              rows={2}
              className="mt-2 w-full resize-none rounded-xl border border-border bg-bg px-3 py-2 text-sm text-ink placeholder:text-ink-soft/70 focus:border-accent focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-none flex-wrap items-center gap-3 border-t border-border px-5 py-4 md:px-7 md:py-5">
          <div className="flex items-center gap-2 rounded-full border border-border px-1.5 py-1.5">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              aria-label="Diminuir quantidade"
              className="flex h-9 w-9 items-center justify-center rounded-full text-ink-soft hover:bg-surface-alt"
            >
              <Minus size={15} />
            </button>
            <span className="w-4 text-center font-mono text-sm font-semibold">{quantity}</span>
            <button
              onClick={() => setQuantity((q) => q + 1)}
              aria-label="Aumentar quantidade"
              className="flex h-9 w-9 items-center justify-center rounded-full text-ink-soft hover:bg-surface-alt"
            >
              <Plus size={15} />
            </button>
          </div>
          <button
            onClick={handleAdd}
            className="flex min-h-12 flex-1 items-center justify-between gap-2 rounded-full bg-accent px-5 py-3 font-semibold text-white transition hover:bg-accent/90"
          >
            <span>Adicionar</span>
            <span className="font-mono">{formatBRL(item.price * quantity)}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
