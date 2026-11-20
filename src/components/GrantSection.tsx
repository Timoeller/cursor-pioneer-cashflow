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
          <h2>Förderung</h2>
          <p className="muted">
            Die Förderung ist ein fester Betrag. Jeden Monat zahlt sie {funding.ratePct} % der förderfähigen Arbeitszeit und danach Gemeinkosten bis zu {funding.additionalCostPct} % dieser förderfähigen Kosten, bis der Betrag aufgebraucht ist.
          </p>
        </div>
      </header>

      <div className="funding-summary">
        <div><span>Förderung auf Personal</span><strong className="mono">{m(s.grantOnPersonnel)}</strong><small>{funding.ratePct} % von {m(s.fundablePersonnel)} förderfähig</small></div>
        <div><span>Förderung auf Gemeinkosten</span><strong className="mono">{m(s.grantOnAdditional)}</strong><small>Zuschuss {m(s.additionalAllowance)}</small></div>
        <div className="grant"><span>Verbrauchte Fördermittel</span><strong className="mono">{m(s.grantCovered)}</strong><small>{m(s.grantRemaining)} übrig von {m(s.grantAmount)}</small></div>
        <div className="own"><span>Gründer finanzieren</span><strong className="mono">{m(s.founderBorne)}</strong><small>Kosten, die die Förderung nicht deckt</small></div>
      </div>

      <div className="settings-grid">
        <label>
          <span>Fördersatz (%)</span>
          <NumberField value={funding.ratePct} min={0} max={100} onChange={(v) => set({ ratePct: Math.min(100, Math.max(0, v ?? 0)) })} ariaLabel="Fördersatz" />
        </label>
        <label>
          <span>Gemeinkosten (% des förderfähigen Personals)</span>
          <NumberField value={funding.additionalCostPct} min={0} max={200} onChange={(v) => set({ additionalCostPct: Math.max(0, v ?? 0) })} ariaLabel="Gemeinkostensatz" />
        </label>
        <label>
          <span>Förderbetrag</span>
          <NumberField value={funding.amount} min={0} onChange={(v) => set({ amount: Math.max(0, v ?? 0) })} ariaLabel="Förderbetrag" />
        </label>
      </div>
      <p className="muted small">
        {s.runsOutMonth == null
          ? `Nach Monat ${settings.horizonMonths} sind noch ${m(s.grantRemaining)} von der Förderung übrig.`
          : `Die Förderung ist in ${monthLabel(s.runsOutMonth, settings.foundingMonth)} aufgebraucht. Danach finanzieren die Gründer jede Kostenposition.`}
        {unusedAllowance >= 1 && ` ${m(unusedAllowance)} des Gemeinkostenzuschusses bleiben ungenutzt, weil die übrigen Kosten niedriger sind als der Zuschuss.`}
      </p>

      {employees.length > 0 && (
        <>
          <div className="subhead"><h3>Pro Person, aus der Förderung gezahlt</h3></div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th className="r">Arbeitgeberkosten</th>
                  <th className="r">Förderfähig %</th>
                  <th className="r">Förderfähige Kosten</th>
                  <th className="r">Förderung gezahlt</th>
                  <th className="r">Gründer zahlen</th>
                  <th className="r">Gezahlte Gemeinkosten</th>
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
                  <td colSpan={4}>Summe</td>
                  <td className="r mono">{m(people.reduce((n, p) => n + p.grant, 0))}</td>
                  <td className="r mono">{m(people.reduce((n, p) => n + p.founder, 0))}</td>
                  <td className="r mono">{m(people.reduce((n, p) => n + p.additional, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="muted small">
            Beispiel: 50 % förderfähig und ein Fördersatz von 80 % decken 40 % der Kosten dieser Person (50 % × 80 %). Gemeinkosten können 40 % × 50 % = 20 % ihrer Kosten betragen, und die 80 % werden nicht noch einmal angewendet.
          </p>
        </>
      )}

      <div className="subhead">
        <h3>Wann die Förderung ausgezahlt wird</h3>
      </div>
      <div className="inline">
        <label className="toggle">
          <input type="radio" name="payout" checked={funding.payMonthly} onChange={() => set({ payMonthly: true })} />
          Jeden Monat, sobald die Kosten gedeckt sind
        </label>
        <label className="toggle">
          <input type="radio" name="payout" checked={!funding.payMonthly} onChange={() => set({ payMonthly: false })} />
          In Tranchen
        </label>
      </div>
      {funding.payMonthly ? (
        <p className="muted small">Der Cashflow erhält insgesamt {m(s.grantCovered)}, in dem Monat, in dem die Förderung die Kosten deckt. Wechsle zu Tranchen, wenn das Geld später ankommt.</p>
      ) : (
        <>
          <div className="subhead">
            <h3>Auszahlungstranchen</h3>
            <button type="button" className="btn" onClick={() => onTranchesChange([...tranches, { id: newId('t'), month: (payouts.at(-1)?.month ?? 0) + 6 }])}>
              + Tranche hinzufügen
            </button>
          </div>
          <p className="muted small">Du legst nur den Monat fest. Jede Tranche zahlt die geförderten Gehälter und Gemeinkosten, die sich seit der vorherigen Tranche bis zu diesem Monat angesammelt haben.</p>
          <div className="table-wrap">
            <table className="edit-table">
              <thead>
                <tr>
                  <th className="r">Auszahlungsmonat</th>
                  <th />
                  <th>Deckt</th>
                  <th className="r">Betrag</th>
                  <th className="r">Anteil der Förderung</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id}>
                    <td><NumberField className="short" value={p.month} min={1} step={1} onChange={(v) => setT(p.id, { month: Math.max(1, Math.round(v ?? 1)) })} ariaLabel="Tranchenmonat" /></td>
                    <td className="muted">{monthLabel(p.month, settings.foundingMonth)}</td>
                    <td className="muted">{p.fromMonth <= p.toMonth ? `${monthLabel(p.fromMonth, settings.foundingMonth)} – ${monthLabel(p.toMonth, settings.foundingMonth)}` : 'nichts Neues'}</td>
                    <td className="r mono">{m(p.amount)}</td>
                    <td className="r mono">{funding.amount > 0 ? pct(p.amount / funding.amount, 1) : '-'}</td>
                    <td><RemoveButton label="Tranche entfernen" onClick={() => onTranchesChange(removeRow(tranches, p.id))} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Ausgezahlt</td>
                  <td className="r mono strong">{m(s.trancheTotal)}</td>
                  <td className="r mono">{funding.amount > 0 ? pct(s.trancheTotal / funding.amount, 1) : '-'}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          {s.unreleased >= 1 && (
            <p className="notice warn">
              {m(s.unreleased)} gedeckte Kosten liegen nach der letzten Tranche und werden nicht ausgezahlt. Füge eine spätere Tranche hinzu, um sie freizugeben.
            </p>
          )}
          {payouts.some((p) => p.month > settings.horizonMonths) && (
            <p className="notice warn">Eine Tranche wird nach dem Planungshorizont ausgezahlt und ist deshalb nicht im Cashflow enthalten.</p>
          )}
        </>
      )}
    </section>
  )
}
