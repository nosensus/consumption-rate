import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import { ObjectModal } from '../../components/modals/ObjectModal'
import { ResourceModal } from '../../components/modals/ResourceModal'
import { AccountingObject, Resource } from '../../types'
import { Search, Plus, Pencil, ExternalLink } from 'lucide-react'

function ObjectsTab() {
  const { objects, objectTypes, deleteObject, updateObject, norms } = useStore()
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<AccountingObject | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  const filtered = objects.filter(o => {
    const matchType = typeFilter === 'all' || o.typeId === typeFilter
    const q = search.toLowerCase()
    return matchType && (!q || `${o.name} ${o.location} ${o.responsible}`.toLowerCase().includes(q))
  })

  const normCount = (objId: string) => norms.filter(n => n.objectId === objId).length

  const handleArchive = (o: AccountingObject) =>
    updateObject(o.id, { status: o.status === 'active' ? 'archived' : 'active' })

  return (
    <div className="space-y-5">
      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9BA8C0]" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по названию, участку, ответственному..."
              className="input pl-9" />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="input w-auto">
            <option value="all">Все типы</option>
            {objectTypes.map(t => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
          </select>
          <button onClick={() => setCreateOpen(true)} className="btn-primary ml-auto">
            <Plus size={15} /> Добавить объект
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">🏭</div>
          <p className="font-medium text-[#6B7A99]">Объектов не найдено</p>
          <button onClick={() => setCreateOpen(true)} className="btn-primary mt-4">
            <Plus size={15} /> Добавить объект
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(o => {
            const type  = objectTypes.find(t => t.id === o.typeId)
            const count = normCount(o.id)
            return (
              <div key={o.id} className={`card p-5 transition-all hover:shadow-[0_4px_16px_rgba(79,115,247,0.1)] ${o.status === 'archived' ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] flex items-center justify-center text-xl shrink-0">
                    {type?.icon ?? '📌'}
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${o.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-[#F0F2FA] text-[#6B7A99] border border-[#E0E5F5]'}`}>
                    {o.status === 'active' ? 'Активен' : 'Архив'}
                  </span>
                </div>

                <h3 className="font-bold text-[#1A1F3C] text-sm leading-tight">{o.name}</h3>
                <p className="text-xs text-[#6B7A99] mt-1">{type?.name ?? o.typeId}</p>
                {o.location    && <p className="text-xs text-[#6B7A99] mt-0.5">📍 {o.location}</p>}
                {o.responsible && <p className="text-xs text-[#6B7A99]">👤 {o.responsible}</p>}

                {/* Additional fields */}
                {o.fields.length > 0 && (
                  <div className="mt-2 space-y-0.5">
                    {o.fields.slice(0, 3).map((f, i) => f.value ? (
                      <p key={i} className="text-xs text-[#9BA8C0]">
                        <span className="text-[#6B7A99] font-medium">{f.name}:</span> {f.value}
                      </p>
                    ) : null)}
                  </div>
                )}

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#F0F2FA]">
                  <Link
                    to={`/norms?objectId=${o.id}`}
                    className="flex items-center gap-1 text-xs text-[#4F73F7] font-semibold hover:text-[#3B5FE0] transition-colors"
                  >
                    <ExternalLink size={11} />
                    {count} {count === 1 ? 'норма' : count < 5 ? 'нормы' : 'норм'}
                  </Link>
                  <div className="flex gap-1.5">
                    <button onClick={() => setEditing(o)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#F0F2FA] text-[#4A5578] text-xs font-semibold hover:bg-[#EEF2FF] hover:text-[#4F73F7] transition-colors">
                      <Pencil size={11} /> Изменить
                    </button>
                    <button onClick={() => handleArchive(o)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#F0F2FA] text-[#6B7A99] text-xs font-semibold hover:bg-[#E0E5F5] transition-colors">
                      {o.status === 'active' ? 'В архив' : 'Активировать'}
                    </button>
                    <button onClick={() => { if (confirm('Удалить объект?')) deleteObject(o.id) }}
                      className="px-2.5 py-1.5 rounded-lg text-[#9BA8C0] text-xs font-semibold hover:bg-red-50 hover:text-red-600 transition-colors">
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ObjectModal key="create-obj" open={createOpen} onClose={() => setCreateOpen(false)} />
      {editing && (
        <ObjectModal key={editing.id} open existing={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}

function ResourcesTab() {
  const { resources, resourceTypes, deleteResource, norms } = useStore()
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Resource | null>(null)
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
          <button onClick={() => setCreateOpen(true)} className="btn-primary ml-auto">
            <Plus size={15} /> Добавить ресурс
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">📦</div>
          <p className="font-medium text-[#6B7A99]">Ресурсы не найдены</p>
          <button onClick={() => setCreateOpen(true)} className="btn-primary mt-4">
            <Plus size={15} /> Добавить ресурс
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(r => {
            const count = normCount(r.id)
            const rType = getType(r.type)
            return (
              <div key={r.id} className="card p-5 transition-all hover:shadow-[0_4px_16px_rgba(79,115,247,0.1)]">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[#F0F2FA] flex items-center justify-center text-xl shrink-0">
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
                {r.comment  && <p className="text-xs text-[#9BA8C0] mt-1 truncate">{r.comment}</p>}

                {/* Additional fields */}
                {r.fields.length > 0 && (
                  <div className="mt-2 space-y-0.5">
                    {r.fields.slice(0, 3).map((f, i) => f.value ? (
                      <p key={i} className="text-xs text-[#9BA8C0]">
                        <span className="text-[#6B7A99] font-medium">{f.name}:</span> {f.value}
                      </p>
                    ) : null)}
                  </div>
                )}

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#F0F2FA]">
                  <Link
                    to={`/norms?resourceId=${r.id}`}
                    className="flex items-center gap-1 text-xs text-[#4F73F7] font-semibold hover:text-[#3B5FE0] transition-colors"
                  >
                    <ExternalLink size={11} />
                    {count} {count === 1 ? 'норма' : count < 5 ? 'нормы' : 'норм'}
                  </Link>
                  <div className="flex gap-1.5">
                    <button onClick={() => setEditing(r)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#F0F2FA] text-[#4A5578] text-xs font-semibold hover:bg-[#EEF2FF] hover:text-[#4F73F7] transition-colors">
                      <Pencil size={11} /> Изменить
                    </button>
                    <button onClick={() => { if (confirm('Удалить ресурс?')) deleteResource(r.id) }}
                      className="px-2.5 py-1.5 rounded-lg text-[#9BA8C0] text-xs font-semibold hover:bg-red-50 hover:text-red-600 transition-colors">
                      ✕ Удалить
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ResourceModal key="create-res" open={createOpen} onClose={() => setCreateOpen(false)} />
      {editing && (
        <ResourceModal key={editing.id} open existing={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}

export function References() {
  const { tab } = useParams<{ tab?: string }>()
  const activeTab = tab === 'resources' ? 'resources' : 'objects'

  return (
    <div className="space-y-5">
      {activeTab === 'objects'   && <ObjectsTab />}
      {activeTab === 'resources' && <ResourcesTab />}
    </div>
  )
}
