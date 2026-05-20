import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { ResourceModal } from '../../components/modals/ResourceModal'
import { Search, Plus } from 'lucide-react'

export function ResourcesManager() {
  const { resources, resourceTypes, deleteResource, norms } = useStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  const getType = (typeId: string) => resourceTypes.find(t => t.id === typeId)

  const filtered = resources.filter(r => {
    const matchType = typeFilter === 'all' || r.type === typeFilter
    const q = search.toLowerCase()
    return matchType && (!q || `${r.name} ${r.supplier} ${r.comment}`.toLowerCase().includes(q))
  })

  const normCount = (resId: string) => norms.filter(n => n.resourceId === resId).length

  return (
    <div className="space-y-5">
      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9BA8C0]" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по названию, поставщику..."
              className="input pl-9" />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="input w-auto">
            <option value="all">Все типы</option>
            {resourceTypes.map(t => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
          </select>
          <button onClick={() => setModalOpen(true)} className="btn-primary ml-auto">
            <Plus size={15} /> Добавить ресурс
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">📦</div>
          <p className="font-medium text-[#6B7A99]">Ресурсы не найдены</p>
          <button onClick={() => setModalOpen(true)} className="btn-primary mt-4">
            <Plus size={15} /> Добавить ресурс
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(r => {
            const count = normCount(r.id)
            const rType = getType(r.type)
            return (
              <div key={r.id} className="card p-5 hover:shadow-[0_4px_16px_rgba(79,115,247,0.1)] transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[#F0F2FA] flex items-center justify-center text-xl">
                    {rType?.icon ?? '📎'}
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-[#F0F2FA] text-[#6B7A99] border border-[#E0E5F5] font-semibold">
                    {rType?.name ?? r.type}
                  </span>
                </div>
                <h3 className="font-bold text-[#1A1F3C] text-sm">{r.name}</h3>
                <p className="text-xs text-[#6B7A99] mt-1">
                  Ед. изм.: <span className="font-semibold text-[#4A5578]">{r.unit}</span>
                </p>
                {r.supplier && <p className="text-xs text-[#6B7A99]">Поставщик: {r.supplier}</p>}
                {r.comment && <p className="text-xs text-[#9BA8C0] mt-1 truncate">{r.comment}</p>}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#F0F2FA]">
                  <span className="text-xs text-[#9BA8C0]">
                    {count} {count === 1 ? 'норма' : count < 5 ? 'нормы' : 'норм'}
                  </span>
                  <button onClick={() => { if (confirm('Удалить ресурс?')) deleteResource(r.id) }}
                    className="px-2.5 py-1.5 rounded-lg text-[#9BA8C0] text-xs font-semibold hover:bg-red-50 hover:text-red-600 transition-colors">
                    ✕ Удалить
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ResourceModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
