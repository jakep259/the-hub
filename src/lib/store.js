/**
 * Lightweight reactive store using localStorage + custom event bus.
 * Each slice lives in localStorage and notifies subscribers on change.
 */
// Sync callback registered by App on startup — avoids circular/early imports
let _syncCallback = null
export function registerSyncCallback(fn) { _syncCallback = fn }
function triggerSync() { if (_syncCallback) _syncCallback() }

const listeners = {}

export function subscribe(key, fn) {
  if (!listeners[key]) listeners[key] = []
  listeners[key].push(fn)
  return () => {
    listeners[key] = listeners[key].filter(f => f !== fn)
  }
}

export function notify(key) {
  ;(listeners[key] || []).forEach(fn => fn())
}

// ─── Settings ─────────────────────────────────────────────────────────────────
const SETTINGS_KEY = 'hub_settings'
const SETTINGS_DEFAULTS = {
  salary: 0,
  darkMode: false,
  defaultCommission: 5,
  goalStartDate: '2026-04-06',
  consistencyGoalTarget: 75,
  consistencyGoalDays: 85,
  incomeStreams: [
    { id: 'salary', label: 'Salary', fixed: true },
    { id: 'mb', label: 'Matched Betting', fixed: true },
    { id: 'landmark', label: 'Landmark Listings', fixed: false },
    { id: 'other', label: 'Other', fixed: false },
  ],
  notificationsEnabled: false,
  notificationTime: '08:00',
}

export function getSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return { ...SETTINGS_DEFAULTS, ...JSON.parse(raw) }
  } catch {}
  return { ...SETTINGS_DEFAULTS }
}

export function saveSettings(updates) {
  const current = getSettings()
  const next = { ...current, ...updates, _updatedAt: Date.now() }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  notify('settings')
  triggerSync()
  return next
}

// ─── Generic list store ───────────────────────────────────────────────────────
export function getList(key) {
  try {
    const raw = localStorage.getItem('hub_' + key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Handle legacy cacheSet wrapper format {data, ts} left by old sync code
    if (parsed && !Array.isArray(parsed) && Array.isArray(parsed.data)) {
      return parsed.data
    }
    return parsed
  } catch {
    return null
  }
}

export function saveList(key, data) {
  localStorage.setItem('hub_' + key, JSON.stringify(data))
  notify(key)
  triggerSync()
}

export function addItem(key, item) {
  const list = getList(key) || []
  const next = [...list, item]
  saveList(key, next)
  return next
}

export function updateItem(key, id, updates) {
  const list = getList(key) || []
  const next = list.map(i => i.id === id ? { ...i, ...updates } : i)
  saveList(key, next)
  return next
}

export function deleteItem(key, id) {
  const list = getList(key) || []
  const next = list.filter(i => i.id !== id)
  saveList(key, next)
  return next
}

// ─── ID generator ─────────────────────────────────────────────────────────────
export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

// ─── Default bookies ──────────────────────────────────────────────────────────
export const DEFAULT_BOOKIES = [
  { id: 'skybet', name: 'Sky Bet', color: '#00AEEF', status: 'Active', health: 75 },
  { id: 'betfred', name: 'Betfred', color: '#E31837', status: 'Active', health: 75 },
  { id: 'paddypower', name: 'Paddy Power', color: '#007A4D', status: 'Active', health: 75 },
  { id: 'williamhill', name: 'William Hill', color: '#FFD700', status: 'Active', health: 75 },
  { id: 'ladbrokes', name: 'Ladbrokes', color: '#DC0714', status: 'Active', health: 75 },
  { id: '888sport', name: '888sport', color: '#FF6B00', status: 'Active', health: 75 },
  { id: 'virginbet', name: 'Virgin Bet', color: '#E50014', status: 'Active', health: 75 },
  { id: 'betmgm', name: 'BetMGM', color: '#C9A96E', status: 'Active', health: 75 },
  { id: 'coral', name: 'Coral', color: '#00A9E0', status: 'Active', health: 75 },
  { id: 'livescorebet', name: 'LiveScore Bet', color: '#00CF6E', status: 'Active', health: 75 },
  { id: 'betway', name: 'Betway', color: '#00B67A', status: 'Active', health: 75 },
  { id: 'bet365', name: 'Bet365', color: '#027B5B', status: 'Gubbed', health: 0, archived: true },
  { id: 'boylesports', name: 'Boyle Sports', color: '#0073CE', status: 'Gubbed', health: 0, archived: true },
]

export function initBookies() {
  const existing = getList('bookies')
  if (!existing) {
    saveList('bookies', DEFAULT_BOOKIES.map(b => ({
      ...b,
      notes: '',
      same_day_withdrawal: false,
      stake_only_on_offer_days: false,
      created_at: new Date().toISOString(),
    })))
  }
}
