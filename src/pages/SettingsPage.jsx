import { useState, useEffect, useRef, useContext } from 'react'
import { Plus, X, Save, Download, Moon, Sun, Database, Wifi, WifiOff } from 'lucide-react'
import { getSettings, saveSettings, getList, saveList, genId } from '../lib/store'
import { format } from 'date-fns'
import { DarkModeContext } from '../App'

function Section({ title, children }) {
  const { darkMode } = useContext(DarkModeContext)
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3" style={{ borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : '#f3f4f6'}` }}>
        <h3 className="text-sm font-bold" style={{ color: darkMode ? '#f9fafb' : '#0D1F35' }}>{title}</h3>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  )
}

function Row({ label, sub, children }) {
  const { darkMode } = useContext(DarkModeContext)
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1">
        <span className="text-sm" style={{ color: darkMode ? '#e5e7eb' : '#374151' }}>{label}</span>
        {sub && <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{sub}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

function Toggle({ on, onChange }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`toggle ${on ? 'on' : ''}`}
      type="button"
    />
  )
}

export default function SettingsPage() {
  const { darkMode, setDarkMode } = useContext(DarkModeContext)
  const [settings, setSettings] = useState(getSettings())
  const [saved, setSaved] = useState(false)
  const isFirstRender = useRef(true)
  const [bookies, setBookies] = useState(getList('bookies') || [])
  const [supabaseKey, setSupabaseKey] = useState(() => {
    try { return JSON.parse(localStorage.getItem('hub_supabase_key') || '""') } catch { return '' }
  })
  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState(null)

  function update(key, val) {
    setSettings(prev => ({ ...prev, [key]: val }))
  }

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    saveSettings(settings)
  }, [settings])

  function persist() {
    saveSettings(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // Dark mode is immediate — no need to save separately
  function handleDarkMode(val) {
    setDarkMode(val)
    update('darkMode', val)
  }

  async function manualSync() {
    setSyncing(true)
    setSyncStatus(null)
    try {
      const { syncToSupabase, syncFromSupabase } = await import('../lib/sync')
      await syncFromSupabase()
      await syncToSupabase()
      setSyncStatus('success')
    } catch {
      setSyncStatus('error')
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncStatus(null), 3000)
    }
  }

  function saveSupabaseKey(key) {
    setSupabaseKey(key)
    localStorage.setItem('hub_supabase_key', JSON.stringify(key))
    // Reload to pick up new key
    if (key) {
      import.meta.env.VITE_SUPABASE_ANON_KEY = key // Won't work at runtime, but store it
    }
  }

  // Income streams
  function addStream() {
    const streams = settings.incomeStreams || []
    update('incomeStreams', [...streams, { id: genId(), label: 'New Stream', fixed: false }])
  }
  function updateStream(id, label) {
    update('incomeStreams', (settings.incomeStreams || []).map(s => s.id === id ? { ...s, label } : s))
  }
  function removeStream(id) {
    update('incomeStreams', (settings.incomeStreams || []).filter(s => s.id !== id))
  }

  function exportAll() {
    const allData = {
      settings: getSettings(),
      bookies: getList('bookies'),
      bets: getList('bets'),
      open_bets: getList('open_bets'),
      offers: getList('offers'),
      income_entries: getList('income_entries'),
      expenses: getList('expenses'),
      daily_tasks: getList('daily_tasks'),
      task_completions: getList('task_completions'),
      weight_log: getList('weight_log'),
      calorie_log: getList('calorie_log'),
      consistency_log: getList('consistency_log'),
    }
    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `the-hub-backup-${format(new Date(), 'yyyy-MM-dd')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const manualStreams = (settings.incomeStreams || []).filter(s => !s.fixed)
  const fixedStreams = (settings.incomeStreams || []).filter(s => s.fixed)

  const isDark = darkMode
  const textColor = isDark ? '#e5e7eb' : '#374151'
  const mutedColor = '#9ca3af'

  return (
    <div className="max-w-lg lg:max-w-2xl mx-auto px-4 py-5 pb-24 lg:pb-5 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="section-title text-xl">Settings</h1>
        <button
          onClick={persist}
          className="btn-primary text-sm flex items-center gap-1.5 px-4 py-2"
          style={saved ? { background: '#10b981' } : {}}
        >
          <Save size={14} /> {saved ? 'Saved!' : 'Save'}
        </button>
      </div>

      {/* Appearance */}
      <Section title="Appearance">
        <Row label="Dark mode" sub="Switches immediately">
          <Toggle on={darkMode} onChange={handleDarkMode} />
        </Row>
      </Section>

      {/* Sync */}
      <Section title="Cross-device Sync">
        <div
          className="rounded-xl p-3 text-sm"
          style={{ background: isDark ? 'rgba(201,169,110,0.08)' : 'rgba(13,31,53,0.04)' }}
        >
          <p className="font-semibold mb-1" style={{ color: textColor }}>How sync works</p>
          <p className="text-xs leading-relaxed" style={{ color: mutedColor }}>
            All data saves to this device instantly (localStorage). To sync between iPhone and MacBook, deploy the app to Netlify with your Supabase anon key as <code className="px-1 py-0.5 rounded" style={{ background: isDark ? 'rgba(255,255,255,0.1)' : '#f3f4f6' }}>VITE_SUPABASE_ANON_KEY</code> in Netlify environment variables. Both devices then share the same database.
          </p>
        </div>
        <Row label="Manual sync now" sub="Push local → Supabase and pull latest">
          <button
            onClick={manualSync}
            disabled={syncing}
            className="btn-ghost text-xs px-3 py-2 flex items-center gap-1.5"
          >
            {syncing ? (
              <span className="animate-spin">⟳</span>
            ) : syncStatus === 'success' ? (
              <><Wifi size={13} className="text-emerald-500" /> Synced!</>
            ) : syncStatus === 'error' ? (
              <><WifiOff size={13} className="text-red-400" /> Failed</>
            ) : (
              <><Database size={13} /> Sync</>
            )}
          </button>
        </Row>
      </Section>

      {/* Income */}
      <Section title="Income">
        <Row label="Monthly salary (net)">
          <div className="flex items-center gap-1">
            <span className="text-sm" style={{ color: mutedColor }}>£</span>
            <input
              className="input w-28 text-right"
              type="number"
              value={settings.salary || ''}
              onChange={e => update('salary', Number(e.target.value))}
              placeholder="0"
            />
          </div>
        </Row>

        <div>
          <p className="label">Income Streams</p>
          <div className="space-y-2 mt-1">
            {fixedStreams.map(s => (
              <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded-xl" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb' }}>
                <span className="text-sm" style={{ color: mutedColor }}>{s.label}</span>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb', color: mutedColor }}>Fixed</span>
              </div>
            ))}
            {manualStreams.map(s => (
              <div key={s.id} className="flex items-center gap-2">
                <input className="input flex-1 text-sm" value={s.label} onChange={e => updateStream(s.id, e.target.value)} />
                <button onClick={() => removeStream(s.id)} className="p-1 text-red-400"><X size={15} /></button>
              </div>
            ))}
            <button onClick={addStream} className="flex items-center gap-1 text-sm font-semibold" style={{ color: '#C9A96E' }}>
              <Plus size={14} /> Add income stream
            </button>
          </div>
        </div>
      </Section>

      {/* Calculators */}
      <Section title="Calculators">
        <Row label="Default commission (%)">
          <input className="input w-20 text-right" type="text" inputMode="decimal" value={settings.defaultCommission ?? 5} onChange={e => update('defaultCommission', Number(e.target.value))} />
        </Row>
      </Section>

      {/* Goals */}
      <Section title="Goals">
        <Row label="Consistency start date">
          <input className="input w-36" type="date" value={settings.goalStartDate || '2026-04-06'} onChange={e => update('goalStartDate', e.target.value)} />
        </Row>
        <Row label="Win target">
          <input className="input w-20 text-right" type="number" value={settings.consistencyGoalTarget || 75} onChange={e => update('consistencyGoalTarget', Number(e.target.value))} />
        </Row>
        <Row label="Total days">
          <input className="input w-20 text-right" type="number" value={settings.consistencyGoalDays || 85} onChange={e => update('consistencyGoalDays', Number(e.target.value))} />
        </Row>
      </Section>

      {/* Bookies summary */}
      <Section title="Bookies">
        <div className="space-y-1">
          {bookies.filter(b => !b.archived).map(b => (
            <div key={b.id} className="flex items-center justify-between py-1.5" style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6'}` }}>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: b.color }} />
                <span className="text-sm" style={{ color: textColor }}>{b.name}</span>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{
                background: b.status === 'Active' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                color: b.status === 'Active' ? '#10b981' : '#f59e0b'
              }}>{b.status}</span>
            </div>
          ))}
        </div>
        <p className="text-xs" style={{ color: mutedColor }}>Add/edit bookies in Matched Betting → Bookies</p>
      </Section>

      {/* Notifications */}
      <Section title="Notifications">
        <Row label="Daily task reminder">
          <Toggle on={settings.notificationsEnabled || false} onChange={v => update('notificationsEnabled', v)} />
        </Row>
        {settings.notificationsEnabled && (
          <Row label="Reminder time">
            <input className="input w-28" type="time" value={settings.notificationTime || '08:00'} onChange={e => update('notificationTime', e.target.value)} />
          </Row>
        )}
      </Section>

      {/* Data */}
      <Section title="Data & Backup">
        <button onClick={exportAll} className="btn-ghost w-full text-sm flex items-center justify-center gap-2">
          <Download size={15} /> Export all data (JSON backup)
        </button>
      </Section>

      <div className="text-center py-4">
        <p className="text-xs" style={{ color: mutedColor }}>The Hub v1.0.0 · localStorage-first · PWA</p>
      </div>
    </div>
  )
}
