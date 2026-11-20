import { useEffect, useState } from 'react'
import {
  BOOTSTRAP_ADMIN_EMAILS,
  createTeam,
  renameTeam,
  setMembership,
  watchMembers,
  watchTeams,
  watchUsers,
  type Membership,
  type Role,
  type Team,
  type UserProfile,
} from '../firebase'

interface Props {
  currentUid: string
}

const NO_ACCESS = ''

export function AdminPanel({ currentUid }: Props) {
  const [users, setUsers] = useState<UserProfile[] | null>(null)
  const [members, setMembers] = useState<Map<string, Membership>>(new Map())
  const [teams, setTeams] = useState<Team[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onError = (e: Error) => setError(e.message)
    const stops = [watchUsers(setUsers, onError), watchMembers(setMembers, onError), watchTeams(setTeams, onError)]
    return () => stops.forEach((stop) => stop())
  }, [])

  const run = (fn: () => Promise<unknown>) => {
    setError(null)
    fn().catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }

  const changeTeam = (user: UserProfile, teamId: string) => {
    const current = members.get(user.uid)
    if (teamId === NO_ACCESS) {
      const who = user.uid === currentUid ? 'dich selbst' : user.email
      if (!window.confirm(`Zugriff für ${who} entziehen? Danach sind keine Daten mehr sichtbar.`)) return
      run(() => setMembership(user.uid, null))
    } else {
      run(() => setMembership(user.uid, { teamId, role: current?.role ?? 'member' }))
    }
  }

  const changeRole = (user: UserProfile, role: Role) => {
    const current = members.get(user.uid)
    if (!current) return
    if (user.uid === currentUid && role !== 'admin' && !BOOTSTRAP_ADMIN_EMAILS.includes(user.email)) {
      if (!window.confirm('Eigene Admin-Rechte entziehen? Du verlierst den Zugriff auf diesen Bereich.')) return
    }
    run(() => setMembership(user.uid, { ...current, role }))
  }

  const pending = users?.filter((u) => !members.has(u.uid)).length ?? 0
  const sortedUsers = [...(users ?? [])].sort((a, b) => Number(members.has(a.uid)) - Number(members.has(b.uid)) || b.createdAt - a.createdAt)
  const memberCount = (teamId: string) => [...members.values()].filter((m) => m.teamId === teamId).length

  return (
    <div className="admin">
      <section className="card">
        <div className="card-head">
          <div>
            <h2>Nutzer</h2>
            <p className="muted small">
              Hier erscheinen alle, die sich angemeldet haben. Wähle ein Team, um jemandem Zugriff zu geben. Alle in einem Team sehen und bearbeiten dieselben Szenarien.
            </p>
          </div>
          {pending > 0 && <span className="pending-badge">{pending === 1 ? '1 wartet auf Freigabe' : `${pending} warten auf Freigabe`}</span>}
        </div>
        {teams.length === 0 && <div className="notice warn">Lege unten ein Team an, bevor du jemandem Zugriff gibst.</div>}
        {users === null ? (
          <p className="muted">Wird geladen…</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table admin-table">
              <thead>
                <tr>
                  <th>Nutzer</th>
                  <th>Registriert</th>
                  <th>Team (Zugriff)</th>
                  <th>Rolle</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map((u) => {
                  const m = members.get(u.uid)
                  const builtIn = BOOTSTRAP_ADMIN_EMAILS.includes(u.email)
                  return (
                    <tr key={u.uid} className={m ? '' : 'pending-row'}>
                      <td>
                        <div className="user-cell">
                          {u.photoURL ? <img src={u.photoURL} alt="" referrerPolicy="no-referrer" /> : <span className="avatar-placeholder" />}
                          <div>
                            <div>
                              {u.displayName || u.email}
                              {u.uid === currentUid && <span className="muted"> (du)</span>}
                            </div>
                            <div className="muted small">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="muted">{new Date(u.createdAt).toLocaleDateString('de-DE')}</td>
                      <td>
                        <label className="sr-only" htmlFor={`team-${u.uid}`}>Team von {u.email}</label>
                        <select id={`team-${u.uid}`} value={m?.teamId ?? NO_ACCESS} onChange={(e) => changeTeam(u, e.target.value)}>
                          <option value={NO_ACCESS}>{m ? 'Zugriff entziehen' : 'Kein Zugriff (wartet)'}</option>
                          {teams.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {builtIn ? (
                          <span className="muted">Admin (fest)</span>
                        ) : (
                          <>
                            <label className="sr-only" htmlFor={`role-${u.uid}`}>Rolle von {u.email}</label>
                            <select id={`role-${u.uid}`} value={m?.role ?? 'member'} disabled={!m} onChange={(e) => changeRole(u, e.target.value as Role)}>
                              <option value="member">Mitglied</option>
                              <option value="admin">Admin</option>
                            </select>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h2>Teams</h2>
            <p className="muted small">Jedes Team hat eigene Szenarien.</p>
          </div>
          <button
            type="button"
            className="btn"
            onClick={() => {
              const name = window.prompt('Name des neuen Teams')?.trim()
              if (name) run(() => createTeam(name.slice(0, 100)))
            }}
          >
            Neues Team
          </button>
        </div>
        {teams.length === 0 ? (
          <p className="muted">Noch keine Teams.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th className="r">Mitglieder</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {teams.map((t) => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td className="r mono">{memberCount(t.id)}</td>
                    <td className="r">
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => {
                          const name = window.prompt('Team umbenennen', t.name)?.trim()
                          if (name && name !== t.name) run(() => renameTeam(t.id, name.slice(0, 100)))
                        }}
                      >
                        Umbenennen
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {error && <div className="notice bad">Fehler: {error}</div>}
    </div>
  )
}
