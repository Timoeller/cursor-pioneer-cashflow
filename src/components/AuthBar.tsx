import type { User } from 'firebase/auth'
import { useRef } from 'react'
import { signOutUser } from '../firebase'
import { createInitialState } from '../data/initialState'
import type { PlanState } from '../model/types'
import { exportJson, importJson } from '../storage/local'
import type { CloudSync } from '../storage/useCloudSync'

interface Props {
  cloud: CloudSync
  state: PlanState
  teamName: string
  onImport: (s: PlanState) => void
}

const STATUS_TEXT = {
  idle: '',
  pending: 'Unsaved changes…',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save failed',
} as const

export function UserMenu({ user }: { user: User }) {
  return (
    <div className="user">
      {user.photoURL && <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />}
      <span className="small">{user.email}</span>
      <button type="button" className="btn ghost" onClick={() => signOutUser()}>
        Sign out
      </button>
    </div>
  )
}

export function AuthBar({ cloud, state, teamName, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const active = cloud.scenarios.find((s) => s.id === cloud.activeId)

  return (
    <div className="authbar">
      <div className="authbar-left">
        <div className="scenario-picker">
          <span className="team-badge" title="Everyone in this team sees and edits the same scenarios">
            {teamName}
          </span>
          <label className="sr-only" htmlFor="scenario">Scenario</label>
          <select id="scenario" value={cloud.activeId ?? ''} onChange={(e) => cloud.open(e.target.value)}>
            {cloud.scenarios.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              const name = window.prompt('Name of the new scenario', 'New scenario')
              if (name) cloud.create(name, createInitialState())
            }}
          >
            New
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              const name = window.prompt('Name of the copy', `${active?.name ?? 'Scenario'} (copy)`)
              if (name) cloud.create(name, state)
            }}
          >
            Duplicate
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={!active}
            onClick={() => {
              const name = active && window.prompt('Rename scenario', active.name)
              if (active && name) cloud.rename(active.id, name)
            }}
          >
            Rename
          </button>
          <button
            type="button"
            className="btn ghost danger"
            disabled={!active}
            onClick={() => {
              if (active && window.confirm(`Delete scenario "${active.name}" for the whole team? This cannot be undone.`)) cloud.remove(active.id)
            }}
          >
            Delete
          </button>
          <span className={`save-status ${cloud.status}`}>{STATUS_TEXT[cloud.status]}</span>
        </div>
      </div>

      <div className="authbar-right">
        <button type="button" className="btn ghost" onClick={() => exportJson(state, active?.name.replace(/\W+/g, '-').toLowerCase())}>
          Export JSON
        </button>
        <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()}>
          Import JSON
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file) return
            try {
              onImport(await importJson(file))
            } catch {
              window.alert('Could not read this file. Is it a JSON export from this tool?')
            }
          }}
        />
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            if (window.confirm('Reset all inputs of this scenario to the values from the spreadsheet?')) onImport(createInitialState())
          }}
        >
          Reset
        </button>
      </div>

      {cloud.legacyCount > 0 && (
        <div className="notice warn full">
          You have {cloud.legacyCount} scenario{cloud.legacyCount === 1 ? '' : 's'} saved to your personal account before teams existed. Only you can see{' '}
          {cloud.legacyCount === 1 ? 'it' : 'them'}.
          <button type="button" className="btn" onClick={cloud.moveLegacyToTeam}>
            Move to {teamName}
          </button>
        </div>
      )}
      {cloud.error && <div className="notice bad full">Cloud error: {cloud.error}</div>}
    </div>
  )
}
