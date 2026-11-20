import { createInitialState } from '../data/initialState'
import type { CostItem, Employee, FundingRules, PlanState, RevenueItem, Tranche } from '../model/types'

export function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

interface LegacyFunding extends Partial<FundingRules> {
  fromMonth?: number
  toMonth?: number
}

interface LegacyCost extends Partial<Omit<CostItem, 'perEmployee'>> {
  multiplier?: unknown
  perEmployee?: unknown
}

interface LegacyState extends Partial<Omit<PlanState, 'funding' | 'costs'>> {
  funding?: LegacyFunding
  fundingPeriod?: { fromMonth?: number; toMonth?: number }
  grantComponents?: { basis?: string; ratePct?: number }[]
  costs?: unknown
}

function finiteNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** Old scenarios stored a numeric factor. Fold it into the amount and start the line as a single cost. */
function normalizeCost(raw: LegacyCost, fallback: CostItem): CostItem {
  const hasSwitch = typeof raw.perEmployee === 'boolean'
  const multiplier = finiteNumber(raw.multiplier) ?? 1
  const monthlyAmount = finiteNumber(raw.monthlyAmount) ?? fallback.monthlyAmount
  const endMonth = raw.endMonth === null || finiteNumber(raw.endMonth) != null ? (raw.endMonth as number | null) : fallback.endMonth
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : fallback.id,
    name: typeof raw.name === 'string' ? raw.name : fallback.name,
    monthlyAmount: hasSwitch ? monthlyAmount : monthlyAmount * multiplier,
    recurring: typeof raw.recurring === 'boolean' ? raw.recurring : fallback.recurring,
    perEmployee: raw.perEmployee === true,
    startMonth: finiteNumber(raw.startMonth) ?? fallback.startMonth,
    endMonth,
    comment: typeof raw.comment === 'string' ? raw.comment : '',
  }
}

/** Fills in missing fields and drops the old grant/loan split so saved scenarios still load. */
export function normalizeState(raw: unknown): PlanState {
  const base = createInitialState()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as LegacyState
  const arr = <T,>(v: unknown, fallback: T[]): T[] => (Array.isArray(v) ? (v as T[]) : fallback)
  const personnel = r.grantComponents?.find((c) => c.basis === 'personnel')
  const incoming = r.funding
  const funding: FundingRules = {
    ratePct: incoming?.ratePct ?? personnel?.ratePct ?? base.funding.ratePct,
    additionalCostPct: incoming?.additionalCostPct ?? base.funding.additionalCostPct,
    amount: incoming?.amount ?? base.funding.amount,
    payMonthly: incoming?.payMonthly ?? base.funding.payMonthly,
  }
  return {
    version: 1,
    settings: { ...base.settings, ...(r.settings ?? {}) },
    costs: arr<LegacyCost>(r.costs, base.costs).map((c) => normalizeCost(c, { ...base.costs[0], comment: '', endMonth: null })),
    employees: arr<Partial<Employee>>(r.employees, base.employees).map((e) => ({ ...base.employees[0], endMonth: null, ...e })),
    funding,
    tranches: arr<Partial<Tranche>>(r.tranches, []).map((t) => ({
      id: t.id ?? newId('t'),
      month: t.month ?? 1,
    })),
    founderCash: arr(r.founderCash, base.founderCash),
    revenue: arr<Partial<RevenueItem>>(r.revenue, []).map((item) => ({
      id: newId('r'),
      name: '',
      amount: 0,
      recurring: true,
      startMonth: 1,
      endMonth: null,
      ...item,
    })),
  }
}

export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportJson(state: PlanState, name = 'cashflow-scenario'): void {
  downloadFile(`${name}.json`, JSON.stringify(state, null, 2), 'application/json')
}

export async function importJson(file: File): Promise<PlanState> {
  const text = await file.text()
  return normalizeState(JSON.parse(text))
}
