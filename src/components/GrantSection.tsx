import { computeCashflow, employeeFunding, summarize, tranchePayouts } from '../model/cashflow'
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
  const people = employeeFunding(state, rows)
  const byId = new Map(people.map((p) => [p.id, p]))
  const set = (patch: Partial<FundingRules>) => onFundingChange({ ...funding, ...patch })
  const setT = (id: string, patch: Partial<Tranche>) => onTranchesChange(updateRow(tranches, id, patch))
  const payouts = tranchePayouts(rows, tranches)
  const unusedAllowance = rows.reduce((sum, r) => (r.grantCovered + 0.5 >= r.grantClaim && r.additionalAllowance > r.otherCosts ? sum + (r.additionalAllowance - r.otherCosts) : sum), 0)

  return (
    <section className="card">
      <header className="card-head">
        <div>
          <h2>Grant funding</h2>
          <p className="muted">
            The grant is a fixed amount. Each month it pays {funding.ratePct} % of fundable working time, then additional costs up to {funding.additionalCostPct} % of that fundable cost, until the amount is used up.
          </p>
        </div>
      </header>

      <div className="funding-summary">
        <div><span>Grant on personnel</span><strong className="mono">{m(s.grantOnPersonnel)}</strong><small>{funding.ratePct} % of {m(s.fundablePersonnel)} fundable</small></div>
        <div><span>Grant on additional costs</span><strong className="mono">{m(s.grantOnAdditional)}</strong><small>allowance {m(s.additionalAllowance)}</small></div>
        <div className="grant"><span>Grant money used</span><strong className="mono">{m(s.grantCovered)}</strong><small>{m(s.grantRemaining)} left of {m(s.grantAmount)}</small></div>
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
          <span>Grant amount</span>
          <NumberField value={funding.amount} min={0} onChange={(v) => set({ amount: Math.max(0, v ?? 0) })} ariaLabel="Grant amount" />
        </label>
      </div>
      <p className="muted small">
        {s.runsOutMonth == null
          ? `The grant still has ${m(s.grantRemaining)} left after month ${settings.horizonMonths}.`
          : `The grant runs out in ${monthLabel(s.runsOutMonth, settings.foundingMonth)}. After that, the founders finance every cost.`}
        {unusedAllowance >= 1 && ` ${m(unusedAllowance)} of the additional-cost allowance is unused, because other costs are lower than the allowance.`}
      </p>

      {employees.length > 0 && (
        <>
          <div className="subhead"><h3>Per employee, paid from the grant</h3></div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th className="r">Employer cost</th>
                  <th className="r">Fundable %</th>
                  <th className="r">Fundable cost</th>
                  <th className="r">Grant paid</th>
                  <th className="r">Founders pay</th>
                  <th className="r">Additional costs paid</th>
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
            <button type="button" className="btn" onClick={() => onTranchesChange([...tranches, { id: newId('t'), month: (payouts.at(-1)?.month ?? 0) + 6 }])}>
              + Add tranche
            </button>
          </div>
          <p className="muted small">You only choose the month. Each tranche pays the funded salaries and additional costs that have built up since the previous tranche, through that month.</p>
          <div className="table-wrap">
            <table className="edit-table">
              <thead>
                <tr>
                  <th className="r">Release month</th>
                  <th />
                  <th>Covers</th>
                  <th className="r">Amount</th>
                  <th className="r">Share of grant</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id}>
                    <td><NumberField className="short" value={p.month} min={1} step={1} onChange={(v) => setT(p.id, { month: Math.max(1, Math.round(v ?? 1)) })} ariaLabel="Tranche month" /></td>
                    <td className="muted">{monthLabel(p.month, settings.foundingMonth)}</td>
                    <td className="muted">{p.fromMonth <= p.toMonth ? `${monthLabel(p.fromMonth, settings.foundingMonth)} – ${monthLabel(p.toMonth, settings.foundingMonth)}` : 'nothing new'}</td>
                    <td className="r mono">{m(p.amount)}</td>
                    <td className="r mono">{funding.amount > 0 ? pct(p.amount / funding.amount, 1) : '-'}</td>
                    <td><RemoveButton label="Remove tranche" onClick={() => onTranchesChange(removeRow(tranches, p.id))} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Released</td>
                  <td className="r mono strong">{m(s.trancheTotal)}</td>
                  <td className="r mono">{funding.amount > 0 ? pct(s.trancheTotal / funding.amount, 1) : '-'}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          {s.unreleased >= 1 && (
            <p className="notice warn">
              {m(s.unreleased)} of covered costs fall after the last tranche and are not paid out. Add a later tranche to release them.
            </p>
          )}
          {payouts.some((p) => p.month > settings.horizonMonths) && (
            <p className="notice warn">A tranche is released after the planning horizon, so it is not included in the cash flow.</p>
          )}
        </>
      )}
    </section>
  )
}
