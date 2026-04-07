import { useState, useEffect, useContext } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp, Target, BookOpen, AlertTriangle, ChevronRight,
  Zap, Plus, ArrowUpRight, ArrowDownRight, Wallet
} from 'lucide-react'
import { getSettings, getList } from '../lib/store'
import { calculateHealthScore } from '../lib/healthScore'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine
} from 'recharts'
import {
  format, startOfMonth, endOfMonth, isWithinInterval, parseISO,
  eachDayOfInterval, getDate, getDaysInMonth, subMonths, isSameDay
} from 'date-fns'
import { DarkModeContext, SyncContext } from '../App'

function countWeekdays(start, end) {
  let count = 0
  const d = new Date(start)
  while (d <= end) {
    const day = d.getDay()
    if (day !== 0 && day !== 6) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

// ─── Apple-style stat pill ────────────────────────────────────────────────────
function StatPill({ label, value, sub, color, to }) {
  const inner = (
    <div className="card p-4 flex flex-col gap-1 active:scale-95 transition-transform">
      <p className="label">{label}</p>
      <p className={`text-2xl font-bold leading-none ${color || 'text-navy-700'}`}
         style={{ color: color || undefined }}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
  return to ? <Link to={to}>{inner}</Link> : inner
}

// ─── Luxury tooltip ───────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl px-3 py-2 text-xs shadow-2xl" style={{ background: '#0D1F35', border: '1px solid rgba(201,169,110,0.35)' }}>
      <p style={{ color: 'rgba(255,255,255,0.45)' }}>Day {label}</p>
      <p className="font-bold" style={{ color: '#C9A96E' }}>£{payload[0]?.value?.toFixed(2)}</p>
    </div>
  )
}

export default function Dashboard() {
  const { darkMode } = useContext(DarkModeContext)
  const syncVersion = useContext(SyncContext)
  const [settings, setSettings] = useState(getSettings())
  const [offers, setOffers] = useState([])
  const [entries, setEntries] = useState([])
  const [tasks, setTasks] = useState([])
  const [completions, setCompletions] = useState([])
  const [bookies, setBookies] = useState([])
  const [bets, setBets] = useState([])
  const [alertBookies, setAlertBookies] = useState([])

  useEffect(() => {
    const s = getSettings()
    setSettings(s)
    const o = getList('offers') || []
    const e = getList('income_entries') || []
    const t = getList('daily_tasks') || []
    const c = getList('task_completions') || []
    const b = getList('bookies') || []
    const bts = getList('bets') || []
    setOffers(o); setEntries(e); setTasks(t); setCompletions(c)
    setBookies(b); setBets(bts)

    const alerts = b
      .filter(bk => !bk.archived && bk.status !== 'Gubbed')
      .map(bk => ({
        ...bk,
        score: calculateHealthScore(bk, bts.filter(bt => bt.bookie_id === bk.id), o.filter(ov => ov.bookie_id === bk.id))
      }))
      .filter(bk => bk.score < 60)
    setAlertBookies(alerts)
  }, [syncVersion])

  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)
  const daysInMonth = getDaysInMonth(now)
  const dayOfMonth = getDate(now)

  // MB profit this month
  const mbProfit = offers
    .filter(o => {
      if (o.actual_profit == null || o.actual_profit === '') return false
      try { return isWithinInterval(parseISO(o.date), { start: monthStart, end: monthEnd }) } catch { return false }
    })
    .reduce((s, o) => s + Number(o.actual_profit), 0)

  // Task value this month
  const taskValue = completions
    .filter(c => c.date >= format(monthStart, 'yyyy-MM-dd') && c.date <= format(monthEnd, 'yyyy-MM-dd'))
    .reduce((s, c) => {
      const task = tasks.find(t => t.id === c.task_id)
      return s + (task?.value ? Number(task.value) : 0)
    }, 0)

  // Manual income this month
  const manualIncome = entries
    .filter(e => {
      try { return isWithinInterval(parseISO(e.date), { start: monthStart, end: monthEnd }) } catch { return false }
    })
    .reduce((s, e) => s + Number(e.amount), 0)

  const salaryAmount = Number(settings.salary || 0)
  const variableIncome = mbProfit + manualIncome
  const totalIncome = salaryAmount + variableIncome
  // Salary spreads over weekdays only
  const weekdaysInMonth = countWeekdays(monthStart, monthEnd)
  const salaryPerDay = weekdaysInMonth > 0 ? salaryAmount / weekdaysInMonth : 0
  // Projected: salary fixed + project variable forward by calendar day rate
  const dailyVariableAvg = dayOfMonth > 0 ? variableIncome / dayOfMonth : 0
  const projected = Math.round((salaryAmount + dailyVariableAvg * daysInMonth) * 100) / 100
  // Daily avg: salary earned so far (weekdays) + variable, divided by calendar days elapsed
  const weekdaysElapsed = countWeekdays(monthStart, now)
  const salaryEarnedSoFar = salaryPerDay * weekdaysElapsed
  const dailyAvg = dayOfMonth > 0 ? (salaryEarnedSoFar + variableIncome) / dayOfMonth : 0

  // Last month comparison
  const lastMonthStart = startOfMonth(subMonths(now, 1))
  const lastMonthEnd = endOfMonth(subMonths(now, 1))
  const lastMonthMB = offers
    .filter(o => {
      if (o.actual_profit == null || o.actual_profit === '') return false
      try { return isWithinInterval(parseISO(o.date), { start: lastMonthStart, end: lastMonthEnd }) } catch { return false }
    })
    .reduce((s, o) => s + Number(o.actual_profit), 0)
  const lastMonthManual = entries
    .filter(e => {
      try { return isWithinInterval(parseISO(e.date), { start: lastMonthStart, end: lastMonthEnd }) } catch { return false }
    })
    .reduce((s, e) => s + Number(e.amount), 0)
  const lastMonthTotal = Number(settings.salary || 0) + lastMonthMB + lastMonthManual
  const changePct = lastMonthTotal > 0 ? Math.round(((totalIncome - lastMonthTotal) / lastMonthTotal) * 100) : null

  // Targets
  const TARGETS = [
    { month: 'July', amount: 2500 },
    { month: 'September', amount: 3000 },
    { month: 'December', amount: 3500 },
  ]
  const nextTarget = TARGETS.find(t => totalIncome < t.amount) || TARGETS[TARGETS.length - 1]
  const progress = Math.min(100, (totalIncome / nextTarget.amount) * 100)
  const dailyNeeded = dayOfMonth < daysInMonth
    ? Math.max(0, (nextTarget.amount - totalIncome) / (daysInMonth - dayOfMonth))
    : 0

  // Build daily income chart — salary only on weekdays
  const days = eachDayOfInterval({ start: monthStart, end: now })
  let acc = 0
  const finalChart = days.map((day) => {
    const d = format(day, 'yyyy-MM-dd')
    const isWeekday = day.getDay() !== 0 && day.getDay() !== 6
    const dayMB = offers
      .filter(o => o.date === d && o.actual_profit != null && o.actual_profit !== '')
      .reduce((s, o) => s + Number(o.actual_profit), 0)
    const dayManual = entries
      .filter(e => e.date === d)
      .reduce((s, e) => s + Number(e.amount), 0)
    const dayTask = completions
      .filter(c => c.date === d)
      .reduce((s, c) => {
        const t = tasks.find(t => t.id === c.task_id)
        return s + (t?.value ? Number(t.value) : 0)
      }, 0)
    const daily = Math.round(((isWeekday ? salaryPerDay : 0) + dayMB + dayManual + dayTask) * 100) / 100
    acc = Math.round((acc + daily) * 100) / 100
    return { day: format(day, 'd'), date: d, daily, running: acc }
  })

  // Today's MB profit only (for the stat row — excludes salary)
  const today = format(now, 'yyyy-MM-dd')
  const todayMB = offers
    .filter(o => o.date === today && o.actual_profit != null && o.actual_profit !== '')
    .reduce((s, o) => s + Number(o.actual_profit), 0)
  const todayDone = completions.filter(c => c.date === today).map(c => c.task_id)
  const doneTasks = tasks.filter(t => todayDone.includes(t.id)).length

  const activeBookies = bookies.filter(b => !b.archived && b.status === 'Active')

  const textPrimary = darkMode ? '#f9fafb' : '#0D1F35'
  const textSecondary = darkMode ? '#9ca3af' : '#6b7280'
  const cardBg = darkMode ? '#0D1F35' : '#ffffff'

  return (
    <div className="max-w-lg lg:max-w-4xl mx-auto px-4 py-5 pb-24 lg:pb-5 space-y-4">

      {/* ── Greeting ── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium" style={{ color: textSecondary }}>
            {format(now, 'EEEE, d MMMM')}
          </p>
          <h1 className="text-2xl font-bold mt-0.5 fade-up" style={{ color: textPrimary }}>
            {getGreeting()}
          </h1>
        </div>
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
          style={{ background: '#0D1F35', color: '#C9A96E' }}
        >
          J
        </div>
      </div>

      {/* ── Alert banner ── */}
      {alertBookies.length > 0 && (
        <Link to="/betting">
          <div
            className="rounded-2xl p-3.5 flex items-center gap-3"
            style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}
          >
            <AlertTriangle size={18} className="text-amber-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-700" style={{ color: '#92400e' }}>
                {alertBookies.length} bookie{alertBookies.length > 1 ? 's' : ''} need a mug bet
              </p>
              <p className="text-xs text-amber-600 truncate">{alertBookies.map(b => b.name).join(', ')}</p>
            </div>
            <ChevronRight size={16} className="text-amber-500 flex-shrink-0" />
          </div>
        </Link>
      )}

      {/* ── Income hero card ── */}
      <div
        className="rounded-2xl p-5 overflow-hidden relative"
        style={{ background: 'linear-gradient(135deg, #0D1F35 0%, #1A3A5C 100%)' }}
      >
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(201,169,110,0.8)' }}>
            {format(now, 'MMMM yyyy')} · Net Income
          </p>
          <div className="flex items-end justify-between mt-1 mb-3">
            <div>
              <p className="text-4xl font-bold text-white leading-none">
                £{totalIncome.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                {changePct !== null && (
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-0.5"
                    style={{ background: changePct >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)', color: changePct >= 0 ? '#6ee7b7' : '#fca5a5' }}
                  >
                    {changePct >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                    {Math.abs(changePct)}% vs last month
                  </span>
                )}
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  £{dailyAvg.toFixed(0)}/day avg
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Projected</p>
              <p className="text-lg font-bold" style={{ color: '#C9A96E' }}>£{projected.toLocaleString()}</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-1.5">
            <div className="flex justify-between text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
              <span>Target: £{nextTarget.amount.toLocaleString()} ({nextTarget.month})</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="w-full rounded-full h-1.5" style={{ background: 'rgba(255,255,255,0.12)' }}>
              <div
                className="h-1.5 rounded-full transition-all duration-700"
                style={{ width: `${progress}%`, background: '#C9A96E' }}
              />
            </div>
          </div>
          {dailyNeeded > 0 && (
            <p className="text-xs" style={{ color: 'rgba(201,169,110,0.7)' }}>
              Need £{dailyNeeded.toFixed(0)}/day to hit target
            </p>
          )}
        </div>
      </div>

      {/* ── Daily income line chart ── */}
      {finalChart.length > 1 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(160deg, #0D1F35 0%, #142e4e 60%, #0f2540 100%)' }}>
          {/* Header */}
          <div className="flex items-end justify-between px-5 pt-5 pb-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(201,169,110,0.65)' }}>
                {format(now, 'MMMM')} — Running Total
              </p>
              <p className="text-2xl font-bold mt-0.5" style={{ color: '#C9A96E' }}>
                £{(finalChart[finalChart.length - 1]?.running || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="text-right pb-0.5">
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Day {dayOfMonth}/{daysInMonth}</p>
              <p className="text-xs font-semibold mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>avg £{dailyAvg.toFixed(0)}/d</p>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={finalChart} margin={{ top: 8, right: 0, left: -30, bottom: 0 }}>
              <defs>
                <linearGradient id="luxGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C9A96E" stopOpacity={0.45} />
                  <stop offset="55%" stopColor="#C9A96E" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="#C9A96E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="day"
                tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.28)' }}
                tickLine={false}
                axisLine={false}
                interval={4}
              />
              <YAxis hide />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine
                y={nextTarget.amount}
                stroke="rgba(201,169,110,0.25)"
                strokeDasharray="3 3"
              />
              <Area
                type="monotone"
                dataKey="running"
                stroke="#C9A96E"
                strokeWidth={2.5}
                fill="url(#luxGrad)"
                dot={false}
                activeDot={{ r: 5, fill: '#C9A96E', stroke: 'rgba(201,169,110,0.3)', strokeWidth: 6 }}
              />
            </AreaChart>
          </ResponsiveContainer>

          {/* Stats row */}
          <div className="flex px-5 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <LuxStatItem label="MB Today" value={`£${todayMB.toFixed(2)}`} />
            <div style={{ width: 1, background: 'rgba(255,255,255,0.07)', margin: '0 16px' }} />
            <LuxStatItem label="Daily avg" value={`£${dailyAvg.toFixed(2)}`} />
            <div style={{ width: 1, background: 'rgba(255,255,255,0.07)', margin: '0 16px' }} />
            <LuxStatItem label="Projected" value={`£${projected.toLocaleString()}`} highlight />
          </div>
        </div>
      )}

      {/* ── 2×2 stats grid ── */}
      <div className="grid grid-cols-2 gap-3">
        <StatPill
          label="MB Profit"
          value={`£${mbProfit.toFixed(2)}`}
          sub="This month"
          color="#C9A96E"
          to="/betting"
        />
        <StatPill
          label="Active Bookies"
          value={activeBookies.length}
          sub={alertBookies.length > 0 ? `${alertBookies.length} alerts` : 'All healthy'}
          color={alertBookies.length > 0 ? '#ef4444' : '#10b981'}
          to="/betting"
        />
        <StatPill
          label="Tasks Today"
          value={`${doneTasks}/${tasks.length}`}
          sub={doneTasks === tasks.length && tasks.length > 0 ? 'All done!' : 'Tap to complete'}
          color={doneTasks === tasks.length && tasks.length > 0 ? '#10b981' : '#C9A96E'}
          to="/betting/tasks"
        />
        <StatPill
          label="Task Value"
          value={`£${taskValue.toFixed(2)}`}
          sub="This month"
          color="#C9A96E"
          to="/betting/tasks"
        />
      </div>

      {/* ── Quick actions ── */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3" style={{ borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : '#f3f4f6'}` }}>
          <p className="text-sm font-semibold" style={{ color: textPrimary }}>Quick access</p>
        </div>
        <QuickRow to="/betting" icon={BookOpen} label="Matched Betting" sub="Bookies · Offers · Calculators" />
        <QuickRow to="/income" icon={TrendingUp} label="Income & Expenses" sub="Track all money flows" />
        <QuickRow to="/goals" icon={Target} label="Q2 Goals" sub="Income · Health · Consistency" />
      </div>

      {/* ── Daily tasks preview ── */}
      {tasks.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <Zap size={15} style={{ color: '#C9A96E' }} />
              <span className="text-sm font-semibold" style={{ color: textPrimary }}>Daily Tasks</span>
            </div>
            <Link to="/betting/tasks" className="text-xs font-semibold" style={{ color: '#C9A96E' }}>
              View all →
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 rounded-full h-2" style={{ background: darkMode ? 'rgba(255,255,255,0.08)' : '#f3f4f6' }}>
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{ width: `${tasks.length > 0 ? (doneTasks / tasks.length) * 100 : 0}%`, background: '#C9A96E' }}
              />
            </div>
            <span className="text-sm font-semibold" style={{ color: textSecondary }}>{doneTasks}/{tasks.length}</span>
          </div>
          {/* Task pills */}
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {tasks.slice(0, 4).map(task => {
              const done = todayDone.includes(task.id)
              return (
                <span
                  key={task.id}
                  className="text-xs font-medium px-2.5 py-1 rounded-full"
                  style={{
                    background: done ? 'rgba(16,185,129,0.1)' : (darkMode ? 'rgba(255,255,255,0.06)' : '#f5f5f7'),
                    color: done ? '#10b981' : textSecondary,
                    textDecoration: done ? 'line-through' : 'none',
                  }}
                >
                  {done ? '✓ ' : ''}{task.name}
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function DailyBreakItem({ label, value }) {
  const { darkMode } = useContext(DarkModeContext)
  return (
    <div className="flex-1 text-center">
      <p className="text-xs" style={{ color: darkMode ? '#6b7280' : '#9ca3af' }}>{label}</p>
      <p className="text-sm font-bold" style={{ color: darkMode ? '#f9fafb' : '#0D1F35' }}>{value}</p>
    </div>
  )
}

function LuxStatItem({ label, value, highlight }) {
  return (
    <div className="flex-1 text-center">
      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</p>
      <p className="text-sm font-bold mt-0.5" style={{ color: highlight ? '#C9A96E' : 'rgba(255,255,255,0.85)' }}>{value}</p>
    </div>
  )
}

function QuickRow({ to, icon: Icon, label, sub }) {
  const { darkMode } = useContext(DarkModeContext)
  return (
    <Link
      to={to}
      className="flex items-center justify-between px-4 py-3.5 transition-colors"
      style={{ borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.04)' : '#f9fafb'}` }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: darkMode ? 'rgba(201,169,110,0.15)' : 'rgba(13,31,53,0.06)' }}
        >
          <Icon size={15} style={{ color: '#C9A96E' }} />
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: darkMode ? '#f9fafb' : '#0D1F35' }}>{label}</p>
          <p className="text-xs" style={{ color: '#9ca3af' }}>{sub}</p>
        </div>
      </div>
      <ChevronRight size={15} style={{ color: '#d1d5db' }} />
    </Link>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning 👋'
  if (h < 17) return 'Good afternoon 👋'
  return 'Good evening 👋'
}
