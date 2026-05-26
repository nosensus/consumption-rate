export interface CostProduct {
  name: string
  article: string
  unit: string
  currency: string
  outputVolume: number
  period: string
  periodMonths: number
  workingDays: number
  workingHours: number
  staffCount: number
  equipmentCount: number
  date: string
  responsible: string
}

export type CalcType = 'groupA' | 'b1_amortization' | 'b2_cycles' | 'b_period'

export interface CostRow {
  id: string
  subcategory: string
  name: string
  article: string
  unit: string
  // Group A: field1 = normPerUnit, field2 = % потерь (0–100)
  // B1: field1 = кол-во единиц, field2 = срок службы (мес)
  // B2: field1 = кол-во единиц, field2 = ресурс (циклов)
  // B3-B8: field1 = расход за период, field2 = интервал (справочно)
  field1: number | null
  field2: number | null
  price: number | null
  supplier: string
  note: string
}

export interface CategoryDef {
  id: string
  group: 'A' | 'B'
  code: string
  label: string
  fullLabel: string
  description: string
  calcType: CalcType
  field1Label: string
  field2Label: string | null
  field2Unit: string
  costCalcNote: string
}

export interface RowCalcResult {
  intermediate: number | null  // normWithLoss для группы А
  costPerUnit: number | null
  costPerPeriod: number | null
}

export interface CostNormSummaryRow {
  catId: string
  catCode: string
  catLabel: string
  group: 'A' | 'B' | 'custom'
  totalPerUnit: number
  totalPerPeriod: number
}

export interface WizardState {
  selectedGroup: 'A' | 'B'
  rows: Record<string, CostRow[]>
  enabled: Record<string, boolean>
  customCats: Array<{ id: string; name: string; rows: CostRow[]; group: 'A' | 'B' }>
  catConverters: Record<string, { currency: string; rate: number }>
}

export interface EquipmentNorm {
  id: string
  name: string
  description: string
  currency: string
  rows: Record<string, CostRow[]>
  enabled: Record<string, boolean>
  catConverters: Record<string, { currency: string; rate: number }>
  createdAt: string
  // Дополнительные поля, заполняемые в CostWizard (Группа Б)
  product?: CostProduct
  notificationDate?: string | null
  recipient?: string
  note?: string
  wizardState?: WizardState
}

export interface CostNorm {
  id: string
  product: CostProduct
  summaryRows: CostNormSummaryRow[]
  grandUnit: number
  grandPeriod: number
  notificationDate: string | null
  recipient: string
  note: string
  createdAt: string
  wizardState?: WizardState
  linkedEquipmentIds?: string[]
}
