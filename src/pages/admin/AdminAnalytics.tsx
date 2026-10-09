import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Clock,
  Download,
  Receipt,
  Star,
  TrendingDown,
  TrendingUp,
  Users,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react'
import Logo from '../../components/Logo'
import RevenueChart from '../../components/RevenueChart'
import { exportAnalyticsCsv, fetchAnalytics } from '../../lib/api'
import { getToken } from '../../lib/auth'
import { formatBRL } from '../../lib/format'
import type { AnalyticsSummary } from '../../types'

type PeriodKey = 'today' | '7d' | '30d' | 'month' | 'custom'

const PERIOD_LABEL: Record<PeriodKey, string> = {
  today: 'Hoje',
  '7d': '7 dias',
  '30d': '30 dias',
  month: 'Este mês',
  custom: 'Personalizado',
}

function toDateInputValue(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10)
}

function rangeForPeriod(
  key: PeriodKey,
  customFrom: string,
  customTo: string,
): { from: number; to: number } {
  const now = new Date()
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)

  if (key === 'today') return { from: startOfToday.getTime(), to: now.getTime() }
  if (key === '7d') {
    const from = new Date(startOfToday)
    from.setDate(from.getDate() - 6)
    return { from: from.getTime(), to: now.getTime() }
  }
  if (key === '30d') {
    const from = new Date(startOfToday)
    from.setDate(from.getDate() - 29)
    return { from: from.getTime(), to: now.getTime() }
  }
  if (key === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
    return { from: from.getTime(), to: now.getTime() }
  }
  // custom
  const from = customFrom ? new Date(`${customFrom}T00:00:00`).getTime() : startOfToday.getTime()
  const to = customTo ? new Date(`${customTo}T23:59:59`).getTime() : now.getTime()
  return { from, to }
}

