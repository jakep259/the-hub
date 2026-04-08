/**
 * Bet Tracker — log open bets from any calculator, then settle with:
 *   • Guaranteed Profit  (fully matched — neither side lost)
 *   • Exchange Won       (lay won, bookie lost)
 *   • Bookie Won         (back won, lay lost)
 * Profit is auto-calculated from stored calculator outputs.
 */
import { useState, useEffect, useContext } from 'react'
import { Plus, X, CheckCircle, Clock, ChevronDown, ChevronUp, Edit3 } from 'lucide-react'
import { getList, saveList, genId } from '../../lib/store'
import { format } from 'date-fns'
import { DarkModeContext, SyncContext } from '../../App'

const BET_TYPES = ['Back/Lay', 'Each-Way', 'Free Bet SNR', 'Free Bet SR', 'Underlay', 'Overlay', 'ACCA', 'Dutch', 'Arb', 'Other']
const BOOKIES_KEY = 'bookies'

function OutcomeButton({ label, sub, color, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 rounded-xl py-2.5 px-2 text-center transition-all border-2"
      style={{
        borderColor: selected ? color : 'rgba(0,0,0,0.08)',
        background: selected ? `${color}18` : 'transparent',
      }}
    >
      <p className="text-xs font-bold" style={{ color: selected ? color : '#9ca3af' }}>{label}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: selected ? color : '#d1d5db' }}>{sub}</p>}
    </button>
  )
}

