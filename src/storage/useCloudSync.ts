import { useCallback, useEffect, useRef, useState } from 'react'
import { createInitialState } from '../data/initialState'
import { deleteLegacyScenario, listLegacyScenarios, type LiveScenarioStore } from '../firebase'
import type { PlanState } from '../model/types'
import { normalizeState } from './local'
import { createAutosaver, stableJson, toPlain, type SaveStatus, type ScenarioMeta } from './scenarios'

interface Options {
  uid: string
  teamId: string
  store: LiveScenarioStore
  state: PlanState
  /** Replace the editor state with a loaded scenario (must not trigger a save). */
  replaceState: (s: PlanState) => void
}

interface PendingSave {
  id: string
  state: PlanState
}

const lastScenarioKey = (teamId: string) => `pioneer-cashflow:last-scenario:${teamId}`

export function useCloudSync({ uid, teamId, store, state, replaceState }: Options) {
  const [scenarios, setScenarios] = useState<ScenarioMeta[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [legacyCount, setLegacyCount] = useState(0)

  const activeIdRef = useRef<string | null>(null)
  const statusRef = useRef<SaveStatus>('idle')
  /** The state last loaded from or saved to Firestore; edits equal to it are not saved again. */
  const loadedRef = useRef<PlanState | null>(null)
  /** stableJson of the state Firestore has for the active scenario, to tell teammates' edits from our own. */
  const syncedRef = useRef<string>('')
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const saver = useRef<ReturnType<typeof createAutosaver<PendingSave>> | null>(null)

  const showLoaded = useCallback(
    (id: string, loaded: PlanState) => {
      loadedRef.current = loaded
      syncedRef.current = stableJson(loaded)
      replaceState(loaded)
      activeIdRef.current = id
      setActiveId(id)
    },
    [replaceState],
  )

  const openScenario = useCallback(
    async (id: string) => {
      await saver.current?.flush()
      const loaded = await store.load(id)
      if (!loaded) return
      showLoaded(id, loaded)
      localStorage.setItem(lastScenarioKey(teamId), id)
      setStatus('saved')
    },
    [saver, store, teamId, showLoaded],
  )

  useEffect(() => {
    let cancelled = false
    const setSaveStatus = (s: SaveStatus) => {
      statusRef.current = s
      setStatus(s)
    }
    saver.current = createAutosaver(
      async ({ id, state: s }) => {
        await store.save(id, s)
        if (activeIdRef.current === id) syncedRef.current = stableJson(normalizeState(toPlain(s)))
      },
      1000,
      setSaveStatus,
    )
    activeIdRef.current = null

    const stopList = store.watchList((list) => {
      if (cancelled) return
      setScenarios(list)
      const active = activeIdRef.current
      if (active && list.length > 0 && !list.some((s) => s.id === active)) {
        void openScenario(list[0].id).catch((e) => setError(e instanceof Error ? e.message : String(e)))
      }
    })

    ;(async () => {
      let list = await store.list()
      if (list.length === 0) {
        await store.create('Base case', createInitialState())
        list = await store.list()
      }
      if (cancelled) return
      const last = localStorage.getItem(lastScenarioKey(teamId))
      await openScenario(list.some((s) => s.id === last) ? last! : list[0].id)
      const legacy = await listLegacyScenarios(uid).catch(() => [])
      if (!cancelled) setLegacyCount(legacy.length)
    })().catch((e) => {
      if (cancelled) return
      setError(e instanceof Error ? e.message : String(e))
      setSaveStatus('error')
    })

    return () => {
      cancelled = true
      stopList()
      void saver.current?.flush()
    }
  }, [store, uid, teamId, saver, openScenario])

  useEffect(() => {
    if (!activeId) return
    return store.watch(activeId, (remote) => {
      if (activeIdRef.current !== activeId) return
      if (stableJson(remote) === syncedRef.current) return
      // Unsaved local edits win; they will overwrite the teammate's change when they are saved.
      if (statusRef.current === 'pending' || statusRef.current === 'saving') return
      loadedRef.current = remote
      syncedRef.current = stableJson(remote)
      replaceState(remote)
    })
  }, [store, activeId, replaceState])

  useEffect(() => {
    if (!activeId || !saver.current) return
    if (state === loadedRef.current) return
    saver.current.schedule({ id: activeId, state })
  }, [state, activeId, saver])

  useEffect(() => {
    const onUnload = () => void saver.current?.flush()
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [saver])

  const run = useCallback(async (fn: () => Promise<void>) => {
    try {
      setError(null)
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  return {
    scenarios,
    activeId,
    status,
    error,
    legacyCount,
    /** Copies the scenarios saved before teams existed into the team, then deletes the old copies. */
    moveLegacyToTeam: () =>
      run(async () => {
        for (const s of await listLegacyScenarios(uid)) {
          await store.create(s.name, s.state)
          await deleteLegacyScenario(uid, s.id)
        }
        setLegacyCount(0)
      }),
    open: (id: string) => run(() => openScenario(id)),
    create: (name: string, s: PlanState) =>
      run(async () => {
        await saver.current?.flush()
        await openScenario(await store.create(name, s))
      }),
    rename: (id: string, name: string) => run(() => store.rename(id, name)),
    remove: (id: string) =>
      run(async () => {
        saver.current?.cancel()
        await store.remove(id)
        const list = await store.list()
        if (list.length === 0) await store.create('Base case', createInitialState())
        const next = (await store.list())[0]
        if (next) await openScenario(next.id)
      }),
  }
}

export type CloudSync = ReturnType<typeof useCloudSync>
