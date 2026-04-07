import { useState, useEffect, useRef, useContext } from 'react'
import { ChevronDown, ChevronUp, Trophy, Flame, Target, Scale, CheckSquare, Upload, X, Edit3 } from 'lucide-react'
import { getSettings, getList, saveList, genId } from '../lib/store'
import { SyncContext } from '../App'
import { format, parseISO, differenceInDays, addDays, startOfMonth, endOfMonth, isWithinInterval, eachDayOfInterval } from 'date-fns'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ReferenceLine, ReferenceArea
} from 'recharts'
import confetti from 'canvas-confetti'

// ─── Shared card wrapper ──────────────────────────────────────────────────────
function GoalCard({ icon: Icon, title, iconColor, children }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-navy-600 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconColor}`}>
            <Icon size={18} />
          </div>
          <span className="font-bold text-navy-700 dark:text-white">{title}</span>
        </div>
        {open ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
      </button>
      {open && <div className="border-t border-gray-100 dark:border-navy-600 p-4">{children}</div>}
    </div>
  )
}

// ─── Goal 1: Income ───────────────────────────────────────────────────────────
function IncomeGoal() {
  useContext(SyncContext)
  const settings = getSettings()
  const offers = getList('offers') || []
  const entries = getList('income_entries') || []
  const [reward1, setReward1] = useState(getList('goal_reward1') || { text: '', image: null })
  const [reward2, setReward2] = useState(getList('goal_reward2') || { text: 'Reward 2 — edit me', image: null })
  const [editReward, setEditReward] = useState(null)
  const fileRef = useRef()

  const TARGET = 2500
  const now = new Date()

  function getMonthIncome(monthDate) {
    const start = startOfMonth(monthDate)
    const end = endOfMonth(monthDate)
    const mbP = offers
      .filter(o => { if (!o.actual_profit && o.actual_profit !== 0) return false; try { return isWithinInterval(parseISO(o.date), { start, end }) } catch { return false } })
      .reduce((s, o) => s + Number(o.actual_profit), 0)
    const manual = entries
      .filter(e => { try { return isWithinInterval(parseISO(e.date), { start, end }) } catch { return false } })
      .reduce((s, e) => s + Number(e.amount), 0)
    return Number(settings.salary || 0) + mbP + manual
  }

  const month1Income = getMonthIncome(now)
  const month1Hit = month1Income >= TARGET
  const prevMonthIncome = getMonthIncome(new Date(now.getFullYear(), now.getMonth() - 1, 1))
  const month2Hit = prevMonthIncome >= TARGET && month1Hit

  const daysLeft = differenceInDays(endOfMonth(now), now)
  const gap = Math.max(0, TARGET - month1Income)

  useEffect(() => {
    if (month1Hit || month2Hit) {
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 }, colors: ['#C9A96E', '#0D1F35', '#ffffff'] })
    }
  }, [month1Hit, month2Hit])

  function saveReward(num, data) {
    if (num === 1) { saveList('goal_reward1', data); setReward1(data) }
    else { saveList('goal_reward2', data); setReward2(data) }
    setEditReward(null)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">£2,500 net for 2 consecutive months</p>

      {/* Month indicators */}
      <div className="grid grid-cols-2 gap-3">
        <MonthIndicator label="Previous Month" income={prevMonthIncome} target={TARGET} hit={prevMonthIncome >= TARGET} />
        <MonthIndicator label="This Month" income={month1Income} target={TARGET} hit={month1Hit} />
      </div>

      {/* Progress */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-500">£{month1Income.toFixed(0)} / £{TARGET}</span>
          <span className="text-gray-500">{daysLeft} days left</span>
        </div>
        <div className="w-full bg-gray-100 dark:bg-navy-600 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all ${month1Hit ? 'bg-emerald-500' : 'bg-gold-400'}`}
            style={{ width: `${Math.min(100, (month1Income / TARGET) * 100)}%` }}
          />
        </div>
        {gap > 0 && (
          <p className="text-xs text-amber-600 font-semibold mt-1">£{gap.toFixed(0)} away from target</p>
        )}
      </div>

      {/* Consecutive badge */}
      {month2Hit && (
        <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 rounded-xl p-3">
          <Trophy size={18} className="text-emerald-600" />
          <span className="font-bold text-emerald-700 dark:text-emerald-400">Goal complete — 2 consecutive months!</span>
        </div>
      )}

      {/* Rewards */}
      <div className="space-y-2">
        <RewardSlot
          num={1}
          reward={reward1}
          unlocked={month1Hit}
          label="Reward 1 (Month 1 hit)"
          onEdit={() => setEditReward(1)}
        />
        <RewardSlot
          num={2}
          reward={reward2}
          unlocked={month2Hit}
          label="Reward 2 (2 consecutive)"
          onEdit={() => setEditReward(2)}
        />
      </div>

      {editReward && (
        <RewardEditor
          reward={editReward === 1 ? reward1 : reward2}
          onSave={data => saveReward(editReward, data)}
          onClose={() => setEditReward(null)}
        />
      )}
    </div>
  )
}

