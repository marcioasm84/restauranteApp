import { Check } from 'lucide-react'
import { orderStatusLabel, orderStatusOrder } from '../lib/format'
import type { OrderStatus } from '../types'

export default function StatusTimeline({ status }: { status: OrderStatus }) {
  const currentIndex = orderStatusOrder.indexOf(status)

  return (
    <div className="flex items-center">
      {orderStatusOrder.map((step, i) => {
        const done = i < currentIndex
        const active = i === currentIndex
        const isLast = i === orderStatusOrder.length - 1
        return (
          <div key={step} className={`flex items-center ${isLast ? '' : 'flex-1'}`}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-bold transition ${
                  done
                    ? 'border-accent bg-accent text-white'
                    : active
                      ? 'border-accent bg-surface text-accent'
                      : 'border-border bg-surface text-ink-soft'
                }`}
              >
                {done ? <Check size={12} /> : i + 1}
              </div>
              <span
                className={`whitespace-nowrap text-[10.5px] font-medium ${
                  active || done ? 'text-ink' : 'text-ink-soft'
                }`}
              >
                {orderStatusLabel[step]}
              </span>
            </div>
            {!isLast && (
              <div
                className={`mx-1 h-0.5 flex-1 rounded-full ${done ? 'bg-accent' : 'bg-border'}`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
