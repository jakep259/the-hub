/**
 * Background Supabase sync layer.
 * localStorage is the source of truth for reads (instant, offline-capable).
 * This module pushes local changes up to Supabase and pulls remote changes down.
 * Safe to call even when Supabase key is missing — silently no-ops.
 */
import { supabase, cacheSet, cacheGet } from './supabase'

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
      cacheSet(cacheKey, transformed)
      return transformed
    }
  } catch {}
  return null
}

// ─── Sync all local data up ───────────────────────────────────────────────────
export async function syncToSupabase() {
  if (!isConfigured()) return

  const tables = [
    'bookies', 'bets', 'offers', 'income_entries',
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

  // Sync settings
  const settings = localStorage.getItem('hub_settings')
  if (settings) {
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
}

// ─── Pull remote data down ────────────────────────────────────────────────────
export async function syncFromSupabase() {
  if (!isConfigured()) return

  const tables = [
    'bookies', 'bets', 'offers', 'income_entries',
    'expenses', 'daily_tasks', 'task_completions',
    'weight_log', 'calorie_log',
  ]

  for (const table of tables) {
    await pullTable(table, table, null)
  }

  // Pull settings
  try {
    const { data } = await supabase.from('user_settings').select('*').eq('id', 'default').single()
    if (data) {
      const current = JSON.parse(localStorage.getItem('hub_settings') || '{}')
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
    }
  } catch {}
}

// ─── Auto-sync on app start (non-blocking) ────────────────────────────────────
export function initSync() {
  if (!isConfigured()) return

  // Pull fresh data in background after 2s
  setTimeout(async () => {
    await syncFromSupabase()
  }, 2000)

  // Push local changes every 5 minutes
  setInterval(async () => {
    await syncToSupabase()
  }, 5 * 60 * 1000)

  // Push on page visibility change (tab regains focus)
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
