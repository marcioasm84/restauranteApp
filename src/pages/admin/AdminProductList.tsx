import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BarChart3, LogOut, Pencil, Plus, Trash2 } from 'lucide-react'
import Logo from '../../components/Logo'
import DishImage from '../../components/DishImage'
import { useMenuStore } from '../../store/useMenuStore'
import { formatBRL } from '../../lib/format'
import { clearToken } from '../../lib/auth'

export default function AdminProductList() {
  const navigate = useNavigate()
  const items = useMenuStore((s) => s.items)
  const deleteMenuItem = useMenuStore((s) => s.deleteMenuItem)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const handleLogout = () => {
    clearToken()
    navigate('/login', { replace: true })
  }

  const handleDelete = (id: string) => {
    if (confirmId === id) {
      deleteMenuItem(id)
      setConfirmId(null)
    } else {
      setConfirmId(id)
    }
  }

  const sorted = [...items].sort((a, b) => a.category.localeCompare(b.category))

  return (
    <div className="mx-auto flex min-h-full max-w-5xl flex-col px-5 py-6 md:px-8 md:py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Logo size="sm" to={null} />
          <h1 className="mt-1.5 font-display text-xl font-semibold text-ink md:text-2xl">
            Cardápio — Administração
          </h1>
          <p className="mt-0.5 text-[12.5px] text-ink-soft">
            {items.length} {items.length === 1 ? 'produto cadastrado' : 'produtos cadastrados'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/admin/analytics"
            className="flex min-h-11 items-center gap-1.5 rounded-full border border-border px-4 text-[13px] font-semibold text-ink-soft hover:text-ink"
          >
            <BarChart3 size={15} /> Relatórios
          </Link>
          <Link
            to="/admin/novo"
            className="flex min-h-11 items-center gap-1.5 rounded-full bg-accent px-4 text-[13px] font-semibold text-white hover:bg-accent/90"
          >
            <Plus size={16} /> Novo produto
          </Link>
          <button
            onClick={handleLogout}
            className="flex min-h-11 items-center gap-1.5 rounded-full border border-border px-4 text-[13px] font-semibold text-ink-soft hover:text-ink"
          >
            <LogOut size={15} /> Sair
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-2.5">
        {sorted.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-3 sm:flex-row sm:items-center sm:gap-3.5"
          >
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 flex-none overflow-hidden rounded-xl">
                <DishImage src={item.image} alt={item.name} className="h-full w-full" />
              </div>
              <div className="min-w-0 flex-1 sm:hidden">
                <span className="block truncate font-display text-[15px] font-medium text-ink">
                  {item.name}
                </span>
                <span className="mt-1 inline-block rounded-full bg-surface-alt px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                  {item.category}
                </span>
              </div>
              <span className="ml-auto flex-none font-mono text-[13.5px] font-semibold text-copper sm:hidden">
                {formatBRL(item.price)}
              </span>
            </div>

            <p className="text-[12.5px] text-ink-soft sm:hidden">{item.description}</p>

            <div className="hidden min-w-0 flex-1 sm:block">
              <div className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 truncate font-display text-[15px] font-medium text-ink">
                  {item.name}
                </span>
                <span className="flex-none rounded-full bg-surface-alt px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-soft">
                  {item.category}
                </span>
              </div>
              <p className="truncate text-[12.5px] text-ink-soft">{item.description}</p>
            </div>

            <div className="flex items-center justify-between gap-2 sm:contents">
              <span className="hidden flex-none font-mono text-[13.5px] font-semibold text-copper sm:block">
                {formatBRL(item.price)}
              </span>
              <div className="flex flex-none items-center gap-1.5">
                <Link
                  to={`/admin/${item.id}/editar`}
                  aria-label={`Editar ${item.name}`}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-ink-soft hover:text-ink"
                >
                  <Pencil size={15} />
                </Link>
                <button
                  onClick={() => handleDelete(item.id)}
                  aria-label={`Excluir ${item.name}`}
                  className={`flex h-10 items-center justify-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold transition ${
                    confirmId === item.id
                      ? 'border-danger bg-danger/10 text-danger'
                      : 'border-border text-ink-soft hover:text-ink'
                  }`}
                >
                  <Trash2 size={15} />
                  {confirmId === item.id && 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        ))}

        {items.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-ink-soft">
            Nenhum produto cadastrado ainda.
          </p>
        )}
      </div>
    </div>
  )
}
