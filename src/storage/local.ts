import { createInitialState } from '../data/initialState'
import type { CostItem, Employee, GrantComponent, PlanState, Tranche } from '../model/types'

const KEY = 'pioneer-cashflow:state'

export function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

/** Fills in missing fields so older or hand-edited JSON still loads. */
export function normalizeState(raw: unknown): PlanState {
  const base = createInitialState()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Partial<PlanState>
  const arr = <T,>(v: unknown, fallback: T[]): T[] => (Array.isArray(v) ? (v as T[]) : fallback)
  return {
    version: 1,
    settings: { ...base.settings, ...(r.settings ?? {}) },
    costs: arr<Partial<CostItem>>(r.costs, base.costs).map((c) => ({ ...base.costs[0], comment: '', endMonth: null, ...c })),
    employees: arr<Partial<Employee>>(r.employees, base.employees).map((e) => ({ ...base.employees[0], endMonth: null, ...e })),
    fundingPeriod: { ...base.fundingPeriod, ...(r.fundingPeriod ?? {}) },
    // components saved before the grant/loan split were plain "amount x rate" grants
    grantComponents: arr<Partial<GrantComponent>>(r.grantComponents, base.grantComponents).map((g) => ({
      id: newId('g'),
      name: '',
      amount: 0,
      ratePct: 80,
      ...g,
      basis: g.basis === 'personnel' ? 'personnel' : 'manual',
      grantSharePct: g.grantSharePct ?? 100,
    })),
    tranches: arr<Partial<Tranche>>(r.tranches, base.tranches).map((t) => ({
      id: newId('t'),
      month: 1,
      amount: 0,
      ...t,
      kind: t.kind === 'loan' ? 'loan' : 'grant',
    })),
    founderCash: arr(r.founderCash, base.founderCash),
  }
}

export function loadLocal(): PlanState | null {
  try {
    const s = localStorage.getItem(KEY)
    return s ? normalizeState(JSON.parse(s)) : null
  } catch {
    return null
  }
}

export function saveLocal(state: PlanState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // storage full or disabled; nothing sensible to do
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
