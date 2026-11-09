import type { User } from 'firebase/auth'
import { useEffect, useState } from 'react'
import { BOOTSTRAP_ADMIN_EMAILS, registerUser, watchMembership, watchTeam, watchUser, type Membership, type Team } from './firebase'

export type Access =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'error'; user: User; error: string }
  /** Signed in, but no admin has given them a team yet. */
  | { status: 'pending'; user: User }
  /** Admins without a team land here too (membership and team are null), so they can assign themselves. */
  | { status: 'ready'; user: User; isAdmin: boolean; membership: Membership | null; team: Team | null }

/** A value loaded for a specific key (uid or team id), so a stale value for a previous key is never used. */
interface Keyed<T> {
  key: string
  value: T
}

export function useAccess(): Access {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [membership, setMembership] = useState<Keyed<Membership | null> | null>(null)
  const [team, setTeam] = useState<Keyed<Team | null> | null>(null)
  const [error, setError] = useState<Keyed<string> | null>(null)

  useEffect(() => watchUser(setUser), [])

  const uid = user?.uid
  useEffect(() => {
    if (!user) return
    const key = user.uid
    let stop: () => void = () => undefined
    let cancelled = false
    const fail = (e: unknown) => !cancelled && setError({ key, value: e instanceof Error ? e.message : String(e) })
    registerUser(user)
      .then(() => {
        if (!cancelled) stop = watchMembership(key, (value) => setMembership({ key, value }), fail)
      })
      .catch(fail)
    return () => {
      cancelled = true
      stop()
    }
  }, [user])

  const myMembership = membership && membership.key === uid ? membership.value : undefined
  const teamId = myMembership?.teamId
  useEffect(() => {
    if (!teamId) return
    return watchTeam(teamId, (value) => setTeam({ key: teamId, value }))
  }, [teamId])

  if (user === undefined) return { status: 'loading' }
  if (user === null) return { status: 'signed-out' }
  if (error && error.key === user.uid) return { status: 'error', user, error: error.value }
  const myTeam = teamId && team && team.key === teamId ? team.value : undefined
  if (myMembership === undefined || (teamId && myTeam === undefined)) return { status: 'loading' }
  const isAdmin = BOOTSTRAP_ADMIN_EMAILS.includes(user.email ?? '') || myMembership?.role === 'admin'
  if (!myMembership && !isAdmin) return { status: 'pending', user }
  return { status: 'ready', user, isAdmin, membership: myMembership, team: myTeam ?? null }
}