function MonthIndicator({ label, income, target, hit }) {
  return (
    <div className={`rounded-xl p-3 border-2 ${hit ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' : 'border-gray-200 dark:border-navy-500 bg-gray-50 dark:bg-navy-800'}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-lg font-bold ${hit ? 'text-emerald-600' : 'text-navy-700 dark:text-white'}`}>
        £{income.toFixed(0)}
      </p>
      <p className={`text-xs font-semibold mt-0.5 ${hit ? 'text-emerald-600' : 'text-gray-400'}`}>
        {hit ? '✓ Hit' : `£${(target - income).toFixed(0)} short`}
      </p>
    </div>
  )
}

function RewardSlot({ reward, unlocked, label, onEdit }) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-xl border ${unlocked ? 'border-gold-400 bg-gold-50 dark:bg-gold-900/10' : 'border-gray-200 dark:border-navy-500 opacity-60'}`}>
      <div>
        <p className="text-xs text-gray-500 mb-0.5">{label}</p>
        <p className={`text-sm font-semibold ${unlocked ? 'text-gold-600 dark:text-gold-400' : 'text-gray-400'}`}>
          {reward.text || '—'}
        </p>
      </div>
      <button onClick={onEdit} className="text-gray-400 hover:text-gray-600 p-1">
        <Edit3 size={14} />
      </button>
    </div>
  )
}

function RewardEditor({ reward, onSave, onClose }) {
  const [text, setText] = useState(reward?.text || '')
  return (
    <div className="fixed inset-0 z-[60] flex items-end lg:items-center justify-center pb-20 lg:pb-0 bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-navy-700 rounded-t-2xl lg:rounded-2xl w-full max-w-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-navy-700 dark:text-white">Edit Reward</h3>
        <input className="input" value={text} onChange={e => setText(e.target.value)} placeholder="e.g. Book holiday to Barcelona" />
        <div className="flex gap-2">
          <button onClick={() => onSave({ text, image: reward?.image })} className="btn-primary flex-1">Save</button>
          <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ─── Goal 2: Health ───────────────────────────────────────────────────────────
function HealthGoal() {
  const syncVersion = useContext(SyncContext)
  const [weights, setWeights] = useState(() => getList('weight_log') || [])
  const [calories, setCalories] = useState(() => getList('calorie_log') || [])
  const [todayWeight, setTodayWeight] = useState('')
  const [todayCalories, setTodayCalories] = useState('')
  const [reward, setReward] = useState(() => getList('health_goal_reward') || { text: 'New clothes' })
  const [editReward, setEditReward] = useState(false)

  useEffect(() => {
    setWeights(getList('weight_log') || [])
    setCalories(getList('calorie_log') || [])
  }, [syncVersion])

  const START_WEIGHT = 82.6
  const TARGET_MIN = 77.5
  const TARGET_MAX = 78.5
  const TARGET_DATE = '2026-07-01'

  const daysToTarget = differenceInDays(new Date(TARGET_DATE), new Date())

  function logWeight() {
    if (!todayWeight) return
    const today = format(new Date(), 'yyyy-MM-dd')
    const existing = (getList('weight_log') || []).filter(w => w.date !== today)
    const next = [...existing, { id: genId(), date: today, weight: Number(todayWeight) }].sort((a, b) => a.date.localeCompare(b.date))
    saveList('weight_log', next)
    setWeights(next)
    setTodayWeight('')

    // Check if in target range
    if (Number(todayWeight) >= TARGET_MIN && Number(todayWeight) <= TARGET_MAX) {
      confetti({ particleCount: 100, spread: 90, origin: { y: 0.5 }, colors: ['#C9A96E', '#10b981', '#ffffff'] })
    }
  }

  function logCalories() {
    if (!todayCalories) return
    const today = format(new Date(), 'yyyy-MM-dd')
    const existing = (getList('calorie_log') || []).filter(c => c.date !== today)
    const next = [...existing, { id: genId(), date: today, calories: Number(todayCalories) }]
    saveList('calorie_log', next)
    setCalories(next)
    setTodayCalories('')
  }

  // Build chart data
  const chartData = weights.slice(-30).map(w => ({
    date: w.date.slice(5), // MM-DD
    weight: w.weight,
  }))

  // Current weight & trend
  const latestWeight = weights.length > 0 ? weights[weights.length - 1].weight : START_WEIGHT
  const weeklyAvg = weights.length >= 7
    ? weights.slice(-7).reduce((s, w) => s + w.weight, 0) / 7
    : latestWeight

  // Trend projection (linear regression last 14 days)
  function projectDate(targetWeight) {
    if (weights.length < 2) return null
    const recent = weights.slice(-14)
    if (recent.length < 2) return null
    const n = recent.length
    const days = recent.map((_, i) => i)
    const avgDay = days.reduce((s, d) => s + d, 0) / n
    const avgW = recent.reduce((s, w) => s + w.weight, 0) / n
    const slope = days.reduce((s, d, i) => s + (d - avgDay) * (recent[i].weight - avgW), 0) /
                  days.reduce((s, d) => s + (d - avgDay) ** 2, 0)
    if (slope >= 0) return null // not losing weight
    const daysNeeded = (targetWeight - avgW) / slope
    const baseDate = parseISO(recent[recent.length - 1].date)
    return addDays(baseDate, Math.round(daysNeeded))
  }

  const projectedDate = projectDate((TARGET_MIN + TARGET_MAX) / 2)
  const inTargetRange = latestWeight >= TARGET_MIN && latestWeight <= TARGET_MAX

  // Today's calorie log
  const today = format(new Date(), 'yyyy-MM-dd')
  const todayCals = calories.find(c => c.date === today)?.calories
  const CALORIE_TARGET = 2250
  const deficit = todayCals ? CALORIE_TARGET - todayCals : null

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
        82.6kg → 77.5–78.5kg by July 1st
      </p>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center p-3 bg-gray-50 dark:bg-navy-800 rounded-xl">
          <p className="text-xl font-bold text-navy-700 dark:text-white">{latestWeight.toFixed(1)}</p>
          <p className="text-xs text-gray-500">Current kg</p>
        </div>
        <div className="text-center p-3 bg-gray-50 dark:bg-navy-800 rounded-xl">
          <p className="text-xl font-bold text-gold-500">{weeklyAvg.toFixed(1)}</p>
          <p className="text-xs text-gray-500">7-day avg</p>
        </div>
        <div className="text-center p-3 bg-gray-50 dark:bg-navy-800 rounded-xl">
          <p className="text-xl font-bold text-navy-700 dark:text-white">{daysToTarget}</p>
          <p className="text-xs text-gray-500">Days to Jul 1</p>
        </div>
      </div>

      {/* Log weight */}
      <div className="flex gap-2">
        <input
          className="input flex-1"
          type="number"
          step="0.1"
          placeholder="Today's weight (kg)"
          value={todayWeight}
          onChange={e => setTodayWeight(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && logWeight()}
        />
        <button onClick={logWeight} className="btn-primary px-4">Log</button>
      </div>

      {/* Weight chart */}
      {chartData.length > 0 && (
        <div className="card p-4">
          <h3 className="font-semibold text-sm text-gray-700 dark:text-white mb-3">Weight Trend</h3>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
              <YAxis domain={[75, 85]} tick={{ fontSize: 9 }} />
              <Tooltip formatter={(v) => [`${v} kg`, 'Weight']} />
              <ReferenceArea y1={TARGET_MIN} y2={TARGET_MAX} fill="#10b981" fillOpacity={0.1} label={{ value: 'Target', fontSize: 9, fill: '#10b981' }} />
              <ReferenceLine y={TARGET_MIN} stroke="#10b981" strokeDasharray="3 3" />
              <ReferenceLine y={TARGET_MAX} stroke="#10b981" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="weight" stroke="#C9A96E" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Projection */}
      {projectedDate && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
          <Target size={16} className="text-blue-500" />
          <p className="text-sm text-blue-700 dark:text-blue-400">
            Projected to hit target: <strong>{format(projectedDate, 'd MMMM yyyy')}</strong>
          </p>
        </div>
      )}

      {inTargetRange && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 rounded-xl">
          <Trophy size={16} className="text-emerald-600" />
          <span className="font-bold text-emerald-700 dark:text-emerald-400">In target range! 🎉</span>
        </div>
      )}

      {/* Calories */}
      <div>
        <p className="label">Calories Today</p>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            type="number"
            placeholder="e.g. 1850"
            value={todayCalories}
            onChange={e => setTodayCalories(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && logCalories()}
          />
          <button onClick={logCalories} className="btn-primary px-4">Log</button>
        </div>
        {todayCals != null && (
          <div className="flex gap-3 mt-2 text-xs">
            <span className="text-gray-600 dark:text-gray-400">Today: {todayCals} kcal</span>
            <span className="text-gray-500">Target: 2,200–2,300 kcal</span>
            {deficit != null && (
              <span className={`font-semibold ${deficit > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {deficit > 0 ? `${deficit} kcal deficit` : `${Math.abs(deficit)} kcal over`}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Reward */}
      <RewardSlot reward={reward} unlocked={inTargetRange} label="Reward (when in target range)" onEdit={() => setEditReward(true)} />
      {editReward && (
        <RewardEditor
          reward={reward}
          onSave={data => { saveList('health_goal_reward', data); setReward(data); setEditReward(false) }}
          onClose={() => setEditReward(false)}
        />
      )}
    </div>
  )
}

