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
  serverTimestamp,
  updateDoc,
  type Firestore,
  type Timestamp,
} from 'firebase/firestore'
import type { PlanState } from './model/types'
import { normalizeState } from './storage/local'
import { toPlain, type ScenarioStore } from './storage/scenarios'

// Web config of the pioneer-cashflow project. These values are public; firestore.rules protects the data.
// The VITE_FIREBASE_* variables override them, e.g. to point at the emulators.
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyB0-h_i0XiV14yYHoSe2CpIkcjnkEAcDjk',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'pioneer-cashflow.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'pioneer-cashflow',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:706818236179:web:782aa8e32151f71788c4e6',
}

export const firebaseEnabled = Boolean(config.apiKey && config.projectId && config.authDomain)

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null

function init() {
  if (!firebaseEnabled) throw new Error('Firebase is not configured')
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

export function watchUser(cb: (user: User | null) => void): () => void {
  if (!firebaseEnabled) return () => undefined
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

/** Scenarios live at users/{uid}/scenarios/{id}; firestore.rules restricts access to the owner. */
export function firestoreStore(uid: string): ScenarioStore {
  const { db } = init()
  const col = collection(db, 'users', uid, 'scenarios')
  const millis = (t: unknown) => ((t as Timestamp | null)?.toMillis?.() ?? Date.now())
  return {
    async list() {
      const snap = await getDocs(col)
      return snap.docs
        .map((d) => ({ id: d.id, name: String(d.data().name ?? 'Untitled'), updatedAt: millis(d.data().updatedAt) }))
        .sort((a, b) => b.updatedAt - a.updatedAt)
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
