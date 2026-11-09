import { Area, Bar, CartesianGrid, ComposedChart, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { MonthRow, Settings } from '../model/types'
import { money, monthLabel } from '../ui/format'

interface Props {
  rows: MonthRow[]
  settings: Settings
}

export function BalanceChart({ rows, settings }: Props) {
  const cur = settings.currency
  const data = rows.map((r) => ({
    label: monthLabel(r.month, settings.foundingMonth, true),
    month: r.month,
    balance: Math.round(r.closingBalance),
    founder: Math.round(r.founderIn),
    grant: Math.round(r.grantIn),
    loan: Math.round(r.loanIn),
    out: -Math.round(r.totalOut),
  }))
  const max = Math.max(0, ...data.map((d) => d.balance))
  const min = Math.min(0, ...data.map((d) => d.balance))
  // where y=0 sits within the balance range, for the green/red split
  const zero = max - min > 0 ? max / (max - min) : 1

  return (
    <section className="card">
      <header className="card-head">
        <div>
          <h2>Cash balance</h2>
          <p className="muted">Closing balance per month (line), money in and out (bars).</p>
        </div>
      </header>
      <div className="chart">
        <ResponsiveContainer width="100%" height={360}>
          <ComposedChart data={data} margin={{ top: 10, right: 16, left: 8, bottom: 0 }} stackOffset="sign">
            <defs>
              <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset={0} stopColor="var(--good)" stopOpacity={0.35} />
                <stop offset={zero} stopColor="var(--good)" stopOpacity={0.05} />
                <stop offset={zero} stopColor="var(--bad)" stopOpacity={0.05} />
                <stop offset={1} stopColor="var(--bad)" stopOpacity={0.35} />
              </linearGradient>
              <linearGradient id="balanceStroke" x1="0" y1="0" x2="0" y2="1">
                <stop offset={zero} stopColor="var(--good)" />
                <stop offset={zero} stopColor="var(--bad)" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--muted)' }} interval="preserveStartEnd" minTickGap={16} />
            <YAxis tickFormatter={(v: number) => money(v, cur, true)} tick={{ fontSize: 12, fill: 'var(--muted)' }} width={80} />
            <Tooltip
              formatter={(v, name) => [money(Math.abs(Number(v)), cur), String(name)]}
              labelFormatter={(_, p) => (p?.[0] ? monthLabel(p[0].payload.month, settings.foundingMonth) : '')}
              contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)' }}
            />
            <Legend />
            <ReferenceLine y={0} stroke="var(--text)" strokeOpacity={0.5} />
            <Bar dataKey="founder" name="Founder cash" stackId="flow" fill="var(--founder)" />
            <Bar dataKey="grant" name="Grant (Zuschuss)" stackId="flow" fill="var(--grant)" />
            <Bar dataKey="loan" name="Loan (Darlehen)" stackId="flow" fill="var(--loan)" />
            <Bar dataKey="out" name="Costs" stackId="flow" fill="var(--cost)" />
            <Area type="monotone" dataKey="balance" name="Balance" stroke="url(#balanceStroke)" strokeWidth={2.5} fill="url(#balanceFill)" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
