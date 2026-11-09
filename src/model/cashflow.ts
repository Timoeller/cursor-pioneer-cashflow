import type { CostItem, Employee, FundingKind, GrantComponent, MonthRow, PlanState, Tranche } from './types'

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

export interface ComponentFunding {
  id: string
  name: string
  eligible: number
  ratePct: number
  /** eligible x rate */
  funding: number
  /** Zuschuss */
  grant: number
  /** Darlehen */
  loan: number
  /** Eigenanteil: eligible - funding */
  own: number
}

export interface FundingBreakdown {
  components: ComponentFunding[]
  eligible: number
  funding: number
  grant: number
  loan: number
  own: number
  /** Scheduled tranches per kind. */
  scheduledGrant: number
  scheduledLoan: number
}

export function componentEligible(state: PlanState, g: GrantComponent): number {
  if (g.basis === 'personnel') {
    return eligiblePersonnelBetween(state, num(state.fundingPeriod.fromMonth), num(state.fundingPeriod.toMonth))
  }
  return num(g.amount)
}

export function fundingBreakdown(state: PlanState): FundingBreakdown {
  const components = state.grantComponents.map((g): ComponentFunding => {
    const eligible = componentEligible(state, g)
    const funding = (eligible * num(g.ratePct)) / 100
    const grant = (funding * num(g.grantSharePct)) / 100
    return { id: g.id, name: g.name, eligible, ratePct: num(g.ratePct), funding, grant, loan: funding - grant, own: eligible - funding }
  })
  const sum = (f: (c: ComponentFunding) => number) => components.reduce((s, c) => s + f(c), 0)
  const scheduled = (kind: FundingKind) => state.tranches.filter((t) => trancheKind(t) === kind).reduce((s, t) => s + num(t.amount), 0)
  return {
    components,
    eligible: sum((c) => c.eligible),
    funding: sum((c) => c.funding),
    grant: sum((c) => c.grant),
    loan: sum((c) => c.loan),
    own: sum((c) => c.own),
    scheduledGrant: scheduled('grant'),
    scheduledLoan: scheduled('loan'),
  }
}

export function trancheKind(t: Tranche): FundingKind {
  return t.kind === 'loan' ? 'loan' : 'grant'
}

/** Funding rate of the first personnel-based component, used to show funding per employee. */
export function personnelFundingRatePct(state: PlanState): number | null {
  const g = state.grantComponents.find((c) => c.basis === 'personnel')
  return g ? num(g.ratePct) : null
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

    const tranchesIn = (kind: FundingKind) =>
      state.tranches.filter((t) => num(t.month) === month && trancheKind(t) === kind).reduce((s, t) => s + num(t.amount), 0)
    const grantIn = tranchesIn('grant')
    const loanIn = tranchesIn('loan')
    const founderIn = state.founderCash.filter((f) => num(f.month) === month).reduce((s, f) => s + num(f.amount), 0)
    const totalIn = grantIn + loanIn + founderIn
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
      loanIn,
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
  funding: FundingBreakdown
  grantReceived: number
  loanReceived: number
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
  /** (grant + loan received) / total costs */
  fundingShareOfCosts: number
}

export function summarize(state: PlanState, rows: MonthRow[]): Summary {
  const sum = (f: (r: MonthRow) => number) => rows.reduce((s, r) => s + f(r), 0)
  const totalOut = sum((r) => r.totalOut)
  const grantReceived = sum((r) => r.grantIn)
  const loanReceived = sum((r) => r.loanIn)
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
    funding: fundingBreakdown(state),
    grantReceived,
    loanReceived,
    founderTotal: sum((r) => r.founderIn),
    totalIn: sum((r) => r.totalIn),
    avgMonthlyBurn: totalOut / months,
    avgNetBurn: -sum((r) => r.net) / months,
    minBalance,
    minBalanceMonth,
    endBalance: rows.length ? rows[rows.length - 1].closingBalance : num(state.settings.startingCash),
    firstNegativeMonth,
    runwayMonths: firstNegativeMonth == null ? rows.length : firstNegativeMonth - 1,
    fundingShareOfCosts: totalOut > 0 ? (grantReceived + loanReceived) / totalOut : 0,
  }
}

export interface YearRow {
  year: number
  fromMonth: number
  toMonth: number
  otherCosts: number
  personnel: number
  grantIn: number
  loanIn: number
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
      y = { year, fromMonth: r.month, toMonth: r.month, otherCosts: 0, personnel: 0, grantIn: 0, loanIn: 0, founderIn: 0, totalIn: 0, totalOut: 0, net: 0, closingBalance: 0 }
      years.push(y)
    }
    y.toMonth = r.month
    y.otherCosts += r.otherCosts
    y.personnel += r.personnel
    y.grantIn += r.grantIn
    y.loanIn += r.loanIn
    y.founderIn += r.founderIn
    y.totalIn += r.totalIn
    y.totalOut += r.totalOut
    y.net += r.net
    y.closingBalance = r.closingBalance
  }
  return years
}
