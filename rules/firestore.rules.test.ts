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
  type Firestore,
} from 'firebase/firestore'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createInitialState } from '../src/data/initialState'
import { toPlain } from '../src/storage/scenarios'

const projectId = 'demo-cashflow'
const emulator = 'http://127.0.0.1:8080'
const apps: FirebaseApp[] = []

function dbAs(uid: string | null, email?: string, emailVerified = true): Firestore {
  const app = initializeApp({ projectId, apiKey: 'demo-key' }, `app-${apps.length}`)
  apps.push(app)
  const db = getFirestore(app)
  const token = uid ? { mockUserToken: { user_id: uid, email: email ?? `${uid}@example.com`, email_verified: emailVerified } } : undefined
  connectFirestoreEmulator(db, '127.0.0.1', 8080, token)
  return db
}

const boss = dbAs('boss', 'moeller.timo@gmail.com')
const fakeBoss = dbAs('fakeboss', 'moeller.timo@gmail.com', false)
const alice = dbAs('alice')
const bob = dbAs('bob')
const carol = dbAs('carol')
const anon = dbAs(null)

const denied = { code: 'permission-denied' }
const validScenario = () => ({ name: 'Base case', state: toPlain(createInitialState()), updatedAt: serverTimestamp() })
const profile = (uid: string) => ({ email: `${uid}@example.com`, displayName: uid, photoURL: '', createdAt: serverTimestamp() })
const member = (teamId: string, role = 'member') => ({ teamId, role, updatedAt: serverTimestamp() })
const teamScenarios = (db: Firestore, teamId: string) => collection(db, 'teams', teamId, 'scenarios')

let teamA = ''
let teamB = ''

/** Writes bypassing the rules, for data the rules never let clients create. */
async function seedAsOwner(path: string, fields: Record<string, unknown>) {
  const res = await fetch(`${emulator}/v1/projects/${projectId}/databases/(default)/documents/${path}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  if (!res.ok) throw new Error(await res.text())
}

beforeAll(async () => {
  await fetch(`${emulator}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: 'DELETE' })
  teamA = (await addDoc(collection(boss, 'teams'), { name: 'Team A', createdAt: serverTimestamp() })).id
  teamB = (await addDoc(collection(boss, 'teams'), { name: 'Team B', createdAt: serverTimestamp() })).id
  for (const [db, uid] of [[alice, 'alice'], [bob, 'bob'], [carol, 'carol']] as const) await setDoc(doc(db, 'users', uid), profile(uid))
  await setDoc(doc(boss, 'members', 'alice'), member(teamA))
  await setDoc(doc(boss, 'members', 'bob'), member(teamB))
})

afterAll(() => Promise.all(apps.map((a) => deleteApp(a))))

describe('registration (users/{uid})', () => {
  it('lets users create and refresh their own profile', async () => {
    const dave = dbAs('dave')
    await setDoc(doc(dave, 'users', 'dave'), profile('dave'))
    await updateDoc(doc(dave, 'users', 'dave'), { displayName: 'Dave D.' })
    expect((await getDoc(doc(dave, 'users', 'dave'))).data()?.displayName).toBe('Dave D.')
  })

  it('rejects fake emails, foreign profiles, extra fields and changed createdAt', async () => {
    const erin = dbAs('erin')
    await expect(setDoc(doc(erin, 'users', 'erin'), { ...profile('erin'), email: 'moeller.timo@gmail.com' })).rejects.toMatchObject(denied)
    await expect(setDoc(doc(erin, 'users', 'someone-else'), profile('erin'))).rejects.toMatchObject(denied)
    await expect(setDoc(doc(erin, 'users', 'erin'), { ...profile('erin'), role: 'admin' })).rejects.toMatchObject(denied)
    await expect(setDoc(doc(erin, 'users', 'erin'), { ...profile('erin'), displayName: 'x'.repeat(201) })).rejects.toMatchObject(denied)
    await expect(setDoc(doc(dbAs('frank', 'frank@example.com', false), 'users', 'frank'), profile('frank'))).rejects.toMatchObject(denied)
    await setDoc(doc(erin, 'users', 'erin'), profile('erin'))
    await expect(updateDoc(doc(erin, 'users', 'erin'), { createdAt: new Date(0) })).rejects.toMatchObject(denied)
  })

  it('only shows profiles to their owner and admins', async () => {
    await expect(getDoc(doc(alice, 'users', 'carol'))).rejects.toMatchObject(denied)
    await expect(getDocs(collection(alice, 'users'))).rejects.toMatchObject(denied)
    await expect(getDocs(collection(anon, 'users'))).rejects.toMatchObject(denied)
    expect((await getDocs(collection(boss, 'users'))).size).toBeGreaterThanOrEqual(3)
  })
})