function AddBetModal({ onSave, onClose, prefill }) {
  const { darkMode } = useContext(DarkModeContext)
  const bookies = getList(BOOKIES_KEY) || []
  const [f, setF] = useState(prefill || {
    id: genId(),
    bookie_id: '',
    bet_type: 'Back/Lay',
    description: '',
    back_stake: '',
    back_odds: '',
    lay_stake: '',
    lay_odds: '',
    commission: '5',
    profit_guaranteed: '',
    profit_exchange_wins: '',
    profit_bookie_wins: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
    status: 'open',
  })

  // Auto-calculate profit fields
  function calcProfits() {
    const bs = +f.back_stake, bo = +f.back_odds, ls = +f.lay_stake, lo = +f.lay_odds, comm = +f.commission / 100
    if (!bs || !bo || !ls || !lo) return
    const profitBackWins = (bs * (bo - 1)) - (ls * (lo - 1))
    const profitLayWins = ls * (1 - comm) - bs
    const guaranteed = Math.min(profitBackWins, profitLayWins)
    setF(prev => ({
      ...prev,
      profit_guaranteed: guaranteed.toFixed(2),
      profit_bookie_wins: profitBackWins.toFixed(2),
      profit_exchange_wins: profitLayWins.toFixed(2),
    }))
  }

  function save() {
    if (!f.description && !f.bet_type) return
    onSave(f)
    onClose()
  }

  const bg = darkMode ? '#091629' : '#f9fafb'

  return (
    <div className="fixed inset-0 z-[60] flex items-end lg:items-center justify-center pb-20 lg:pb-0 bg-black/60" onClick={onClose}>
      <div
        className="rounded-t-2xl lg:rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col"
        style={{ background: darkMode ? '#0D1F35' : '#fff' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 flex-shrink-0" style={{ background: darkMode ? '#0D1F35' : '#fff', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <h3 className="font-bold text-base" style={{ color: darkMode ? '#f9fafb' : '#0D1F35' }}>Log Bet</h3>
          <button onClick={onClose}><X size={20} style={{ color: '#9ca3af' }} /></button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          {/* Bookie + type */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Bookie</label>
              <select className="input" value={f.bookie_id} onChange={e => setF({...f, bookie_id: e.target.value})}>
                <option value="">Select...</option>
                {bookies.filter(b => !b.archived).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Bet type</label>
              <select className="input" value={f.bet_type} onChange={e => setF({...f, bet_type: e.target.value})}>
                {BET_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="label">Description</label>
            <input className="input" placeholder="e.g. Man City vs Arsenal — Back City" value={f.description} onChange={e => setF({...f, description: e.target.value})} />
          </div>

          {/* Stakes & odds */}
          <div className="rounded-xl p-3 space-y-2" style={{ background: bg }}>
            <p className="text-xs font-semibold" style={{ color: '#9ca3af' }}>Stakes & Odds</p>
            <div className="grid grid-cols-2 gap-2">
              <NumField label="Back Stake (£)" val={f.back_stake} set={v => setF({...f, back_stake: v})} />
              <NumField label="Back Odds" val={f.back_odds} set={v => setF({...f, back_odds: v})} />
              <NumField label="Lay Stake (£)" val={f.lay_stake} set={v => setF({...f, lay_stake: v})} />
              <NumField label="Lay Odds" val={f.lay_odds} set={v => setF({...f, lay_odds: v})} />
              <NumField label="Commission (%)" val={f.commission} set={v => setF({...f, commission: v})} />
            </div>
            <button onClick={calcProfits} className="btn-ghost w-full text-xs py-1.5 mt-1">
              ⟳ Auto-calculate profits
            </button>
          </div>

          {/* Profit fields */}
          <div className="rounded-xl p-3 space-y-2" style={{ background: bg }}>
            <p className="text-xs font-semibold" style={{ color: '#9ca3af' }}>Expected Outcomes</p>
            <div className="grid grid-cols-3 gap-2">
              <NumField label="Guaranteed £" val={f.profit_guaranteed} set={v => setF({...f, profit_guaranteed: v})} />
              <NumField label="Exch wins £" val={f.profit_exchange_wins} set={v => setF({...f, profit_exchange_wins: v})} />
              <NumField label="Bookie wins £" val={f.profit_bookie_wins} set={v => setF({...f, profit_bookie_wins: v})} />
            </div>
          </div>

          <div>
            <label className="label">Date</label>
            <input className="input" type="date" value={f.date} onChange={e => setF({...f, date: e.target.value})} />
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={f.notes} onChange={e => setF({...f, notes: e.target.value})} placeholder="Optional..." />
          </div>
        </div>

        <div className="p-4 flex gap-2 flex-shrink-0" style={{ borderTop: '1px solid rgba(0,0,0,0.06)', background: darkMode ? '#0D1F35' : '#fff' }}>
          <button onClick={save} className="btn-primary flex-1">Log Bet</button>
          <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
        </div>
      </div>
    </div>
  )
}

function SettleModal({ bet, onSettle, onClose }) {
  const { darkMode } = useContext(DarkModeContext)
  const [outcome, setOutcome] = useState(null)
  const [customProfit, setCustomProfit] = useState('')

  const outcomes = [
    {
      key: 'guaranteed',
      label: 'Guaranteed Profit',
      sub: bet.profit_guaranteed ? `£${Number(bet.profit_guaranteed).toFixed(2)}` : 'Enter amount',
      color: '#10b981',
      profit: bet.profit_guaranteed,
    },
    {
      key: 'exchange_wins',
      label: 'Exchange Won',
      sub: bet.profit_exchange_wins ? `£${Number(bet.profit_exchange_wins).toFixed(2)}` : 'Enter amount',
      color: '#3b82f6',
      profit: bet.profit_exchange_wins,
    },
    {
      key: 'bookie_wins',
      label: 'Bookie Won',
      sub: bet.profit_bookie_wins ? `£${Number(bet.profit_bookie_wins).toFixed(2)}` : 'Enter amount',
      color: '#C9A96E',
      profit: bet.profit_bookie_wins,
    },
  ]

  const selectedOutcome = outcomes.find(o => o.key === outcome)
  const profit = customProfit || selectedOutcome?.profit || ''

  function settle() {
    if (!outcome) return
    onSettle(bet.id, outcome, Number(profit))
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end lg:items-center justify-center pb-20 lg:pb-0 bg-black/60" onClick={onClose}>
      <div
        className="rounded-t-2xl lg:rounded-2xl w-full max-w-md p-5 space-y-4"
        style={{ background: darkMode ? '#0D1F35' : '#fff' }}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="font-bold text-base" style={{ color: darkMode ? '#f9fafb' : '#0D1F35' }}>
          Settle Bet
        </h3>
        <p className="text-sm" style={{ color: '#9ca3af' }}>{bet.description || bet.bet_type}</p>

        <div>
          <p className="label mb-2">What happened?</p>
          <div className="flex gap-2">
            {outcomes.map(o => (
              <OutcomeButton
                key={o.key}
                label={o.label}
                sub={o.sub}
                color={o.color}
                selected={outcome === o.key}
                onClick={() => {
                  setOutcome(o.key)
                  setCustomProfit('')
                }}
              />
            ))}
          </div>
        </div>

        {outcome && (
          <div>
            <label className="label">Actual profit (£)</label>
            <input
              className="input"
              type="number"
              value={customProfit || selectedOutcome?.profit || ''}
              onChange={e => setCustomProfit(e.target.value)}
              placeholder="Override if needed"
            />
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={settle} disabled={!outcome} className="btn-primary flex-1" style={!outcome ? { opacity: 0.5 } : {}}>
            Confirm Settlement
          </button>
          <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
        </div>
      </div>
    </div>
  )
}

function BetRow({ bet, bookies, onSettle, onDelete }) {
  const { darkMode } = useContext(DarkModeContext)
  const [expanded, setExpanded] = useState(false)
  const bookie = bookies.find(b => b.id === bet.bookie_id)
  const isOpen = bet.status === 'open'

  const outcomeColor = {
    guaranteed: '#10b981',
    exchange_wins: '#3b82f6',
    bookie_wins: '#C9A96E',
  }[bet.settled_outcome] || '#9ca3af'

  const outcomeLabel = {
    guaranteed: 'Guaranteed',
    exchange_wins: 'Exch won',
    bookie_wins: 'Bookie won',
  }[bet.settled_outcome]

  return (
    <div className="card overflow-hidden">
      <button
        className="w-full flex items-center gap-3 p-3.5 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Status dot */}
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ background: isOpen ? '#f59e0b' : (Number(bet.actual_profit) >= 0 ? '#10b981' : '#ef4444') }}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold truncate" style={{ color: darkMode ? '#f9fafb' : '#0D1F35' }}>
              {bet.description || bet.bet_type}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs" style={{ color: '#9ca3af' }}>
            {bookie && <span style={{ color: bookie.color }}>{bookie.name}</span>}
            <span>{bet.bet_type}</span>
            <span>{bet.date}</span>
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          {isOpen ? (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
              Open
            </span>
          ) : (
            <div>
              <span className="text-sm font-bold" style={{ color: Number(bet.actual_profit) >= 0 ? '#10b981' : '#ef4444' }}>
                {Number(bet.actual_profit) >= 0 ? '+' : ''}£{Number(bet.actual_profit).toFixed(2)}
              </span>
              {outcomeLabel && (
                <p className="text-xs" style={{ color: outcomeColor }}>{outcomeLabel}</p>
              )}
            </div>
          )}
        </div>

        {expanded ? <ChevronUp size={14} style={{ color: '#9ca3af' }} /> : <ChevronDown size={14} style={{ color: '#9ca3af' }} />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3" style={{ borderTop: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : '#f3f4f6'}` }}>
          {/* Outcome grid */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            <InfoBox label="Guaranteed" value={bet.profit_guaranteed ? `£${Number(bet.profit_guaranteed).toFixed(2)}` : '—'} color="#10b981" />
            <InfoBox label="Exch wins" value={bet.profit_exchange_wins ? `£${Number(bet.profit_exchange_wins).toFixed(2)}` : '—'} color="#3b82f6" />
            <InfoBox label="Bookie wins" value={bet.profit_bookie_wins ? `£${Number(bet.profit_bookie_wins).toFixed(2)}` : '—'} color="#C9A96E" />
          </div>

          {/* Stakes */}
          {(bet.back_stake || bet.lay_stake) && (
            <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: '#9ca3af' }}>
              {bet.back_stake && <span>Back: £{bet.back_stake} @ {bet.back_odds}</span>}
              {bet.lay_stake && <span>Lay: £{bet.lay_stake} @ {bet.lay_odds}</span>}
            </div>
          )}

          {bet.notes && <p className="text-xs" style={{ color: '#9ca3af' }}>{bet.notes}</p>}

          {/* Actions */}
          <div className="flex gap-2">
            {isOpen && (
              <button onClick={() => onSettle(bet)} className="btn-primary text-xs py-2 flex-1">
                Settle bet
              </button>
            )}
            <button onClick={() => onDelete(bet.id)} className="btn-ghost text-xs py-2" style={{ color: '#ef4444', borderColor: '#ef4444' }}>
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoBox({ label, value, color }) {
  const { darkMode } = useContext(DarkModeContext)
  return (
    <div className="text-center rounded-xl py-2" style={{ background: darkMode ? 'rgba(255,255,255,0.04)' : '#f9fafb' }}>
      <p className="text-xs" style={{ color: '#9ca3af' }}>{label}</p>
      <p className="text-sm font-bold" style={{ color }}>{value}</p>
    </div>
  )
}

function NumField({ label, val, set }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" type="number" inputMode="decimal" placeholder="0" value={val} onChange={e => set(e.target.value)} />
    </div>
  )
}

export default function BetTracker() {
  const { darkMode } = useContext(DarkModeContext)
  const syncVersion = useContext(SyncContext)
  const [bets, setBets] = useState([])
  const [bookies, setBookies] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [prefillBet, setPrefillBet] = useState(null)
  const [settleBet, setSettleBet] = useState(null)
  const [filter, setFilter] = useState('open') // open | settled | all

  function load() {
    setBets(getList('open_bets') || [])
    setBookies(getList('bookies') || [])
  }
  useEffect(() => { load() }, [syncVersion])
  useEffect(() => {
    const pending = localStorage.getItem('hub_pending_bet')
    if (pending) {
      try {
        setPrefillBet(JSON.parse(pending))
        setShowAdd(true)
        localStorage.removeItem('hub_pending_bet')
      } catch {}
    }
  }, [])

  function saveBet(bet) {
    const existing = getList('open_bets') || []
    const idx = existing.findIndex(b => b.id === bet.id)
    const next = idx >= 0 ? existing.map(b => b.id === bet.id ? bet : b) : [...existing, bet]
    saveList('open_bets', next)
    setBets(next)
  }

  async function settle(id, outcome, profit) {
    const existing = getList('open_bets') || []
    const next = existing.map(b => b.id === id
      ? { ...b, status: 'settled', settled_outcome: outcome, actual_profit: profit }
      : b)
    saveList('open_bets', next)
    setBets(next)
    // Push immediately so the 5s pull doesn't revert the settled state
    try {
      const { supabase } = await import('../../lib/supabase')
      if (supabase) await supabase.from('open_bets').upsert(next, { onConflict: 'id' })
    } catch {}

    // Also log to offers using settlement date (today), not bet placement date
    if (profit != null) {
      const bet = next.find(b => b.id === id)
      const today = format(new Date(), 'yyyy-MM-dd')
      const existingOffers = getList('offers') || []
      const existingEntry = existingOffers.find(o => o.bet_id === id)
      if (!existingEntry) {
        // Create new offer entry
        const offerEntry = {
          id: genId(),
          bet_id: id,
          bookie_id: bet?.bookie_id || '',
          offer_type: bet?.bet_type || 'Back/Lay',
          status: 'Completed',
          actual_profit: profit,
          expected_profit: bet?.profit_guaranteed || null,
          date: today,
          notes: `Settled from Bet Tracker: ${outcomeLabels[outcome] || outcome}`,
        }
        saveList('offers', [...existingOffers, offerEntry])
      } else if (existingEntry.date !== today) {
        // Entry exists but has wrong date (bet placement date) — fix to settlement date
        saveList('offers', existingOffers.map(o => o.bet_id === id ? { ...o, date: today, actual_profit: profit } : o))
      }
    }
  }

  const outcomeLabels = { guaranteed: 'Guaranteed', exchange_wins: 'Exchange Won', bookie_wins: 'Bookie Won' }

  async function deleteBet(id) {
    const next = (getList('open_bets') || []).filter(b => b.id !== id)
    saveList('open_bets', next)
    setBets(next)
    // Delete from Supabase so it doesn't return on the next pull
    try {
      const { supabase } = await import('../../lib/supabase')
      if (supabase) await supabase.from('open_bets').delete().eq('id', id)
    } catch {}
  }

  const filtered = bets.filter(b =>
    filter === 'all' ? true :
    filter === 'open' ? b.status === 'open' :
    b.status === 'settled'
  )

  const openCount = bets.filter(b => b.status === 'open').length
  const totalProfit = bets.filter(b => b.status === 'settled').reduce((s, b) => s + (Number(b.actual_profit) || 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-title">Bet Tracker</h2>
          <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
            {openCount} open · Total settled: <span style={{ color: totalProfit >= 0 ? '#10b981' : '#ef4444' }}>£{totalProfit.toFixed(2)}</span>
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-secondary text-sm flex items-center gap-1">
          <Plus size={15} /> Log Bet
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {['open', 'settled', 'all'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="text-sm font-semibold px-3 py-1.5 rounded-lg capitalize transition-all"
            style={{
              background: filter === f ? '#0D1F35' : (darkMode ? 'rgba(255,255,255,0.06)' : '#f3f4f6'),
              color: filter === f ? '#fff' : '#9ca3af',
            }}
          >
            {f} {f === 'open' && openCount > 0 ? `(${openCount})` : ''}
          </button>
        ))}
      </div>

      {/* Bet list */}
      {filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm" style={{ color: '#9ca3af' }}>
            {filter === 'open' ? 'No open bets — log one from any calculator' : 'No settled bets yet'}
          </p>
          {filter === 'open' && (
            <button onClick={() => setShowAdd(true)} className="btn-primary mt-3 text-sm">Log your first bet</button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.sort((a, b) => b.date?.localeCompare(a.date)).map(bet => (
            <BetRow
              key={bet.id}
              bet={bet}
              bookies={bookies}
              onSettle={setSettleBet}
              onDelete={deleteBet}
            />
          ))}
        </div>
      )}

      {showAdd && <AddBetModal onSave={saveBet} onClose={() => { setShowAdd(false); setPrefillBet(null) }} prefill={prefillBet} />}
      {settleBet && <SettleModal bet={settleBet} onSettle={settle} onClose={() => setSettleBet(null)} />}
    </div>
  )
}