// ─── Goal 3: Consistency ──────────────────────────────────────────────────────
const CONSISTENCY_ITEMS_DEFAULT = [
  { id: 'deepwork', label: '1 hour deep work' },
  { id: 'exercise', label: '1 hour exercise' },
  { id: 'water', label: '3L of water' },
  { id: 'deficit', label: '500 kcal deficit' },
]

function ConsistencyGoal() {
  const syncVersion = useContext(SyncContext)
  const settings = getSettings()
  const [items, setItems] = useState(() => getList('consistency_items') || CONSISTENCY_ITEMS_DEFAULT)
  const [log, setLog] = useState(() => getList('consistency_log') || {})
  const [editDay, setEditDay] = useState(null) // date string
  const [newItem, setNewItem] = useState('')
  const [reward, setReward] = useState(() => getList('consistency_reward') || { text: '' })
  const [editReward, setEditReward] = useState(false)

  useEffect(() => {
    setItems(getList('consistency_items') || CONSISTENCY_ITEMS_DEFAULT)
    setLog(getList('consistency_log') || {})
  }, [syncVersion])

  const START_DATE = settings.goalStartDate || '2026-04-06'
  const TOTAL_DAYS = settings.consistencyGoalDays || 85
  const WIN_TARGET = settings.consistencyGoalTarget || 75
  const today = format(new Date(), 'yyyy-MM-dd')

  // Build days array
  const startDate = parseISO(START_DATE)
  const allDays = eachDayOfInterval({ start: startDate, end: addDays(startDate, TOTAL_DAYS - 1) })
  const elapsed = Math.min(TOTAL_DAYS, Math.max(0, differenceInDays(new Date(), startDate) + 1))

  // Count wins
  const wins = allDays.slice(0, elapsed).filter(day => {
    const d = format(day, 'yyyy-MM-dd')
    const dayLog = log[d] || []
    return items.every(item => dayLog.includes(item.id))
  }).length

  // Streak
  let streak = 0
  for (let i = elapsed - 1; i >= 0; i--) {
    const d = format(allDays[i], 'yyyy-MM-dd')
    const dayLog = log[d] || []
    if (items.every(item => dayLog.includes(item.id))) {
      streak++
    } else {
      break
    }
  }

  // Longest streak
  let longestStreak = 0, cur = 0
  for (let i = 0; i < elapsed; i++) {
    const d = format(allDays[i], 'yyyy-MM-dd')
    const dayLog = log[d] || []
    if (items.every(item => dayLog.includes(item.id))) {
      cur++
      longestStreak = Math.max(longestStreak, cur)
    } else {
      cur = 0
    }
  }

  const winRate = elapsed > 0 ? Math.round((wins / elapsed) * 100) : 0
  const winsNeeded = WIN_TARGET - wins
  const daysRemaining = TOTAL_DAYS - elapsed

  // Projected: need winsNeeded wins in daysRemaining days
  const projWinRate = daysRemaining > 0 ? (winsNeeded / daysRemaining * 100).toFixed(0) : null

  function toggleItem(date, itemId) {
    const current = log[date] || []
    const next = current.includes(itemId) ? current.filter(i => i !== itemId) : [...current, itemId]
    const newLog = { ...log, [date]: next }
    saveList('consistency_log', newLog)
    setLog(newLog)
  }

  function addItem() {
    if (!newItem.trim()) return
    const next = [...items, { id: genId(), label: newItem.trim() }]
    saveList('consistency_items', next)
    setItems(next)
    setNewItem('')
  }

  function removeItem(id) {
    const next = items.filter(i => i.id !== id)
    saveList('consistency_items', next)
    setItems(next)
  }

  // Calendar heatmap — show all days
  const HeatmapDay = ({ day }) => {
    const d = format(day, 'yyyy-MM-dd')
    const isPast = d <= today
    const dayLog = log[d] || []
    const isWin = isPast && items.every(item => dayLog.includes(item.id))
    const isFail = isPast && !isWin && d < today
    const isToday = d === today

    return (
      <button
        onClick={() => isPast && setEditDay(d)}
        className={`w-7 h-7 rounded-md text-xs font-semibold transition-all ${
          isWin ? 'bg-emerald-400 text-white' :
          isFail ? 'bg-red-300 text-white' :
          isToday ? 'bg-gold-400 text-white' :
          'bg-gray-100 dark:bg-navy-600 text-gray-300'
        }`}
        title={d}
      >
        {format(day, 'd')}
      </button>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
        Complete {WIN_TARGET} out of {TOTAL_DAYS} days
      </p>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center p-3 bg-gray-50 dark:bg-navy-800 rounded-xl">
          <p className="text-2xl font-bold text-navy-700 dark:text-white">{wins}</p>
          <p className="text-xs text-gray-500">Wins</p>
          <p className="text-xs text-gray-400">/ {WIN_TARGET} target</p>
        </div>
        <div className="text-center p-3 bg-gray-50 dark:bg-navy-800 rounded-xl">
          <p className="text-2xl font-bold text-orange-500 flex items-center justify-center gap-0.5"><Flame size={18} />{streak}</p>
          <p className="text-xs text-gray-500">Streak</p>
          <p className="text-xs text-gray-400">Best: {longestStreak}</p>
        </div>
        <div className="text-center p-3 bg-gray-50 dark:bg-navy-800 rounded-xl">
          <p className="text-2xl font-bold text-navy-700 dark:text-white">{winRate}%</p>
          <p className="text-xs text-gray-500">Win rate</p>
          <p className="text-xs text-gray-400">{elapsed}/{TOTAL_DAYS} days</p>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-500">{wins} wins</span>
          <span className="text-gray-500">Target: {WIN_TARGET}</span>
        </div>
        <div className="w-full bg-gray-100 dark:bg-navy-600 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${wins >= WIN_TARGET ? 'bg-emerald-500' : 'bg-gold-400'}`}
            style={{ width: `${Math.min(100, (wins / WIN_TARGET) * 100)}%` }}
          />
        </div>
        {winsNeeded > 0 && daysRemaining > 0 && (
          <p className="text-xs text-gray-500 mt-1">
            Need {winsNeeded} more wins in {daysRemaining} days ({projWinRate}% win rate required)
          </p>
        )}
      </div>

      {/* Today's checklist */}
      <div>
        <p className="label">Today — {format(new Date(), 'EEEE d MMMM')}</p>
        <div className="space-y-2">
          {items.map(item => {
            const done = (log[today] || []).includes(item.id)
            return (
              <div key={item.id} className="flex items-center gap-3">
                <button onClick={() => toggleItem(today, item.id)} className="flex-shrink-0 active:scale-90 transition-all">
                  {done
                    ? <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center"><span className="text-white text-xs">✓</span></div>
                    : <div className="w-6 h-6 rounded-full border-2 border-gray-300 dark:border-navy-500" />
                  }
                </button>
                <span className={`text-sm flex-1 ${done ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}>{item.label}</span>
                <button onClick={() => removeItem(item.id)} className="text-gray-300 hover:text-red-400"><X size={13} /></button>
              </div>
            )
          })}
        </div>
        {/* Add item */}
        <div className="flex gap-2 mt-3">
          <input
            className="input flex-1 text-sm"
            value={newItem}
            onChange={e => setNewItem(e.target.value)}
            placeholder="Add item..."
            onKeyDown={e => e.key === 'Enter' && addItem()}
          />
          <button onClick={addItem} className="btn-primary text-sm px-3">Add</button>
        </div>
      </div>

      {/* Heatmap */}
      <div>
        <p className="label">Calendar — 85 days</p>
        <div className="flex flex-wrap gap-1">
          {allDays.map(day => <HeatmapDay key={format(day, 'yyyy-MM-dd')} day={day} />)}
        </div>
        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-400 rounded inline-block" /> Win</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-300 rounded inline-block" /> Fail</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-gold-400 rounded inline-block" /> Today</span>
        </div>
      </div>

      {/* Edit past day modal */}
      {editDay && (
        <EditDayModal
          date={editDay}
          items={items}
          log={log}
          onToggle={(itemId) => toggleItem(editDay, itemId)}
          onClose={() => setEditDay(null)}
        />
      )}

      {/* Reward */}
      <RewardSlot reward={reward} unlocked={wins >= WIN_TARGET} label="Reward (when goal complete)" onEdit={() => setEditReward(true)} />
      {editReward && (
        <RewardEditor
          reward={reward}
          onSave={data => { saveList('consistency_reward', data); setReward(data); setEditReward(false) }}
          onClose={() => setEditReward(false)}
        />
      )}
    </div>
  )
}

function EditDayModal({ date, items, log, onToggle, onClose }) {
  const dayLog = log[date] || []
  return (
    <div className="fixed inset-0 z-[60] flex items-end lg:items-center justify-center pb-20 lg:pb-0 bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-navy-700 rounded-t-2xl lg:rounded-2xl w-full max-w-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-navy-700 dark:text-white">Edit — {date}</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="space-y-3">
          {items.map(item => {
            const done = dayLog.includes(item.id)
            return (
              <button key={item.id} onClick={() => onToggle(item.id)} className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-navy-600">
                {done
                  ? <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center"><span className="text-white text-xs">✓</span></div>
                  : <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
                }
                <span className={`text-sm ${done ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}>{item.label}</span>
              </button>
            )
          })}
        </div>
        <button onClick={onClose} className="btn-primary w-full">Done</button>
      </div>
    </div>
  )
}

// ─── Goals page ───────────────────────────────────────────────────────────────
export default function Goals() {
  return (
    <div className="max-w-2xl lg:max-w-4xl mx-auto px-4 py-4 pb-24 lg:pb-4 space-y-4">
      <div>
        <h1 className="section-title text-xl">Q2 Goals</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">April – July 2026</p>
      </div>

      <GoalCard icon={Trophy} title="Income Goal" iconColor="bg-gold-100 text-gold-600">
        <IncomeGoal />
      </GoalCard>

      <GoalCard icon={Scale} title="Health Goal" iconColor="bg-emerald-100 text-emerald-600">
        <HealthGoal />
      </GoalCard>

      <GoalCard icon={CheckSquare} title="Consistency — 75/85 Days" iconColor="bg-blue-100 text-blue-600">
        <ConsistencyGoal />
      </GoalCard>
    </div>
  )
}
