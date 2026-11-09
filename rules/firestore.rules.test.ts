import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app'
import {
  addDoc,
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { afterAll, describe, expect, it } from 'vitest'
import { createInitialState } from '../src/data/initialState'
import { toPlain } from '../src/storage/scenarios'

const projectId = 'demo-cashflow'
const apps: FirebaseApp[] = []

function dbAs(uid: string | null) {
  const app = initializeApp({ projectId, apiKey: 'demo-key' }, `app-${apps.length}`)
  apps.push(app)
  const db = getFirestore(app)
  connectFirestoreEmulator(db, '127.0.0.1', 8080, uid ? { mockUserToken: { user_id: uid } } : undefined)
  return db
}

const alice = dbAs('alice')
const bob = dbAs('bob')
const anon = dbAs(null)
const scenarios = (db: ReturnType<typeof dbAs>, uid: string) => collection(db, 'users', uid, 'scenarios')
const denied = { code: 'permission-denied' }
const valid = () => ({ name: 'Base case', state: toPlain(createInitialState()), updatedAt: serverTimestamp() })

afterAll(() => Promise.all(apps.map((a) => deleteApp(a))))

describe('firestore.rules', () => {
  it('lets the owner do everything the app does', async () => {
    const ref = await addDoc(scenarios(alice, 'alice'), valid())
    await updateDoc(ref, { state: toPlain({ ...createInitialState(), tranches: [] }), updatedAt: serverTimestamp() })
    await updateDoc(ref, { name: 'Grant delayed', updatedAt: serverTimestamp() })
    expect((await getDoc(ref)).data()?.name).toBe('Grant delayed')
    expect((await getDocs(scenarios(alice, 'alice'))).size).toBeGreaterThan(0)
    await deleteDoc(ref)
  })

  it("blocks other users and signed-out visitors from a user's scenarios", async () => {
    const ref = await addDoc(scenarios(alice, 'alice'), valid())
    for (const db of [bob, anon]) {
      const theirs = doc(db, ref.path)
      await expect(getDoc(theirs)).rejects.toMatchObject(denied)
      await expect(getDocs(scenarios(db, 'alice'))).rejects.toMatchObject(denied)
      await expect(updateDoc(theirs, { name: 'hijacked', updatedAt: serverTimestamp() })).rejects.toMatchObject(denied)
      await expect(deleteDoc(theirs)).rejects.toMatchObject(denied)
      await expect(addDoc(scenarios(db, 'alice'), valid())).rejects.toMatchObject(denied)
    }
  })

  it('rejects malformed scenarios on create and update', async () => {
    const col = scenarios(alice, 'alice')
    const bad = [
      { ...valid(), extra: 'x' },
      { ...valid(), name: '' },
      { ...valid(), name: 'x'.repeat(201) },
      { ...valid(), name: 42 },
      { ...valid(), updatedAt: new Date(0) },
      { ...valid(), state: { ...toPlain(createInitialState()), version: 2 } },
      { ...valid(), state: { ...toPlain(createInitialState()), costs: 'nope' } },
      { ...valid(), state: { ...toPlain(createInitialState()), costs: Array(501).fill({}) } },
      { name: 'No state', updatedAt: serverTimestamp() },
    ]
    for (const data of bad) await expect(addDoc(col, data)).rejects.toMatchObject(denied)

    const ref = await addDoc(col, valid())
    await expect(updateDoc(ref, { name: 'x'.repeat(201), updatedAt: serverTimestamp() })).rejects.toMatchObject(denied)
    await expect(updateDoc(ref, { extra: 'x', updatedAt: serverTimestamp() })).rejects.toMatchObject(denied)
    await expect(updateDoc(ref, { name: 'Stale timestamp' })).rejects.toMatchObject(denied)
  })

  it('denies everything outside users/{uid}/scenarios', async () => {
    await expect(setDoc(doc(alice, 'users', 'alice'), { admin: true })).rejects.toMatchObject(denied)
    await expect(setDoc(doc(alice, 'users', 'alice', 'other', 'x'), { a: 1 })).rejects.toMatchObject(denied)
    await expect(setDoc(doc(alice, 'public', 'x'), { a: 1 })).rejects.toMatchObject(denied)
  })
})
