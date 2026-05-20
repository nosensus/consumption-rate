import { useState, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import { Badge } from '../../components/ui/Badge'
import { EventModal } from '../../components/modals/EventModal'
import { ConsumptionNorm, NORM_TYPE_LABELS, NORM_STATUS_LABELS, NormStatus } from '../../types'
import { formatDate, calculate } from '../../utils/calculations'
import { Search, Plus, Zap } from 'lucide-react'

function statusBadge(status: NormStatus) {
  const map: Record<NormStatus, 'green' | 'yellow' | 'red' | 'slate' | 'blue' | 'orange'> = {
    active: 'green', draft: 'slate', paused: 'yellow',
    overdue: 'red', completed: 'blue', archived: 'slate',
  }
  return <Badge variant={map[status]}>{NORM_STATUS_LABELS[status]}</Badge>
}

export function NormsList() {
  const { norms, objects, resources, deleteNorm, updateNorm } = useStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<NormStatus | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [eventNorm, setEventNorm] = useState<ConsumptionNorm | null>(null)

  const preObjectId   = searchParams.get('objectId')
  const preResourceId = searchParams.get('resourceId')

  const preObject   = preObjectId   ? objects.find(o => o.id === preObjectId)   : null
  const preResource = preResourceId ? resources.find(r => r.id === preResourceId) : null

  const filtered = useMemo(() => norms.filter(n => {
    const obj = objects.find(o => o.id === n.objectId)
    const res = resources.find(r => r.id === n.resourceId)
    const q = search.toLowerCase()
    const matchText     = !q || `${n.name} ${obj?.name} ${res?.name}`.toLowerCase().includes(q)
    const matchStatus   = statusFilter === 'all' || n.status === statusFilter
    const matchType     = typeFilter === 'all' || n.type === typeFilter
    const matchObject   = !preObjectId   || n.objectId   === preObjectId
    const matchResource = !preResourceId || n.resourceId === preResourceId
    return matchText && matchStatus && matchType && matchObject && matchResource
  }), [norms, objects, resources, search, statusFilter, typeFilter, preObjectId, preResourceId])

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить норму?')) return
    await deleteNorm(id)
  }

  const handleStatus = async (norm: ConsumptionNorm, status: NormStatus) => {
    await updateNorm(norm.id, { status })
  }

  return (
    <div className="space-y-5">
      {/* Active pre-filter banner */}
      {(preObject || preResource) && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#EEF2FF] border border-[#C7D4FF]">
          <span className="text-sm text-[#4F73F7]">
            {preObject   && <>Объект: <strong>{preObject.name}</strong></>}
            {preResource && <>Ресурс: <strong>{preResource.name}</strong></>}
          </span>
          <button onClick={() => setSearchParams({})}
            className="ml-auto text-xs text-[#6B7A99] hover:text-[#1A1F3C] font-medium transition-colors">
            Сбросить фильтр ✕
          </button>
        </div>
      )}

      {/* Filters bar */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9BA8C0]" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по названию, объекту, ресурсу..."
              className="input pl-9" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as NormStatus | 'all')}
            className="input w-auto">
            <option value="all">Все статусы</option>
            {(Object.keys(NORM_STATUS_LABELS) as NormStatus[]).map(k => (
              <option key={k} value={k}>{NORM_STATUS_LABELS[k]}</option>
            ))}
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="input w-auto">
            <option value="all">Все типы</option>
            {Object.entries(NORM_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <Link to="/norms/new" className="btn-primary ml-auto">
            <Plus size={15} /> Создать норму
          </Link>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#9BA8C0]">
            <p className="font-medium text-[#6B7A99]">Нормы не найдены</p>
            <Link to="/norms/new" className="btn-primary mt-4">
              <Plus size={15} /> Создать норму
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-[#F0F2FA] bg-[#FAFBFF]">
                  {['Норма', 'Объект', 'Ресурс', 'Тип', 'Событие', 'Уведомление', 'Осталось', 'Статус', ''].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-[#9BA8C0] uppercase tracking-wide first:pl-6 last:pr-6">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F2FA]">
                {filtered.map(n => {
                  const obj = objects.find(o => o.id === n.objectId)
                  const res = resources.find(r => r.id === n.resourceId)
                  const calc = calculate(n)
                  const daysLeft = calc.daysLeft ?? 0
                  return (
                    <tr key={n.id} className="hover:bg-[#F8F9FF] transition-colors">
                      <td className="px-6 py-3.5">
                        <Link to={`/norms/${n.id}`} className="font-semibold text-[#4F73F7] hover:text-[#3B5FE0] text-sm leading-tight">
                          {n.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-[#4A5578] max-w-[160px] truncate">{obj?.name ?? '—'}</td>
                      <td className="px-5 py-3.5 text-sm text-[#4A5578]">{res?.name ?? '—'}</td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs text-[#6B7A99] bg-[#F0F2FA] px-2 py-1 rounded-md font-medium">
                          {NORM_TYPE_LABELS[n.type]}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm font-medium text-[#1A1F3C]">{formatDate(n.eventDate)}</td>
                      <td className="px-5 py-3.5 text-sm text-[#6B7A99]">{formatDate(n.notificationDate)}</td>
                      <td className="px-5 py-3.5">
                        {calc.daysLeft !== null && (
                          <Badge variant={n.status === 'overdue' ? 'red' : daysLeft <= 7 ? 'orange' : daysLeft <= 30 ? 'yellow' : 'green'}>
                            {n.status === 'overdue' ? 'Просрочено' : daysLeft <= 0 ? 'Сегодня' : `${daysLeft} дн.`}
                          </Badge>
                        )}
                      </td>
                      <td className="px-5 py-3.5">{statusBadge(n.status)}</td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => setEventNorm(n)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#EEF2FF] text-[#4F73F7] text-xs font-semibold hover:bg-[#4F73F7] hover:text-white transition-colors">
                            <Zap size={11} /> Событие
                          </button>
                          {n.status === 'active' && (
                            <button onClick={() => handleStatus(n, 'paused')}
                              className="px-2.5 py-1.5 rounded-lg bg-[#F0F2FA] text-[#6B7A99] text-xs font-semibold hover:bg-[#E0E5F5] transition-colors">
                              Пауза
                            </button>
                          )}
                          {n.status === 'paused' && (
                            <button onClick={() => handleStatus(n, 'active')}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition-colors">
                              Возобновить
                            </button>
                          )}
                          <button onClick={() => handleDelete(n.id)}
                            className="px-2.5 py-1.5 rounded-lg text-[#9BA8C0] text-xs font-semibold hover:bg-red-50 hover:text-red-600 transition-colors">
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {eventNorm && <EventModal open norm={eventNorm} onClose={() => setEventNorm(null)} />}
    </div>
  )
}
