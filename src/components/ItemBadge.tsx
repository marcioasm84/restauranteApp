import { BADGE_LABEL } from '../data/menu'
import type { Badge } from '../types'

const STYLES: Record<Badge, string> = {
  vegetariano: 'bg-accent-soft text-accent',
  'sem-gluten': 'bg-accent-soft text-accent',
  picante: 'bg-danger/10 text-danger',
  'mais-pedido': 'bg-copper-soft text-copper',
  novo: 'bg-copper-soft text-copper',
}

export default function ItemBadge({ badge }: { badge: Badge }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide ${STYLES[badge]}`}
    >
      {BADGE_LABEL[badge]}
    </span>
  )
}
