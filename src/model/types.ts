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

/**
 * A block of eligible costs. Funding = eligible x ratePct; the rest is own
 * contribution. Funding is split into grant (Zuschuss) and loan (Darlehen).
 */
export interface GrantComponent {
  id: string
  name: string
  /** 'personnel': eligible costs derived from employees within the funding period. */
  basis: 'personnel' | 'manual'
  /** Eligible costs; only used when basis is 'manual'. */
  amount: number
  ratePct: number
  /** Share of the funding paid as grant (Zuschuss); the rest is loan (Darlehen). */
  grantSharePct: number
}

export type FundingKind = 'grant' | 'loan'

export interface Tranche {
  id: string
  kind: FundingKind
  month: number
  amount: number
}

export interface FundingPeriod {
  fromMonth: number
  toMonth: number
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
  fundingPeriod: FundingPeriod
  grantComponents: GrantComponent[]
  tranches: Tranche[]
  founderCash: FounderInjection[]
}

export interface MonthRow {
  month: number
  /** Cost per cost item id. */
  costs: Record<string, number>
  otherCosts: number
  personnel: number
  /** Personnel cost per employee id (incl. employer surcharge). */
  personnelByEmployee: Record<string, number>
  eligiblePersonnel: number
  /** Grant (Zuschuss) received. */
  grantIn: number
  /** Loan (Darlehen) received. */
  loanIn: number
  founderIn: number
  totalIn: number
  totalOut: number
  net: number
  openingBalance: number
  closingBalance: number
}
