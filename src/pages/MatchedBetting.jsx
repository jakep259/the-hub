import { useContext } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import { BookOpen, Calculator, Gift, CheckSquare, TrendingUp, Layers } from 'lucide-react'
import BookieTracker from '../components/betting/BookieTracker'
import Calculators from '../components/betting/Calculators'
import OfferTracker from '../components/betting/OfferTracker'
import DailyTasks from '../components/betting/DailyTasks'
import ProfitTracker from '../components/betting/ProfitTracker'
import BetTracker from '../components/betting/BetTracker'
import { DarkModeContext } from '../App'

const TABS = [
  { to: '/betting', label: 'Bookies', icon: BookOpen, exact: true },
  { to: '/betting/calculators', label: 'Calcs', icon: Calculator },
  { to: '/betting/bets', label: 'Bets', icon: Layers },
  { to: '/betting/offers', label: 'Offers', icon: Gift },
  { to: '/betting/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/betting/profit', label: 'Profit', icon: TrendingUp },
]

export default function MatchedBetting() {
  const { darkMode } = useContext(DarkModeContext)

  const tabClass = ({ isActive }) => [
    'flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap px-1',
    isActive
      ? 'border-gold-400 text-gold-500'
      : 'border-transparent hover:border-gray-300',
  ].join(' ')

  const tabStyle = (isActive) => ({
    color: isActive ? '#C9A96E' : (darkMode ? '#6b7280' : '#9ca3af'),
    borderColor: isActive ? '#C9A96E' : 'transparent',
  })

  return (
    <div className="flex flex-col">
      {/* Sub-nav */}
      <div
        className="sticky top-14 lg:top-0 z-30"
        style={{
          background: darkMode ? '#0D1F35' : '#fff',
          borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
        }}
      >
        <div className="max-w-lg lg:max-w-4xl mx-auto">
          <div className="flex overflow-x-auto scrollbar-hide">
            {TABS.map(({ to, label, icon: Icon, exact }) => (
              <NavLink key={to} to={to} end={exact}>
                {({ isActive }) => (
                  <div
                    className="flex flex-col items-center gap-0.5 py-2.5 text-xs font-semibold border-b-2 transition-all px-3 whitespace-nowrap"
                    style={tabStyle(isActive)}
                  >
                    <Icon size={16} />
                    <span>{label}</span>
                  </div>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-lg lg:max-w-4xl mx-auto w-full px-4 py-4 pb-24 lg:pb-6">
        <Routes>
          <Route index element={<BookieTracker />} />
          <Route path="calculators/*" element={<Calculators />} />
          <Route path="bets" element={<BetTracker />} />
          <Route path="offers" element={<OfferTracker />} />
          <Route path="tasks" element={<DailyTasks />} />
          <Route path="profit" element={<ProfitTracker />} />
        </Routes>
      </div>
    </div>
  )
}
