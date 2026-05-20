import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { useStore } from '../../store/useStore'
import { AccountingObject, CustomField } from '../../types'
import { Plus, X } from 'lucide-react'
import { InfoTip } from '../ui/InfoTip'

function deriveFromObject(obj: AccountingObject) {
  const nonRootDefs = PRESET_DEFS.filter(d => !d.isRoot)
  const enabled = new Set<string>()
  const values: Record<string, string> = {}

  if (obj.location)    { enabled.add('location');    values['location']    = obj.location }
  if (obj.responsible) { enabled.add('responsible'); values['responsible'] = obj.responsible }

  for (const def of nonRootDefs) {
    const field = obj.fields.find(f => f.name === def.label)
    if (field) { enabled.add(def.key); values[def.key] = field.value ?? '' }
  }

  const presetLabels = new Set(nonRootDefs.map(d => d.label))
  const custom = obj.fields.filter(f => !presetLabels.has(f.name))

  return { enabled, values, custom }
}

interface Props {
  open: boolean
  onClose: () => void
  onCreated?: (obj: AccountingObject) => void
  defaultTypeId?: string
  initialCreatingType?: boolean
  existing?: AccountingObject
}

const FIELD_TYPES = ['text', 'number', 'date', 'list', 'file'] as const
const FIELD_TYPE_LABELS: Record<string, string> = {
  text: 'Текст', number: 'Число', date: 'Дата', list: 'Список', file: 'Файл',
}

const LOCATION_META: Record<string, { label: string; placeholder: string }> = {
  equipment: { label: 'Участок / цех',        placeholder: 'Например: Цех №2' },
  stock:     { label: 'Адрес склада',          placeholder: 'Например: Складской блок А' },
  product:   { label: 'Линия / участок',       placeholder: 'Например: Линия шприцев' },
  line:      { label: 'Подразделение / цех',   placeholder: 'Например: Производственный цех №1' },
  transport: { label: 'Гараж / место стоянки', placeholder: 'Например: Гараж №3, автопарк' },
}
const DEFAULT_LOCATION = { label: 'Местоположение', placeholder: 'Укажите местоположение' }

interface PresetDef {
  key: string
  label: string // empty means "use LOCATION_META"
  type: 'text' | 'number'
  placeholder?: string
  isRoot?: boolean
  defaultOn: boolean
}

const PRESET_DEFS: PresetDef[] = [
  { key: 'location',     label: '',                  type: 'text',   isRoot: true,  defaultOn: true  },
  { key: 'responsible',  label: 'Ответственный',     type: 'text',   placeholder: 'ФИО ответственного',  isRoot: true, defaultOn: true  },
  { key: 'serial',       label: 'Серийный номер',    type: 'text',   placeholder: 'Например: SN-20483',   defaultOn: false },
  { key: 'inventory',    label: 'Инвентарный №',     type: 'text',   placeholder: 'Инв. номер',            defaultOn: false },
  { key: 'year',         label: 'Год выпуска',       type: 'number', placeholder: '2020',                  defaultOn: false },
  { key: 'manufacturer', label: 'Производитель',     type: 'text',   placeholder: 'Например: Rieter',      defaultOn: false },
  { key: 'model',        label: 'Модель / марка',    type: 'text',   placeholder: 'Например: B-123',       defaultOn: false },
  { key: 'comment',      label: 'Комментарий',       type: 'text',   placeholder: 'Любые заметки',         defaultOn: false },
]

const DEFAULT_PRESETS = new Set(PRESET_DEFS.filter(f => f.defaultOn).map(f => f.key))

