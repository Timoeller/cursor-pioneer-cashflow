import { Fragment, useState } from 'react'
import { yearlyTotals } from '../model/cashflow'
import type { MonthRow, PlanState } from '../model/types'
import { downloadFile } from '../storage/local'
import { money, monthLabel } from '../ui/format'

interface Props {
  rows: MonthRow[]
  state: PlanState
}

function toCsv(rows: MonthRow[], state: PlanState): string {
  const header = [
    'Month',
    'Label',
    'Opening balance',
    'Founder cash',
    'Revenue',
    'Grant',
    'Total in',
    ...state.employees.map((e) => `Personnel: ${e.name}`),
    'Personnel total',
    'Fundable personnel',
    'Grant on personnel',
    'Additional cost allowance',
    'Grant on additional costs',
    'Grant covered',
    'Grant left',
    'Founders finance',
    ...state.costs.map((c) => `Cost: ${c.name}`),
    'Other costs total',
    'Total out',
    'Net cash flow',
    'Closing balance',
  ]
  const r2 = (n: number) => n.toFixed(2)
  const lines = rows.map((r) => [
    r.month,
    monthLabel(r.month, state.settings.foundingMonth),
    r2(r.openingBalance),
    r2(r.founderIn),
    r2(r.revenueIn),
    r2(r.grantIn),
    r2(r.totalIn),
    ...state.employees.map((e) => r2(r.personnelByEmployee[e.id] ?? 0)),
    r2(r.personnel),
    r2(r.fundablePersonnel),
    r2(r.grantOnPersonnel),
    r2(r.additionalAllowance),
    r2(r.grantOnAdditional),
    r2(r.grantCovered),
    r2(r.grantRemaining),
    r2(r.founderBorne),
    ...state.costs.map((c) => r2(r.costs[c.id] ?? 0)),
    r2(r.otherCosts),
    r2(r.totalOut),
    r2(r.net),
    r2(r.closingBalance),
  ])
  const esc = (v: string | number) => {
    const s = String(v)
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [header, ...lines].map((l) => l.map(esc).join(',')).join('\n')
}

export function MonthlyTable({ rows, state }: Props) {
  const [detail, setDetail] = useState(false)
  const cur = state.settings.currency
  const m = (v: number) => money(v, cur)
  const years = yearlyTotals(rows)
  const detailCols = detail ? [...state.employees.map((e) => ({ id: e.id, name: e.name, kind: 'e' as const })), ...state.costs.map((c) => ({ id: c.id, name: c.name, kind: 'c' as const }))] : []

  return (
    <section className="card">
      <header className="card-head">
        <div>
          <h2>Monthly cash flow</h2>
          <p className="muted">Yearly subtotals are shown after every 12 months.</p>
        </div>
        <div className="inline">
          <label className="toggle">
            <input type="checkbox" checked={detail} onChange={(e) => setDetail(e.target.checked)} /> Show every cost line
          </label>
          <button type="button" className="btn" onClick={() => downloadFile('cashflow.csv', toCsv(rows, state), 'text/csv')}>
            Export CSV
          </button>
        </div>
      </header>
      <div className="table-wrap tall">
        <table className="data-table">
          <thead>
            <tr>
              <th>Month</th>
              <th className="r">Opening</th>
              <th className="r">Founder cash</th>
              <th className="r">Revenue</th>
              <th className="r">Grant</th>
              <th className="r">Total in</th>
              <th className="r">Personnel</th>
              <th className="r">Other costs</th>
              <th className="r">Grant covers</th>
              <th className="r">Grant left</th>
              <th className="r">Founders finance</th>
              {detailCols.map((c) => (
                <th key={c.id} className="r detail">{c.name}</th>
              ))}
              <th className="r">Total out</th>
              <th className="r">Net</th>
              <th className="r">Closing balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const year = years[Math.ceil(r.month / 12) - 1]
              const endOfYear = r.month === year.toMonth
              return (
                <Fragment key={r.month}>
                  <tr className={r.closingBalance < 0 ? 'neg' : ''}>
                    <td>{monthLabel(r.month, state.settings.foundingMonth)}</td>
                    <td className="r mono">{m(r.openingBalance)}</td>
                    <td className="r mono">{r.founderIn ? m(r.founderIn) : ''}</td>
                    <td className="r mono">{r.revenueIn ? m(r.revenueIn) : ''}</td>
                    <td className="r mono">{r.grantIn ? m(r.grantIn) : ''}</td>
                    <td className="r mono">{m(r.totalIn)}</td>
                    <td className="r mono">{m(r.personnel)}</td>
                    <td className="r mono">{m(r.otherCosts)}</td>
                    <td className="r mono">{m(r.grantCovered)}</td>
                    <td className="r mono">{m(r.grantRemaining)}</td>
                    <td className="r mono">{m(r.founderBorne)}</td>
                    {detailCols.map((c) => (
                      <td key={c.id} className="r mono detail">
                        {m(c.kind === 'e' ? r.personnelByEmployee[c.id] ?? 0 : r.costs[c.id] ?? 0)}
                      </td>
                    ))}
                    <td className="r mono">{m(r.totalOut)}</td>
                    <td className={`r mono ${r.net < 0 ? 'bad-text' : 'good-text'}`}>{m(r.net)}</td>
                    <td className="r mono strong">{m(r.closingBalance)}</td>
                  </tr>
                  {endOfYear && (
                    <tr className="year-row">
                      <td>Year {year.year} (M{year.fromMonth}–M{year.toMonth})</td>
                      <td />
                      <td className="r mono">{m(year.founderIn)}</td>
                      <td className="r mono">{m(year.revenueIn)}</td>
                      <td className="r mono">{m(year.grantIn)}</td>
                      <td className="r mono">{m(year.totalIn)}</td>
                      <td className="r mono">{m(year.personnel)}</td>
                      <td className="r mono">{m(year.otherCosts)}</td>
                      <td className="r mono">{m(year.grantCovered)}</td>
                      <td className="r mono">{m(year.grantRemaining)}</td>
                      <td className="r mono">{m(year.founderBorne)}</td>
                      {detailCols.map((c) => (
                        <td key={c.id} className="detail" />
                      ))}
                      <td className="r mono">{m(year.totalOut)}</td>
                      <td className={`r mono ${year.net < 0 ? 'bad-text' : 'good-text'}`}>{m(year.net)}</td>
                      <td className="r mono">{m(year.closingBalance)}</td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
