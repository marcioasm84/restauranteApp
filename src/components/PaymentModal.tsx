import { useEffect, useMemo, useState } from 'react'
import { CreditCard, Gift, Minus, Plus, QrCode, Wallet, X } from 'lucide-react'
import { useBillingStore } from '../store/useBillingStore'
import { formatBRL } from '../lib/format'
import type { Bill, Order, PaymentMethod } from '../types'

const METHODS: { id: PaymentMethod; label: string; icon: typeof QrCode }[] = [
  { id: 'pix', label: 'Pix', icon: QrCode },
  { id: 'cartao', label: 'Cartão', icon: CreditCard },
  { id: 'carteira', label: 'Carteira digital', icon: Wallet },
]

export default function PaymentModal({
  tableId,
  tableNumber,
  orders,
  onClose,
  onPaid,
}: {
  tableId: string
  tableNumber: number
  orders: Order[]
  onClose: () => void
  onPaid: (bill: Bill) => void
}) {
  const lookupLoyalty = useBillingStore((s) => s.lookupLoyalty)
  const loyaltyLookup = useBillingStore((s) => s.loyaltyLookup)
  const payBill = useBillingStore((s) => s.payBill)
  const lastBill = useBillingStore((s) => s.lastBill)
  const lastError = useBillingStore((s) => s.lastError)
  const clearError = useBillingStore((s) => s.clearError)

  const [method, setMethod] = useState<PaymentMethod>('pix')
  const [splitCount, setSplitCount] = useState(1)
  const [phone, setPhone] = useState('')
  const [redeemPoints, setRedeemPoints] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const subtotal = useMemo(
    () => orders.reduce((sum, o) => sum + o.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0), 0),
    [orders],
  )

  const normalizedPhone = phone.replace(/\D/g, '')
  const hasPoints =
    normalizedPhone.length >= 10 &&
    loyaltyLookup?.phone === normalizedPhone &&
    loyaltyLookup.points > 0

  useEffect(() => {
    if (normalizedPhone.length < 10) return
    const id = setTimeout(() => lookupLoyalty(normalizedPhone), 500)
    return () => clearTimeout(id)
  }, [normalizedPhone, lookupLoyalty])

  const discount = redeemPoints && hasPoints ? Math.min(loyaltyLookup!.points * 0.1, subtotal) : 0
  const total = Math.max(0, subtotal - discount)
  const perPerson = total / splitCount

  useEffect(() => {
    if (submitting && lastBill && lastBill.tableId === tableId) {
      onPaid(lastBill)
    }
  }, [submitting, lastBill, tableId, onPaid])

  const handleSubmit = () => {
    clearError()
    setSubmitting(true)
    payBill({
      tableId,
      paymentMethod: method,
      splitCount,
      customerPhone: normalizedPhone || undefined,
      redeemPoints,
    })
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center sm:p-4 animate-fade-in">
      <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-surface sm:rounded-3xl md:max-w-lg animate-slide-up">
        <div className="flex items-center justify-between border-b border-border px-5 py-4 md:px-7">
          <div>
            <h2 className="font-display text-lg font-medium md:text-xl">Fechar conta</h2>
            <p className="text-[12px] text-ink-soft">Mesa {tableNumber}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink-soft hover:bg-surface-alt"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 md:px-7">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
              Forma de pagamento
            </h3>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {METHODS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setMethod(id)}
                  className={`flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-3 text-[12px] font-semibold transition ${
                    method === id
                      ? 'border-accent bg-accent text-white'
                      : 'border-border text-ink-soft hover:text-ink'
                  }`}
                >
                  <Icon size={20} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
              Dividir entre quantas pessoas?
            </h3>
            <div className="mt-2 flex items-center gap-3">
              <div className="flex items-center gap-3 rounded-full border border-border px-2 py-1.5">
                <button
                  onClick={() => setSplitCount((n) => Math.max(1, n - 1))}
                  aria-label="Diminuir"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-ink-soft hover:bg-surface-alt"
                >
                  <Minus size={15} />
                </button>
                <span className="w-5 text-center font-mono text-sm font-semibold">
                  {splitCount}
                </span>
                <button
                  onClick={() => setSplitCount((n) => Math.min(20, n + 1))}
                  aria-label="Aumentar"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-ink-soft hover:bg-surface-alt"
                >
                  <Plus size={15} />
                </button>
              </div>
              {splitCount > 1 && (
                <span className="text-[13px] text-ink-soft">
                  {formatBRL(perPerson)} por pessoa
                </span>
              )}
            </div>
          </div>

          <div className="mt-5">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
              <Gift size={13} /> Programa de fidelidade (opcional)
            </h3>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Celular com DDD"
              inputMode="numeric"
              className="mt-2 w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-soft/70 focus:border-accent focus:outline-none"
            />
            {hasPoints && (
              <label className="mt-2.5 flex items-center gap-2.5 rounded-xl border border-border bg-surface-alt px-3.5 py-2.5 text-[13px] text-ink">
                <input
                  type="checkbox"
                  checked={redeemPoints}
                  onChange={(e) => setRedeemPoints(e.target.checked)}
                  className="h-4 w-4 accent-accent"
                />
                Usar {loyaltyLookup!.points} pontos (
                {formatBRL(Math.min(loyaltyLookup!.points * 0.1, subtotal))} de desconto)
              </label>
            )}
            {normalizedPhone.length >= 10 && !hasPoints && (
              <p className="mt-2 text-[12px] text-ink-soft">
                Primeira compra com este número — vai começar a acumular pontos agora.
              </p>
            )}
          </div>
        </div>

        <div className="flex-none border-t border-border px-5 py-4 md:px-7">
          <div className="mb-1 flex justify-between text-[13px] text-ink-soft">
            <span>Subtotal</span>
            <span className="font-mono">{formatBRL(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="mb-1 flex justify-between text-[13px] text-accent">
              <span>Desconto fidelidade</span>
              <span className="font-mono">-{formatBRL(discount)}</span>
            </div>
          )}
          <div className="mb-3 flex justify-between text-base font-semibold text-ink">
            <span>Total</span>
            <span className="font-mono text-copper">{formatBRL(total)}</span>
          </div>
          {lastError && <p className="mb-2 text-[12.5px] text-danger">{lastError}</p>}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="min-h-12 w-full rounded-full bg-accent text-center font-semibold text-white transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Processando…' : `Pagar ${formatBRL(total)}`}
          </button>
        </div>
      </div>
    </div>
  )
}
