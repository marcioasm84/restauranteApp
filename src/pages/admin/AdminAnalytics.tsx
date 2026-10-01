import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, DollarSign, Receipt, Star, TrendingUp, UtensilsCrossed } from 'lucide-react'
import Logo from '../../components/Logo'
import { fetchAnalytics } from '../../lib/api'
import { getToken } from '../../lib/auth'
import { formatBRL } from '../../lib/format'
import type { AnalyticsSummary } from '../../types'

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof DollarSign
  label: string
  value: string
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
        <Icon size={17} />
      </span>
      <span className="font-mono text-2xl font-semibold tabular-nums text-ink">{value}</span>
      <span className="text-[12px] text-ink-soft">{label}</span>
    </div>
  )
}

export default function AdminAnalytics() {
  const [data, setData] = useState<AnalyticsSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = getToken()
    if (!token) return

    let cancelled = false
    const load = () => {
      fetchAnalytics(token)
        .then((summary) => {
          if (!cancelled) setData(summary)
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : 'Erro ao carregar')
        })
    }
    load()
    const id = setInterval(load, 30000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return (
    <div className="mx-auto flex min-h-full max-w-5xl flex-col px-5 py-6 md:px-8 md:py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Logo size="sm" to={null} />
          <h1 className="mt-1.5 font-display text-xl font-semibold text-ink md:text-2xl">
            Relatórios
          </h1>
          <p className="mt-0.5 text-[12.5px] text-ink-soft">Visão geral do desempenho do dia</p>
        </div>
        <Link
          to="/admin"
          className="flex min-h-11 items-center gap-1.5 rounded-full border border-border px-4 text-[13px] font-semibold text-ink-soft hover:text-ink"
        >
          <UtensilsCrossed size={15} /> Ver cardápio
        </Link>
      </header>

      {error && (
        <p className="mb-4 rounded-xl bg-copper-soft px-4 py-3 text-[13px] font-medium text-copper">
          {error}
        </p>
      )}

      {!data && !error && <p className="text-sm text-ink-soft">Carregando…</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-5">
            <StatTile icon={DollarSign} label="Faturamento hoje" value={formatBRL(data.todayRevenue)} />
            <StatTile icon={Receipt} label="Contas fechadas hoje" value={String(data.todayBills)} />
            <StatTile
              icon={TrendingUp}
              label="Ticket médio hoje"
              value={formatBRL(data.averageTicket)}
            />
            <StatTile
              icon={Clock}
              label="Tempo médio de preparo"
              value={data.averagePrepMinutes != null ? `${data.averagePrepMinutes.toFixed(0)} min` : '—'}
            />
            <StatTile
              icon={Star}
              label={`Avaliação média (${data.reviewCount})`}
              value={data.averageRating != null ? data.averageRating.toFixed(1) : '—'}
            />
          </div>

          <div className="mt-6 rounded-2xl border border-border bg-surface p-5 md:p-6">
            <h2 className="font-display text-lg font-medium text-ink">Pratos mais pedidos</h2>
            {data.topDishes.length === 0 ? (
              <p className="mt-3 text-sm text-ink-soft">
                Ainda não há contas fechadas para gerar esse ranking.
              </p>
            ) : (
              <ul className="mt-4 flex flex-col divide-y divide-border">
                {data.topDishes.map((dish, i) => (
                  <li key={dish.name} className="flex items-center gap-3 py-3">
                    <span className="w-6 flex-none font-mono text-[13px] font-semibold text-ink-soft">
                      {i + 1}º
                    </span>
                    <span className="flex-1 truncate text-[14px] font-medium text-ink">
                      {dish.name}
                    </span>
                    <span className="flex-none font-mono text-[12.5px] text-ink-soft">
                      {dish.quantity}x
                    </span>
                    <span className="flex-none font-mono text-[13.5px] font-semibold text-copper">
                      {formatBRL(dish.revenue)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
