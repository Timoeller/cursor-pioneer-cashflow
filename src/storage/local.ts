import { createInitialState } from '../data/initialState'
import type { CostItem, Employee, FundingRules, PlanState, RevenueItem, Tranche } from '../model/types'

export function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

interface LegacyState extends Partial<PlanState> {
  fundingPeriod?: { fromMonth?: number; toMonth?: number }
  grantComponents?: { basis?: string; ratePct?: number }[]
}

/** Fills in missing fields and drops the old grant/loan split so saved scenarios still load. */
export function normalizeState(raw: unknown): PlanState {
  const base = createInitialState()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as LegacyState
  const arr = <T,>(v: unknown, fallback: T[]): T[] => (Array.isArray(v) ? (v as T[]) : fallback)
  const personnel = r.grantComponents?.find((c) => c.basis === 'personnel')
  const funding: FundingRules = {
    ...base.funding,
    ...(personnel?.ratePct != null ? { ratePct: personnel.ratePct } : {}),
    ...(r.fundingPeriod
      ? { fromMonth: r.fundingPeriod.fromMonth ?? base.funding.fromMonth, toMonth: r.fundingPeriod.toMonth ?? base.funding.toMonth }
      : {}),
    ...(r.funding ?? {}),
  }
  return {
    version: 1,
    settings: { ...base.settings, ...(r.settings ?? {}) },
    costs: arr<Partial<CostItem>>(r.costs, base.costs).map((c) => ({ ...base.costs[0], comment: '', endMonth: null, ...c })),
    employees: arr<Partial<Employee>>(r.employees, base.employees).map((e) => ({ ...base.employees[0], endMonth: null, ...e })),
    funding,
    tranches: arr<Partial<Tranche>>(r.tranches, []).map((t) => ({
      id: t.id ?? newId('t'),
      month: t.month ?? 1,
      amount: t.amount ?? 0,
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
