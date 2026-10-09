// Hand-rolled SVG bar chart — the project has no charting library, and a
// single bar series doesn't justify pulling one in just for this.
export default function RevenueChart({ data }: { data: { date: string; revenue: number }[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-ink-soft">Sem faturamento registrado neste período.</p>
  }

  const max = Math.max(...data.map((d) => d.revenue), 1)
  const height = 120
  const barWidth = 100 / data.length
  const labelEvery = Math.max(1, Math.ceil(data.length / 8))

  return (
    <div>
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="h-32 w-full overflow-visible"
      >
        {data.map((d, i) => {
          const barHeight = Math.max(1, (d.revenue / max) * (height - 6))
          const x = i * barWidth
          return (
            <rect
              key={d.date}
              x={x + barWidth * 0.18}
              y={height - barHeight}
              width={Math.max(0.5, barWidth * 0.64)}
              height={barHeight}
              rx={1}
              className="fill-current text-accent"
            />
          )
        })}
      </svg>
      <div className="mt-1.5 flex text-[10px] text-ink-soft">
        {data.map((d, i) => (
          <div key={d.date} style={{ width: `${barWidth}%` }} className="truncate text-center">
            {i % labelEvery === 0
              ? new Date(`${d.date}T00:00:00`).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                })
              : ''}
          </div>
        ))}
      </div>
    </div>
  )
}
