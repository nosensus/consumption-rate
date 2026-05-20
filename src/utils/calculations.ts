import { addDays, addMonths, addWeeks, addYears, differenceInDays, format, parseISO } from 'date-fns'
import {
  ConsumptionNorm, NormParamsTime, NormParamsUsage,
  NormParamsStock, NormParamsProduct,
} from '../types'

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  try {
    const d = typeof date === 'string' ? parseISO(date) : date
    return format(d, 'dd.MM.yyyy')
  } catch {
    return '—'
  }
}

function addWarning(date: Date, value: number, unit: 'days' | 'weeks' | 'months'): Date {
  if (unit === 'weeks') return addDays(date, -value * 7)
  if (unit === 'months') return addMonths(date, -value)
  return addDays(date, -value)
}

export interface CalcResult {
  eventDate: string | null
  notificationDate: string | null
  details: string
  daysLeft: number | null
  isEnough?: boolean
}

export function calculateNormDates(norm: ConsumptionNorm): { eventDate: string | null; notificationDate: string | null } {
  const result = calculate(norm)
  return { eventDate: result.eventDate, notificationDate: result.notificationDate }
}

export function calculate(norm: ConsumptionNorm): CalcResult {
  const today = new Date()
  let eventDate: Date | null = null
  let details = ''
  let isEnough: boolean | undefined

  if (norm.type === 'time') {
    const p = norm.params as NormParamsTime
    if (!p.startDate) return { eventDate: null, notificationDate: null, details: 'Укажите дату начала', daysLeft: null }
    const start = parseISO(p.startDate)
    if (p.lifeUnit === 'days') eventDate = addDays(start, p.lifeValue)
    else if (p.lifeUnit === 'weeks') eventDate = addWeeks(start, p.lifeValue)
    else if (p.lifeUnit === 'months') eventDate = addMonths(start, p.lifeValue)
    else if (p.lifeUnit === 'years') eventDate = addYears(start, p.lifeValue)
    details = `Срок службы: ${p.lifeValue} ${unitLabel(p.lifeUnit)} от ${formatDate(p.startDate)}`
  }

  if (norm.type === 'usage') {
    const p = norm.params as NormParamsUsage
    if (!p.lastReplacementDate) return { eventDate: null, notificationDate: null, details: 'Укажите дату последней замены', daysLeft: null }
    const last = parseISO(p.lastReplacementDate)
    const remaining = Math.max(p.totalResource - p.currentUsage, 0)
    const daysToGo = p.dailyUsage > 0 ? Math.ceil(remaining / p.dailyUsage) : 0
    eventDate = addDays(last, daysToGo)
    details = `Осталось ${remaining} ${p.usageUnit}. При расходе ${p.dailyUsage} ${p.usageUnit}/день — ~${daysToGo} дней.`
  }

  if (norm.type === 'stock') {
    const p = norm.params as NormParamsStock
    if (!p.stockDate) return { eventDate: null, notificationDate: null, details: 'Укажите дату учета', daysLeft: null }
    const stockDate = parseISO(p.stockDate)
    const usable = Math.max(p.currentStock - p.minStock, 0)
    const days = p.dailyConsumption > 0 ? Math.ceil(usable / p.dailyConsumption) : 0
    eventDate = addDays(stockDate, days)
    details = `Остаток: ${p.currentStock}. До минимума (${p.minStock}) ~${days} дней.`
  }

  if (norm.type === 'product') {
    const p = norm.params as NormParamsProduct
    if (!p.planDate) return { eventDate: null, notificationDate: null, details: 'Укажите дату плана', daysLeft: null }
    eventDate = parseISO(p.planDate)
    const need = p.outputPlan * p.resourcePerUnit
    isEnough = p.availableStock >= need
    details = `Потребность: ${need.toFixed(2)}. Остаток: ${p.availableStock}. ${isEnough ? 'Ресурса достаточно.' : 'Требуется пополнение!'}`
  }

  if (!eventDate) return { eventDate: null, notificationDate: null, details, daysLeft: null, isEnough }

  const notifDate = addWarning(eventDate, norm.warningValue, norm.warningUnit)
  const daysLeft = differenceInDays(eventDate, today)

  return {
    eventDate: format(eventDate, 'yyyy-MM-dd'),
    notificationDate: format(notifDate, 'yyyy-MM-dd'),
    details,
    daysLeft,
    isEnough,
  }
}

function unitLabel(unit: string): string {
  const map: Record<string, string> = { days: 'дней', weeks: 'недель', months: 'месяцев', years: 'лет' }
  return map[unit] ?? unit
}
