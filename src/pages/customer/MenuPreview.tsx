import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { useMenuStore } from '../../store/useMenuStore'
import { formatBRL } from '../../lib/format'
import CategorySidebar from '../../components/CategorySidebar'
import DishImage from '../../components/DishImage'
import ItemBadge from '../../components/ItemBadge'
import Logo from '../../components/Logo'
import { SHELL_WIDTH } from '../../lib/layout'

export default function MenuPreview() {
  const menuItems = useMenuStore((s) => s.items)
  const categories = useMenuStore((s) => s.categories)
  const [category, setCategory] = useState<string>(categories[0] ?? '')

  useEffect(() => {
    if (categories.length > 0 && !categories.includes(category)) {
      setCategory(categories[0])
    }
  }, [categories, category])

  const filtered = useMemo(
    () => menuItems.filter((m) => m.category === category),
    [menuItems, category],
  )

  return (
    <div className={`mx-auto flex h-full w-full ${SHELL_WIDTH} flex-col bg-bg`}>
      <header
        className="flex-none border-b border-border bg-surface px-4 pb-3 md:px-6"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 14px)' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="flex items-center gap-3 md:gap-4">
            <Logo size="sm" />
            <span className="h-7 w-px bg-border md:h-8" aria-hidden />
            <h1 className="font-display text-xl font-semibold leading-tight text-ink md:text-2xl">
              Cardápio
            </h1>
          </div>
          <Link
            to="/liberar-mesa"
            className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-accent/90"
          >
            <Lock size={14} /> Pedir agora
          </Link>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        <CategorySidebar categories={categories} active={category} onChange={setCategory} />
        <div className="flex-1 overflow-y-auto pb-10">
          <p className="px-4 pt-4 text-[12.5px] text-ink-soft md:px-6">
            Modo de visualização — peça para o garçom liberar sua mesa para fazer pedidos.
          </p>
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 md:gap-4 md:p-6 lg:grid-cols-4 2xl:grid-cols-5">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface text-left shadow-sm"
              >
                <div className="relative h-36 w-full overflow-hidden sm:h-40 md:h-44 lg:h-48">
                  <DishImage src={item.image} alt={item.name} className="h-full w-full" />
                  {item.badges.length > 0 && (
                    <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                      {item.badges.map((b) => (
                        <ItemBadge key={b} badge={b} />
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-1 p-3 sm:p-3.5 md:p-4">
                  <h3 className="font-display text-[0.95rem] font-medium leading-tight text-ink sm:text-[1.05rem] md:text-[1.15rem]">
                    {item.name}
                  </h3>
                  <p className="line-clamp-2 text-[12px] text-ink-soft sm:text-[12.5px] md:text-[13px]">
                    {item.description}
                  </p>
                  <span className="mt-auto pt-2 font-mono text-[12.5px] font-semibold text-copper sm:text-[13.5px] md:text-[14.5px]">
                    {formatBRL(item.price)}
                  </span>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="col-span-full py-10 text-center text-sm text-ink-soft">
                Nenhum item nesta categoria ainda.
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