describe('approval (members/{uid}) and teams', () => {
  it('does not let anyone approve themselves or raise their own role', async () => {
    await expect(setDoc(doc(carol, 'members', 'carol'), member(teamA))).rejects.toMatchObject(denied)
    await expect(setDoc(doc(alice, 'members', 'alice'), member(teamA, 'admin'))).rejects.toMatchObject(denied)
    await expect(setDoc(doc(alice, 'members', 'carol'), member(teamA))).rejects.toMatchObject(denied)
    await expect(setDoc(doc(fakeBoss, 'members', 'carol'), member(teamA))).rejects.toMatchObject(denied)
    await expect(addDoc(collection(alice, 'teams'), { name: 'Mine', createdAt: serverTimestamp() })).rejects.toMatchObject(denied)
  })

  it('lets users see only their own membership and team', async () => {
    expect((await getDoc(doc(alice, 'members', 'alice'))).data()?.teamId).toBe(teamA)
    expect((await getDoc(doc(alice, 'teams', teamA))).data()?.name).toBe('Team A')
    await expect(getDoc(doc(alice, 'members', 'bob'))).rejects.toMatchObject(denied)
    await expect(getDoc(doc(alice, 'teams', teamB))).rejects.toMatchObject(denied)
    await expect(getDocs(collection(alice, 'members'))).rejects.toMatchObject(denied)
    await expect(getDocs(collection(alice, 'teams'))).rejects.toMatchObject(denied)
    await expect(getDoc(doc(carol, 'teams', teamA))).rejects.toMatchObject(denied)
  })

  it('validates memberships and teams written by admins', async () => {
    await expect(setDoc(doc(boss, 'members', 'carol'), member('no-such-team'))).rejects.toMatchObject(denied)
    await expect(setDoc(doc(boss, 'members', 'carol'), member(teamA, 'owner'))).rejects.toMatchObject(denied)
    await expect(setDoc(doc(boss, 'members', 'carol'), { ...member(teamA), extra: 1 })).rejects.toMatchObject(denied)
    await expect(addDoc(collection(boss, 'teams'), { name: '', createdAt: serverTimestamp() })).rejects.toMatchObject(denied)
    await expect(updateDoc(doc(boss, 'teams', teamA), { createdAt: new Date(0) })).rejects.toMatchObject(denied)
    await updateDoc(doc(boss, 'teams', teamA), { name: 'Team A' })
  })

  it('lets promoted admins manage access, and access ends when the membership is removed', async () => {
    await setDoc(doc(boss, 'members', 'carol'), member(teamA, 'admin'))
    await setDoc(doc(carol, 'members', 'dave'), member(teamB))
    expect((await getDocs(collection(carol, 'members'))).size).toBeGreaterThanOrEqual(3)
    await addDoc(teamScenarios(carol, teamA), validScenario())

    await deleteDoc(doc(boss, 'members', 'carol'))
    await expect(getDocs(teamScenarios(carol, teamA))).rejects.toMatchObject(denied)
    await expect(setDoc(doc(carol, 'members', 'carol'), member(teamA, 'admin'))).rejects.toMatchObject(denied)
  })
})

