import type { Summary } from '../model/cashflow'
import type { Settings } from '../model/types'
import { deCount } from '../ui/de'
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
      ? horizon === 1
        ? 'Für den ganzen Monat finanziert'
        : `Für alle ${horizon} Monate finanziert`
      : `Das Geld ist aufgebraucht in ${monthLabel(s.firstNegativeMonth, settings.foundingMonth)}`

  return (
    <div className="stats">
      <Stat
        label="Reichweite"
        value={s.firstNegativeMonth == null ? `${horizon}+ Monate` : deCount(s.runwayMonths, 'Monat', 'Monate')}
        sub={runwayText}
        tone={s.firstNegativeMonth == null ? 'good' : s.runwayMonths < 6 ? 'bad' : 'warn'}
      />
      <Stat
        label="Niedrigster Stand"
        value={money(s.minBalance, cur)}
        sub={s.minBalanceMonth ? `in ${monthLabel(s.minBalanceMonth, settings.foundingMonth)}` : 'zu Beginn'}
        tone={s.minBalance < 0 ? 'bad' : undefined}
      />
      <Stat label="Stand am Ende" value={money(s.endBalance, cur)} sub={`nach ${deCount(horizon, 'Monat', 'Monaten')}`} tone={s.endBalance < 0 ? 'bad' : undefined} />
      <Stat
        label="Zusätzlich benötigtes Geld"
        value={money(Math.max(0, -s.minBalance), cur)}
        sub="damit der Stand nie unter null fällt"
        tone={s.minBalance < 0 ? 'bad' : 'good'}
      />
      <Stat label="Gesamtkosten" value={money(s.totalOut, cur)} sub={`Personal ${money(s.personnel, cur)} · sonstige ${money(s.otherCosts, cur)}`} />
      <Stat label="Ø monatlicher Verbrauch" value={money(s.avgMonthlyBurn, cur)} sub={`nach Zuflüssen: ${money(s.avgNetBurn, cur)}`} />
      <Stat
        label="Förderung deckt"
        value={money(s.grantCovered, cur)}
        sub={
          s.runsOutMonth == null
            ? `${money(s.grantRemaining, cur)} von ${money(s.grantAmount, cur)} sind nach Monat ${settings.horizonMonths} noch übrig`
            : `aufgebraucht in ${monthLabel(s.runsOutMonth, settings.foundingMonth)} · ${money(s.grantAmount, cur)} insgesamt`
        }
      />
      <Stat
        label="Gründer müssen finanzieren"
        value={money(s.foundersNeed, cur)}
        sub={
          s.revenue > 0
            ? `${money(s.founderBorne, cur)} der Kosten sind nicht gedeckt, der Umsatz deckt ${money(Math.min(s.revenue, s.founderBorne), cur)}`
            : 'Kosten, die die Förderung nicht deckt'
        }
        tone={s.foundersNeed > s.founderTotal ? 'warn' : 'good'}
      />
      <Stat label="Umsatz" value={money(s.revenue, cur)} sub="von Kunden, innerhalb des Planungshorizonts" />
      <Stat
        label="Eingezahltes Gründergeld"
        value={money(s.founderTotal, cur)}
        sub={s.foundersNeed > 0 ? `deckt ${pct(Math.min(1, s.founderTotal / s.foundersNeed))} dessen, was die Gründer finanzieren müssen` : 'durch die Förderung ist nichts weiter nötig'}
      />
    </div>
  )
}
