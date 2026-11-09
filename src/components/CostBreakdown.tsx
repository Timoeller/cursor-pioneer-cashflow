import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { MonthRow, PlanState } from '../model/types'
import { money, pct } from '../ui/format'

const COLORS = ['#4f46e5', '#0ea5e9', '#14b8a6', '#f59e0b', '#ef4444', '#a855f7', '#ec4899', '#84cc16', '#64748b']

interface Props {
  rows: MonthRow[]
  state: PlanState
}

export function CostBreakdown({ rows, state }: Props) {
  const cur = state.settings.currency
  const items: { name: string; value: number }[] = [
    { name: 'Personnel', value: rows.reduce((s, r) => s + r.personnel, 0) },
    ...state.costs.map((c) => ({ name: c.name || 'Unnamed', value: rows.reduce((s, r) => s + (r.costs[c.id] ?? 0), 0) })),
  ]
    .filter((i) => i.value > 0)
    .sort((a, b) => b.value - a.value)

  const top = items.slice(0, 8)
  const rest = items.slice(8).reduce((s, i) => s + i.value, 0)
  const data = rest > 0 ? [...top, { name: 'Other', value: rest }] : top
  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <section className="card">
      <header className="card-head">
        <div>
          <h2>Where the money goes</h2>
          <p className="muted">Costs over the whole planning horizon.</p>
        </div>
      </header>
      {total === 0 ? (
        <p className="muted">No costs yet.</p>
      ) : (
        <div className="breakdown">
          <div className="chart">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={110} paddingAngle={1}>
                  {data.map((d, i) => (
                    <Cell key={d.name} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => money(Number(v), cur)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="legend-list">
            {data.map((d, i) => (
              <li key={d.name}>
                <span className="swatch" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="legend-name">{d.name}</span>
                <span className="mono">{money(d.value, cur)}</span>
                <span className="muted mono">{pct(d.value / total)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
