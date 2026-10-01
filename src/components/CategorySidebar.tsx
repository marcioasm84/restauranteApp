import { Beef, GlassWater, IceCream2, Soup, UtensilsCrossed, type LucideIcon } from 'lucide-react'

const CATEGORY_ICON: Record<string, LucideIcon> = {
  Entradas: Soup,
  'Pratos Principais': Beef,
  Bebidas: GlassWater,
  Sobremesas: IceCream2,
}

export default function CategorySidebar({
  categories,
  active,
  onChange,
}: {
  categories: string[]
  active: string
  onChange: (category: string) => void
}) {
  return (
    <div className="no-scrollbar flex w-[76px] flex-none flex-col gap-1.5 overflow-y-auto border-r border-border bg-surface-alt/40 p-2 sm:w-24 md:w-40 md:p-3 lg:w-48">
      {categories.map((cat) => {
        const isActive = cat === active
        const Icon = CATEGORY_ICON[cat] ?? UtensilsCrossed
        return (
          <button
            key={cat}
            onClick={() => onChange(cat)}
            className={`flex min-h-16 flex-col items-center gap-1 rounded-xl px-1.5 py-2.5 text-center text-[10.5px] font-semibold leading-tight transition md:min-h-0 md:flex-row md:gap-2.5 md:px-3.5 md:py-3 md:text-left md:text-[13px] ${
              isActive
                ? 'bg-accent text-white shadow-sm'
                : 'text-ink-soft hover:bg-surface hover:text-ink'
            }`}
          >
            <Icon size={18} className="flex-none" />
            <span>{cat}</span>
          </button>
        )
      })}
    </div>
  )
}
