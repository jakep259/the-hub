/**
 * Background Supabase sync layer.
 * localStorage is the source of truth for reads (instant, offline-capable).
 * This module pushes local changes up to Supabase and pulls remote changes down.
 * Safe to call even when Supabase key is missing — silently no-ops.
 */
import { supabase, cacheSet, cacheGet } from './supabase'
import { notify } from './store'

const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

function isConfigured() {
  return !!supabase && !!ANON_KEY && ANON_KEY !== 'your_supabase_anon_key_here'
}

// Fields that only exist in localStorage — never sent to Supabase
// bet_id links an offer entry back to its bet locally, but the offers table
// doesn't have that column in Supabase so we strip it before pushing.
const LOCAL_ONLY_FIELDS = new Set(['bet_id'])

// Strip localStorage-only fields before sending to Supabase
function toDb(row) {
  return Object.fromEntries(
    Object.entries(row).filter(([k]) => !k.startsWith('_') && !LOCAL_ONLY_FIELDS.has(k))
  )
}

// ─── Generic upsert-all ───────────────────────────────────────────────────────
async function pushTable(table, rows) {
  if (!isConfigured() || !rows?.length) return
  try {
    await supabase.from(table).upsert(rows.map(toDb), { onConflict: 'id' })
  } catch {}
}

async function pullTable(table, cacheKey, transform) {
  if (!isConfigured()) return null
  try {
    const { data, error } = await supabase.from(table).select('*')
    if (!error && data) {
      const transformed = transform ? data.map(transform) : data

      // Remote is authoritative — replace local completely.
      // Data is pushed to Supabase within 300ms of every save (schedulePush),
      // so local-only records should not exist in normal operation. Keeping
      // local-only records caused perpetual cross-device divergence when one
      // device had stale/wrong records that never existed in Supabase.
      //
      // Exception: if a bet is settled locally but Supabase hasn't caught up
      // yet (within the same 5-second pull window), keep the local settled state.
      const localRaw = localStorage.getItem('hub_' + cacheKey)
      const local = localRaw ? JSON.parse(localRaw) : []
      const localMap = new Map(Array.isArray(local) ? local.map(r => [r.id, r]) : [])

      const result = transformed.map(remoteRow => {
        const localRow = localMap.get(remoteRow.id)
        // Keep local if settled locally and remote hasn't caught up yet
        // Only within a short grace window (30s) to avoid permanently freezing a wrong state
        if (
          localRow?.status === 'settled' &&
          remoteRow.status !== 'settled' &&
          localRow._settledAt &&
          Date.now() - localRow._settledAt < 30000
        ) return localRow
        return remoteRow
      })

      localStorage.setItem('hub_' + cacheKey, JSON.stringify(result))
      notify(cacheKey)
      return result
    }
  } catch {}
  return null
}

// ─── Sync all local data up ───────────────────────────────────────────────────
export async function syncToSupabase() {
  if (!isConfigured()) return

  const tables = [
    'bookies', 'open_bets', 'offers', 'income_entries',
    'expenses', 'daily_tasks', 'task_completions',
    'weight_log', 'calorie_log',
  ]

  for (const table of tables) {
    const raw = localStorage.getItem('hub_' + table)
    if (raw) {
      try {
        const rows = JSON.parse(raw)
        await pushTable(table, rows)
      } catch {}
    }
  }

  // Settings are pushed immediately on save via pushSettings() — skip here to
  // prevent stale local defaults overwriting another device's recent changes.
}

// ─── Pull remote data down ────────────────────────────────────────────────────
export async function syncFromSupabase() {
  if (!isConfigured()) return

  const tables = [
    'bookies', 'open_bets', 'offers', 'income_entries',
    'expenses', 'daily_tasks', 'task_completions',
    'weight_log', 'calorie_log',
    // consistency_log is a keyed object, not an array — excluded from array-based sync
  ]

  for (const table of tables) {
    await pullTable(table, table, null)
  }

  // Pull settings — skip if saved locally in the last 5 seconds (let push land first)
  try {
    const { data } = await supabase.from('user_settings').select('*').eq('id', 'default').single()
    if (data) {
      const current = JSON.parse(localStorage.getItem('hub_settings') || '{}')
      const localUpdatedAt = current._updatedAt || 0
      if (Date.now() - localUpdatedAt < 30000) return
      const merged = {
        ...current,
        salary: data.salary,
        defaultCommission: data.default_commission,
        darkMode: data.dark_mode,
        goalStartDate: data.goal_start_date,
        consistencyGoalTarget: data.consistency_goal_target,
        consistencyGoalDays: data.consistency_goal_days,
        incomeStreams: data.income_streams?.length ? data.income_streams : current.incomeStreams,
        notificationsEnabled: data.notifications_enabled,
        notificationTime: data.notification_time,
      }
      localStorage.setItem('hub_settings', JSON.stringify(merged))
      notify('settings')
    }
  } catch {}
}

