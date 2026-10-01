import { Bell, Receipt } from 'lucide-react'

export default function QuickActions({
  callingWaiter,
  requestingBill,
  onCallWaiter,
  onRequestBill,
}: {
  callingWaiter: boolean
  requestingBill: boolean
  onCallWaiter: () => void
  onRequestBill: () => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={onCallWaiter}
        disabled={callingWaiter}
        className={`flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 py-2.5 text-[12.5px] font-semibold transition md:text-[13px] ${
          callingWaiter
            ? 'border-copper bg-copper-soft text-copper'
            : 'border-border text-ink-soft hover:text-ink'
        }`}
      >
        <Bell size={14} className={callingWaiter ? 'animate-pulse' : ''} />
        {callingWaiter ? 'Garçom a caminho' : 'Chamar garçom'}
      </button>
      <button
        onClick={onRequestBill}
        disabled={requestingBill}
        className={`flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 py-2.5 text-[12.5px] font-semibold transition md:text-[13px] ${
          requestingBill
            ? 'border-copper bg-copper-soft text-copper'
            : 'border-border text-ink-soft hover:text-ink'
        }`}
      >
        <Receipt size={14} />
        {requestingBill ? 'Conta solicitada' : 'Pedir a conta'}
      </button>
    </div>
  )
}
