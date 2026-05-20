import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, NavLink, Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, ClipboardList, BookOpen, Bell, Plus, BarChart3, Settings, AlertTriangle } from 'lucide-react'
import { useStore } from './store/useStore'
import { ToastContainer } from './components/ui/Toast'
import { Dashboard } from './pages/Dashboard'
import { NormBuilder } from './pages/NormBuilder'
import { NormsList } from './pages/NormsList'
import { NormCard } from './pages/NormCard'
import { References } from './pages/References'

const SIDEBAR_ITEMS = [
  { to: '/',            icon: LayoutDashboard, label: 'Дашборд',     exact: true  },
  { to: '/norms',       icon: ClipboardList,   label: 'Нормы',        exact: false },
  { to: '/references',  icon: BookOpen,        label: 'Справочники',  exact: false },
]

function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-full w-[60px] bg-[#1A2048] flex flex-col items-center py-4 z-40">
      <div className="w-9 h-9 rounded-xl bg-[#4F73F7] flex items-center justify-center mb-8 shrink-0">
        <BarChart3 size={18} className="text-white" />
      </div>
      <nav className="flex flex-col items-center gap-1 flex-1">
        {SIDEBAR_ITEMS.map(({ to, icon: Icon, label, exact }) => (
          <NavLink key={to} to={to} end={exact} title={label}
            className={({ isActive }) =>
              `relative w-10 h-10 rounded-xl flex items-center justify-center transition-all group
              ${isActive ? 'bg-[#4F73F7] text-white' : 'text-[#6B7FA8] hover:bg-[#252D5A] hover:text-white'}`
            }>
            <Icon size={18} />
            <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#1A2048] text-white text-xs font-medium rounded-lg
              opacity-0 pointer-events-none group-hover:opacity-100 whitespace-nowrap border border-[#2E3870] z-50 transition-opacity">
              {label}
            </span>
          </NavLink>
        ))}
      </nav>
      <button title="Настройки"
        className="w-10 h-10 rounded-xl flex items-center justify-center text-[#6B7FA8] hover:bg-[#252D5A] hover:text-white transition-all">
        <Settings size={18} />
      </button>
    </aside>
  )
}

const TAB_ITEMS = [
  { to: '/',                     label: 'Дашборд',       exact: true  },
  { to: '/norms',                label: 'Нормы расхода', exact: false },
  { to: '/references/objects',   label: 'Объекты учёта', exact: false },
  { to: '/references/resources', label: 'Ресурсы',       exact: false },
]

function HorizontalTabs() {
  const location = useLocation()

  const isActive = (to: string, exact: boolean) => {
    if (exact) return location.pathname === to
    // /norms/new и /norms/:id → таб "Нормы расхода" активен
    return location.pathname === to || location.pathname.startsWith(to + '/')
  }

  return (
    <nav className="flex items-center gap-1 mb-6 border-b border-[#E8EBF7] pb-0 -mx-6 px-6">
      {TAB_ITEMS.map(({ to, label, exact }) => {
        const active = isActive(to, exact)
        return (
          <Link key={to} to={to}
            className={`relative px-4 py-2.5 text-sm font-medium transition-all whitespace-nowrap
              ${active
                ? 'text-[#4F73F7] font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[#4F73F7] after:rounded-t-full'
                : 'text-[#6B7A99] hover:text-[#1A1F3C]'
              }`}>
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

function TopBar() {
  const location = useLocation()
  const { norms, reset } = useStore()
  const overdue = norms.filter(n => n.status === 'overdue').length
  const isNormCard = !!(location.pathname.match(/^\/norms\/.+/) && location.pathname !== '/norms/new')
  const isWizard   = location.pathname === '/norms/new'

  return (
    <div className="flex items-center justify-between mb-4">
      <h1 className="text-[22px] font-bold text-[#1A1F3C]">Нормы расхода</h1>
      <div className="flex items-center gap-3">
        {overdue > 0 && (
          <Link to="/norms"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors">
            <AlertTriangle size={13} /> {overdue} просрочено
          </Link>
        )}
        {!isWizard && !isNormCard && (
          <Link to="/norms/new" className="btn-primary">
            <Plus size={15} /> Создать норму
          </Link>
        )}
        <div className="relative">
          <button className="w-9 h-9 rounded-lg border border-[#E0E5F5] bg-white flex items-center justify-center text-[#6B7A99] hover:bg-[#F5F7FF] transition-colors">
            <Bell size={16} />
          </button>
          {overdue > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-[#4F73F7] rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1">
              {overdue}
            </span>
          )}
        </div>
        <button onClick={reset} title="Сбросить демо-данные"
          className="w-9 h-9 rounded-full bg-orange-400 flex items-center justify-center text-white text-xs font-bold hover:bg-orange-500 transition-colors">
          ДМ
        </button>
      </div>
    </div>
  )
}

function Layout() {
  return (
    <div className="min-h-screen bg-[#F0F2FA]">
      <Sidebar />
      <div className="ml-[60px]">
        <main className="max-w-[1280px] mx-auto px-6 py-6">
          <TopBar />
          <HorizontalTabs />
          <Routes>
            <Route path="/"           element={<Dashboard />} />
            <Route path="/norms"      element={<NormsList />} />
            <Route path="/norms/new"  element={<NormBuilder />} />
            <Route path="/norms/:id"  element={<NormCard />} />
            <Route path="/references" element={<References />} />
            <Route path="/references/:tab" element={<References />} />
          </Routes>
        </main>
      </div>
      <ToastContainer />
    </div>
  )
}

function AppLoader() {
  const { loadAll, loading } = useStore()
  const [ready, setReady] = useState(false)
  useEffect(() => { loadAll().then(() => setReady(true)) }, [])
  if (!ready || loading) return (
    <div className="min-h-screen bg-[#F0F2FA] flex items-center justify-center">
      <div className="text-[#6B7A99] text-sm">Загрузка...</div>
    </div>
  )
  return <Layout />
}

export default function App() {
  return <HashRouter><AppLoader /></HashRouter>
}
