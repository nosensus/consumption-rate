import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { useStore } from '../../store/useStore'
import { Resource, CustomField } from '../../types'
import { Plus, X } from 'lucide-react'
import { InfoTip } from '../ui/InfoTip'
import { ResourceTypesModal } from './ResourceTypesModal'

const UNITS = ['шт', 'кг', 'тонна', 'л', 'м', 'м²', 'упаковка', 'комплект', 'рулон', 'г', 'мл']

const FIELD_TYPES = ['text', 'number', 'date', 'list', 'file'] as const
const FIELD_TYPE_LABELS: Record<string, string> = {
  text: 'Текст', number: 'Число', date: 'Дата', list: 'Список', file: 'Файл',
}

interface PresetDef {
  key: string
  label: string
  type: 'text' | 'number'
  placeholder?: string
  isRoot?: boolean
  defaultOn: boolean
}

const PRESET_DEFS: PresetDef[] = [
  { key: 'supplier', label: 'Поставщик / бренд', type: 'text',   placeholder: 'Необязательно', isRoot: true, defaultOn: true  },
  { key: 'comment',  label: 'Комментарий',        type: 'text',   placeholder: 'Например: используется для трепальной машины', isRoot: true, defaultOn: false },
  { key: 'article',  label: 'Артикул',             type: 'text',   placeholder: 'Артикул / SKU',  defaultOn: false },
  { key: 'gost',     label: 'ГОСТ / ТУ',           type: 'text',   placeholder: 'ГОСТ 12345-2020', defaultOn: false },
  { key: 'shelf',    label: 'Место хранения',       type: 'text',   placeholder: 'Стеллаж А-3',    defaultOn: false },
  { key: 'minStock', label: 'Мин. запас',           type: 'number', placeholder: '10',             defaultOn: false },
]

const DEFAULT_PRESETS = new Set(PRESET_DEFS.filter(f => f.defaultOn).map(f => f.key))

interface Props {
  open: boolean
  onClose: () => void
  onCreated?: (res: Resource) => void
  existing?: Resource
}

function deriveFromResource(res: Resource) {
  const nonRootDefs = PRESET_DEFS.filter(d => !d.isRoot)
  const enabled = new Set<string>()
  const values: Record<string, string> = {}

  if (res.supplier) { enabled.add('supplier'); values['supplier'] = res.supplier }
  if (res.comment)  { enabled.add('comment');  values['comment']  = res.comment  }

  for (const def of nonRootDefs) {
    const field = res.fields.find(f => f.name === def.label)
    if (field) { enabled.add(def.key); values[def.key] = field.value ?? '' }
  }

  const presetLabels = new Set(nonRootDefs.map(d => d.label))
  const custom = res.fields.filter(f => !presetLabels.has(f.name))

  return { enabled, values, custom }
}

