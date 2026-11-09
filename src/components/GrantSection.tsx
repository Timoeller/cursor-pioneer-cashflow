import { eligiblePersonnelBetween, fundingBreakdown, trancheKind } from '../model/cashflow'
import type { FundingKind, FundingPeriod, GrantComponent, PlanState, Tranche } from '../model/types'
import { newId } from '../storage/local'
import { money, monthLabel, pct } from '../ui/format'
import { removeRow, updateRow } from '../ui/rows'
import { NumberField, RemoveButton, TextField } from './fields'

interface Props {
  state: PlanState
  onComponentsChange: (c: GrantComponent[]) => void
  onTranchesChange: (t: Tranche[]) => void
  onPeriodChange: (p: FundingPeriod) => void
}

const KIND_LABEL: Record<FundingKind, string> = { grant: 'Grant (Zuschuss)', loan: 'Loan (Darlehen)' }

export function GrantSection({ state, onComponentsChange, onTranchesChange, onPeriodChange }: Props) {
  const { grantComponents: components, tranches, settings, fundingPeriod: period } = state
  const cur = settings.currency
  const m = (v: number) => money(v, cur)

  const f = fundingBreakdown(state)
  const byId = new Map(f.components.map((c) => [c.id, c]))
  const setC = (id: string, patch: Partial<GrantComponent>) => onComponentsChange(updateRow(components, id, patch))
  const setT = (id: string, patch: Partial<Tranche>) => onTranchesChange(updateRow(tranches, id, patch))
  const sortedTranches = [...tranches].sort((a, b) => a.month - b.month || trancheKind(a).localeCompare(trancheKind(b)))
  const lastMonth = sortedTranches.length ? sortedTranches[sortedTranches.length - 1].month : 0
  const personnelComponents = components.filter((c) => c.basis === 'personnel')

  const kinds: { kind: FundingKind; total: number; scheduled: number }[] = [
    { kind: 'grant', total: f.grant, scheduled: f.scheduledGrant },
    { kind: 'loan', total: f.loan, scheduled: f.scheduledLoan },
  ]
  const addTranche = (kind: FundingKind, amount: number) =>
    onTranchesChange([...tranches, { id: newId('t'), kind, month: lastMonth ? lastMonth + 6 : period.fromMonth, amount: Math.round(amount) }])

  return (
    <section className="card">
      <header className="card-head">
        <div>
          <h2>Grant funding</h2>
          <p className="muted">
            Funding = eligible costs x funding rate (e.g. 80 %). The rest is your own contribution (Eigenanteil). Each component's funding is
            split into a grant part (Zuschuss) and a loan part (Darlehen).
          </p>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => onComponentsChange([...components, { id: newId('g'), name: 'New component', basis: 'manual', amount: 0, ratePct: 80, grantSharePct: 100 }])}
        >
          + Add component
        </button>
      </header>

      <div className="funding-summary">
        <div><span>Eligible costs</span><strong className="mono">{m(f.eligible)}</strong></div>
        <div><span>Funding</span><strong className="mono">{m(f.funding)}</strong><small>{f.eligible > 0 ? pct(f.funding / f.eligible) : '-'} of eligible</small></div>
        <div className="grant"><span>Grant (Zuschuss)</span><strong className="mono">{m(f.grant)}</strong></div>
        <div className="loan"><span>Loan (Darlehen)</span><strong className="mono">{m(f.loan)}</strong></div>
        <div className="own"><span>Own contribution</span><strong className="mono">{m(f.own)}</strong><small>{f.eligible > 0 ? pct(f.own / f.eligible) : '-'} of eligible</small></div>
      </div>

      <div className="helper">
        <span>Funding period: month</span>
        <NumberField className="short" value={period.fromMonth} min={1} step={1} onChange={(v) => onPeriodChange({ ...period, fromMonth: Math.max(1, Math.round(v ?? 1)) })} ariaLabel="Funding period from month" />
        <span>to</span>
        <NumberField className="short" value={period.toMonth} min={1} step={1} onChange={(v) => onPeriodChange({ ...period, toMonth: Math.max(1, Math.round(v ?? 1)) })} ariaLabel="Funding period to month" />
        <span className="muted">
          ({monthLabel(period.fromMonth, settings.foundingMonth)} – {monthLabel(period.toMonth, settings.foundingMonth)}). Personnel-based components count employee costs in this period.
        </span>
      </div>

      <div className="table-wrap">
        <table className="edit-table">
          <thead>
            <tr>
              <th>Component</th>
              <th>Eligible costs from</th>
              <th className="r">Eligible costs</th>
              <th className="r">Funding rate %</th>
              <th className="r">Grant share %</th>
              <th className="r">Funding</th>
              <th className="r">Grant</th>
              <th className="r">Loan</th>
              <th className="r">Own contribution</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {components.map((g) => {
              const c = byId.get(g.id)!
              return (
                <tr key={g.id}>
                  <td><TextField value={g.name} onChange={(name) => setC(g.id, { name })} ariaLabel="Component name" /></td>
                  <td>
                    <select value={g.basis} onChange={(e) => setC(g.id, { basis: e.target.value as GrantComponent['basis'] })} aria-label="Eligible costs from">
                      <option value="personnel">employees (eligible %)</option>
                      <option value="manual">fixed amount</option>
                    </select>
                  </td>
                  <td className="r">
                    {g.basis === 'manual' ? (
                      <NumberField value={g.amount} min={0} onChange={(v) => setC(g.id, { amount: v ?? 0 })} ariaLabel="Eligible amount" />
                    ) : (
                      <span className="mono" title="Sum of employer cost x funding-eligible % over the funding period">{m(c.eligible)}</span>
                    )}
                  </td>
                  <td><NumberField className="short" value={g.ratePct} min={0} max={100} onChange={(v) => setC(g.id, { ratePct: Math.min(100, Math.max(0, v ?? 0)) })} ariaLabel="Funding rate" /></td>
                  <td>
                    <NumberField
                      className="short"
                      value={g.grantSharePct}
                      min={0}
                      max={100}
                      onChange={(v) => setC(g.id, { grantSharePct: Math.min(100, Math.max(0, v ?? 0)) })}
                      ariaLabel="Grant share of funding"
                    />
                  </td>
                  <td className="r mono">{m(c.funding)}</td>
                  <td className="r mono grant-text">{m(c.grant)}</td>
                  <td className="r mono loan-text">{m(c.loan)}</td>
                  <td className="r mono">{m(c.own)}</td>
                  <td><RemoveButton label={`Remove ${g.name}`} onClick={() => onComponentsChange(removeRow(components, g.id))} /></td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>Total</td>
              <td className="r mono">{m(f.eligible)}</td>
              <td colSpan={2} />
              <td className="r mono strong">{m(f.funding)}</td>
              <td className="r mono strong">{m(f.grant)}</td>
              <td className="r mono strong">{m(f.loan)}</td>
              <td className="r mono strong">{m(f.own)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="muted small">Grant share: the part of the funding paid as grant (Zuschuss). The rest is loan (Darlehen). 100 % = grant only, 0 % = loan only.</p>

      {personnelComponents.length > 0 && state.employees.length > 0 && (
        <>
          <div className="subhead">
            <h3>Personnel funding per employee</h3>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th className="r">Employer cost in period</th>
                  <th className="r">Funding-eligible %</th>
                  <th className="r">Eligible costs</th>
                  <th className="r">Funding rate</th>
                  <th className="r">Funding</th>
                  <th className="r">Effective share of cost</th>
                </tr>
              </thead>
              <tbody>
                {state.employees.map((e) => {
                  const single = { ...state, employees: [{ ...e, fundingEligiblePct: 100 }] }
                  const cost = eligiblePersonnelBetween(single, period.fromMonth, period.toMonth)
                  const eligible = (cost * e.fundingEligiblePct) / 100
                  const rate = personnelComponents[0].ratePct
                  const funding = (eligible * rate) / 100
                  return (
                    <tr key={e.id}>
                      <td>{e.name}</td>
                      <td className="r mono">{m(cost)}</td>
                      <td className="r mono">{e.fundingEligiblePct} %</td>
                      <td className="r mono">{m(eligible)}</td>
                      <td className="r mono">{rate} %</td>
                      <td className="r mono strong">{m(funding)}</td>
                      <td className="r mono muted">
                        {e.fundingEligiblePct} % x {rate} % = {pct((e.fundingEligiblePct * rate) / 10000, 0)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {personnelComponents.length > 1 && (
            <p className="notice warn">More than one component uses employee costs, so personnel costs are counted more than once.</p>
          )}
        </>
      )}

      <div className="subhead">
        <h3>Payout tranches</h3>
        <div className="inline">
          {kinds
            .filter((k) => Math.abs(k.total - k.scheduled) >= 1 && k.total - k.scheduled > 0)
            .map((k) => (
              <button key={k.kind} type="button" className="btn ghost" onClick={() => addTranche(k.kind, k.total - k.scheduled)}>
                + Remaining {k.kind === 'grant' ? 'grant' : 'loan'} {m(k.total - k.scheduled)}
              </button>
            ))}
          <button type="button" className="btn" onClick={() => addTranche('grant', 0)}>
            + Add tranche
          </button>
        </div>
      </div>
      <div className="table-wrap">
        <table className="edit-table">
          <thead>
            <tr>
              <th>Type</th>
              <th className="r">Payout month</th>
              <th />
              <th className="r">Amount</th>
              <th className="r">Share of type</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sortedTranches.map((t) => {
              const kind = trancheKind(t)
              const total = kind === 'grant' ? f.grant : f.loan
              return (
                <tr key={t.id}>
                  <td>
                    <select value={kind} onChange={(e) => setT(t.id, { kind: e.target.value as FundingKind })} aria-label="Tranche type">
                      <option value="grant">{KIND_LABEL.grant}</option>
                      <option value="loan">{KIND_LABEL.loan}</option>
                    </select>
                  </td>
                  <td><NumberField className="short" value={t.month} min={1} step={1} onChange={(v) => setT(t.id, { month: Math.max(1, Math.round(v ?? 1)) })} ariaLabel="Tranche month" /></td>
                  <td className="muted">{monthLabel(t.month, settings.foundingMonth)}</td>
                  <td><NumberField value={t.amount} min={0} onChange={(v) => setT(t.id, { amount: v ?? 0 })} ariaLabel="Tranche amount" /></td>
                  <td className="r mono">{total > 0 ? pct(t.amount / total, 1) : '-'}</td>
                  <td><RemoveButton label="Remove tranche" onClick={() => onTranchesChange(removeRow(tranches, t.id))} /></td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            {kinds.map((k) => (
              <tr key={k.kind}>
                <td colSpan={3}>Scheduled {KIND_LABEL[k.kind].toLowerCase()}</td>
                <td className="r mono strong">{m(k.scheduled)}</td>
                <td className="r mono">{k.total > 0 ? pct(k.scheduled / k.total, 1) : '-'}</td>
                <td />
              </tr>
            ))}
          </tfoot>
        </table>
      </div>
      {kinds.map((k) => {
        const diff = k.total - k.scheduled
        if (Math.abs(diff) < 1) return null
        const label = KIND_LABEL[k.kind].toLowerCase()
        return (
          <p key={k.kind} className={`notice ${diff < 0 ? 'bad' : 'warn'}`}>
            {diff > 0
              ? `Tranches cover ${m(k.scheduled)} of the ${m(k.total)} ${label}: ${m(diff)} is not scheduled yet.`
              : `Tranches exceed the ${label} by ${m(-diff)}.`}
          </p>
        )
      })}
      {tranches.some((t) => t.month > settings.horizonMonths) && (
        <p className="notice warn">Some tranches arrive after the planning horizon and are not included in the cash flow.</p>
      )}
    </section>
  )
}
