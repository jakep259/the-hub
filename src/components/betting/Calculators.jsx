import { useState } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { ChevronLeft, History, X, BookmarkPlus } from 'lucide-react'
import { getSettings, getList, saveList, genId } from '../../lib/store'

// ─── Shared helpers ────────────────────────────────────────────────────────────
function calcLayStake(backStake, backOdds, layOdds, commission) {
  return (backStake * backOdds) / (layOdds - commission / 100)
}
function calcLayLiability(layStake, layOdds) {
  return layStake * (layOdds - 1)
}
function roundTo(v, dp = 2) {
  return Math.round(v * 10 ** dp) / 10 ** dp
}

// ─── History log ──────────────────────────────────────────────────────────────
function addToHistory(calcName, inputs, outputs) {
  const key = `calc_history_${calcName}`
  const history = getList(key) || []
  const entry = { id: genId(), ts: Date.now(), inputs, outputs }
  saveList(key, [entry, ...history].slice(0, 10))
}

function HistoryPanel({ calcName, onClose }) {
  const history = getList(`calc_history_${calcName}`) || []
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-end lg:items-center justify-center pb-20 lg:pb-0" onClick={onClose}>
      <div className="bg-white dark:bg-navy-700 rounded-t-2xl lg:rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-navy-600">
          <h3 className="font-bold text-navy-700 dark:text-white">History (last 10)</h3>
          <button onClick={onClose}><X size={20} className="text-gray-500" /></button>
        </div>
        {history.length === 0 ? (
          <p className="text-gray-500 text-sm p-4 text-center">No history yet</p>
        ) : (
          <div className="p-4 space-y-3">
            {history.map(h => (
              <div key={h.id} className="bg-gray-50 dark:bg-navy-800 rounded-xl p-3 text-xs space-y-1">
                <p className="text-gray-400">{new Date(h.ts).toLocaleString()}</p>
                <div className="grid grid-cols-2 gap-1">
                  {Object.entries(h.outputs).map(([k, v]) => (
                    <div key={k}>
                      <span className="text-gray-500">{k}: </span>
                      <span className="font-semibold text-navy-700 dark:text-white">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Result display ────────────────────────────────────────────────────────────
function ResultRow({ label, value }) {
  const str = String(value ?? '')
  const lbl = label.toLowerCase()
  const isProfitLabel = lbl.includes('profit') || lbl.includes('p&l') || lbl.includes('guaranteed') || lbl.includes('wins') || lbl.includes('extraction') || lbl.includes('ev') || lbl.includes('locked')
  const num = parseFloat(str.replace('£', '').replace('%', '').trim())
  const colored = isProfitLabel && !isNaN(num) && num !== 0
  const colorStyle = colored ? { color: num > 0 ? '#10b981' : '#ef4444' } : undefined
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-navy-600 last:border-0">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-sm font-semibold text-navy-700 dark:text-gray-100" style={colorStyle}>{value}</span>
    </div>
  )
}

function AdjRow({ label, value }) {
  const str = String(value ?? '')
  const lbl = label.toLowerCase()
  const isProfitLabel = lbl.includes('wins') || lbl.includes('profit') || lbl.includes('p&l')
  const num = parseFloat(str.replace('£', '').trim())
  const colored = isProfitLabel && !isNaN(num) && num !== 0
  const colorStyle = colored ? { color: num > 0 ? '#10b981' : '#ef4444' } : undefined
  return (
    <div className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-navy-600 last:border-0">
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-xs font-bold text-navy-700 dark:text-gray-100" style={colorStyle}>{value}</span>
    </div>
  )
}

function CalcWrapper({ name, children, onCalc, results, meta }) {
  const [showHistory, setShowHistory] = useState(false)
  const [adjMode, setAdjMode] = useState('normal')
  const [adjPct, setAdjPct] = useState(90)
  const navigate = useNavigate()

  function setMode(mode) {
    setAdjMode(mode)
    if (meta && mode === 'underlay') {
      // Auto-predict: find where "if exchange wins = £0" → adjLs*(1-comm/100) = backStake
      // At 0% commission this gives adjLs = backStake (lay same as back — most common underlay)
      const adjLs = meta.backStake / (1 - meta.commission / 100)
      const pct = adjLs / meta.layStake * 100
      setAdjPct(Math.min(100, Math.max(10, pct)))
    } else if (meta && mode === 'overlay') {
      // Auto-predict: find where "if back wins = £0" → adjLs*(layOdds-1) = backStake*(backOdds-1)
      const adjLs = meta.backStake * (meta.backOdds - 1) / (meta.layOdds - 1)
      const pct = adjLs / meta.layStake * 100
      setAdjPct(Math.min(200, Math.max(101, pct)))
    } else {
      setAdjPct(100)
    }
  }

  // Compute adjusted values when meta is available
  let adjLayStake = meta?.layStake
  let adjLiability = null, adjProfitBW = null, adjProfitLW = null
  if (meta) {
    if (adjMode !== 'normal') adjLayStake = roundTo(meta.layStake * adjPct / 100)
    adjLiability = roundTo(adjLayStake * (meta.layOdds - 1))
    adjProfitBW = roundTo(meta.backStake * (meta.backOdds - 1) - adjLayStake * (meta.layOdds - 1))
    adjProfitLW = roundTo(adjLayStake * (1 - meta.commission / 100) - meta.backStake)
  }

  function handleLogBet() {
    const ls = adjLayStake
    const profitBW = adjProfitBW
    const profitLW = adjProfitLW
    const guaranteed = profitBW !== null && profitLW !== null ? roundTo(Math.min(profitBW, profitLW)) : null
    const typeMap = { backlay: 'Back/Lay', eachway: 'Each-Way', freebetsnr: 'Free Bet SNR', freebetsr: 'Free Bet SR' }
    const betType = adjMode === 'underlay' ? 'Underlay' : adjMode === 'overlay' ? 'Overlay' : (typeMap[name] || 'Back/Lay')
    const pending = {
      id: genId(),
      bet_type: betType,
      description: '',
      back_stake: meta?.backStake?.toString() || '',
      back_odds: meta?.backOdds?.toString() || '',
      lay_stake: ls?.toString() || '',
      lay_odds: meta?.layOdds?.toString() || '',
      commission: meta?.commission?.toString() || '5',
      profit_guaranteed: guaranteed?.toFixed(2) ?? '',
      profit_bookie_wins: profitBW?.toFixed(2) ?? '',
      profit_exchange_wins: profitLW?.toFixed(2) ?? '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
      status: 'open',
      bookie_id: '',
    }
    localStorage.setItem('hub_pending_bet', JSON.stringify(pending))
    navigate('/betting/bets')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/betting/calculators')} className="flex items-center gap-1 text-gray-500 text-sm">
          <ChevronLeft size={16} /> Back
        </button>
        <button onClick={() => setShowHistory(true)} className="flex items-center gap-1 text-sm font-semibold" style={{ color: '#C9A96E' }}>
          <History size={15} /> History
        </button>
      </div>

      <div className="card p-4 space-y-3">
        {children}
        <button onClick={onCalc} className="btn-primary w-full">Calculate</button>
      </div>

      {results && (
        <div className="card p-4">
          {Object.entries(results).map(([k, v]) => (
            <ResultRow key={k} label={k} value={v} highlight={k.toLowerCase().includes('profit') || k.toLowerCase().includes('p&l') || k.toLowerCase().includes('guaranteed')} />
          ))}
        </div>
      )}

      {results && meta && (
        <div className="card p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#9ca3af' }}>Lay Adjustment</p>
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(0,0,0,0.05)' }}>
            {['normal', 'underlay', 'overlay'].map(mode => (
              <button
                key={mode}
                onClick={() => setMode(mode)}
                className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize"
                style={{
                  background: adjMode === mode ? '#C9A96E' : 'transparent',
                  color: adjMode === mode ? '#0D1F35' : '#9ca3af',
                }}
              >
                {mode}
              </button>
            ))}
          </div>
          {adjMode !== 'normal' && (
            <div className="space-y-2">
              <div>
                <input
                  type="range"
                  className="w-full accent-gold-400"
                  min={adjMode === 'underlay' ? 10 : 101}
                  max={adjMode === 'underlay' ? 100 : 200}
                  value={Math.round(adjPct)}
                  onChange={e => setAdjPct(+e.target.value)}
                />
                <div className="flex justify-between text-xs mt-0.5" style={{ color: '#9ca3af' }}>
                  <span>{adjMode === 'underlay' ? '10% (heavy)' : '101% (light)'}</span>
                  <span className="font-bold" style={{ color: '#C9A96E' }}>{Math.round(adjPct)}%</span>
                  <span>{adjMode === 'underlay' ? '100% (standard)' : '200% (heavy)'}</span>
                </div>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.03)' }}>
                <AdjRow label="Adjusted Lay Stake" value={`£${adjLayStake}`} />
                <AdjRow label="Lay Liability" value={`£${adjLiability}`} />
                <AdjRow label="If Back Wins" value={`£${adjProfitBW}`} />
                <AdjRow label="If Exchange Wins" value={`£${adjProfitLW}`} />
              </div>
            </div>
          )}
        </div>
      )}

      {results && (
        <button
          onClick={handleLogBet}
          className="btn-secondary w-full flex items-center justify-center gap-2 text-sm"
        >
          <BookmarkPlus size={15} /> Log this bet
        </button>
      )}

      {showHistory && <HistoryPanel calcName={name} onClose={() => setShowHistory(false)} />}
    </div>
  )
}

// ─── 1. Back/Lay Calculator ───────────────────────────────────────────────────
const BET_TYPE_OPTIONS = [
  { id: 'qualifying', label: 'Qualifying' },
  { id: 'snr', label: 'Free Bet SNR' },
  { id: 'sr', label: 'Free Bet SR' },
  { id: 'mbbl', label: 'Money Back' },
]

function BackLayCalc() {
  const def = getSettings()
  const [betType, setBetType] = useState('qualifying')
  const [f, setF] = useState({ backStake: '', backOdds: '', layOdds: '', commission: def.defaultCommission ?? 5 })
  const [res, setRes] = useState(null)
  const [meta, setMeta] = useState(null)

  function calc() {
    const bs = +f.backStake, bo = +f.backOdds, lo = +f.layOdds, comm = +f.commission
    if (!bs || !bo || !lo) return

    let ls, results

    if (betType === 'snr') {
      ls = roundTo((bs * (bo - 1)) / (lo - comm / 100))
      const profit = roundTo(bs * (bo - 1) - ls * (lo - 1))
      results = {
        'Lay Stake': `£${ls}`,
        'Guaranteed Profit': `£${profit}`,
        'Extraction Rate': `${roundTo((profit / bs) * 100)}%`,
      }
    } else if (betType === 'sr') {
      ls = roundTo((bs * bo) / (lo - comm / 100))
      const profitBW = roundTo(bs * (bo - 1) - ls * (lo - 1))
      const profitLW = roundTo(ls * (1 - comm / 100) - bs)
      results = {
        'Lay Stake': `£${ls}`,
        'Profit if Back Wins': `£${profitBW}`,
        'Profit if Lay Wins': `£${profitLW}`,
        'Guaranteed Profit': `£${roundTo(Math.min(profitBW, profitLW))}`,
      }
    } else if (betType === 'mbbl') {
      // Money Back if Bet Loses: back stake refunded if you lose → effective SNR formula
      ls = roundTo((bs * (bo - 1)) / (lo - comm / 100))
      const profitBW = roundTo(bs * (bo - 1) - ls * (lo - 1))
      const profitLW = roundTo(ls * (1 - comm / 100)) // stake refunded so no deduction
      results = {
        'Lay Stake': `£${ls}`,
        'If Back Wins': `£${profitBW}`,
        'If Back Loses (stake refunded)': `£${profitLW}`,
        'Guaranteed Profit': `£${roundTo(Math.min(profitBW, profitLW))}`,
      }
    } else {
      // Qualifying
      ls = roundTo(calcLayStake(bs, bo, lo, comm))
      const liability = roundTo(calcLayLiability(ls, lo))
      const profitBackWins = roundTo(bs * (bo - 1) - ls * (lo - 1))
      const profitLayWins = roundTo(ls * (1 - comm / 100) - bs)
      results = {
        'Lay Stake': `£${ls}`,
        'Lay Liability': `£${liability}`,
        'Profit if Back Wins': `£${profitBackWins}`,
        'Profit if Lay Wins': `£${profitLayWins}`,
        'Overall P&L': `£${roundTo(Math.min(profitBackWins, profitLayWins))}`,
      }
    }

    setRes(results)
    setMeta({ backStake: bs, backOdds: bo, layStake: ls, layOdds: lo, commission: comm })
    addToHistory('backlay', f, results)
  }

  return (
    <CalcWrapper name="backlay" onCalc={calc} results={res} meta={meta}>
      <h3 className="font-bold text-navy-700 dark:text-white">Back / Lay</h3>
      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl mb-1" style={{ background: 'rgba(0,0,0,0.05)' }}>
        {BET_TYPE_OPTIONS.map(t => (
          <button
            key={t.id}
            onClick={() => { setBetType(t.id); setRes(null) }}
            className="py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: betType === t.id ? '#C9A96E' : 'transparent',
              color: betType === t.id ? '#0D1F35' : '#9ca3af',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label={betType === 'qualifying' ? 'Back Stake (£)' : 'Stake / Free Bet (£)'} val={f.backStake} set={v => setF({...f, backStake: v})} />
        <Field label="Back Odds" val={f.backOdds} set={v => setF({...f, backOdds: v})} />
        <Field label="Lay Odds" val={f.layOdds} set={v => setF({...f, layOdds: v})} />
        <Field label="Commission (%)" val={f.commission} set={v => setF({...f, commission: v})} />
      </div>
    </CalcWrapper>
  )
}

// ─── 2. Each-Way Calculator ───────────────────────────────────────────────────
function EachWayCalc() {
  const def = getSettings()
  const [f, setF] = useState({ stake: '', backOdds: '', layOdds: '', placeOdds: '', placeLayOdds: '', placeTerms: '4', commission: def.defaultCommission ?? 5 })
  const [res, setRes] = useState(null)

  function calc() {
    const stake = +f.stake, bo = +f.backOdds, lo = +f.layOdds
    const po = +f.placeOdds, plo = +f.placeLayOdds
    const pt = +f.placeTerms, comm = +f.commission
    if (!stake || !bo || !lo) return

    const winLayStake = roundTo(calcLayStake(stake, bo, lo, comm))
    const placeLayStake = roundTo(calcLayStake(stake, po || (bo / pt + 1), plo || lo, comm))

    const profitWin = roundTo(stake * (bo - 1) - winLayStake * (lo - 1))
    const profitPlace = roundTo(stake * ((bo - 1) / pt) - placeLayStake * (plo || lo - 1))
    const totalProfit = roundTo(profitWin + profitPlace)

    const results = {
      'Win Lay Stake': `£${winLayStake}`,
      'Place Lay Stake': `£${placeLayStake}`,
      'Win Profit': `£${profitWin}`,
      'Place Profit': `£${profitPlace}`,
      'Total Profit (approx)': `£${totalProfit}`,
    }
    setRes(results)
    addToHistory('eachway', f, results)
  }

  return (
    <CalcWrapper name="eachway" onCalc={calc} results={res}>
      <h3 className="font-bold text-navy-700 dark:text-white">Each-Way</h3>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Stake (£)" val={f.stake} set={v => setF({...f, stake: v})} />
        <Field label="Back Odds" val={f.backOdds} set={v => setF({...f, backOdds: v})} />
        <Field label="Lay Odds" val={f.layOdds} set={v => setF({...f, layOdds: v})} />
        <Field label="Place Back Odds" val={f.placeOdds} set={v => setF({...f, placeOdds: v})} />
        <Field label="Place Lay Odds" val={f.placeLayOdds} set={v => setF({...f, placeLayOdds: v})} />
        <div>
          <label className="label">Place Terms</label>
          <select className="input" value={f.placeTerms} onChange={e => setF({...f, placeTerms: e.target.value})}>
            <option value="4">1/4</option>
            <option value="5">1/5</option>
          </select>
        </div>
        <Field label="Commission (%)" val={f.commission} set={v => setF({...f, commission: v})} />
      </div>
    </CalcWrapper>
  )
}

// ─── 3. Free Bet SNR ──────────────────────────────────────────────────────────
function FreeBetSNR() {
  const def = getSettings()
  const [f, setF] = useState({ fbAmount: '', backOdds: '', layOdds: '', commission: def.defaultCommission ?? 5 })
  const [res, setRes] = useState(null)
  const [meta, setMeta] = useState(null)

  function calc() {
    const fb = +f.fbAmount, bo = +f.backOdds, lo = +f.layOdds, comm = +f.commission
    if (!fb || !bo || !lo) return
    const ls = roundTo((fb * (bo - 1)) / (lo - comm / 100))
    const profit = roundTo(fb * (bo - 1) - ls * (lo - 1))
    const results = {
      'Lay Stake': `£${ls}`,
      'Guaranteed Profit': `£${profit}`,
      'Extraction Rate': `${roundTo((profit / fb) * 100)}%`,
    }
    setRes(results)
    setMeta({ backStake: fb, backOdds: bo, layStake: ls, layOdds: lo, commission: comm })
    addToHistory('freebetsnr', f, results)
  }

  return (
    <CalcWrapper name="freebetsnr" onCalc={calc} results={res} meta={meta}>
      <h3 className="font-bold text-navy-700 dark:text-white">Free Bet — SNR</h3>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Free Bet (£)" val={f.fbAmount} set={v => setF({...f, fbAmount: v})} />
        <Field label="Back Odds" val={f.backOdds} set={v => setF({...f, backOdds: v})} />
        <Field label="Lay Odds" val={f.layOdds} set={v => setF({...f, layOdds: v})} />
        <Field label="Commission (%)" val={f.commission} set={v => setF({...f, commission: v})} />
      </div>
    </CalcWrapper>
  )
}

// ─── 4. Free Bet SR ───────────────────────────────────────────────────────────
function FreeBetSR() {
  const def = getSettings()
  const [f, setF] = useState({ fbAmount: '', backOdds: '', layOdds: '', commission: def.defaultCommission ?? 5 })
  const [res, setRes] = useState(null)
  const [meta, setMeta] = useState(null)

  function calc() {
    const fb = +f.fbAmount, bo = +f.backOdds, lo = +f.layOdds, comm = +f.commission
    if (!fb || !bo || !lo) return
    const ls = roundTo((fb * bo) / (lo - comm / 100))
    const profitBackWins = roundTo(fb * (bo - 1) - ls * (lo - 1))
    const profitLayWins = roundTo(ls * (1 - comm / 100) - fb)
    const results = {
      'Lay Stake': `£${ls}`,
      'Profit if Back Wins': `£${profitBackWins}`,
      'Profit if Lay Wins': `£${profitLayWins}`,
      'Guaranteed Profit': `£${roundTo(Math.min(profitBackWins, profitLayWins))}`,
    }
    setRes(results)
    setMeta({ backStake: fb, backOdds: bo, layStake: ls, layOdds: lo, commission: comm })
    addToHistory('freebetsr', f, results)
  }

  return (
    <CalcWrapper name="freebetsr" onCalc={calc} results={res} meta={meta}>
      <h3 className="font-bold text-navy-700 dark:text-white">Free Bet — SR</h3>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Free Bet (£)" val={f.fbAmount} set={v => setF({...f, fbAmount: v})} />
        <Field label="Back Odds" val={f.backOdds} set={v => setF({...f, backOdds: v})} />
        <Field label="Lay Odds" val={f.layOdds} set={v => setF({...f, layOdds: v})} />
        <Field label="Commission (%)" val={f.commission} set={v => setF({...f, commission: v})} />
      </div>
    </CalcWrapper>
  )
}

// ─── 5. Bonus Bet Extractor ───────────────────────────────────────────────────
function BonusBetExtractor() {
  const [f, setF] = useState({ bonus: '', rollover: '', houseEdge: '3' })
  const [res, setRes] = useState(null)

  function calc() {
    const bonus = +f.bonus, roll = +f.rollover, edge = +f.houseEdge
    if (!bonus) return
    const required = bonus * (roll || 1)
    const ev = roundTo(bonus - required * (edge / 100))
    const results = {
      'Wagering Required': `£${roundTo(required)}`,
      'Expected Extraction': `£${ev}`,
      'Extraction Rate': `${roundTo((ev / bonus) * 100)}%`,
    }
    setRes(results)
    addToHistory('bonusextract', f, results)
  }

  return (
    <CalcWrapper name="bonusextract" onCalc={calc} results={res}>
      <h3 className="font-bold text-navy-700 dark:text-white">Bonus Bet Extractor</h3>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Bonus Amount (£)" val={f.bonus} set={v => setF({...f, bonus: v})} />
        <Field label="Rollover (x)" val={f.rollover} set={v => setF({...f, rollover: v})} placeholder="1" />
        <Field label="House Edge (%)" val={f.houseEdge} set={v => setF({...f, houseEdge: v})} />
      </div>
    </CalcWrapper>
  )
}

// ─── 6. ACCA Calculator ───────────────────────────────────────────────────────
function AccaCalc() {
  const def = getSettings()
  const [acType, setAcType] = useState('standard') // standard | lockin
  const [legs, setLegs] = useState(['', '', ''])
  const [stake, setStake] = useState('')
  const [commission, setCommission] = useState(def.defaultCommission ?? 5)
  const [finalLayOdds, setFinalLayOdds] = useState('')
  const [res, setRes] = useState(null)

  const validLegs = legs.filter(l => l && !isNaN(+l))
  const combinedOdds = validLegs.reduce((acc, l) => acc * +l, 1)

  function calc() {
    if (!stake || validLegs.length < 2) return
    const bs = +stake
    const comm = +commission

    if (acType === 'lockin') {
      // Standard lay first
      const stdLs = roundTo(calcLayStake(bs, combinedOdds, combinedOdds + 0.05, comm))
      const stdProfit = roundTo(bs * (combinedOdds - 1) - stdLs * (combinedOdds - 1 + 0.05))
      // Lock In: after N-1 legs win, lay the final leg to guarantee profit
      const flo = +finalLayOdds
      let lockResults = {}
      if (flo > 1) {
        // Green-up formula: lay stake = (back_stake * combined_odds) / (finalLayOdds - comm/100)
        const lockLs = roundTo((bs * combinedOdds) / (flo - comm / 100))
        const lockedProfit = roundTo(lockLs * (1 - comm / 100) - bs)
        lockResults = {
          'Combined Odds': roundTo(combinedOdds),
          '— Standard Lay Stake': `£${stdLs}`,
          '— Standard Approx Profit': `£${stdProfit}`,
          'Lock-In Lay Stake (final leg)': `£${lockLs}`,
          'Locked Profit (guaranteed)': `£${lockedProfit}`,
        }
      } else {
        lockResults = {
          'Combined Odds': roundTo(combinedOdds),
          'Standard Lay Stake': `£${stdLs}`,
          'Standard Approx Profit': `£${stdProfit}`,
          'Note': 'Enter final leg lay odds to see lock-in stake',
        }
      }
      setRes(lockResults)
      addToHistory('acca', { legs, stake, commission, acType, finalLayOdds }, lockResults)
    } else {
      const ls = roundTo(calcLayStake(bs, combinedOdds, combinedOdds + 0.05, comm))
      const profit = roundTo(bs * (combinedOdds - 1) - ls * (combinedOdds - 1 + 0.05))
      const results = {
        'Combined Odds': roundTo(combinedOdds),
        'Lay Stake': `£${ls}`,
        'Approx Profit': `£${profit}`,
      }
      setRes(results)
      addToHistory('acca', { legs, stake, commission }, results)
    }
  }

  return (
    <CalcWrapper name="acca" onCalc={calc} results={res}>
      <h3 className="font-bold text-navy-700 dark:text-white">ACCA Calculator</h3>
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(0,0,0,0.05)' }}>
        {[
          { id: 'standard', label: 'Standard', desc: 'Lay the full ACCA now' },
          { id: 'lockin', label: 'Lock In', desc: 'Lay final leg after N-1 win' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => { setAcType(t.id); setRes(null) }}
            className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: acType === t.id ? '#C9A96E' : 'transparent',
              color: acType === t.id ? '#0D1F35' : '#9ca3af',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {acType === 'lockin' && (
        <p className="text-xs" style={{ color: '#9ca3af' }}>
          Don't lay initially. Once N-1 legs win, enter the current exchange price on the final leg to calculate your lock-in lay.
        </p>
      )}
      <div className="space-y-2">
        {legs.map((l, i) => (
          <div key={i} className="flex items-center gap-2">
            <Field label={`Leg ${i + 1} odds`} val={l} set={v => { const n=[...legs]; n[i]=v; setLegs(n) }} />
            {legs.length > 2 && (
              <button onClick={() => setLegs(legs.filter((_, j) => j !== i))} className="text-red-400 text-xs mt-4">✕</button>
            )}
          </div>
        ))}
        {legs.length < 8 && (
          <button onClick={() => setLegs([...legs, ''])} className="text-gold-500 text-sm font-semibold">+ Add leg</button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <Field label="Stake (£)" val={stake} set={setStake} />
        <Field label="Commission (%)" val={commission} set={setCommission} />
        {acType === 'lockin' && (
          <Field label="Final Leg Lay Odds" val={finalLayOdds} set={setFinalLayOdds} />
        )}
      </div>
      {validLegs.length >= 2 && (
        <p className="text-xs text-gray-500">Combined odds: {roundTo(combinedOdds)}</p>
      )}
    </CalcWrapper>
  )
}

// ─── 7. ACCA Insurance ────────────────────────────────────────────────────────
function AccaInsurance() {
  const [f, setF] = useState({ accaOdds: '', insuranceLegOdds: '', stake: '' })
  const [res, setRes] = useState(null)

  function calc() {
    const ao = +f.accaOdds, io = +f.insuranceLegOdds, stake = +f.stake
    if (!ao || !stake) return
    const profitAccaWins = roundTo(stake * (ao - 1))
    const profitInsurance = roundTo(stake * 0.75) // approx free bet value
    const results = {
      'Profit if ACCA Wins': `£${profitAccaWins}`,
      'Insurance Value (approx)': `£${profitInsurance}`,
      'Break-even Odds': roundTo(ao * 0.5),
    }
    setRes(results)
    addToHistory('accainsurance', f, results)
  }

  return (
    <CalcWrapper name="accainsurance" onCalc={calc} results={res}>
      <h3 className="font-bold text-navy-700 dark:text-white">ACCA Insurance</h3>
      <div className="grid grid-cols-2 gap-2">
        <Field label="ACCA Odds" val={f.accaOdds} set={v => setF({...f, accaOdds: v})} />
        <Field label="Insurance Leg Odds" val={f.insuranceLegOdds} set={v => setF({...f, insuranceLegOdds: v})} />
        <Field label="Stake (£)" val={f.stake} set={v => setF({...f, stake: v})} />
      </div>
    </CalcWrapper>
  )
}

// ─── 8. Dutch Betting ─────────────────────────────────────────────────────────
function DutchCalc() {
  const [sels, setSels] = useState(['', '', ''])
  const [totalStake, setTotalStake] = useState('')
  const [res, setRes] = useState(null)

  function calc() {
    const odds = sels.filter(s => s && !isNaN(+s)).map(Number)
    if (odds.length < 2 || !totalStake) return
    const invSum = odds.reduce((s, o) => s + 1/o, 0)
    const stakes = odds.map(o => roundTo((+totalStake / o) / invSum))
    const profit = roundTo(stakes[0] * odds[0] - +totalStake)
    const results = Object.fromEntries([
      ...stakes.map((s, i) => [`Selection ${i+1} Stake`, `£${s}`]),
      ['Equal Profit', `£${profit}`],
      ['Margin', `${roundTo((1 - invSum) * 100)}%`],
    ])
    setRes(results)
    addToHistory('dutch', { sels, totalStake }, results)
  }

  return (
    <CalcWrapper name="dutch" onCalc={calc} results={res}>
      <h3 className="font-bold text-navy-700 dark:text-white">Dutch Betting</h3>
      <Field label="Total Stake (£)" val={totalStake} set={setTotalStake} />
      <div className="space-y-2 mt-2">
        {sels.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <Field label={`Selection ${i+1} Odds`} val={s} set={v => { const n=[...sels]; n[i]=v; setSels(n) }} />
            {sels.length > 2 && (
              <button onClick={() => setSels(sels.filter((_, j) => j !== i))} className="text-red-400 text-xs mt-4">✕</button>
            )}
          </div>
        ))}
        {sels.length < 8 && (
          <button onClick={() => setSels([...sels, ''])} className="text-gold-500 text-sm font-semibold">+ Add selection</button>
        )}
      </div>
    </CalcWrapper>
  )
}

// ─── 9. Arbitrage 2-outcome ───────────────────────────────────────────────────
function ArbTwo() {
  const [f, setF] = useState({ odds1: '', odds2: '', totalStake: '' })
  const [res, setRes] = useState(null)

  function calc() {
    const o1 = +f.odds1, o2 = +f.odds2, ts = +f.totalStake
    if (!o1 || !o2 || !ts) return
    const s1 = roundTo(ts / o1 / (1/o1 + 1/o2))
    const s2 = roundTo(ts - s1)
    const profit = roundTo(s1 * o1 - ts)
    const margin = roundTo((1 - (1/o1 + 1/o2)) * 100)
    const results = {
      'Outcome 1 Stake': `£${s1}`,
      'Outcome 2 Stake': `£${s2}`,
      'Guaranteed Profit': `£${profit}`,
      'Arb Margin': `${margin}%`,
    }
    setRes(results)
    addToHistory('arb2', f, results)
  }

  return (
    <CalcWrapper name="arb2" onCalc={calc} results={res}>
      <h3 className="font-bold text-navy-700 dark:text-white">Arbitrage — 2 Outcome</h3>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Outcome 1 Odds" val={f.odds1} set={v => setF({...f, odds1: v})} />
        <Field label="Outcome 2 Odds" val={f.odds2} set={v => setF({...f, odds2: v})} />
        <Field label="Total Stake (£)" val={f.totalStake} set={v => setF({...f, totalStake: v})} />
      </div>
    </CalcWrapper>
  )
}

// ─── 10. Arbitrage 3-outcome ──────────────────────────────────────────────────
function ArbThree() {
  const [f, setF] = useState({ odds1: '', odds2: '', odds3: '', totalStake: '' })
  const [res, setRes] = useState(null)

  function calc() {
    const odds = [+f.odds1, +f.odds2, +f.odds3]
    const ts = +f.totalStake
    if (odds.some(o => !o) || !ts) return
    const invSum = odds.reduce((s, o) => s + 1/o, 0)
    const stakes = odds.map(o => roundTo(ts / (o * invSum)))
    const profit = roundTo(stakes[0] * odds[0] - ts)
    const margin = roundTo((1 - invSum) * 100)
    const results = {
      'Stake 1': `£${stakes[0]}`,
      'Stake 2': `£${stakes[1]}`,
      'Stake 3': `£${stakes[2]}`,
      'Guaranteed Profit': `£${profit}`,
      'Arb Margin': `${margin}%`,
    }
    setRes(results)
    addToHistory('arb3', f, results)
  }

  return (
    <CalcWrapper name="arb3" onCalc={calc} results={res}>
      <h3 className="font-bold text-navy-700 dark:text-white">Arbitrage — 3 Outcome</h3>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Outcome 1 Odds" val={f.odds1} set={v => setF({...f, odds1: v})} />
        <Field label="Outcome 2 Odds" val={f.odds2} set={v => setF({...f, odds2: v})} />
        <Field label="Outcome 3 Odds" val={f.odds3} set={v => setF({...f, odds3: v})} />
        <Field label="Total Stake (£)" val={f.totalStake} set={v => setF({...f, totalStake: v})} />
      </div>
    </CalcWrapper>
  )
}

// ─── 11. EV Boost ─────────────────────────────────────────────────────────────
function EVBoost() {
  const def = getSettings()
  const [f, setF] = useState({ trueOdds: '', boostedOdds: '', stake: '', commission: def.defaultCommission ?? 5 })
  const [res, setRes] = useState(null)

  function calc() {
    const to = +f.trueOdds, bo = +f.boostedOdds, stake = +f.stake, comm = +f.commission
    if (!to || !bo || !stake) return
    const ev = roundTo(stake * (bo / to) - stake)
    const ls = roundTo(calcLayStake(stake, bo, bo + 0.02, comm))
    const profit = roundTo(stake * (bo - 1) - ls * (bo + 0.02 - 1))
    const results = {
      'Expected Value': `£${ev}`,
      'Suggested Lay Stake': `£${ls}`,
      'Locked Profit': `£${profit}`,
    }
    setRes(results)
    addToHistory('evboost', f, results)
  }

  return (
    <CalcWrapper name="evboost" onCalc={calc} results={res}>
      <h3 className="font-bold text-navy-700 dark:text-white">EV Boost</h3>
      <div className="grid grid-cols-2 gap-2">
        <Field label="True Odds" val={f.trueOdds} set={v => setF({...f, trueOdds: v})} />
        <Field label="Boosted Odds" val={f.boostedOdds} set={v => setF({...f, boostedOdds: v})} />
        <Field label="Stake (£)" val={f.stake} set={v => setF({...f, stake: v})} />
        <Field label="Commission (%)" val={f.commission} set={v => setF({...f, commission: v})} />
      </div>
    </CalcWrapper>
  )
}

// ─── 12. Lay the Draw ─────────────────────────────────────────────────────────
function LayTheDraw() {
  const def = getSettings()
  const [f, setF] = useState({ preMatchLay: '', inPlayLay: '', preMatchStake: '', commission: def.defaultCommission ?? 5 })
  const [res, setRes] = useState(null)

  function calc() {
    const pm = +f.preMatchLay, ip = +f.inPlayLay, stake = +f.preMatchStake, comm = +f.commission
    if (!pm || !ip || !stake) return
    const inPlayStake = roundTo((stake * (pm - 1)) / (ip - 1))
    const profitGoal = roundTo(inPlayStake * (1 - comm/100) - stake * (pm - 1) + stake * (pm - 1))
    const profitNoGoal = roundTo(stake * (1 - comm/100) - stake)
    const lockedProfit = roundTo(inPlayStake * (1 - comm/100) - stake)
    const results = {
      'In-Play Stake': `£${inPlayStake}`,
      'Locked Profit (goal)': `£${roundTo(stake * (pm-1) - inPlayStake * (ip-1))}`,
      'Locked Profit (no goal)': `£${roundTo(inPlayStake * (1-comm/100) - stake * (pm-1))}`,
    }
    setRes(results)
    addToHistory('laythedraw', f, results)
  }

  return (
    <CalcWrapper name="laythedraw" onCalc={calc} results={res}>
      <h3 className="font-bold text-navy-700 dark:text-white">Lay the Draw</h3>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Pre-match Lay Odds" val={f.preMatchLay} set={v => setF({...f, preMatchLay: v})} />
        <Field label="In-play Lay Odds" val={f.inPlayLay} set={v => setF({...f, inPlayLay: v})} />
        <Field label="Pre-match Stake (£)" val={f.preMatchStake} set={v => setF({...f, preMatchStake: v})} />
        <Field label="Commission (%)" val={f.commission} set={v => setF({...f, commission: v})} />
      </div>
    </CalcWrapper>
  )
}

// ─── 13. Place Terms ──────────────────────────────────────────────────────────
function PlaceTermsCalc() {
  const def = getSettings()
  const [f, setF] = useState({ ewStake: '', winOdds: '', placeTerms: '4', numPlaces: '3', layComm: def.defaultCommission ?? 5 })
  const [res, setRes] = useState(null)

  function calc() {
    const stake = +f.ewStake, wo = +f.winOdds, pt = +f.placeTerms, np = +f.numPlaces, comm = +f.layComm
    if (!stake || !wo) return
    const placeOdds = roundTo((wo - 1) / pt + 1)
    const winLayStake = roundTo(calcLayStake(stake, wo, wo + 0.02, comm))
    const placeLayStake = roundTo(calcLayStake(stake, placeOdds, placeOdds + 0.02, comm))
    const results = {
      'Implied Place Odds': placeOdds,
      'Win Lay Stake': `£${winLayStake}`,
      'Place Lay Stake': `£${placeLayStake}`,
      'Place Terms': `1/${pt} for ${np} places`,
    }
    setRes(results)
    addToHistory('placeterms', f, results)
  }

  return (
    <CalcWrapper name="placeterms" onCalc={calc} results={res}>
      <h3 className="font-bold text-navy-700 dark:text-white">Place Terms</h3>
      <div className="grid grid-cols-2 gap-2">
        <Field label="E/W Stake (£)" val={f.ewStake} set={v => setF({...f, ewStake: v})} />
        <Field label="Win Odds" val={f.winOdds} set={v => setF({...f, winOdds: v})} />
        <div>
          <label className="label">Place Terms</label>
          <select className="input" value={f.placeTerms} onChange={e => setF({...f, placeTerms: e.target.value})}>
            <option value="4">1/4</option>
            <option value="5">1/5</option>
          </select>
        </div>
        <Field label="Number of Places" val={f.numPlaces} set={v => setF({...f, numPlaces: v})} />
        <Field label="Lay Commission (%)" val={f.layComm} set={v => setF({...f, layComm: v})} />
      </div>
    </CalcWrapper>
  )
}

// ─── 14. Each-Way Extra ───────────────────────────────────────────────────────
function EachWayExtra() {
  const [f, setF] = useState({ stake: '', winOdds: '', stdPlaces: '3', extraPlaces: '4', stdTerms: '4', extraTerms: '5' })
  const [res, setRes] = useState(null)

  function calc() {
    const stake = +f.stake, wo = +f.winOdds
    const stdPlaces = +f.stdPlaces, extraPlaces = +f.extraPlaces
    const stdTerms = +f.stdTerms, extraTerms = +f.extraTerms
    if (!stake || !wo) return
    const stdPlaceOdds = roundTo((wo - 1) / stdTerms + 1)
    const extraPlaceOdds = roundTo((wo - 1) / extraTerms + 1)
    const stdValue = roundTo(stake * stdPlaceOdds)
    const extraValue = roundTo(stake * extraPlaceOdds)
    const diff = roundTo(extraValue - stdValue)
    const results = {
      'Standard Place Odds': stdPlaceOdds,
      'Extra Place Odds': extraPlaceOdds,
      'Standard Return': `£${stdValue}`,
      'Extra Return': `£${extraValue}`,
      'Extra Value Difference': `£${diff}`,
    }
    setRes(results)
    addToHistory('eachwayx', f, results)
  }

  return (
    <CalcWrapper name="eachwayx" onCalc={calc} results={res}>
      <h3 className="font-bold text-navy-700 dark:text-white">Each-Way Extra</h3>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Stake (£)" val={f.stake} set={v => setF({...f, stake: v})} />
        <Field label="Win Odds" val={f.winOdds} set={v => setF({...f, winOdds: v})} />
        <Field label="Std Places" val={f.stdPlaces} set={v => setF({...f, stdPlaces: v})} />
        <Field label="Extra Places" val={f.extraPlaces} set={v => setF({...f, extraPlaces: v})} />
      </div>
    </CalcWrapper>
  )
}

// ─── 15. Hedging / Green Up ───────────────────────────────────────────────────
function HedgeCalc() {
  const def = getSettings()
  const [f, setF] = useState({ origStake: '', origOdds: '', currLayOdds: '', commission: def.defaultCommission ?? 5 })
  const [res, setRes] = useState(null)

  function calc() {
    const bs = +f.origStake, bo = +f.origOdds, lo = +f.currLayOdds, comm = +f.commission
    if (!bs || !bo || !lo) return
    const hedgeStake = roundTo((bs * bo) / (lo - comm/100))
    const lockedProfit = roundTo(bs * (bo - 1) - hedgeStake * (lo - 1))
    const results = {
      'Hedge Lay Stake': `£${hedgeStake}`,
      'Locked Profit': `£${lockedProfit}`,
      'Liability': `£${roundTo(hedgeStake * (lo - 1))}`,
    }
    setRes(results)
    addToHistory('hedge', f, results)
  }

  return (
    <CalcWrapper name="hedge" onCalc={calc} results={res}>
      <h3 className="font-bold text-navy-700 dark:text-white">Hedging / Green Up</h3>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Original Back Stake (£)" val={f.origStake} set={v => setF({...f, origStake: v})} />
        <Field label="Original Back Odds" val={f.origOdds} set={v => setF({...f, origOdds: v})} />
        <Field label="Current Lay Odds" val={f.currLayOdds} set={v => setF({...f, currLayOdds: v})} />
        <Field label="Commission (%)" val={f.commission} set={v => setF({...f, commission: v})} />
      </div>
    </CalcWrapper>
  )
}

// ─── 16. Liability ────────────────────────────────────────────────────────────
function LiabilityCalc() {
  const [f, setF] = useState({ layOdds: '', layStake: '' })
  const [res, setRes] = useState(null)

  function calc() {
    const lo = +f.layOdds, ls = +f.layStake
    if (!lo || !ls) return
    const liability = roundTo(ls * (lo - 1))
    const results = {
      'Liability Required': `£${liability}`,
      'Total Exposure': `£${roundTo(ls + liability)}`,
    }
    setRes(results)
    addToHistory('liability', f, results)
  }

  return (
    <CalcWrapper name="liability" onCalc={calc} results={res}>
      <h3 className="font-bold text-navy-700 dark:text-white">Liability Calculator</h3>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Lay Odds" val={f.layOdds} set={v => setF({...f, layOdds: v})} />
        <Field label="Lay Stake (£)" val={f.layStake} set={v => setF({...f, layStake: v})} />
      </div>
    </CalcWrapper>
  )
}

// ─── Shared Field component ───────────────────────────────────────────────────
function Field({ label, val, set, placeholder }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        className="input"
        type="text"
        inputMode="decimal"
        placeholder={placeholder || '0'}
        value={val}
        onChange={e => set(e.target.value)}
      />
    </div>
  )
}

// ─── Calculator list & routing ────────────────────────────────────────────────
const CALCS = [
  { id: 'backlay', label: 'Back / Lay', desc: 'Standard matched bet', component: BackLayCalc },
  { id: 'eachway', label: 'Each-Way', desc: 'Full EW breakdown', component: EachWayCalc },
  { id: 'freebetsnr', label: 'Free Bet SNR', desc: 'Stake not returned', component: FreeBetSNR },
  { id: 'freebetsr', label: 'Free Bet SR', desc: 'Stake returned', component: FreeBetSR },
  { id: 'bonusextract', label: 'Bonus Extractor', desc: 'Expected extraction', component: BonusBetExtractor },
  { id: 'acca', label: 'ACCA', desc: 'Up to 8 legs', component: AccaCalc },
  { id: 'accainsurance', label: 'ACCA Insurance', desc: 'Insurance scenarios', component: AccaInsurance },
  { id: 'dutch', label: 'Dutch Betting', desc: 'Equal profit on all', component: DutchCalc },
  { id: 'arb2', label: 'Arbitrage 2-way', desc: '2-outcome guaranteed', component: ArbTwo },
  { id: 'arb3', label: 'Arbitrage 3-way', desc: '3-outcome guaranteed', component: ArbThree },
  { id: 'evboost', label: 'EV Boost', desc: 'Price boost expected value', component: EVBoost },
  { id: 'laythedraw', label: 'Lay the Draw', desc: 'In-play green up', component: LayTheDraw },
  { id: 'placeterms', label: 'Place Terms', desc: 'Custom place terms', component: PlaceTermsCalc },
  { id: 'eachwayx', label: 'Each-Way Extra', desc: 'Extra places comparison', component: EachWayExtra },
  { id: 'hedge', label: 'Hedge / Green Up', desc: 'Lock in profit', component: HedgeCalc },
  { id: 'liability', label: 'Liability', desc: 'Exchange liability', component: LiabilityCalc },
]

function CalcList() {
  const navigate = useNavigate()
  return (
    <div className="space-y-2">
      <h2 className="section-title">Calculators</h2>
      <div className="grid grid-cols-2 gap-2">
        {CALCS.map(c => (
          <button
            key={c.id}
            onClick={() => navigate(c.id)}
            className="card p-3 text-left hover:shadow-md transition-all active:scale-95"
          >
            <p className="font-semibold text-sm text-navy-700 dark:text-white">{c.label}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{c.desc}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Calculators() {
  return (
    <Routes>
      <Route index element={<CalcList />} />
      {CALCS.map(c => (
        <Route key={c.id} path={c.id} element={<c.component />} />
      ))}
    </Routes>
  )
}
