import type { FounderInjection, Settings } from '../model/types'
import { newId } from '../storage/local'
import { money, monthLabel } from '../ui/format'
import { removeRow, updateRow } from '../ui/rows'
import { NumberField, RemoveButton, TextField } from './fields'

interface Props {
  founderCash: FounderInjection[]
  settings: Settings
  onChange: (f: FounderInjection[]) => void
}

export function FounderCashTable({ founderCash, settings, onChange }: Props) {
  const set = (id: string, patch: Partial<FounderInjection>) => onChange(updateRow(founderCash, id, patch))
  const total = founderCash.reduce((s, f) => s + f.amount, 0)
  const byFounder = new Map<string, number>()
  for (const f of founderCash) byFounder.set(f.founder || '?', (byFounder.get(f.founder || '?') ?? 0) + f.amount)

  return (
    <section className="card">
      <header className="card-head">
        <div>
          <h2>Founder cash</h2>
          <p className="muted">Own money the founders put into the company, e.g. share capital or shareholder loans.</p>
        </div>
        <button type="button" className="btn" onClick={() => onChange([...founderCash, { id: newId('f'), founder: '', month: 1, amount: 0 }])}>
          + Add injection
        </button>
      </header>
      <div className="table-wrap">
        <table className="edit-table">
          <thead>
            <tr>
              <th>Founder</th>
              <th className="r">Month</th>
              <th />
              <th className="r">Amount</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {founderCash.map((f) => (
              <tr key={f.id}>
                <td><TextField value={f.founder} placeholder="Name" onChange={(founder) => set(f.id, { founder })} ariaLabel="Founder name" /></td>
                <td><NumberField className="short" value={f.month} min={1} step={1} onChange={(v) => set(f.id, { month: Math.max(1, Math.round(v ?? 1)) })} ariaLabel="Month" /></td>
                <td className="muted">{monthLabel(f.month, settings.foundingMonth)}</td>
                <td><NumberField value={f.amount} min={0} onChange={(v) => set(f.id, { amount: v ?? 0 })} ariaLabel="Amount" /></td>
                <td><RemoveButton label="Remove injection" onClick={() => onChange(removeRow(founderCash, f.id))} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>
                Total
                {byFounder.size > 1 && (
                  <span className="muted">
                    {' '}({[...byFounder].map(([name, v]) => `${name}: ${money(v, settings.currency)}`).join(', ')})
                  </span>
                )}
              </td>
              <td className="r mono strong">{money(total, settings.currency)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}
