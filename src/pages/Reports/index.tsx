import { useState, useMemo } from 'react'
import { ChevronLeft, FileBarChart2, ClipboardList } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { CostNorm, CostRow, CategoryDef, EquipmentNorm } from '../CostWizard/types'
import { CATEGORIES } from '../CostWizard/templates'
import { calcRow } from '../CostWizard/formulas'

// ── helpers ──────────────────────────────────────────────────────────────────

const CURRENCY_SYMBOLS: Record<string, string> = {
  UZS: 'сум', USD: '$', EUR: '€', CNY: '¥', RUB: '₽',
}
function sym(code: string) { return CURRENCY_SYMBOLS[code] ?? code }

function fmtMoney(v: number, decimals = 2) {
  return v.toLocaleString('ru-RU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}
function fmtQty(v: number) {
  if (v === 0) return '0'
  if (v >= 1_000_000) return (v / 1_000_000).toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + ' М'
  if (v >= 1_000) return v.toLocaleString('ru-RU', { maximumFractionDigits: 1 })
  return v.toLocaleString('ru-RU', { maximumFractionDigits: 4 }).replace(/\.?0+$/, '')
}
function fmtNorm(v: number) {
  if (v === 0) return '0'
  return v.toFixed(8).replace(/\.?0+$/, '')
}

// ── Report catalogue ──────────────────────────────────────────────────────────

type ReportType = 'svodka' | 'potrebnost'

const REPORT_TYPES: { id: ReportType; label: string; Icon: React.ElementType; description: string }[] = [
  { id: 'svodka',     label: 'Сводка по категориям',     Icon: FileBarChart2,  description: 'Полная разбивка затрат по статьям с построчными данными' },
  { id: 'potrebnost', label: 'Потребность в материалах', Icon: ClipboardList,  description: 'Расчёт физической и стоимостной потребности в сырье' },
]

// ── Svodka: row-level data per category ──────────────────────────────────────

type CatSection = {
  cat: CategoryDef
  rows: Array<{ row: CostRow; costPerUnit: number | null; costPerPeriod: number | null; intermediate: number | null }>
  totalPerUnit: number
  totalPerPeriod: number
}

function buildSvodkaSections(norm: CostNorm, equipmentNorms: EquipmentNorm[]): CatSection[] | null {
  const ws = norm.wizardState
  if (!ws) return null

  const result: CatSection[] = []

  // Local rows from wizard
  for (const cat of CATEGORIES) {
    if (!ws.enabled[cat.id]) continue
    const catRows: CostRow[] = ws.rows[cat.id] ?? []
    const named = catRows.filter(r => r.name)
    if (named.length === 0) continue

    const conv = ws.catConverters?.[cat.id]
    const mult = conv?.currency && conv.rate > 0 ? conv.rate : 1

    const computed = named.map(r => {
      const effRow = mult !== 1 && r.price != null ? { ...r, price: r.price * mult } : r
      const calc = calcRow(effRow, cat.calcType, norm.product)
      return { row: effRow, costPerUnit: calc.costPerUnit, costPerPeriod: calc.costPerPeriod, intermediate: calc.intermediate }
    })

    const totalPerUnit = computed.reduce((s, c) => s + (c.costPerUnit ?? 0), 0)
    const totalPerPeriod = computed.reduce((s, c) => s + (c.costPerPeriod ?? 0), 0)
    result.push({ cat, rows: computed, totalPerUnit, totalPerPeriod })
  }

  // Linked equipment contributions
  for (const eqId of (norm.linkedEquipmentIds ?? [])) {
    const eq = equipmentNorms.find(e => e.id === eqId)
    if (!eq) continue

    for (const cat of CATEGORIES) {
      if (cat.group !== 'B' || !eq.enabled[cat.id]) continue
      const catRows: CostRow[] = eq.rows[cat.id] ?? []
      const named = catRows.filter(r => r.name)
      if (named.length === 0) continue

      const conv = eq.catConverters?.[cat.id]
      const mult = conv?.currency && conv.rate > 0 ? conv.rate : 1

      const computed = named.map(r => {
        const effRow = mult !== 1 && r.price != null ? { ...r, price: r.price * mult } : r
        const calc = calcRow(effRow, cat.calcType, norm.product)
        return { row: effRow, costPerUnit: calc.costPerUnit, costPerPeriod: calc.costPerPeriod, intermediate: calc.intermediate }
      })

      const totalPerUnit = computed.reduce((s, c) => s + (c.costPerUnit ?? 0), 0)
      const totalPerPeriod = computed.reduce((s, c) => s + (c.costPerPeriod ?? 0), 0)

      // Merge with existing section for same cat if present
      const existing = result.find(s => s.cat.id === cat.id)
      if (existing) {
        existing.rows.push(...computed)
        existing.totalPerUnit += totalPerUnit
        existing.totalPerPeriod += totalPerPeriod
      } else {
        result.push({ cat, rows: computed, totalPerUnit, totalPerPeriod })
      }
    }
  }

  return result
}

// Group A category table
function GroupATable({ section, currency, outputVolume, productUnit }: {
  section: CatSection; currency: string; outputVolume: number; productUnit: string
}) {
  const { cat, rows, totalPerUnit, totalPerPeriod } = section
  return (
    <div className="card overflow-hidden mb-3">
      <div className="px-4 py-2.5 bg-[#EEF2FF] border-b border-[#C7D4FF] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-[#4F73F7]/15 text-[#4F73F7]">{cat.code}</span>
          <span className="text-sm font-semibold text-[#1A1F3C]">{cat.label}</span>
        </div>
        <div className="text-right">
          <span className="text-xs font-bold text-[#4F73F7]">{fmtMoney(totalPerUnit)} {currency}/{productUnit}</span>
          <span className="text-xs text-[#9BA8C0] ml-2">({fmtMoney(totalPerPeriod)} {currency}/период)</span>
        </div>
      </div>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-[#F8F9FF] border-b border-[#E8EBF7]">
            <th className="px-3 py-2 text-left text-[#9BA8C0] font-semibold w-[220px]">Наименование</th>
            <th className="px-3 py-2 text-left text-[#9BA8C0] font-semibold w-20">Артикул</th>
            <th className="px-3 py-2 text-center text-[#9BA8C0] font-semibold w-10">Ед.</th>
            <th className="px-3 py-2 text-right text-[#9BA8C0] font-semibold">Норма на 1 {productUnit}</th>
            <th className="px-3 py-2 text-right text-[#9BA8C0] font-semibold">% пот.</th>
            <th className="px-3 py-2 text-right text-[#9BA8C0] font-semibold bg-[#EEF2FF]/60">Норма с пот.</th>
            <th className="px-3 py-2 text-right text-[#9BA8C0] font-semibold bg-[#EEF2FF]/60">Потребн. за период</th>
            <th className="px-3 py-2 text-right text-[#9BA8C0] font-semibold">Цена</th>
            <th className="px-3 py-2 text-right text-[#9BA8C0] font-semibold">Стоим./{productUnit}</th>
            <th className="px-3 py-2 text-right text-[#9BA8C0] font-semibold bg-emerald-50/60 text-emerald-600">Стоим./период</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ row, costPerUnit, costPerPeriod, intermediate }, i) => {
            const totalNeed = intermediate != null ? intermediate * outputVolume : null
            return (
              <tr key={i} className="border-b border-[#F0F2FA] hover:bg-[#FAFBFF]">
                <td className="px-3 py-2 font-medium text-[#1A1F3C]">{row.name}</td>
                <td className="px-3 py-2 text-[#9BA8C0]">{row.article || '—'}</td>
                <td className="px-3 py-2 text-center text-[#4A5578]">{row.unit}</td>
                <td className="px-3 py-2 text-right font-mono text-[#4A5578]">
                  {row.field1 != null ? fmtNorm(row.field1) : '—'}
                </td>
                <td className="px-3 py-2 text-right text-[#4A5578]">
                  {row.field2 != null ? `${row.field2}%` : '—'}
                </td>
                <td className="px-3 py-2 text-right font-mono text-[#4F73F7] bg-[#EEF2FF]/40 font-semibold">
                  {intermediate != null ? fmtNorm(intermediate) : '—'}
                </td>
                <td className="px-3 py-2 text-right font-mono bg-[#EEF2FF]/40">
                  {totalNeed != null ? (
                    <span className="font-bold text-[#4F73F7]">
                      {fmtQty(totalNeed)} <span className="font-normal text-[#9BA8C0]">{row.unit}</span>
                    </span>
                  ) : '—'}
                </td>
                <td className="px-3 py-2 text-right font-mono text-[#4A5578]">
                  {row.price != null ? fmtMoney(row.price) : '—'}
                </td>
                <td className="px-3 py-2 text-right font-mono text-[#4A5578]">
                  {costPerUnit != null ? fmtMoney(costPerUnit) : '—'}
                </td>
                <td className="px-3 py-2 text-right font-mono bg-emerald-50/40">
                  {costPerPeriod != null ? (
                    <span className="font-semibold text-emerald-700">
                      {fmtMoney(costPerPeriod)} <span className="font-normal text-[#9BA8C0] text-[10px]">{currency}</span>
                    </span>
                  ) : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
        {rows.length > 1 && (
          <tfoot>
            <tr className="bg-[#F0F2FA] border-t border-[#C7D4FF]">
              <td colSpan={8} className="px-3 py-2 font-bold text-[#4F73F7] text-xs">Итого {cat.code}</td>
              <td className="px-3 py-2 text-right font-bold font-mono text-[#4F73F7] text-xs">{fmtMoney(totalPerUnit)}</td>
              <td className="px-3 py-2 text-right font-bold font-mono text-emerald-700 bg-emerald-50/40 text-xs">
                {fmtMoney(totalPerPeriod)} {currency}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

// Group B category table — columns depend on calcType
function GroupBTable({ section, currency, productUnit }: {
  section: CatSection; currency: string; productUnit: string
}) {
  const { cat, rows, totalPerUnit, totalPerPeriod } = section
  const isAmort = cat.calcType === 'b1_amortization'
  const isCycles = cat.calcType === 'b2_cycles'

  const headers = isAmort
    ? ['Наименование', 'Артикул', 'Ед.', 'Кол-во', 'Срок (мес)', 'Балансовая стоим.', 'Аморт./период', `Стоим./${productUnit}`]
    : isCycles
    ? ['Наименование', 'Артикул', 'Ед.', 'Кол-во', 'Ресурс (цикл.)', 'Цена', `Стоим./${productUnit}`, 'Стоим./период']
    : ['Наименование', 'Артикул', 'Ед.', 'Расход/период', 'Цена', 'Стоим./период', `Стоим./${productUnit}`]

  return (
    <div className="card overflow-hidden mb-3">
      <div className="px-4 py-2.5 bg-orange-50 border-b border-orange-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-orange-200 text-orange-700">{cat.code}</span>
          <span className="text-sm font-semibold text-[#1A1F3C]">{cat.label}</span>
          <span className="text-[10px] text-[#9BA8C0]">
            {isAmort ? '(амортизация)' : isCycles ? '(износ по циклам)' : '(расход за период)'}
          </span>
        </div>
        <div className="text-right">
          <span className="text-xs font-bold text-orange-600">{fmtMoney(totalPerUnit)} {currency}/{productUnit}</span>
          <span className="text-xs text-[#9BA8C0] ml-2">({fmtMoney(totalPerPeriod)} {currency}/период)</span>
        </div>
      </div>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-[#FFF9F5] border-b border-orange-100">
            {headers.map(h => (
              <th key={h} className="px-3 py-2 text-[#9BA8C0] font-semibold text-left whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ row, costPerUnit, costPerPeriod }, i) => (
            <tr key={i} className="border-b border-[#F0F2FA] hover:bg-[#FFF9F5]">
              <td className="px-3 py-2 font-medium text-[#1A1F3C] max-w-[200px]">{row.name}</td>
              <td className="px-3 py-2 text-[#9BA8C0]">{row.article || '—'}</td>
              <td className="px-3 py-2 text-[#4A5578]">{row.unit}</td>

              {isAmort ? (
                <>
                  <td className="px-3 py-2 font-mono text-[#4A5578]">{row.field1 ?? '—'}</td>
                  <td className="px-3 py-2 font-mono text-[#4A5578]">{row.field2 != null ? `${row.field2} мес` : '—'}</td>
                  <td className="px-3 py-2 font-mono text-[#4A5578]">
                    {row.price != null ? fmtMoney(row.price) : '—'}
                  </td>
                  <td className="px-3 py-2 font-mono font-semibold text-orange-600">
                    {costPerPeriod != null ? `${fmtMoney(costPerPeriod)} ${currency}` : '—'}
                  </td>
                  <td className="px-3 py-2 font-mono text-[#4A5578]">
                    {costPerUnit != null ? fmtMoney(costPerUnit, 4) : '—'}
                  </td>
                </>
              ) : isCycles ? (
                <>
                  <td className="px-3 py-2 font-mono text-[#4A5578]">{row.field1 ?? '—'}</td>
                  <td className="px-3 py-2 font-mono text-[#4A5578]">
                    {row.field2 != null ? row.field2.toLocaleString('ru-RU') : '—'}
                  </td>
                  <td className="px-3 py-2 font-mono text-[#4A5578]">
                    {row.price != null ? fmtMoney(row.price) : '—'}
                  </td>
                  <td className="px-3 py-2 font-mono text-[#4A5578]">
                    {costPerUnit != null ? fmtMoney(costPerUnit, 6) : '—'}
                  </td>
                  <td className="px-3 py-2 font-mono font-semibold text-orange-600">
                    {costPerPeriod != null ? `${fmtMoney(costPerPeriod)} ${currency}` : '—'}
                  </td>
                </>
              ) : (
                // b_period
                <>
                  <td className="px-3 py-2 font-mono text-[#4A5578]">
                    {row.field1 != null ? `${row.field1} ${row.unit}` : '—'}
                  </td>
                  <td className="px-3 py-2 font-mono text-[#4A5578]">
                    {row.price != null ? fmtMoney(row.price) : '—'}
                  </td>
                  <td className="px-3 py-2 font-mono font-semibold text-orange-600">
                    {costPerPeriod != null ? `${fmtMoney(costPerPeriod)} ${currency}` : '—'}
                  </td>
                  <td className="px-3 py-2 font-mono text-[#4A5578]">
                    {costPerUnit != null ? fmtMoney(costPerUnit, 6) : '—'}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
        {rows.length > 1 && (
          <tfoot>
            <tr className="bg-orange-50 border-t border-orange-200">
              <td colSpan={headers.length - 2} className="px-3 py-2 font-bold text-orange-700 text-xs">Итого {cat.code}</td>
              <td className="px-3 py-2 text-right font-bold font-mono text-orange-700 text-xs" colSpan={2}>
                {fmtMoney(totalPerPeriod)} {currency}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

function SvodkaTab({ norm, equipmentNorms }: { norm: CostNorm; equipmentNorms: EquipmentNorm[] }) {
  const currency = sym(norm.product.currency)
  const sections = useMemo(() => buildSvodkaSections(norm, equipmentNorms), [norm, equipmentNorms])

  const groupA = sections?.filter(s => s.cat.group === 'A') ?? []
  const groupB = sections?.filter(s => s.cat.group === 'B') ?? []
  const totalAUnit = groupA.reduce((s, c) => s + c.totalPerUnit, 0)
  const totalAPeriod = groupA.reduce((s, c) => s + c.totalPerPeriod, 0)
  const totalBUnit = groupB.reduce((s, c) => s + c.totalPerUnit, 0)
  const totalBPeriod = groupB.reduce((s, c) => s + c.totalPerPeriod, 0)

  return (
    <div>
      {/* Product info */}
      <div className="mb-5 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Продукт / объект', value: norm.product.name || '—' },
          { label: 'Период', value: norm.product.period },
          { label: 'Объём выпуска', value: `${norm.product.outputVolume.toLocaleString('ru-RU')} ${norm.product.unit}` },
          { label: 'Валюта', value: `${norm.product.currency} (${currency})` },
        ].map(f => (
          <div key={f.label} className="card px-4 py-3">
            <p className="text-[10px] font-semibold text-[#9BA8C0] uppercase tracking-wide mb-0.5">{f.label}</p>
            <p className="text-sm font-semibold text-[#1A1F3C]">{f.value}</p>
          </div>
        ))}
      </div>

      {!sections ? (
        // No wizardState — fall back to summary table
        <div className="space-y-4">
          <div className="card px-4 py-3 border-l-4 border-amber-400 bg-amber-50">
            <p className="text-xs text-amber-700">
              Детальные данные построчно недоступны — норма сохранена без данных визарда.
              Отредактируйте норму, чтобы увидеть полную сводку.
            </p>
          </div>
          <div className="card overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#F8F9FF] border-b-2 border-[#E0E5F5]">
                  {['Категория', `На 1 ${norm.product.unit}`, 'За период', 'Доля', 'Структура'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[#9BA8C0] font-semibold text-xs uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {norm.summaryRows.filter(r => r.totalPerUnit > 0).map(r => {
                  const pct = norm.grandUnit > 0 ? (r.totalPerUnit / norm.grandUnit) * 100 : 0
                  const isA = r.group === 'A'
                  return (
                    <tr key={r.catId} className="border-b border-[#F0F2FA] hover:bg-[#FAFBFF]">
                      <td className="px-4 py-3 font-medium text-[#1A1F3C]">
                        <span className={`text-[10px] font-bold mr-1.5 px-1 py-0.5 rounded ${isA ? 'bg-[#4F73F7]/10 text-[#4F73F7]' : 'bg-orange-100 text-orange-700'}`}>
                          {r.catCode}
                        </span>
                        {r.catLabel}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono font-semibold ${isA ? 'text-[#4F73F7]' : 'text-orange-600'}`}>
                        {fmtMoney(r.totalPerUnit)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[#4A5578] text-xs">{fmtMoney(r.totalPerPeriod)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[#6B7A99] text-xs">{pct.toFixed(1)}%</td>
                      <td className="px-4 py-3 w-32">
                        <div className="h-2 bg-[#F0F2FA] rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${isA ? 'bg-[#4F73F7]' : 'bg-orange-400'}`}
                            style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-emerald-50 border-t-2 border-emerald-300">
                  <td className="px-4 py-3 font-extrabold text-[#1A1F3C]">ИТОГО</td>
                  <td className="px-4 py-3 text-right font-extrabold font-mono text-emerald-700 text-base">
                    {fmtMoney(norm.grandUnit)} {currency}
                  </td>
                  <td className="px-4 py-3 text-right font-bold font-mono text-emerald-700 text-xs">
                    {fmtMoney(norm.grandPeriod)} {currency}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-700">100%</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-6">

          {/* Group A */}
          {groupA.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-extrabold px-2.5 py-1 rounded-lg bg-[#4F73F7]/10 text-[#4F73F7] uppercase tracking-wide">
                  Группа А — Переменные затраты
                </span>
                <div className="h-px flex-1 bg-[#E0E5F5]" />
              </div>
              {groupA.map(section => (
                <GroupATable
                  key={section.cat.id}
                  section={section}
                  currency={currency}
                  outputVolume={norm.product.outputVolume}
                  productUnit={norm.product.unit}
                />
              ))}
              <div className="flex justify-end gap-6 px-4 py-2.5 bg-[#EEF2FF] rounded-xl text-sm">
                <span className="font-semibold text-[#4F73F7]">
                  Итого Гр.А: {fmtMoney(totalAUnit)} {currency}/{norm.product.unit}
                </span>
                <span className="text-[#6B7A99]">
                  {fmtMoney(totalAPeriod)} {currency}/период
                </span>
              </div>
            </div>
          )}

          {/* Group B */}
          {groupB.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-extrabold px-2.5 py-1 rounded-lg bg-orange-100 text-orange-700 uppercase tracking-wide">
                  Группа Б — Постоянные затраты
                </span>
                <div className="h-px flex-1 bg-orange-100" />
              </div>
              {groupB.map(section => (
                <GroupBTable
                  key={section.cat.id}
                  section={section}
                  currency={currency}
                  productUnit={norm.product.unit}
                />
              ))}
              <div className="flex justify-end gap-6 px-4 py-2.5 bg-orange-50 rounded-xl text-sm">
                <span className="font-semibold text-orange-600">
                  Итого Гр.Б: {fmtMoney(totalBUnit)} {currency}/{norm.product.unit}
                </span>
                <span className="text-[#6B7A99]">
                  {fmtMoney(totalBPeriod)} {currency}/период
                </span>
              </div>
            </div>
          )}

          {/* Grand total */}
          <div className="card px-5 py-4 bg-emerald-50 border-2 border-emerald-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-0.5">Итого себестоимость</p>
              <p className="text-xs text-emerald-600">{norm.product.name}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-extrabold text-emerald-700 font-mono">
                {fmtMoney(norm.grandUnit)} <span className="text-base">{currency}/{norm.product.unit}</span>
              </p>
              <p className="text-sm text-emerald-600 font-mono">
                {fmtMoney(norm.grandPeriod)} {currency}/период
              </p>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}

// ── Tab 2: Потребность в материалах (= Excel Лист1) ───────────────────────────

const GROUP_A_CAT_IDS = new Set(CATEGORIES.filter(c => c.group === 'A').map(c => c.id))

type MatRow = {
  catId: string
  catCode: string
  catLabel: string
  name: string
  article: string
  unit: string
  normPerUnit: number | null
  lossPercent: number | null
  normWithLoss: number | null
  totalNeedPhysical: number | null
  price: number | null
  costPerPeriod: number | null
}

function buildMaterialRows(norm: CostNorm): MatRow[] {
  const ws = norm.wizardState
  if (!ws) return []

  const result: MatRow[] = []
  const { rows, enabled, catConverters } = ws

  for (const cat of CATEGORIES) {
    if (!GROUP_A_CAT_IDS.has(cat.id)) continue
    if (!enabled[cat.id]) continue

    const catRows: CostRow[] = rows[cat.id] ?? []
    const conv = catConverters?.[cat.id]
    const mult = conv && conv.currency && conv.rate > 0 ? conv.rate : 1

    for (const row of catRows) {
      if (!row.name) continue
      const effRow = mult !== 1 && row.price != null
        ? { ...row, price: row.price * mult }
        : row
      const calc = calcRow(effRow, 'groupA', norm.product)

      const normWithLoss = calc.intermediate
      const totalNeedPhysical = normWithLoss != null
        ? normWithLoss * norm.product.outputVolume
        : null

      result.push({
        catId: cat.id,
        catCode: cat.code,
        catLabel: cat.label,
        name: row.name,
        article: row.article,
        unit: row.unit,
        normPerUnit: row.field1,
        lossPercent: row.field2,
        normWithLoss,
        totalNeedPhysical,
        price: effRow.price,
        costPerPeriod: calc.costPerPeriod,
      })
    }
  }
  return result
}

function PotrebnostTab({ norm }: { norm: CostNorm }) {
  const currency = sym(norm.product.currency)
  const matRows = useMemo(() => buildMaterialRows(norm), [norm])

  const byCategory = useMemo(() => {
    const map = new Map<string, { catCode: string; catLabel: string; rows: MatRow[] }>()
    for (const r of matRows) {
      if (!map.has(r.catId)) map.set(r.catId, { catCode: r.catCode, catLabel: r.catLabel, rows: [] })
      map.get(r.catId)!.rows.push(r)
    }
    return [...map.values()]
  }, [matRows])

  const hasData = matRows.length > 0
  const noWizardState = !norm.wizardState
  const totalCostPeriod = matRows.reduce((s, r) => s + (r.costPerPeriod ?? 0), 0)

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-3">
        <div className="card px-4 py-3 flex items-center gap-2">
          <span className="text-xs text-[#9BA8C0] font-semibold">Объём выпуска:</span>
          <span className="text-sm font-bold text-[#4F73F7]">
            {norm.product.outputVolume.toLocaleString('ru-RU')} {norm.product.unit} / {norm.product.period}
          </span>
        </div>
        {hasData && (
          <div className="card px-4 py-3 flex items-center gap-2">
            <span className="text-xs text-[#9BA8C0] font-semibold">Итого затраты Гр.А за период:</span>
            <span className="text-sm font-bold text-[#4F73F7]">{fmtMoney(totalCostPeriod)} {currency}</span>
          </div>
        )}
      </div>

      {noWizardState ? (
        <div className="card p-8 text-center">
          <p className="text-sm font-medium text-[#6B7A99] mb-1">Детальные данные недоступны</p>
          <p className="text-xs text-[#9BA8C0]">
            Эта норма была создана без сохранения построчных данных.<br />
            Отредактируйте норму в визарде и сохраните снова.
          </p>
        </div>
      ) : !hasData ? (
        <div className="card p-8 text-center text-sm text-[#9BA8C0]">
          Нет данных по переменным затратам (Группа А)
        </div>
      ) : (
        <div className="space-y-4">
          {byCategory.map(({ catCode, catLabel, rows }) => {
            const catTotal = rows.reduce((s, r) => s + (r.costPerPeriod ?? 0), 0)
            return (
              <div key={catCode} className="card overflow-hidden">
                <div className="px-4 py-2.5 bg-[#EEF2FF] border-b border-[#C7D4FF] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-[#4F73F7]/15 text-[#4F73F7]">{catCode}</span>
                    <span className="text-sm font-semibold text-[#1A1F3C]">{catLabel}</span>
                  </div>
                  <span className="text-xs font-semibold text-[#4F73F7]">
                    {fmtMoney(catTotal)} {currency} / период
                  </span>
                </div>

                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#F8F9FF] border-b border-[#E8EBF7]">
                      <th className="px-3 py-2 text-left text-[#9BA8C0] font-semibold w-[220px]">Наименование</th>
                      <th className="px-3 py-2 text-left text-[#9BA8C0] font-semibold w-24">Артикул</th>
                      <th className="px-3 py-2 text-center text-[#9BA8C0] font-semibold w-12">Ед.</th>
                      <th className="px-3 py-2 text-right text-[#9BA8C0] font-semibold">Норма на 1 ед.</th>
                      <th className="px-3 py-2 text-right text-[#9BA8C0] font-semibold">% пот.</th>
                      <th className="px-3 py-2 text-right text-[#9BA8C0] font-semibold bg-[#EEF2FF]/60 text-[#4F73F7]">Норма с пот.</th>
                      <th className="px-3 py-2 text-right text-[#9BA8C0] font-semibold bg-[#EEF2FF]/60 text-[#4F73F7]">
                        Потребность за период
                      </th>
                      <th className="px-3 py-2 text-right text-[#9BA8C0] font-semibold">Цена</th>
                      <th className="px-3 py-2 text-right text-[#9BA8C0] font-semibold bg-emerald-50/60 text-emerald-600">
                        Стоимость за период
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-b border-[#F0F2FA] hover:bg-[#FAFBFF]">
                        <td className="px-3 py-2 font-medium text-[#1A1F3C]">{r.name}</td>
                        <td className="px-3 py-2 text-[#9BA8C0]">{r.article || '—'}</td>
                        <td className="px-3 py-2 text-center text-[#4A5578]">{r.unit}</td>
                        <td className="px-3 py-2 text-right font-mono text-[#4A5578]">
                          {r.normPerUnit != null ? fmtNorm(r.normPerUnit) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right text-[#4A5578]">
                          {r.lossPercent != null ? `${r.lossPercent}%` : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[#4F73F7] bg-[#EEF2FF]/40 font-semibold">
                          {r.normWithLoss != null ? fmtNorm(r.normWithLoss) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-mono bg-[#EEF2FF]/40">
                          {r.totalNeedPhysical != null ? (
                            <span className="font-bold text-[#4F73F7]">
                              {fmtQty(r.totalNeedPhysical)} <span className="font-normal text-[#9BA8C0]">{r.unit}</span>
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[#4A5578]">
                          {r.price != null ? fmtMoney(r.price) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-mono bg-emerald-50/40">
                          {r.costPerPeriod != null ? (
                            <span className="font-semibold text-emerald-700">
                              {fmtMoney(r.costPerPeriod)} <span className="font-normal text-[#9BA8C0] text-[10px]">{currency}</span>
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {rows.length > 1 && (
                    <tfoot>
                      <tr className="bg-[#F0F2FA] border-t border-[#C7D4FF]">
                        <td colSpan={8} className="px-3 py-2 font-bold text-[#4F73F7] text-xs">Итого {catCode}</td>
                        <td className="px-3 py-2 text-right font-bold text-emerald-700 bg-emerald-50/40">
                          {fmtMoney(catTotal)} {currency}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function Reports() {
  const { costNorms, equipmentNorms } = useStore()
  const [open, setOpen] = useState<{ normId: string; type: ReportType } | null>(null)

  if (costNorms.length === 0) {
    return (
      <div className="card p-16 text-center">
        <FileBarChart2 size={40} className="mx-auto mb-4 text-[#C4CEDF]" />
        <p className="text-base font-semibold text-[#1A1F3C] mb-1">Нет данных для отчётов</p>
        <p className="text-sm text-[#9BA8C0]">Создайте хотя бы одну норму расходов в визарде</p>
      </div>
    )
  }

  // ── Detail view ───────────────────────────────────────────────────────────
  if (open) {
    const norm = costNorms.find(n => n.id === open.normId)
    if (!norm) { setOpen(null); return null }

    return (
      <div>
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-5 text-sm">
          <button onClick={() => setOpen(null)}
            className="flex items-center gap-1 text-[#6B7A99] hover:text-[#1A1F3C] transition-colors font-medium">
            <ChevronLeft size={15} /> Отчёты
          </button>
          <span className="text-[#C4CEDF]">/</span>
          <span className="text-[#9BA8C0]">{norm.product.name || 'Без названия'}</span>
          <span className="text-[#C4CEDF]">/</span>
          <span className="text-[#1A1F3C] font-semibold">
            {REPORT_TYPES.find(t => t.id === open.type)?.label}
          </span>
        </div>

        {/* Report-type switcher */}
        <div className="flex gap-1 mb-5 bg-[#F0F2FA] rounded-xl p-1 w-fit">
          {REPORT_TYPES.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setOpen({ normId: open.normId, type: id })}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                open.type === id
                  ? 'bg-white text-[#1A1F3C] shadow-sm'
                  : 'text-[#6B7A99] hover:text-[#1A1F3C]'
              }`}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {open.type === 'svodka'     && <SvodkaTab    norm={norm} equipmentNorms={equipmentNorms} />}
        {open.type === 'potrebnost' && <PotrebnostTab norm={norm} />}
      </div>
    )
  }

  // ── Reports list ──────────────────────────────────────────────────────────
  return (
    <div className="card">
      <div className="px-6 py-4 border-b border-[#F0F2FA]">
        <h2 className="text-base font-bold text-[#1A1F3C]">Все отчёты</h2>
        <p className="text-xs text-[#9BA8C0] mt-0.5">
          {costNorms.length} {costNorms.length === 1 ? 'норма' : costNorms.length < 5 ? 'нормы' : 'норм'} —
          выберите отчёт для открытия
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-[#F0F2FA]">
              {['Продукт / объект', 'Период / объём', 'Себест./ед.', 'Создана', 'Открыть отчёт'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#9BA8C0] uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {costNorms.map(norm => {
              const s = CURRENCY_SYMBOLS[norm.product.currency] ?? norm.product.currency
              return (
                <tr key={norm.id} className="border-b border-[#F0F2FA] hover:bg-[#FAFBFF] transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="text-sm font-semibold text-[#1A1F3C]">{norm.product.name || 'Без названия'}</div>
                    {norm.product.article && <div className="text-xs text-[#9BA8C0]">{norm.product.article}</div>}
                  </td>

                  <td className="px-4 py-3.5 text-sm text-[#4A5578]">
                    {norm.product.period}
                    <div className="text-xs text-[#9BA8C0]">
                      {norm.product.outputVolume.toLocaleString('ru-RU')} {norm.product.unit}
                    </div>
                  </td>

                  <td className="px-4 py-3.5 font-mono font-bold text-[#4F73F7] whitespace-nowrap">
                    {norm.grandUnit.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {s}
                  </td>

                  <td className="px-4 py-3.5 text-xs text-[#9BA8C0] whitespace-nowrap">
                    {new Date(norm.createdAt).toLocaleDateString('ru-RU')}
                  </td>

                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap gap-2">
                      {REPORT_TYPES.map(({ id, label, Icon }) => (
                        <button key={id}
                          onClick={() => setOpen({ normId: norm.id, type: id })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                            bg-[#EEF2FF] text-[#4F73F7] hover:bg-[#4F73F7] hover:text-white transition-all whitespace-nowrap">
                          <Icon size={12} /> {label}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
