import { useState } from 'react'
import { eligiblePersonnelBetween, grantTotal, trancheTotal } from '../model/cashflow'
import type { GrantComponent, PlanState, Tranche } from '../model/types'
import { newId } from '../storage/local'
import { money, monthLabel, pct } from '../ui/format'
import { removeRow, updateRow } from '../ui/rows'
import { NumberField, RemoveButton, TextField } from './fields'

interface Props {
  state: PlanState
  onComponentsChange: (c: GrantComponent[]) => void
  onTranchesChange: (t: Tranche[]) => void
}

export function GrantSection({ state, onComponentsChange, onTranchesChange }: Props) {
  const { grantComponents: components, tranches, settings } = state
  const cur = settings.currency
  const [from, setFrom] = useState(1)
  const [to, setTo] = useState(Math.min(36, settings.horizonMonths))

  const total = grantTotal(state)
  const scheduled = trancheTotal(state)
  const diff = total - scheduled
  const eligible = eligiblePersonnelBetween(state, from, to)
  const setC = (id: string, patch: Partial<GrantComponent>) => onComponentsChange(updateRow(components, id, patch))
  const setT = (id: string, patch: Partial<Tranche>) => onTranchesChange(updateRow(tranches, id, patch))
  const sortedTranches = [...tranches].sort((a, b) => a.month - b.month)
  const lastMonth = sortedTranches.length ? sortedTranches[sortedTranches.length - 1].month : 0

  return (
    <section className="card">
      <header className="card-head">
        <div>
          <h2>Grant funding</h2>
          <p className="muted">Each component: the amount the funding rate applies to, times the rate.</p>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => onComponentsChange([...components, { id: newId('g'), name: 'New component', amount: 0, ratePct: 50 }])}
        >
          + Add component
        </button>
      </header>

      <div className="table-wrap">
        <table className="edit-table">
          <thead>
            <tr>
              <th>Component</th>
              <th className="r">Eligible amount</th>
              <th className="r">Funding rate %</th>
              <th className="r">Grant</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {components.map((g) => (
              <tr key={g.id}>
                <td><TextField value={g.name} onChange={(name) => setC(g.id, { name })} ariaLabel="Component name" /></td>
                <td>
                  <div className="inline">
                    <NumberField value={g.amount} min={0} onChange={(v) => setC(g.id, { amount: v ?? 0 })} ariaLabel="Eligible amount" />
                    <button type="button" className="link-btn" title="Use eligible personnel cost from the helper below" onClick={() => setC(g.id, { amount: Math.round(eligible) })}>
                      use helper
                    </button>
                  </div>
                </td>
                <td><NumberField className="short" value={g.ratePct} min={0} max={100} onChange={(v) => setC(g.id, { ratePct: v ?? 0 })} ariaLabel="Funding rate" /></td>
                <td className="r mono">{money((g.amount * g.ratePct) / 100, cur)}</td>
                <td><RemoveButton label={`Remove ${g.name}`} onClick={() => onComponentsChange(removeRow(components, g.id))} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>Total grant</td>
              <td className="r mono strong">{money(total, cur)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="helper">
        <span>Helper: funding-eligible personnel cost from month</span>
        <NumberField className="short" value={from} min={1} step={1} onChange={(v) => setFrom(Math.max(1, Math.round(v ?? 1)))} ariaLabel="Helper from month" />
        <span>to</span>
        <NumberField className="short" value={to} min={1} step={1} onChange={(v) => setTo(Math.max(1, Math.round(v ?? 1)))} ariaLabel="Helper to month" />
        <span>=</span>
        <strong className="mono">{money(eligible, cur)}</strong>
      </div>

      <div className="subhead">
        <h3>Payout tranches</h3>
        <div className="inline">
          {Math.abs(diff) >= 1 && (
            <button
              type="button"
              className="btn ghost"
              onClick={() => onTranchesChange([...tranches, { id: newId('t'), month: lastMonth + 6 || 1, amount: Math.round(diff) }])}
            >
              + Add remaining {money(diff, cur)}
            </button>
          )}
          <button type="button" className="btn" onClick={() => onTranchesChange([...tranches, { id: newId('t'), month: lastMonth + 6 || 1, amount: 0 }])}>
            + Add tranche
          </button>
        </div>
      </div>
      <div className="table-wrap">
        <table className="edit-table">
          <thead>
            <tr>
              <th className="r">Payout month</th>
              <th />
              <th className="r">Amount</th>
              <th className="r">Share of grant</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sortedTranches.map((t) => (
              <tr key={t.id}>
                <td><NumberField className="short" value={t.month} min={1} step={1} onChange={(v) => setT(t.id, { month: Math.max(1, Math.round(v ?? 1)) })} ariaLabel="Tranche month" /></td>
                <td className="muted">{monthLabel(t.month, settings.foundingMonth)}</td>
                <td><NumberField value={t.amount} min={0} onChange={(v) => setT(t.id, { amount: v ?? 0 })} ariaLabel="Tranche amount" /></td>
                <td className="r mono">{total > 0 ? pct(t.amount / total, 1) : '-'}</td>
                <td><RemoveButton label="Remove tranche" onClick={() => onTranchesChange(removeRow(tranches, t.id))} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>Scheduled</td>
              <td className="r mono strong">{money(scheduled, cur)}</td>
              <td className="r mono">{total > 0 ? pct(scheduled / total, 1) : '-'}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      {Math.abs(diff) >= 1 && (
        <p className={`notice ${diff < 0 ? 'bad' : 'warn'}`}>
          {diff > 0
            ? `Tranches cover ${money(scheduled, cur)} of the ${money(total, cur)} grant: ${money(diff, cur)} is not scheduled yet.`
            : `Tranches exceed the grant by ${money(-diff, cur)}.`}
        </p>
      )}
      {tranches.some((t) => t.month > settings.horizonMonths) && (
        <p className="notice warn">Some tranches arrive after the planning horizon and are not included in the cash flow.</p>
      )}
    </section>
  )
}
