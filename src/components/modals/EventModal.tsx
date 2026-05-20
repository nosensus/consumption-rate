import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { useStore } from '../../store/useStore'
import { InfoTip } from '../ui/InfoTip'
import {
  ConsumptionNorm, EventEffect,
  NormParamsTime, NormParamsUsage, NormParamsStock, NormParamsProduct,
} from '../../types'
import { formatDate } from '../../utils/calculations'

const QUICK_PICKS: Record<string, string[]> = {
  time:    ['Замена', 'Аварийная замена', 'Плановое ТО', 'Ремонт', 'Осмотр'],
  usage:   ['Замена', 'Регламентная замена', 'Добавить выработку', 'ТО', 'Корректировка'],
  stock:   ['Поставка', 'Пополнение', 'Списание', 'Расход', 'Инвентаризация'],
  product: ['Поставка', 'Пополнение', 'Производственный расход', 'Списание', 'Инвентаризация'],
}

function computeImpact(norm: ConsumptionNorm, effect: EventEffect, qty: number | null, date: string, unit: string): string {
  if (effect === 'none') return 'Параметры нормы не изменятся — событие сохранится в историю.'

  if (norm.type === 'time') {
    return `Новый цикл начнётся с ${formatDate(date)}. Плановая дата пересчитается автоматически.`
  }
  if (norm.type === 'usage') {
    const p = norm.params as NormParamsUsage
    if (qty === null) return 'Введите значение.'
    if (effect === 'add')       return `Счётчик: ${p.currentUsage} → ${p.currentUsage + qty} ${p.usageUnit}`
    if (effect === 'set_value') return `Счётчик: ${p.currentUsage} → ${qty} ${p.usageUnit}`
  }
  if (norm.type === 'stock') {
    const p = norm.params as NormParamsStock
    if (qty === null) return 'Введите значение.'
    if (effect === 'add')       return `Остаток: ${p.currentStock} → ${p.currentStock + qty} ${unit}. Прогноз пересчитается.`
    if (effect === 'subtract')  return `Остаток: ${p.currentStock} → ${Math.max(0, p.currentStock - qty)} ${unit}`
    if (effect === 'set_value') return `Остаток: ${p.currentStock} → ${qty} ${unit}`
  }
  if (norm.type === 'product') {
    const p = norm.params as NormParamsProduct
    if (qty === null) return 'Введите значение.'
    if (effect === 'add')       return `Запас: ${p.availableStock} → ${p.availableStock + qty} ${unit}`
    if (effect === 'subtract')  return `Запас: ${p.availableStock} → ${Math.max(0, p.availableStock - qty)} ${unit}`
    if (effect === 'set_value') return `Запас: ${p.availableStock} → ${qty} ${unit}`
  }
  return ''
}

interface Props {
  open: boolean
  onClose: () => void
  norm: ConsumptionNorm
}

