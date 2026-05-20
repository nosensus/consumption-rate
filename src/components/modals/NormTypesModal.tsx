import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { useStore } from '../../store/useStore'
import { NormTypeEntity, NormType } from '../../types'
import { Pencil, Trash2, Check, X } from 'lucide-react'

const CALC_OPTIONS: { value: NormType; label: string; description: string; examples: string }[] = [
  {
    value: 'time',
    label: 'По времени',
    description: 'Дата установки + срок службы → дата замены или обслуживания',
    examples: 'Плановое ТО, замена масла раз в 3 мес., срок годности расходника, ежегодная поверка',
  },
  {
    value: 'usage',
    label: 'По выработке',
    description: 'Любой счётчик (км, ч, м, кг, стежки, циклы, партии...) → дата следующей замены',
    examples: 'Износ иглы по метражу, масло по пробегу, фильтр по м³, нож по числу операций',
  },
  {
    value: 'stock',
    label: 'По остатку',
    description: 'Текущий запас + средний расход → когда нужно пополнить',
    examples: 'Закупка сырья, пополнение склада ГСМ, запас упаковки, химикаты',
  },
  {
    value: 'product',
    label: 'По плану выпуска',
    description: 'Норма на единицу продукции × план → общая потребность ресурса',
    examples: 'Ткань на партию изделий, краситель на тираж, упаковка на план, нитки на единицу',
  },
]

interface Props {
  open: boolean
  onClose: () => void
}

