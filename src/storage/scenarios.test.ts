import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../data/initialState'
import { normalizeState } from './local'
import { createAutosaver, createMemoryStore, type SaveStatus } from './scenarios'

describe('scenario store', () => {
  it('creates, saves, lists, renames and removes scenarios', async () => {
    const store = createMemoryStore()
    const base = createInitialState()
    const a = await store.create('Base case', base)
    const b = await store.create('Grant delayed', { ...base, tranches: [] })

    const changed = { ...base, settings: { ...base.settings, startingCash: 5000 } }
    await store.save(a, changed)
    expect((await store.load(a))?.settings.startingCash).toBe(5000)
    expect((await store.load(b))?.tranches).toEqual([])

    expect((await store.list()).map((s) => s.name)).toEqual(['Base case', 'Grant delayed'])
    await store.rename(b, 'Late grant')
    expect((await store.list())[0].name).toBe('Late grant')

    await store.remove(a)
    expect(await store.load(a)).toBeNull()
    expect(await store.list()).toHaveLength(1)
  })

  it('normalizes partial state when loading', () => {
    const s = normalizeState({ settings: { horizonMonths: 24 }, employees: [{ id: 'x', name: 'A', monthlySalary: 100 }] })
    expect(s.settings.horizonMonths).toBe(24)
    expect(s.settings.employerSurchargePct).toBe(20)
    expect(s.employees[0]).toMatchObject({ id: 'x', monthlySalary: 100, endMonth: null })
    expect(s.costs.length).toBeGreaterThan(0)
  })

  it('migrates scenarios saved with the old grant components', () => {
    const s = normalizeState({
      fundingPeriod: { fromMonth: 3, toMonth: 18 },
      grantComponents: [{ id: 'p', basis: 'personnel', ratePct: 70, grantSharePct: 60 }],
      tranches: [{ id: 't', month: 4, amount: 500, kind: 'loan' }],
    })
    expect(s.funding).toMatchObject({ ratePct: 70, additionalCostPct: 40, fromMonth: 3, toMonth: 18, payMonthly: true })
    expect(s.tranches).toEqual([{ id: 't', month: 4, amount: 500 }])
    expect(s.revenue).toEqual([])
    expect('grantComponents' in s).toBe(false)
  })
})

describe('autosaver', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('debounces and only writes the latest state', async () => {
    const save = vi.fn(async () => undefined)
    const statuses: SaveStatus[] = []
    const saver = createAutosaver(save, 1000, (s) => statuses.push(s))
    const s1 = createInitialState()
    const s2 = { ...s1, settings: { ...s1.settings, startingCash: 1 } }

    saver.schedule(s1)
    vi.advanceTimersByTime(500)
    saver.schedule(s2)
    vi.advanceTimersByTime(999)
    expect(save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith(s2)
    expect(statuses.at(-1)).toBe('saved')
  })

  it('flush writes pending state immediately', async () => {
    const save = vi.fn(async () => undefined)
    const saver = createAutosaver(save, 1000, () => undefined)
    saver.schedule(createInitialState())
    await saver.flush()
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('reports errors', async () => {
    const statuses: SaveStatus[] = []
    const saver = createAutosaver(async () => Promise.reject(new Error('offline')), 10, (s) => statuses.push(s))
    saver.schedule(createInitialState())
    await vi.advanceTimersByTimeAsync(10)
    expect(statuses.at(-1)).toBe('error')
  })
})
