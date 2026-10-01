import { WifiOff } from 'lucide-react'
import { useRestaurantStore } from '../store/useRestaurantStore'

export default function ConnectionBanner() {
  const connected = useRestaurantStore((s) => s.connected)

  if (connected) return null

  return (
    <div
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-danger px-4 py-2 text-center text-[12.5px] font-semibold text-white"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
    >
      <WifiOff size={14} className="flex-none animate-pulse" />
      Sem conexão com o servidor — tentando reconectar…
    </div>
  )
}