export function ResourceModal({ open, onClose, onCreated, existing }: Props) {
  const { resourceTypes, addResource, updateResource } = useStore()
  const isEdit = !!existing
  const initDerived = existing ? deriveFromResource(existing) : null

  const [name, setName] = useState(existing?.name ?? '')
  const [typeId, setTypeId] = useState(existing?.type ?? '')
  const [unit, setUnit] = useState(existing?.unit ?? 'шт')
  const [saving, setSaving] = useState(false)
  const [typesModalOpen, setTypesModalOpen] = useState(false)

  const [enabledPresets, setEnabledPresets] = useState<Set<string>>(initDerived?.enabled ?? new Set(DEFAULT_PRESETS))
  const [presetValues, setPresetValues] = useState<Record<string, string>>(initDerived?.values ?? {})
  const [customFields, setCustomFields] = useState<CustomField[]>(initDerived?.custom ?? [])
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldType, setNewFieldType] = useState<CustomField['type']>('text')

  const effectiveTypeId = typeId || resourceTypes[0]?.id || 'other'

  const reset = () => {
    setName(''); setTypeId(''); setUnit('шт')
    setEnabledPresets(new Set(DEFAULT_PRESETS))
    setPresetValues({}); setCustomFields([])
    setNewFieldName(''); setNewFieldType('text')
  }

  const handleClose = () => { if (!isEdit) reset(); onClose() }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const presetFields: CustomField[] = PRESET_DEFS
        .filter(f => !f.isRoot && enabledPresets.has(f.key))
        .map(f => ({ name: f.label, type: f.type, value: presetValues[f.key] ?? '' }))

      const payload = {
        name:     name.trim(),
        type:     effectiveTypeId,
        unit,
        supplier: enabledPresets.has('supplier') ? (presetValues['supplier'] ?? '') : '',
        comment:  enabledPresets.has('comment')  ? (presetValues['comment']  ?? '') : '',
        fields:   [...presetFields, ...customFields],
      }

      if (isEdit) {
        await updateResource(existing!.id, payload)
        onClose()
      } else {
        const res = await addResource(payload)
        reset(); onCreated?.(res); onClose()
      }
    } finally {
      setSaving(false)
    }
  }

  const togglePreset = (key: string) =>
    setEnabledPresets(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  const commitCustomField = () => {
    if (!newFieldName.trim()) return
    setCustomFields(f => [...f, { name: newFieldName.trim(), type: newFieldType, value: '' }])
    setNewFieldName(''); setNewFieldType('text')
  }
  const removeCustom = (i: number) => setCustomFields(f => f.filter((_, idx) => idx !== i))
  const setCustomValue = (i: number, value: string) =>
    setCustomFields(f => f.map((x, idx) => idx === i ? { ...x, value } : x))

  const enabledList = PRESET_DEFS.filter(f => enabledPresets.has(f.key))

  return (
    <>
      <Modal open={open} onClose={handleClose}
        title={isEdit ? 'Редактировать ресурс' : 'Добавить ресурс'}
        subtitle={isEdit ? existing!.name : 'Ресурс будет добавлен в справочник и выбран в текущей норме.'}
        footer={
          <>
            <button onClick={handleClose} className="btn-secondary">Отмена</button>
            <button onClick={handleSave} disabled={!name.trim() || saving} className="btn-primary disabled:opacity-50">
              {saving ? 'Сохранение...' : isEdit ? 'Сохранить' : 'Создать и выбрать'}
            </button>
          </>
        }
      >
        <div className="space-y-5">

          {/* Fixed fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Название ресурса *</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="Например: Подшипник китайский" className="input" autoFocus />
            </div>
            <div>
              <label className="label flex items-center gap-1.5">
                Тип ресурса *
                <InfoTip text="Категория для фильтрации в справочнике. Не влияет на расчёт нормы — влияет только выбранный метод расчёта." />
              </label>
              <div className="flex gap-2">
                <select value={effectiveTypeId} onChange={e => setTypeId(e.target.value)} className="input flex-1">
                  {resourceTypes.map(t => (
                    <option key={t.id} value={t.id}>{t.icon} {t.name}</option>
                  ))}
                </select>
                <button onClick={() => setTypesModalOpen(true)}
                  className="text-sm text-[#4F73F7] hover:text-[#3B5FE0] whitespace-nowrap font-medium px-2">
                  + тип
                </button>
              </div>
            </div>
            <div>
              <label className="label flex items-center gap-1.5">
                Единица измерения *
                <InfoTip text="Используется в расчёте при методах «Контроль остатка» и «По плану выпуска» — система считает потребность и остаток в этих единицах." />
              </label>
              <select value={unit} onChange={e => setUnit(e.target.value)} className="input">
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {/* Field constructor */}
          <div className="rounded-xl border border-[#E8EBF7] bg-[#FAFBFF] p-4 space-y-4">
            <div>
              <p className="text-sm font-semibold text-[#1A1F3C] flex items-center gap-1.5">
                Поля ресурса
                <InfoTip text="Дополнительные атрибуты для поиска и идентификации. Не влияют на расчёт нормы — только для справки." side="right" width="sm" />
              </p>
              <p className="text-xs text-[#9BA8C0] mt-0.5">Выберите нужные или добавьте своё внизу.</p>
            </div>

            {/* Inactive preset chips */}
            <div className="flex flex-wrap gap-2">
              {PRESET_DEFS.filter(f => !enabledPresets.has(f.key)).map(f => (
                <button key={f.key} onClick={() => togglePreset(f.key)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border bg-white text-[#4A5578] border-[#E0E5F5] hover:border-[#4F73F7] hover:text-[#4F73F7] transition-all">
                  <span className="text-xs">+</span>{f.label}
                </button>
              ))}
            </div>

            {/* Active fields grid */}
            {(enabledList.length > 0 || customFields.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {enabledList.map(f => (
                  <div key={f.key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="label mb-0">{f.label}</label>
                      <button onClick={() => togglePreset(f.key)}
                        className="flex items-center gap-1 text-xs text-[#9BA8C0] hover:text-red-500 transition-colors">
                        <X size={11} /> убрать
                      </button>
                    </div>
                    <input
                      type={f.type === 'number' ? 'number' : 'text'}
                      value={presetValues[f.key] ?? ''}
                      onChange={e => setPresetValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.placeholder ?? ''}
                      className="input"
                    />
                  </div>
                ))}
                {customFields.map((f, i) => (
                  <div key={`custom-${i}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <input
                        value={f.name}
                        onChange={e => setCustomFields(prev => prev.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))}
                        className="text-sm font-medium text-[#4A5578] bg-transparent border-b border-dashed border-[#C7D4FF] focus:outline-none focus:border-[#4F73F7] px-0 py-0.5 flex-1 mr-2"
                        title="Нажмите чтобы переименовать"
                      />
                      <button onClick={() => removeCustom(i)}
                        className="flex items-center gap-1 text-xs text-[#9BA8C0] hover:text-red-500 transition-colors shrink-0">
                        <X size={11} /> убрать
                      </button>
                    </div>
                    <input
                      type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                      value={f.value ?? ''}
                      onChange={e => setCustomValue(i, e.target.value)}
                      placeholder={FIELD_TYPE_LABELS[f.type]}
                      className="input"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Add custom field */}
            <div className="flex gap-2 pt-1">
              <input value={newFieldName} onChange={e => setNewFieldName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitCustomField() }}
                placeholder="Название своего поля" className="input flex-1 py-2 text-sm" />
              <select value={newFieldType} onChange={e => setNewFieldType(e.target.value as CustomField['type'])}
                className="input w-[110px] py-2 text-sm shrink-0">
                {FIELD_TYPES.map(t => <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>)}
              </select>
              <button onClick={commitCustomField} disabled={!newFieldName.trim()}
                className="btn-secondary py-2 px-3 text-sm disabled:opacity-40 shrink-0">
                <Plus size={14} /> Добавить
              </button>
            </div>
          </div>

        </div>
      </Modal>

      <ResourceTypesModal open={typesModalOpen} onClose={() => setTypesModalOpen(false)} />
    </>
  )
}