export function ObjectModal({ open, onClose, onCreated, defaultTypeId, initialCreatingType, existing }: Props) {
  const { objectTypes, addObject, addObjectType, updateObject } = useStore()
  const isEdit = !!existing
  const initDerived = existing ? deriveFromObject(existing) : null

  const [name, setName] = useState(existing?.name ?? '')
  const [typeId, setTypeId] = useState(existing?.typeId ?? defaultTypeId ?? 'equipment')
  const [newTypeName, setNewTypeName] = useState('')
  const [creatingType, setCreatingType] = useState(initialCreatingType ?? false)
  const [saving, setSaving] = useState(false)

  const [enabledPresets, setEnabledPresets] = useState<Set<string>>(initDerived?.enabled ?? new Set(DEFAULT_PRESETS))
  const [presetValues, setPresetValues] = useState<Record<string, string>>(initDerived?.values ?? {})
  const [customFields, setCustomFields] = useState<CustomField[]>(initDerived?.custom ?? [])
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldType, setNewFieldType] = useState<CustomField['type']>('text')

  const locationMeta = LOCATION_META[typeId] ?? DEFAULT_LOCATION

  const togglePreset = (key: string) =>
    setEnabledPresets(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  const reset = () => {
    setName(''); setTypeId(defaultTypeId ?? 'equipment')
    setNewTypeName(''); setCreatingType(initialCreatingType ?? false)
    setEnabledPresets(new Set(DEFAULT_PRESETS))
    setPresetValues({}); setCustomFields([])
    setNewFieldName(''); setNewFieldType('text')
  }

  const handleClose = () => { if (!isEdit) reset(); onClose() }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      let finalTypeId = typeId
      if (creatingType && newTypeName.trim()) {
        const t = await addObjectType({ name: newTypeName.trim(), icon: '📌', hint: 'Пользовательский тип' })
        finalTypeId = t.id
      }
      const presetFields: CustomField[] = PRESET_DEFS
        .filter(f => !f.isRoot && enabledPresets.has(f.key))
        .map(f => ({ name: f.label, type: f.type, value: presetValues[f.key] ?? '' }))

      const payload = {
        name: name.trim(), typeId: finalTypeId,
        location:    enabledPresets.has('location')    ? (presetValues['location']    ?? '') : '',
        responsible: enabledPresets.has('responsible') ? (presetValues['responsible'] ?? '') : '',
        fields: [...presetFields, ...customFields],
      }

      if (isEdit) {
        await updateObject(existing!.id, payload)
        onClose()
      } else {
        const obj = await addObject({ ...payload, status: 'active' })
        reset(); onCreated?.(obj); onClose()
      }
    } finally {
      setSaving(false)
    }
  }

  const commitCustomField = () => {
    if (!newFieldName.trim()) return
    setCustomFields(f => [...f, { name: newFieldName.trim(), type: newFieldType, value: '' }])
    setNewFieldName('')
    setNewFieldType('text')
  }
  const removeCustom = (i: number) => setCustomFields(f => f.filter((_, idx) => idx !== i))
  const setCustomValue = (i: number, value: string) =>
    setCustomFields(f => f.map((x, idx) => idx === i ? { ...x, value } : x))

  const enabledList = PRESET_DEFS.filter(f => enabledPresets.has(f.key))

  return (
    <Modal open={open} onClose={handleClose}
      title={isEdit ? 'Редактировать объект' : 'Добавить объект учёта'}
      subtitle={isEdit ? existing!.name : 'Создайте объект — он сразу появится в форме нормы.'}
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

        {/* Fixed fields — always shown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Название объекта *</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Например: Трепальная машина Rieter B123"
              className="input" />
          </div>
          <div>
            <label className="label flex items-center gap-1.5">
              Тип объекта *
              <InfoTip text="Категория объекта. В конструкторе нормы система автоматически порекомендует подходящий метод расчёта на основе типа." />
            </label>
            {creatingType ? (
              <div className="flex gap-2">
                <input value={newTypeName} onChange={e => setNewTypeName(e.target.value)}
                  placeholder="Название нового типа" className="input flex-1" autoFocus />
                <button onClick={() => setCreatingType(false)}
                  className="text-sm text-[#6B7A99] hover:text-[#1A1F3C] whitespace-nowrap px-2">
                  ← назад
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <select value={typeId} onChange={e => setTypeId(e.target.value)} className="input flex-1">
                  {objectTypes.map(t => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
                </select>
                <button onClick={() => setCreatingType(true)}
                  className="text-sm text-[#4F73F7] hover:text-[#3B5FE0] whitespace-nowrap font-medium px-2">
                  + тип
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Field constructor — single unified block */}
        <div className="rounded-xl border border-[#E8EBF7] bg-[#FAFBFF] p-4 space-y-4">
          <div>
            <p className="text-sm font-semibold text-[#1A1F3C] flex items-center gap-1.5">
              Поля объекта
              <InfoTip text="Дополнительные атрибуты для поиска и идентификации. Не влияют на расчёт нормы — только для справки." side="right" width="sm" />
            </p>
            <p className="text-xs text-[#9BA8C0] mt-0.5">Выберите нужные или добавьте своё внизу.</p>
          </div>

          {/* Chips row — inactive presets */}
          <div className="flex flex-wrap gap-2">
            {PRESET_DEFS.filter(f => !enabledPresets.has(f.key)).map(f => {
              const label = f.key === 'location' ? locationMeta.label : f.label
              return (
                <button key={f.key} onClick={() => togglePreset(f.key)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border bg-white text-[#4A5578] border-[#E0E5F5] hover:border-[#4F73F7] hover:text-[#4F73F7] transition-all">
                  <span className="text-xs">+</span>
                  {label}
                </button>
              )
            })}
          </div>

          {/* Active fields grid — enabled presets + custom fields, each with input + × chip header */}
          {(enabledList.length > 0 || customFields.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {enabledList.map(f => {
                const label = f.key === 'location' ? locationMeta.label : f.label
                const placeholder = f.key === 'location' ? locationMeta.placeholder : (f.placeholder ?? '')
                return (
                  <div key={f.key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="label mb-0">{label}</label>
                      <button onClick={() => togglePreset(f.key)}
                        className="flex items-center gap-1 text-xs text-[#9BA8C0] hover:text-red-500 transition-colors">
                        <X size={11} /> убрать
                      </button>
                    </div>
                    <input
                      type={f.type === 'number' ? 'number' : 'text'}
                      value={presetValues[f.key] ?? ''}
                      onChange={e => setPresetValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={placeholder}
                      className="input"
                    />
                  </div>
                )
              })}
              {customFields.map((f, i) => (
                <div key={`custom-${i}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <input
                      value={f.name}
                      onChange={e => setCustomFields(prev => prev.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))}
                      className="text-sm font-medium text-[#4A5578] bg-transparent border-b border-dashed border-[#C7D4FF] focus:outline-none focus:border-[#4F73F7] px-0 py-0.5 w-auto min-w-0 flex-1 mr-2"
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

          {/* Add custom field form */}
          <div className="flex gap-2 pt-1">
            <input
              value={newFieldName}
              onChange={e => setNewFieldName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitCustomField() }}
              placeholder="Название своего поля"
              className="input flex-1 py-2 text-sm"
            />
            <select
              value={newFieldType}
              onChange={e => setNewFieldType(e.target.value as CustomField['type'])}
              className="input w-[110px] py-2 text-sm shrink-0"
            >
              {FIELD_TYPES.map(t => <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>)}
            </select>
            <button
              onClick={commitCustomField}
              disabled={!newFieldName.trim()}
              className="btn-secondary py-2 px-3 text-sm disabled:opacity-40 shrink-0"
            >
              <Plus size={14} /> Добавить
            </button>
          </div>

          {enabledList.length === 0 && customFields.length === 0 && PRESET_DEFS.every(f => !enabledPresets.has(f.key)) && (
            <p className="text-xs text-[#9BA8C0] text-center py-1">
              Выберите поле из списка выше или добавьте своё
            </p>
          )}
        </div>

      </div>
    </Modal>
  )
}
