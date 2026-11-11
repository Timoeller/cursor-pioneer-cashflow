import type { CostItem, Employee, MonthRow, PlanState, RevenueItem } from './types'

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

function isActive(start: number, end: number | null, month: number): boolean {
  return month >= start && (end == null || month <= end)
}

export function costInMonth(c: CostItem, month: number): number {
  const amount = num(c.monthlyAmount) * num(c.multiplier)
  if (c.recurring) return isActive(num(c.startMonth), c.endMonth, month) ? amount : 0
  return month === num(c.startMonth) ? amount : 0
}

export function revenueInMonth(r: RevenueItem, month: number): number {
  const amount = num(r.amount)
  if (r.recurring) return isActive(num(r.startMonth), r.endMonth, month) ? amount : 0
  return month === num(r.startMonth) ? amount : 0
}

export function employeeMonthlyCost(e: Employee, surchargePct: number): number {
  return num(e.monthlySalary) * (1 + num(surchargePct) / 100)
}

export function personnelInMonth(e: Employee, month: number, surchargePct: number): number {
  return isActive(num(e.startMonth), e.endMonth, month) ? employeeMonthlyCost(e, surchargePct) : 0
}

export interface EmployeeFunding {
  id: string
  /** Employer cost over the whole horizon. */
  cost: number
  /** cost x funding-eligible %. */
  fundable: number
  /** This person's share of the personnel grant actually paid. */
  grant: number
  /** This person's share of the additional-cost grant actually paid. */
  additional: number
  /** cost - grant. The part of this person's own cost the founders finance. */
  founder: number
}

/** Per employee, using the grant money that was actually drawn down. */
export function employeeFunding(state: PlanState, rows: MonthRow[]): EmployeeFunding[] {
  const rate = num(state.funding.ratePct) / 100
  const additionalRate = num(state.funding.additionalCostPct) / 100
  const totals = new Map<string, EmployeeFunding>()
  for (const e of state.employees) totals.set(e.id, { id: e.id, cost: 0, fundable: 0, grant: 0, additional: 0, founder: 0 })

  for (const row of rows) {
    const parts = state.employees.map((e) => {
      const cost = row.personnelByEmployee[e.id] ?? 0
      const fundable = (cost * num(e.fundingEligiblePct)) / 100
      return { id: e.id, cost, fundable, claim: fundable * rate, allowance: fundable * additionalRate }
    })
    const claimSum = parts.reduce((s, p) => s + p.claim, 0)
    const allowanceSum = parts.reduce((s, p) => s + p.allowance, 0)
    const personnelScale = claimSum > 0 ? row.grantOnPersonnel / claimSum : 0
    const additionalScale = allowanceSum > 0 ? row.grantOnAdditional / allowanceSum : 0
    for (const p of parts) {
      const t = totals.get(p.id)!
      t.cost += p.cost
      t.fundable += p.fundable
      t.grant += p.claim * personnelScale
      t.additional += p.allowance * additionalScale
    }
  }
  for (const t of totals.values()) t.founder = t.cost - t.grant
  return [...totals.values()]
}

