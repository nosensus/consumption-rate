import { create } from 'zustand'
import { AccountingObject, ConsumptionNorm, NormEvent, ObjectType, Resource, ResourceTypeEntity, NormTypeEntity } from '../types'
import { CostNorm, EquipmentNorm } from '../pages/CostWizard/types'
import { DEMO_COST_NORMS, DEMO_EQUIPMENT_NORMS } from '../pages/CostWizard/demoData'
import { fakeApi } from '../api/fakeApi'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error'
}

interface StoreState {
  objectTypes: ObjectType[]
  resourceTypes: ResourceTypeEntity[]
  normTypes: NormTypeEntity[]
  objects: AccountingObject[]
  resources: Resource[]
  norms: ConsumptionNorm[]
  events: NormEvent[]
  costNorms: CostNorm[]
  equipmentNorms: EquipmentNorm[]
  toasts: Toast[]
  loading: boolean

  loadAll: () => Promise<void>
  addObjectType: (data: Omit<ObjectType, 'id' | 'isSystem'>) => Promise<ObjectType>
  updateObjectType: (id: string, data: Partial<Pick<ObjectType, 'name' | 'icon'>>) => Promise<void>
  deleteObjectType: (id: string) => Promise<void>
  addResourceType: (data: Omit<ResourceTypeEntity, 'id' | 'isSystem'>) => Promise<ResourceTypeEntity>
  updateResourceType: (id: string, data: Partial<Pick<ResourceTypeEntity, 'name' | 'icon'>>) => Promise<void>
  deleteResourceType: (id: string) => Promise<void>
  addNormType: (data: Omit<NormTypeEntity, 'id' | 'isSystem'>) => Promise<NormTypeEntity>
  updateNormType: (id: string, data: Partial<NormTypeEntity>) => Promise<void>
  deleteNormType: (id: string) => Promise<void>
  addObject: (data: Omit<AccountingObject, 'id' | 'createdAt'>) => Promise<AccountingObject>
  updateObject: (id: string, data: Partial<AccountingObject>) => Promise<void>
  deleteObject: (id: string) => Promise<void>
  addResource: (data: Omit<Resource, 'id' | 'createdAt'>) => Promise<Resource>
  updateResource: (id: string, data: Partial<Resource>) => Promise<void>
  deleteResource: (id: string) => Promise<void>
  addNorm: (data: Omit<ConsumptionNorm, 'id' | 'createdAt' | 'updatedAt' | 'eventDate' | 'notificationDate'>) => Promise<ConsumptionNorm>
  updateNorm: (id: string, data: Partial<ConsumptionNorm>) => Promise<void>
  deleteNorm: (id: string) => Promise<void>
  addEvent: (data: Omit<NormEvent, 'id' | 'createdAt'>) => Promise<void>
  addCostNorm: (data: Omit<CostNorm, 'id' | 'createdAt'>) => void
  updateCostNorm: (id: string, data: Partial<Omit<CostNorm, 'id' | 'createdAt'>>) => void
  deleteCostNorm: (id: string) => void
  addEquipmentNorm: (data: Omit<EquipmentNorm, 'id' | 'createdAt'>) => EquipmentNorm
  updateEquipmentNorm: (id: string, data: Partial<Omit<EquipmentNorm, 'id' | 'createdAt'>>) => void
  deleteEquipmentNorm: (id: string) => void
  linkEquipmentToProducts: (equipmentId: string, productIds: string[]) => void
  reset: () => Promise<void>
  showToast: (message: string, type?: 'success' | 'error') => void
  dismissToast: (id: string) => void
}

