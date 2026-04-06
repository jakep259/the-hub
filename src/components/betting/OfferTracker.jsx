import { useState, useEffect } from 'react'
import { Plus, X, ChevronDown, ChevronUp, Filter } from 'lucide-react'
import { getList, saveList, genId } from '../../lib/store'
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const OFFER_TYPES = ['Reload', 'Free Bet', 'Price Boost', 'ACCA Insurance', 'Daily Spin', 'Other']
const STATUSES = ['Pending', 'Taken', 'Skipped', 'Completed']

function OfferModal({ offer, bookies, onSave, onClose }) {
  const [form, setForm] = useState(offer || {
    id: genId(),
    bookie_id: '',
    offer_type: 'Reload',
    status: 'Pending',
    expected_profit: '',
    actual_profit: '',
    skip_reason: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
  })

  function save() {
    if (!form.bookie_id || !form.date) return
    onSave(form)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end lg:items-center justify-center pb-20 lg:pb-0 bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-navy-700 rounded-t-2xl lg:rounded-2xl w-full max-w-md p-5 space-y-3 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg text-navy-700 dark:text-white">{offer ? 'Edit Offer' : 'Log Offer'}</h3>
          <button onClick={onClose}><X size={20} className="text-gray-500" /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label">Bookie</label>
            <select className="input" value={form.bookie_id} onChange={e => setForm({...form, bookie_id: e.target.value})}>
              <option value="">Select...</option>
              {bookies.filter(b => !b.archived).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Offer Type</label>
            <select className="input" value={form.offer_type} onChange={e => setForm({...form, offer_type: e.target.value})}>
              {OFFER_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Expected Profit (£)</label>
            <input className="input" type="number" value={form.expected_profit} onChange={e => setForm({...form, expected_profit: e.target.value})} />
          </div>
          <div>
            <label className="label">Actual Profit (£)</label>
            <input className="input" type="number" value={form.actual_profit} onChange={e => setForm({...form, actual_profit: e.target.value})} />
          </div>
          <div>
            <label className="label">Date</label>
            <input className="input" type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
          </div>
          <div>
            <label className="label">Skip Reason</label>
            <input className="input" value={form.skip_reason} onChange={e => setForm({...form, skip_reason: e.target.value})} />
          </div>
          <div className="col-span-2">
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={save} className="btn-primary flex-1">Save Offer</button>
          <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const cls = {
    Pending: 'bg-blue-100 text-blue-700',
    Taken: 'bg-amber-100 text-amber-700',
    Skipped: 'bg-gray-100 text-gray-600',
    Completed: 'bg-emerald-100 text-emerald-700',
  }[status] || 'bg-gray-100 text-gray-600'
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{status}</span>
}

export default function OfferTracker() {
  const [offers, setOffers] = useState([])
  const [bookies, setBookies] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editOffer, setEditOffer] = useState(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [view, setView] = useState('list') // list | stats

  function load() {
    setOffers(getList('offers') || [])
    setBookies(getList('bookies') || [])
  }
  useEffect(() => { load() }, [])

  function saveOffer(offer) {
    const existing = getList('offers') || []
    const idx = existing.findIndex(o => o.id === offer.id)
    let next
    if (idx >= 0) {
      next = existing.map(o => o.id === offer.id ? offer : o)
    } else {
      next = [...existing, offer]
    }
    saveList('offers', next)
    setOffers(next)
  }

  function deleteOffer(id) {
    const next = (getList('offers') || []).filter(o => o.id !== id)
    saveList('offers', next)
    setOffers(next)
  }

  const now = new Date()
  const thisMonthOffers = offers.filter(o => {
    try { return isWithinInterval(parseISO(o.date), { start: startOfMonth(now), end: endOfMonth(now) }) }
    catch { return false }
  })

  const shown = filterStatus === 'all' ? thisMonthOffers : thisMonthOffers.filter(o => o.status === filterStatus)

  const totalExpected = thisMonthOffers.filter(o => o.expected_profit).reduce((s, o) => s + Number(o.expected_profit), 0)
  const totalActual = thisMonthOffers.filter(o => o.actual_profit != null && o.actual_profit !== '').reduce((s, o) => s + Number(o.actual_profit), 0)
  const taken = thisMonthOffers.filter(o => o.status === 'Taken' || o.status === 'Completed').length
  const skipped = thisMonthOffers.filter(o => o.status === 'Skipped').length

  // Per-bookie stats
  const bookieStats = bookies
    .filter(b => !b.archived)
    .map(b => {
      const bOffers = thisMonthOffers.filter(o => o.bookie_id === b.id)
      const profit = bOffers.reduce((s, o) => s + (o.actual_profit != null && o.actual_profit !== '' ? Number(o.actual_profit) : 0), 0)
      return { name: b.name, profit: Math.round(profit * 100) / 100, count: bOffers.length }
    })
    .filter(b => b.count > 0)
    .sort((a, b) => b.profit - a.profit)

  const getBookieName = (id) => bookies.find(b => b.id === id)?.name || id

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-title">Offer Tracker</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{format(now, 'MMMM yyyy')}</p>
        </div>
        <button onClick={() => { setEditOffer(null); setShowModal(true) }} className="btn-secondary text-sm flex items-center gap-1">
          <Plus size={15} /> Log Offer
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Available', val: thisMonthOffers.length },
          { label: 'Taken', val: taken, color: 'text-amber-600' },
          { label: 'Skipped', val: skipped, color: 'text-gray-500' },
          { label: 'Profit', val: `£${totalActual.toFixed(2)}`, color: 'text-emerald-600' },
        ].map(({ label, val, color }) => (
          <div key={label} className="card p-3 text-center">
            <p className={`text-lg font-bold ${color || 'text-navy-700 dark:text-white'}`}>{val}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      {/* View toggle */}
      <div className="flex gap-2">
        <button onClick={() => setView('list')} className={`text-sm font-semibold px-3 py-1.5 rounded-lg transition-all ${view === 'list' ? 'bg-navy-700 text-white' : 'bg-gray-100 dark:bg-navy-600 text-gray-600 dark:text-gray-300'}`}>List</button>
        <button onClick={() => setView('stats')} className={`text-sm font-semibold px-3 py-1.5 rounded-lg transition-all ${view === 'stats' ? 'bg-navy-700 text-white' : 'bg-gray-100 dark:bg-navy-600 text-gray-600 dark:text-gray-300'}`}>Stats</button>
      </div>

      {view === 'list' && (
        <>
          {/* Filter */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {['all', ...STATUSES].map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap flex-shrink-0 transition-all ${
                  filterStatus === s ? 'bg-navy-700 text-white' : 'bg-gray-100 dark:bg-navy-600 text-gray-600 dark:text-gray-300'
                }`}
              >
                {s === 'all' ? 'All' : s}
              </button>
            ))}
          </div>

          {/* Offer list */}
          <div className="space-y-2">
            {shown.length === 0 ? (
              <div className="card p-8 text-center">
                <p className="text-gray-400">No offers logged this month</p>
                <button onClick={() => setShowModal(true)} className="btn-primary mt-3 text-sm">Log your first offer</button>
              </div>
            ) : (
              shown.sort((a, b) => b.date.localeCompare(a.date)).map(offer => (
                <div key={offer.id} className="card p-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm text-gray-900 dark:text-white">{getBookieName(offer.bookie_id)}</span>
                      <StatusBadge status={offer.status} />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{offer.offer_type} · {offer.date}</p>
                    <div className="flex gap-3 mt-1 text-xs">
                      {offer.expected_profit && <span className="text-gray-500">Exp: £{offer.expected_profit}</span>}
                      {offer.actual_profit !== '' && offer.actual_profit != null && (
                        <span className={Number(offer.actual_profit) >= 0 ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
                          Act: £{offer.actual_profit}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => { setEditOffer(offer); setShowModal(true) }} className="text-xs text-gold-500 font-semibold py-1 px-2">Edit</button>
                    <button onClick={() => deleteOffer(offer.id)} className="text-xs text-red-400 py-1 px-2">✕</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {view === 'stats' && bookieStats.length > 0 && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="font-semibold text-sm text-gray-700 dark:text-white mb-3">Profit by Bookie</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={bookieStats}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => [`£${v}`, 'Profit']} />
                <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                  {bookieStats.map((entry, i) => (
                    <Cell key={i} fill={entry.profit >= 0 ? '#C9A96E' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            {bookieStats.map(b => (
              <div key={b.name} className="card p-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm text-gray-900 dark:text-white">{b.name}</p>
                  <p className="text-xs text-gray-500">{b.count} offer{b.count !== 1 ? 's' : ''}</p>
                </div>
                <span className={`font-bold ${b.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  £{b.profit.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showModal && (
        <OfferModal
          offer={editOffer}
          bookies={bookies}
          onSave={saveOffer}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
