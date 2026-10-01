import { CheckCircle2, Gift } from 'lucide-react'
import { formatBRL } from '../lib/format'
import type { Bill } from '../types'

const PAYMENT_LABEL: Record<Bill['paymentMethod'], string> = {
  pix: 'Pix',
  cartao: 'Cartão',
  carteira: 'Carteira digital',
}

export default function BillReceiptModal({
  bill,
  loyaltyPoints,
  onContinue,
}: {
  bill: Bill
  loyaltyPoints: number | null
  onContinue: () => void
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center sm:p-4 animate-fade-in">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-surface sm:rounded-3xl animate-slide-up">
        <div className="flex flex-col items-center gap-2 border-b border-border px-6 py-6 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
            <CheckCircle2 size={28} />
          </span>
          <h2 className="font-display text-xl font-medium text-ink">Pagamento confirmado</h2>
          <p className="text-[12.5px] text-ink-soft">
            {bill.id} · Mesa {bill.tableNumber} · {PAYMENT_LABEL[bill.paymentMethod]}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <ul className="flex flex-col divide-y divide-border">
            {bill.lines.map((line, i) => (
              <li key={i} className="flex justify-between py-2 text-[13px]">
                <span className="text-ink-soft">
                  {line.quantity}× {line.name}
                </span>
                <span className="font-mono text-ink">
                  {formatBRL(line.unitPrice * line.quantity)}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex flex-col gap-1 border-t border-border pt-3 text-[13px]">
            <div className="flex justify-between text-ink-soft">
              <span>Subtotal</span>
              <span className="font-mono">{formatBRL(bill.subtotal)}</span>
            </div>
            {bill.loyaltyDiscount > 0 && (
              <div className="flex justify-between text-accent">
                <span>Desconto fidelidade</span>
                <span className="font-mono">-{formatBRL(bill.loyaltyDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold text-ink">
              <span>Total pago</span>
              <span className="font-mono text-copper">{formatBRL(bill.total)}</span>
            </div>
            {bill.splitCount > 1 && (
              <div className="flex justify-between text-ink-soft">
                <span>Dividido em {bill.splitCount}x</span>
                <span className="font-mono">{formatBRL(bill.perPerson)} / pessoa</span>
              </div>
            )}
          </div>

          {bill.customerPhone && (
            <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-border bg-surface-alt px-3.5 py-3 text-[13px] text-ink">
              <Gift size={16} className="flex-none text-copper" />
              <span>
                {bill.pointsEarned > 0 && <>+{bill.pointsEarned} pontos ganhos · </>}
                Saldo: <span className="font-mono font-semibold">{loyaltyPoints ?? 0} pontos</span>
              </span>
            </div>
          )}
        </div>

        <div className="flex-none border-t border-border px-6 py-4">
          <button
            onClick={onContinue}
            className="min-h-12 w-full rounded-full bg-accent text-center font-semibold text-white transition hover:bg-accent/90"
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  )
}
