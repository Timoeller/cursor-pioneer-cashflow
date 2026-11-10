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
      const who = user.uid === currentUid ? 'yourself' : user.email
      if (!window.confirm(`Remove access for ${who}? They will no longer see any data.`)) return
      run(() => setMembership(user.uid, null))
    } else {
      run(() => setMembership(user.uid, { teamId, role: current?.role ?? 'member' }))
    }
  }

  const changeRole = (user: UserProfile, role: Role) => {
    const current = members.get(user.uid)
    if (!current) return
    if (user.uid === currentUid && role !== 'admin' && !BOOTSTRAP_ADMIN_EMAILS.includes(user.email)) {
      if (!window.confirm('Remove your own admin rights? You will lose access to this tab.')) return
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
            <h2>Users</h2>
            <p className="muted small">
              Everyone who signed in shows up here. Pick a team to give someone access; everyone in a team sees and edits the same scenarios.
            </p>
          </div>
          {pending > 0 && <span className="pending-badge">{pending} waiting for approval</span>}
        </div>
        {teams.length === 0 && <div className="notice warn">Create a team below before giving anyone access.</div>}
        {users === null ? (
          <p className="muted">Loading…</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Registered</th>
                  <th>Team (access)</th>
                  <th>Role</th>
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
                              {u.uid === currentUid && <span className="muted"> (you)</span>}
                            </div>
                            <div className="muted small">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="muted">{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td>
                        <label className="sr-only" htmlFor={`team-${u.uid}`}>Team of {u.email}</label>
                        <select id={`team-${u.uid}`} value={m?.teamId ?? NO_ACCESS} onChange={(e) => changeTeam(u, e.target.value)}>
                          <option value={NO_ACCESS}>{m ? 'Remove access' : 'No access (waiting)'}</option>
                          {teams.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {builtIn ? (
                          <span className="muted">Admin (built-in)</span>
                        ) : (
                          <>
                            <label className="sr-only" htmlFor={`role-${u.uid}`}>Role of {u.email}</label>
                            <select id={`role-${u.uid}`} value={m?.role ?? 'member'} disabled={!m} onChange={(e) => changeRole(u, e.target.value as Role)}>
                              <option value="member">Member</option>
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
            <p className="muted small">Each team has its own set of scenarios.</p>
          </div>
          <button
            type="button"
            className="btn"
            onClick={() => {
              const name = window.prompt('Name of the new team')?.trim()
              if (name) run(() => createTeam(name.slice(0, 100)))
            }}
          >
            New team
          </button>
        </div>
        {teams.length === 0 ? (
          <p className="muted">No teams yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th className="r">Members</th>
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
                          const name = window.prompt('Rename team', t.name)?.trim()
                          if (name && name !== t.name) run(() => renameTeam(t.id, name.slice(0, 100)))
                        }}
                      >
                        Rename
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {error && <div className="notice bad">Error: {error}</div>}
    </div>
  )
}
