import type { User } from 'firebase/auth'
import { useCallback, useEffect, useRef, useState } from 'react'
import { firebaseEnabled, firestoreStore, watchUser } from '../firebase'
import type { PlanState } from '../model/types'
import { createAutosaver, type SaveStatus, type ScenarioMeta, type ScenarioStore } from './scenarios'

const LAST_SCENARIO_KEY = 'pioneer-cashflow:last-scenario'

interface Options {
  state: PlanState
  /** Replace the editor state with a loaded scenario (must not trigger a save). */
  replaceState: (s: PlanState) => void
}

export function useCloudSync({ state, replaceState }: Options) {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(!firebaseEnabled)
  const [scenarios, setScenarios] = useState<ScenarioMeta[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  /** Data entered in this browser before signing in that differs from the loaded scenario. */
  const [localLeftover, setLocalLeftover] = useState<PlanState | null>(null)

  const storeRef = useRef<ScenarioStore | null>(null)
  const saverRef = useRef<ReturnType<typeof createAutosaver> | null>(null)
  const loadedRef = useRef<PlanState | null>(null)
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const refreshList = useCallback(async () => {
    if (storeRef.current) setScenarios(await storeRef.current.list())
  }, [])

  const openScenario = useCallback(
    async (id: string) => {
      const store = storeRef.current
      if (!store) return
      await saverRef.current?.flush()
      const loaded = await store.load(id)
      if (!loaded) return
      loadedRef.current = loaded
      replaceState(loaded)
      setActiveId(id)
      localStorage.setItem(LAST_SCENARIO_KEY, id)
      setStatus('saved')
    },
    [replaceState],
  )

  useEffect(
    () =>
      watchUser(async (u) => {
        setUser(u)
        setAuthReady(true)
        saverRef.current?.cancel()
        if (!u) {
          storeRef.current = null
          saverRef.current = null
          setScenarios([])
          setActiveId(null)
          setLocalLeftover(null)
          setStatus('idle')
          return
        }
        const store = firestoreStore(u.uid)
        storeRef.current = store
        saverRef.current = createAutosaver(
          async (s) => {
            const id = localStorage.getItem(LAST_SCENARIO_KEY)
            if (id) await store.save(id, s)
          },
          1000,
          setStatus,
        )
        try {
          const localState = stateRef.current
          let list = await store.list()
          if (list.length === 0) {
            // first sign-in: keep whatever was entered in this browser
            await store.create('Base case', localState)
            list = await store.list()
          }
          setScenarios(list)
          const last = localStorage.getItem(LAST_SCENARIO_KEY)
          await openScenario(list.some((s) => s.id === last) ? last! : list[0].id)
          if (loadedRef.current && JSON.stringify(loadedRef.current) !== JSON.stringify(localState)) {
            setLocalLeftover(localState)
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e))
          setStatus('error')
        }
      }),
    [openScenario],
  )

  useEffect(() => {
    if (!activeId || !saverRef.current) return
    if (state === loadedRef.current) return
    saverRef.current.schedule(state)
  }, [state, activeId])

  useEffect(() => {
    const onUnload = () => void saverRef.current?.flush()
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [])

  const run = useCallback(async (fn: (store: ScenarioStore) => Promise<void>) => {
    const store = storeRef.current
    if (!store) return
    try {
      setError(null)
      await fn(store)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  return {
    enabled: firebaseEnabled,
    authReady,
    user,
    scenarios,
    activeId,
    status,
    error,
    localLeftover,
    dismissLocalLeftover: () => setLocalLeftover(null),
    open: (id: string) => run(() => openScenario(id)),
    create: (name: string, s: PlanState) =>
      run(async (store) => {
        await saverRef.current?.flush()
        const id = await store.create(name, s)
        await refreshList()
        await openScenario(id)
      }),
    rename: (id: string, name: string) => run(async (store) => { await store.rename(id, name); await refreshList() }),
    remove: (id: string) =>
      run(async (store) => {
        saverRef.current?.cancel()
        await store.remove(id)
        const list = await store.list()
        if (list.length === 0) {
          await store.create('Base case', stateRef.current)
        }
        await refreshList()
        const next = (await store.list())[0]
        if (next) await openScenario(next.id)
      }),
  }
}

export type CloudSync = ReturnType<typeof useCloudSync>
