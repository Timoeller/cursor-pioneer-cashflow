import { computeCashflow, employeeFunding, summarize } from '../model/cashflow'
import type { FundingRules, PlanState, Tranche } from '../model/types'
import { newId } from '../storage/local'
import { money, monthLabel, pct } from '../ui/format'
import { removeRow, updateRow } from '../ui/rows'
import { NumberField, RemoveButton } from './fields'

interface Props {
  state: PlanState
  onFundingChange: (f: FundingRules) => void
  onTranchesChange: (t: Tranche[]) => void
}

export function GrantSection({ state, onFundingChange, onTranchesChange }: Props) {
  const { funding, tranches, settings, employees } = state
  const cur = settings.currency
  const m = (v: number) => money(v, cur)
  const rows = computeCashflow(state)
  const s = summarize(state, rows)
  const people = employeeFunding(state)
  const byId = new Map(people.map((p) => [p.id, p]))
  const set = (patch: Partial<FundingRules>) => onFundingChange({ ...funding, ...patch })
  const setT = (id: string, patch: Partial<Tranche>) => onTranchesChange(updateRow(tranches, id, patch))
  const sorted = [...tranches].sort((a, b) => a.month - b.month)
  const unusedAllowance = Math.max(0, s.additionalAllowance - s.grantOnAdditional)
  const trancheGap = s.grantCovered - s.trancheTotal

  const scheduleEvenly = () => {
    const total = Math.round(s.grantCovered)
    const points = [funding.fromMonth, Math.round((funding.fromMonth + funding.toMonth) / 2), funding.toMonth]
    const part = Math.round(total / points.length)
    onTranchesChange(
      points.map((month, i) => ({
        id: newId('t'),
        month,
        amount: i === points.length - 1 ? total - part * (points.length - 1) : part,
      })),
    )
  }

  return (
    <section className="card">
      <header className="card-head">
        <div>
          <h2>Grant funding</h2>
          <p className="muted">
            The grant pays {funding.ratePct} % of the working time that can be funded. The rest of that person's cost is financed by the founders.
            Additional costs are covered up to {funding.additionalCostPct} % of the fundable personnel cost, and the {funding.ratePct} % rate is not applied to those.
          </p>
        </div>
      </header>

      <div className="funding-summary">
        <div><span>Grant on personnel</span><strong className="mono">{m(s.grantOnPersonnel)}</strong><small>{funding.ratePct} % of {m(s.fundablePersonnel)} fundable</small></div>
        <div><span>Grant on additional costs</span><strong className="mono">{m(s.grantOnAdditional)}</strong><small>allowance {m(s.additionalAllowance)}</small></div>
        <div className="grant"><span>Grant covers in total</span><strong className="mono">{m(s.grantCovered)}</strong><small>this money arrives in full</small></div>
        <div className="own"><span>Founders finance</span><strong className="mono">{m(s.founderBorne)}</strong><small>costs the grant does not cover</small></div>
      </div>

      <div className="settings-grid">
        <label>
          <span>Funding rate (%)</span>
          <NumberField value={funding.ratePct} min={0} max={100} onChange={(v) => set({ ratePct: Math.min(100, Math.max(0, v ?? 0)) })} ariaLabel="Funding rate" />
        </label>
        <label>
          <span>Additional costs (% of fundable personnel)</span>
          <NumberField value={funding.additionalCostPct} min={0} max={200} onChange={(v) => set({ additionalCostPct: Math.max(0, v ?? 0) })} ariaLabel="Additional cost rate" />
        </label>
        <label>
          <span>Funding from month</span>
          <NumberField value={funding.fromMonth} min={1} step={1} onChange={(v) => set({ fromMonth: Math.max(1, Math.round(v ?? 1)) })} ariaLabel="Funding from month" />
        </label>
        <label>
          <span>Funding to month</span>
          <NumberField value={funding.toMonth} min={1} step={1} onChange={(v) => set({ toMonth: Math.max(1, Math.round(v ?? 1)) })} ariaLabel="Funding to month" />
        </label>
      </div>
      <p className="muted small">
        {monthLabel(funding.fromMonth, settings.foundingMonth)} – {monthLabel(funding.toMonth, settings.foundingMonth)}. Outside this period the grant covers nothing.
        {unusedAllowance >= 1 && ` ${m(unusedAllowance)} of the additional-cost allowance is unused, because other costs are lower.`}
      </p>

      {employees.length > 0 && (
        <>
          <div className="subhead"><h3>Per employee, over the funding period</h3></div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th className="r">Employer cost</th>
                  <th className="r">Fundable %</th>
                  <th className="r">Fundable cost</th>
                  <th className="r">Grant ({funding.ratePct} %)</th>
                  <th className="r">Founders pay</th>
                  <th className="r">Additional budget ({funding.additionalCostPct} %)</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => {
                  const p = byId.get(e.id)
                  if (!p) return null
                  return (
                    <tr key={e.id}>
                      <td>{e.name}</td>
                      <td className="r mono">{m(p.cost)}</td>
                      <td className="r mono">{e.fundingEligiblePct} %</td>
                      <td className="r mono">{m(p.fundable)}</td>
                      <td className="r mono grant-text">{m(p.grant)}</td>
                      <td className="r mono">{m(p.founder)}</td>
                      <td className="r mono">{m(p.additional)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>Total</td>
                  <td className="r mono">{m(people.reduce((n, p) => n + p.grant, 0))}</td>
                  <td className="r mono">{m(people.reduce((n, p) => n + p.founder, 0))}</td>
                  <td className="r mono">{m(people.reduce((n, p) => n + p.additional, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="muted small">
            Example: fundable 50 % and a funding rate of 80 % covers 40 % of that person's cost (50 % × 80 %). Additional costs can be 40 % × 50 % = 20 % of their cost, and the 80 % is not applied again.
          </p>
        </>
      )}

      <div className="subhead">
        <h3>When the grant is paid</h3>
      </div>
      <div className="inline">
        <label className="toggle">
          <input type="radio" name="payout" checked={funding.payMonthly} onChange={() => set({ payMonthly: true })} />
          Each month, as the costs are covered
        </label>
        <label className="toggle">
          <input type="radio" name="payout" checked={!funding.payMonthly} onChange={() => set({ payMonthly: false })} />
          In tranches
        </label>
      </div>
      {funding.payMonthly ? (
        <p className="muted small">The cash flow receives {m(s.grantCovered)} in total, in the month the grant covers the cost. Switch to tranches if the money arrives later.</p>
      ) : (
        <>
          <div className="subhead">
            <h3>Payout tranches</h3>
            <div className="inline">
              <button type="button" className="btn ghost" onClick={scheduleEvenly}>Split {m(s.grantCovered)} into 3 tranches</button>
              <button type="button" className="btn" onClick={() => onTranchesChange([...tranches, { id: newId('t'), month: (sorted.at(-1)?.month ?? funding.fromMonth) + 6, amount: 0 }])}>
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
                  <th className="r">Share</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sorted.map((t) => (
                  <tr key={t.id}>
                    <td><NumberField className="short" value={t.month} min={1} step={1} onChange={(v) => setT(t.id, { month: Math.max(1, Math.round(v ?? 1)) })} ariaLabel="Tranche month" /></td>
                    <td className="muted">{monthLabel(t.month, settings.foundingMonth)}</td>
                    <td><NumberField value={t.amount} min={0} onChange={(v) => setT(t.id, { amount: v ?? 0 })} ariaLabel="Tranche amount" /></td>
                    <td className="r mono">{s.grantCovered > 0 ? pct(t.amount / s.grantCovered, 1) : '-'}</td>
                    <td><RemoveButton label="Remove tranche" onClick={() => onTranchesChange(removeRow(tranches, t.id))} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>Scheduled</td>
                  <td className="r mono strong">{m(s.trancheTotal)}</td>
                  <td className="r mono">{s.grantCovered > 0 ? pct(s.trancheTotal / s.grantCovered, 1) : '-'}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          {Math.abs(trancheGap) >= 1 && (
            <p className={`notice ${trancheGap < 0 ? 'bad' : 'warn'}`}>
              {trancheGap > 0
                ? `Tranches pay ${m(s.trancheTotal)} of the ${m(s.grantCovered)} the grant covers. ${m(trancheGap)} is not scheduled, so the cash flow runs out earlier than the funding allows.`
                : `Tranches exceed what the grant covers by ${m(-trancheGap)}.`}
            </p>
          )}
        </>
      )}
    </section>
  )
}
