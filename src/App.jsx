import { useState, useEffect, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, TrendingUp, Target, Settings, BookOpen } from 'lucide-react'
import { getSettings, saveSettings, initBookies, registerSyncCallback } from './lib/store'
import { initSync, schedulePush } from './lib/sync'

import Dashboard from './pages/Dashboard'
import MatchedBetting from './pages/MatchedBetting'
import Income from './pages/Income'
import Goals from './pages/Goals'
import SettingsPage from './pages/SettingsPage'

export const DarkModeContext = createContext({ darkMode: false, setDarkMode: () => {} })

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/betting', label: 'Betting', icon: BookOpen },
  { to: '/income', label: 'Income', icon: TrendingUp },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/settings', label: 'Settings', icon: Settings },
]

function applyDark(on) {
  if (on) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

function AppShell() {
  const { darkMode, setDarkMode } = useContext(DarkModeContext)

  const navLinkClass = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
      isActive
        ? 'bg-gold-400/20 text-gold-400 font-semibold'
        : 'text-gray-400 hover:text-white hover:bg-white/10'
    }`

  const mobileNavClass = ({ isActive }) =>
    `flex flex-col items-center gap-0.5 py-2 px-1 transition-all flex-1 min-w-0 ${
      isActive ? 'text-gold-400' : 'text-gray-400'
    }`

  return (
    <div className="flex min-h-screen">
      {/* ── Desktop Sidebar ── */}
      <aside
        className="hidden lg:flex flex-col w-60 min-h-screen fixed left-0 top-0 z-40"
        style={{ background: '#0D1F35' }}
      >
        <div className="px-5 py-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#C9A96E' }}>
              <span className="font-bold text-sm" style={{ color: '#0D1F35' }}>H</span>
            </div>
            <div>
              <div className="text-white font-bold text-base leading-none">The Hub</div>
              <div className="text-xs mt-0.5" style={{ color: 'rgba(201,169,110,0.6)' }}>Your command centre</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map(({ to, label, icon: Icon, exact }) => (
            <NavLink key={to} to={to} end={exact} className={navLinkClass}>
              <Icon size={17} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>v1.0.0</p>
        </div>
      </aside>

      {/* ── Mobile Top Bar ── */}
      <div
        className="lg:hidden fixed top-0 left-0 right-0 z-50 px-4 py-3.5 flex items-center justify-between"
        style={{ background: '#0D1F35' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#C9A96E' }}>
            <span className="font-bold text-xs" style={{ color: '#0D1F35' }}>H</span>
          </div>
          <span className="text-white font-bold text-sm">The Hub</span>
        </div>
      </div>

      {/* ── Main Content ── */}
      <main
        className="flex-1 lg:ml-60 pt-14 lg:pt-0 pb-24 lg:pb-0 min-h-screen"
        style={{ background: darkMode ? '#050D1A' : '#f5f5f7' }}
      >
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/betting/*" element={<MatchedBetting />} />
          <Route path="/income/*" element={<Income />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>

      {/* ── Mobile Bottom Nav ── */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 px-1 pb-1"
        style={{
          background: darkMode ? '#0D1F35' : '#fff',
          borderTop: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        }}
      >
        <div className="flex items-center justify-around py-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon, exact }) => (
            <NavLink key={to} to={to} end={exact} className={mobileNavClass}>
              <Icon size={22} strokeWidth={1.8} />
              <span className="text-xs font-medium">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

export default function App() {
  const [darkMode, setDarkMode] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem('hub_settings') || '{}')
      return s.darkMode || false
    } catch { return false }
  })

  useEffect(() => {
    applyDark(darkMode)
    initBookies()
    registerSyncCallback(schedulePush)
    initSync()
  }, [])

  function handleSetDarkMode(val) {
    setDarkMode(val)
    applyDark(val)
    const settings = JSON.parse(localStorage.getItem('hub_settings') || '{}')
    localStorage.setItem('hub_settings', JSON.stringify({ ...settings, darkMode: val }))
  }

  return (
    <DarkModeContext.Provider value={{ darkMode, setDarkMode: handleSetDarkMode }}>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </DarkModeContext.Provider>
  )
}
