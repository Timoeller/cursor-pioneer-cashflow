import type { Settings } from '../model/types'
import { NumberField } from './fields'

interface Props {
  settings: Settings
  onChange: (s: Settings) => void
}

export function SettingsPanel({ settings, onChange }: Props) {
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch })
  return (
    <section className="card">
      <header className="card-head">
        <div>
          <h2>Settings</h2>
        </div>
      </header>
      <div className="settings-grid">
        <label>
          <span>Planning horizon (months)</span>
          <NumberField value={settings.horizonMonths} min={1} max={120} step={1} onChange={(v) => set({ horizonMonths: Math.min(120, Math.max(1, Math.round(v ?? 1))) })} />
        </label>
        <label>
          <span>Founding month (optional)</span>
          <input type="month" value={settings.foundingMonth} onChange={(e) => set({ foundingMonth: e.target.value })} />
        </label>
        <label>
          <span>Employer surcharge on salaries (%)</span>
          <NumberField value={settings.employerSurchargePct} min={0} onChange={(v) => set({ employerSurchargePct: v ?? 0 })} />
        </label>
        <label>
          <span>Cash at start</span>
          <NumberField value={settings.startingCash} onChange={(v) => set({ startingCash: v ?? 0 })} />
        </label>
        <label>
          <span>Currency</span>
          <select value={settings.currency} onChange={(e) => set({ currency: e.target.value })}>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="CHF">CHF</option>
            <option value="GBP">GBP</option>
          </select>
        </label>
      </div>
    </section>
  )
}
