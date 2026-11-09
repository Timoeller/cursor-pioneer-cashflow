import { employeeMonthlyCost } from '../model/cashflow'
import type { Employee } from '../model/types'
import { newId } from '../storage/local'
import { money } from '../ui/format'
import { removeRow, updateRow } from '../ui/rows'
import { NumberField, RemoveButton, TextField } from './fields'

interface Props {
  employees: Employee[]
  surchargePct: number
  /** Funding rate of the personnel grant component, if any. */
  fundingRatePct: number | null
  currency: string
  onChange: (employees: Employee[]) => void
}

export function EmployeesTable({ employees, surchargePct, fundingRatePct, currency, onChange }: Props) {
  const set = (id: string, patch: Partial<Employee>) => onChange(updateRow(employees, id, patch))
  const totalCost = employees.reduce((s, e) => s + employeeMonthlyCost(e, surchargePct), 0)
  const totalEligible = employees.reduce((s, e) => s + (employeeMonthlyCost(e, surchargePct) * e.fundingEligiblePct) / 100, 0)
  const funded = (eligible: number) => (fundingRatePct == null ? null : (eligible * fundingRatePct) / 100)
  const fundedText = (eligible: number) => {
    const v = funded(eligible)
    return v == null ? '-' : money(v, currency)
  }

  return (
    <section className="card">
      <header className="card-head">
        <div>
          <h2>Employees</h2>
          <p className="muted">
            Gross monthly salary. Employer cost adds {surchargePct} % on top. Start month counts from founding (month 1). Funding-eligible % is the share of the person's cost that counts as eligible; the grant then funds {fundingRatePct ?? '-'} % of that.
          </p>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() =>
            onChange([
              ...employees,
              { id: newId('e'), name: `Employee ${employees.length + 1}`, monthlySalary: 5000, startMonth: 1, endMonth: null, fundingEligiblePct: 100 },
            ])
          }
        >
          + Add employee
        </button>
      </header>
      <div className="table-wrap">
        <table className="edit-table">
          <thead>
            <tr>
              <th>Name / role</th>
              <th className="r">Gross salary / month</th>
              <th className="r">Start month</th>
              <th className="r">End month</th>
              <th className="r">Funding-eligible %</th>
              <th className="r">Employer cost / month</th>
              <th className="r">Eligible / month</th>
              <th className="r" title="Eligible x funding rate of the personnel grant component">Funded / month</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => {
              const cost = employeeMonthlyCost(e, surchargePct)
              return (
                <tr key={e.id}>
                  <td><TextField value={e.name} onChange={(name) => set(e.id, { name })} ariaLabel="Employee name" /></td>
                  <td><NumberField value={e.monthlySalary} min={0} onChange={(v) => set(e.id, { monthlySalary: v ?? 0 })} ariaLabel="Salary" /></td>
                  <td><NumberField className="short" value={e.startMonth} min={1} step={1} onChange={(v) => set(e.id, { startMonth: Math.max(1, Math.round(v ?? 1)) })} ariaLabel="Start month" /></td>
                  <td><NumberField className="short" value={e.endMonth} min={1} step={1} allowEmpty placeholder="∞" onChange={(v) => set(e.id, { endMonth: v == null ? null : Math.round(v) })} ariaLabel="End month" /></td>
                  <td>
                    <div className="pct-field">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={e.fundingEligiblePct}
                        onChange={(ev) => set(e.id, { fundingEligiblePct: Number(ev.target.value) })}
                        aria-label="Funding-eligible percent slider"
                      />
                      <NumberField className="short" value={e.fundingEligiblePct} min={0} max={100} onChange={(v) => set(e.id, { fundingEligiblePct: Math.min(100, Math.max(0, v ?? 0)) })} ariaLabel="Funding-eligible percent" />
                    </div>
                  </td>
                  <td className="r mono">{money(cost, currency)}</td>
                  <td className="r mono">{money((cost * e.fundingEligiblePct) / 100, currency)}</td>
                  <td className="r mono">{fundedText((cost * e.fundingEligiblePct) / 100)}</td>
                  <td><RemoveButton label={`Remove ${e.name}`} onClick={() => onChange(removeRow(employees, e.id))} /></td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5}>Total when everyone is on board</td>
              <td className="r mono">{money(totalCost, currency)}</td>
              <td className="r mono">{money(totalEligible, currency)}</td>
              <td className="r mono">{fundedText(totalEligible)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}
