export interface Settings {
  horizonMonths: number
  /** ISO month (YYYY-MM) of month 1; only used for calendar labels. */
  foundingMonth: string
  employerSurchargePct: number
  startingCash: number
  currency: string
}

export interface CostItem {
  id: string
  name: string
  monthlyAmount: number
  recurring: boolean
  multiplier: number
  startMonth: number
  endMonth: number | null
  comment: string
}

export interface Employee {
  id: string
  name: string
  monthlySalary: number
  startMonth: number
  endMonth: number | null
  fundingEligiblePct: number
}

/** How the grant covers costs. There is no loan component. */
export interface FundingRules {
  /** Share of fundable personnel costs the grant pays, e.g. 80. The rest is own contribution. */
  ratePct: number
  /**
   * Additional (non-personnel) costs the grant covers, as a percentage of fundable
   * personnel costs. The funding rate is not applied on top. E.g. 40.
   */
  additionalCostPct: number
  /** Total grant money. It is drawn down each month until nothing is left. */
  amount: number
  /** Paid each month as costs are covered. When false, cash arrives through tranches. */
  payMonthly: boolean
}

export interface Tranche {
  id: string
  /** Month the tranche is released. The amount is calculated, not entered. */
  month: number
}

export interface RevenueItem {
  id: string
  name: string
  amount: number
  recurring: boolean
  startMonth: number
  endMonth: number | null
}

export interface FounderInjection {
  id: string
  founder: string
  month: number
  amount: number
}

export interface PlanState {
  version: 1
  settings: Settings
  costs: CostItem[]
  employees: Employee[]
  funding: FundingRules
  tranches: Tranche[]
  founderCash: FounderInjection[]
  revenue: RevenueItem[]
}

export interface MonthRow {
  month: number
  /** Cost per cost item id. */
  costs: Record<string, number>
  otherCosts: number
  personnel: number
  /** Personnel cost per employee id (incl. employer surcharge). */
  personnelByEmployee: Record<string, number>
  /** Personnel cost x funding-eligible %. */
  fundablePersonnel: number
  /** What the rules would pay this month before the grant amount runs out. */
  grantClaim: number
  /** Fundable personnel x funding rate, capped by the grant money still left. */
  grantOnPersonnel: number
  /** Fundable personnel x additional-cost rate. The funding rate is not applied. */
  additionalAllowance: number
  /** Additional costs the grant pays: the allowance, capped by real other costs and by money left. */
  grantOnAdditional: number
  /** grantOnPersonnel + grantOnAdditional. */
  grantCovered: number
  /** Grant money left after this month. */
  grantRemaining: number
  /** Costs the grant does not cover. Founders finance this; revenue reduces the cash needed. */
  founderBorne: number
  revenueIn: number
  /** Grant cash received this month. */
  grantIn: number
  founderIn: number
  totalIn: number
  totalOut: number
  net: number
  openingBalance: number
  closingBalance: number
}
