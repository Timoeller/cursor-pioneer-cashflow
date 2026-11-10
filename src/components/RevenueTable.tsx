import type { RevenueItem, Settings } from '../model/types'
import { newId } from '../storage/local'
import { money } from '../ui/format'
import { removeRow, updateRow } from '../ui/rows'
import { NumberField, RemoveButton, TextField } from './fields'

interface Props {
  revenue: RevenueItem[]
  settings: Settings
  onChange: (revenue: RevenueItem[]) => void
}

export function RevenueTable({ revenue, settings, onChange }: Props) {
  const set = (id: string, patch: Partial<RevenueItem>) => onChange(updateRow(revenue, id, patch))
  const monthly = revenue.filter((r) => r.recurring).reduce((s, r) => s + r.amount, 0)
  const oneOff = revenue.filter((r) => !r.recurring).reduce((s, r) => s + r.amount, 0)

  return (
    <section className="card">
      <header className="card-head">
        <div>
          <h2>Customer revenue</h2>
          <p className="muted">Money from customers. Recurring revenue is booked every month from the start month to the end month. One-time payments are booked once.</p>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => onChange([...revenue, { id: newId('r'), name: 'New customer', amount: 0, recurring: true, startMonth: 1, endMonth: null }])}
        >
          + Add revenue
        </button>
      </header>
      {revenue.length === 0 ? (
        <p className="muted">No customer revenue yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="edit-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th className="r">Amount</th>
                <th>Type</th>
                <th className="r">Start month</th>
                <th className="r">End month</th>
                <th className="r">Per year</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {revenue.map((r) => (
                <tr key={r.id}>
                  <td><TextField value={r.name} onChange={(name) => set(r.id, { name })} ariaLabel="Customer name" /></td>
                  <td><NumberField value={r.amount} min={0} onChange={(v) => set(r.id, { amount: v ?? 0 })} ariaLabel="Revenue amount" /></td>
                  <td>
                    <select value={r.recurring ? 'monthly' : 'once'} onChange={(e) => set(r.id, { recurring: e.target.value === 'monthly' })} aria-label="Revenue type">
                      <option value="monthly">monthly</option>
                      <option value="once">one-time</option>
                    </select>
                  </td>
                  <td><NumberField className="short" value={r.startMonth} min={1} step={1} onChange={(v) => set(r.id, { startMonth: Math.max(1, Math.round(v ?? 1)) })} ariaLabel="Start month" /></td>
                  <td>
                    {r.recurring ? (
                      <NumberField className="short" value={r.endMonth} min={1} step={1} allowEmpty placeholder="∞" onChange={(v) => set(r.id, { endMonth: v == null ? null : Math.round(v) })} ariaLabel="End month" />
                    ) : (
                      <span className="muted">-</span>
                    )}
                  </td>
                  <td className="r mono">{money(r.recurring ? r.amount * 12 : r.amount, settings.currency)}</td>
                  <td><RemoveButton label={`Remove ${r.name}`} onClick={() => onChange(removeRow(revenue, r.id))} /></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5}>Recurring per month / one-time total</td>
                <td className="r mono">{money(monthly, settings.currency)} / {money(oneOff, settings.currency)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  )
}
