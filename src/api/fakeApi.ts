import {
  AccountingObject, ConsumptionNorm, NormEvent, Notification,
  ObjectType, Resource, ResourceTypeEntity, NormTypeEntity, NormStatus,
} from '../types'
import { calculateNormDates } from '../utils/calculations'

const STORAGE_KEY = 'consumption_norms_v2'

function delay(ms = 150): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
}

interface AppData {
  objectTypes: ObjectType[]
  resourceTypes: ResourceTypeEntity[]
  normTypes: NormTypeEntity[]
  objects: AccountingObject[]
  resources: Resource[]
  norms: ConsumptionNorm[]
  events: NormEvent[]
  notifications: Notification[]
}

const DEFAULT_DATA: AppData = {
  objectTypes: [
    { id: 'equipment', name: 'Оборудование',       icon: '⚙️', hint: 'Станки, машины, узлы',  isSystem: true },
    { id: 'stock',     name: 'Склад / остатки',    icon: '📦', hint: 'Сырье и запасы',          isSystem: true },
    { id: 'product',   name: 'Готовая продукция',  icon: '🏷️', hint: 'Расход на изделие',      isSystem: true },
    { id: 'line',      name: 'Линия / участок',    icon: '🏭', hint: 'Цех или линия',            isSystem: true },
    { id: 'transport', name: 'Транспорт / техника',icon: '🚚', hint: 'Пробег и ТО',             isSystem: true },
  ],
  resourceTypes: [
    { id: 'raw',        name: 'Сырьё',           icon: '🌿', isSystem: true },
    { id: 'consumable', name: 'Расходник',        icon: '🔩', isSystem: true },
    { id: 'spare',      name: 'Комплектующая',    icon: '⚙️', isSystem: true },
    { id: 'fluid',      name: 'Техн. жидкость',   icon: '💧', isSystem: true },
    { id: 'packaging',  name: 'Упаковка',         icon: '📦', isSystem: true },
    { id: 'other',      name: 'Другое',           icon: '📎', isSystem: true },
  ],
  normTypes: [
    { id: 'time',    name: 'По времени',           icon: '🗓️', description: 'Замените или обслужите через заданный срок после установки. Подходит для деталей с фиксированным ресурсом.',         calcMethod: 'time',    isSystem: true },
    { id: 'usage',   name: 'По счётчику',           icon: '📊', description: 'Норма зависит от пробега, моточасов или циклов. Точный учёт по фактическому использованию.',                         calcMethod: 'usage',   isSystem: true },
    { id: 'stock',   name: 'Контроль остатка',      icon: '📦', description: 'Напомнит, когда запас опустится ниже минимума. Подходит для материалов и расходников на складе.',                    calcMethod: 'stock',   isSystem: true },
    { id: 'product', name: 'На единицу продукции',  icon: '🏭', description: 'Рассчитывает потребность ресурса по плану выпуска.',                                                                   calcMethod: 'product', isSystem: true },
  ],
  objects: [
    {
      id: 'obj_rieter', name: 'Трепальная машина Rieter B123', typeId: 'equipment',
      location: 'Цех №2', responsible: 'Ибрагим Каримов', status: 'active',
      fields: [{ name: 'Моточасы', type: 'number' }], createdAt: new Date().toISOString(),
    },
    {
      id: 'obj_stock', name: 'Центральный склад сырья', typeId: 'stock',
      location: 'Складской блок', responsible: 'Снабженец', status: 'active',
      fields: [], createdAt: new Date().toISOString(),
    },
    {
      id: 'obj_syringe', name: 'Шприц 5 мл', typeId: 'product',
      location: 'Линия шприцев', responsible: 'Технолог', status: 'active',
      fields: [], createdAt: new Date().toISOString(),
    },
    {
      id: 'obj_line1', name: 'Линия производства шприцев №1', typeId: 'line',
      location: 'Цех №1', responsible: 'Начальник цеха', status: 'active',
      fields: [], createdAt: new Date().toISOString(),
    },
    {
      id: 'obj_car', name: 'Автомобиль Toyota Camry', typeId: 'transport',
      location: 'Автопарк', responsible: 'Водитель', status: 'active',
      fields: [{ name: 'Пробег', type: 'number' }], createdAt: new Date().toISOString(),
    },
  ],
  resources: [
    { id: 'res_bearing', name: 'Подшипник китайский', type: 'spare',      unit: 'шт',       supplier: 'ChinaBearings Ltd', comment: 'Для трепальной машины',     fields: [], createdAt: new Date().toISOString() },
    { id: 'res_oil',     name: 'Моторное масло 5W-40',type: 'fluid',      unit: 'л',        supplier: 'Castrol',            comment: 'Для транспорта',            fields: [], createdAt: new Date().toISOString() },
    { id: 'res_pp',      name: 'Полипропилен',         type: 'raw',        unit: 'тонна',    supplier: 'ПолимерТрейд',       comment: 'Для производства шприцев',  fields: [], createdAt: new Date().toISOString() },
    { id: 'res_filter',  name: 'Фильтр масляный',      type: 'consumable', unit: 'шт',       supplier: '',                   comment: 'Плановая замена',           fields: [], createdAt: new Date().toISOString() },
    { id: 'res_pack',    name: 'Упаковка картонная',   type: 'packaging',  unit: 'упаковка', supplier: 'УпакПром',           comment: 'Для готовой продукции',     fields: [], createdAt: new Date().toISOString() },
  ],
  norms: [
    {
      id: 'norm_bearing',
      name: 'Замена подшипника',
      objectId: 'obj_rieter',
      resourceId: 'res_bearing',
      type: 'time',
      params: { startDate: new Date(Date.now() - 60 * 24 * 3600000).toISOString().slice(0, 10), lifeValue: 4, lifeUnit: 'months' },
      warningValue: 30, warningUnit: 'days',
      recipient: 'Инженера',
      comment: 'Китайский подшипник, срок 4 месяца',
      status: 'active',
      eventDate: null, notificationDate: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    },
    {
      id: 'norm_oil',
      name: 'Замена моторного масла',
      objectId: 'obj_car',
      resourceId: 'res_oil',
      type: 'usage',
      params: { lastReplacementDate: new Date(Date.now() - 100 * 24 * 3600000).toISOString().slice(0, 10), totalResource: 10000, currentUsage: 5000, dailyUsage: 50, usageUnit: 'км' },
      warningValue: 7, warningUnit: 'days',
      recipient: 'Ответственного за объект',
      comment: '',
      status: 'active',
      eventDate: null, notificationDate: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    },
    {
      id: 'norm_pp',
      name: 'Контроль остатка полипропилена',
      objectId: 'obj_stock',
      resourceId: 'res_pp',
      type: 'stock',
      params: { stockDate: new Date().toISOString().slice(0, 10), currentStock: 3.5, dailyConsumption: 0.083, minStock: 1 },
      warningValue: 30, warningUnit: 'days',
      recipient: 'Снабженца',
      comment: 'Годовой объем закупки 10 тонн',
      status: 'active',
      eventDate: null, notificationDate: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    },
  ],
  events: [],
  notifications: [],
}

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return structuredClone(DEFAULT_DATA)
    const parsed = JSON.parse(raw) as Partial<AppData>
    return {
      objectTypes:   parsed.objectTypes   ?? DEFAULT_DATA.objectTypes,
      resourceTypes: parsed.resourceTypes ?? DEFAULT_DATA.resourceTypes,
      normTypes:     parsed.normTypes     ?? DEFAULT_DATA.normTypes,
      objects:       parsed.objects       ?? DEFAULT_DATA.objects,
      resources:     parsed.resources     ?? DEFAULT_DATA.resources,
      norms:         parsed.norms         ?? DEFAULT_DATA.norms,
      events:        parsed.events        ?? DEFAULT_DATA.events,
      notifications: parsed.notifications ?? DEFAULT_DATA.notifications,
    }
  } catch {
    return structuredClone(DEFAULT_DATA)
  }
}

