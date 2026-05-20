import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { useStore } from '../../store/useStore'
import { ResourceTypeEntity } from '../../types'
import { Pencil, Trash2, Check, X } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
}

export function ResourceTypesModal({ open, onClose }: Props) {
  const { resourceTypes, resources, addResourceType, updateResourceType, deleteResourceType } = useStore()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editIcon, setEditIcon] = useState('')
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('')
  const [saving, setSaving] = useState(false)

  const usageCount = (typeId: string) => resources.filter(r => r.type === typeId).length

  const startEdit = (t: ResourceTypeEntity) => {
    setEditingId(t.id); setEditName(t.name); setEditIcon(t.icon)
  }

  const cancelEdit = () => setEditingId(null)

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return
    setSaving(true)
    try {
      await updateResourceType(editingId, { name: editName.trim(), icon: editIcon.trim() || '📎' })
      setEditingId(null)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (t: ResourceTypeEntity) => {
    const count = usageCount(t.id)
    const msg = count > 0
      ? `Тип «${t.name}» используется в ${count} ресурс${count === 1 ? 'е' : 'ах'}. Удалить всё равно?`
      : `Удалить тип «${t.name}»?`
    if (!confirm(msg)) return
    await deleteResourceType(t.id)
  }

  const handleAdd = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      await addResourceType({ name: newName.trim(), icon: newIcon.trim() || '📎' })
      setNewName(''); setNewIcon('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose}
      title="Типы ресурсов"
      subtitle="Управление категориями ресурсов."
      footer={<button onClick={onClose} className="btn-secondary">Закрыть</button>}
    >
      <div className="space-y-1">
        {resourceTypes.map(t => {
          const count = usageCount(t.id)
          if (editingId === t.id) {
            return (
              <div key={t.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#EEF2FF] border border-[#C7D4FF]">
                <input value={editIcon} onChange={e => setEditIcon(e.target.value)}
                  className="w-10 text-center text-xl border border-[#E0E5F5] rounded-lg py-1 bg-white focus:outline-none focus:ring-2 focus:ring-[#4F73F7]/30"
                  maxLength={2} />
                <input value={editName} onChange={e => setEditName(e.target.value)}
                  className="input flex-1 py-2" autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit() }} />
                <button onClick={saveEdit} disabled={!editName.trim() || saving}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#4F73F7] text-white hover:bg-[#3B5FE0] transition-colors disabled:opacity-50">
                  <Check size={14} />
                </button>
                <button onClick={cancelEdit}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-[#9BA8C0] hover:bg-[#E0E5F5] transition-colors">
                  <X size={14} />
                </button>
              </div>
            )
          }
          return (
            <div key={t.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#F5F7FF] group transition-colors">
              <span className="text-xl w-8 text-center shrink-0">{t.icon}</span>
              <span className="flex-1 text-sm font-medium text-[#1A1F3C]">{t.name}</span>
              <span className="text-xs text-[#9BA8C0] shrink-0">
                {count > 0 ? `${count} ресурс${count === 1 ? '' : count < 5 ? 'а' : 'ов'}` : 'нет ресурсов'}
              </span>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button onClick={() => startEdit(t)} title="Переименовать"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-[#6B7A99] hover:bg-[#E8EBF7] hover:text-[#4F73F7] transition-colors">
                  <Pencil size={13} />
                </button>
                <button onClick={() => handleDelete(t)} title="Удалить"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-[#9BA8C0] hover:bg-red-50 hover:text-red-500 transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-[#E8EBF7]">
        <p className="text-xs font-semibold text-[#9BA8C0] uppercase tracking-wide mb-3">Новый тип</p>
        <div className="flex gap-2">
          <input value={newIcon} onChange={e => setNewIcon(e.target.value)} placeholder="📎"
            className="w-14 text-center text-xl border border-[#E0E5F5] rounded-lg py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#4F73F7]/30 focus:border-[#4F73F7] transition-all"
            maxLength={2} />
          <input value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="Название типа" className="input flex-1"
            onKeyDown={e => { if (e.key === 'Enter') handleAdd() }} />
          <button onClick={handleAdd} disabled={!newName.trim() || saving}
            className="btn-primary disabled:opacity-50 shrink-0">
            Добавить
          </button>
        </div>
      </div>
    </Modal>
  )
}
