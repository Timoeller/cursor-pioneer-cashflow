import { describe, expect, it } from 'vitest'
import { createInitialState } from '../data/initialState'
import { computeCashflow, eligiblePersonnelBetween, fundingBreakdown, summarize, yearlyTotals } from './cashflow'
import type { PlanState } from './types'

function emptyState(): PlanState {
  const s = createInitialState()
  return { ...s, costs: [], employees: [], grantComponents: [], tranches: [], founderCash: [], settings: { ...s.settings, horizonMonths: 12 } }
}

describe('computeCashflow', () => {
  it('books recurring costs every active month and one-off costs once', () => {
    const s = emptyState()
    s.costs = [
      { id: 'r', name: 'rent', monthlyAmount: 100, recurring: true, multiplier: 2, startMonth: 3, endMonth: 5, comment: '' },
      { id: 'o', name: 'notary', monthlyAmount: 1000, recurring: false, multiplier: 1, startMonth: 2, endMonth: null, comment: '' },
    ]
    const rows = computeCashflow(s)
    expect(rows.map((r) => r.costs.r)).toEqual([0, 0, 200, 200, 200, 0, 0, 0, 0, 0, 0, 0])
    expect(rows.map((r) => r.costs.o)).toEqual([0, 1000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
  })

  it('applies employee start month, employer surcharge and eligible share', () => {
    const s = emptyState()
    s.settings.employerSurchargePct = 20
    s.employees = [{ id: 'e', name: 'Dev', monthlySalary: 5000, startMonth: 4, endMonth: null, fundingEligiblePct: 60 }]
    const rows = computeCashflow(s)
    expect(rows[2].personnel).toBe(0)
    expect(rows[3].personnel).toBeCloseTo(6000)
    expect(rows[3].eligiblePersonnel).toBeCloseTo(3600)
    expect(eligiblePersonnelBetween(s, 1, 12)).toBeCloseTo(3600 * 9)
  })

  it('funds 80 % of eligible costs and leaves 20 % as own contribution', () => {
    const s = emptyState()
    s.grantComponents = [{ id: 'a', name: 'X', basis: 'manual', amount: 1_000_000, ratePct: 80, grantSharePct: 100 }]
    const f = fundingBreakdown(s)
    expect(f.funding).toBeCloseTo(800_000)
    expect(f.grant).toBeCloseTo(800_000)
    expect(f.loan).toBeCloseTo(0)
    expect(f.own).toBeCloseTo(200_000)
  })

  it('splits funding into grant (Zuschuss) and loan (Darlehen) per component', () => {
    const s = emptyState()
    s.grantComponents = [
      { id: 'a', name: 'X', basis: 'manual', amount: 1_000_000, ratePct: 80, grantSharePct: 60 },
      { id: 'b', name: 'Z', basis: 'manual', amount: 100_000, ratePct: 50, grantSharePct: 0 },
    ]
    const f = fundingBreakdown(s)
    expect(f.components[0]).toMatchObject({ funding: 800_000, grant: 480_000, loan: 320_000, own: 200_000 })
    expect(f.components[1]).toMatchObject({ funding: 50_000, grant: 0, loan: 50_000, own: 50_000 })
    expect(f.grant).toBeCloseTo(480_000)
    expect(f.loan).toBeCloseTo(370_000)
    expect(f.own).toBeCloseTo(250_000)
  })

  it('funds only the eligible share of personnel within the funding period (70 % x 80 %)', () => {
    const s = emptyState()
    s.settings.employerSurchargePct = 0
    s.fundingPeriod = { fromMonth: 1, toMonth: 10 }
    s.employees = [{ id: 'e', name: 'Dev', monthlySalary: 1000, startMonth: 1, endMonth: null, fundingEligiblePct: 70 }]
    s.grantComponents = [{ id: 'p', name: 'Personnel', basis: 'personnel', amount: 0, ratePct: 80, grantSharePct: 100 }]
    const f = fundingBreakdown(s)
    expect(f.eligible).toBeCloseTo(7000)
    expect(f.funding).toBeCloseTo(5600)
    expect(f.own).toBeCloseTo(1400)
  })

  it('adds tranches and founder cash in their months and keeps a running balance', () => {
    const s = emptyState()
    s.settings.startingCash = 1000
    s.costs = [{ id: 'r', name: 'x', monthlyAmount: 500, recurring: true, multiplier: 1, startMonth: 1, endMonth: null, comment: '' }]
    s.tranches = [
      { id: 't', kind: 'grant', month: 3, amount: 1500 },
      { id: 'l', kind: 'loan', month: 3, amount: 500 },
    ]
    s.founderCash = [{ id: 'f', founder: 'A', month: 1, amount: 500 }]
    const rows = computeCashflow(s)
    expect(rows.map((r) => r.closingBalance).slice(0, 4)).toEqual([1000, 500, 2000, 1500])
    const sum = summarize(s, rows)
    expect(rows[2].grantIn).toBe(1500)
    expect(rows[2].loanIn).toBe(500)
    expect(sum.grantReceived).toBe(1500)
    expect(sum.loanReceived).toBe(500)
    expect(sum.founderTotal).toBe(500)
    expect(sum.firstNegativeMonth).toBe(8)
    expect(sum.runwayMonths).toBe(7)
  })

  it('matches the spreadsheet yearly total of 408,420 incl. founders', () => {
    const s = createInitialState()
    const year1 = yearlyTotals(computeCashflow(s))[0]
    expect(year1.totalOut).toBeCloseTo(408420, -1)
  })
})
