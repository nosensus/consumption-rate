export type ObjectTypeId = string

export interface ObjectType {
  id: ObjectTypeId
  name: string
  icon: string
  hint: string
  isSystem: boolean
}

export type AccountingObjectStatus = 'active' | 'archived'

export interface CustomField {
  name: string
  type: 'text' | 'number' | 'date' | 'list' | 'file'
  value?: string
}

export interface AccountingObject {
  id: string
  name: string
  typeId: ObjectTypeId
  location: string
  responsible: string
  status: AccountingObjectStatus
  fields: CustomField[]
  createdAt: string
}

export type ResourceType = 'raw' | 'consumable' | 'spare' | 'fluid' | 'packaging' | 'other'

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  raw: 'Сырье',
  consumable: 'Расходник',
  spare: 'Комплектующая',
  fluid: 'Техническая жидкость',
  packaging: 'Упаковка',
  other: 'Другое',
}

export interface ResourceTypeEntity {
  id: string
  name: string
  icon: string
  isSystem: boolean
}

export interface Resource {
  id: string
  name: string
  type: string
  unit: string
  supplier: string
  comment: string
  fields: CustomField[]
  createdAt: string
}

export type NormType = 'time' | 'usage' | 'stock' | 'product'

export const NORM_TYPE_LABELS: Record<NormType, string> = {
  time: 'По времени',
  usage: 'По счётчику',
  stock: 'Контроль остатка',
  product: 'На единицу продукции',
}

export interface NormTypeEntity {
  id: string
  name: string
  icon: string
  description: string
  calcMethod: NormType
  isSystem: boolean
}

export type NormStatus = 'draft' | 'active' | 'paused' | 'overdue' | 'completed' | 'archived'

export const NORM_STATUS_LABELS: Record<NormStatus, string> = {
  draft: 'Черновик',
  active: 'Активна',
  paused: 'Приостановлена',
  overdue: 'Просрочена',
  completed: 'Выполнена',
  archived: 'Архивная',
}

export interface NormParamsTime {
  startDate: string
  lifeValue: number
  lifeUnit: 'days' | 'weeks' | 'months' | 'years'
}

export interface NormParamsUsage {
  lastReplacementDate: string
  totalResource: number
  currentUsage: number
  dailyUsage: number
  usageUnit: string
}

export interface NormParamsStock {
  stockDate: string
  currentStock: number
  dailyConsumption: number
  minStock: number
}

export interface NormParamsProduct {
  planDate: string
  outputPlan: number
  resourcePerUnit: number
  availableStock: number
}

export interface ConsumptionNorm {
  id: string
  name: string
  objectId: string
  resourceId: string
  type: NormType
  params: NormParamsTime | NormParamsUsage | NormParamsStock | NormParamsProduct
  warningValue: number
  warningUnit: 'days' | 'weeks' | 'months'
  recipient: string
  comment: string
  status: NormStatus
  eventDate: string | null
  notificationDate: string | null
  createdAt: string
  updatedAt: string
}

export type EventEffect = 'reset' | 'add' | 'subtract' | 'set_value' | 'none'

export const EVENT_EFFECT_ICONS: Record<EventEffect, string> = {
  reset: '🔧', add: '📥', subtract: '📤', set_value: '⚙️', none: '✏️',
}

export const EVENT_EFFECT_LABELS: Record<EventEffect, string> = {
  reset: 'Сброс', add: 'Пополнение', subtract: 'Расход', set_value: 'Установка', none: 'Запись',
}

export interface NormEvent {
  id: string
  normId: string
  name: string
  effect: EventEffect
  quantity: number | null
  unit: string
  date: string
  note: string
  createdAt: string
}

export type NotificationStatus = 'pending' | 'sent' | 'read' | 'snoozed' | 'closed'

export interface Notification {
  id: string
  normId: string
  type: string
  message: string
  eventDate: string
  scheduledDate: string
  status: NotificationStatus
  priority: 'low' | 'medium' | 'high' | 'critical'
  createdAt: string
}
