import type { Summary } from '../model/cashflow'
import type { Settings } from '../model/types'
import { money, monthLabel, pct } from '../ui/format'

interface Props {
  summary: Summary
  settings: Settings
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'bad' | 'warn' }) {
  return (
    <div className={`stat ${tone ?? ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

export function SummaryStats({ summary: s, settings }: Props) {
  const cur = settings.currency
  const horizon = settings.horizonMonths
  const runwayText =
    s.firstNegativeMonth == null
      ? `Funded for all ${horizon} months`
      : `Cash runs out in ${monthLabel(s.firstNegativeMonth, settings.foundingMonth)}`

  return (
    <div className="stats">
      <Stat
        label="Runway"
        value={s.firstNegativeMonth == null ? `${horizon}+ months` : `${s.runwayMonths} ${s.runwayMonths === 1 ? 'month' : 'months'}`}
        sub={runwayText}
        tone={s.firstNegativeMonth == null ? 'good' : s.runwayMonths < 6 ? 'bad' : 'warn'}
      />
      <Stat
        label="Lowest balance"
        value={money(s.minBalance, cur)}
        sub={s.minBalanceMonth ? `in ${monthLabel(s.minBalanceMonth, settings.foundingMonth)}` : 'at start'}
        tone={s.minBalance < 0 ? 'bad' : undefined}
      />
      <Stat label="Balance at end" value={money(s.endBalance, cur)} sub={`after ${horizon} months`} tone={s.endBalance < 0 ? 'bad' : undefined} />
      <Stat
        label="Additional cash needed"
        value={money(Math.max(0, -s.minBalance), cur)}
        sub="to never go below zero"
        tone={s.minBalance < 0 ? 'bad' : 'good'}
      />
      <Stat label="Total costs" value={money(s.totalOut, cur)} sub={`personnel ${money(s.personnel, cur)} · other ${money(s.otherCosts, cur)}`} />
      <Stat label="Avg. monthly burn" value={money(s.avgMonthlyBurn, cur)} sub={`net of inflows: ${money(s.avgNetBurn, cur)}`} />
      <Stat
        label="Grant covers"
        value={money(s.grantCovered, cur)}
        sub={
          s.runsOutMonth == null
            ? `${money(s.grantRemaining, cur)} of ${money(s.grantAmount, cur)} still left after month ${settings.horizonMonths}`
            : `runs out in ${monthLabel(s.runsOutMonth, settings.foundingMonth)} · ${money(s.grantAmount, cur)} in total`
        }
      />
      <Stat
        label="Founders must finance"
        value={money(s.foundersNeed, cur)}
        sub={
          s.revenue > 0
            ? `${money(s.founderBorne, cur)} of costs are not covered, revenue covers ${money(Math.min(s.revenue, s.founderBorne), cur)}`
            : 'costs the grant does not cover'
        }
        tone={s.foundersNeed > s.founderTotal ? 'warn' : 'good'}
      />
      <Stat label="Revenue" value={money(s.revenue, cur)} sub="from customers, within the horizon" />
      <Stat
        label="Founder cash entered"
        value={money(s.founderTotal, cur)}
        sub={s.foundersNeed > 0 ? `covers ${pct(Math.min(1, s.founderTotal / s.foundersNeed))} of what founders must finance` : 'nothing further required by the grant'}
      />
    </div>
  )
}
