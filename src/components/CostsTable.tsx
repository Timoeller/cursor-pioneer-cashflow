import type { CostItem } from '../model/types'
import { newId } from '../storage/local'
import { money } from '../ui/format'
import { removeRow, updateRow } from '../ui/rows'
import { NumberField, RemoveButton, TextField } from './fields'

interface Props {
  costs: CostItem[]
  currency: string
  onChange: (costs: CostItem[]) => void
}

export function CostsTable({ costs, currency, onChange }: Props) {
  const set = (id: string, patch: Partial<CostItem>) => onChange(updateRow(costs, id, patch))
  const monthly = (c: CostItem) => c.monthlyAmount * c.multiplier
  const recurringPerMonth = costs.filter((c) => c.recurring).reduce((s, c) => s + monthly(c), 0)
  const oneOffTotal = costs.filter((c) => !c.recurring).reduce((s, c) => s + monthly(c), 0)

  return (
    <section className="card">
      <header className="card-head">
        <div>
          <h2>Costs</h2>
          <p className="muted">Imported from your spreadsheet. One-off costs are booked once in their start month.</p>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() =>
            onChange([
              ...costs,
              { id: newId('c'), name: 'New cost', monthlyAmount: 0, recurring: true, multiplier: 1, startMonth: 1, endMonth: null, comment: '' },
            ])
          }
        >
          + Add cost
        </button>
      </header>
      <div className="table-wrap">
        <table className="edit-table">
          <thead>
            <tr>
              <th>Type</th>
              <th className="r">Amount</th>
              <th>Recurring</th>
              <th className="r">Multiplier</th>
              <th className="r">Start month</th>
              <th className="r">End month</th>
              <th className="r">Per month</th>
              <th className="r">Per year</th>
              <th>Comment</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {costs.map((c) => (
              <tr key={c.id}>
                <td><TextField value={c.name} onChange={(name) => set(c.id, { name })} ariaLabel="Cost name" /></td>
                <td><NumberField value={c.monthlyAmount} min={0} onChange={(v) => set(c.id, { monthlyAmount: v ?? 0 })} ariaLabel="Amount" /></td>
                <td>
                  <select value={c.recurring ? 'yes' : 'no'} onChange={(e) => set(c.id, { recurring: e.target.value === 'yes' })} aria-label="Recurring">
                    <option value="yes">monthly</option>
                    <option value="no">one-off</option>
                  </select>
                </td>
                <td><NumberField className="short" value={c.multiplier} min={0} onChange={(v) => set(c.id, { multiplier: v ?? 0 })} ariaLabel="Multiplier" /></td>
                <td><NumberField className="short" value={c.startMonth} min={1} step={1} onChange={(v) => set(c.id, { startMonth: Math.max(1, Math.round(v ?? 1)) })} ariaLabel="Start month" /></td>
                <td>
                  {c.recurring ? (
                    <NumberField className="short" value={c.endMonth} min={1} step={1} allowEmpty placeholder="∞" onChange={(v) => set(c.id, { endMonth: v == null ? null : Math.round(v) })} ariaLabel="End month" />
                  ) : (
                    <span className="muted">-</span>
                  )}
                </td>
                <td className="r mono">{money(monthly(c), currency)}</td>
                <td className="r mono">{money(c.recurring ? monthly(c) * 12 : monthly(c), currency)}</td>
                <td><TextField className="wide" value={c.comment} onChange={(comment) => set(c.id, { comment })} ariaLabel="Comment" /></td>
                <td><RemoveButton label={`Remove ${c.name}`} onClick={() => onChange(removeRow(costs, c.id))} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={6}>Recurring per month / one-off total</td>
              <td className="r mono">{money(recurringPerMonth, currency)}</td>
              <td className="r mono">{money(recurringPerMonth * 12 + oneOffTotal, currency)}</td>
              <td colSpan={2} className="muted">one-off: {money(oneOffTotal, currency)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}
