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

// ─── Generic upsert-all ───────────────────────────────────────────────────────
async function pushTable(table, rows) {
  if (!isConfigured() || !rows?.length) return
  try {
    await supabase.from(table).upsert(rows, { onConflict: 'id' })
  } catch {}
}

async function pullTable(table, cacheKey, transform) {
  if (!isConfigured()) return null
  try {
    const { data, error } = await supabase.from(table).select('*')
    if (!error && data) {
      const transformed = transform ? data.map(transform) : data
      // Merge: keep any local records that haven't been pushed to Supabase yet
      const localRaw = localStorage.getItem('hub_' + cacheKey)
      const local = localRaw ? JSON.parse(localRaw) : []
      const remoteIds = new Set(transformed.map(r => r.id))
      const localOnly = Array.isArray(local) ? local.filter(r => !remoteIds.has(r.id)) : []
      const merged = [...transformed, ...localOnly]
      localStorage.setItem('hub_' + cacheKey, JSON.stringify(merged))
      notify(cacheKey)
      // Push any local-only records immediately so they don't get lost
      if (localOnly.length > 0) pushTable(table, localOnly)
      return merged
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
    'weight_log', 'calorie_log', 'consistency_log',
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
    'weight_log', 'calorie_log', 'consistency_log',
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
      if (Date.now() - localUpdatedAt < 5000) return
      const merged = {
        ...current,
        salary: data.salary,
        defaultCommission: data.default_commission,
        darkMode: data.dark_mode,
        goalStartDate: data.goal_start_date,
        consistencyGoalTarget: data.consistency_goal_target,
        consistencyGoalDays: data.consistency_goal_days,
        incomeStreams: data.income_streams || current.incomeStreams,
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
  try {
    const s = JSON.parse(settings)
    await supabase.from('user_settings').upsert({
      id: 'default',
      salary: s.salary,
      default_commission: s.defaultCommission,
      dark_mode: s.darkMode,
      goal_start_date: s.goalStartDate,
      consistency_goal_target: s.consistencyGoalTarget,
      consistency_goal_days: s.consistencyGoalDays,
      income_streams: s.incomeStreams,
      notifications_enabled: s.notificationsEnabled,
      notification_time: s.notificationTime,
    })
  } catch {}
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
      if (Date.now() - localUpdatedAt < 5000) return
      const merged = {
        ...current,
        salary: data.salary,
        defaultCommission: data.default_commission,
        darkMode: data.dark_mode,
        goalStartDate: data.goal_start_date,
        consistencyGoalTarget: data.consistency_goal_target,
        consistencyGoalDays: data.consistency_goal_days,
        incomeStreams: data.income_streams || current.incomeStreams,
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

  // Full table sync every 30 seconds as a safety net
  setInterval(() => syncFromSupabase(), 30 * 1000)

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
