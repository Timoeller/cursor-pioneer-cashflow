import { initializeApp, type FirebaseApp } from 'firebase/app'
import { GoogleAuthProvider, connectAuthEmulator, getAuth, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut, type Auth, type User } from 'firebase/auth'
import {
  addDoc,
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
  type Timestamp,
} from 'firebase/firestore'
import type { PlanState } from './model/types'
import { normalizeState } from './storage/local'
import { toPlain, type ScenarioMeta, type ScenarioStore } from './storage/scenarios'

// Web config of the pioneer-cashflow project. These values are public; firestore.rules protects the data.
// The VITE_FIREBASE_* variables override them, e.g. to point at the emulators.
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyB0-h_i0XiV14yYHoSe2CpIkcjnkEAcDjk',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'pioneer-cashflow.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'pioneer-cashflow',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:706818236179:web:782aa8e32151f71788c4e6',
}

/** Always admins, even without a members document. Must match isBootstrapAdmin() in firestore.rules. */
export const BOOTSTRAP_ADMIN_EMAILS = ['moeller.timo@gmail.com']

export type Role = 'member' | 'admin'

export interface Membership {
  teamId: string
  role: Role
}

export interface UserProfile {
  uid: string
  email: string
  displayName: string
  photoURL: string
  createdAt: number
}

export interface Team {
  id: string
  name: string
}

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null

function init() {
  if (!app) {
    app = initializeApp(config)
    auth = getAuth(app)
    db = getFirestore(app)
    if (import.meta.env.VITE_FIREBASE_USE_EMULATOR === 'true') {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
      connectFirestoreEmulator(db, '127.0.0.1', 8080)
    }
  }
  return { auth: auth!, db: db! }
}

const millis = (t: unknown) => ((t as Timestamp | null)?.toMillis?.() ?? Date.now())

export function watchUser(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(init().auth, cb)
}

export async function signInWithGoogle(): Promise<void> {
  const { auth } = init()
  const provider = new GoogleAuthProvider()
  try {
    await signInWithPopup(auth, provider)
  } catch (e) {
    const code = (e as { code?: string }).code
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider)
      return
    }
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return
    throw e
  }
}

export async function signOutUser(): Promise<void> {
  await signOut(init().auth)
}

/** Creates or refreshes users/{uid}, which is how a new user shows up for admins to approve. */
export async function registerUser(user: User): Promise<void> {
  const { db } = init()
  const ref = doc(db, 'users', user.uid)
  const profile = { email: user.email ?? '', displayName: user.displayName ?? '', photoURL: user.photoURL ?? '' }
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    await setDoc(ref, { ...profile, createdAt: serverTimestamp() })
    return
  }
  const d = snap.data()
  if (d.email !== profile.email || d.displayName !== profile.displayName || d.photoURL !== profile.photoURL) {
    await updateDoc(ref, profile)
  }
}

export function watchMembership(uid: string, cb: (m: Membership | null) => void, onError: (e: Error) => void): () => void {
  return onSnapshot(
    doc(init().db, 'members', uid),
    (snap) => cb(snap.exists() ? { teamId: String(snap.data().teamId), role: snap.data().role === 'admin' ? 'admin' : 'member' } : null),
    onError,
  )
}

export function watchTeam(teamId: string, cb: (team: Team | null) => void): () => void {
  return onSnapshot(
    doc(init().db, 'teams', teamId),
    (snap) => cb(snap.exists() ? { id: snap.id, name: String(snap.data().name) } : null),
    () => cb(null),
  )
}

// ---- Admin ----

export function watchUsers(cb: (users: UserProfile[]) => void, onError: (e: Error) => void): () => void {
  return onSnapshot(
    collection(init().db, 'users'),
    (snap) =>
      cb(
        snap.docs
          .map((d) => ({
            uid: d.id,
            email: String(d.data().email ?? ''),
            displayName: String(d.data().displayName ?? ''),
            photoURL: String(d.data().photoURL ?? ''),
            createdAt: millis(d.data().createdAt),
          }))
          .sort((a, b) => b.createdAt - a.createdAt),
      ),
    onError,
  )
}

