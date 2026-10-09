import { Link, useNavigate } from 'react-router-dom'
import { ChefHat, LayoutGrid, LogOut } from 'lucide-react'
import { useRestaurantStore } from '../../store/useRestaurantStore'
import TableCard from '../../components/TableCard'
import Logo from '../../components/Logo'
import { SHELL_WIDTH } from '../../lib/layout'
import { clearToken, getDisplayName } from '../../lib/auth'

export default function TableMap() {
  const navigate = useNavigate()
  const tables = useRestaurantStore((s) => s.tables)
  const orders = useRestaurantStore((s) => s.orders)
  const displayName = getDisplayName()

  const handleLogout = () => {
    clearToken()
    navigate('/login', { replace: true })
  }

  const alerts = tables.filter((t) => t.callingWaiter || t.requestingBill)

  return (
    <div className={`mx-auto flex min-h-full w-full ${SHELL_WIDTH} flex-col px-5 py-6 md:px-8 md:py-8`}>
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3 md:mb-7">
        <div>
          <Logo size="sm" />
          <h1 className="mt-1.5 flex items-center gap-2 font-display text-2xl font-semibold text-ink md:text-3xl">
            <LayoutGrid size={22} className="text-accent" /> Mapa de mesas
          </h1>
          {displayName && <p className="mt-0.5 text-[12.5px] text-ink-soft">Olá, {displayName}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/cozinha"
            className="flex min-h-11 items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-[12.5px] font-semibold text-ink-soft hover:text-ink"
          >
            <ChefHat size={15} /> Ver cozinha
          </Link>
          <button
            onClick={handleLogout}
            className="flex min-h-11 items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-[12.5px] font-semibold text-ink-soft hover:text-ink"
          >
            <LogOut size={15} /> Sair
          </button>
        </div>
      </header>

      {alerts.length > 0 && (
        <div className="mb-5 flex flex-col gap-2 rounded-2xl border border-copper bg-copper-soft p-3.5">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-copper">
            Precisa de atenção
          </span>
          <div className="flex flex-wrap gap-2">
            {alerts.map((t) => (
              <button
                key={t.id}
                onClick={() => navigate(`/garcom/${t.id}`)}
                className="rounded-full bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-copper shadow-sm"
              >
                Mesa {t.number} · {t.callingWaiter ? 'chamando' : 'pediu a conta'}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 md:gap-4 lg:grid-cols-6 xl:grid-cols-8">
        {tables.map((table) => (
          <TableCard
            key={table.id}
            table={table}
            orderCount={orders.filter((o) => o.tableId === table.id).length}
            onClick={() => navigate(`/garcom/${table.id}`)}
          />
        ))}
      </div>
    </div>
  )
}
