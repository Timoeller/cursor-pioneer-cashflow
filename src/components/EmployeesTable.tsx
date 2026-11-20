import { employeeMonthlyCost } from '../model/cashflow'
import type { Employee } from '../model/types'
import { newId } from '../storage/local'
import { money } from '../ui/format'
import { removeRow, updateRow } from '../ui/rows'
import { NumberField, RemoveButton, TextField } from './fields'

interface Props {
  employees: Employee[]
  surchargePct: number
  fundingRatePct: number
  /** Additional costs the grant covers, as % of fundable personnel. */
  additionalCostPct: number
  currency: string
  onChange: (employees: Employee[]) => void
}

export function EmployeesTable({ employees, surchargePct, fundingRatePct, additionalCostPct, currency, onChange }: Props) {
  const set = (id: string, patch: Partial<Employee>) => onChange(updateRow(employees, id, patch))
  const totalCost = employees.reduce((s, e) => s + employeeMonthlyCost(e, surchargePct), 0)
  const totalEligible = employees.reduce((s, e) => s + (employeeMonthlyCost(e, surchargePct) * e.fundingEligiblePct) / 100, 0)
  const grantOn = (eligible: number) => (eligible * fundingRatePct) / 100
  const extraOn = (eligible: number) => (eligible * additionalCostPct) / 100

  return (
    <section className="card">
      <header className="card-head">
        <div>
          <h2>Mitarbeitende</h2>
          <p className="muted">
            Bruttomonatsgehalt. Die Arbeitgeberkosten kommen mit {surchargePct} % obendrauf. Der Startmonat zählt ab der Gründung (Monat 1). Die Förderung zahlt {fundingRatePct} % des förderfähigen Anteils, und dieser Anteil erzeugt zusätzlich ein Gemeinkostenbudget von {additionalCostPct} %.
          </p>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() =>
            onChange([
              ...employees,
              { id: newId('e'), name: `Mitarbeiter ${employees.length + 1}`, monthlySalary: 5000, startMonth: 1, endMonth: null, fundingEligiblePct: 100 },
            ])
          }
        >
          + Person hinzufügen
        </button>
      </header>
      <div className="table-wrap">
        <table className="edit-table">
          <thead>
            <tr>
              <th>Name / Rolle</th>
              <th className="r">Bruttogehalt / Monat</th>
              <th className="r">Startmonat</th>
              <th className="r">Endmonat</th>
              <th className="r">Förderfähig %</th>
              <th className="r">Arbeitgeberkosten / Monat</th>
              <th className="r">Förderfähig / Monat</th>
              <th className="r" title="Förderfähige Kosten × Fördersatz">Förderung / Monat</th>
              <th className="r" title="Förderfähige Kosten × Gemeinkostensatz. Der Fördersatz wird nicht angewendet.">Zusatzbudget / Monat</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => {
              const cost = employeeMonthlyCost(e, surchargePct)
              return (
                <tr key={e.id}>
                  <td><TextField value={e.name} onChange={(name) => set(e.id, { name })} ariaLabel="Name" /></td>
                  <td><NumberField value={e.monthlySalary} min={0} onChange={(v) => set(e.id, { monthlySalary: v ?? 0 })} ariaLabel="Gehalt" /></td>
                  <td><NumberField className="short" value={e.startMonth} min={1} step={1} onChange={(v) => set(e.id, { startMonth: Math.max(1, Math.round(v ?? 1)) })} ariaLabel="Startmonat" /></td>
                  <td><NumberField className="short" value={e.endMonth} min={1} step={1} allowEmpty placeholder="∞" onChange={(v) => set(e.id, { endMonth: v == null ? null : Math.round(v) })} ariaLabel="Endmonat" /></td>
                  <td>
                    <div className="pct-field">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={e.fundingEligiblePct}
                        onChange={(ev) => set(e.id, { fundingEligiblePct: Number(ev.target.value) })}
                        aria-label="Schieberegler förderfähiger Anteil"
                      />
                      <NumberField className="short" value={e.fundingEligiblePct} min={0} max={100} onChange={(v) => set(e.id, { fundingEligiblePct: Math.min(100, Math.max(0, v ?? 0)) })} ariaLabel="Förderfähiger Anteil" />
                    </div>
                  </td>
                  <td className="r mono">{money(cost, currency)}</td>
                  <td className="r mono">{money((cost * e.fundingEligiblePct) / 100, currency)}</td>
                  <td className="r mono">{money(grantOn((cost * e.fundingEligiblePct) / 100), currency)}</td>
                  <td className="r mono">{money(extraOn((cost * e.fundingEligiblePct) / 100), currency)}</td>
                  <td><RemoveButton label={`${e.name} entfernen`} onClick={() => onChange(removeRow(employees, e.id))} /></td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5}>Summe, wenn alle dabei sind</td>
              <td className="r mono">{money(totalCost, currency)}</td>
              <td className="r mono">{money(totalEligible, currency)}</td>
              <td className="r mono">{money(grantOn(totalEligible), currency)}</td>
              <td className="r mono">{money(extraOn(totalEligible), currency)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}