export function EventModal({ open, onClose, norm }: Props) {
  const { addEvent, resources } = useStore()

  const resource = resources.find(r => r.id === norm.resourceId)
  const unit = resource?.unit ?? 'ед.'

  const [name, setName] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  // param fields — mutually exclusive
  const [addQty, setAddQty]           = useState('')
  const [subtractQty, setSubtractQty] = useState('')
  const [setQty, setSetQty]           = useState('')
  const [resetCycle, setResetCycle]   = useState(true) // for time norms

  const clearOthers = (keep: 'add' | 'subtract' | 'set') => {
    if (keep !== 'add')      setAddQty('')
    if (keep !== 'subtract') setSubtractQty('')
    if (keep !== 'set')      setSetQty('')
  }

  // Derive effect automatically from which field has a value
  const derivedEffect: EventEffect =
    norm.type === 'time'
      ? (resetCycle ? 'reset' : 'none')
      : setQty      !== '' ? 'set_value'
      : addQty      !== '' ? 'add'
      : subtractQty !== '' ? 'subtract'
      : 'none'

  const derivedQty: number | null =
    setQty      !== '' ? Number(setQty) :
    addQty      !== '' ? Number(addQty) :
    subtractQty !== '' ? Number(subtractQty) :
    null

  const impactText = computeImpact(norm, derivedEffect, derivedQty, date, unit)
  const canSave    = name.trim().length > 0

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      await addEvent({
        normId: norm.id,
        name: name.trim(),
        effect: derivedEffect,
        quantity: derivedQty,
        unit,
        date,
        note: note.trim(),
      })
      setName(''); setAddQty(''); setSubtractQty(''); setSetQty(''); setNote('')
      setResetCycle(true)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  // Current value context label
  const currentValueLabel = (() => {
    if (norm.type === 'time') {
      const p = norm.params as NormParamsTime
      return `Старт цикла: ${formatDate(p.startDate)}`
    }
    if (norm.type === 'usage') {
      const p = norm.params as NormParamsUsage
      return `Сейчас: ${p.currentUsage.toLocaleString('ru')} / ${p.totalResource.toLocaleString('ru')} ${p.usageUnit}`
    }
    if (norm.type === 'stock') {
      const p = norm.params as NormParamsStock
      return `Сейчас: ${p.currentStock} ${unit} · Мин: ${p.minStock} ${unit}`
    }
    if (norm.type === 'product') {
      const p = norm.params as NormParamsProduct
      return `Сейчас: ${p.availableStock} ${unit}`
    }
    return ''
  })()

  const normTypeLabel: Record<string, string> = {
    time: 'По времени', usage: 'По выработке', stock: 'По остатку', product: 'По плану',
  }

  const paramLabel: Record<string, string> = {
    time: 'Цикл', usage: 'Счётчик выработки', stock: 'Остаток на складе', product: 'Доступный запас',
  }

  return (
    <Modal open={open} onClose={onClose}
      title="Зафиксировать событие"
      subtitle={`${norm.name} · ${normTypeLabel[norm.type] ?? norm.type}`}
      footer={
        <>
          <button onClick={onClose} className="btn-secondary">Отмена</button>
          <button onClick={handleSave} disabled={!canSave || saving} className="btn-primary disabled:opacity-50">
            {saving ? 'Сохранение...' : 'Зафиксировать'}
          </button>
        </>
      }
    >
      <div className="space-y-4">

        {/* Name */}
        <div>
          <label className="label flex items-center gap-1.5">
            Что произошло? *
            <InfoTip text="Назовите событие своими словами — любое название, понятное вашей команде." />
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Например: Замена фильтра, Поставка со склада, Плановое ТО..."
            className="input"
            autoFocus
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {(QUICK_PICKS[norm.type] ?? []).map(label => (
              <button key={label} onClick={() => setName(label)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium border border-[#E0E5F5] bg-white text-[#4A5578] hover:border-[#4F73F7] hover:text-[#4F73F7] transition-all">
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Param fields */}
        <div className="rounded-xl border border-[#E8EBF7] bg-[#FAFBFF] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-[#4A5578] flex items-center gap-1.5">
              {paramLabel[norm.type] ?? 'Параметры'}
              <InfoTip text="Заполните одно поле — система автоматически применит нужное действие к расчёту нормы." width="sm" />
            </p>
            <span className="text-xs text-[#9BA8C0]">{currentValueLabel}</span>
          </div>

          {/* time */}
          {norm.type === 'time' && (
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={resetCycle}
                onChange={e => setResetCycle(e.target.checked)}
                className="w-4 h-4 rounded border-[#C7D4FF] accent-[#4F73F7]"
              />
              <span className="text-sm text-[#4A5578]">Начать новый цикл с даты события</span>
            </label>
          )}

          {/* usage */}
          {norm.type === 'usage' && (() => {
            const p = norm.params as NormParamsUsage
            return (
              <div className="space-y-2">
                <ParamField sign="+" color="emerald" label="Добавить к счётчику"
                  value={addQty} unit={p.usageUnit}
                  onChange={v => { setAddQty(v); clearOthers('add') }} />
                <ParamField sign="=" color="blue" label="Установить значение"
                  value={setQty} unit={p.usageUnit}
                  onChange={v => { setSetQty(v); clearOthers('set') }} />
              </div>
            )
          })()}

          {/* stock */}
          {norm.type === 'stock' && (
            <div className="space-y-2">
              <ParamField sign="+" color="emerald" label="Пополнить"
                value={addQty} unit={unit}
                onChange={v => { setAddQty(v); clearOthers('add') }} />
              <ParamField sign="−" color="red" label="Списать"
                value={subtractQty} unit={unit}
                onChange={v => { setSubtractQty(v); clearOthers('subtract') }} />
              <ParamField sign="=" color="blue" label="Установить остаток"
                value={setQty} unit={unit}
                onChange={v => { setSetQty(v); clearOthers('set') }} />
            </div>
          )}

          {/* product */}
          {norm.type === 'product' && (() => {
            return (
              <div className="space-y-2">
                <ParamField sign="+" color="emerald" label="Пополнить запас"
                  value={addQty} unit={unit}
                  onChange={v => { setAddQty(v); clearOthers('add') }} />
                <ParamField sign="−" color="red" label="Списать"
                  value={subtractQty} unit={unit}
                  onChange={v => { setSubtractQty(v); clearOthers('subtract') }} />
                <ParamField sign="=" color="blue" label="Установить запас"
                  value={setQty} unit={unit}
                  onChange={v => { setSetQty(v); clearOthers('set') }} />
              </div>
            )
          })()}
        </div>

        {/* Impact preview */}
        <div className="rounded-xl bg-[#EEF2FF] border border-[#C7D4FF] px-4 py-3">
          <p className="text-xs font-semibold text-[#4F73F7] mb-0.5">Что изменится:</p>
          <p className="text-xs text-[#4A5578] leading-relaxed">{impactText}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Дата события</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input" />
          </div>
        </div>

        <div>
          <label className="label">Примечание</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
            placeholder="Дополнительные детали" className="input resize-none" />
        </div>

      </div>
    </Modal>
  )
}

interface ParamFieldProps {
  sign: string
  color: 'emerald' | 'red' | 'blue'
  label: string
  value: string
  unit: string
  onChange: (v: string) => void
}

function ParamField({ sign, color, label, value, unit, onChange }: ParamFieldProps) {
  const signStyles = {
    emerald: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    red:     'text-red-500 bg-red-50 border-red-200',
    blue:    'text-[#4F73F7] bg-[#EEF2FF] border-[#C7D4FF]',
  }[color]

  return (
    <div className="flex items-center gap-2">
      <span className={`w-6 h-6 rounded-lg border text-xs font-bold flex items-center justify-center shrink-0 ${signStyles}`}>
        {sign}
      </span>
      <span className="text-sm text-[#4A5578] w-40 shrink-0">{label}</span>
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="—"
        min={0}
        className="input flex-1 py-1.5 text-sm"
      />
      <span className="text-xs text-[#9BA8C0] shrink-0 w-8">{unit}</span>
    </div>
  )
}
