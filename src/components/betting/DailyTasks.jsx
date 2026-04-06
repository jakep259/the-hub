import { useState, useEffect } from 'react'
import { Plus, X, CheckCircle, Circle, Flame, Edit3 } from 'lucide-react'
import { getList, saveList, genId } from '../../lib/store'
import { format, parseISO, differenceInDays } from 'date-fns'

const TODAY = () => format(new Date(), 'yyyy-MM-dd')

function getStreak(taskId, completions) {
  let streak = 0
  let date = new Date()
  while (true) {
    const d = format(date, 'yyyy-MM-dd')
    if (completions.some(c => c.task_id === taskId && c.date === d)) {
      streak++
      date = new Date(date.getTime() - 86400000)
    } else {
      break
    }
  }
  return streak
}

function getMonthlyValue(taskId, tasks, completions) {
  const task = tasks.find(t => t.id === taskId)
  if (!task || !task.value) return 0
  const now = new Date()
  const monthStart = format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd')
  const monthEnd = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), 'yyyy-MM-dd')
  const count = completions.filter(c => c.task_id === taskId && c.date >= monthStart && c.date <= monthEnd).length
  return count * Number(task.value)
}

function TaskRow({ task, done, streak, monthlyValue, onToggle, onEdit, onDelete }) {
  return (
    <div className={`card flex items-center gap-3 p-3.5 transition-all ${done ? 'opacity-80' : ''}`}>
      <button onClick={onToggle} className="flex-shrink-0 transition-all active:scale-90">
        {done
          ? <CheckCircle size={26} className="text-emerald-500" />
          : <Circle size={26} className="text-gray-300 dark:text-gray-500" />
        }
      </button>
      <div className="flex-1 min-w-0">
        <p className={`font-semibold text-sm ${done ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
          {task.name}
        </p>
        <div className="flex items-center gap-3 mt-0.5">
          {task.value && (
            <span className="text-xs text-gold-500 font-semibold">£{task.value}/day</span>
          )}
          {streak > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-orange-500 font-semibold">
              <Flame size={11} /> {streak}
            </span>
          )}
          {monthlyValue > 0 && (
            <span className="text-xs text-gray-400">£{monthlyValue.toFixed(2)} this month</span>
          )}
        </div>
      </div>
      <div className="flex gap-1">
        <button onClick={onEdit} className="text-gray-400 hover:text-gray-600 p-1"><Edit3 size={14} /></button>
        <button onClick={onDelete} className="text-gray-300 hover:text-red-400 p-1"><X size={14} /></button>
      </div>
    </div>
  )
}

function AddTaskModal({ editTask, onSave, onClose }) {
  const [form, setForm] = useState(editTask || { name: '', value: '' })

  return (
    <div className="fixed inset-0 z-[60] flex items-end lg:items-center justify-center pb-20 lg:pb-0 bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-navy-700 rounded-t-2xl lg:rounded-2xl w-full max-w-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-lg text-navy-700 dark:text-white">{editTask ? 'Edit Task' : 'Add Task'}</h3>
        <div>
          <label className="label">Task Name</label>
          <input className="input" placeholder="e.g. Daily spin on Sky Bet" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
        </div>
        <div>
          <label className="label">Daily Value (£) — optional</label>
          <input className="input" type="number" placeholder="0.50" value={form.value} onChange={e => setForm({...form, value: e.target.value})} />
        </div>
        <div className="flex gap-2">
          <button onClick={() => { if (form.name.trim()) { onSave(form); onClose() } }} className="btn-primary flex-1">
            {editTask ? 'Save' : 'Add Task'}
          </button>
          <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function DailyTasks() {
  const [tasks, setTasks] = useState([])
  const [completions, setCompletions] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [editTask, setEditTask] = useState(null)
  const today = TODAY()

  function load() {
    setTasks(getList('daily_tasks') || [])
    setCompletions(getList('task_completions') || [])
  }
  useEffect(() => { load() }, [])

  function toggle(taskId) {
    const comps = getList('task_completions') || []
    const existing = comps.findIndex(c => c.task_id === taskId && c.date === today)
    let next
    if (existing >= 0) {
      next = comps.filter((_, i) => i !== existing)
    } else {
      next = [...comps, { id: genId(), task_id: taskId, date: today }]
    }
    saveList('task_completions', next)
    setCompletions(next)
  }

  function addTask(form) {
    const list = getList('daily_tasks') || []
    const existing = list.findIndex(t => t.id === form.id)
    let next
    if (existing >= 0) {
      next = list.map(t => t.id === form.id ? { ...t, ...form } : t)
    } else {
      next = [...list, { id: genId(), name: form.name, value: form.value }]
    }
    saveList('daily_tasks', next)
    setTasks(next)
  }

  function deleteTask(id) {
    const next = (getList('daily_tasks') || []).filter(t => t.id !== id)
    saveList('daily_tasks', next)
    setTasks(next)
  }

  const todayDone = completions.filter(c => c.date === today).map(c => c.task_id)
  const totalTasks = tasks.length
  const doneTasks = tasks.filter(t => todayDone.includes(t.id)).length

  const totalMonthlyValue = tasks.reduce((s, t) => s + getMonthlyValue(t.id, tasks, completions), 0)

  function markAllDone() {
    const comps = getList('task_completions') || []
    const alreadyDone = comps.filter(c => c.date === today).map(c => c.task_id)
    const newComps = tasks
      .filter(t => !alreadyDone.includes(t.id))
      .map(t => ({ id: genId(), task_id: t.id, date: today }))
    const next = [...comps, ...newComps]
    saveList('task_completions', next)
    setCompletions(next)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-title">Daily Tasks</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {format(new Date(), 'EEEE, d MMMM')} · Resets at midnight
          </p>
        </div>
        <button onClick={() => { setEditTask(null); setShowAdd(true) }} className="btn-secondary text-sm flex items-center gap-1">
          <Plus size={15} /> Add
        </button>
      </div>

      {/* Progress */}
      {totalTasks > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              {doneTasks}/{totalTasks} complete
            </span>
            {totalMonthlyValue > 0 && (
              <span className="text-xs text-gold-500 font-semibold">£{totalMonthlyValue.toFixed(2)} this month</span>
            )}
          </div>
          <div className="w-full bg-gray-100 dark:bg-navy-600 rounded-full h-2.5">
            <div
              className="bg-gold-400 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0}%` }}
            />
          </div>
          {doneTasks === totalTasks && totalTasks > 0 && (
            <p className="text-emerald-600 font-semibold text-sm mt-2 text-center">🎉 All done for today!</p>
          )}
        </div>
      )}

      {/* Task list */}
      {tasks.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-gray-400 text-sm mb-3">No tasks yet — add your daily spins and recurring tasks</p>
          <button onClick={() => setShowAdd(true)} className="btn-primary text-sm">Add your first task</button>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              done={todayDone.includes(task.id)}
              streak={getStreak(task.id, completions)}
              monthlyValue={getMonthlyValue(task.id, tasks, completions)}
              onToggle={() => toggle(task.id)}
              onEdit={() => { setEditTask(task); setShowAdd(true) }}
              onDelete={() => deleteTask(task.id)}
            />
          ))}
        </div>
      )}

      {/* Mark all done */}
      {tasks.length > 0 && doneTasks < totalTasks && (
        <button onClick={markAllDone} className="btn-ghost w-full text-sm">Mark all done</button>
      )}

      {showAdd && (
        <AddTaskModal
          editTask={editTask}
          onSave={addTask}
          onClose={() => { setShowAdd(false); setEditTask(null) }}
        />
      )}
    </div>
  )
}