export const useStore = create<StoreState>((set, get) => ({
  objectTypes: [],
  resourceTypes: [],
  normTypes: [],
  objects: [],
  resources: [],
  norms: [],
  events: [],
  costNorms: DEMO_COST_NORMS,
  equipmentNorms: DEMO_EQUIPMENT_NORMS,
  toasts: [],
  loading: false,

  loadAll: async () => {
    set({ loading: true })
    const [objectTypes, resourceTypes, normTypes, objects, resources, norms, events] = await Promise.all([
      fakeApi.getObjectTypes(),
      fakeApi.getResourceTypes(),
      fakeApi.getNormTypes(),
      fakeApi.getObjects(),
      fakeApi.getResources(),
      fakeApi.getNorms(),
      fakeApi.getEvents(),
    ])
    set({ objectTypes, resourceTypes, normTypes, objects, resources, norms, events, loading: false })
  },

  addObjectType: async (data) => {
    const item = await fakeApi.createObjectType(data)
    set(s => ({ objectTypes: [...s.objectTypes, item] }))
    return item
  },

  updateObjectType: async (id, data) => {
    const item = await fakeApi.updateObjectType(id, data)
    set(s => ({ objectTypes: s.objectTypes.map(t => t.id === id ? item : t) }))
  },

  deleteObjectType: async (id) => {
    await fakeApi.deleteObjectType(id)
    set(s => ({ objectTypes: s.objectTypes.filter(t => t.id !== id) }))
  },

  addResourceType: async (data) => {
    const item = await fakeApi.createResourceType(data)
    set(s => ({ resourceTypes: [...s.resourceTypes, item] }))
    return item
  },

  updateResourceType: async (id, data) => {
    const item = await fakeApi.updateResourceType(id, data)
    set(s => ({ resourceTypes: s.resourceTypes.map(t => t.id === id ? item : t) }))
  },

  deleteResourceType: async (id) => {
    await fakeApi.deleteResourceType(id)
    set(s => ({ resourceTypes: s.resourceTypes.filter(t => t.id !== id) }))
  },

  addNormType: async (data) => {
    const item = await fakeApi.createNormType(data)
    set(s => ({ normTypes: [...s.normTypes, item] }))
    return item
  },

  updateNormType: async (id, data) => {
    const item = await fakeApi.updateNormType(id, data)
    set(s => ({ normTypes: s.normTypes.map(t => t.id === id ? item : t) }))
  },

  deleteNormType: async (id) => {
    await fakeApi.deleteNormType(id)
    set(s => ({ normTypes: s.normTypes.filter(t => t.id !== id) }))
  },

  addObject: async (data) => {
    const item = await fakeApi.createObject(data)
    set(s => ({ objects: [item, ...s.objects] }))
    get().showToast(`Объект «${item.name}» добавлен`)
    return item
  },

  updateObject: async (id, data) => {
    const item = await fakeApi.updateObject(id, data)
    set(s => ({ objects: s.objects.map(o => o.id === id ? item : o) }))
    get().showToast('Объект обновлён')
  },

  deleteObject: async (id) => {
    await fakeApi.deleteObject(id)
    set(s => ({ objects: s.objects.filter(o => o.id !== id) }))
    get().showToast('Объект удалён')
  },

  addResource: async (data) => {
    const item = await fakeApi.createResource(data)
    set(s => ({ resources: [item, ...s.resources] }))
    get().showToast(`Ресурс «${item.name}» добавлен`)
    return item
  },

  updateResource: async (id, data) => {
    const item = await fakeApi.updateResource(id, data)
    set(s => ({ resources: s.resources.map(r => r.id === id ? item : r) }))
    get().showToast('Ресурс обновлён')
  },

  deleteResource: async (id) => {
    await fakeApi.deleteResource(id)
    set(s => ({ resources: s.resources.filter(r => r.id !== id) }))
    get().showToast('Ресурс удалён')
  },

  addNorm: async (data) => {
    const item = await fakeApi.createNorm(data)
    set(s => ({ norms: [item, ...s.norms] }))
    get().showToast(`Норма «${item.name}» создана`)
    return item
  },

  updateNorm: async (id, data) => {
    const item = await fakeApi.updateNorm(id, data)
    set(s => ({ norms: s.norms.map(n => n.id === id ? item : n) }))
    get().showToast('Норма обновлена')
  },

  deleteNorm: async (id) => {
    await fakeApi.deleteNorm(id)
    set(s => ({
      norms: s.norms.filter(n => n.id !== id),
      events: s.events.filter(e => e.normId !== id),
    }))
    get().showToast('Норма удалена')
  },

  addEvent: async (data) => {
    const event = await fakeApi.createEvent(data)
    const updatedNorm = await fakeApi.getNorm(data.normId)
    set(s => ({
      events: [event, ...s.events],
      norms: updatedNorm ? s.norms.map(n => n.id === data.normId ? updatedNorm : n) : s.norms,
    }))
    get().showToast('Событие зафиксировано')
  },

  addCostNorm: (data) => {
    const norm: CostNorm = {
      ...data,
      id: Math.random().toString(36).slice(2),
      createdAt: new Date().toISOString(),
    }
    set(s => ({ costNorms: [norm, ...s.costNorms] }))
    get().showToast(`Норма расходов «${norm.product.name || 'Продукт'}» сохранена`)
  },

  updateCostNorm: (id, data) => {
    set(s => ({ costNorms: s.costNorms.map(n => n.id === id ? { ...n, ...data } : n) }))
  },

  deleteCostNorm: (id) => {
    set(s => ({ costNorms: s.costNorms.filter(n => n.id !== id) }))
    get().showToast('Норма удалена')
  },

  addEquipmentNorm: (data) => {
    const norm: EquipmentNorm = {
      ...data,
      id: Math.random().toString(36).slice(2),
      createdAt: new Date().toISOString(),
    }
    set(s => ({ equipmentNorms: [norm, ...s.equipmentNorms] }))
    get().showToast(`Оборудование «${norm.name || 'Норма Гр.Б'}» сохранено`)
    return norm
  },

  linkEquipmentToProducts: (equipmentId, productIds) => {
    set(s => ({
      costNorms: s.costNorms.map(n => {
        const linked = n.linkedEquipmentIds ?? []
        const shouldLink = productIds.includes(n.id)
        if (shouldLink && !linked.includes(equipmentId)) {
          return { ...n, linkedEquipmentIds: [...linked, equipmentId] }
        } else if (!shouldLink && linked.includes(equipmentId)) {
          return { ...n, linkedEquipmentIds: linked.filter(id => id !== equipmentId) }
        }
        return n
      }),
    }))
  },

  updateEquipmentNorm: (id, data) => {
    set(s => ({ equipmentNorms: s.equipmentNorms.map(n => n.id === id ? { ...n, ...data } : n) }))
    get().showToast('Оборудование обновлено')
  },

  deleteEquipmentNorm: (id) => {
    set(s => ({
      equipmentNorms: s.equipmentNorms.filter(n => n.id !== id),
      costNorms: s.costNorms.map(n => ({
        ...n,
        linkedEquipmentIds: (n.linkedEquipmentIds ?? []).filter(eid => eid !== id),
      })),
    }))
    get().showToast('Оборудование удалено')
  },

  reset: async () => {
    await fakeApi.reset()
    await get().loadAll()
    get().showToast('Данные сброшены до демо-значений')
  },

  showToast: (message, type = 'success') => {
    const id = Math.random().toString(36).slice(2)
    set(s => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => get().dismissToast(id), 3000)
  },

  dismissToast: (id) => {
    set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }))
  },
}))