function StatTile({
  icon: Icon,
  label,
  value,
  badge,
}: {
  icon: typeof Wallet
  label: string
  value: string
  badge?: { text: string; positive: boolean }
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <Icon size={17} />
        </span>
        {badge && (
          <span
            className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              badge.positive ? 'bg-accent-soft text-accent' : 'bg-danger/10 text-danger'
            }`}
          >
            {badge.positive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {badge.text}
          </span>
        )}
      </div>
      <span className="font-mono text-2xl font-semibold tabular-nums text-ink">{value}</span>
      <span className="text-[12px] text-ink-soft">{label}</span>
    </div>
  )
}

export default function AdminAnalytics() {
  const token = getToken() ?? ''
  const [period, setPeriod] = useState<PeriodKey>('today')
  const [customFrom, setCustomFrom] = useState(toDateInputValue(Date.now()))
  const [customTo, setCustomTo] = useState(toDateInputValue(Date.now()))
  const [data, setData] = useState<AnalyticsSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const range = useMemo(() => rangeForPeriod(period, customFrom, customTo), [period, customFrom, customTo])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setData(null)
    setError(null)
    const load = () => {
      fetchAnalytics(token, range)
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
  }, [token, range])

  const handleExport = async () => {
    setExporting(true)
    try {
      await exportAnalyticsCsv(token, range, `relatorio-${toDateInputValue(range.from)}-a-${toDateInputValue(range.to)}.csv`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível exportar.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-5xl flex-col px-5 py-6 md:px-8 md:py-8">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Logo size="sm" to={null} />
          <h1 className="mt-1.5 font-display text-xl font-semibold text-ink md:text-2xl">
            Relatórios
          </h1>
          <p className="mt-0.5 text-[12.5px] text-ink-soft">
            {PERIOD_LABEL[period]} · {toDateInputValue(range.from)} a {toDateInputValue(range.to)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/admin/equipe"
            className="flex min-h-11 items-center gap-1.5 rounded-full border border-border px-4 text-[13px] font-semibold text-ink-soft hover:text-ink"
          >
            <Users size={15} /> Equipe
          </Link>
          <Link
            to="/admin"
            className="flex min-h-11 items-center gap-1.5 rounded-full border border-border px-4 text-[13px] font-semibold text-ink-soft hover:text-ink"
          >
            <UtensilsCrossed size={15} /> Ver cardápio
          </Link>
          <button
            onClick={handleExport}
            disabled={exporting || !data}
            className="flex min-h-11 items-center gap-1.5 rounded-full bg-accent px-4 text-[13px] font-semibold text-white hover:bg-accent/90 disabled:opacity-60"
          >
            <Download size={15} /> {exporting ? 'Exportando…' : 'Exportar CSV'}
          </button>
        </div>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {(['today', '7d', '30d', 'month', 'custom'] as PeriodKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            className={`flex min-h-9 items-center rounded-full border px-3.5 text-[12.5px] font-semibold transition ${
              period === key
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-border text-ink-soft hover:text-ink'
            }`}
          >
            {PERIOD_LABEL[key]}
          </button>
        ))}
        {period === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-xl border border-border bg-bg px-3 py-2 text-[12.5px] text-ink focus:border-accent focus:outline-none"
            />
            <span className="text-[12.5px] text-ink-soft">até</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-xl border border-border bg-bg px-3 py-2 text-[12.5px] text-ink focus:border-accent focus:outline-none"
            />
          </div>
        )}
      </div>

      {error && (
        <p className="mb-4 rounded-xl bg-copper-soft px-4 py-3 text-[13px] font-medium text-copper">
          {error}
        </p>
      )}

      {!data && !error && <p className="text-sm text-ink-soft">Carregando…</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-5">
            <StatTile
              icon={Wallet}
              label="Faturamento no período"
              value={formatBRL(data.periodRevenue)}
              badge={
                data.revenueChangePct != null
                  ? {
                      text: `${data.revenueChangePct >= 0 ? '+' : ''}${data.revenueChangePct.toFixed(0)}%`,
                      positive: data.revenueChangePct >= 0,
                    }
                  : undefined
              }
            />
            <StatTile icon={Receipt} label="Contas fechadas" value={String(data.periodBills)} />
            <StatTile icon={TrendingUp} label="Ticket médio" value={formatBRL(data.averageTicket)} />
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
            <h2 className="font-display text-lg font-medium text-ink">Faturamento por dia</h2>
            <div className="mt-4">
              <RevenueChart data={data.dailyRevenue} />
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-surface p-5 md:p-6">
              <h2 className="font-display text-base font-medium text-ink">Por categoria</h2>
              {data.byCategory.length === 0 ? (
                <p className="mt-3 text-sm text-ink-soft">Sem vendas neste período.</p>
              ) : (
                <ul className="mt-3 flex flex-col divide-y divide-border">
                  {data.byCategory.map((c) => (
                    <li key={c.category} className="flex items-center justify-between py-2.5 text-[13px]">
                      <span className="text-ink">{c.category}</span>
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-[12px] text-ink-soft">{c.quantity}x</span>
                        <span className="font-mono font-semibold text-copper">{formatBRL(c.revenue)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-surface p-5 md:p-6">
              <h2 className="font-display text-base font-medium text-ink">Por forma de pagamento</h2>
              {data.byPaymentMethod.length === 0 ? (
                <p className="mt-3 text-sm text-ink-soft">Sem vendas neste período.</p>
              ) : (
                <ul className="mt-3 flex flex-col divide-y divide-border">
                  {data.byPaymentMethod.map((p) => (
                    <li key={p.method} className="flex items-center justify-between py-2.5 text-[13px]">
                      <span className="capitalize text-ink">{p.method}</span>
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-[12px] text-ink-soft">{p.count}x</span>
                        <span className="font-mono font-semibold text-copper">{formatBRL(p.revenue)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-surface p-5 md:p-6">
            <h2 className="font-display text-base font-medium text-ink">Vendas por garçom</h2>
            {data.byStaff.length === 0 ? (
              <p className="mt-3 text-sm text-ink-soft">Sem contas fechadas neste período.</p>
            ) : (
              <ul className="mt-3 flex flex-col divide-y divide-border">
                {data.byStaff.map((s) => (
                  <li key={s.staffId ?? 'none'} className="flex items-center justify-between py-2.5 text-[13px]">
                    <span className="text-ink">{s.staffName}</span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-[12px] text-ink-soft">{s.bills} contas</span>
                      <span className="font-mono font-semibold text-copper">{formatBRL(s.revenue)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-surface p-5 md:p-6">
            <h2 className="font-display text-lg font-medium text-ink">Pratos mais pedidos</h2>
            {data.topDishes.length === 0 ? (
              <p className="mt-3 text-sm text-ink-soft">
                Ainda não há contas fechadas neste período para gerar esse ranking.
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
