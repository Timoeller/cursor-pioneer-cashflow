import type { User } from 'firebase/auth'
import { useRef } from 'react'
import { signOutUser } from '../firebase'
import { createInitialState } from '../data/initialState'
import type { PlanState } from '../model/types'
import { exportJson, importJson } from '../storage/local'
import type { CloudSync } from '../storage/useCloudSync'
import { deCount } from '../ui/de'

interface Props {
  cloud: CloudSync
  state: PlanState
  teamName: string
  onImport: (s: PlanState) => void
}

const STATUS_TEXT = {
  idle: '',
  pending: 'Ungespeicherte Änderungen…',
  saving: 'Wird gespeichert…',
  saved: 'Gespeichert',
  error: 'Speichern fehlgeschlagen',
} as const

export function UserMenu({ user }: { user: User }) {
  return (
    <div className="user">
      {user.photoURL && <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />}
      <span className="small">{user.email}</span>
      <button type="button" className="btn ghost" onClick={() => signOutUser()}>
        Abmelden
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
          <span className="team-badge" title="Alle in diesem Team sehen und bearbeiten dieselben Szenarien">
            {teamName}
          </span>
          <label className="sr-only" htmlFor="scenario">Szenario</label>
          <select id="scenario" value={cloud.activeId ?? ''} onChange={(e) => cloud.open(e.target.value)}>
            {cloud.scenarios.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              const name = window.prompt('Name des neuen Szenarios', 'Neues Szenario')
              if (name) cloud.create(name, createInitialState())
            }}
          >
            Neu
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              const name = window.prompt('Name der Kopie', `${active?.name ?? 'Szenario'} (Kopie)`)
              if (name) cloud.create(name, state)
            }}
          >
            Duplizieren
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={!active}
            onClick={() => {
              const name = active && window.prompt('Szenario umbenennen', active.name)
              if (active && name) cloud.rename(active.id, name)
            }}
          >
            Umbenennen
          </button>
          <button
            type="button"
            className="btn ghost danger"
            disabled={!active}
            onClick={() => {
              if (active && window.confirm(`Szenario „${active.name}“ für das ganze Team löschen? Das kann nicht rückgängig gemacht werden.`)) cloud.remove(active.id)
            }}
          >
            Löschen
          </button>
          <span className={`save-status ${cloud.status}`}>{STATUS_TEXT[cloud.status]}</span>
        </div>
      </div>

      <div className="authbar-right">
        <button type="button" className="btn ghost" onClick={() => exportJson(state, active?.name.replace(/\W+/g, '-').toLowerCase())}>
          JSON exportieren
        </button>
        <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()}>
          JSON importieren
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
              window.alert('Diese Datei konnte nicht gelesen werden. Ist es ein JSON-Export aus diesem Tool?')
            }
          }}
        />
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            if (window.confirm('Alle Eingaben dieses Szenarios auf die Werte aus der Tabelle zurücksetzen?')) onImport(createInitialState())
          }}
        >
          Zurücksetzen
        </button>
      </div>

      {cloud.legacyCount > 0 && (
        <div className="notice warn full">
          Du hast {deCount(cloud.legacyCount, 'Szenario', 'Szenarien')}, die vor den Teams in deinem persönlichen Konto gespeichert wurden. Nur du
          kannst {cloud.legacyCount === 1 ? 'es' : 'sie'} sehen.
          <button type="button" className="btn" onClick={cloud.moveLegacyToTeam}>
            Zu {teamName} verschieben
          </button>
        </div>
      )}
      {cloud.error && <div className="notice bad full">Cloud-Fehler: {cloud.error}</div>}
    </div>
  )
}
