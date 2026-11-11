import { describe, expect, it } from 'vitest'
import { createInitialState } from '../data/initialState'
import { computeCashflow, employeeFunding, summarize, yearlyTotals } from './cashflow'
import type { PlanState } from './types'

function emptyState(): PlanState {
  const s = createInitialState()
  return {
    ...s,
    costs: [],
    employees: [],
    tranches: [],
    founderCash: [],
    revenue: [],
    settings: { ...s.settings, horizonMonths: 12 },
    funding: { ...s.funding, payMonthly: true, amount: 1_000_000, ratePct: 80, additionalCostPct: 40 },
  }
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

  it('covers fundable personnel at the funding rate and leaves the rest to the founders', () => {
    const s = emptyState()
    s.settings.employerSurchargePct = 0
    s.employees = [{ id: 'e', name: 'Dev', monthlySalary: 100, startMonth: 1, endMonth: null, fundingEligiblePct: 50 }]
    const row = computeCashflow(s)[0]
    // 100 x 50% x 80% = 40 covered, founders finance 60
    expect(row.fundablePersonnel).toBeCloseTo(50)
    expect(row.grantOnPersonnel).toBeCloseTo(40)
    expect(row.founderBorne).toBeCloseTo(60)
    expect(row.grantIn).toBeCloseTo(40)
  })

  it('funds 1,000 of personnel at 80% and asks the founders for 250, which is 20% of the costs', () => {
    const s = emptyState()
    s.settings.employerSurchargePct = 0
    s.funding.additionalCostPct = 0
    s.employees = [{ id: 'e', name: 'Dev', monthlySalary: 1250, startMonth: 1, endMonth: 1, fundingEligiblePct: 100 }]
    const row = computeCashflow(s)[0]
    expect(row.grantOnPersonnel).toBeCloseTo(1000)
    expect(row.founderBorne).toBeCloseTo(250)
  })

  it('allows additional costs of 40% of fundable personnel, without applying the funding rate', () => {
    const s = emptyState()
    s.settings.employerSurchargePct = 0
    s.employees = [{ id: 'e', name: 'Dev', monthlySalary: 100, startMonth: 1, endMonth: 1, fundingEligiblePct: 50 }]
    // allowance = 100 x 50% x 40% = 20
    s.costs = [{ id: 'c', name: 'office', monthlyAmount: 30, recurring: false, multiplier: 1, startMonth: 1, endMonth: null, comment: '' }]
    const row = computeCashflow(s)[0]
    expect(row.additionalAllowance).toBeCloseTo(20)
    expect(row.grantOnAdditional).toBeCloseTo(20)
    expect(row.grantCovered).toBeCloseTo(60)
    // founders: 60 of the salary + 10 of additional costs
    expect(row.founderBorne).toBeCloseTo(70)

    s.costs[0].monthlyAmount = 10
    expect(computeCashflow(s)[0].grantOnAdditional).toBeCloseTo(10)
  })

  it('draws the fixed grant down until it runs out, paying salaries before additional costs', () => {
    const s = emptyState()
    s.settings.employerSurchargePct = 0
    s.settings.horizonMonths = 4
    s.funding.amount = 100
    s.employees = [{ id: 'e', name: 'Dev', monthlySalary: 100, startMonth: 1, endMonth: null, fundingEligiblePct: 50 }]
    s.costs = [{ id: 'c', name: 'office', monthlyAmount: 30, recurring: true, multiplier: 1, startMonth: 1, endMonth: null, comment: '' }]
    const rows = computeCashflow(s)
    // each month would claim 40 of salary + 20 of additional costs
    expect(rows[0].grantCovered).toBeCloseTo(60)
    expect(rows[0].grantRemaining).toBeCloseTo(40)
    expect(rows[1].grantOnPersonnel).toBeCloseTo(40)
    expect(rows[1].grantOnAdditional).toBeCloseTo(0)
    expect(rows[2].grantCovered).toBe(0)
    expect(summarize(s, rows).runsOutMonth).toBe(2)
    expect(employeeFunding(s, rows)[0].grant).toBeCloseTo(80)
  })

  it('uses tranches instead of monthly payout when payMonthly is off', () => {
    const s = emptyState()
    s.settings.startingCash = 1000
    s.funding.payMonthly = false
    s.costs = [{ id: 'r', name: 'x', monthlyAmount: 500, recurring: true, multiplier: 1, startMonth: 1, endMonth: null, comment: '' }]
    s.tranches = [{ id: 't', month: 3, amount: 2000 }]
    s.founderCash = [{ id: 'f', founder: 'A', month: 1, amount: 500 }]
    const rows = computeCashflow(s)
    expect(rows[0].grantIn).toBe(0)
    expect(rows[2].grantIn).toBe(2000)
    expect(rows.map((r) => r.closingBalance).slice(0, 4)).toEqual([1000, 500, 2000, 1500])
    const sum = summarize(s, rows)
    expect(sum.grantReceived).toBe(2000)
    expect(sum.founderTotal).toBe(500)
    expect(sum.firstNegativeMonth).toBe(8)
  })

  it('adds recurring and one-time revenue and reduces what founders must supply', () => {
    const s = emptyState()
    s.revenue = [
      { id: 'm', name: 'retainer', amount: 100, recurring: true, startMonth: 2, endMonth: 3 },
      { id: 'o', name: 'project', amount: 500, recurring: false, startMonth: 4, endMonth: null },
    ]
    const rows = computeCashflow(s)
    expect(rows.map((r) => r.revenueIn).slice(0, 4)).toEqual([0, 100, 100, 500])
    const sum = summarize(s, rows)
    expect(sum.foundersNeed).toBeCloseTo(Math.max(0, sum.founderBorne - 700))
  })

  it('matches the spreadsheet yearly total of 408,420 incl. founders', () => {
    const s = createInitialState()
    const year1 = yearlyTotals(computeCashflow(s))[0]
    expect(year1.totalOut).toBeCloseTo(408420, -1)
  })
})
