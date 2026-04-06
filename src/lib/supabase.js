import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://lphirhopfefgtjfelaxj.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Only create a real client when the key is configured — avoids crash when running locally without .env
export const supabase = SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null

// ─── localStorage cache helpers ───────────────────────────────────────────────
const PREFIX = 'hub_'

export function cacheSet(key, data) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ data, ts: Date.now() }))
  } catch {}
}

export function cacheGet(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return null
    return JSON.parse(raw).data
  } catch {
    return null
  }
}

export function cacheDelete(key) {
  localStorage.removeItem(PREFIX + key)
}

// ─── Generic CRUD with cache-first reads ──────────────────────────────────────
export async function dbFetch(table, cacheKey, query = null) {
  const cached = cacheGet(cacheKey)

  const fetchFresh = async () => {
    if (!supabase) return cached || []
    try {
      let q = supabase.from(table).select('*')
      if (query) q = query(q)
      const { data, error } = await q
      if (!error && data) {
        cacheSet(cacheKey, data)
        return data
      }
    } catch {}
    return cached || []
  }

  if (cached) {
    fetchFresh() // background sync
    return cached
  }

  return fetchFresh()
}

export async function dbInsert(table, row, cacheKey) {
  if (!supabase) return { data: null, error: new Error('Supabase not configured') }
  const { data, error } = await supabase.from(table).insert(row).select().single()
  if (!error && data && cacheKey) {
    const cached = cacheGet(cacheKey) || []
    cacheSet(cacheKey, [...cached, data])
  }
  return { data, error }
}

export async function dbUpdate(table, id, updates, cacheKey) {
  if (!supabase) return { data: null, error: new Error('Supabase not configured') }
  const { data, error } = await supabase.from(table).update(updates).eq('id', id).select().single()
  if (!error && data && cacheKey) {
    const cached = cacheGet(cacheKey) || []
    cacheSet(cacheKey, cached.map(r => r.id === id ? data : r))
  }
  return { data, error }
}

export async function dbDelete(table, id, cacheKey) {
  if (!supabase) return { error: new Error('Supabase not configured') }
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (!error && cacheKey) {
    const cached = cacheGet(cacheKey) || []
    cacheSet(cacheKey, cached.filter(r => r.id !== id))
  }
  return { error }
}

export async function dbUpsert(table, row, cacheKey) {
  if (!supabase) return { data: null, error: new Error('Supabase not configured') }
  const { data, error } = await supabase.from(table).upsert(row).select().single()
  if (!error && data && cacheKey) {
    const cached = cacheGet(cacheKey) || []
    const idx = cached.findIndex(r => r.id === data.id)
    if (idx >= 0) {
      cached[idx] = data
      cacheSet(cacheKey, cached)
    } else {
      cacheSet(cacheKey, [...cached, data])
    }
  }
  return { data, error }
}
