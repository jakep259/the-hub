import { useState, useEffect, useContext } from 'react'
import {
  ChevronDown, ChevronUp, Plus, AlertCircle, CheckCircle, XCircle,
  Archive, Edit3, Save, X, Lightbulb
} from 'lucide-react'
import { getList, saveList, updateItem, deleteItem, addItem, genId } from '../../lib/store'
import { SyncContext } from '../../App'
import { calculateHealthScore, healthBadgeClass, healthColor, getMugBetRecommendation, offerSafetyRating } from '../../lib/healthScore'
import { differenceInDays, format } from 'date-fns'

const STATUS_OPTS = ['Active', 'Restricted', 'Gubbed']

function HealthBar({ score }) {
  const color = score >= 75 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 dark:bg-navy-600 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-bold w-8 text-right ${
        score >= 75 ? 'text-emerald-600' : score >= 50 ? 'text-amber-600' : 'text-red-600'
      }`}>{score}</span>
    </div>
  )
}

function StatusIcon({ status }) {
  if (status === 'Active') return <CheckCircle size={14} className="text-emerald-500" />
  if (status === 'Restricted') return <AlertCircle size={14} className="text-amber-500" />
  return <XCircle size={14} className="text-red-500" />
}

function BookieCard({ bookie, bets, offers, onUpdate, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ ...bookie })

  const score = calculateHealthScore(bookie, bets, offers)
  const rec = getMugBetRecommendation(bookie, bets, offers)
  const safetyRating = offerSafetyRating(bookie, bets, offers)

  const mugBets = bets.filter(b => b.bet_type === 'mug')
  const lastMug = mugBets.length
    ? new Date(Math.max(...mugBets.map(b => new Date(b.placed_at))))
    : null
  const daysSinceMug = lastMug ? differenceInDays(new Date(), lastMug) : null

  function save() {
    onUpdate(bookie.id, form)
    setEditing(false)
  }

  const badgeClass = healthBadgeClass(score)

  return (
    <div className={`card overflow-hidden ${score < 60 ? 'ring-1 ring-amber-300 dark:ring-amber-600' : ''}`}>
      {/* Card header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 dark:hover:bg-navy-600 transition-colors"
      >
        {/* Colour indicator */}
        <div className="w-3 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: bookie.color }} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-sm text-gray-900 dark:text-white truncate">{bookie.name}</span>
            <StatusIcon status={bookie.status} />
            {score < 60 && (
              <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">!</span>
            )}
          </div>
          <HealthBar score={score} />
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${badgeClass}`}>
            {score >= 75 ? 'Healthy' : score >= 50 ? 'Caution' : 'At Risk'}
          </span>
          {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-100 dark:border-navy-600 p-4 space-y-4">
          {editing ? (
            <EditForm form={form} setForm={setForm} onSave={save} onCancel={() => setEditing(false)} />
          ) : (
            <>
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-2 bg-gray-50 dark:bg-navy-800 rounded-xl">
                  <p className="text-lg font-bold text-navy-700 dark:text-white">
                    {daysSinceMug !== null ? daysSinceMug : '—'}
                  </p>
                  <p className="text-xs text-gray-500">Days since mug</p>
                </div>
                <div className="text-center p-2 bg-gray-50 dark:bg-navy-800 rounded-xl">
                  <p className="text-lg font-bold text-navy-700 dark:text-white">
                    {bookie.status}
                  </p>
                  <p className="text-xs text-gray-500">Status</p>
                </div>
                <div className="text-center p-2 bg-gray-50 dark:bg-navy-800 rounded-xl">
                  <p className={`text-lg font-bold ${
                    safetyRating.color === 'emerald' ? 'text-emerald-600' :
                    safetyRating.color === 'amber' ? 'text-amber-600' : 'text-red-600'
                  }`}>{safetyRating.rating}</p>
                  <p className="text-xs text-gray-500">Offer safety</p>
                </div>
              </div>

              {/* Mug bet recommendation */}
              {rec.urgency !== 'normal' && (
                <div className={`flex items-start gap-2 p-3 rounded-xl ${
                  rec.urgency === 'urgent'
                    ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700'
                    : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700'
                }`}>
                  <Lightbulb size={16} className={rec.urgency === 'urgent' ? 'text-red-500' : 'text-amber-500'} />
                  <div className="text-xs space-y-0.5">
                    <p className="font-semibold text-gray-800 dark:text-gray-200">
                      Mug bet {rec.urgency === 'urgent' ? 'URGENT — today' : 'needed this week'}
                    </p>
                    <p className="text-gray-600 dark:text-gray-400">
                      Stake {rec.stakeRange} · {rec.sport} · Odds {rec.oddsRange}
                    </p>
                    <p className="text-gray-500 dark:text-gray-500">{rec.withdrawalTip}</p>
                  </div>
                </div>
              )}

              {/* Notes */}
              {bookie.notes && (
                <div>
                  <p className="label">Notes</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{bookie.notes}</p>
                </div>
              )}

              {/* Bet log */}
              <BetLog bookieId={bookie.id} bets={bets} />

              {/* Actions */}
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setEditing(true)} className="btn-ghost text-xs py-2 flex items-center gap-1">
                  <Edit3 size={13} /> Edit
                </button>
                <button
                  onClick={() => {
                    const newBet = {
                      id: genId(),
                      bookie_id: bookie.id,
                      bet_type: 'mug',
                      stake: 5,
                      placed_at: new Date().toISOString(),
                    }
                    const current = getList('bets') || []
                    saveList('bets', [...current, newBet])
                    onUpdate(bookie.id, {})
                  }}
                  className="btn-primary text-xs py-2 flex items-center gap-1"
                >
                  ✓ Log mug bet
                </button>
                {bookie.status !== 'Gubbed' && (
                  <button
                    onClick={() => onUpdate(bookie.id, { archived: true, status: 'Gubbed' })}
                    className="btn-ghost text-xs py-2 flex items-center gap-1 text-red-500"
                  >
                    <Archive size={13} /> Archive
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function EditForm({ form, setForm, onSave, onCancel }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="label">Name</label>
        <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
      </div>
      <div>
        <label className="label">Status</label>
        <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
          {STATUS_OPTS.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Colour</label>
        <input type="color" className="h-10 w-full rounded-xl border border-gray-200 cursor-pointer" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} />
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea className="input" rows={3} value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} />
      </div>
      <div className="flex gap-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={form.same_day_withdrawal || false} onChange={e => setForm({ ...form, same_day_withdrawal: e.target.checked })} />
          Same-day withdrawal risk
        </label>
      </div>
      <div className="flex gap-2">
        <button onClick={onSave} className="btn-primary text-sm flex items-center gap-1"><Save size={14} /> Save</button>
        <button onClick={onCancel} className="btn-ghost text-sm flex items-center gap-1"><X size={14} /> Cancel</button>
      </div>
    </div>
  )
}

function BetLog({ bookieId, bets }) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ bet_type: 'mug', stake: '', odds: '', sport: 'Football', notes: '' })

  const bookieBets = bets.slice(-5).reverse()

  function logBet() {
    if (!form.stake) return
    const newBet = {
      id: genId(),
      bookie_id: bookieId,
      bet_type: form.bet_type,
      stake: Number(form.stake),
      odds: form.odds,
      sport: form.sport,
      notes: form.notes,
      placed_at: new Date().toISOString(),
    }
    const current = getList('bets') || []
    saveList('bets', [...current, newBet])
    setAdding(false)
    setForm({ bet_type: 'mug', stake: '', odds: '', sport: 'Football', notes: '' })
    window.location.reload()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="label mb-0">Recent Bets</p>
        <button onClick={() => setAdding(!adding)} className="text-xs text-gold-500 font-semibold">+ Log bet</button>
      </div>
      {adding && (
        <div className="bg-gray-50 dark:bg-navy-800 rounded-xl p-3 mb-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Type</label>
              <select className="input text-xs" value={form.bet_type} onChange={e => setForm({ ...form, bet_type: e.target.value })}>
                <option value="mug">Mug Bet</option>
                <option value="offer">Offer Bet</option>
                <option value="recreational">Recreational</option>
              </select>
            </div>
            <div>
              <label className="label">Stake (£)</label>
              <input className="input text-xs" type="number" placeholder="5.00" value={form.stake} onChange={e => setForm({ ...form, stake: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Odds</label>
              <input className="input text-xs" placeholder="2.0" value={form.odds} onChange={e => setForm({ ...form, odds: e.target.value })} />
            </div>
            <div>
              <label className="label">Sport</label>
              <select className="input text-xs" value={form.sport} onChange={e => setForm({ ...form, sport: e.target.value })}>
                <option>Football</option>
                <option>Horse Racing</option>
                <option>Tennis</option>
                <option>Other</option>
              </select>
            </div>
          </div>
          <button onClick={logBet} className="btn-primary text-xs w-full py-2">Log Bet</button>
        </div>
      )}
      {bookieBets.length > 0 ? (
        <div className="space-y-1">
          {bookieBets.map(b => (
            <div key={b.id} className="flex items-center justify-between text-xs py-1 border-b border-gray-100 dark:border-navy-600">
              <span className="text-gray-600 dark:text-gray-400 capitalize">{b.bet_type}</span>
              <span className="font-semibold">£{b.stake}</span>
              <span className="text-gray-500">{b.sport}</span>
              <span className="text-gray-400">{format(new Date(b.placed_at), 'dd/MM')}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400 italic">No bets logged yet</p>
      )}
    </div>
  )
}

function AddBookieModal({ onClose, onAdd }) {
  const [form, setForm] = useState({ name: '', color: '#0D1F35', status: 'Active', notes: '' })
  function submit() {
    if (!form.name.trim()) return
    onAdd({
      id: genId(),
      ...form,
      health: 75,
      same_day_withdrawal: false,
      stake_only_on_offer_days: false,
      created_at: new Date().toISOString(),
    })
    onClose()
  }
  return (
    <div className="fixed inset-0 z-[60] flex items-end lg:items-center justify-center pb-20 lg:pb-0 bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-navy-700 rounded-t-2xl lg:rounded-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-lg text-navy-700 dark:text-white">Add Bookie</h3>
        <div>
          <label className="label">Name</label>
          <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
            {STATUS_OPTS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Brand Colour</label>
          <input type="color" className="h-10 w-full rounded-xl border border-gray-200 cursor-pointer" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} />
        </div>
        <div className="flex gap-2">
          <button onClick={submit} className="btn-primary flex-1">Add Bookie</button>
          <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function BookieTracker() {
  const syncVersion = useContext(SyncContext)
  const [bookies, setBookies] = useState([])
  const [bets, setBets] = useState([])
  const [offers, setOffers] = useState([])
  const [showArchived, setShowArchived] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [filter, setFilter] = useState('active')

  function load() {
    setBookies(getList('bookies') || [])
    setBets(getList('bets') || [])
    setOffers(getList('offers') || [])
  }

  useEffect(() => { load() }, [syncVersion])

  function handleUpdate(id, updates) {
    const next = (getList('bookies') || []).map(b => b.id === id ? { ...b, ...updates } : b)
    saveList('bookies', next)
    setBookies(next)
  }

  function handleDelete(id) {
    if (!confirm('Remove this bookie?')) return
    const next = (getList('bookies') || []).filter(b => b.id !== id)
    saveList('bookies', next)
    setBookies(next)
  }

  function handleAdd(bookie) {
    const next = [...(getList('bookies') || []), bookie]
    saveList('bookies', next)
    setBookies(next)
  }

  const active = bookies.filter(b => !b.archived && b.status !== 'Gubbed')
  const archived = bookies.filter(b => b.archived || b.status === 'Gubbed')

  // Alert bookies
  const alerts = active.filter(b => {
    const score = calculateHealthScore(b, bets.filter(bt => bt.bookie_id === b.id), offers.filter(o => o.bookie_id === b.id))
    return score < 60
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-title">Bookie Health</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {active.length} active · {alerts.length} need attention
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-secondary text-sm flex items-center gap-1">
          <Plus size={15} /> Add
        </button>
      </div>

      {/* Alert banner */}
      {alerts.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl p-3 flex items-center gap-2">
          <AlertCircle size={16} className="text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-400">
            <strong>{alerts.map(b => b.name).join(', ')}</strong> — health below 60, mug bets needed
          </p>
        </div>
      )}

      {/* Active bookies */}
      <div className="space-y-2">
        {active.map(b => (
          <BookieCard
            key={b.id}
            bookie={b}
            bets={bets.filter(bt => bt.bookie_id === b.id)}
            offers={offers.filter(o => o.bookie_id === b.id)}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {/* Archived */}
      {archived.length > 0 && (
        <div>
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 py-2"
          >
            <Archive size={14} />
            {showArchived ? 'Hide' : 'Show'} archived / gubbed ({archived.length})
            {showArchived ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showArchived && (
            <div className="space-y-2 opacity-60">
              {archived.map(b => (
                <BookieCard
                  key={b.id}
                  bookie={b}
                  bets={bets.filter(bt => bt.bookie_id === b.id)}
                  offers={offers.filter(o => o.bookie_id === b.id)}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {showAdd && <AddBookieModal onClose={() => setShowAdd(false)} onAdd={handleAdd} />}
    </div>
  )
}
