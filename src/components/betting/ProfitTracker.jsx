import { useState, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, eachDayOfInterval, subMonths } from 'date-fns'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Cell
} from 'recharts'
import { Download, Plus, X } from 'lucide-react'
import { getList, saveList, genId } from '../../lib/store'

function exportCSV(data, filename) {
  if (!data.length) return
  const headers = Object.keys(data[0]).join(',')
  const rows = data.map(r => Object.values(r).join(',')).join('\n')
  const blob = new Blob([headers + '\n' + rows], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function LumpSumModal({ onClose, onSave }) {
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [notes, setNotes] = useState('')

  function save() {
    if (!amount) return
    onSave({ amount: Number(amount), date, notes })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end lg:items-center justify-center pb-20 lg:pb-0 bg-black/60" onClick={onClose}>
      <div
        className="rounded-t-2xl lg:rounded-2xl w-full max-w-md p-5 space-y-3"
        style={{ background: '#0D1F35' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base text-white">Add MB Lump Sum</h3>
          <button onClick={onClose}><X size={20} style={{ color: '#9ca3af' }} /></button>
        </div>
        <p className="text-xs" style={{ color: '#9ca3af' }}>Add historical MB profit that happened before you started tracking.</p>
        <div>
          <label className="label">Amount (£)</label>
          <input className="input" type="number" inputMode="decimal" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="label">Date</label>
          <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label">Notes (optional)</label>
          <input className="input" placeholder="e.g. April pre-tracking total" value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <button onClick={save} className="btn-primary flex-1">Add Entry</button>
          <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function ProfitTracker() {
  const [offers, setOffers] = useState([])
  const [tasks, setTasks] = useState([])
  const [completions, setCompletions] = useState([])
  const [period, setPeriod] = useState('month') // month | week | all
  const [showLumpSum, setShowLumpSum] = useState(false)

  function load() {
    setOffers(getList('offers') || [])
    setTasks(getList('daily_tasks') || [])
    setCompletions(getList('task_completions') || [])
  }

  useEffect(() => { load() }, [])

  function addLumpSum({ amount, date, notes }) {
    const entry = {
      id: genId(),
      bookie_id: '',
      offer_type: 'Manual Entry',
      status: 'Completed',
      actual_profit: amount,
      expected_profit: amount,
      date,
      notes: notes || 'Manual lump sum entry',
    }
    const existing = getList('offers') || []
    saveList('offers', [...existing, entry])
    load()
  }

  const now = new Date()

  // Build monthly profit data for the last 12 months
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(now, 11 - i)
    const start = startOfMonth(d)
    const end = endOfMonth(d)
    const monthOffers = offers.filter(o => {
      try { return isWithinInterval(parseISO(o.date), { start, end }) } catch { return false }
    })
    const mbProfit = monthOffers
      .filter(o => o.actual_profit != null && o.actual_profit !== '')
      .reduce((s, o) => s + Number(o.actual_profit), 0)

    // Task value
    const taskDays = completions.filter(c => {
      return c.date >= format(start, 'yyyy-MM-dd') && c.date <= format(end, 'yyyy-MM-dd')
    })
    const taskValue = taskDays.reduce((s, c) => {
      const task = tasks.find(t => t.id === c.task_id)
      return s + (task?.value ? Number(task.value) : 0)
    }, 0)

    return {
      month: format(d, 'MMM'),
      MB: Math.round(mbProfit * 100) / 100,
      Tasks: Math.round(taskValue * 100) / 100,
      Total: Math.round((mbProfit + taskValue) * 100) / 100,
    }
  })

  const thisMonth = monthlyData[monthlyData.length - 1]
  const lastMonth = monthlyData[monthlyData.length - 2]

  const bestMonth = monthlyData.reduce((best, m) => m.Total > best.Total ? m : best, monthlyData[0])

  // Daily P&L for current month
  const currentMonthStart = startOfMonth(now)
  const currentMonthEnd = endOfMonth(now)
  const daysInMonth = eachDayOfInterval({ start: currentMonthStart, end: now })

  let runningTotal = 0
  const dailyData = daysInMonth.map(day => {
    const d = format(day, 'yyyy-MM-dd')
    const dayOffers = offers.filter(o => o.date === d && o.actual_profit != null && o.actual_profit !== '')
    const dayProfit = dayOffers.reduce((s, o) => s + Number(o.actual_profit), 0)
    const dayTasks = completions.filter(c => c.date === d).reduce((s, c) => {
      const task = tasks.find(t => t.id === c.task_id)
      return s + (task?.value ? Number(task.value) : 0)
    }, 0)
    const total = dayProfit + dayTasks
    runningTotal += total
    return { date: format(day, 'd'), daily: Math.round(total * 100) / 100, running: Math.round(runningTotal * 100) / 100 }
  })

  // Per-bookie stats
  const bookies = getList('bookies') || []
  const bookieProfit = bookies.map(b => {
    const bOffers = offers.filter(o => o.bookie_id === b.id && o.actual_profit != null && o.actual_profit !== '')
    return {
      name: b.name,
      profit: Math.round(bOffers.reduce((s, o) => s + Number(o.actual_profit), 0) * 100) / 100,
    }
  }).filter(b => b.profit !== 0).sort((a, b) => b.profit - a.profit)

  const changeVsLastMonth = lastMonth.Total > 0
    ? Math.round(((thisMonth.Total - lastMonth.Total) / lastMonth.Total) * 100)
    : null

  return (
    <div className="space-y-4">
      {showLumpSum && <LumpSumModal onClose={() => setShowLumpSum(false)} onSave={addLumpSum} />}
      <div className="flex items-center justify-between">
        <h2 className="section-title">Profit Tracker</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowLumpSum(true)} className="btn-ghost text-xs flex items-center gap-1" style={{ color: '#C9A96E' }}>
            <Plus size={13} /> Lump Sum
          </button>
          <button
          onClick={() => exportCSV(offers.map(o => ({
            date: o.date,
            bookie: bookies.find(b => b.id === o.bookie_id)?.name || o.bookie_id,
            type: o.offer_type,
            expected: o.expected_profit,
            actual: o.actual_profit,
            status: o.status,
          })), 'mb-profit.csv')}
          className="btn-ghost text-xs flex items-center gap-1"
          >
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2">
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-navy-700 dark:text-white">£{thisMonth.Total.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-0.5">This month total</p>
          {changeVsLastMonth !== null && (
            <p className={`text-xs font-semibold mt-1 ${changeVsLastMonth >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {changeVsLastMonth >= 0 ? '▲' : '▼'} {Math.abs(changeVsLastMonth)}% vs last month
            </p>
          )}
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-gold-500">£{bestMonth.Total.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-0.5">Best month ({bestMonth.month})</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-navy-700 dark:text-white">£{thisMonth.MB.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-0.5">MB profit</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-navy-700 dark:text-white">£{thisMonth.Tasks.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-0.5">Tasks value</p>
        </div>
      </div>

      {/* Running total chart */}
      {dailyData.length > 0 && (
        <div className="card p-4">
          <h3 className="font-semibold text-sm text-gray-700 dark:text-white mb-3">Running Total — {format(now, 'MMMM')}</h3>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => [`£${v}`, '']} />
              <ReferenceLine y={0} stroke="#ccc" />
              <Line type="monotone" dataKey="running" stroke="#C9A96E" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Monthly bar chart */}
      <div className="card p-4">
        <h3 className="font-semibold text-sm text-gray-700 dark:text-white mb-3">Monthly Profit</h3>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={monthlyData}>
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v) => [`£${v}`, '']} />
            <Bar dataKey="Total" radius={[4, 4, 0, 0]}>
              {monthlyData.map((entry, i) => (
                <Cell key={i} fill={entry.Total >= 0 ? '#C9A96E' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Per-bookie */}
      {bookieProfit.length > 0 && (
        <div className="card p-4">
          <h3 className="font-semibold text-sm text-gray-700 dark:text-white mb-3">Profit by Bookie (all time)</h3>
          <div className="space-y-2">
            {bookieProfit.slice(0, 8).map(b => (
              <div key={b.name} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 dark:text-gray-300">{b.name}</span>
                <span className={`font-bold ${b.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  £{b.profit.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