export function computeCashflow(state: PlanState): MonthRow[] {
  const rows: MonthRow[] = []
  const horizon = Math.max(1, Math.floor(num(state.settings.horizonMonths)))
  const surcharge = state.settings.employerSurchargePct
  const rate = num(state.funding.ratePct) / 100
  const additionalRate = num(state.funding.additionalCostPct) / 100
  let pot = Math.max(0, num(state.funding.amount))
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
    let fundablePersonnel = 0
    for (const e of state.employees) {
      const v = personnelInMonth(e, month, surcharge)
      personnelByEmployee[e.id] = v
      personnel += v
      fundablePersonnel += (v * num(e.fundingEligiblePct)) / 100
    }

    const personnelClaim = fundablePersonnel * rate
    const additionalAllowance = fundablePersonnel * additionalRate
    const additionalClaim = Math.min(otherCosts, additionalAllowance)
    const grantClaim = personnelClaim + additionalClaim
    // Salaries are paid from the grant first, then additional costs, until the amount is used up.
    const grantOnPersonnel = Math.min(personnelClaim, pot)
    pot -= grantOnPersonnel
    const grantOnAdditional = Math.min(additionalClaim, pot)
    pot -= grantOnAdditional
    const grantCovered = grantOnPersonnel + grantOnAdditional
    const totalOut = otherCosts + personnel
    const founderBorne = totalOut - grantCovered

    const revenueIn = state.revenue.reduce((s, r) => s + revenueInMonth(r, month), 0)
    const trancheIn = state.tranches.filter((t) => num(t.month) === month).reduce((s, t) => s + num(t.amount), 0)
    const grantIn = state.funding.payMonthly ? grantCovered : trancheIn
    const founderIn = state.founderCash.filter((f) => num(f.month) === month).reduce((s, f) => s + num(f.amount), 0)
    const totalIn = grantIn + founderIn + revenueIn
    const net = totalIn - totalOut
    const openingBalance = balance
    balance += net

    rows.push({
      month,
      costs,
      otherCosts,
      personnel,
      personnelByEmployee,
      fundablePersonnel,
      grantClaim,
      grantOnPersonnel,
      additionalAllowance,
      grantOnAdditional,
      grantCovered,
      grantRemaining: pot,
      founderBorne,
      revenueIn,
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
  fundablePersonnel: number
  grantOnPersonnel: number
  additionalAllowance: number
  grantOnAdditional: number
  /** What the grant pays for: personnel share + additional costs within the allowance. */
  grantCovered: number
  /** The fixed grant amount. */
  grantAmount: number
  /** Grant money left after the last month. */
  grantRemaining: number
  /** First month the grant cannot pay everything the rules would cover. Null when money is left at the end. */
  runsOutMonth: number | null
  /** Costs the grant does not cover. */
  founderBorne: number
  revenue: number
  /** founderBorne minus revenue: cash the founders still have to supply. Never negative. */
  foundersNeed: number
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
  runwayMonths: number
}

export function summarize(state: PlanState, rows: MonthRow[]): Summary {
  const sum = (f: (r: MonthRow) => number) => rows.reduce((s, r) => s + f(r), 0)
  const totalOut = sum((r) => r.totalOut)
  const founderBorne = sum((r) => r.founderBorne)
  const revenue = sum((r) => r.revenueIn)
  let minBalance = num(state.settings.startingCash)
  let minBalanceMonth = 0
  let firstNegativeMonth: number | null = null
  let runsOutMonth: number | null = null
  for (const r of rows) {
    if (runsOutMonth == null && r.grantClaim - r.grantCovered > 0.5) runsOutMonth = r.month
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
    fundablePersonnel: sum((r) => r.fundablePersonnel),
    grantOnPersonnel: sum((r) => r.grantOnPersonnel),
    additionalAllowance: sum((r) => r.additionalAllowance),
    grantOnAdditional: sum((r) => r.grantOnAdditional),
    grantCovered: sum((r) => r.grantCovered),
    grantAmount: Math.max(0, num(state.funding.amount)),
    grantRemaining: rows.length ? rows[rows.length - 1].grantRemaining : Math.max(0, num(state.funding.amount)),
    runsOutMonth,
    founderBorne,
    revenue,
    foundersNeed: Math.max(0, founderBorne - revenue),
    grantReceived: sum((r) => r.grantIn),
    trancheTotal: state.tranches.reduce((s, t) => s + num(t.amount), 0),
    founderTotal: sum((r) => r.founderIn),
    totalIn: sum((r) => r.totalIn),
    avgMonthlyBurn: totalOut / months,
    avgNetBurn: -sum((r) => r.net) / months,
    minBalance,
    minBalanceMonth,
    endBalance: rows.length ? rows[rows.length - 1].closingBalance : num(state.settings.startingCash),
    firstNegativeMonth,
    runwayMonths: firstNegativeMonth == null ? rows.length : firstNegativeMonth - 1,
  }
}

export interface YearRow {
  year: number
  fromMonth: number
  toMonth: number
  otherCosts: number
  personnel: number
  revenueIn: number
  grantIn: number
  grantCovered: number
  grantRemaining: number
  founderBorne: number
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
      y = {
        year,
        fromMonth: r.month,
        toMonth: r.month,
        otherCosts: 0,
        personnel: 0,
        revenueIn: 0,
        grantIn: 0,
        grantCovered: 0,
        grantRemaining: 0,
        founderBorne: 0,
        founderIn: 0,
        totalIn: 0,
        totalOut: 0,
        net: 0,
        closingBalance: 0,
      }
      years.push(y)
    }
    y.toMonth = r.month
    y.otherCosts += r.otherCosts
    y.personnel += r.personnel
    y.revenueIn += r.revenueIn
    y.grantIn += r.grantIn
    y.grantCovered += r.grantCovered
    y.grantRemaining = r.grantRemaining
    y.founderBorne += r.founderBorne
    y.founderIn += r.founderIn
    y.totalIn += r.totalIn
    y.totalOut += r.totalOut
    y.net += r.net
    y.closingBalance = r.closingBalance
  }
  return years
}
