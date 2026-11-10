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
  fromMonth: number
  toMonth: number
  /** Paid each month as costs are covered. When false, cash arrives through tranches. */
  payMonthly: boolean
}

export interface Tranche {
  id: string
  month: number
  amount: number
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
  /** Fundable personnel x funding rate. Zero outside the funding period. */
  grantOnPersonnel: number
  /** Fundable personnel x additional-cost rate. The funding rate is not applied. */
  additionalAllowance: number
  /** Additional costs the grant actually pays: the allowance, capped by real other costs. */
  grantOnAdditional: number
  /** grantOnPersonnel + grantOnAdditional. */
  grantCovered: number
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
