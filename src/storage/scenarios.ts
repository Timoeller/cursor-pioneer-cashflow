import type { PlanState } from '../model/types'
import { normalizeState } from './local'

export interface ScenarioMeta {
  id: string
  name: string
  updatedAt: number
}

export interface ScenarioStore {
  list(): Promise<ScenarioMeta[]>
  load(id: string): Promise<PlanState | null>
  create(name: string, state: PlanState): Promise<string>
  save(id: string, state: PlanState): Promise<void>
  rename(id: string, name: string): Promise<void>
  remove(id: string): Promise<void>
}

/** JSON with object keys sorted, so equal data compares equal whatever order Firestore returns the keys in. */
export function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : v,
  )
}

/** Firestore rejects `undefined`; a JSON round trip strips it. */
export function toPlain(state: PlanState): PlanState {
  return JSON.parse(JSON.stringify(state)) as PlanState
}

export function createMemoryStore(): ScenarioStore & { data: Map<string, { name: string; state: PlanState; updatedAt: number }> } {
  const data = new Map<string, { name: string; state: PlanState; updatedAt: number }>()
  let seq = 0
  let clock = 0
  const tick = () => ++clock
  return {
    data,
    async list() {
      return [...data].map(([id, d]) => ({ id, name: d.name, updatedAt: d.updatedAt })).sort((a, b) => b.updatedAt - a.updatedAt)
    },
    async load(id) {
      const d = data.get(id)
      return d ? normalizeState(d.state) : null
    },
    async create(name, state) {
      const id = `s${++seq}`
      data.set(id, { name, state: toPlain(state), updatedAt: tick() })
      return id
    },
    async save(id, state) {
      const d = data.get(id)
      if (!d) throw new Error(`Unknown scenario ${id}`)
      data.set(id, { ...d, state: toPlain(state), updatedAt: tick() })
    },
    async rename(id, name) {
      const d = data.get(id)
      if (d) data.set(id, { ...d, name, updatedAt: tick() })
    },
    async remove(id) {
      data.delete(id)
    },
  }
}

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

/**
 * Debounces saves so typing doesn't write on every keystroke. Only the latest
 * state is written; `flush` writes any pending state immediately.
 */
export function createAutosaver<T = PlanState>(save: (value: T) => Promise<void>, delayMs: number, onStatus: (s: SaveStatus) => void) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: T | null = null
  let inFlight: Promise<void> = Promise.resolve()

  const run = async () => {
    timer = null
    const value = pending
    if (!value) return
    pending = null
    onStatus('saving')
    inFlight = inFlight.then(() => save(value))
    try {
      await inFlight
      onStatus(pending ? 'pending' : 'saved')
    } catch {
      inFlight = Promise.resolve()
      onStatus('error')
    }
  }

  return {
    schedule(value: T) {
      pending = value
      onStatus('pending')
      if (timer) clearTimeout(timer)
      timer = setTimeout(run, delayMs)
    },
    async flush() {
      if (timer) clearTimeout(timer)
      await run()
      await inFlight.catch(() => undefined)
    },
    cancel() {
      if (timer) clearTimeout(timer)
      timer = null
      pending = null
    },
  }
}
