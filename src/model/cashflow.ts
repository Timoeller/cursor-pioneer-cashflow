import type { CostItem, Employee, MonthRow, PlanState } from './types'

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

function isActive(start: number, end: number | null, month: number): boolean {
  return month >= start && (end == null || month <= end)
}

export function costInMonth(c: CostItem, month: number): number {
  const amount = num(c.monthlyAmount) * num(c.multiplier)
  if (c.recurring) return isActive(num(c.startMonth), c.endMonth, month) ? amount : 0
  return month === num(c.startMonth) ? amount : 0
}

export function employeeMonthlyCost(e: Employee, surchargePct: number): number {
  return num(e.monthlySalary) * (1 + num(surchargePct) / 100)
}

export function personnelInMonth(e: Employee, month: number, surchargePct: number): number {
  return isActive(num(e.startMonth), e.endMonth, month) ? employeeMonthlyCost(e, surchargePct) : 0
}

export function grantTotal(state: PlanState): number {
  return state.grantComponents.reduce((s, g) => s + (num(g.amount) * num(g.ratePct)) / 100, 0)
}

export function trancheTotal(state: PlanState): number {
  return state.tranches.reduce((s, t) => s + num(t.amount), 0)
}

/** Funding-eligible personnel cost (cost x eligible %) summed over months [from, to]. */
export function eligiblePersonnelBetween(state: PlanState, from: number, to: number): number {
  let total = 0
  for (let m = from; m <= to; m++) {
    for (const e of state.employees) {
      total += (personnelInMonth(e, m, state.settings.employerSurchargePct) * num(e.fundingEligiblePct)) / 100
    }
  }
  return total
}

export function computeCashflow(state: PlanState): MonthRow[] {
  const rows: MonthRow[] = []
  const horizon = Math.max(1, Math.floor(num(state.settings.horizonMonths)))
  const surcharge = state.settings.employerSurchargePct
  let balance = num(state.settings.startingCash)

  for (let month = 1; month <= horizon; month++) {
    const costs: Record<string, number> = {}
    let otherCosts = 0
    for (const c of state.costs) {
      const v = costInMonth(c, month)
      costs[c.id] = v
      otherCosts += v
    }

    const personnelByEmployee: Record<string, number> = {}
    let personnel = 0
    let eligiblePersonnel = 0
    for (const e of state.employees) {
      const v = personnelInMonth(e, month, surcharge)
      personnelByEmployee[e.id] = v
      personnel += v
      eligiblePersonnel += (v * num(e.fundingEligiblePct)) / 100
    }

    const grantIn = state.tranches.filter((t) => num(t.month) === month).reduce((s, t) => s + num(t.amount), 0)
    const founderIn = state.founderCash.filter((f) => num(f.month) === month).reduce((s, f) => s + num(f.amount), 0)
    const totalIn = grantIn + founderIn
    const totalOut = otherCosts + personnel
    const net = totalIn - totalOut
    const openingBalance = balance
    balance += net

    rows.push({
      month,
      costs,
      otherCosts,
      personnel,
      personnelByEmployee,
      eligiblePersonnel,
      grantIn,
      founderIn,
      totalIn,
      totalOut,
      net,
      openingBalance,
      closingBalance: balance,
    })
  }
  return rows
}

export interface Summary {
  totalOut: number
  personnel: number
  otherCosts: number
  eligiblePersonnel: number
  grantTotal: number
  grantReceived: number
  trancheTotal: number
  founderTotal: number
  totalIn: number
  avgMonthlyBurn: number
  avgNetBurn: number
  minBalance: number
  minBalanceMonth: number
  endBalance: number
  firstNegativeMonth: number | null
  /** Months covered before the balance first goes negative. */
  runwayMonths: number
  grantShareOfCosts: number
}

export function summarize(state: PlanState, rows: MonthRow[]): Summary {
  const sum = (f: (r: MonthRow) => number) => rows.reduce((s, r) => s + f(r), 0)
  const totalOut = sum((r) => r.totalOut)
  const grantReceived = sum((r) => r.grantIn)
  let minBalance = num(state.settings.startingCash)
  let minBalanceMonth = 0
  let firstNegativeMonth: number | null = null
  for (const r of rows) {
    if (r.closingBalance < minBalance) {
      minBalance = r.closingBalance
      minBalanceMonth = r.month
    }
    if (firstNegativeMonth == null && r.closingBalance < 0) firstNegativeMonth = r.month
  }
  const months = rows.length || 1
  return {
    totalOut,
    personnel: sum((r) => r.personnel),
    otherCosts: sum((r) => r.otherCosts),
    eligiblePersonnel: sum((r) => r.eligiblePersonnel),
    grantTotal: grantTotal(state),
    grantReceived,
    trancheTotal: trancheTotal(state),
    founderTotal: sum((r) => r.founderIn),
    totalIn: sum((r) => r.totalIn),
    avgMonthlyBurn: totalOut / months,
    avgNetBurn: -sum((r) => r.net) / months,
    minBalance,
    minBalanceMonth,
    endBalance: rows.length ? rows[rows.length - 1].closingBalance : num(state.settings.startingCash),
    firstNegativeMonth,
    runwayMonths: firstNegativeMonth == null ? rows.length : firstNegativeMonth - 1,
    grantShareOfCosts: totalOut > 0 ? grantReceived / totalOut : 0,
  }
}

export interface YearRow {
  year: number
  fromMonth: number
  toMonth: number
  otherCosts: number
  personnel: number
  grantIn: number
  founderIn: number
  totalIn: number
  totalOut: number
  net: number
  closingBalance: number
}

export function yearlyTotals(rows: MonthRow[]): YearRow[] {
  const years: YearRow[] = []
  for (const r of rows) {
    const year = Math.ceil(r.month / 12)
    let y = years[year - 1]
    if (!y) {
      y = { year, fromMonth: r.month, toMonth: r.month, otherCosts: 0, personnel: 0, grantIn: 0, founderIn: 0, totalIn: 0, totalOut: 0, net: 0, closingBalance: 0 }
      years.push(y)
    }
    y.toMonth = r.month
    y.otherCosts += r.otherCosts
    y.personnel += r.personnel
    y.grantIn += r.grantIn
    y.founderIn += r.founderIn
    y.totalIn += r.totalIn
    y.totalOut += r.totalOut
    y.net += r.net
    y.closingBalance = r.closingBalance
  }
  return years
}
