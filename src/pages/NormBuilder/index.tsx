import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import { ObjectModal } from '../../components/modals/ObjectModal'
import { ObjectTypesModal } from '../../components/modals/ObjectTypesModal'
import { ResourceModal } from '../../components/modals/ResourceModal'
import { ResourceTypesModal } from '../../components/modals/ResourceTypesModal'
import { NormTypesModal } from '../../components/modals/NormTypesModal'
import { NormType, NormParamsTime, NormParamsUsage, NormParamsStock, NormParamsProduct } from '../../types'
import { calculate, formatDate } from '../../utils/calculations'
import { Search, Plus, ChevronRight, Check } from 'lucide-react'
import { InfoTip } from '../../components/ui/InfoTip'

const today = () => new Date().toISOString().slice(0, 10)


const OBJECT_NORM_SUGGESTION: Record<string, NormType> = {
  equipment: 'time',
  stock:     'stock',
  product:   'product',
  line:      'time',
  transport: 'usage',
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="label flex items-center gap-1.5">
        {label}
        {hint && <InfoTip text={hint} />}
      </label>
      {children}
    </div>
  )
}

function StepHeader({ number, title, subtitle, action, complete }: {
  number: number; title: string; subtitle: string; action?: React.ReactNode; complete?: boolean
}) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-full text-sm font-bold flex items-center justify-center shrink-0 mt-0.5 transition-all duration-300
          ${complete ? 'bg-emerald-500 text-white' : 'bg-[#4F73F7] text-white'}`}>
          {complete ? <Check size={15} /> : number}
        </div>
        <div>
          <h2 className="text-base font-bold text-[#1A1F3C]">{title}</h2>
          <p className="text-sm text-[#6B7A99] mt-0.5">{subtitle}</p>
        </div>
      </div>
      {action}
    </div>
  )
}

export function NormBuilder() {
  const navigate = useNavigate()
  const { objectTypes, resourceTypes, normTypes, objects, resources, addNorm } = useStore()

  const [selectedTypeId, setSelectedTypeId] = useState('equipment')
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null)
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null)
  const [objectSearch, setObjectSearch] = useState('')
  const [resourceSearch, setResourceSearch] = useState('')
  const [resourceTypeFilter, setResourceTypeFilter] = useState('all')

  const [normTypeId, setNormTypeId] = useState<string | null>(null)
  const [normName, setNormName] = useState('')
  const [warningValue, setWarningValue] = useState(7)
  const [warningUnit, setWarningUnit] = useState<'days' | 'weeks' | 'months'>('days')
  const [recipient, setRecipient] = useState('Ответственного за объект')
  const [comment, setComment] = useState('')

  const [startDate, setStartDate] = useState(today())
  const [lifeValue, setLifeValue] = useState(4)
  const [lifeUnit, setLifeUnit] = useState<'days' | 'weeks' | 'months' | 'years'>('months')
  const [lastDate, setLastDate] = useState(today())
  const [totalResource, setTotalResource] = useState(10000)
  const [currentUsage, setCurrentUsage] = useState(0)
  const [dailyUsage, setDailyUsage] = useState(50)
  const [usageUnit, setUsageUnit] = useState('км')
  const [stockDate, setStockDate] = useState(today())
  const [currentStock, setCurrentStock] = useState(10)
  const [dailyConsumption, setDailyConsumption] = useState(0.05)
  const [minStock, setMinStock] = useState(1)
  const [planDate, setPlanDate] = useState(today())
  const [outputPlan, setOutputPlan] = useState(10000)
  const [resourcePerUnit, setResourcePerUnit] = useState(0.01)
  const [availableStock, setAvailableStock] = useState(200)

  const [objectModalOpen, setObjectModalOpen] = useState(false)
  const [objectTypeModalOpen, setObjectTypeModalOpen] = useState(false)
  const [resourceModalOpen, setResourceModalOpen] = useState(false)
  const [resourceTypeModalOpen, setResourceTypeModalOpen] = useState(false)
  const [normTypeModalOpen, setNormTypeModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const calcMethod = normTypeId
    ? (normTypes.find(t => t.id === normTypeId)?.calcMethod ?? 'time') as NormType
    : null

  const step1Done = selectedObjectId !== null
  const step2Done = selectedResourceId !== null
  const step3Done = normTypeId !== null
  const allDone   = step1Done && step2Done && step3Done

  useEffect(() => {
    if (!selectedObjectId) return
    const obj = objects.find(o => o.id === selectedObjectId)
    const suggestedCalc = obj ? OBJECT_NORM_SUGGESTION[obj.typeId] : undefined
    if (suggestedCalc) {
      const match = normTypes.find(t => t.calcMethod === suggestedCalc && t.isSystem)
      if (match) setNormTypeId(match.id)
    }
  }, [selectedObjectId])

  const filteredObjects = useMemo(() => objects.filter(o => {
    const matchType = o.typeId === selectedTypeId
    const q = objectSearch.toLowerCase()
    return matchType && (!q || `${o.name} ${o.location} ${o.responsible}`.toLowerCase().includes(q))
  }), [objects, selectedTypeId, objectSearch])

  const filteredResources = useMemo(() => resources.filter(r => {
    const matchType = resourceTypeFilter === 'all' || r.type === resourceTypeFilter
    const q = resourceSearch.toLowerCase()
    return matchType && (!q || `${r.name} ${r.supplier} ${r.comment}`.toLowerCase().includes(q))
  }), [resources, resourceTypeFilter, resourceSearch])

  const resourceTypeName = (typeId: string) =>
    resourceTypes.find(t => t.id === typeId)?.name ?? typeId

  const buildParams = (method = calcMethod ?? 'time' as NormType): NormParamsTime | NormParamsUsage | NormParamsStock | NormParamsProduct => {
    if (method === 'time')    return { startDate, lifeValue, lifeUnit }
    if (method === 'usage')   return { lastReplacementDate: lastDate, totalResource, currentUsage, dailyUsage, usageUnit }
    if (method === 'stock')   return { stockDate, currentStock, dailyConsumption, minStock }
    return { planDate, outputPlan, resourcePerUnit, availableStock }
  }

  const previewNorm = useMemo(() => ({
    id: 'preview', name: '', objectId: selectedObjectId ?? '',
    resourceId: selectedResourceId ?? '', type: calcMethod ?? 'time' as NormType,
    params: buildParams(), warningValue, warningUnit,
    recipient, comment, status: 'active' as const,
    eventDate: null, notificationDate: null, createdAt: '', updatedAt: '',
  }), [calcMethod, startDate, lifeValue, lifeUnit, lastDate, totalResource, currentUsage, dailyUsage, usageUnit,
    stockDate, currentStock, dailyConsumption, minStock, planDate, outputPlan, resourcePerUnit, availableStock,
    warningValue, warningUnit, selectedObjectId, selectedResourceId])

  const calc = useMemo(() => allDone ? calculate(previewNorm) : null, [previewNorm, allDone])

  const handleSave = async () => {
    if (!selectedObjectId || !selectedResourceId || !normTypeId) return
    const obj = objects.find(o => o.id === selectedObjectId)
    const res = resources.find(r => r.id === selectedResourceId)
    setSaving(true)
    try {
      const norm = await addNorm({
        name: normName.trim() || `${res?.name ?? 'Ресурс'} — ${obj?.name ?? 'Объект'}`,
        objectId: selectedObjectId, resourceId: selectedResourceId,
        type: calcMethod!, params: buildParams(),
        warningValue, warningUnit, recipient, comment, status: 'active',
      })
      navigate(`/norms/${norm.id}`)
    } finally {
      setSaving(false)
    }
  }

  const selectedObject = objects.find(o => o.id === selectedObjectId)
  const selectedResource = resources.find(r => r.id === selectedResourceId)
  const suggestedCalcMethod = selectedObject ? (OBJECT_NORM_SUGGESTION[selectedObject.typeId] ?? null) : null

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
      <div className="xl:col-span-2 space-y-5">

        {/* Step 1 */}
        <div className="card p-6">
          <StepHeader number={1} complete={step1Done} title="Выберите объект учёта"
            subtitle="Объект — это то, к чему привязана норма: оборудование, склад, продукция." />

          {/* Categories section */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-[#9BA8C0] uppercase tracking-wide flex items-center gap-1.5">
                Категория
                <InfoTip text="Категория определяет тип объекта. От неё зависит список объектов ниже и рекомендуемый метод расчёта нормы в Шаге 3." side="right" />
              </p>
              <button onClick={() => setObjectTypeModalOpen(true)}
                className="text-xs text-[#4F73F7] hover:text-[#3B5FE0] font-medium transition-colors">
                + Создать категорию
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {objectTypes.map(t => (
                <span key={t.id} className="relative group/chip">
                  <button onClick={() => { setSelectedTypeId(t.id); setSelectedObjectId(null) }}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all border
                      ${selectedTypeId === t.id
                        ? 'bg-[#4F73F7] text-white border-[#4F73F7] shadow-[0_2px_8px_rgba(79,115,247,0.3)]'
                        : 'bg-white text-[#4A5578] border-[#E0E5F5] hover:border-[#4F73F7] hover:text-[#4F73F7]'}`}>
                    <span>{t.icon}</span>
                    <span>{t.name}</span>
                  </button>
                  {t.hint && (
                    <span className="absolute z-50 w-48 bottom-full left-1/2 -translate-x-1/2 mb-2
                      px-3 py-2 rounded-xl bg-[#1A1F3C] text-white text-xs leading-relaxed
                      opacity-0 group-hover/chip:opacity-100 transition-opacity duration-150 pointer-events-none shadow-xl">
                      {t.hint}
                      <span className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-t-[#1A1F3C] border-x-transparent border-b-transparent" />
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>

          {/* Objects section */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-[#9BA8C0] uppercase tracking-wide">
              {objectTypes.find(t => t.id === selectedTypeId)?.name ?? 'Объекты'}
              {filteredObjects.length > 0 && <span className="ml-1.5 font-normal">· {filteredObjects.length}</span>}
            </p>
            <button onClick={() => setObjectModalOpen(true)} className="btn-secondary py-1.5 px-3 text-xs">
              <Plus size={13} /> Добавить объект
            </button>
          </div>

          <div className="relative mb-4">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9BA8C0]" />
            <input value={objectSearch} onChange={e => setObjectSearch(e.target.value)}
              placeholder="Поиск по названию, участку..."
              className="input pl-9" />
          </div>

          {filteredObjects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#C7D4FF] bg-[#F8F9FF] p-6 text-center">
              <p className="text-sm font-medium text-[#6B7A99]">Объектов этой категории нет</p>
              <button onClick={() => setObjectModalOpen(true)} className="btn-primary mt-3">
                <Plus size={14} /> Добавить объект
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredObjects.map(o => {
                const active = selectedObjectId === o.id
                return (
                  <button key={o.id} onClick={() => setSelectedObjectId(o.id)}
                    className={`w-full text-left rounded-xl border px-4 py-3.5 transition-all
                      ${active ? 'border-[#4F73F7] bg-[#EEF2FF] shadow-[0_0_0_3px_rgba(79,115,247,0.08)]' : 'border-[#E0E5F5] bg-white hover:border-[#4F73F7] hover:bg-[#F8F9FF]'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-sm text-[#1A1F3C]">{o.name}</span>
                        <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${o.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-[#F0F2FA] text-[#6B7A99]'}`}>
                          {o.status === 'active' ? 'Активен' : 'Архив'}
                        </span>
                        <p className="text-xs text-[#6B7A99] mt-1">
                          {objectTypes.find(t => t.id === o.typeId)?.name}
                          {o.location ? ` · ${o.location}` : ''}
                          {o.responsible ? ` · ${o.responsible}` : ''}
                        </p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all
                        ${active ? 'border-[#4F73F7] bg-[#4F73F7]' : 'border-[#D0D7EE]'}`}>
                        {active && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Step 2 */}
        <div className="card p-6">
          <StepHeader number={2} complete={step2Done} title="Выберите ресурс"
            subtitle="Ресурс — то, что расходуется, заканчивается или требует замены." />

          {/* Type filter */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-[#9BA8C0] uppercase tracking-wide flex items-center gap-1.5">
                Тип ресурса
                <InfoTip text="Тип используется для фильтрации справочника. Не влияет на расчёт нормы — влияет только выбранный ресурс и метод расчёта." side="right" />
              </p>
              <button onClick={() => setResourceTypeModalOpen(true)}
                className="text-xs text-[#4F73F7] hover:text-[#3B5FE0] font-medium transition-colors">
                + Создать тип
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setResourceTypeFilter('all')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium border transition-all
                  ${resourceTypeFilter === 'all'
                    ? 'bg-[#4F73F7] text-white border-[#4F73F7] shadow-[0_2px_8px_rgba(79,115,247,0.3)]'
                    : 'bg-white text-[#4A5578] border-[#E0E5F5] hover:border-[#4F73F7] hover:text-[#4F73F7]'}`}>
                Все
              </button>
              {resourceTypes.map(t => (
                <button key={t.id} onClick={() => setResourceTypeFilter(t.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium border transition-all
                    ${resourceTypeFilter === t.id
                      ? 'bg-[#4F73F7] text-white border-[#4F73F7] shadow-[0_2px_8px_rgba(79,115,247,0.3)]'
                      : 'bg-white text-[#4A5578] border-[#E0E5F5] hover:border-[#4F73F7] hover:text-[#4F73F7]'}`}>
                  <span>{t.icon}</span><span>{t.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Resources section */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-[#9BA8C0] uppercase tracking-wide">
              {resourceTypeFilter === 'all' ? 'Все ресурсы' : resourceTypeName(resourceTypeFilter)}
              {filteredResources.length > 0 && <span className="ml-1.5 font-normal">· {filteredResources.length}</span>}
            </p>
            <button onClick={() => setResourceModalOpen(true)} className="btn-secondary py-1.5 px-3 text-xs">
              <Plus size={13} /> Добавить ресурс
            </button>
          </div>

          <div className="relative mb-4">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9BA8C0]" />
            <input value={resourceSearch} onChange={e => setResourceSearch(e.target.value)}
              placeholder="Масло, подшипник, полипропилен..."
              className="input pl-9" />
          </div>

          {filteredResources.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#C7D4FF] bg-[#F8F9FF] p-6 text-center">
              <p className="text-sm font-medium text-[#6B7A99]">Ресурсы не найдены</p>
              <button onClick={() => setResourceModalOpen(true)} className="btn-primary mt-3">
                <Plus size={14} /> Добавить ресурс
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {filteredResources.map(r => {
                const active = selectedResourceId === r.id
                return (
                  <button key={r.id} onClick={() => setSelectedResourceId(r.id)}
                    className={`text-left rounded-xl border px-4 py-3 transition-all
                      ${active ? 'border-[#4F73F7] bg-[#EEF2FF] shadow-[0_0_0_3px_rgba(79,115,247,0.08)]' : 'border-[#E0E5F5] bg-white hover:border-[#4F73F7] hover:bg-[#F8F9FF]'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-sm text-[#1A1F3C]">{r.name}</div>
                        <div className="text-xs text-[#6B7A99] mt-0.5">
                          {resourceTypeName(r.type)} · {r.unit}{r.supplier ? ` · ${r.supplier}` : ''}
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all
                        ${active ? 'border-[#4F73F7] bg-[#4F73F7]' : 'border-[#D0D7EE]'}`}>
                        {active && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Step 3 */}
        <div className="card p-6">
          <StepHeader number={3} complete={step3Done} title="Как считать норму?"
            subtitle="Выберите метод расчёта — поля ниже подстроятся автоматически." />

          {/* Norm type cards */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-[#9BA8C0] uppercase tracking-wide flex items-center gap-1.5">
                Метод расчёта
                <InfoTip text="Определяет формулу, по которой система считает дату следующего события (замены, пополнения, обслуживания). Можно добавить свои названия методов." side="right" />
              </p>
              <button onClick={() => setNormTypeModalOpen(true)}
                className="text-xs text-[#4F73F7] hover:text-[#3B5FE0] font-medium transition-colors">
                + Настроить методы
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {normTypes.map(card => {
                const isSelected = normTypeId === card.id
                const isRecommended = suggestedCalcMethod === card.calcMethod
                return (
                  <button key={card.id} onClick={() => setNormTypeId(card.id)}
                    className={`text-left rounded-xl border p-4 transition-all
                      ${isSelected
                        ? 'border-[#4F73F7] bg-[#EEF2FF] shadow-[0_0_0_3px_rgba(79,115,247,0.08)]'
                        : 'border-[#E0E5F5] bg-white hover:border-[#4F73F7] hover:bg-[#F8F9FF]'}`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 ${isSelected ? 'bg-[#4F73F7]/10' : 'bg-[#F0F2FA]'}`}>
                        {card.icon}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isRecommended && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                            Рекомендуется
                          </span>
                        )}
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'border-[#4F73F7] bg-[#4F73F7]' : 'border-[#D0D7EE]'}`}>
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                    </div>
                    <p className={`text-sm font-semibold leading-tight ${isSelected ? 'text-[#4F73F7]' : 'text-[#1A1F3C]'}`}>{card.name}</p>
                    {card.description && <p className="text-xs text-[#6B7A99] mt-1.5 leading-relaxed">{card.description}</p>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Dynamic params — only when a method is selected */}
          {calcMethod === null ? (
            <div className="rounded-xl border border-dashed border-[#C7D4FF] bg-[#F8F9FF] p-6 text-center">
              <p className="text-sm text-[#6B7A99] font-medium">Выберите метод расчёта выше</p>
              <p className="text-xs text-[#9BA8C0] mt-1">Поля параметров появятся после выбора</p>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-[#E8EBF7] bg-[#FAFBFF] p-4">
                <p className="text-xs font-semibold text-[#9BA8C0] uppercase tracking-wide mb-4">Параметры расчёта</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {calcMethod === 'time' && <>
                    <Field label="Дата установки / начала учёта" hint="Когда ресурс был установлен или начат учёт">
                      <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input" />
                    </Field>
                    <Field label="Срок службы" hint="Через какой период необходима замена или обслуживание">
                      <div className="flex gap-2">
                        <input type="number" value={lifeValue} min={1} onChange={e => setLifeValue(+e.target.value)} className="input" />
                        <select value={lifeUnit} onChange={e => setLifeUnit(e.target.value as typeof lifeUnit)} className="input w-auto">
                          <option value="days">дней</option>
                          <option value="weeks">недель</option>
                          <option value="months">месяцев</option>
                          <option value="years">лет</option>
                        </select>
                      </div>
                    </Field>
                  </>}
                  {calcMethod === 'usage' && <>
                    <Field label="Дата последней замены" hint="Когда последний раз менялся или обслуживался ресурс">
                      <input type="date" value={lastDate} onChange={e => setLastDate(e.target.value)} className="input" />
                    </Field>
                    <Field label="Ресурс до замены" hint="Сколько единиц (км, ч, циклов) можно отработать суммарно">
                      <div className="flex gap-2">
                        <input type="number" value={totalResource} onChange={e => setTotalResource(+e.target.value)} className="input" />
                        <input value={usageUnit} onChange={e => setUsageUnit(e.target.value)} placeholder="км / ч / цикл" className="input w-24" />
                      </div>
                    </Field>
                    <Field label="Уже использовано" hint="Сколько отработано на момент начала учёта">
                      <input type="number" value={currentUsage} onChange={e => setCurrentUsage(+e.target.value)} className="input" />
                    </Field>
                    <Field label={`Среднее в день (${usageUnit})`} hint="Помогает рассчитать примерную дату следующей замены">
                      <input type="number" value={dailyUsage} onChange={e => setDailyUsage(+e.target.value)} className="input" />
                    </Field>
                  </>}
                  {calcMethod === 'stock' && <>
                    <Field label="Дата учёта остатка" hint="Дата, на которую зафиксирован текущий остаток">
                      <input type="date" value={stockDate} onChange={e => setStockDate(e.target.value)} className="input" />
                    </Field>
                    <Field label={`Текущий остаток (${selectedResource?.unit ?? '—'})`} hint="Сколько есть прямо сейчас">
                      <input type="number" value={currentStock} onChange={e => setCurrentStock(+e.target.value)} className="input" />
                    </Field>
                    <Field label={`Средний расход в день (${selectedResource?.unit ?? '—'})`} hint="Скорость расходования ресурса">
                      <input type="number" step="0.001" value={dailyConsumption} onChange={e => setDailyConsumption(+e.target.value)} className="input" />
                    </Field>
                    <Field label={`Минимальный остаток (${selectedResource?.unit ?? '—'})`} hint="При каком уровне система пришлёт уведомление">
                      <input type="number" value={minStock} onChange={e => setMinStock(+e.target.value)} className="input" />
                    </Field>
                  </>}
                  {calcMethod === 'product' && <>
                    <Field label="Дата начала плана" hint="С какой даты начинается производственный план">
                      <input type="date" value={planDate} onChange={e => setPlanDate(e.target.value)} className="input" />
                    </Field>
                    <Field label="План выпуска (шт)" hint="Сколько единиц продукции планируется выпустить">
                      <input type="number" value={outputPlan} onChange={e => setOutputPlan(+e.target.value)} className="input" />
                    </Field>
                    <Field label={`Расход на 1 шт (${selectedResource?.unit ?? '—'})`} hint="Сколько ресурса тратится на одну единицу продукции">
                      <input type="number" step="0.001" value={resourcePerUnit} onChange={e => setResourcePerUnit(+e.target.value)} className="input" />
                    </Field>
                    <Field label={`Доступный остаток (${selectedResource?.unit ?? '—'})`} hint="Сколько ресурса есть в наличии">
                      <input type="number" value={availableStock} onChange={e => setAvailableStock(+e.target.value)} className="input" />
                    </Field>
                  </>}
                </div>
              </div>

              {/* Notifications & meta */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-[#F0F2FA]">
                <Field label="Название нормы">
                  <input value={normName} onChange={e => setNormName(e.target.value)}
                    placeholder={selectedObject && selectedResource ? `${selectedResource.name} — ${selectedObject.name}` : 'Необязательно'}
                    className="input" />
                </Field>
                <Field label="Кого уведомить">
                  <select value={recipient} onChange={e => setRecipient(e.target.value)} className="input">
                    <option>Ответственного за объект</option>
                    <option>Снабженца</option>
                    <option>Инженера</option>
                    <option>Руководителя производства</option>
                    <option>Всех ответственных</option>
                  </select>
                </Field>
                <Field label="Уведомить за" hint="За сколько дней система пришлёт напоминание">
                  <div className="flex gap-2">
                    <input type="number" value={warningValue} min={0} onChange={e => setWarningValue(+e.target.value)} className="input" />
                    <select value={warningUnit} onChange={e => setWarningUnit(e.target.value as typeof warningUnit)} className="input w-auto">
                      <option value="days">дней</option>
                      <option value="weeks">недель</option>
                      <option value="months">месяцев</option>
                    </select>
                  </div>
                </Field>
                <Field label="Комментарий">
                  <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2}
                    placeholder="Дополнительные детали по норме"
                    className="input resize-none" />
                </Field>
              </div>
            </>
          )}
        </div>

        {/* Step 4 */}
        <div className={`card p-6 transition-all ${!allDone ? 'opacity-60' : ''}`}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-full text-sm font-bold flex items-center justify-center shrink-0 transition-all duration-300
                ${allDone ? 'bg-[#4F73F7] text-white' : 'bg-[#E0E5F5] text-[#9BA8C0]'}`}>
                4
              </div>
              <div>
                <h2 className="text-base font-bold text-[#1A1F3C]">Предварительный расчёт</h2>
                <p className="text-sm text-[#6B7A99] mt-0.5">
                  {allDone ? 'Расчёт выполнен на основе введённых параметров.' : 'Заполните шаги 1–3 для получения расчёта.'}
                </p>
              </div>
            </div>
            <button onClick={handleSave} disabled={!allDone || saving}
              className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">
              {saving ? 'Сохранение...' : 'Создать норму'} {!saving && <ChevronRight size={15} />}
            </button>
          </div>

          {!allDone ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {['Объект', 'Ресурс', 'Плановое событие', 'Уведомление'].map(label => (
                  <div key={label} className="rounded-xl bg-[#F8F9FF] border border-[#E8EBF7] p-4">
                    <p className="text-xs text-[#9BA8C0] font-medium">{label}</p>
                    <p className="text-sm font-bold text-[#D0D7EE] mt-1">—</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-[#E8EBF7] bg-[#F8F9FF] p-4">
                <p className="text-xs text-[#9BA8C0] mb-3">Осталось заполнить:</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Объект учёта', done: step1Done },
                    { label: 'Ресурс', done: step2Done },
                    { label: 'Метод расчёта', done: step3Done },
                  ].map(s => (
                    <span key={s.label} className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all
                      ${s.done
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-white text-[#9BA8C0] border-[#E0E5F5]'}`}>
                      <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0
                        ${s.done ? 'bg-emerald-500' : 'border-2 border-[#D0D7EE]'}`}>
                        {s.done && <Check size={9} className="text-white" />}
                      </span>
                      {s.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Объект',           value: selectedObject!.name,          tip: undefined },
                  { label: 'Ресурс',            value: selectedResource!.name,         tip: undefined },
                  { label: 'Плановое событие',  value: formatDate(calc!.eventDate),    tip: 'Расчётная дата замены, пополнения или другого события. Уточняется при каждом зафиксированном событии.' },
                  { label: 'Уведомление',       value: formatDate(calc!.notificationDate), tip: 'Дата отправки напоминания = Плановое событие минус заданный период предупреждения.' },
                ].map(c => (
                  <div key={c.label} className="rounded-xl bg-[#F8F9FF] border border-[#E8EBF7] p-4">
                    <p className="text-xs text-[#9BA8C0] font-medium flex items-center gap-1">
                      {c.label}
                      {c.tip && <InfoTip text={c.tip} side="bottom" />}
                    </p>
                    <p className="font-bold text-sm text-[#1A1F3C] mt-1 leading-tight">{c.value}</p>
                  </div>
                ))}
              </div>
              <div className={`rounded-xl border p-4 ${calc!.isEnough === false ? 'bg-red-50 border-red-200' : 'bg-[#EEF2FF] border-[#C7D4FF]'}`}>
                <p className="text-sm font-semibold text-[#1A1F3C]">
                  {calc!.daysLeft !== null
                    ? calc!.daysLeft <= 0 ? '⚠️ Срок уже наступил' : `Осталось примерно ${calc!.daysLeft} дней`
                    : 'Недостаточно данных для расчёта дат'}
                </p>
                <p className="text-sm text-[#4A5578] mt-1">{calc!.details}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar */}
      <aside className="space-y-4">
        <div className="card p-5 sticky top-6">
          <h3 className="text-sm font-bold text-[#1A1F3C] mb-4">Текущий выбор</h3>
          <div className="space-y-3">
            {/* Объект */}
            {selectedObject ? (
              <div className="rounded-xl border border-[#E8EBF7] bg-[#FAFBFF] p-3.5">
                <p className="text-xs text-[#9BA8C0] font-medium">Объект</p>
                <p className="text-sm font-semibold text-[#1A1F3C] mt-1">{selectedObject.name}</p>
                <p className="text-xs text-[#6B7A99] mt-0.5">
                  {objectTypes.find(t => t.id === selectedObject.typeId)?.name}
                  {selectedObject.location ? ` · ${selectedObject.location}` : ''}
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[#D0D7EE] bg-white p-3.5">
                <p className="text-xs text-[#9BA8C0] font-medium">Объект</p>
                <p className="text-sm text-[#C4CEDF] mt-1">Не выбран</p>
              </div>
            )}

            {/* Ресурс */}
            {selectedResource ? (
              <div className="rounded-xl border border-[#E8EBF7] bg-[#FAFBFF] p-3.5">
                <p className="text-xs text-[#9BA8C0] font-medium">Ресурс</p>
                <p className="text-sm font-semibold text-[#1A1F3C] mt-1">{selectedResource.name}</p>
                <p className="text-xs text-[#6B7A99] mt-0.5">{selectedResource.unit}</p>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[#D0D7EE] bg-white p-3.5">
                <p className="text-xs text-[#9BA8C0] font-medium">Ресурс</p>
                <p className="text-sm text-[#C4CEDF] mt-1">Не выбран</p>
              </div>
            )}

            {/* Метод расчёта — всегда заполнен */}
            <div className="rounded-xl border border-[#E8EBF7] bg-[#FAFBFF] p-3.5">
              <p className="text-xs text-[#9BA8C0] font-medium">Метод расчёта</p>
              <p className="text-sm font-semibold text-[#1A1F3C] mt-1">
                {normTypes.find(t => t.id === normTypeId)?.name ?? '—'}
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-xl bg-[#FFF8EC] border border-[#FFE4A0] p-4">
            <p className="text-xs font-bold text-[#8A6400]">Подсказка</p>
            <p className="text-xs text-[#7A5500] mt-1 leading-relaxed">
              Если нужного объекта или ресурса нет — добавьте через кнопку «+». Данные формы не пропадут.
            </p>
          </div>
        </div>
      </aside>

      <ObjectModal open={objectModalOpen} onClose={() => setObjectModalOpen(false)}
        defaultTypeId={selectedTypeId}
        onCreated={obj => { setSelectedObjectId(obj.id); setSelectedTypeId(obj.typeId) }} />
      <ObjectTypesModal open={objectTypeModalOpen} onClose={() => setObjectTypeModalOpen(false)} />
      <ResourceModal open={resourceModalOpen} onClose={() => setResourceModalOpen(false)}
        onCreated={res => setSelectedResourceId(res.id)} />
      <ResourceTypesModal open={resourceTypeModalOpen} onClose={() => setResourceTypeModalOpen(false)} />
      <NormTypesModal open={normTypeModalOpen} onClose={() => setNormTypeModalOpen(false)} />
    </div>
  )
}