function save(data: AppData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function computeNormDates(norm: ConsumptionNorm): ConsumptionNorm {
  const { eventDate, notificationDate } = calculateNormDates(norm)
  const today = new Date()
  let status: NormStatus = norm.status
  if (status === 'active' || status === 'overdue') {
    if (eventDate && new Date(eventDate) < today) {
      status = 'overdue'
    } else {
      status = 'active'
    }
  }
  return { ...norm, eventDate, notificationDate, status }
}

export const fakeApi = {
  async reset() {
    await delay()
    localStorage.removeItem(STORAGE_KEY)
    return load()
  },

  // Object Types
  async getObjectTypes(): Promise<ObjectType[]> {
    await delay()
    return load().objectTypes
  },

  // Resource Types
  async getResourceTypes(): Promise<ResourceTypeEntity[]> {
    await delay()
    return load().resourceTypes
  },

  async createResourceType(data: Omit<ResourceTypeEntity, 'id' | 'isSystem'>): Promise<ResourceTypeEntity> {
    await delay()
    const db = load()
    const item: ResourceTypeEntity = { ...data, id: uid('rtype'), isSystem: false }
    db.resourceTypes.push(item)
    save(db)
    return item
  },

  async updateResourceType(id: string, data: Partial<Pick<ResourceTypeEntity, 'name' | 'icon'>>): Promise<ResourceTypeEntity> {
    await delay()
    const db = load()
    const idx = db.resourceTypes.findIndex(t => t.id === id)
    if (idx === -1) throw new Error('ResourceType not found')
    db.resourceTypes[idx] = { ...db.resourceTypes[idx], ...data }
    save(db)
    return db.resourceTypes[idx]
  },

  async deleteResourceType(id: string): Promise<void> {
    await delay()
    const db = load()
    db.resourceTypes = db.resourceTypes.filter(t => t.id !== id)
    save(db)
  },

  // Object Types
  async createObjectType(data: Omit<ObjectType, 'id' | 'isSystem'>): Promise<ObjectType> {
    await delay()
    const db = load()
    const item: ObjectType = { ...data, id: uid('type'), isSystem: false }
    db.objectTypes.push(item)
    save(db)
    return item
  },

  async updateObjectType(id: string, data: Partial<Pick<ObjectType, 'name' | 'icon'>>): Promise<ObjectType> {
    await delay()
    const db = load()
    const idx = db.objectTypes.findIndex(t => t.id === id)
    if (idx === -1) throw new Error('ObjectType not found')
    db.objectTypes[idx] = { ...db.objectTypes[idx], ...data }
    save(db)
    return db.objectTypes[idx]
  },

  async deleteObjectType(id: string): Promise<void> {
    await delay()
    const db = load()
    db.objectTypes = db.objectTypes.filter(t => t.id !== id)
    save(db)
  },

  // Norm Types
  async getNormTypes(): Promise<NormTypeEntity[]> {
    await delay()
    return load().normTypes
  },

  async createNormType(data: Omit<NormTypeEntity, 'id' | 'isSystem'>): Promise<NormTypeEntity> {
    await delay()
    const db = load()
    const item: NormTypeEntity = { ...data, id: uid('ntype'), isSystem: false }
    db.normTypes.push(item)
    save(db)
    return item
  },

  async updateNormType(id: string, data: Partial<NormTypeEntity>): Promise<NormTypeEntity> {
    await delay()
    const db = load()
    const idx = db.normTypes.findIndex(t => t.id === id)
    if (idx === -1) throw new Error('NormType not found')
    db.normTypes[idx] = { ...db.normTypes[idx], ...data }
    save(db)
    return db.normTypes[idx]
  },

  async deleteNormType(id: string): Promise<void> {
    await delay()
    const db = load()
    db.normTypes = db.normTypes.filter(t => t.id !== id)
    save(db)
  },

  // Accounting Objects
  async getObjects(): Promise<AccountingObject[]> {
    await delay()
    return load().objects
  },

  async createObject(data: Omit<AccountingObject, 'id' | 'createdAt'>): Promise<AccountingObject> {
    await delay()
    const db = load()
    const item: AccountingObject = { ...data, id: uid('obj'), createdAt: new Date().toISOString() }
    db.objects.unshift(item)
    save(db)
    return item
  },

  async updateObject(id: string, data: Partial<AccountingObject>): Promise<AccountingObject> {
    await delay()
    const db = load()
    const idx = db.objects.findIndex(o => o.id === id)
    if (idx === -1) throw new Error('Object not found')
    db.objects[idx] = { ...db.objects[idx], ...data }
    save(db)
    return db.objects[idx]
  },

  async deleteObject(id: string): Promise<void> {
    await delay()
    const db = load()
    db.objects = db.objects.filter(o => o.id !== id)
    save(db)
  },

  // Resources
  async getResources(): Promise<Resource[]> {
    await delay()
    return load().resources
  },

  async createResource(data: Omit<Resource, 'id' | 'createdAt'>): Promise<Resource> {
    await delay()
    const db = load()
    const item: Resource = { ...data, id: uid('res'), createdAt: new Date().toISOString() }
    db.resources.unshift(item)
    save(db)
    return item
  },

  async updateResource(id: string, data: Partial<Resource>): Promise<Resource> {
    await delay()
    const db = load()
    const idx = db.resources.findIndex(r => r.id === id)
    if (idx === -1) throw new Error('Resource not found')
    db.resources[idx] = { ...db.resources[idx], ...data }
    save(db)
    return db.resources[idx]
  },

  async deleteResource(id: string): Promise<void> {
    await delay()
    const db = load()
    db.resources = db.resources.filter(r => r.id !== id)
    save(db)
  },

  // Norms
  async getNorms(): Promise<ConsumptionNorm[]> {
    await delay()
    const db = load()
    const computed = db.norms.map(computeNormDates)
    return computed
  },

  async getNorm(id: string): Promise<ConsumptionNorm | null> {
    await delay()
    const db = load()
    const norm = db.norms.find(n => n.id === id)
    return norm ? computeNormDates(norm) : null
  },

  async createNorm(data: Omit<ConsumptionNorm, 'id' | 'createdAt' | 'updatedAt' | 'eventDate' | 'notificationDate'>): Promise<ConsumptionNorm> {
    await delay()
    const db = load()
    const raw: ConsumptionNorm = {
      ...data,
      id: uid('norm'),
      eventDate: null,
      notificationDate: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const norm = computeNormDates(raw)
    db.norms.unshift(norm)
    save(db)
    return norm
  },

  async updateNorm(id: string, data: Partial<ConsumptionNorm>): Promise<ConsumptionNorm> {
    await delay()
    const db = load()
    const idx = db.norms.findIndex(n => n.id === id)
    if (idx === -1) throw new Error('Norm not found')
    const updated = computeNormDates({ ...db.norms[idx], ...data, updatedAt: new Date().toISOString() })
    db.norms[idx] = updated
    save(db)
    return updated
  },

  async deleteNorm(id: string): Promise<void> {
    await delay()
    const db = load()
    db.norms = db.norms.filter(n => n.id !== id)
    db.events = db.events.filter(e => e.normId !== id)
    save(db)
  },

  // Events
  async getEvents(normId?: string): Promise<NormEvent[]> {
    await delay()
    const db = load()
    return normId ? db.events.filter(e => e.normId === normId) : db.events
  },

  async createEvent(data: Omit<NormEvent, 'id' | 'createdAt'>): Promise<NormEvent> {
    await delay()
    const db = load()
    const event: NormEvent = { ...data, id: uid('evt'), createdAt: new Date().toISOString() }
    db.events.unshift(event)

    const normIdx = db.norms.findIndex(n => n.id === data.normId)
    if (normIdx !== -1) {
      const norm = db.norms[normIdx]

      if (data.effect === 'reset') {
        if (norm.type === 'time') {
          (norm.params as { startDate: string }).startDate = data.date
        } else if (norm.type === 'usage') {
          const p = norm.params as { lastReplacementDate: string; currentUsage: number }
          p.lastReplacementDate = data.date
          p.currentUsage = 0
        }
      }

      if (data.effect === 'add' && data.quantity !== null) {
        if (norm.type === 'stock') {
          (norm.params as { currentStock: number }).currentStock += data.quantity
        } else if (norm.type === 'usage') {
          (norm.params as { currentUsage: number }).currentUsage += data.quantity
        } else if (norm.type === 'product') {
          (norm.params as { availableStock: number }).availableStock += data.quantity
        }
      }

      if (data.effect === 'subtract' && data.quantity !== null) {
        if (norm.type === 'stock') {
          const p = norm.params as { currentStock: number }
          p.currentStock = Math.max(0, p.currentStock - data.quantity)
        } else if (norm.type === 'usage') {
          const p = norm.params as { currentUsage: number }
          p.currentUsage = Math.max(0, p.currentUsage - data.quantity)
        } else if (norm.type === 'product') {
          const p = norm.params as { availableStock: number }
          p.availableStock = Math.max(0, p.availableStock - data.quantity)
        }
      }

      if (data.effect === 'set_value' && data.quantity !== null) {
        if (norm.type === 'usage') {
          (norm.params as { currentUsage: number }).currentUsage = data.quantity
        } else if (norm.type === 'stock') {
          (norm.params as { currentStock: number }).currentStock = data.quantity
        } else if (norm.type === 'product') {
          (norm.params as { availableStock: number }).availableStock = data.quantity
        }
      }

      if (data.effect !== 'none') {
        db.norms[normIdx] = computeNormDates({ ...norm, updatedAt: new Date().toISOString() })
      }
    }

    save(db)
    return event
  },

  // Notifications
  async getNotifications(): Promise<Notification[]> {
    await delay()
    return load().notifications
  },

  async markNotificationRead(id: string): Promise<void> {
    await delay()
    const db = load()
    const idx = db.notifications.findIndex(n => n.id === id)
    if (idx !== -1) db.notifications[idx].status = 'read'
    save(db)
  },
}