export function watchMembers(cb: (members: Map<string, Membership>) => void, onError: (e: Error) => void): () => void {
  return onSnapshot(
    collection(init().db, 'members'),
    (snap) => cb(new Map(snap.docs.map((d) => [d.id, { teamId: String(d.data().teamId), role: d.data().role === 'admin' ? 'admin' : 'member' }]))),
    onError,
  )
}

export function watchTeams(cb: (teams: Team[]) => void, onError: (e: Error) => void): () => void {
  return onSnapshot(
    collection(init().db, 'teams'),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, name: String(d.data().name) })).sort((a, b) => a.name.localeCompare(b.name))),
    onError,
  )
}

export async function setMembership(uid: string, membership: Membership | null): Promise<void> {
  const ref = doc(init().db, 'members', uid)
  if (membership) await setDoc(ref, { ...membership, updatedAt: serverTimestamp() })
  else await deleteDoc(ref)
}

export async function createTeam(name: string): Promise<string> {
  const ref = await addDoc(collection(init().db, 'teams'), { name, createdAt: serverTimestamp() })
  return ref.id
}

export async function renameTeam(teamId: string, name: string): Promise<void> {
  await updateDoc(doc(init().db, 'teams', teamId), { name })
}

// ---- Scenarios ----

export interface LiveScenarioStore extends ScenarioStore {
  watchList(cb: (list: ScenarioMeta[]) => void): () => void
  /** Called with remote changes to a scenario; local, not yet confirmed writes are skipped. */
  watch(id: string, cb: (state: PlanState) => void): () => void
}

/** Scenarios live at teams/{teamId}/scenarios/{id} and are shared by everyone in the team. */
export function teamStore(teamId: string): LiveScenarioStore {
  const { db } = init()
  const col = collection(db, 'teams', teamId, 'scenarios')
  const toMeta = (id: string, data: Record<string, unknown>): ScenarioMeta => ({ id, name: String(data.name ?? 'Untitled'), updatedAt: millis(data.updatedAt) })
  return {
    async list() {
      const snap = await getDocs(col)
      return snap.docs.map((d) => toMeta(d.id, d.data())).sort((a, b) => b.updatedAt - a.updatedAt)
    },
    watchList(cb) {
      return onSnapshot(col, (snap) => cb(snap.docs.map((d) => toMeta(d.id, d.data())).sort((a, b) => b.updatedAt - a.updatedAt)))
    },
    watch(id, cb) {
      return onSnapshot(doc(col, id), (snap) => {
        if (snap.exists() && !snap.metadata.hasPendingWrites) cb(normalizeState(snap.data().state))
      })
    },
    async load(id) {
      const snap = await getDoc(doc(col, id))
      return snap.exists() ? normalizeState(snap.data().state) : null
    },
    async create(name, state: PlanState) {
      const ref = await addDoc(col, { name, state: toPlain(state), updatedAt: serverTimestamp() })
      return ref.id
    },
    async save(id, state) {
      await updateDoc(doc(col, id), { state: toPlain(state), updatedAt: serverTimestamp() })
    },
    async rename(id, name) {
      await updateDoc(doc(col, id), { name, updatedAt: serverTimestamp() })
    },
    async remove(id) {
      await deleteDoc(doc(col, id))
    },
  }
}

/** Scenarios saved per user before teams existed (users/{uid}/scenarios). They can only be read and deleted. */
export async function listLegacyScenarios(uid: string): Promise<{ id: string; name: string; state: PlanState }[]> {
  const snap = await getDocs(collection(init().db, 'users', uid, 'scenarios'))
  return snap.docs.map((d) => ({ id: d.id, name: String(d.data().name ?? 'Untitled'), state: normalizeState(d.data().state) }))
}

export async function deleteLegacyScenario(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(init().db, 'users', uid, 'scenarios', id))
}
