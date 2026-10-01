import { formatBRL } from '../lib/format'
import type { MenuItem } from '../types'
import DishImage from './DishImage'
import ItemBadge from './ItemBadge'

export default function MenuItemCard({
  item,
  onSelect,
}: {
  item: MenuItem
  onSelect: (item: MenuItem) => void
}) {
  return (
    <button
      onClick={() => onSelect(item)}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="relative h-36 w-full overflow-hidden sm:h-40 md:h-44 lg:h-48">
        <DishImage
          src={item.image}
          alt={item.name}
          className="h-full w-full transition duration-300 group-hover:scale-105"
        />
        {item.badges.length > 0 && (
          <div className="absolute left-2 top-2 flex flex-wrap gap-1">
            {item.badges.map((b) => (
              <ItemBadge key={b} badge={b} />
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3 sm:p-3.5 md:p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-[0.95rem] font-medium leading-tight text-ink sm:text-[1.05rem] md:text-[1.15rem]">
            {item.name}
          </h3>
        </div>
        <p className="line-clamp-2 text-[12px] text-ink-soft sm:text-[12.5px] md:text-[13px]">
          {item.description}
        </p>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 pt-2">
          <span className="font-mono text-[12.5px] font-semibold text-copper sm:text-[13.5px] md:text-[14.5px]">
            {formatBRL(item.price)}
          </span>
          <span className="flex-none rounded-full bg-accent px-2.5 py-1 text-[10.5px] font-semibold text-white transition group-hover:bg-accent/90 sm:px-3 sm:py-1.5 sm:text-[11px]">
            Adicionar
          </span>
        </div>
      </div>
    </button>
  )
}
