import { CostRow, CostProduct, CalcType, RowCalcResult } from './types'

// Group A: normWithLoss = normPerUnit × (1 + lossPercent/100)
//          costPerUnit = normWithLoss × price
//          costTotal = costPerUnit × outputVolume
//
// Б1 (амортизация): costPerPeriod = qty × price / serviceLifeMonths × periodMonths
//                   costPerUnit = costPerPeriod / outputVolume
//
// Б2 (циклы): costPerUnit = qty × price / serviceLifeCycles
//             costPerPeriod = costPerUnit × outputVolume
//
// Б3-Б8 (период): costPerPeriod = qtyPerPeriod × price
//                 costPerUnit = costPerPeriod / outputVolume

export function calcRow(row: CostRow, calcType: CalcType, product: CostProduct): RowCalcResult {
  const { outputVolume, periodMonths } = product

  if (calcType === 'groupA') {
    const intermediate = row.field1 != null
      ? row.field1 * (1 + (row.field2 ?? 0) / 100)
      : null
    const costPerUnit = intermediate != null && row.price != null
      ? intermediate * row.price
      : null
    const costPerPeriod = costPerUnit != null ? costPerUnit * outputVolume : null
    return { intermediate, costPerUnit, costPerPeriod }
  }

  if (calcType === 'b1_amortization') {
    const costPerPeriod =
      row.field1 != null && row.price != null && row.field2 != null && row.field2 > 0
        ? (row.field1 * row.price / row.field2) * periodMonths
        : null
    const costPerUnit = costPerPeriod != null && outputVolume > 0 ? costPerPeriod / outputVolume : null
    return { intermediate: null, costPerUnit, costPerPeriod }
  }

  if (calcType === 'b2_cycles') {
    const costPerUnit =
      row.field1 != null && row.price != null && row.field2 != null && row.field2 > 0
        ? row.field1 * row.price / row.field2
        : null
    const costPerPeriod = costPerUnit != null ? costPerUnit * outputVolume : null
    return { intermediate: null, costPerUnit, costPerPeriod }
  }

  // b_period (Б3–Б8)
  const costPerPeriod = row.field1 != null && row.price != null ? row.field1 * row.price : null
  const costPerUnit = costPerPeriod != null && outputVolume > 0 ? costPerPeriod / outputVolume : null
  return { intermediate: null, costPerUnit, costPerPeriod }
}

export function calcCategoryTotal(rows: CostRow[], calcType: CalcType, product: CostProduct) {
  let totalPerUnit = 0
  let totalPerPeriod = 0
  for (const row of rows) {
    const r = calcRow(row, calcType, product)
    if (r.costPerUnit != null && r.costPerUnit > 0) totalPerUnit += r.costPerUnit
    if (r.costPerPeriod != null && r.costPerPeriod > 0) totalPerPeriod += r.costPerPeriod
  }
  return { totalPerUnit, totalPerPeriod }
}

export function fmtNum(val: number | null, decimals = 4): string {
  if (val == null) return '—'
  if (val === 0) return '0'
  return val.toFixed(decimals).replace(/\.?0+$/, '')
}

export function fmtCurrency(val: number | null, sym?: string): string {
  if (val == null) return '—'
  const num = val.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return sym ? `${num} ${sym}` : num
}
