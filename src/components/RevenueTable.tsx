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
          <h2>Kundenumsatz</h2>
          <p className="muted">Geld von Kunden. Wiederkehrender Umsatz wird jeden Monat vom Start- bis zum Endmonat gebucht. Einmalzahlungen werden einmal gebucht.</p>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => onChange([...revenue, { id: newId('r'), name: 'Neuer Kunde', amount: 0, recurring: true, startMonth: 1, endMonth: null }])}
        >
          + Umsatz hinzufügen
        </button>
      </header>
      {revenue.length === 0 ? (
        <p className="muted">Noch kein Kundenumsatz.</p>
      ) : (
        <div className="table-wrap">
          <table className="edit-table">
            <thead>
              <tr>
                <th>Kunde</th>
                <th className="r">Betrag</th>
                <th>Art</th>
                <th className="r">Startmonat</th>
                <th className="r">Endmonat</th>
                <th className="r">Pro Jahr</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {revenue.map((r) => (
                <tr key={r.id}>
                  <td><TextField value={r.name} onChange={(name) => set(r.id, { name })} ariaLabel="Kundenname" /></td>
                  <td><NumberField value={r.amount} min={0} onChange={(v) => set(r.id, { amount: v ?? 0 })} ariaLabel="Umsatzbetrag" /></td>
                  <td>
                    <select value={r.recurring ? 'monthly' : 'once'} onChange={(e) => set(r.id, { recurring: e.target.value === 'monthly' })} aria-label="Umsatzart">
                      <option value="monthly">monatlich</option>
                      <option value="once">einmalig</option>
                    </select>
                  </td>
                  <td><NumberField className="short" value={r.startMonth} min={1} step={1} onChange={(v) => set(r.id, { startMonth: Math.max(1, Math.round(v ?? 1)) })} ariaLabel="Startmonat" /></td>
                  <td>
                    {r.recurring ? (
                      <NumberField className="short" value={r.endMonth} min={1} step={1} allowEmpty placeholder="∞" onChange={(v) => set(r.id, { endMonth: v == null ? null : Math.round(v) })} ariaLabel="Endmonat" />
                    ) : (
                      <span className="muted">-</span>
                    )}
                  </td>
                  <td className="r mono">{money(r.recurring ? r.amount * 12 : r.amount, settings.currency)}</td>
                  <td><RemoveButton label={`${r.name} entfernen`} onClick={() => onChange(removeRow(revenue, r.id))} /></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5}>Wiederkehrend pro Monat / Summe einmalig</td>
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