// ─── Push settings immediately (called on every settings save) ───────────────
export async function pushSettings() {
  if (!isConfigured()) return
  const settings = localStorage.getItem('hub_settings')
  if (!settings) return
  const s = JSON.parse(settings)
  const payload = {
    id: 'default',
    salary: s.salary ?? 0,
    default_commission: s.defaultCommission ?? 5,
    dark_mode: s.darkMode ?? false,
    goal_start_date: s.goalStartDate,
    consistency_goal_target: s.consistencyGoalTarget,
    consistency_goal_days: s.consistencyGoalDays,
    income_streams: s.incomeStreams ?? [],
    notifications_enabled: s.notificationsEnabled ?? false,
    notification_time: s.notificationTime ?? '08:00',
  }
  // Retry up to 3 times so a transient failure doesn't leave Supabase stale
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { error } = await supabase.from('user_settings').upsert(payload)
      if (!error) return
      console.warn('[pushSettings] attempt', attempt + 1, error.message)
    } catch (err) {
      console.warn('[pushSettings] attempt', attempt + 1, err)
    }
    if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
  }
}

// ─── Force push: replace ALL remote data with this device's local data ───────
// Use this when this device has the authoritative data and you want to wipe
// Supabase clean and repopulate it. All other devices will pick up the correct
// data on their next 5-second pull.
export async function forcePushToSupabase() {
  if (!isConfigured()) throw new Error('Supabase not configured')

  const tables = [
    'bookies', 'open_bets', 'offers', 'income_entries',
    'expenses', 'daily_tasks', 'task_completions',
    'weight_log', 'calorie_log',
  ]

  for (const table of tables) {
    try {
      // Delete all rows in this table on Supabase
      await supabase.from(table).delete().gte('id', '')
      // Re-insert local data (strip _private localStorage-only fields)
      const raw = localStorage.getItem('hub_' + table)
      if (raw) {
        const rows = JSON.parse(raw)
        if (Array.isArray(rows) && rows.length > 0) {
          await supabase.from(table).upsert(rows.map(toDb), { onConflict: 'id' })
        }
      }
    } catch {}
  }

  // Push settings too
  await pushSettings()
}

// ─── Debounced push — called after every data save ───────────────────────────
let _pushTimer = null
export function schedulePush() {
  if (!isConfigured()) return
  clearTimeout(_pushTimer)
  _pushTimer = setTimeout(() => syncToSupabase(), 300)
}

// ─── Quick poll: only settings (1 request every 2s instead of 11) ────────────
async function quickPollSettings() {
  if (!isConfigured()) return
  try {
    const { data } = await supabase.from('user_settings').select('*').eq('id', 'default').single()
    if (data) {
      const current = JSON.parse(localStorage.getItem('hub_settings') || '{}')
      const localUpdatedAt = current._updatedAt || 0
      if (Date.now() - localUpdatedAt < 30000) return
      const merged = {
        ...current,
        salary: data.salary,
        defaultCommission: data.default_commission,
        darkMode: data.dark_mode,
        goalStartDate: data.goal_start_date,
        consistencyGoalTarget: data.consistency_goal_target,
        consistencyGoalDays: data.consistency_goal_days,
        incomeStreams: data.income_streams?.length ? data.income_streams : current.incomeStreams,
        notificationsEnabled: data.notifications_enabled,
        notificationTime: data.notification_time,
      }
      localStorage.setItem('hub_settings', JSON.stringify(merged))
      notify('settings')
    }
  } catch {}
}

// ─── Auto-sync on app start (non-blocking) ────────────────────────────────────
let _syncInitialised = false
export function initSync() {
  if (!isConfigured() || _syncInitialised) return
  _syncInitialised = true

  // Full pull on startup
  syncFromSupabase()

  // Poll only settings every 2 seconds (cheap: 1 request)
  setInterval(() => quickPollSettings(), 2000)

  // Full table sync every 5 seconds for fast cross-device updates
  setInterval(() => syncFromSupabase(), 5000)

  // Push local changes every 30 seconds as a safety net
  setInterval(() => syncToSupabase(), 30 * 1000)

  // Push when leaving the app, full pull when returning
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      syncFromSupabase()
    } else {
      syncToSupabase()
    }
  })

  // Push before page unload
  window.addEventListener('beforeunload', () => {
    syncToSupabase()
  })
}
