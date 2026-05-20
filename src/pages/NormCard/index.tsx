import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import { Badge } from '../../components/ui/Badge'
import { EventModal } from '../../components/modals/EventModal'
import { NormEditModal } from '../../components/modals/NormEditModal'
import {
  NORM_TYPE_LABELS, NORM_STATUS_LABELS, NormStatus, EVENT_EFFECT_ICONS, EVENT_EFFECT_LABELS,
  ConsumptionNorm, NormParamsTime, NormParamsUsage, NormParamsStock, NormParamsProduct,
} from '../../types'
import { formatDate, calculate } from '../../utils/calculations'
import { ArrowLeft, Plus, Calendar, Bell, Clock, User, Zap } from 'lucide-react'
import { InfoTip } from '../../components/ui/InfoTip'

const LIFE_DAYS: Record<string, number> = { days: 1, weeks: 7, months: 30, years: 365 }
const LIFE_UNIT_LABELS: Record<string, string> = { days: 'дн.', weeks: 'нед.', months: 'мес.', years: 'лет' }

function CurrentStateSection({ norm }: { norm: ConsumptionNorm }) {
  if (norm.type === 'time') {
    const p = norm.params as NormParamsTime
    const totalDays = (LIFE_DAYS[p.lifeUnit] ?? 1) * p.lifeValue
    const elapsed = Math.max(0, Math.floor((Date.now() - new Date(p.startDate).getTime()) / 86400000))
    const pct = Math.min(100, Math.round((elapsed / totalDays) * 100))
    const barColor = pct >= 85 ? 'bg-red-400' : pct >= 65 ? 'bg-orange-400' : 'bg-[#4F73F7]'
    const valColor = pct >= 85 ? 'text-red-500' : pct >= 65 ? 'text-orange-500' : 'text-[#4F73F7]'
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#4A5578]">
            Прошло: <span className="font-semibold text-[#1A1F3C]">{elapsed} дн.</span> из <span className="font-semibold">{totalDays} дн.</span>
          </span>
          <span className={`text-sm font-bold ${valColor}`}>{pct}%</span>
        </div>
        <div className="h-3 rounded-full bg-[#EEF2FF] overflow-hidden">
          <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
        </div>
        <div className="flex justify-between text-xs text-[#9BA8C0]">
          <span>Старт цикла: {formatDate(p.startDate)}</span>
          <span>Цикл: {p.lifeValue} {LIFE_UNIT_LABELS[p.lifeUnit]}</span>
        </div>
      </div>
    )
  }

  if (norm.type === 'usage') {
    const p = norm.params as NormParamsUsage
    const pct = p.totalResource > 0 ? Math.min(100, Math.round((p.currentUsage / p.totalResource) * 100)) : 0
    const remaining = Math.max(0, p.totalResource - p.currentUsage)
    const daysLeft = p.dailyUsage > 0 ? Math.round(remaining / p.dailyUsage) : null
    const barColor = pct >= 85 ? 'bg-red-400' : pct >= 65 ? 'bg-orange-400' : 'bg-[#4F73F7]'
    const valColor = pct >= 85 ? 'text-red-500' : pct >= 65 ? 'text-orange-500' : 'text-[#4F73F7]'
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#4A5578]">
            Счётчик: <span className="font-semibold text-[#1A1F3C]">{p.currentUsage}</span> / <span className="font-semibold">{p.totalResource} {p.usageUnit}</span>
          </span>
          <span className={`text-sm font-bold ${valColor}`}>{pct}%</span>
        </div>
        <div className="h-3 rounded-full bg-[#EEF2FF] overflow-hidden">
          <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
        </div>
        <div className="flex justify-between text-xs text-[#9BA8C0]">
          <span>Темп износа: {p.dailyUsage} {p.usageUnit}/день</span>
          {daysLeft !== null && <span>Ресурс закончится ~через {daysLeft} дн.</span>}
        </div>
      </div>
    )
  }

  if (norm.type === 'stock') {
    const p = norm.params as NormParamsStock
    const isBelow = p.currentStock <= p.minStock
    const isWarning = !isBelow && p.currentStock <= p.minStock * 1.5
    const daysUntilMin = p.dailyConsumption > 0 && p.currentStock > p.minStock
      ? Math.round((p.currentStock - p.minStock) / p.dailyConsumption)
      : null
    const maxRef = Math.max(p.currentStock * 1.5, p.minStock * 3, p.currentStock + 1)
    const stockPct = Math.min(100, Math.round((p.currentStock / maxRef) * 100))
    const minPct = Math.min(99, Math.round((p.minStock / maxRef) * 100))
    const barColor = isBelow ? 'bg-red-400' : isWarning ? 'bg-orange-400' : 'bg-emerald-400'
    const valColor = isBelow ? 'text-red-500' : isWarning ? 'text-orange-500' : 'text-emerald-600'
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#4A5578]">
            Остаток: <span className={`font-bold ${valColor}`}>{p.currentStock}</span> ед. · Мин. запас: <span className="font-semibold text-[#1A1F3C]">{p.minStock}</span> ед.
          </span>
          {isBelow
            ? <span className="text-xs font-bold text-red-500">⚠️ Ниже минимума!</span>
            : daysUntilMin !== null && <span className={`text-xs font-semibold ${valColor}`}>До мин. ~{daysUntilMin} дн.</span>
          }
        </div>
        <div className="relative h-3">
          <div className="h-full rounded-full bg-[#EEF2FF] overflow-hidden">
            <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${stockPct}%` }} />
          </div>
          <div className="absolute top-0 h-full border-l-2 border-orange-400" style={{ left: `${minPct}%` }} />
        </div>
        <div className="flex justify-between text-xs text-[#9BA8C0]">
          <span>Расход: {p.dailyConsumption} ед./день</span>
          <span className="text-orange-500">▲ мин. {p.minStock} ед.</span>
        </div>
      </div>
    )
  }

  if (norm.type === 'product') {
    const p = norm.params as NormParamsProduct
    const needed = Math.round(p.outputPlan * p.resourcePerUnit)
    const pct = needed > 0 ? Math.min(100, Math.round((p.availableStock / needed) * 100)) : 100
    const shortage = Math.max(0, needed - p.availableStock)
    const barColor = pct < 50 ? 'bg-red-400' : pct < 80 ? 'bg-orange-400' : 'bg-emerald-400'
    const valColor = pct < 50 ? 'text-red-500' : pct < 80 ? 'text-orange-500' : 'text-emerald-600'
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#4A5578]">
            В наличии: <span className="font-semibold text-[#1A1F3C]">{p.availableStock}</span> / Нужно: <span className="font-semibold">{needed}</span> ед.
          </span>
          <span className={`text-sm font-bold ${valColor}`}>{pct}%</span>
        </div>
        <div className="h-3 rounded-full bg-[#EEF2FF] overflow-hidden">
          <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
        </div>
        <div className="flex justify-between text-xs text-[#9BA8C0]">
          <span>{p.resourcePerUnit} ед. × {p.outputPlan} выпусков = {needed} ед. потребность</span>
          {shortage > 0
            ? <span className="text-red-500">Нехватка: {shortage} ед.</span>
            : <span className="text-emerald-600">Запас достаточен</span>
          }
        </div>
      </div>
    )
  }

  return null
}

export function NormCard() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { norms, objects, resources, events, deleteNorm, updateNorm, objectTypes } = useStore()
  const [eventModalOpen, setEventModalOpen] = useState(false)
  const [editModalOpen,  setEditModalOpen]  = useState(false)

  const norm = norms.find(n => n.id === id)
  if (!norm) return (
    <div className="card p-12 text-center">
      <p className="text-[#6B7A99]">Норма не найдена.</p>
      <Link to="/norms" className="btn-primary mt-4 inline-flex">← Все нормы</Link>
    </div>
  )

  const obj = objects.find(o => o.id === norm.objectId)
  const res = resources.find(r => r.id === norm.resourceId)
  const objType = objectTypes.find(t => t.id === obj?.typeId)
  const normEvents = events.filter(e => e.normId === norm.id).sort((a, b) => b.date.localeCompare(a.date))
  const calc = calculate(norm)
  const daysLeft = calc.daysLeft ?? 0

  const handleDelete = async () => {
    if (!confirm('Удалить норму?')) return
    await deleteNorm(norm.id)
    navigate('/norms')
  }

  const handleStatus = async (status: NormStatus) => {
    await updateNorm(norm.id, { status })
  }

  const statusColor: Record<NormStatus, 'green' | 'yellow' | 'red' | 'slate' | 'blue' | 'orange'> = {
    active: 'green', draft: 'slate', paused: 'yellow',
    overdue: 'red', completed: 'blue', archived: 'slate',
  }

  const RESOURCE_TYPE_RU: Record<string, string> = {
    raw: 'Сырье', consumable: 'Расходник', spare: 'Комплектующая',
    fluid: 'Техн. жидкость', packaging: 'Упаковка', other: 'Другое',
  }

  return (
    <div className="space-y-5">
      {/* Back + actions */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link to="/norms" className="w-9 h-9 rounded-xl border border-[#E0E5F5] bg-white flex items-center justify-center text-[#6B7A99] hover:bg-[#F0F2FA] transition-colors">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={statusColor[norm.status]}>{NORM_STATUS_LABELS[norm.status]}</Badge>
              <Badge variant="blue">{NORM_TYPE_LABELS[norm.type]}</Badge>
              {calc.daysLeft !== null && (
                <Badge variant={norm.status === 'overdue' ? 'red' : daysLeft <= 7 ? 'orange' : daysLeft <= 30 ? 'yellow' : 'green'}>
                  {norm.status === 'overdue' ? 'Просрочено' : daysLeft <= 0 ? 'Сегодня' : `${daysLeft} дн.`}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setEventModalOpen(true)} className="btn-primary">
            <Zap size={14} /> Событие
          </button>
          <button onClick={() => setEditModalOpen(true)} className="btn-secondary">
            Редактировать
          </button>
          {norm.status === 'active' && (
            <button onClick={() => handleStatus('paused')} className="btn-secondary">Приостановить</button>
          )}
          {norm.status === 'paused' && (
            <button onClick={() => handleStatus('active')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 text-sm font-semibold hover:bg-emerald-100 transition-colors">
              Возобновить
            </button>
          )}
          <button onClick={handleDelete}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100 transition-colors">
            Удалить
          </button>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Calendar, label: 'Плановое событие', value: formatDate(norm.eventDate), color: 'text-[#4F73F7]', bg: 'bg-[#EEF2FF]',
            tip: 'Расчётная дата, когда нужно выполнить замену, пополнение или обслуживание. Пересчитывается автоматически после каждого зафиксированного события.' },
          { icon: Bell, label: 'Дата уведомления', value: formatDate(norm.notificationDate), color: 'text-orange-500', bg: 'bg-orange-50',
            tip: 'Дата отправки напоминания ответственному — заблаговременно, до наступления планового события.' },
          { icon: Clock, label: 'Уведомить за', value: `${norm.warningValue} ${{ days: 'дн.', weeks: 'нед.', months: 'мес.' }[norm.warningUnit]}`, color: 'text-purple-500', bg: 'bg-purple-50',
            tip: 'Период упреждения: за сколько дней, недель или месяцев до планового события система пришлёт уведомление.' },
          { icon: User, label: 'Получатель', value: norm.recipient, color: 'text-emerald-600', bg: 'bg-emerald-50',
            tip: 'Сотрудник или роль, которым отправляется уведомление о приближении срока.' },
        ].map(c => (
          <div key={c.label} className="card p-4">
            <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center mb-3`}>
              <c.icon size={16} className={c.color} />
            </div>
            <div className="flex items-center gap-1">
              <p className="text-xs text-[#9BA8C0] font-medium">{c.label}</p>
              <InfoTip text={c.tip} side="bottom" width="sm" />
            </div>
            <p className="font-bold text-sm text-[#1A1F3C] mt-1 leading-tight">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Current parameters */}
      <div className="card p-5">
        <h2 className="text-sm font-bold text-[#1A1F3C] mb-4 flex items-center gap-1.5">
          Текущие показатели
          <InfoTip text="Живые значения параметров нормы. Обновляются каждый раз, когда вы фиксируете событие — замену, расход, пополнение. Цвет полосы показывает критичность ситуации." />
        </h2>
        <CurrentStateSection norm={norm} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Object & resource */}
        <div className="card p-5">
          <h2 className="text-sm font-bold text-[#1A1F3C] mb-4 flex items-center gap-1.5">
            Объект и ресурс
            <InfoTip text="Объект учёта, на котором действует норма (оборудование, склад, линия), и расходуемый ресурс (материал, запчасть, жидкость)." />
          </h2>
          <div className="space-y-3">
            {obj && (
              <div className="rounded-xl border border-[#E8EBF7] bg-[#FAFBFF] p-4">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">{objType?.icon ?? '📌'}</div>
                  <div>
                    <p className="font-semibold text-sm text-[#1A1F3C]">{obj.name}</p>
                    <p className="text-xs text-[#6B7A99] mt-0.5">{objType?.name}{obj.location ? ` · ${obj.location}` : ''}</p>
                    {obj.responsible && <p className="text-xs text-[#6B7A99]">👤 {obj.responsible}</p>}
                  </div>
                </div>
              </div>
            )}
            {res && (
              <div className="rounded-xl border border-[#E8EBF7] bg-[#FAFBFF] p-4">
                <p className="font-semibold text-sm text-[#1A1F3C]">{res.name}</p>
                <p className="text-xs text-[#6B7A99] mt-1">
                  {RESOURCE_TYPE_RU[res.type]} · {res.unit}{res.supplier ? ` · ${res.supplier}` : ''}
                </p>
                {res.comment && <p className="text-xs text-[#9BA8C0] mt-1">{res.comment}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Calculation */}
        <div className="card p-5">
          <h2 className="text-sm font-bold text-[#1A1F3C] mb-4 flex items-center gap-1.5">
            Расчёт прогноза
            <InfoTip text="Прогноз срока до следующего события на основе текущих параметров. Пересчитывается автоматически после каждой зафиксированной замены, расхода или пополнения." />
          </h2>
          <div className={`rounded-xl border p-4 mb-4 ${calc.isEnough === false ? 'bg-red-50 border-red-200' : 'bg-[#EEF2FF] border-[#C7D4FF]'}`}>
            <p className="font-semibold text-sm text-[#1A1F3C]">
              {calc.daysLeft !== null
                ? calc.daysLeft <= 0 ? '⚠️ Срок уже наступил или просрочен'
                  : `Осталось примерно ${calc.daysLeft} дней`
                : 'Недостаточно данных'}
            </p>
            <p className="text-sm text-[#4A5578] mt-2 leading-relaxed">{calc.details}</p>
          </div>
          {norm.comment && (
            <div className="rounded-xl bg-[#FAFBFF] border border-[#E8EBF7] p-4">
              <p className="text-xs text-[#9BA8C0] font-medium mb-1">Комментарий</p>
              <p className="text-sm text-[#4A5578]">{norm.comment}</p>
            </div>
          )}
          <div className="mt-4 text-xs text-[#9BA8C0] flex gap-4">
            <span>Создана: {formatDate(norm.createdAt)}</span>
            <span>Обновлена: {formatDate(norm.updatedAt)}</span>
          </div>
        </div>
      </div>

      {/* Events history */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-[#1A1F3C] flex items-center gap-1.5">
            История событий
            <InfoTip text="Журнал всех зафиксированных изменений: замен, расходов, пополнений и корректировок. Каждое событие обновляет текущие показатели и пересчитывает плановую дату." side="bottom" />
          </h2>
          <button onClick={() => setEventModalOpen(true)} className="btn-secondary">
            <Plus size={14} /> Зафиксировать
          </button>
        </div>
        {normEvents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#C7D4FF] bg-[#F8F9FF] p-8 text-center">
            <p className="text-sm text-[#6B7A99]">Событий пока нет.</p>
            <button onClick={() => setEventModalOpen(true)} className="btn-primary mt-3">
              <Zap size={14} /> Зафиксировать первое событие
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {normEvents.map(e => (
              <div key={e.id} className="flex items-start gap-4 px-4 py-3.5 rounded-xl border border-[#E8EBF7] bg-[#FAFBFF] hover:bg-[#F0F2FA] transition-colors">
                <div className="text-xl shrink-0 mt-0.5">
                  {EVENT_EFFECT_ICONS[e.effect]}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-sm text-[#1A1F3C]">{e.name}</span>
                    <span className="text-xs text-[#9BA8C0] bg-[#F0F2FA] px-2 py-0.5 rounded-full">{EVENT_EFFECT_LABELS[e.effect]}</span>
                    {e.quantity !== null && (
                      <span className="text-xs bg-[#EEF2FF] text-[#4F73F7] px-2 py-0.5 rounded-full font-semibold">
                        {e.quantity} {e.unit}
                      </span>
                    )}
                    <span className="text-xs text-[#9BA8C0] ml-auto">{formatDate(e.date)}</span>
                  </div>
                  {e.note && <p className="text-sm text-[#6B7A99] mt-1">{e.note}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <EventModal    open={eventModalOpen} norm={norm} onClose={() => setEventModalOpen(false)} />
      <NormEditModal key={norm.updatedAt} open={editModalOpen} norm={norm} onClose={() => setEditModalOpen(false)} />
    </div>
  )
}