describe('team scenarios (teams/{teamId}/scenarios)', () => {
  it('lets team members do everything the app does', async () => {
    const ref = await addDoc(teamScenarios(alice, teamA), validScenario())
    await updateDoc(ref, { state: toPlain({ ...createInitialState(), tranches: [] }), updatedAt: serverTimestamp() })
    await updateDoc(ref, { name: 'Grant delayed', updatedAt: serverTimestamp() })
    expect((await getDoc(ref)).data()?.name).toBe('Grant delayed')
    expect((await getDocs(teamScenarios(alice, teamA))).size).toBeGreaterThan(0)
    await deleteDoc(ref)
  })

  it('keeps other teams, pending users, admins of other teams and visitors out', async () => {
    const ref = await addDoc(teamScenarios(alice, teamA), validScenario())
    for (const db of [bob, dbAs('carol'), boss, anon]) {
      const theirs = doc(db, ref.path)
      await expect(getDoc(theirs)).rejects.toMatchObject(denied)
      await expect(getDocs(teamScenarios(db, teamA))).rejects.toMatchObject(denied)
      await expect(updateDoc(theirs, { name: 'hijacked', updatedAt: serverTimestamp() })).rejects.toMatchObject(denied)
      await expect(deleteDoc(theirs)).rejects.toMatchObject(denied)
      await expect(addDoc(teamScenarios(db, teamA), validScenario())).rejects.toMatchObject(denied)
    }
  })

  it('rejects malformed scenarios on create and update', async () => {
    const col = teamScenarios(alice, teamA)
    const bad = [
      { ...validScenario(), extra: 'x' },
      { ...validScenario(), name: '' },
      { ...validScenario(), name: 'x'.repeat(201) },
      { ...validScenario(), name: 42 },
      { ...validScenario(), updatedAt: new Date(0) },
      { ...validScenario(), state: { ...toPlain(createInitialState()), version: 2 } },
      { ...validScenario(), state: { ...toPlain(createInitialState()), costs: 'nope' } },
      { ...validScenario(), state: { ...toPlain(createInitialState()), funding: 'nope' } },
      { ...validScenario(), state: { ...toPlain(createInitialState()), costs: Array(501).fill({}) } },
      { name: 'No state', updatedAt: serverTimestamp() },
    ]
    for (const data of bad) await expect(addDoc(col, data)).rejects.toMatchObject(denied)

    const ref = await addDoc(col, validScenario())
    await expect(updateDoc(ref, { name: 'x'.repeat(201), updatedAt: serverTimestamp() })).rejects.toMatchObject(denied)
    await expect(updateDoc(ref, { extra: 'x', updatedAt: serverTimestamp() })).rejects.toMatchObject(denied)
    await expect(updateDoc(ref, { name: 'Stale timestamp' })).rejects.toMatchObject(denied)
  })
})

describe('legacy personal scenarios (users/{uid}/scenarios)', () => {
  it('can only be read and deleted by their owner', async () => {
    await seedAsOwner('users/alice/scenarios/old', { name: { stringValue: 'Old' } })
    await expect(getDoc(doc(bob, 'users', 'alice', 'scenarios', 'old'))).rejects.toMatchObject(denied)
    await expect(getDoc(doc(boss, 'users', 'alice', 'scenarios', 'old'))).rejects.toMatchObject(denied)
    await expect(addDoc(collection(alice, 'users', 'alice', 'scenarios'), validScenario())).rejects.toMatchObject(denied)
    expect((await getDocs(collection(alice, 'users', 'alice', 'scenarios'))).size).toBe(1)
    await deleteDoc(doc(alice, 'users', 'alice', 'scenarios', 'old'))
  })
})

it('denies everything else', async () => {
  await expect(setDoc(doc(boss, 'public', 'x'), { a: 1 })).rejects.toMatchObject(denied)
  await expect(setDoc(doc(alice, 'teams', teamA, 'other', 'x'), { a: 1 })).rejects.toMatchObject(denied)
  await expect(getDoc(doc(alice, 'anything', 'x'))).rejects.toMatchObject(denied)
})
