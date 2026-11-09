import { useRef } from 'react'
import { signInWithGoogle, signOutUser } from '../firebase'
import { createInitialState } from '../data/initialState'
import type { PlanState } from '../model/types'
import { exportJson, importJson } from '../storage/local'
import type { CloudSync } from '../storage/useCloudSync'

interface Props {
  cloud: CloudSync
  state: PlanState
  onImport: (s: PlanState) => void
}

const STATUS_TEXT = {
  idle: '',
  pending: 'Unsaved changes…',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save failed',
} as const

export function AuthBar({ cloud, state, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const active = cloud.scenarios.find((s) => s.id === cloud.activeId)

  return (
    <div className="authbar">
      <div className="authbar-left">
        {cloud.user ? (
          <div className="scenario-picker">
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
                if (active && window.confirm(`Delete scenario "${active.name}"? This cannot be undone.`)) cloud.remove(active.id)
              }}
            >
              Delete
            </button>
            <span className={`save-status ${cloud.status}`}>{STATUS_TEXT[cloud.status]}</span>
          </div>
        ) : (
          <span className="muted small">
            {cloud.enabled ? 'Saved in this browser only. Sign in to save scenarios to your account.' : 'Saved in this browser.'}
          </span>
        )}
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
            if (window.confirm('Reset all inputs to the values from the spreadsheet?')) onImport(createInitialState())
          }}
        >
          Reset
        </button>
        {cloud.enabled &&
          (cloud.user ? (
            <div className="user">
              {cloud.user.photoURL && <img src={cloud.user.photoURL} alt="" referrerPolicy="no-referrer" />}
              <span className="small">{cloud.user.email}</span>
              <button type="button" className="btn ghost" onClick={() => signOutUser()}>
                Sign out
              </button>
            </div>
          ) : (
            <button type="button" className="btn google" disabled={!cloud.authReady} onClick={() => signInWithGoogle().catch((e) => window.alert(String(e)))}>
              <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
              </svg>
              Sign in with Google
            </button>
          ))}
      </div>

      {cloud.localLeftover && (
        <div className="notice warn full">
          This browser has data that isn't in your account yet.
          <button
            type="button"
            className="btn"
            onClick={() => {
              const leftover = cloud.localLeftover!
              cloud.dismissLocalLeftover()
              cloud.create('Imported from this browser', leftover)
            }}
          >
            Save it as a new scenario
          </button>
          <button type="button" className="btn ghost" onClick={cloud.dismissLocalLeftover}>
            Dismiss
          </button>
        </div>
      )}
      {cloud.error && <div className="notice bad full">Cloud error: {cloud.error}</div>}
    </div>
  )
}