export function NormTypesModal({ open, onClose }: Props) {
  const { normTypes, norms, addNormType, updateNormType, deleteNormType } = useStore()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editIcon, setEditIcon] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editMethod, setEditMethod] = useState<NormType>('time')
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newMethod, setNewMethod] = useState<NormType>('time')
  const [saving, setSaving] = useState(false)
  const [addingNew, setAddingNew] = useState(false)

  const usageCount = (typeId: string) => norms.filter(n => n.type === typeId).length

  const startEdit = (t: NormTypeEntity) => {
    setEditingId(t.id); setEditName(t.name); setEditIcon(t.icon)
    setEditDesc(t.description); setEditMethod(t.calcMethod)
  }

  const cancelEdit = () => setEditingId(null)

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return
    setSaving(true)
    try {
      await updateNormType(editingId, {
        name: editName.trim(),
        icon: editIcon.trim() || '📋',
        description: editDesc.trim(),
        calcMethod: editMethod,
      })
      setEditingId(null)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (t: NormTypeEntity) => {
    const count = usageCount(t.id)
    const msg = count > 0
      ? `Метод «${t.name}» используется в ${count} норм${count === 1 ? 'е' : 'ах'}. Удалить всё равно?`
      : `Удалить метод «${t.name}»?`
    if (!confirm(msg)) return
    await deleteNormType(t.id)
  }

  const handleAdd = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      await addNormType({
        name: newName.trim(),
        icon: newIcon.trim() || '📋',
        description: newDesc.trim(),
        calcMethod: newMethod,
      })
      setNewName(''); setNewIcon(''); setNewDesc(''); setNewMethod('time')
      setAddingNew(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose}
      title="Методы расчёта норм"
      subtitle="Адаптируйте под терминологию вашего производства — каждый метод основан на одной из 4 расчётных формул."
      footer={
        <div className="flex items-center justify-between w-full">
          {!addingNew && (
            <button onClick={() => setAddingNew(true)} className="btn-primary">
              + Добавить свой метод
            </button>
          )}
          <button onClick={onClose} className="btn-secondary ml-auto">Закрыть</button>
        </div>
      }
    >
      {/* Existing types */}
      <div className="space-y-1 mb-4">
        {normTypes.map(t => {
          const count = usageCount(t.id)
          const calcOpt = CALC_OPTIONS.find(o => o.value === t.calcMethod)
          if (editingId === t.id) {
            return (
              <div key={t.id} className="rounded-xl bg-[#EEF2FF] border border-[#C7D4FF] p-3 space-y-2.5">
                <div className="flex items-center gap-2">
                  <input value={editIcon} onChange={e => setEditIcon(e.target.value)}
                    className="w-10 text-center text-xl border border-[#E0E5F5] rounded-lg py-1 bg-white focus:outline-none focus:ring-2 focus:ring-[#4F73F7]/30"
                    maxLength={2} />
                  <input value={editName} onChange={e => setEditName(e.target.value)}
                    className="input flex-1 py-2" autoFocus
                    onKeyDown={e => { if (e.key === 'Escape') cancelEdit() }} />
                  <button onClick={saveEdit} disabled={!editName.trim() || saving}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#4F73F7] text-white hover:bg-[#3B5FE0] transition-colors disabled:opacity-50">
                    <Check size={14} />
                  </button>
                  <button onClick={cancelEdit}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-[#9BA8C0] hover:bg-[#E0E5F5] transition-colors">
                    <X size={14} />
                  </button>
                </div>
                <input value={editDesc} onChange={e => setEditDesc(e.target.value)}
                  placeholder="Описание для сотрудников (необязательно)" className="input py-2 text-sm" />
                <div>
                  <p className="text-xs text-[#6B7A99] mb-2">Расчётная формула:</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {CALC_OPTIONS.map(o => (
                      <button key={o.value} onClick={() => setEditMethod(o.value)}
                        className={`text-left px-3 py-2 rounded-lg border text-xs transition-all
                          ${editMethod === o.value
                            ? 'border-[#4F73F7] bg-white text-[#4F73F7] font-semibold'
                            : 'border-[#E0E5F5] bg-white text-[#4A5578] hover:border-[#4F73F7]'}`}>
                        <p className="font-medium">{o.label}</p>
                        <p className="text-[#9BA8C0] mt-0.5 leading-relaxed">{o.description}</p>
                        <p className={`mt-1 leading-relaxed ${editMethod === o.value ? 'text-[#9BA8C0]' : 'text-[#C4CEDF]'}`}>
                          Примеры: {o.examples}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )
          }
          return (
            <div key={t.id} className="flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-[#F5F7FF] group transition-colors">
              <span className="text-xl w-8 text-center shrink-0 mt-0.5">{t.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1A1F3C]">{t.name}</p>
                {t.description && <p className="text-xs text-[#6B7A99] mt-0.5 truncate">{t.description}</p>}
                <p className="text-xs text-[#9BA8C0] mt-0.5">
                  <span className="font-medium text-[#6B7A99]">{calcOpt?.label}</span>
                  {' · '}{calcOpt?.description}
                </p>
              </div>
              <span className="text-xs text-[#9BA8C0] shrink-0 mt-0.5">
                {count > 0 ? `${count} норм${count === 1 ? 'а' : count < 5 ? 'ы' : ''}` : '—'}
              </span>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button onClick={() => startEdit(t)} title="Редактировать"
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

      {/* Add new */}
      {addingNew && (
        <div className="rounded-xl border-2 border-dashed border-[#C7D4FF] bg-[#F8F9FF] p-4 space-y-3">
          <p className="text-sm font-semibold text-[#1A1F3C]">Новый метод расчёта</p>
          <p className="text-xs text-[#6B7A99] -mt-1">
            Придумайте название в терминах вашего производства и выберите формулу расчёта.
          </p>
          <div className="flex gap-2">
            <input value={newIcon} onChange={e => setNewIcon(e.target.value)} placeholder="📋"
              className="w-14 text-center text-xl border border-[#E0E5F5] rounded-lg py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#4F73F7]/30 focus:border-[#4F73F7] transition-all"
              maxLength={2} />
            <input value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="Например: По моточасам, По метражу, По пробегу..." className="input flex-1" autoFocus
              onKeyDown={e => { if (e.key === 'Escape') setAddingNew(false) }} />
          </div>
          <input value={newDesc} onChange={e => setNewDesc(e.target.value)}
            placeholder="Описание для сотрудников (необязательно)" className="input text-sm" />
          <div>
            <p className="text-xs font-semibold text-[#6B7A99] mb-2">Выберите расчётную формулу:</p>
            <div className="grid grid-cols-2 gap-1.5">
              {CALC_OPTIONS.map(o => (
                <button key={o.value} onClick={() => setNewMethod(o.value)}
                  className={`text-left px-3 py-2.5 rounded-lg border text-xs transition-all
                    ${newMethod === o.value
                      ? 'border-[#4F73F7] bg-white shadow-[0_0_0_3px_rgba(79,115,247,0.08)] text-[#4F73F7] font-semibold'
                      : 'border-[#E0E5F5] bg-white text-[#4A5578] hover:border-[#4F73F7]'}`}>
                  <p className="font-medium">{o.label}</p>
                  <p className={`mt-0.5 leading-relaxed ${newMethod === o.value ? 'text-[#6B7A99]' : 'text-[#9BA8C0]'}`}>{o.description}</p>
                  <p className={`mt-1 leading-relaxed ${newMethod === o.value ? 'text-[#9BA8C0]' : 'text-[#C4CEDF]'}`}>
                    Примеры: {o.examples}
                  </p>
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => { setAddingNew(false); setNewName(''); setNewIcon(''); setNewDesc('') }}
              className="btn-secondary flex-1">
              Отмена
            </button>
            <button onClick={handleAdd} disabled={!newName.trim() || saving}
              className="btn-primary flex-1 disabled:opacity-50">
              {saving ? 'Сохранение...' : 'Добавить метод'}
            </button>
          </div>
        </div>
      )}

      {!addingNew && (
        <p className="text-xs text-[#9BA8C0] mt-2 leading-relaxed">
          4 формулы покрывают все сценарии: «По моточасам», «По пробегу», «По метражу», «По стежкам» — это всё <span className="font-medium">По выработке</span> с разными единицами. «Плановая замена» — это <span className="font-medium">По времени</span>. Своё название — любое, формула — одна из четырёх.
        </p>
      )}
    </Modal>
  )
}
