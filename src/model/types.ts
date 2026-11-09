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

export interface GrantComponent {
  id: string
  name: string
  amount: number
  ratePct: number
}

export interface Tranche {
  id: string
  month: number
  amount: number
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
  grantIn: number
  founderIn: number
  totalIn: number
  totalOut: number
  net: number
  openingBalance: number
  closingBalance: number
}
