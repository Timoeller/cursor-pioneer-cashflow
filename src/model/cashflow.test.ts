import { describe, expect, it } from 'vitest'
import { createInitialState } from '../data/initialState'
import { computeCashflow, eligiblePersonnelBetween, grantTotal, summarize, yearlyTotals } from './cashflow'
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

  it('computes grant total from multiple components', () => {
    const s = emptyState()
    s.grantComponents = [
      { id: 'a', name: 'X', amount: 100000, ratePct: 70 },
      { id: 'b', name: 'Z', amount: 50000, ratePct: 50 },
    ]
    expect(grantTotal(s)).toBeCloseTo(95000)
  })

  it('adds tranches and founder cash in their months and keeps a running balance', () => {
    const s = emptyState()
    s.settings.startingCash = 1000
    s.costs = [{ id: 'r', name: 'x', monthlyAmount: 500, recurring: true, multiplier: 1, startMonth: 1, endMonth: null, comment: '' }]
    s.tranches = [{ id: 't', month: 3, amount: 2000 }]
    s.founderCash = [{ id: 'f', founder: 'A', month: 1, amount: 500 }]
    const rows = computeCashflow(s)
    expect(rows.map((r) => r.closingBalance).slice(0, 4)).toEqual([1000, 500, 2000, 1500])
    const sum = summarize(s, rows)
    expect(sum.grantReceived).toBe(2000)
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
