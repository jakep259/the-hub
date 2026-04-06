import { useState, useEffect, useRef } from 'react'
import { Routes, Route, NavLink, Link, useNavigate } from 'react-router-dom'
import { Plus, X, TrendingUp, ArrowRight, Download, Edit3, Check } from 'lucide-react'
import { getSettings, getList, saveList, genId } from '../lib/store'
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, subMonths, getDaysInMonth, getDate } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ReferenceLine, PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts'

const EXPENSE_CATS = ['Housing', 'Food', 'Transport', 'Subscriptions', 'Fun', 'Other']
const CHART_COLORS = ['#C9A96E', '#0D1F35', '#6b7280', '#10b981', '#f59e0b', '#ef4444']

// ─── Income Entry Modal ───────────────────────────────────────────────────────
function IncomeModal({ entry, streams, onSave, onClose }) {
  const [form, setForm] = useState(entry || {
    id: genId(),
    stream_id: streams[0]?.id || '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
  })

  function save() {
    if (!form.amount || !form.stream_id) return
    onSave({ ...form, amount: Number(form.amount) })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end lg:items-center justify-center pb-20 lg:pb-0 bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-navy-700 rounded-t-2xl lg:rounded-2xl w-full max-w-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg text-navy-700 dark:text-white">{entry ? 'Edit' : 'Log'} Income</h3>
          <button onClick={onClose}><X size={20} className="text-gray-500" /></button>
        </div>
        <div>
          <label className="label">Stream</label>
          <select className="input" value={form.stream_id} onChange={e => setForm({...form, stream_id: e.target.value})}>
            {streams.filter(s => s.id !== 'salary' && s.id !== 'mb').map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Amount (£)</label>
          <input className="input" type="number" placeholder="0.00" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
        </div>
        <div>
          <label className="label">Date</label>
          <input className="input" type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
        </div>
        <div>
          <label className="label">Notes</label>
          <input className="input" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
        </div>
        <div className="flex gap-2">
          <button onClick={save} className="btn-primary flex-1">Save</button>
          <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Income Dashboard ────────────────────────────────────────────────────
function IncomeDashboard() {
  const [settings, setSettings] = useState(getSettings())
  const [entries, setEntries] = useState([])
  const [offers, setOffers] = useState([])
  const [tasks, setTasks] = useState([])
  const [completions, setCompletions] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editEntry, setEditEntry] = useState(null)
  const [editingSalary, setEditingSalary] = useState(false)
  const [salaryDraft, setSalaryDraft] = useState('')
  const salaryInputRef = useRef(null)
  const navigate = useNavigate()

  function load() {
    setSettings(getSettings())
    setEntries(getList('income_entries') || [])
    setOffers(getList('offers') || [])
    setTasks(getList('daily_tasks') || [])
    setCompletions(getList('task_completions') || [])
  }
  useEffect(() => { load() }, [])

  const now = new Date()
  const streams = settings.incomeStreams || []

  // MB profit auto-pull
  const mbProfit = (() => {
    const monthStart = startOfMonth(now)
    const monthEnd = endOfMonth(now)
    return offers
      .filter(o => {
        if (o.actual_profit == null || o.actual_profit === '') return false
        try { return isWithinInterval(parseISO(o.date), { start: monthStart, end: monthEnd }) } catch { return false }
      })
      .reduce((s, o) => s + Number(o.actual_profit), 0)
  })()

  // Task value
  const taskValue = (() => {
    const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')
    const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd')
    return completions
      .filter(c => c.date >= monthStart && c.date <= monthEnd)
      .reduce((s, c) => {
        const task = tasks.find(t => t.id === c.task_id)
        return s + (task?.value ? Number(task.value) : 0)
      }, 0)
  })()

  // Manual income entries for this month
  const monthEntries = entries.filter(e => {
    try { return isWithinInterval(parseISO(e.date), { start: startOfMonth(now), end: endOfMonth(now) }) } catch { return false }
  })

  const manualByStream = {}
  for (const e of monthEntries) {
    manualByStream[e.stream_id] = (manualByStream[e.stream_id] || 0) + Number(e.amount)
  }

  const streamTotals = streams.map(s => ({
    ...s,
    total: s.id === 'salary' ? Number(settings.salary || 0)
         : s.id === 'mb' ? mbProfit
         : (manualByStream[s.id] || 0),
  }))

  const totalIncome = streamTotals.reduce((s, st) => s + st.total, 0)

  // Targets
  const TARGETS = [
    { month: 7, amount: 2500, label: 'July' },
    { month: 9, amount: 3000, label: 'September' },
    { month: 12, amount: 3500, label: 'December' },
  ]
  const nextTarget = TARGETS.find(t => totalIncome < t.amount) || TARGETS[TARGETS.length - 1]
  const progress = Math.min(100, (totalIncome / nextTarget.amount) * 100)

  // Last month comparison
  const lastMonthStart = startOfMonth(subMonths(now, 1))
  const lastMonthEnd = endOfMonth(subMonths(now, 1))
  const lastMonthEntries = entries.filter(e => {
    try { return isWithinInterval(parseISO(e.date), { start: lastMonthStart, end: lastMonthEnd }) } catch { return false }
  })
  const lastMonthOffers = offers.filter(o => {
    if (o.actual_profit == null || o.actual_profit === '') return false
    try { return isWithinInterval(parseISO(o.date), { start: lastMonthStart, end: lastMonthEnd }) } catch { return false }
  })
  const lastMonthMB = lastMonthOffers.reduce((s, o) => s + Number(o.actual_profit), 0)
  const lastMonthTotal = lastMonthEntries.reduce((s, e) => s + Number(e.amount), 0) + Number(settings.salary || 0) + lastMonthMB
  const changePct = lastMonthTotal > 0 ? Math.round(((totalIncome - lastMonthTotal) / lastMonthTotal) * 100) : null

  // Projected month-end — salary is fixed, only project variable income forward
  const dayOfMonth = getDate(now)
  const daysInMonth = getDaysInMonth(now)
  const salaryFixed = streamTotals.find(s => s.id === 'salary')?.total || 0
  const varIncome = totalIncome - salaryFixed
  const projected = Math.round((salaryFixed + (dayOfMonth > 0 ? (varIncome / dayOfMonth) * daysInMonth : 0)) * 100) / 100

  // Monthly bar chart — April 2026 through December 2026
  const monthlyChartData = Array.from({ length: 9 }, (_, i) => {
    const d = new Date(2026, 3 + i, 1) // Apr=3, May=4, ... Dec=11
    const start = startOfMonth(d)
    const end = endOfMonth(d)
    const isFuture = start > endOfMonth(now)
    if (isFuture) {
      const projVar = dayOfMonth > 0 ? (varIncome / dayOfMonth) * getDaysInMonth(d) : 0
      return { month: format(d, 'MMM'), total: Math.round((salaryFixed + projVar) * 100) / 100, projected: true }
    }
    const mbP = offers
      .filter(o => { if (o.actual_profit == null || o.actual_profit === '') return false; try { return isWithinInterval(parseISO(o.date), { start, end }) } catch { return false } })
      .reduce((s, o) => s + Number(o.actual_profit), 0)
    const manual = entries
      .filter(e => { try { return isWithinInterval(parseISO(e.date), { start, end }) } catch { return false } })
      .reduce((s, e) => s + Number(e.amount), 0)
    return { month: format(d, 'MMM'), total: Math.round((salaryFixed + mbP + manual) * 100) / 100, projected: false }
  })

  function startEditSalary() {
    setSalaryDraft(settings.salary || '')
    setEditingSalary(true)
    setTimeout(() => salaryInputRef.current?.focus(), 50)
  }

  function saveSalary() {
    const val = Number(salaryDraft) || 0
    const next = { ...getSettings(), salary: val }
    saveSettings(next)
    setSettings(next)
    setEditingSalary(false)
  }

  function saveEntry(e) {
    const existing = getList('income_entries') || []
    const idx = existing.findIndex(x => x.id === e.id)
    const next = idx >= 0 ? existing.map(x => x.id === e.id ? e : x) : [...existing, e]
    saveList('income_entries', next)
    setEntries(next)
  }

  function deleteEntry(id) {
    const next = (getList('income_entries') || []).filter(e => e.id !== id)
    saveList('income_entries', next)
    setEntries(next)
  }

  const manualStreams = streams.filter(s => s.id !== 'salary' && s.id !== 'mb')

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="card p-5 bg-gradient-to-br from-navy-700 to-navy-800 border-0">
        <p className="text-gold-400/80 text-sm font-semibold uppercase tracking-wide mb-0.5">{format(now, 'MMMM yyyy')}</p>
        <p className="text-4xl font-bold text-white mb-1">
          £{totalIncome.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <div className="flex items-center gap-3 mb-3">
          {changePct !== null && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${changePct >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
              {changePct >= 0 ? '▲' : '▼'} {Math.abs(changePct)}% vs last month
            </span>
          )}
          <span className="text-gray-400 text-xs">Projected: £{projected.toLocaleString()}</span>
        </div>
        {/* Progress bar */}
        <p className="text-gray-400 text-xs mb-1">Target: £{nextTarget.amount.toLocaleString()} ({nextTarget.label})</p>
        <div className="w-full bg-navy-600 rounded-full h-2 mb-1">
          <div className="bg-gold-400 h-2 rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex justify-between text-xs text-gray-400">
          <span>{Math.round(progress)}% to target</span>
          <span>£{Math.max(0, nextTarget.amount - totalIncome).toFixed(0)} to go</span>
        </div>
      </div>

      {/* Stream breakdown */}
      <div className="card divide-y divide-gray-100 dark:divide-navy-600 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="font-semibold text-sm text-gray-700 dark:text-white">Income Streams</span>
          <button onClick={() => { setEditEntry(null); setShowModal(true) }} className="text-sm text-gold-500 font-semibold flex items-center gap-1">
            <Plus size={14} /> Log income
          </button>
        </div>
        {streamTotals.map(s => (
          <div key={s.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{s.label}</p>
              {s.id === 'mb' && <p className="text-xs text-gray-400">Auto-pulled from MB tracker</p>}
              {s.id === 'salary' && <p className="text-xs text-gray-400">Fixed monthly salary · tap to edit</p>}
            </div>
            {s.id === 'salary' ? (
              editingSalary ? (
                <div className="flex items-center gap-1">
                  <span className="text-sm text-gray-400">£</span>
                  <input
                    ref={salaryInputRef}
                    className="input w-24 text-right py-1 text-sm"
                    type="text"
                    inputMode="decimal"
                    value={salaryDraft}
                    onChange={e => setSalaryDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveSalary() }}
                  />
                  <button onClick={saveSalary} className="p-1 text-emerald-500"><Check size={16} /></button>
                </div>
              ) : (
                <button onClick={startEditSalary} className="flex items-center gap-1.5 group">
                  <span className="font-bold text-base text-emerald-600">£{s.total.toFixed(2)}</span>
                  <Edit3 size={13} className="text-gray-300 group-hover:text-gray-500" />
                </button>
              )
            ) : (
              <p className={`font-bold text-base ${s.total >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                £{s.total.toFixed(2)}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Monthly chart */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm text-gray-700 dark:text-white">2026 Income</h3>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: '#0D1F35' }} />Actual</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: 'rgba(13,31,53,0.25)' }} />Projected</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={monthlyChartData}>
            <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v, _, props) => [`£${Number(v).toFixed(0)}${props.payload.projected ? ' (est.)' : ''}`, 'Income']} />
            <ReferenceLine y={2500} stroke="#C9A96E" strokeDasharray="4 4" />
            <ReferenceLine y={3000} stroke="#10b981" strokeDasharray="4 4" />
            <Bar dataKey="total" radius={[4, 4, 0, 0]}>
              {monthlyChartData.map((entry, i) => (
                <Cell key={i} fill={entry.projected ? 'rgba(13,31,53,0.25)' : '#0D1F35'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* YTD & best month */}
      <div className="grid grid-cols-2 gap-2">
        <div className="card p-3 text-center">
          <p className="text-xl font-bold text-navy-700 dark:text-white">
            £{monthlyChartData.filter(m => !m.projected).reduce((s, m) => s + m.total, 0).toLocaleString()}
          </p>
          <p className="text-xs text-gray-500">Apr 2026 to date</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xl font-bold text-gold-500">
            £{Math.max(...monthlyChartData.filter(m => !m.projected).map(m => m.total), 0).toLocaleString()}
          </p>
          <p className="text-xs text-gray-500">Best month</p>
        </div>
      </div>

      {/* Recent manual entries */}
      {monthEntries.length > 0 && (
        <div className="card p-4">
          <p className="font-semibold text-sm text-gray-700 dark:text-white mb-2">This month — manual entries</p>
          <div className="space-y-1">
            {monthEntries.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8).map(e => (
              <div key={e.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-100 dark:border-navy-600 last:border-0">
                <div>
                  <span className="font-medium text-gray-800 dark:text-gray-200">
                    {streams.find(s => s.id === e.stream_id)?.label || e.stream_id}
                  </span>
                  {e.notes && <span className="text-gray-400 text-xs ml-1">· {e.notes}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-600 font-semibold">£{Number(e.amount).toFixed(2)}</span>
                  <button onClick={() => deleteEntry(e.id)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expenses link */}
      <Link to="expenses" className="card p-4 flex items-center justify-between hover:shadow-md transition-all">
        <div>
          <p className="font-semibold text-navy-700 dark:text-white">Expenses</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Track spending by category</p>
        </div>
        <ArrowRight size={18} className="text-gray-400" />
      </Link>

      {showModal && (
        <IncomeModal
          entry={editEntry}
          streams={manualStreams}
          onSave={saveEntry}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}

// ─── Expenses Page ────────────────────────────────────────────────────────────
function ExpensesPage() {
  const navigate = useNavigate()
  const [expenses, setExpenses] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editExp, setEditExp] = useState(null)

  function load() { setExpenses(getList('expenses') || []) }
  useEffect(() => { load() }, [])

  function saveExp(e) {
    const existing = getList('expenses') || []
    const idx = existing.findIndex(x => x.id === e.id)
    const next = idx >= 0 ? existing.map(x => x.id === e.id ? e : x) : [...existing, e]
    saveList('expenses', next)
    setExpenses(next)
  }

  function deleteExp(id) {
    const next = (getList('expenses') || []).filter(e => e.id !== id)
    saveList('expenses', next)
    setExpenses(next)
  }

  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)
  const thisMonth = expenses.filter(e => {
    try { return isWithinInterval(parseISO(e.date), { start: monthStart, end: monthEnd }) } catch { return false }
  })

  const total = thisMonth.reduce((s, e) => s + Number(e.amount), 0)

  const byCat = EXPENSE_CATS.map(cat => ({
    name: cat,
    value: thisMonth.filter(e => e.category === cat).reduce((s, e) => s + Number(e.amount), 0),
  })).filter(c => c.value > 0)

  // Monthly history
  const monthlyHistory = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(now, 5 - i)
    const start = startOfMonth(d)
    const end = endOfMonth(d)
    const total = expenses
      .filter(e => { try { return isWithinInterval(parseISO(e.date), { start, end }) } catch { return false } })
      .reduce((s, e) => s + Number(e.amount), 0)
    return { month: format(d, 'MMM'), total: Math.round(total * 100) / 100 }
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate('/income')} className="text-gray-500 p-1">← Back</button>
        <h2 className="section-title">Expenses</h2>
        <div className="flex-1" />
        <button onClick={() => { setEditExp(null); setShowModal(true) }} className="btn-secondary text-sm flex items-center gap-1">
          <Plus size={15} /> Add
        </button>
      </div>

      {/* Month total */}
      <div className="card p-4 bg-gradient-to-br from-navy-700 to-navy-800 border-0">
        <p className="text-gold-400/80 text-sm font-semibold uppercase tracking-wide mb-0.5">{format(now, 'MMMM')} Expenses</p>
        <p className="text-3xl font-bold text-white">£{total.toFixed(2)}</p>
      </div>

      {/* Category chart */}
      {byCat.length > 0 && (
        <div className="card p-4">
          <h3 className="font-semibold text-sm text-gray-700 dark:text-white mb-3">By Category</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={byCat} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                {byCat.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => [`£${v.toFixed(2)}`, '']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Monthly history */}
      <div className="card p-4">
        <h3 className="font-semibold text-sm text-gray-700 dark:text-white mb-3">Monthly Expenses</h3>
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={monthlyHistory}>
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v) => [`£${v}`, 'Total']} />
            <Bar dataKey="total" fill="#0D1F35" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Expense list */}
      <div className="space-y-2">
        {thisMonth.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-gray-400 text-sm">No expenses logged this month</p>
          </div>
        ) : (
          thisMonth.sort((a, b) => b.date.localeCompare(a.date)).map(e => (
            <div key={e.id} className="card p-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm text-gray-900 dark:text-white">{e.notes || e.category}</p>
                <p className="text-xs text-gray-500">{e.category} · {e.date}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-red-500">-£{Number(e.amount).toFixed(2)}</span>
                <button onClick={() => deleteExp(e.id)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <ExpenseModal entry={editExp} onSave={saveExp} onClose={() => setShowModal(false)} />
      )}
    </div>
  )
}

function ExpenseModal({ entry, onSave, onClose }) {
  const [form, setForm] = useState(entry || {
    id: genId(),
    amount: '',
    category: 'Food',
    date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
  })

  function save() {
    if (!form.amount) return
    onSave({ ...form, amount: Number(form.amount) })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end lg:items-center justify-center pb-20 lg:pb-0 bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-navy-700 rounded-t-2xl lg:rounded-2xl w-full max-w-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-lg text-navy-700 dark:text-white">Add Expense</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Amount (£)</label>
            <input className="input" type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
              {EXPENSE_CATS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Date</label>
            <input className="input" type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={save} className="btn-primary flex-1">Save</button>
          <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ─── Income page wrapper with routing ────────────────────────────────────────
export default function Income() {
  return (
    <div className="max-w-2xl lg:max-w-4xl mx-auto w-full px-4 py-4 pb-24 lg:pb-4">
      <Routes>
        <Route index element={<IncomeDashboard />} />
        <Route path="expenses" element={<ExpensesPage />} />
      </Routes>
    </div>
  )
}
