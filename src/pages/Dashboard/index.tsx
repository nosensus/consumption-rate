import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import { formatDate, calculate } from '../../utils/calculations'
import { Badge } from '../../components/ui/Badge'
import { NORM_TYPE_LABELS, NormStatus } from '../../types'
import { AlertTriangle, Clock, CheckCircle, Activity, Building2, Package, Plus } from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
} from 'recharts'

const STATUS_LABELS: Record<NormStatus, string> = {
  active: 'Активные', overdue: 'Просрочены', paused: 'Пауза',
  draft: 'Черновики', completed: 'Завершены', archived: 'Архив',
}
const STATUS_COLORS: Record<NormStatus, string> = {
  active: '#10B981', overdue: '#EF4444', paused: '#F59E0B',
  draft: '#C7D0E8', completed: '#4F73F7', archived: '#E0E5F5',
}

const TOOLTIP_STYLE = {
  fontSize: 12, borderRadius: 8,
  border: '1px solid #E0E5F5', boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
}

function EmptyChart() {
  return (
    <div className="flex items-center justify-center h-[160px] text-[#C7D0E8] text-sm">
      Нет данных
    </div>
  )
}

export function Dashboard() {
  const { norms, objects, resources, events } = useStore()

  const stats = useMemo(() => {
    const today = Date.now()
    const active  = norms.filter(n => n.status === 'active').length
    const overdue = norms.filter(n => n.status === 'overdue').length
    const in7 = norms.filter(n => {
      if (!n.notificationDate) return false
      const diff = (new Date(n.notificationDate).getTime() - today) / 86400000
      return diff <= 7 && diff >= 0
    }).length
    const in30 = norms.filter(n => {
      if (!n.notificationDate) return false
      const diff = (new Date(n.notificationDate).getTime() - today) / 86400000
      return diff <= 30 && diff >= 0
    }).length
    return { active, overdue, in7, in30 }
  }, [norms])

  const statusData = useMemo(() => {
    const counts: Partial<Record<NormStatus, number>> = {}
    norms.forEach(n => { counts[n.status] = (counts[n.status] ?? 0) + 1 })
    return (Object.entries(counts) as [NormStatus, number][])
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ name: STATUS_LABELS[k], value: v, color: STATUS_COLORS[k] }))
  }, [norms])

  const urgencyData = useMemo(() => {
    const today = Date.now()
    return [
      { label: '0–7 дн.',   color: '#EF4444', min: -Infinity, max: 7  },
      { label: '8–30 дн.',  color: '#F59E0B', min: 8,         max: 30 },
      { label: '31–90 дн.', color: '#10B981', min: 31,        max: 90 },
      { label: '90+ дн.',   color: '#4F73F7', min: 91,        max: Infinity },
    ].map(b => ({
      label: b.label,
      color: b.color,
      count: norms.filter(n => {
        if (!n.eventDate || n.status === 'archived') return false
        const days = (new Date(n.eventDate).getTime() - today) / 86400000
        return days >= b.min && days <= b.max
      }).length,
    }))
  }, [norms])

  const typeData = useMemo(() =>
    Object.entries(NORM_TYPE_LABELS).map(([key, label]) => ({
      name: label,
      value: norms.filter(n => n.type === key && n.status !== 'archived').length,
    })),
  [norms])

  const activityData = useMemo(() => {
    const days: { label: string; count: number }[] = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const iso = d.toISOString().slice(0, 10)
      days.push({
        label: i === 0 ? 'Сегодня'
          : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
        count: events.filter(e => e.date === iso).length,
      })
    }
    return days
  }, [events])

  const upcoming = useMemo(() =>
    [...norms]
      .filter(n => n.status !== 'archived' && n.eventDate)
      .sort((a, b) => (a.eventDate ?? '').localeCompare(b.eventDate ?? ''))
      .slice(0, 8),
    [norms])

  const statCards = [
    { label: 'Активных норм',         value: stats.active,  icon: Activity,       color: 'text-[#4F73F7]',    bg: 'bg-[#EEF2FF]' },
    { label: 'Просрочено',             value: stats.overdue, icon: AlertTriangle,  color: 'text-red-500',      bg: 'bg-red-50'    },
    { label: 'Уведомлений за 7 дней',  value: stats.in7,     icon: Clock,          color: 'text-orange-500',   bg: 'bg-orange-50' },
    { label: 'Событий за 30 дней',     value: stats.in30,    icon: CheckCircle,    color: 'text-emerald-500',  bg: 'bg-emerald-50'},
  ]

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(s => (
          <div key={s.label} className="card p-5">
            <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-4`}>
              <s.icon size={18} className={s.color} />
            </div>
            <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-sm text-[#6B7A99] mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Status donut */}
        <div className="card p-5">
          <h3 className="text-sm font-bold text-[#1A1F3C] mb-1">Статусы норм</h3>
          <p className="text-xs text-[#9BA8C0] mb-4">Распределение по статусам</p>
          {statusData.length === 0 ? <EmptyChart /> : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%"
                    innerRadius={46} outerRadius={70}
                    paddingAngle={2} dataKey="value" stroke="none">
                    {statusData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <ReTooltip
                    formatter={(v: unknown, name: unknown) => [String(v), String(name)]}
                    contentStyle={TOOLTIP_STYLE}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3">
                {statusData.map((d, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-[#6B7A99]">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                    {d.name}
                    <span className="font-semibold text-[#1A1F3C]">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Urgency */}
        <div className="card p-5">
          <h3 className="text-sm font-bold text-[#1A1F3C] mb-1">Срочность событий</h3>
          <p className="text-xs text-[#9BA8C0] mb-4">Сколько норм истекает в каждом горизонте</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={urgencyData} barSize={36} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F2FA" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9BA8C0' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9BA8C0' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <ReTooltip
                formatter={(v: unknown) => [String(v), 'Норм']}
                contentStyle={TOOLTIP_STYLE}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {urgencyData.map((d, i) => (
                  <Cell key={i} fill={d.color} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* By type */}
        <div className="card p-5">
          <h3 className="text-sm font-bold text-[#1A1F3C] mb-1">По типам норм</h3>
          <p className="text-xs text-[#9BA8C0] mb-4">Количество активных норм по каждому типу</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={typeData} barSize={36} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F2FA" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9BA8C0' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9BA8C0' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <ReTooltip
                formatter={(v: unknown) => [String(v), 'Норм']}
                contentStyle={TOOLTIP_STYLE}
              />
              <Bar dataKey="value" fill="#4F73F7" fillOpacity={0.85} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Activity area chart */}
      <div className="card p-5">
        <div className="flex items-start justify-between mb-1">
          <h3 className="text-sm font-bold text-[#1A1F3C]">Активность фиксаций за 14 дней</h3>
          <span className="text-xs text-[#9BA8C0]">Количество зафиксированных событий по дням</span>
        </div>
        <div className="mt-4">
          <ResponsiveContainer width="100%" height={110}>
            <AreaChart data={activityData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#4F73F7" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#4F73F7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F2FA" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9BA8C0' }} axisLine={false} tickLine={false} interval={1} />
              <YAxis tick={{ fontSize: 10, fill: '#9BA8C0' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <ReTooltip
                formatter={(v: unknown) => [String(v), 'Событий']}
                contentStyle={TOOLTIP_STYLE}
              />
              <Area type="monotone" dataKey="count" stroke="#4F73F7" strokeWidth={2}
                fill="url(#actGrad)" dot={{ r: 3, fill: '#4F73F7', strokeWidth: 0 }} activeDot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Upcoming events table */}
      <div className="card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0F2FA]">
          <h2 className="text-base font-bold text-[#1A1F3C]">Ближайшие события</h2>
          <Link to="/norms" className="text-sm text-[#4F73F7] hover:text-[#3B5FE0] font-semibold">Все нормы →</Link>
        </div>
        {upcoming.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#9BA8C0]">
            <ClipboardEmpty />
            <p className="mt-4 font-medium">Норм пока нет</p>
            <Link to="/norms/new" className="btn-primary mt-4">
              <Plus size={15} /> Создать первую норму
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-[#F0F2FA]">
                  {['Норма', 'Объект', 'Ресурс', 'Тип', 'Событие', 'Осталось', 'Статус'].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-[#9BA8C0] uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F2FA]">
                {upcoming.map(n => {
                  const obj = objects.find(o => o.id === n.objectId)
                  const res = resources.find(r => r.id === n.resourceId)
                  const calc = calculate(n)
                  const daysLeft = calc.daysLeft ?? 0
                  const badgeVariant = n.status === 'overdue' ? 'red'
                    : daysLeft <= 7 ? 'orange' : daysLeft <= 30 ? 'yellow' : 'green'
                  return (
                    <tr key={n.id} className="hover:bg-[#F8F9FF] transition-colors">
                      <td className="px-6 py-4">
                        <Link to={`/norms/${n.id}`} className="font-semibold text-[#4F73F7] hover:text-[#3B5FE0] text-sm">
                          {n.name}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-[#4A5578]">{obj?.name ?? '—'}</td>
                      <td className="px-6 py-4 text-sm text-[#4A5578]">{res?.name ?? '—'}</td>
                      <td className="px-6 py-4 text-xs text-[#6B7A99]">{NORM_TYPE_LABELS[n.type]}</td>
                      <td className="px-6 py-4 text-sm font-medium text-[#1A1F3C]">{formatDate(n.eventDate)}</td>
                      <td className="px-6 py-4">
                        <Badge variant={badgeVariant}>
                          {n.status === 'overdue' ? 'Просрочено' : daysLeft <= 0 ? 'Сегодня' : `${daysLeft} дн.`}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={n.status === 'overdue' ? 'red' : n.status === 'active' ? 'green' : 'slate'}>
                          {n.status === 'overdue' ? 'Просрочена' : n.status === 'active' ? 'Активна' : n.status}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { to: '/norms/new',             Icon: Plus,      title: 'Создать норму',   desc: 'Добавить норму расхода, замены или контроля', color: 'bg-[#EEF2FF]', iconColor: 'text-[#4F73F7]'    },
          { to: '/references/objects',    Icon: Building2, title: 'Объекты учёта',   desc: `${objects.length} объектов в справочнике`,    color: 'bg-purple-50',  iconColor: 'text-purple-600'  },
          { to: '/references/resources',  Icon: Package,   title: 'Ресурсы',         desc: `${resources.length} ресурсов в справочнике`,  color: 'bg-emerald-50', iconColor: 'text-emerald-600' },
        ].map(card => (
          <Link key={card.to} to={card.to}
            className="card p-5 hover:shadow-[0_4px_16px_rgba(79,115,247,0.12)] transition-all group">
            <div className={`w-10 h-10 rounded-xl ${card.color} flex items-center justify-center mb-4`}>
              <card.Icon size={18} className={card.iconColor} />
            </div>
            <div className="font-semibold text-[#1A1F3C] group-hover:text-[#4F73F7] transition-colors">{card.title}</div>
            <div className="text-sm text-[#6B7A99] mt-1">{card.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}

function ClipboardEmpty() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <rect x="8" y="12" width="32" height="32" rx="4" fill="#F0F2FA" stroke="#E0E5F5" strokeWidth="1.5" />
      <rect x="16" y="6" width="16" height="10" rx="3" fill="#E0E5F5" />
      <line x1="16" y1="24" x2="32" y2="24" stroke="#C7D0E8" strokeWidth="2" strokeLinecap="round" />
      <line x1="16" y1="30" x2="27" y2="30" stroke="#C7D0E8" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
