import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { useStore } from '../../store/useStore'
import { InfoTip } from '../ui/InfoTip'
import {
  ConsumptionNorm,
  NormParamsTime, NormParamsUsage, NormParamsStock, NormParamsProduct,
} from '../../types'

interface Props {
  open: boolean
  onClose: () => void
  norm: ConsumptionNorm
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
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

export function NormEditModal({ open, onClose, norm }: Props) {
  const { updateNorm } = useStore()

  // Common
  const [name, setName] = useState(norm.name)
  const [warningValue, setWarningValue] = useState(norm.warningValue)
  const [warningUnit, setWarningUnit] = useState(norm.warningUnit)
  const [recipient, setRecipient] = useState(norm.recipient)
  const [comment, setComment] = useState(norm.comment)
  const [saving, setSaving] = useState(false)

  // time params
  const tp = norm.type === 'time' ? norm.params as NormParamsTime : null
  const [startDate,  setStartDate]  = useState(tp?.startDate  ?? '')
  const [lifeValue,  setLifeValue]  = useState(tp?.lifeValue  ?? 1)
  const [lifeUnit,   setLifeUnit]   = useState<'days'|'weeks'|'months'|'years'>(tp?.lifeUnit ?? 'months')

  // usage params
  const up = norm.type === 'usage' ? norm.params as NormParamsUsage : null
  const [lastDate,      setLastDate]      = useState(up?.lastReplacementDate ?? '')
  const [totalResource, setTotalResource] = useState(up?.totalResource       ?? 0)
  const [currentUsage,  setCurrentUsage]  = useState(up?.currentUsage        ?? 0)
  const [dailyUsage,    setDailyUsage]    = useState(up?.dailyUsage           ?? 0)
  const [usageUnit,     setUsageUnit]     = useState(up?.usageUnit            ?? '')

  // stock params
  const sp = norm.type === 'stock' ? norm.params as NormParamsStock : null
  const [stockDate,         setStockDate]         = useState(sp?.stockDate         ?? '')
  const [currentStock,      setCurrentStock]      = useState(sp?.currentStock      ?? 0)
  const [dailyConsumption,  setDailyConsumption]  = useState(sp?.dailyConsumption  ?? 0)
  const [minStock,          setMinStock]          = useState(sp?.minStock          ?? 0)

  // product params
  const pp = norm.type === 'product' ? norm.params as NormParamsProduct : null
  const [planDate,         setPlanDate]         = useState(pp?.planDate         ?? '')
  const [outputPlan,       setOutputPlan]       = useState(pp?.outputPlan       ?? 0)
  const [resourcePerUnit,  setResourcePerUnit]  = useState(pp?.resourcePerUnit  ?? 0)
  const [availableStock,   setAvailableStock]   = useState(pp?.availableStock   ?? 0)

  const buildParams = (): ConsumptionNorm['params'] => {
    if (norm.type === 'time')    return { startDate, lifeValue, lifeUnit }
    if (norm.type === 'usage')   return { lastReplacementDate: lastDate, totalResource, currentUsage, dailyUsage, usageUnit }
    if (norm.type === 'stock')   return { stockDate, currentStock, dailyConsumption, minStock }
    return { planDate, outputPlan, resourcePerUnit, availableStock }
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await updateNorm(norm.id, {
        name: name.trim(),
        params: buildParams(),
        warningValue,
        warningUnit,
        recipient: recipient.trim(),
        comment: comment.trim(),
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const lifeUnitLabels = { days: 'Дней', weeks: 'Недель', months: 'Месяцев', years: 'Лет' }

  const normTypeLabel: Record<string, string> = {
    time: 'По времени', usage: 'По выработке', stock: 'По остатку', product: 'По плану',
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Редактировать норму"
      subtitle={`${norm.name} · ${normTypeLabel[norm.type] ?? norm.type}`}
      footer={
        <>
          <button onClick={onClose} className="btn-secondary">Отмена</button>
          <button onClick={handleSave} disabled={!name.trim() || saving} className="btn-primary disabled:opacity-50">
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </>
      }
    >
      <div className="space-y-5">

        {/* Name */}
        <Field label="Название нормы">
          <input value={name} onChange={e => setName(e.target.value)} className="input" />
        </Field>

        {/* Type-specific params */}
        <div className="rounded-xl border border-[#E8EBF7] bg-[#FAFBFF] p-4 space-y-4">
          <p className="text-xs font-semibold text-[#4A5578] flex items-center gap-1.5">
            Параметры расчёта · {normTypeLabel[norm.type]}
            <InfoTip text="Изменение параметров пересчитает плановую дату и дату уведомления автоматически." />
          </p>

          {/* time */}
          {norm.type === 'time' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Дата начала цикла" hint="Когда начался текущий цикл — от этой даты считается плановое событие.">
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input" />
              </Field>
              <div>
                <label className="label flex items-center gap-1.5">
                  Длина цикла
                  <InfoTip text="Через сколько единиц времени должно произойти следующее событие." />
                </label>
                <div className="flex gap-2">
                  <input type="number" value={lifeValue} min={1}
                    onChange={e => setLifeValue(Number(e.target.value))}
                    className="input flex-1" />
                  <select value={lifeUnit} onChange={e => setLifeUnit(e.target.value as typeof lifeUnit)} className="input w-[120px]">
                    {(Object.entries(lifeUnitLabels) as [typeof lifeUnit, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* usage */}
          {norm.type === 'usage' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Дата последней замены" hint="Дата, с которой начался текущий ресурс.">
                <input type="date" value={lastDate} onChange={e => setLastDate(e.target.value)} className="input" />
              </Field>
              <Field label="Единица выработки" hint="Км, мч, циклы — единица в которой измеряется износ.">
                <input value={usageUnit} onChange={e => setUsageUnit(e.target.value)} className="input" />
              </Field>
              <Field label="Ресурс до замены" hint="Максимальная выработка до следующей замены.">
                <div className="flex gap-2 items-center">
                  <input type="number" value={totalResource} min={0}
                    onChange={e => setTotalResource(Number(e.target.value))} className="input flex-1" />
                  <span className="text-sm text-[#9BA8C0] shrink-0">{usageUnit}</span>
                </div>
              </Field>
              <Field label="Текущая выработка" hint="Сколько уже выработано с момента последней замены.">
                <div className="flex gap-2 items-center">
                  <input type="number" value={currentUsage} min={0}
                    onChange={e => setCurrentUsage(Number(e.target.value))} className="input flex-1" />
                  <span className="text-sm text-[#9BA8C0] shrink-0">{usageUnit}</span>
                </div>
              </Field>
              <Field label="Темп выработки в день" hint="Сколько единиц вырабатывается в среднем за сутки.">
                <div className="flex gap-2 items-center">
                  <input type="number" value={dailyUsage} min={0} step={0.1}
                    onChange={e => setDailyUsage(Number(e.target.value))} className="input flex-1" />
                  <span className="text-sm text-[#9BA8C0] shrink-0">{usageUnit}/д.</span>
                </div>
              </Field>
            </div>
          )}

          {/* stock */}
          {norm.type === 'stock' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Дата последнего учёта" hint="Когда был зафиксирован текущий остаток.">
                <input type="date" value={stockDate} onChange={e => setStockDate(e.target.value)} className="input" />
              </Field>
              <Field label="Текущий остаток" hint="Сколько ресурса есть прямо сейчас.">
                <input type="number" value={currentStock} min={0}
                  onChange={e => setCurrentStock(Number(e.target.value))} className="input" />
              </Field>
              <Field label="Расход в день" hint="Среднесуточный расход ресурса.">
                <input type="number" value={dailyConsumption} min={0} step={0.01}
                  onChange={e => setDailyConsumption(Number(e.target.value))} className="input" />
              </Field>
              <Field label="Минимальный запас" hint="Пороговый остаток, при достижении которого нужно пополнить.">
                <input type="number" value={minStock} min={0}
                  onChange={e => setMinStock(Number(e.target.value))} className="input" />
              </Field>
            </div>
          )}

          {/* product */}
          {norm.type === 'product' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Дата планового периода" hint="Начало производственного периода.">
                <input type="date" value={planDate} onChange={e => setPlanDate(e.target.value)} className="input" />
              </Field>
              <Field label="Плановый выпуск" hint="Сколько единиц продукции планируется произвести.">
                <input type="number" value={outputPlan} min={0}
                  onChange={e => setOutputPlan(Number(e.target.value))} className="input" />
              </Field>
              <Field label="Норма на единицу продукции" hint="Сколько ресурса расходуется на одну единицу выпуска.">
                <input type="number" value={resourcePerUnit} min={0} step={0.001}
                  onChange={e => setResourcePerUnit(Number(e.target.value))} className="input" />
              </Field>
              <Field label="Доступный запас" hint="Текущий остаток ресурса на складе.">
                <input type="number" value={availableStock} min={0}
                  onChange={e => setAvailableStock(Number(e.target.value))} className="input" />
              </Field>
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="rounded-xl border border-[#E8EBF7] bg-[#FAFBFF] p-4 space-y-4">
          <p className="text-xs font-semibold text-[#4A5578]">Уведомление</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label flex items-center gap-1.5">
                Уведомить за
                <InfoTip text="За сколько времени до планового события отправить напоминание." />
              </label>
              <div className="flex gap-2">
                <input type="number" value={warningValue} min={1}
                  onChange={e => setWarningValue(Number(e.target.value))}
                  className="input flex-1" />
                <select value={warningUnit} onChange={e => setWarningUnit(e.target.value as typeof warningUnit)} className="input w-[120px]">
                  <option value="days">Дней</option>
                  <option value="weeks">Недель</option>
                  <option value="months">Месяцев</option>
                </select>
              </div>
            </div>
            <Field label="Получатель уведомления" hint="Кому отправляется напоминание о приближении срока.">
              <input value={recipient} onChange={e => setRecipient(e.target.value)} className="input" />
            </Field>
          </div>
        </div>

        {/* Comment */}
        <Field label="Комментарий">
          <textarea value={comment} onChange={e => setComment(e.target.value)}
            rows={2} className="input resize-none" placeholder="Необязательно" />
        </Field>

      </div>
    </Modal>
  )
}
