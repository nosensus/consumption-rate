import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, BarChart3, Settings, Calculator, FileBarChart2, Bell } from 'lucide-react'
import { useStore } from './store/useStore'
import { ToastContainer } from './components/ui/Toast'
import { Dashboard } from './pages/Dashboard'
import { Reports } from './pages/Reports'
import { CostWizard } from './pages/CostWizard'

const SIDEBAR_ITEMS = [
  { to: '/',         icon: LayoutDashboard, label: 'Дашборд',                       exact: true  },
  { to: '/cost/new', icon: Calculator,      label: 'Норма расходов на производстве', exact: false },
  { to: '/reports',  icon: FileBarChart2,   label: 'Отчёты',                        exact: false },
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

function TopBar() {
  const location = useLocation()
  const { costNorms } = useStore()
  const isWizard = location.pathname.startsWith('/cost')

  const overdueNotifs = costNorms.filter(n => {
    if (!n.notificationDate) return false
    return new Date(n.notificationDate) < new Date()
  }).length

  const isEquipment = location.pathname.startsWith('/equipment')
  const title = isEquipment ? 'Оборудование'
    : isWizard ? 'Норма расходов на производстве'
    : location.pathname.startsWith('/reports') ? 'Отчёты' : 'Дашборд'

  return (
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-[22px] font-bold text-[#1A1F3C]">{title}</h1>
      <div className="flex items-center gap-3">
        <div className="relative">
          <button className="w-9 h-9 rounded-lg border border-[#E0E5F5] bg-white flex items-center justify-center text-[#6B7A99] hover:bg-[#F5F7FF] transition-colors">
            <Bell size={16} />
          </button>
          {overdueNotifs > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1">
              {overdueNotifs}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function Layout() {
  const location = useLocation()
  // Используем pathname как key, чтобы CostWizard был полностью remount-нут при переходе
  // между /cost/* и /equipment/* — иначе состояние step/selectedGroup утекает между маршрутами.
  const wizardKey = location.pathname
  return (
    <div className="min-h-screen bg-[#F0F2FA]">
      <Sidebar />
      <div className="ml-[60px]">
        <main className="max-w-[1280px] mx-auto px-6 py-6">
          <TopBar />
          <Routes>
            <Route path="/"              element={<Dashboard />} />
            <Route path="/reports"       element={<Reports />} />
            <Route path="/cost/new"           element={<CostWizard key={wizardKey} />} />
            <Route path="/cost/edit/:id"      element={<CostWizard key={wizardKey} />} />
            <Route path="/equipment/edit/:id" element={<CostWizard key={wizardKey} />} />
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
  return <BrowserRouter basename="/consumption-rate"><AppLoader /></BrowserRouter>
}
