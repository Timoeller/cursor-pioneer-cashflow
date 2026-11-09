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
  const f = s.funding
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
        label="Grant (Zuschuss)"
        value={money(f.grant, cur)}
        sub={`${money(s.grantReceived, cur)} received within horizon`}
      />
      <Stat
        label="Loan (Darlehen)"
        value={money(f.loan, cur)}
        sub={`${money(s.loanReceived, cur)} received within horizon · must be repaid`}
      />
      <Stat
        label="Own contribution required"
        value={money(f.own, cur)}
        sub={
          f.own > 0
            ? `${pct(f.own / (f.eligible || 1))} of eligible costs · founder cash covers ${pct(Math.min(1, s.founderTotal / f.own))}`
            : 'no own contribution needed'
        }
        tone={f.own > 0 && s.founderTotal < f.own ? 'warn' : undefined}
      />
      <Stat
        label="Funding share of costs"
        value={pct(s.fundingShareOfCosts)}
        sub={`grant + loan received / total costs · funding ${money(f.funding, cur)} on ${money(f.eligible, cur)} eligible`}
      />
      <Stat label="Founder cash" value={money(s.founderTotal, cur)} sub="received within horizon" />
      <Stat
        label="Funding-eligible personnel"
        value={money(s.eligiblePersonnel, cur)}
        sub={s.personnel > 0 ? `${pct(s.eligiblePersonnel / s.personnel)} of personnel cost` : undefined}
      />
    </div>
  )
}
