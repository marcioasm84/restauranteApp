import { Bell } from 'lucide-react'
import { useToastStore } from '../store/useToastStore'

export default function ToastHost() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed inset-x-0 top-0 z-40 flex flex-col items-center gap-2 px-4"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className="flex max-w-sm items-center gap-2.5 rounded-full border border-border bg-surface px-4 py-2.5 text-left text-[13px] font-semibold text-ink shadow-lg shadow-black/30 animate-slide-up"
        >
          <Bell size={15} className="flex-none text-accent" />
          {t.message}
        </button>
      ))}
    </div>
  )
}
