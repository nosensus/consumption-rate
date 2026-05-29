import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronRight, ChevronLeft, Plus, Trash2, Check, Info, Link2 } from 'lucide-react'
import { CostProduct, CostRow, CategoryDef, EquipmentNorm, CostNorm } from './types'
import { CATEGORIES, GROUP_A, GROUP_B } from './templates'
import { calcRow, calcCategoryTotal, fmtNum, fmtCurrency } from './formulas'
import { useStore } from '../../store/useStore'

let _newId = 1000

const CURRENCIES = [
  { code: 'UZS', symbol: 'сум', label: 'Узбекский сум (UZS)' },
  { code: 'USD', symbol: '$',   label: 'Доллар США (USD)' },
  { code: 'EUR', symbol: '€',   label: 'Евро (EUR)' },
  { code: 'CNY', symbol: '¥',   label: 'Китайский юань (CNY)' },
  { code: 'RUB', symbol: '₽',   label: 'Российский рубль (RUB)' },
]

const CONVERT_TO: Record<string, string[]> = {
  UZS: ['USD', 'EUR', 'CNY', 'RUB'],
  RUB: ['USD', 'EUR', 'CNY', 'UZS'],
  USD: ['UZS', 'EUR', 'CNY', 'RUB'],
  EUR: ['USD', 'UZS', 'CNY', 'RUB'],
  CNY: ['USD', 'EUR', 'UZS', 'RUB'],
}

const UNIT_OPTIONS = ['шт', 'кг', 'г', 'л', 'мл', 'м', 'м²', 'м³', 'т', 'кВт·ч', 'компл', 'упак', 'рейс', 'услуга', 'тюбик']

function currencySymbol(code: string) {
  return CURRENCIES.find(c => c.code === code)?.symbol ?? code
}

// Винительный падеж единицы измерения после «на 1 …» (склонение полных слов)
const UNIT_ACCUSATIVE: Record<string, string> = {
  'упаковка': 'упаковку',
  'услуга': 'услугу',
  'партия': 'партию',
}
function unitAccusative(unit: string) {
  return UNIT_ACCUSATIVE[unit] ?? unit
}

const DEFAULT_PRODUCT: CostProduct = {
  name: '', article: '', unit: 'шт', currency: 'UZS', outputVolume: 0,
  period: 'месяц', periodMonths: 0, workingDays: 0,
  workingHours: 0, staffCount: 0, equipmentCount: 0,
  date: '', responsible: '',
}

function initRows(): Record<string, CostRow[]> {
  const result: Record<string, CostRow[]> = {}
  for (const cat of CATEGORIES) result[cat.id] = []
  return result
}

function initEnabled(): Record<string, boolean> {
  const result: Record<string, boolean> = {}
  for (const cat of CATEGORIES) result[cat.id] = false
  return result
}

// ── Wizard step header ──────────────────────────────────────────────────────

function WizardSteps({ current, steps, onGo }: { current: number; steps: string[]; onGo: (i: number) => void }) {
  return (
    <div className="flex items-center gap-0 mb-6">
      {steps.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <div key={i} className="flex items-center">
            <button onClick={() => onGo(i)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-all
                ${active ? 'bg-[#4F73F7] text-white shadow-[0_2px_8px_rgba(79,115,247,0.35)]'
                  : done ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                  : 'text-[#6B7A99] hover:text-[#1A1F3C] hover:bg-white'}`}>
              <span className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center shrink-0
                ${active ? 'bg-white/30 text-white' : done ? 'bg-emerald-500 text-white' : 'bg-[#E0E5F5] text-[#9BA8C0]'}`}>
                {done ? <Check size={10} /> : i + 1}
              </span>
              {label}
            </button>
            {i < steps.length - 1 && <ChevronRight size={14} className="text-[#C4CEDF] mx-1" />}
          </div>
        )
      })}
    </div>
  )
}

// ── Step 0: Инструкция ──────────────────────────────────────────────────────

const HOW_TO_STEPS = [
  { icon: '📦', label: 'Продукт', desc: 'Укажите объём выпуска и период нормирования' },
  { icon: '✅', label: 'Выберите категории', desc: 'Включите нужные статьи затрат из групп А и Б' },
  { icon: '📝', label: 'Заполните нормы', desc: 'Введите расход и цену — стоимость считается сама' },
  { icon: '📊', label: 'Сводка', desc: 'Полная себестоимость с разбивкой по статьям' },
]

type GroupChoice = 'A' | 'B'
type CustomCategory = { id: string; name: string; rows: CostRow[]; group: GroupChoice }

function makeCustomCatDef(id: string, name: string, group: GroupChoice): CategoryDef {
  return group === 'A'
    ? { id, group: 'A', code: '★', label: name || 'Своя статья', fullLabel: name || 'Своя статья',
        description: '', calcType: 'groupA',
        field1Label: 'Норма на 1 ед.', field2Label: '% потерь', field2Unit: '%',
        costCalcNote: 'Норма с потерями × Цена = Стоимость/ед. × Объём = Итого' }
    : { id, group: 'B', code: '★', label: name || 'Своя статья', fullLabel: name || 'Своя статья',
        description: '', calcType: 'b_period',
        field1Label: 'Расход за период', field2Label: null, field2Unit: 'мес',
        costCalcNote: 'Расход × Цена = Стоимость за период / Объём = На 1 ед.' }
}

function InstructionStep({ onNext }: { onNext: (group: GroupChoice) => void }) {
  const [selected, setSelected] = useState<GroupChoice | null>(null)
  return (
    <div className="max-w-5xl mx-auto">
      <div className="card p-8">

        <div className="flex items-center gap-3 mb-7">
          <div className="w-11 h-11 rounded-xl bg-[#4F73F7]/10 flex items-center justify-center text-2xl shrink-0">📋</div>
          <div>
            <h2 className="text-xl font-bold text-[#1A1F3C]">Нормы расходов на производство</h2>
            <p className="text-sm text-[#6B7A99]">Универсальный шаблон с разделением на переменные и постоянные затраты</p>
          </div>
        </div>

        <div className="mb-7 rounded-xl border border-[#E8EBF7] bg-[#F8F9FF] p-5">
          <p className="text-xs font-semibold text-[#9BA8C0] uppercase tracking-widest mb-4">Как пользоваться</p>
          <div className="grid grid-cols-4 gap-3">
            {HOW_TO_STEPS.map((s, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-[#4F73F7] text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </div>
                  {i < HOW_TO_STEPS.length - 1 && <div className="flex-1 w-px bg-[#E0E5F5] mt-1" />}
                </div>
                <div className="pb-2">
                  <p className="text-sm font-semibold text-[#1A1F3C] flex items-center gap-1.5">
                    <span>{s.icon}</span> {s.label}
                  </p>
                  <p className="text-xs text-[#6B7A99] mt-0.5 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Группа А */}
          <div onClick={() => setSelected('A')} className={`rounded-xl border-2 p-5 cursor-pointer transition-all
            ${selected === 'A'
              ? 'border-[#4F73F7] bg-[#EEF2FF] shadow-md shadow-[#4F73F7]/10'
              : 'border-[#C7D4FF] bg-[#EEF2FF] hover:border-[#4F73F7]/60 hover:shadow-sm'}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start gap-2">
                <span className="text-lg leading-none">🔵</span>
                <div>
                  <p className="text-sm font-bold text-[#4F73F7]">Группа А — Переменные затраты</p>
                  <p className="text-xs text-[#6B7FA8] mt-0.5">Норма задаётся <strong>на 1 единицу продукции</strong></p>
                </div>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all
                ${selected === 'A' ? 'border-[#4F73F7] bg-[#4F73F7]' : 'border-[#9BA8C0] bg-white'}`}>
                {selected === 'A' && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
            </div>
            <div className="rounded-lg bg-[#4F73F7]/8 border border-[#C7D4FF] px-3 py-2 mb-4 font-mono text-[11px] text-[#4F73F7]">
              норма × (1 + % потерь) × цена × объём = итого
            </div>
            <p className="text-xs text-[#4A5578] leading-relaxed mb-4">
              Расход зависит от объёма выпуска. Чем больше выпускаете — тем больше тратите.
              Идеально для сырья, упаковки, комплектующих.
            </p>
            <div className="space-y-2">
              {GROUP_A.map(c => (
                <div key={c.id} className="flex items-start gap-2.5">
                  <span className="w-7 h-5 mt-0.5 rounded text-[10px] font-bold flex items-center justify-center shrink-0 bg-[#4F73F7]/10 text-[#4F73F7]">
                    {c.code}
                  </span>
                  <div>
                    <span className="text-xs font-semibold text-[#1A1F3C]">{c.label}</span>
                    <span className="text-xs text-[#6B7FA8] ml-1.5">{c.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Группа Б */}
          <div onClick={() => setSelected('B')} className={`rounded-xl border-2 p-5 cursor-pointer transition-all
            ${selected === 'B'
              ? 'border-orange-400 bg-orange-50 shadow-md shadow-orange-400/10'
              : 'border-orange-200 bg-orange-50 hover:border-orange-400/60 hover:shadow-sm'}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start gap-2">
                <span className="text-lg leading-none">🟠</span>
                <div>
                  <p className="text-sm font-bold text-orange-700">Группа Б — Постоянные затраты</p>
                  <p className="text-xs text-orange-600 mt-0.5">Норма задаётся <strong>на период</strong> (месяц/квартал/год)</p>
                </div>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all
                ${selected === 'B' ? 'border-orange-400 bg-orange-400' : 'border-[#9BA8C0] bg-white'}`}>
                {selected === 'B' && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
            </div>
            <div className="rounded-lg bg-orange-100 border border-orange-200 px-3 py-2 mb-4 font-mono text-[11px] text-orange-700">
              затраты за период ÷ объём выпуска = стоимость на 1 ед.
            </div>
            <p className="text-xs text-orange-800 leading-relaxed mb-4">
              Расход не зависит от количества единиц — платите одинаково при любом объёме.
              Подходит для оборудования, персонала, аренды, обслуживания.
              <br /><span className="font-semibold">→ Откроется редактор оборудования со шагом привязки к продуктам.</span>
            </p>
            <div className="space-y-2">
              {GROUP_B.map(c => (
                <div key={c.id} className="flex items-start gap-2.5">
                  <span className="w-7 h-5 mt-0.5 rounded text-[10px] font-bold flex items-center justify-center shrink-0 bg-orange-100 text-orange-700">
                    {c.code}
                  </span>
                  <div>
                    <span className="text-xs font-semibold text-[#1A1F3C]">{c.label}</span>
                    <span className="text-xs text-orange-700/70 ml-1.5">{c.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 mb-6 flex items-center gap-3">
          <span className="text-xl">🟢</span>
          <p className="text-sm font-semibold text-emerald-700">
            Сводка = Группа А + Группа Б → Полная себестоимость 1 единицы продукции
          </p>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[#E8EBF7]">
          <p className="text-sm text-[#9BA8C0]">
            {selected ? `Выбрана ${selected === 'A' ? 'Группа А — Переменные затраты' : 'Группа Б — Постоянные затраты'}` : 'Выберите группу для начала работы'}
          </p>
          <button onClick={() => selected && onNext(selected)} disabled={!selected}
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">
            Начать заполнение <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Step 1: Продукт ─────────────────────────────────────────────────────────

function InfoTip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false)
  return (
    <span className="relative inline-flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}>
      <Info size={13} className="text-[#9BA8C0] cursor-help hover:text-[#4F73F7] transition-colors" />
      {visible && (
        <span className="absolute left-5 top-1/2 -translate-y-1/2 z-50 w-64 px-3 py-2.5 rounded-lg shadow-lg
          bg-[#1A2048] text-white text-xs leading-relaxed pointer-events-none whitespace-normal">
          {text}
          <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#1A2048]" />
        </span>
      )}
    </span>
  )
}

function F({ label, children, hint, required }: { label: string; children: React.ReactNode; hint?: string; required?: boolean }) {
  return (
    <div>
      <label className="label flex items-center gap-1.5">
        {label}{required && <span className="text-red-400">*</span>}
        {hint && <InfoTip text={hint} />}
      </label>
      {children}
    </div>
  )
}

function ProductStep({ product, group, onChange, onNext, onBack }: {
  product: CostProduct
  group: GroupChoice
  onChange: (p: CostProduct) => void
  onNext: () => void
  onBack: () => void
}) {
  const set = (key: keyof CostProduct, val: string | number) => onChange({ ...product, [key]: val })
  const numVal = (v: number) => v > 0 ? v : ''
  const isB = group === 'B'
  const valid = isB
    ? product.outputVolume > 0 && product.periodMonths > 0
    : product.outputVolume > 0

  const groupBadge = !isB
    ? <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#EEF2FF] text-[#4F73F7] border border-[#C7D4FF]">🔵 Группа А</span>
    : <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-50 text-orange-600 border border-orange-200">🟠 Группа Б</span>

  return (
    <div className="max-w-2xl mx-auto">
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full text-white text-sm font-bold flex items-center justify-center ${isB ? 'bg-orange-400' : 'bg-[#4F73F7]'}`}>2</div>
            <div>
              <h2 className="text-base font-bold text-[#1A1F3C]">
                {isB ? 'Параметры периода нормирования' : 'Информация о продукте'}
              </h2>
              <p className="text-sm text-[#6B7A99]">
                {isB
                  ? 'Постоянные затраты будут распределены через объём выпуска'
                  : 'Параметры используются во всех формулах расчёта'}
              </p>
            </div>
          </div>
          {groupBadge}
        </div>

        {isB && (
          <div className="mb-5 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-xs text-orange-800 leading-relaxed">
            <strong>Группа Б — постоянные затраты.</strong> Вы нормируете расходы на <em>объект</em> (цех, линию, проект),
            а не на продукт. Все затраты периода делятся на плановый объём выпуска → получается себестоимость на 1 единицу.
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">

          {/* ── Группа А: продукт ─────────────────────────────── */}
          {!isB && <>
            <F label="Наименование продукта"
              hint="Полное название продукта, для которого рассчитываются нормы расхода.">
              <input className="input" value={product.name}
                placeholder="Шприц одноразовый 10мл"
                onChange={e => set('name', e.target.value)} />
            </F>

            <F label="Технические параметры"
              hint="Ключевые характеристики: материал, размеры, марка, ГОСТ, состав.">
              <input className="input" value={product.article}
                placeholder="Полипропилен, Ø10мм, ГОСТ 24861"
                onChange={e => set('article', e.target.value)} />
            </F>

            <F label="Единица измерения"
              hint="В каких единицах считается готовая продукция. Нормы задаются на одну такую единицу.">
              <select className="input" value={product.unit} onChange={e => set('unit', e.target.value)}>
                {['шт', 'кг', 'л', 'м', 'м²', 'м³', 'упаковка', 'компл', 'т'].map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </F>

            <F label="Валюта расчёта"
              hint="Все суммы вводятся и рассчитываются в этой валюте.">
              <select className="input" value={product.currency} onChange={e => set('currency', e.target.value)}>
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </F>

            <F label="Плановый объём выпуска за период" required
              hint="⚠ Ключевой параметр! Стоимость на 1 ед. = стоимость за период ÷ этот объём.">
              <div className="flex gap-2 items-center">
                <input type="text" inputMode="numeric" className="input"
                  value={product.outputVolume > 0 ? product.outputVolume.toLocaleString('ru-RU') : ''}
                  placeholder="100 000"
                  onChange={e => {
                    const digits = e.target.value.replace(/\D/g, '')
                    set('outputVolume', digits ? +digits : 0)
                  }} />
                <span className="text-sm text-[#6B7A99] whitespace-nowrap">{product.unit}</span>
              </div>
            </F>

            <F label="Период нормирования"
              hint="За какой период указан плановый объём выпуска.">
              <select className="input" value={product.period} onChange={e => set('period', e.target.value)}>
                {['день', 'месяц', 'квартал', 'полугодие', 'год'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </F>


          </>}

          {/* ── Группа Б: объект нормирования ─────────────────── */}
          {isB && <>
            <F label="Объект нормирования"
              hint="Название подразделения, линии или проекта, для которого рассчитываются постоянные затраты.">
              <input className="input" value={product.name}
                placeholder="Производственный цех №1"
                onChange={e => set('name', e.target.value)} />
            </F>

            <F label="Код / описание"
              hint="Идентификатор в учётной системе или краткое описание объекта.">
              <input className="input" value={product.article}
                placeholder="ЦЕХ-001 / Линия А"
                onChange={e => set('article', e.target.value)} />
            </F>

            <F label="Расчётный период"
              hint="За какой период рассчитываются постоянные затраты.">
              <select className="input" value={product.period} onChange={e => set('period', e.target.value)}>
                {['месяц', 'квартал', 'полугодие', 'год'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </F>

            <F label="Длительность периода в месяцах" required
              hint="Используется для Б1 (амортизация): цена ÷ срок службы × кол-во месяцев = затраты за период.">
              <input type="number" className="input" min={1}
                value={numVal(product.periodMonths)}
                placeholder="1 — месяц, 3 — квартал, 12 — год"
                onChange={e => set('periodMonths', +e.target.value)} />
            </F>

            <F label="Базовая единица выпуска"
              hint="В чём измеряется объём выпуска для распределения затрат: шт, услуга, партия и т.д.">
              <select className="input" value={product.unit} onChange={e => set('unit', e.target.value)}>
                {['шт', 'кг', 'л', 'м', 'м²', 'м³', 'услуга', 'партия', 'компл', 'т'].map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </F>

            <F label="Плановый объём выпуска за период" required
              hint="⚠ Ключевой параметр! Постоянные затраты делятся на этот объём → стоимость на 1 ед.">
              <div className="flex gap-2 items-center">
                <input type="text" inputMode="numeric" className="input"
                  value={product.outputVolume > 0 ? product.outputVolume.toLocaleString('ru-RU') : ''}
                  placeholder="10 000"
                  onChange={e => {
                    const digits = e.target.value.replace(/\D/g, '')
                    set('outputVolume', digits ? +digits : 0)
                  }} />
                <span className="text-sm text-[#6B7A99] whitespace-nowrap">{product.unit}</span>
              </div>
            </F>

            <F label="Рабочих дней в периоде"
              hint="Используется для норм в пересчёте на день.">
              <input type="number" className="input" min={1}
                value={numVal(product.workingDays)}
                placeholder="22 — типовой месяц"
                onChange={e => set('workingDays', +e.target.value)} />
            </F>

            <F label="Рабочих часов в периоде"
              hint="Фонд рабочего времени. Для норм по моточасам: расход × часы / 100 = затраты за период.">
              <input type="number" className="input" min={1}
                value={numVal(product.workingHours)}
                placeholder="176 — при 8 ч/день"
                onChange={e => set('workingHours', +e.target.value)} />
            </F>

            <F label="Численность персонала"
              hint="Используется для норм по СИЗ, спецодежде и т.д.: расход на человека × численность.">
              <input type="number" className="input" min={1}
                value={numVal(product.staffCount)}
                placeholder="10 человек"
                onChange={e => set('staffCount', +e.target.value)} />
            </F>

            <F label="Количество единиц оборудования"
              hint="Справочный параметр для пересчёта норм на весь парк.">
              <input type="number" className="input" min={1}
                value={numVal(product.equipmentCount)}
                placeholder="5 единиц"
                onChange={e => set('equipmentCount', +e.target.value)} />
            </F>

            <F label="Валюта расчёта"
              hint="Все суммы вводятся и рассчитываются в этой валюте.">
              <select className="input" value={product.currency} onChange={e => set('currency', e.target.value)}>
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </F>

            <F label="Ответственный"
              hint="ФИО или отдел, ответственный за данную статью затрат.">
              <input className="input" value={product.responsible}
                placeholder="Иванов И.И. / Плановый отдел"
                onChange={e => set('responsible', e.target.value)} />
            </F>
          </>}
        </div>

        {!valid && (
          <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            {isB
              ? '⚠ Укажите объём выпуска и длительность периода в месяцах'
              : '⚠ Укажите плановый объём выпуска (должен быть больше 0)'}
          </p>
        )}
      </div>

      <div className="flex justify-between mt-4">
        <button onClick={onBack} className="btn-secondary">
          <ChevronLeft size={15} /> Назад
        </button>
        <button onClick={onNext} disabled={!valid} className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">
          Далее: Затраты <ChevronRight size={15} />
        </button>
      </div>
    </div>
  )
}

// ── Step 2: Затраты ──────────────────────────────────────────────────────────

function ProductBanner({ product, group, liveSummaries, liveTotalUnit }: {
  product: CostProduct
  group: GroupChoice
  liveSummaries?: Array<{ cat: CategoryDef; totalPerUnit: number }>
  liveTotalUnit?: number
}) {
  const isA = group === 'A'
  const baseSym = currencySymbol(product.currency)
  const fields = [
    product.name    ? { label: isA ? 'Продукт' : 'Объект', value: product.name } : null,
    product.article ? { label: isA ? 'Параметры' : 'Код / описание', value: product.article } : null,
    { label: 'Ед. измерения', value: product.unit },
    { label: 'Период', value: product.period },
    !isA && product.periodMonths > 0 ? { label: 'Мес. периода', value: `${product.periodMonths} мес.` } : null,
    product.outputVolume > 0 ? { label: 'Плановый объём', value: `${product.outputVolume.toLocaleString('ru-RU')} ${product.unit}`, accent: true } : null,
    { label: 'Валюта', value: `${product.currency} — ${baseSym}` },
  ].filter(Boolean) as { label: string; value: string; accent?: boolean }[]

  const activeSums = liveSummaries?.filter(s => s.totalPerUnit > 0) ?? []
  const hasLive = (liveTotalUnit ?? 0) > 0

  return (
    <div className={`sticky top-0 z-20 rounded-xl border shadow-sm mb-4 overflow-hidden ${isA ? 'border-[#C7D4FF]' : 'border-orange-200'}`}>
      <div className={`px-4 py-2 text-xs font-bold tracking-wide ${isA ? 'bg-[#4F73F7] text-white' : 'bg-orange-500 text-white'}`}>
        {isA ? 'Группа А — Переменные затраты' : 'Группа Б — Постоянные затраты'}
      </div>
      <div className={`px-4 py-3 flex flex-wrap gap-x-8 gap-y-2 ${isA ? 'bg-[#EEF2FF]' : 'bg-orange-50'}`}>
        {fields.map(f => (
          <div key={f.label}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9BA8C0] mb-0.5">{f.label}</p>
            <p className={`text-sm font-semibold ${f.accent ? (isA ? 'text-[#4F73F7]' : 'text-orange-600') : 'text-[#1A1F3C]'}`}>{f.value}</p>
          </div>
        ))}
      </div>
      {hasLive && (
        <div className="px-4 py-2 bg-white border-t border-[#E8EBF7] flex flex-wrap items-center gap-x-5 gap-y-1">
          <span className="text-[10px] font-bold text-[#9BA8C0] uppercase tracking-wide shrink-0">Текущий итог:</span>
          {activeSums.map(s => (
            <span key={s.cat.id} className="flex items-center gap-1 text-xs">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isA ? 'bg-[#4F73F7]/10 text-[#4F73F7]' : 'bg-orange-100 text-orange-600'}`}>
                {s.cat.code}
              </span>
              <span className={`font-semibold ${isA ? 'text-[#4F73F7]' : 'text-orange-600'}`}>
                {fmtNum(s.totalPerUnit, 2)}
              </span>
            </span>
          ))}
          <div className="ml-auto flex items-baseline gap-1.5">
            <span className="text-xs text-[#9BA8C0]">ИТОГО на 1 ед.:</span>
            <span className={`text-base font-extrabold ${isA ? 'text-[#4F73F7]' : 'text-orange-600'}`}>
              {fmtNum(liveTotalUnit!, 2)} <span className="text-xs font-bold">{baseSym}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function LiveSummaryCard({ rows, product, enabled, customCats, group, catConverters,
  exchangeRate, setExchangeRate, convertCurrency, setConvertCurrency }: {
  rows: Record<string, CostRow[]>
  product: CostProduct
  enabled: Record<string, boolean>
  customCats: CustomCategory[]
  group: GroupChoice
  catConverters: Record<string, { currency: string; rate: number }>
  exchangeRate: number
  setExchangeRate: (r: number) => void
  convertCurrency: string
  setConvertCurrency: (c: string) => void
}) {
  const isA = group === 'A'
  const baseSym = currencySymbol(product.currency)
  const convertSym = currencySymbol(convertCurrency)
  const convertOptions = CONVERT_TO[product.currency] ?? ['USD']

  const summaries = useMemo(() =>
    CATEGORIES.filter(c => enabled[c.id]).map(cat => {
      const conv = catConverters[cat.id]
      const mult = conv && conv.currency && conv.rate > 0 ? conv.rate : 1
      const effRows = mult !== 1
        ? rows[cat.id].map(r => ({ ...r, price: r.price != null ? r.price * mult : null }))
        : rows[cat.id]
      return { cat, ...calcCategoryTotal(effRows, cat.calcType, product) }
    }), [rows, enabled, product, catConverters])

  const customSummaries = useMemo(() =>
    customCats.map(cc => ({
      cc,
      ...calcCategoryTotal(cc.rows, makeCustomCatDef(cc.id, cc.name, cc.group).calcType, product),
    })), [customCats, product])

  const totalUnit = summaries.reduce((a, s) => a + s.totalPerUnit, 0)
    + customSummaries.reduce((a, s) => a + s.totalPerUnit, 0)
  const totalPeriod = summaries.reduce((a, s) => a + s.totalPerPeriod, 0)
    + customSummaries.reduce((a, s) => a + s.totalPerPeriod, 0)

  const hasAny = summaries.length > 0 || customCats.length > 0

  return (
    <div className="sticky top-4 w-60 shrink-0">
      <div className="card p-4">
        <p className="text-xs font-bold text-[#1A1F3C] uppercase tracking-wide mb-3">Текущий итог</p>

        {!hasAny ? (
          <p className="text-xs text-[#9BA8C0] text-center py-6 leading-relaxed">
            Включите категории<br />чтобы видеть итог
          </p>
        ) : (
          <div className="space-y-2">
            {summaries.map(s => (
              <div key={s.cat.id} className={`rounded-lg p-2.5 ${s.totalPerUnit > 0
                ? (isA ? 'bg-[#EEF2FF]' : 'bg-orange-50')
                : 'bg-[#F8F9FF]'}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0
                    ${isA ? 'bg-[#4F73F7]/10 text-[#4F73F7]' : 'bg-orange-100 text-orange-700'}`}>
                    {s.cat.code}
                  </span>
                  <span className="text-xs font-medium text-[#1A1F3C] truncate">{s.cat.label}</span>
                </div>
                {s.totalPerUnit > 0 ? (
                  <>
                    <div className="flex justify-between items-baseline">
                      <span className="text-[10px] text-[#9BA8C0]">на 1 {product.unit}</span>
                      <span className={`text-sm font-bold ${isA ? 'text-[#4F73F7]' : 'text-orange-600'}`}>{fmtNum(s.totalPerUnit, 2)}</span>
                    </div>
                    <div className="flex justify-between items-baseline mt-0.5">
                      <span className="text-[10px] text-[#9BA8C0]">за период</span>
                      <span className="text-[11px] text-[#6B7A99]">{fmtCurrency(s.totalPerPeriod, baseSym)}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-[10px] text-[#C4CEDF] italic mt-0.5">нет данных</p>
                )}
              </div>
            ))}

            {customSummaries.filter(s => s.cc.name || s.totalPerUnit > 0).map(s => (
              <div key={s.cc.id} className="rounded-lg p-2.5 bg-[#F8F9FF]">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#E8EBF7] text-[#6B7A99] shrink-0">★</span>
                  <span className="text-xs font-medium text-[#1A1F3C] truncate">{s.cc.name || 'Своя категория'}</span>
                </div>
                {s.totalPerUnit > 0 ? (
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] text-[#9BA8C0]">на 1 {product.unit}</span>
                    <span className="text-sm font-bold text-[#4A5578]">{fmtNum(s.totalPerUnit, 2)}</span>
                  </div>
                ) : (
                  <p className="text-[10px] text-[#C4CEDF] italic mt-0.5">нет данных</p>
                )}
              </div>
            ))}

            {totalUnit > 0 && (
              <div className={`rounded-lg p-3 mt-1 ${isA ? 'bg-[#4F73F7]' : 'bg-orange-500'}`}>
                <p className="text-[10px] text-white/70 mb-0.5">ИТОГО на 1 {product.unit}</p>
                <p className="text-lg font-extrabold text-white leading-tight">{fmtNum(totalUnit, 2)} <span className="text-sm font-bold">{baseSym}</span></p>
                {totalPeriod > 0 && <>
                  <p className="text-[10px] text-white/60 mt-2 mb-0.5">За {product.period}</p>
                  <p className="text-sm font-bold text-white/90">{fmtCurrency(totalPeriod, baseSym)}</p>
                </>}
              </div>
            )}

            {/* ── Converter ─────────────────────────────── */}
            <div className="border-t border-[#E8EBF7] pt-3 mt-1">
              <p className="text-[10px] font-bold text-[#9BA8C0] uppercase tracking-wide mb-2">Конвертер</p>
              <div className="flex items-center gap-1 mb-2">
                <span className="text-xs text-[#6B7A99]">1</span>
                <select value={convertCurrency} onChange={e => setConvertCurrency(e.target.value)}
                  className="text-xs border border-[#E0E5F5] rounded-lg px-1.5 py-1 bg-white focus:outline-none focus:border-[#4F73F7] font-semibold text-[#1A1F3C]">
                  {convertOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <span className="text-xs text-[#6B7A99]">=</span>
                <input type="text" inputMode="numeric"
                  value={exchangeRate > 0 ? exchangeRate.toLocaleString('ru-RU') : ''}
                  onChange={e => {
                    const d = e.target.value.replace(/\D/g, '')
                    setExchangeRate(d ? +d : 0)
                  }}
                  className="flex-1 min-w-0 px-2 py-1 text-xs border border-[#E0E5F5] rounded-lg bg-white focus:outline-none focus:border-[#4F73F7] text-right"
                  placeholder="курс" />
                <span className="text-xs text-[#6B7A99] shrink-0">{baseSym}</span>
              </div>
              {exchangeRate > 0 && totalUnit > 0 && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-[10px] text-[#9BA8C0]">на 1 {product.unit}</span>
                    <span className="text-sm font-bold text-emerald-700">
                      {fmtNum(totalUnit / exchangeRate, 2)} {convertSym}
                    </span>
                  </div>
                  {totalPeriod > 0 && (
                    <div className="flex justify-between items-baseline">
                      <span className="text-[10px] text-[#9BA8C0]">за {product.period}</span>
                      <span className="text-[11px] font-semibold text-emerald-600">
                        {fmtCurrency(totalPeriod / exchangeRate, convertSym)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function NumInput({ value, onChange, placeholder, step, min }: {
  value: number | null
  onChange: (v: number | null) => void
  placeholder?: string
  step?: number
  min?: number
}) {
  return (
    <input
      type="number"
      step={step ?? 'any'}
      min={min}
      value={value ?? ''}
      placeholder={placeholder ?? '—'}
      onChange={e => onChange(e.target.value === '' ? null : +e.target.value)}
      className="w-full px-2 py-1.5 text-xs border border-[#E0E5F5] rounded-lg bg-white focus:outline-none focus:border-[#4F73F7] focus:ring-1 focus:ring-[#4F73F7]/30 text-right"
    />
  )
}

function CalcCell({ value, title }: { value: string; title?: string }) {
  return (
    <td title={title} className="px-2 py-2 text-xs text-right text-[#4F73F7] font-semibold bg-[#EEF2FF]/60 whitespace-nowrap">
      {value}
    </td>
  )
}

const TH = 'px-2 py-2 text-[#9BA8C0] font-semibold leading-tight'

function CategoryTable({ cat, rows, product, priceMultiplier = 1, convCurrency, onUpdate, onAdd, onDelete }: {
  cat: CategoryDef
  rows: CostRow[]
  product: CostProduct
  priceMultiplier?: number
  convCurrency?: string
  onUpdate: (id: string, changes: Partial<CostRow>) => void
  onAdd: () => void
  onDelete: (id: string) => void
}) {
  const isA = cat.calcType === 'groupA'
  const isB1 = cat.calcType === 'b1_amortization'
  const isB2 = cat.calcType === 'b2_cycles'
  const baseSym = currencySymbol(product.currency)
  const priceLabelSuffix = convCurrency ? ` (${convCurrency})` : ''

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-[#F8F9FF] border-b border-[#E8EBF7]">
            <th className={`${TH} text-left w-[180px]`}>Наименование</th>
            {isA && <th className={`${TH} text-left w-[150px]`}>Тех. параметры</th>}
            <th className={`${TH} text-left w-16`}>Ед.</th>
            <th className={`${TH} text-right w-24`}>
              {isA ? <>Норма на 1 {unitAccusative(product.unit)}<br />продукта</> : cat.field1Label}
            </th>
            {cat.field2Label && (
              <th className={`${TH} text-right w-20`}>
                {cat.field2Label}{cat.field2Unit ? ` (${cat.field2Unit})` : ''}
              </th>
            )}
            {isA && <th className={`${TH} text-right w-24 bg-[#EEF2FF]/60 text-[#4F73F7]`}>Норма с потерями</th>}
            <th className={`${TH} text-right w-24`}>Цена{priceLabelSuffix}</th>
            <th className={`${TH} text-right w-28 bg-[#EEF2FF]/60 text-[#4F73F7]`}>Стоим./<br />1 ед., {baseSym}</th>
            <th className={`${TH} text-right w-28 bg-[#EEF2FF]/60 text-[#4F73F7]`}>
              {isA ? <>Стоим. на<br />{product.outputVolume.toLocaleString('ru-RU')} {product.unit}</> : `За период, ${baseSym}`}
            </th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const effRow = priceMultiplier !== 1 ? { ...row, price: row.price != null ? row.price * priceMultiplier : null } : row
            const calc = calcRow(effRow, cat.calcType, product)
            const prevSub = idx > 0 ? rows[idx - 1].subcategory : ''
            const showSubHeader = row.subcategory && row.subcategory !== prevSub
            return (
              <>
                {showSubHeader && (
                  <tr key={`sub-${row.id}`}>
                    <td colSpan={99} className="px-2 pt-3 pb-1">
                      <span className="text-[10px] font-bold text-[#9BA8C0] uppercase tracking-wider">{row.subcategory}</span>
                    </td>
                  </tr>
                )}
                <tr key={row.id} className="border-b border-[#F0F2FA] hover:bg-[#FAFBFF] group">
                  <td className="px-2 py-1.5">
                    <input value={row.name}
                      onChange={e => onUpdate(row.id, { name: e.target.value })}
                      className="w-full px-2 py-1.5 text-xs border border-[#E0E5F5] rounded-lg bg-white focus:outline-none focus:border-[#4F73F7] focus:ring-1 focus:ring-[#4F73F7]/30"
                      placeholder="Наименование" />
                  </td>
                  {isA && (
                    <td className="px-2 py-1.5">
                      <input value={row.article}
                        onChange={e => onUpdate(row.id, { article: e.target.value })}
                        className="w-full px-2 py-1.5 text-xs border border-[#E0E5F5] rounded-lg bg-white focus:outline-none focus:border-[#4F73F7] focus:ring-1 focus:ring-[#4F73F7]/30"
                        placeholder="размер, марка, цвет…" />
                    </td>
                  )}
                  <td className="px-2 py-1.5">
                    <select value={UNIT_OPTIONS.includes(row.unit) ? row.unit : (row.unit || UNIT_OPTIONS[0])}
                      onChange={e => onUpdate(row.id, { unit: e.target.value })}
                      className="w-full px-1.5 py-1.5 text-xs border border-[#E0E5F5] rounded-lg bg-white focus:outline-none focus:border-[#4F73F7] text-center">
                      {!UNIT_OPTIONS.includes(row.unit) && row.unit && (
                        <option value={row.unit}>{row.unit}</option>
                      )}
                      {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <NumInput value={row.field1}
                      onChange={v => onUpdate(row.id, { field1: v })}
                      placeholder={isA ? '0.000' : (isB1 || isB2) ? '1' : '0'} />
                  </td>
                  {cat.field2Label && (
                    <td className="px-2 py-1.5">
                      <NumInput value={row.field2}
                        onChange={v => onUpdate(row.id, { field2: v })}
                        placeholder={isA ? '0' : (isB1 ? '60' : '1000000')}
                        min={0} />
                    </td>
                  )}
                  {isA && (
                    <CalcCell
                      value={fmtNum(calc.intermediate, 6)}
                      title={`${row.field1 ?? '?'} × (1 + ${row.field2 ?? 0}%) = ${fmtNum(calc.intermediate, 6)} ${row.unit}`}
                    />
                  )}
                  <td className="px-2 py-1.5">
                    <NumInput value={row.price} onChange={v => onUpdate(row.id, { price: v })} placeholder="0.00" />
                  </td>
                  <CalcCell
                    value={fmtNum(calc.costPerUnit, 2)}
                    title={`Стоимость на 1 ${product.unit}: ${fmtNum(calc.costPerUnit, 2)} ${baseSym}`}
                  />
                  <CalcCell
                    value={fmtCurrency(calc.costPerPeriod)}
                    title={isA
                      ? `Стоимость на ${product.outputVolume} ${product.unit}: ${fmtCurrency(calc.costPerPeriod)} ${baseSym}`
                      : `Стоимость за период: ${fmtCurrency(calc.costPerPeriod)} ${baseSym}`}
                  />
                  <td className="px-1 py-1.5">
                    <button onClick={() => onDelete(row.id)}
                      className="w-6 h-6 rounded flex items-center justify-center text-[#C4CEDF] hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all">
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              </>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={99} className="px-2 pt-2 pb-1">
              <button onClick={onAdd}
                className="flex items-center gap-1.5 text-xs text-[#4F73F7] hover:text-[#3B5FE0] font-medium transition-colors">
                <Plus size={13} /> Добавить строку
              </button>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function CategorySection({ cat, rows, product, enabled, catConvCurrency, catConvRate, onCatConvChange, onToggle, onUpdate, onAdd, onDelete }: {
  cat: CategoryDef
  rows: CostRow[]
  product: CostProduct
  enabled: boolean
  catConvCurrency: string
  catConvRate: number
  onCatConvChange: (currency: string, rate: number) => void
  onToggle: () => void
  onUpdate: (id: string, changes: Partial<CostRow>) => void
  onAdd: () => void
  onDelete: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const isA = cat.group === 'A'
  const prevEnabledRef = useRef(enabled)

  const priceMultiplier = catConvCurrency && catConvRate > 0 ? catConvRate : 1
  const effectiveRows = useMemo(() =>
    priceMultiplier !== 1
      ? rows.map(r => ({ ...r, price: r.price != null ? r.price * priceMultiplier : null }))
      : rows,
    [rows, priceMultiplier])
  const totals = useMemo(() => calcCategoryTotal(effectiveRows, cat.calcType, product), [effectiveRows, cat.calcType, product])

  useEffect(() => {
    if (enabled && !prevEnabledRef.current) setOpen(true)
    if (!enabled) setOpen(false)
    prevEnabledRef.current = enabled
  }, [enabled])

  return (
    <div className={`rounded-xl border transition-all ${enabled ? 'border-[#E0E5F5] bg-white shadow-sm' : 'border-[#ECEEF5] bg-[#FAFBFF]'}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={onToggle}
          className={`w-9 h-5 rounded-full transition-all relative shrink-0 ${enabled ? (isA ? 'bg-[#4F73F7]' : 'bg-orange-400') : 'bg-[#D0D7EE]'}`}>
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${enabled ? 'left-4' : 'left-0.5'}`} />
        </button>

        <span className={`w-7 h-6 rounded text-[11px] font-bold flex items-center justify-center shrink-0
          ${isA ? 'bg-[#4F73F7]/10 text-[#4F73F7]' : 'bg-orange-100 text-orange-700'}`}>
          {cat.code}
        </span>

        <div className="flex-1 min-w-0">
          <span className="font-semibold text-sm text-[#1A1F3C]">{cat.label}</span>
          <span className="text-xs text-[#9BA8C0] ml-2">{cat.description}</span>
        </div>

        {enabled && totals.totalPerUnit > 0 && (
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-[10px] text-[#9BA8C0]">На 1 {product.unit}</p>
              <p className="text-sm font-bold text-[#4F73F7]">{fmtNum(totals.totalPerUnit, 2)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-[#9BA8C0]">За период</p>
              <p className="text-sm font-bold text-[#1A1F3C]">{fmtCurrency(totals.totalPerPeriod)}</p>
            </div>
          </div>
        )}

        {enabled && (
          <button onClick={() => setOpen(o => !o)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#9BA8C0] hover:bg-[#F0F2FA] transition-colors shrink-0">
            {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>
        )}
      </div>

      {enabled && open && (
        <div className="border-t border-[#F0F2FA] p-4">
          {/* Per-category currency converter */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-[10px] font-semibold text-[#9BA8C0] uppercase tracking-wide shrink-0">Закупка в:</span>
            <select value={catConvCurrency}
              onChange={e => onCatConvChange(e.target.value, 0)}
              className="text-xs border border-[#E0E5F5] rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-[#4F73F7]">
              <option value="">Базовая ({product.currency})</option>
              {CURRENCIES.filter(c => c.code !== product.currency).map(c => (
                <option key={c.code} value={c.code}>{c.code} — {c.symbol}</option>
              ))}
            </select>
            {catConvCurrency && <>
              <span className="text-xs text-[#9BA8C0]">1 {catConvCurrency} =</span>
              <input type="number" step="any" min={0}
                value={catConvRate || ''}
                onChange={e => onCatConvChange(catConvCurrency, +e.target.value)}
                className="w-24 px-2 py-1 text-xs border border-[#E0E5F5] rounded-lg bg-white focus:outline-none focus:border-[#4F73F7] text-right"
                placeholder="курс" />
              <span className="text-xs text-[#9BA8C0]">{currencySymbol(product.currency)}</span>
            </>}
          </div>
          <CategoryTable cat={cat} rows={rows} product={product}
            priceMultiplier={priceMultiplier}
            convCurrency={catConvCurrency || undefined}
            onUpdate={onUpdate} onAdd={onAdd} onDelete={onDelete} />
        </div>
      )}
    </div>
  )
}

// ── Linked equipment panel (shown in Group B tab) ───────────────────────────

function LinkedEquipmentPanel({ equipmentNorms, linkedIds, product, onLink, onUnlink }: {
  equipmentNorms: EquipmentNorm[]
  linkedIds: string[]
  product: CostProduct
  onLink: (id: string) => void
  onUnlink: (id: string) => void
}) {
  const [showPicker, setShowPicker] = useState(false)
  const navigate = useNavigate()
  const baseSym = currencySymbol(product.currency)

  const linked = linkedIds
    .map(id => equipmentNorms.find(e => e.id === id))
    .filter(Boolean) as EquipmentNorm[]

  const available = equipmentNorms.filter(e => !linkedIds.includes(e.id))

  return (
    <div className="mb-4 rounded-xl border border-orange-300 bg-orange-50 p-4">
      <div className="mb-3">
        <p className="text-xs font-bold text-orange-700 uppercase tracking-wide">Ресурсы и оборудование (Группа Б)</p>
      </div>

      {linked.length === 0 && (
        <p className="text-xs text-orange-600/80 mb-3 leading-relaxed">
          Не привязано. Привяжите ресурсы из справочника Группы Б (оборудование, инструменты,
          услуги, расходники) — их затраты автоматически войдут в себестоимость.
        </p>
      )}

      {linked.map(eq => {
        const contribution = CATEGORIES
          .filter(c => c.group === 'B' && eq.enabled[c.id])
          .map(cat => {
            const conv = eq.catConverters?.[cat.id]
            const mult = conv?.currency && conv.rate > 0 ? conv.rate : 1
            const effRows = mult !== 1
              ? (eq.rows[cat.id] ?? []).map(r => ({ ...r, price: r.price != null ? r.price * mult : null }))
              : (eq.rows[cat.id] ?? [])
            return { cat, ...calcCategoryTotal(effRows, cat.calcType, product) }
          })
          .filter(s => s.totalPerUnit > 0 || s.totalPerPeriod > 0)
        const totalUnit = contribution.reduce((s, c) => s + c.totalPerUnit, 0)

        return (
          <div key={eq.id} className="rounded-lg border border-orange-300 bg-white p-3 mb-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#1A1F3C] truncate">{eq.name}</p>
                {eq.description && (
                  <p className="text-xs text-[#9BA8C0] mt-0.5 truncate">{eq.description}</p>
                )}
                <div className="flex flex-wrap gap-1 mt-2">
                  {contribution.map(s => (
                    <span key={s.cat.id} className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium">
                      {s.cat.code}: {fmtNum(s.totalPerUnit, 4)} {baseSym}/{product.unit}
                    </span>
                  ))}
                  {totalUnit > 0 && (
                    <span className="text-[10px] bg-orange-600 text-white px-1.5 py-0.5 rounded font-bold">
                      итого {fmtNum(totalUnit, 4)} {baseSym}/{product.unit}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => navigate(`/equipment/edit/${eq.id}`)}
                  className="text-xs text-[#4F73F7] hover:underline">
                  Изменить
                </button>
                <button onClick={() => onUnlink(eq.id)}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors">
                  Открепить
                </button>
              </div>
            </div>
          </div>
        )
      })}

      {available.length > 0 && !showPicker && (
        <button onClick={() => setShowPicker(true)}
          className="flex items-center gap-1.5 text-xs text-orange-700 hover:text-orange-900 font-semibold transition-colors mt-2 border border-orange-300 rounded-lg px-3 py-1.5 bg-white hover:bg-orange-50">
          <Plus size={13} /> Привязать из справочника (Группа Б)
        </button>
      )}

      {showPicker && (
        <div className="mt-2 rounded-lg border border-orange-200 bg-white p-3">
          <p className="text-xs font-semibold text-[#6B7A99] mb-2">Выберите ресурс из справочника:</p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {available.map(eq => (
              <button key={eq.id} onClick={() => { onLink(eq.id); setShowPicker(false) }}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-orange-50 transition-colors">
                <span className="text-sm font-medium text-[#1A1F3C]">{eq.name}</span>
                {eq.description && (
                  <span className="text-xs text-[#9BA8C0] ml-2">{eq.description.slice(0, 60)}</span>
                )}
              </button>
            ))}
          </div>
          <button onClick={() => setShowPicker(false)} className="text-xs text-[#9BA8C0] hover:text-[#6B7A99] mt-2">
            Отмена
          </button>
        </div>
      )}
    </div>
  )
}

function CostsStep({ rows, product, group, enabled, onToggle, onUpdate, onAdd, onDelete,
  customCats, onAddCustomCat, onUpdateCustomCatName, onAddCustomCatRow, onUpdateCustomCatRow, onDeleteCustomCatRow, onDeleteCustomCat,
  catConverters, setCatConverters,
  exchangeRate, setExchangeRate, convertCurrency, setConvertCurrency,
  linkedEquipmentIds, setLinkedEquipmentIds, equipmentNorms,
  onNext, onBack }: {
  rows: Record<string, CostRow[]>
  product: CostProduct
  group: GroupChoice
  enabled: Record<string, boolean>
  onToggle: (id: string) => void
  onUpdate: (catId: string, rowId: string, changes: Partial<CostRow>) => void
  onAdd: (catId: string) => void
  onDelete: (catId: string, rowId: string) => void
  customCats: CustomCategory[]
  onAddCustomCat: () => void
  onUpdateCustomCatName: (id: string, name: string) => void
  onAddCustomCatRow: (catId: string) => void
  onUpdateCustomCatRow: (catId: string, rowId: string, changes: Partial<CostRow>) => void
  onDeleteCustomCatRow: (catId: string, rowId: string) => void
  onDeleteCustomCat: (id: string) => void
  catConverters: Record<string, { currency: string; rate: number }>
  setCatConverters: React.Dispatch<React.SetStateAction<Record<string, { currency: string; rate: number }>>>
  exchangeRate: number
  setExchangeRate: (r: number) => void
  convertCurrency: string
  setConvertCurrency: (c: string) => void
  linkedEquipmentIds?: string[]
  setLinkedEquipmentIds?: (ids: string[]) => void
  equipmentNorms?: EquipmentNorm[]
  onNext: () => void
  onBack: () => void
}) {
  const [activeGroup, setActiveGroup] = useState<'A' | 'B' | null>(
    group === 'A' ? 'A' : group === 'B' ? 'B' : null
  )
  const anyEnabled = Object.values(enabled).some(Boolean) || customCats.length > 0

  const liveSummaries = useMemo(() => {
    const standard = CATEGORIES.filter(c => enabled[c.id]).map(cat => {
      const conv = catConverters[cat.id]
      const mult = conv && conv.currency && conv.rate > 0 ? conv.rate : 1
      const effRows = mult !== 1
        ? rows[cat.id].map(r => ({ ...r, price: r.price != null ? r.price * mult : null }))
        : rows[cat.id]
      return { cat, ...calcCategoryTotal(effRows, cat.calcType, product) }
    })
    const custom = customCats.map(cc => ({
      cat: makeCustomCatDef(cc.id, cc.name, cc.group),
      ...calcCategoryTotal(cc.rows, makeCustomCatDef(cc.id, cc.name, cc.group).calcType, product),
    }))
    return [...standard, ...custom]
  }, [rows, enabled, product, customCats, catConverters])
  const liveTotalUnit = liveSummaries.reduce((a, s) => a + s.totalPerUnit, 0)

  // Group picker
  if (activeGroup === null) {
    return (
      <div className="w-[1200px] mx-auto">
        <div className="card p-8">
          <h3 className="text-lg font-bold text-[#1A1F3C] mb-2">Выберите группу затрат</h3>
          <p className="text-sm text-[#6B7A99] mb-6">
            Группы можно комбинировать — после заполнения одной переключитесь на другую
          </p>
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => setActiveGroup('A')}
              className="text-left rounded-xl border-2 border-[#C7D4FF] bg-[#EEF2FF] hover:border-[#4F73F7] hover:shadow-md p-5 transition-all group">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-8 h-8 rounded-full bg-[#4F73F7] text-white text-sm font-bold flex items-center justify-center">А</span>
                <span className="font-bold text-[#4F73F7]">Группа А</span>
              </div>
              <p className="text-sm font-semibold text-[#1A1F3C] mb-1">Переменные затраты</p>
              <p className="text-xs text-[#6B7FA8] leading-relaxed mb-3">
                Зависят от объёма выпуска. Норма задаётся <strong>на 1 единицу</strong> продукции.
              </p>
              <div className="flex flex-wrap gap-1">
                {GROUP_A.map(c => (
                  <span key={c.id} className="text-[10px] bg-[#4F73F7]/10 text-[#4F73F7] font-semibold px-1.5 py-0.5 rounded">
                    {c.code} {c.label}
                  </span>
                ))}
              </div>
            </button>

            <button onClick={() => setActiveGroup('B')}
              className="text-left rounded-xl border-2 border-orange-200 bg-orange-50 hover:border-orange-400 hover:shadow-md p-5 transition-all group">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-8 h-8 rounded-full bg-orange-400 text-white text-sm font-bold flex items-center justify-center">Б</span>
                <span className="font-bold text-orange-600">Группа Б</span>
              </div>
              <p className="text-sm font-semibold text-[#1A1F3C] mb-1">Постоянные затраты</p>
              <p className="text-xs text-orange-800 leading-relaxed mb-3">
                Не зависят от объёма. Норма задаётся <strong>на период</strong> (месяц/квартал/год).
              </p>
              <div className="flex flex-wrap gap-1">
                {GROUP_B.map(c => (
                  <span key={c.id} className="text-[10px] bg-orange-100 text-orange-700 font-semibold px-1.5 py-0.5 rounded">
                    {c.code} {c.label}
                  </span>
                ))}
              </div>
            </button>
          </div>

          <div className="flex justify-between mt-6">
            <button onClick={onBack} className="btn-secondary">
              <ChevronLeft size={15} /> Назад
            </button>
            {anyEnabled && (
              <button onClick={onNext} className="btn-primary">
                Посмотреть сводку <ChevronRight size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const isA = activeGroup === 'A'
  const cats = isA ? GROUP_A : GROUP_B

  return (
    <div className="flex gap-5 items-start">
      {/* ── Main column ───────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        <ProductBanner product={product} group={activeGroup as GroupChoice}
          liveSummaries={liveSummaries} liveTotalUnit={liveTotalUnit} />

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center
              ${isA ? 'bg-[#4F73F7]/10 text-[#4F73F7]' : 'bg-orange-100 text-orange-700'}`}>
              {isA ? 'А' : 'Б'}
            </span>
            <h3 className="font-bold text-[#1A1F3C]">
              {isA ? 'Группа А — Переменные затраты' : 'Группа Б — Постоянные затраты'}
            </h3>
            <span className="text-xs text-[#9BA8C0]">
              {isA ? 'норма на 1 единицу продукции' : 'норма на период'}
            </span>
          </div>

          <div className="space-y-2">
            {cats.map(cat => (
              <CategorySection key={cat.id} cat={cat} rows={rows[cat.id]} product={product}
                enabled={enabled[cat.id]}
                catConvCurrency={catConverters[cat.id]?.currency ?? ''}
                catConvRate={catConverters[cat.id]?.rate ?? 0}
                onCatConvChange={(currency, rate) => setCatConverters(prev => ({ ...prev, [cat.id]: { currency, rate } }))}
                onToggle={() => onToggle(cat.id)}
                onUpdate={(rId, ch) => onUpdate(cat.id, rId, ch)}
                onAdd={() => onAdd(cat.id)}
                onDelete={(rId) => onDelete(cat.id, rId)} />
            ))}
          </div>
        </div>

        {/* Linked Group B resources — only relevant for Group A cost norms */}
        {isA && linkedEquipmentIds !== undefined && setLinkedEquipmentIds && equipmentNorms && (
          <div className="mt-3">
            <LinkedEquipmentPanel
              equipmentNorms={equipmentNorms}
              linkedIds={linkedEquipmentIds}
              product={product}
              onLink={id => setLinkedEquipmentIds([...linkedEquipmentIds, id])}
              onUnlink={id => setLinkedEquipmentIds(linkedEquipmentIds.filter(eid => eid !== id))}
            />
          </div>
        )}

        {/* Custom categories — same formula as standard, user-named */}
        <div className="mt-3 space-y-3">
          {customCats.map(cc => {
            const catDef = makeCustomCatDef(cc.id, cc.name, cc.group)
            return (
              <div key={cc.id} className="card p-0 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-[#F0F2FA]">
                  <span className={`w-7 h-6 rounded text-[11px] font-bold flex items-center justify-center shrink-0
                    ${isA ? 'bg-[#4F73F7]/10 text-[#4F73F7]' : 'bg-orange-100 text-orange-700'}`}>★</span>
                  <input value={cc.name} onChange={e => onUpdateCustomCatName(cc.id, e.target.value)}
                    className="flex-1 font-semibold text-sm text-[#1A1F3C] bg-transparent outline-none placeholder-[#C4CEDF] border-b border-transparent focus:border-[#4F73F7] transition-colors pb-0.5"
                    placeholder="Название своей категории" />
                  <button onClick={() => onDeleteCustomCat(cc.id)}
                    className="w-6 h-6 rounded flex items-center justify-center text-[#C4CEDF] hover:text-red-500 hover:bg-red-50 transition-all shrink-0">
                    <Trash2 size={12} />
                  </button>
                </div>
                <div className="p-4">
                  <CategoryTable cat={catDef} rows={cc.rows} product={product}
                    onUpdate={(rId, ch) => onUpdateCustomCatRow(cc.id, rId, ch)}
                    onAdd={() => onAddCustomCatRow(cc.id)}
                    onDelete={(rId) => onDeleteCustomCatRow(cc.id, rId)} />
                </div>
              </div>
            )
          })}
          <button onClick={onAddCustomCat}
            className={`w-full py-3 rounded-xl border-2 border-dashed text-sm font-medium transition-all flex items-center justify-center gap-2
              ${isA ? 'border-[#C7D4FF] text-[#4F73F7] hover:border-[#4F73F7] hover:bg-[#EEF2FF]'
                : 'border-orange-200 text-orange-500 hover:border-orange-400 hover:bg-orange-50'}`}>
            <Plus size={15} /> Добавить свою категорию
          </button>
        </div>

        <div className="flex justify-between mt-4">
          <button onClick={onBack} className="btn-secondary">
            <ChevronLeft size={15} /> Назад
          </button>
          <button onClick={onNext} disabled={!anyEnabled} className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">
            Посмотреть сводку <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* ── Live summary sidebar ──────────────────────────────────── */}
      <LiveSummaryCard rows={rows} product={product} enabled={enabled} customCats={customCats} group={group}
        catConverters={catConverters}
        exchangeRate={exchangeRate} setExchangeRate={setExchangeRate}
        convertCurrency={convertCurrency} setConvertCurrency={setConvertCurrency} />
    </div>
  )
}

// ── Step 3: Сводка ───────────────────────────────────────────────────────────

type NotifSuggestion = {
  catId: string
  catCode: string
  catLabel: string
  group: 'A' | 'B'
  calcType: string
  label: string
  reason: string
  date: string
  urgency: 'low' | 'medium' | 'high'
}

function addMonthsToDate(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + Math.round(months))
  return d
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function fmtDateRu(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

function calcSuggestions(
  summaries: Array<{ cat: CategoryDef; totalPerUnit: number }>,
  rows: Record<string, CostRow[]>,
  product: CostProduct
): NotifSuggestion[] {
  const today = new Date()
  const periodMos = product.periodMonths > 0 ? product.periodMonths : 1
  const outputVol = product.outputVolume > 0 ? product.outputVolume : 1
  const result: NotifSuggestion[] = []

  for (const s of summaries) {
    if (s.totalPerUnit <= 0) continue
    const cat = s.cat
    const catRows = (rows[cat.id] ?? []).filter(r => r.name)

    if (cat.calcType === 'groupA') {
      const d = new Date(today)
      d.setMonth(d.getMonth() + periodMos)
      d.setDate(d.getDate() - 14)
      result.push({
        catId: cat.id, catCode: cat.code, catLabel: cat.label,
        group: 'A', calcType: cat.calcType,
        label: `Пополнить запасы — ${cat.label}`,
        reason: `Норма на ${periodMos} мес → уведомление за 2 нед. до конца периода`,
        date: toIsoDate(d),
        urgency: 'medium',
      })
    } else if (cat.calcType === 'b1_amortization') {
      const withLife = catRows.filter(r => r.field2 != null && r.field2 > 0)
      if (withLife.length > 0) {
        const minLifeRow = withLife.reduce((a, b) => (a.field2! < b.field2! ? a : b))
        const lifeMos = minLifeRow.field2!
        result.push({
          catId: cat.id, catCode: cat.code, catLabel: cat.label,
          group: 'B', calcType: cat.calcType,
          label: `Замена / переоценка — ${cat.label}`,
          reason: `«${minLifeRow.name || cat.label}»: срок службы ${lifeMos} мес → уведомление за 1 мес до конца`,
          date: toIsoDate(addMonthsToDate(today, Math.max(1, lifeMos - 1))),
          urgency: lifeMos <= 12 ? 'high' : 'medium',
        })
      } else {
        result.push({
          catId: cat.id, catCode: cat.code, catLabel: cat.label,
          group: 'B', calcType: cat.calcType,
          label: `Пересмотр норм — ${cat.label}`,
          reason: `Пересмотр в конце расчётного периода (${periodMos} мес)`,
          date: toIsoDate(addMonthsToDate(today, periodMos)),
          urgency: 'low',
        })
      }
    } else if (cat.calcType === 'b2_cycles') {
      const withCycles = catRows.filter(r => r.field2 != null && r.field2 > 0)
      if (withCycles.length > 0) {
        const withLife = withCycles.map(r => ({
          row: r,
          lifeMos: (r.field2! / outputVol) * periodMos,
        }))
        const minItem = withLife.reduce((a, b) => (a.lifeMos < b.lifeMos ? a : b))
        result.push({
          catId: cat.id, catCode: cat.code, catLabel: cat.label,
          group: 'B', calcType: cat.calcType,
          label: `Замена — ${cat.label}`,
          reason: `«${minItem.row.name || cat.label}»: ресурс ${minItem.row.field2?.toLocaleString('ru-RU')} циклов / ${outputVol.toLocaleString('ru-RU')} ${product.unit} = ${minItem.lifeMos.toFixed(1)} мес`,
          date: toIsoDate(addMonthsToDate(today, Math.max(1, minItem.lifeMos - 1))),
          urgency: minItem.lifeMos <= 3 ? 'high' : minItem.lifeMos <= 12 ? 'medium' : 'low',
        })
      } else {
        result.push({
          catId: cat.id, catCode: cat.code, catLabel: cat.label,
          group: 'B', calcType: cat.calcType,
          label: `Контроль ресурса — ${cat.label}`,
          reason: `Пересмотр в конце расчётного периода (${periodMos} мес)`,
          date: toIsoDate(addMonthsToDate(today, periodMos)),
          urgency: 'low',
        })
      }
    } else {
      result.push({
        catId: cat.id, catCode: cat.code, catLabel: cat.label,
        group: 'B', calcType: cat.calcType,
        label: `Плановое обслуживание — ${cat.label}`,
        reason: `Периодические расходы → уведомление в конце периода (${periodMos} мес)`,
        date: toIsoDate(addMonthsToDate(today, periodMos)),
        urgency: 'low',
      })
    }
  }

  return result
}

const URGENCY_STYLES = {
  high:   { badge: 'bg-red-100 text-red-700 border-red-200',     dot: 'bg-red-500',   label: 'срочно' },
  medium: { badge: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500', label: 'плановое' },
  low:    { badge: 'bg-sky-100 text-sky-700 border-sky-200',      dot: 'bg-sky-400',   label: 'периодичное' },
}

function SummaryStep({ rows, product, enabled, customCats, catConverters,
  exchangeRate, setExchangeRate, convertCurrency, setConvertCurrency,
  selectedGroup, editMode, initialNotifDate, initialRecipient, initialNote,
  linkedEquipmentIds, equipmentNorms,
  onSave, onBack }: {
  rows: Record<string, CostRow[]>
  product: CostProduct
  enabled: Record<string, boolean>
  customCats: CustomCategory[]
  catConverters: Record<string, { currency: string; rate: number }>
  exchangeRate: number
  setExchangeRate: (r: number) => void
  convertCurrency: string
  setConvertCurrency: (c: string) => void
  selectedGroup: GroupChoice
  editMode: boolean
  initialNotifDate: string
  initialRecipient: string
  initialNote: string
  linkedEquipmentIds?: string[]
  equipmentNorms?: EquipmentNorm[]
  onSave: (data: import('./types').CostNorm) => void
  onBack: () => void
}) {
  const navigate = useNavigate()
  const [notifDate, setNotifDate] = useState(initialNotifDate)
  const [recipient, setRecipient] = useState(initialRecipient || product.responsible || '')
  const [saveNote, setSaveNote] = useState(initialNote)
  const [selectedSuggId, setSelectedSuggId] = useState<string | null>(null)

  const summaries = useMemo(() =>
    CATEGORIES.filter(c => enabled[c.id]).map(cat => {
      const conv = catConverters[cat.id]
      const mult = conv && conv.currency && conv.rate > 0 ? conv.rate : 1
      const effRows = mult !== 1
        ? rows[cat.id].map(r => ({ ...r, price: r.price != null ? r.price * mult : null }))
        : rows[cat.id]
      return { cat, ...calcCategoryTotal(effRows, cat.calcType, product) }
    }), [rows, product, enabled, catConverters])

  const customSummaries = useMemo(() =>
    customCats.map(cc => ({
      cc,
      catDef: makeCustomCatDef(cc.id, cc.name, cc.group),
      ...calcCategoryTotal(cc.rows, makeCustomCatDef(cc.id, cc.name, cc.group).calcType, product),
    })).filter(s => s.totalPerUnit > 0 || s.totalPerPeriod > 0),
    [customCats, product])

  const suggestions = useMemo(() => calcSuggestions(summaries, rows, product), [summaries, rows, product])

  const linkedSummaries = useMemo(() => {
    if (!linkedEquipmentIds?.length || !equipmentNorms) return []
    return linkedEquipmentIds.flatMap(eqId => {
      const eq = equipmentNorms.find(e => e.id === eqId)
      if (!eq) return []
      return CATEGORIES
        .filter(c => c.group === 'B' && eq.enabled[c.id])
        .map(cat => {
          const conv = eq.catConverters?.[cat.id]
          const mult = conv?.currency && conv.rate > 0 ? conv.rate : 1
          const effRows = mult !== 1
            ? (eq.rows[cat.id] ?? []).map(r => ({ ...r, price: r.price != null ? r.price * mult : null }))
            : (eq.rows[cat.id] ?? [])
          return { cat, eqId, eqName: eq.name, ...calcCategoryTotal(effRows, cat.calcType, product) }
        })
        .filter(s => s.totalPerUnit > 0 || s.totalPerPeriod > 0)
    })
  }, [linkedEquipmentIds, equipmentNorms, product])

  const groupA = summaries.filter(s => s.cat.group === 'A')
  const groupB = summaries.filter(s => s.cat.group === 'B')
  const totalA_unit = groupA.reduce((s, r) => s + r.totalPerUnit, 0)
  const totalB_unit = groupB.reduce((s, r) => s + r.totalPerUnit, 0)
  const totalA_period = groupA.reduce((s, r) => s + r.totalPerPeriod, 0)
  const totalB_period = groupB.reduce((s, r) => s + r.totalPerPeriod, 0)
  const totalCustom_unit = customSummaries.reduce((s, r) => s + r.totalPerUnit, 0)
  const totalCustom_period = customSummaries.reduce((s, r) => s + r.totalPerPeriod, 0)
  const totalLinked_unit = linkedSummaries.reduce((s, r) => s + r.totalPerUnit, 0)
  const totalLinked_period = linkedSummaries.reduce((s, r) => s + r.totalPerPeriod, 0)
  const grand_unit = totalA_unit + totalB_unit + totalCustom_unit + totalLinked_unit
  const grand_period = totalA_period + totalB_period + totalCustom_period + totalLinked_period

  const baseSym = currencySymbol(product.currency)
  const convertSym = currencySymbol(convertCurrency)
  const convertOptions = CONVERT_TO[product.currency] ?? ['USD']

  const pct = (val: number) => grand_unit > 0 ? `${((val / grand_unit) * 100).toFixed(1)}%` : '—'

  function pickSuggestion(s: NotifSuggestion) {
    setNotifDate(s.date)
    setSelectedSuggId(s.catId)
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-full bg-emerald-500 text-white text-sm font-bold flex items-center justify-center">✓</div>
          <div>
            <h2 className="text-base font-bold text-[#1A1F3C]">Сводная таблица — Себестоимость на 1 единицу</h2>
            <p className="text-sm text-[#6B7A99]">Все данные пересчитаны автоматически из листов категорий</p>
          </div>
        </div>

        {product.name && (
          <div className="mb-5 mt-3 flex flex-wrap gap-3 text-sm">
            <span className="px-3 py-1.5 rounded-lg bg-[#F0F2FA] text-[#4A5578]"><b>{summaries[0]?.cat.group === 'B' ? 'Объект:' : 'Продукт:'}</b> {product.name}</span>
            <span className="px-3 py-1.5 rounded-lg bg-[#F0F2FA] text-[#4A5578]"><b>Объём:</b> {product.outputVolume.toLocaleString('ru-RU')} {product.unit} / {product.period}</span>
            <span className="px-3 py-1.5 rounded-lg bg-[#F0F2FA] text-[#4A5578]"><b>Валюта:</b> {product.currency} ({baseSym})</span>
          </div>
        )}

        {summaries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#C7D4FF] bg-[#F8F9FF] p-8 text-center">
            <p className="text-sm font-medium text-[#6B7A99]">Ни одна категория не включена</p>
            <p className="text-xs text-[#9BA8C0] mt-1">Вернитесь на шаг «Затраты» и включите нужные категории</p>
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#F8F9FF] border-b-2 border-[#E0E5F5]">
                <th className="text-left px-3 py-2.5 text-[#9BA8C0] font-semibold">№</th>
                <th className="text-left px-3 py-2.5 text-[#9BA8C0] font-semibold">Группа</th>
                <th className="text-left px-3 py-2.5 text-[#9BA8C0] font-semibold">Категория</th>
                <th className="text-right px-3 py-2.5 text-[#9BA8C0] font-semibold">На 1 {product.unit}, {baseSym}</th>
                <th className="text-right px-3 py-2.5 text-[#9BA8C0] font-semibold">За период, {baseSym}</th>
                <th className="text-right px-3 py-2.5 text-[#9BA8C0] font-semibold">Доля</th>
              </tr>
            </thead>
            <tbody>
              {/* Group A */}
              {groupA.map((s, i) => (
                <tr key={s.cat.id} className="border-b border-[#F0F2FA] hover:bg-[#FAFBFF]">
                  <td className="px-3 py-2 text-[#9BA8C0]">{i + 1}</td>
                  <td className="px-3 py-2">
                    <span className="text-[11px] px-2 py-0.5 rounded bg-[#4F73F7]/10 text-[#4F73F7] font-bold">А (перем.)</span>
                  </td>
                  <td className="px-3 py-2 font-medium text-[#1A1F3C]">{s.cat.fullLabel}</td>
                  <td className="px-3 py-2 text-right font-mono text-[#4F73F7]">{fmtNum(s.totalPerUnit, 2)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtCurrency(s.totalPerPeriod)}</td>
                  <td className="px-3 py-2 text-right text-[#9BA8C0]">{pct(s.totalPerUnit)}</td>
                </tr>
              ))}
              {/* Group A subtotal */}
              {groupA.length > 0 && (
                <tr className="bg-[#EEF2FF] border-b border-[#C7D4FF]">
                  <td colSpan={3} className="px-3 py-2 font-bold text-[#4F73F7]">ИТОГО Группа А (переменные)</td>
                  <td className="px-3 py-2 text-right font-bold font-mono text-[#4F73F7]">{fmtNum(totalA_unit, 2)}</td>
                  <td className="px-3 py-2 text-right font-bold font-mono text-[#4F73F7]">{fmtCurrency(totalA_period)}</td>
                  <td className="px-3 py-2 text-right font-bold text-[#4F73F7]">{pct(totalA_unit)}</td>
                </tr>
              )}
              {/* Group B */}
              {groupB.map((s, i) => (
                <tr key={s.cat.id} className="border-b border-[#F0F2FA] hover:bg-[#FAFBFF]">
                  <td className="px-3 py-2 text-[#9BA8C0]">{groupA.length + i + 1}</td>
                  <td className="px-3 py-2">
                    <span className="text-[11px] px-2 py-0.5 rounded bg-orange-100 text-orange-700 font-bold">Б (пост.)</span>
                  </td>
                  <td className="px-3 py-2 font-medium text-[#1A1F3C]">{s.cat.fullLabel}</td>
                  <td className="px-3 py-2 text-right font-mono text-orange-700">{fmtNum(s.totalPerUnit, 2)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtCurrency(s.totalPerPeriod)}</td>
                  <td className="px-3 py-2 text-right text-[#9BA8C0]">{pct(s.totalPerUnit)}</td>
                </tr>
              ))}
              {/* Group B subtotal */}
              {groupB.length > 0 && (
                <tr className="bg-orange-50 border-b border-orange-200">
                  <td colSpan={3} className="px-3 py-2 font-bold text-orange-700">ИТОГО Группа Б (постоянные)</td>
                  <td className="px-3 py-2 text-right font-bold font-mono text-orange-700">{fmtNum(totalB_unit, 2)}</td>
                  <td className="px-3 py-2 text-right font-bold font-mono text-orange-700">{fmtCurrency(totalB_period)}</td>
                  <td className="px-3 py-2 text-right font-bold text-orange-700">{pct(totalB_unit)}</td>
                </tr>
              )}
              {/* Linked equipment contributions */}
              {linkedSummaries.length > 0 && (
                <>
                  <tr className="bg-orange-50/50">
                    <td colSpan={6} className="px-3 py-1.5 text-[10px] font-bold text-orange-600 uppercase tracking-wide">
                      Привязанное оборудование (Гр.Б)
                    </td>
                  </tr>
                  {linkedSummaries.map((s, i) => (
                    <tr key={`${s.eqId}-${s.cat.id}`} className="border-b border-[#F0F2FA] hover:bg-[#FFF9F5]">
                      <td className="px-3 py-2 text-[#9BA8C0]">{groupA.length + groupB.length + i + 1}</td>
                      <td className="px-3 py-2">
                        <span className="text-[11px] px-2 py-0.5 rounded bg-orange-100 text-orange-700 font-bold">Б (пост.)</span>
                      </td>
                      <td className="px-3 py-2 text-[#1A1F3C]">
                        <span className="font-medium">{s.cat.fullLabel}</span>
                        <span className="text-[10px] text-[#9BA8C0] ml-2">← {s.eqName}</span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-orange-700">{fmtNum(s.totalPerUnit, 2)}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmtCurrency(s.totalPerPeriod)}</td>
                      <td className="px-3 py-2 text-right text-[#9BA8C0]">{pct(s.totalPerUnit)}</td>
                    </tr>
                  ))}
                  <tr className="bg-orange-50 border-b border-orange-200">
                    <td colSpan={3} className="px-3 py-2 font-bold text-orange-700">ИТОГО из оборудования</td>
                    <td className="px-3 py-2 text-right font-bold font-mono text-orange-700">{fmtNum(totalLinked_unit, 2)}</td>
                    <td className="px-3 py-2 text-right font-bold font-mono text-orange-700">{fmtCurrency(totalLinked_period)}</td>
                    <td className="px-3 py-2 text-right font-bold text-orange-700">{pct(totalLinked_unit)}</td>
                  </tr>
                </>
              )}
              {/* Custom categories */}
              {customSummaries.map((s, i) => (
                <tr key={s.cc.id} className="border-b border-[#F0F2FA] hover:bg-[#FAFBFF]">
                  <td className="px-3 py-2 text-[#9BA8C0]">{groupA.length + groupB.length + i + 1}</td>
                  <td className="px-3 py-2">
                    <span className="text-[11px] px-2 py-0.5 rounded bg-[#F0F2FA] text-[#6B7A99] font-bold">★</span>
                  </td>
                  <td className="px-3 py-2 font-medium text-[#1A1F3C]">{s.cc.name || 'Своя категория'}</td>
                  <td className="px-3 py-2 text-right font-mono text-[#4A5578]">{fmtNum(s.totalPerUnit, 2)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtCurrency(s.totalPerPeriod)}</td>
                  <td className="px-3 py-2 text-right text-[#9BA8C0]">{pct(s.totalPerUnit)}</td>
                </tr>
              ))}
              {customSummaries.length > 0 && (
                <tr className="bg-[#F8F9FF] border-b border-[#E0E5F5]">
                  <td colSpan={3} className="px-3 py-2 font-bold text-[#6B7A99]">ИТОГО Свои категории</td>
                  <td className="px-3 py-2 text-right font-bold font-mono text-[#4A5578]">{fmtNum(totalCustom_unit, 2)}</td>
                  <td className="px-3 py-2 text-right font-bold font-mono text-[#4A5578]">{fmtCurrency(totalCustom_period)}</td>
                  <td className="px-3 py-2 text-right font-bold text-[#6B7A99]">{pct(totalCustom_unit)}</td>
                </tr>
              )}
              {/* Grand total */}
              <tr className="bg-emerald-50 border-t-2 border-emerald-300">
                <td colSpan={3} className="px-3 py-3 font-extrabold text-[#1A1F3C] text-base">
                  💰 ПОЛНАЯ СЕБЕСТОИМОСТЬ
                </td>
                <td className="px-3 py-3 text-right font-extrabold font-mono text-emerald-700 text-base">{fmtNum(grand_unit, 2)}</td>
                <td className="px-3 py-3 text-right font-extrabold font-mono text-emerald-700 text-base">{fmtCurrency(grand_period)}</td>
                <td className="px-3 py-3 text-right font-bold text-emerald-700">100%</td>
              </tr>
            </tbody>
          </table>
        )}

        {/* ── Currency converter ─────────────────────────────────── */}
        {grand_unit > 0 && (
          <div className="mt-5 rounded-xl border border-[#E0E5F5] bg-[#F8F9FF] p-4">
            <p className="text-xs font-bold text-[#9BA8C0] uppercase tracking-wide mb-3">Конвертер валют</p>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <p className="text-[10px] text-[#9BA8C0] mb-1">Перевести в</p>
                <select value={convertCurrency} onChange={e => setConvertCurrency(e.target.value)}
                  className="input text-sm font-semibold w-36">
                  {convertOptions.map(c => (
                    <option key={c} value={c}>{c} — {currencySymbol(c)}</option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-[10px] text-[#9BA8C0] mb-1">Курс: 1 {convertCurrency} =</p>
                <div className="flex items-center gap-2">
                  <input type="text" inputMode="numeric"
                    value={exchangeRate > 0 ? exchangeRate.toLocaleString('ru-RU') : ''}
                    onChange={e => {
                      const d = e.target.value.replace(/\D/g, '')
                      setExchangeRate(d ? +d : 0)
                    }}
                    className="input w-36 text-right"
                    placeholder="введите курс" />
                  <span className="text-sm font-semibold text-[#6B7A99]">{baseSym}</span>
                </div>
              </div>
              {exchangeRate > 0 && (
                <div className="flex gap-4 flex-wrap">
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5">
                    <p className="text-[10px] text-[#9BA8C0] mb-0.5">На 1 {product.unit}</p>
                    <p className="text-lg font-extrabold text-emerald-700">
                      {fmtNum(grand_unit / exchangeRate, 2)} <span className="text-sm font-bold">{convertSym}</span>
                    </p>
                  </div>
                  {grand_period > 0 && (
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5">
                      <p className="text-[10px] text-[#9BA8C0] mb-0.5">За {product.period}</p>
                      <p className="text-lg font-extrabold text-emerald-700">
                        {fmtCurrency(grand_period / exchangeRate, convertSym)}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Smart notifications ── */}
      {grand_unit > 0 && suggestions.length > 0 && (
        <div className="mt-4 card p-5">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-xl shrink-0">🔔</div>
            <div>
              <p className="font-bold text-[#1A1F3C]">Умные уведомления</p>
              <p className="text-xs text-[#6B7A99]">
                Система рассчитала рекомендуемые даты на основе норм и периода нормирования.
                Выберите один вариант — или задайте дату вручную ниже.
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2">
            {suggestions.map(s => {
              const style = URGENCY_STYLES[s.urgency]
              const isSelected = selectedSuggId === s.catId
              return (
                <button key={s.catId} onClick={() => pickSuggestion(s)}
                  className={`w-full text-left rounded-xl border-2 px-4 py-3 transition-all ${
                    isSelected
                      ? 'border-[#4F73F7] bg-[#EEF2FF] shadow-md shadow-[#4F73F7]/10'
                      : 'border-[#E8EBF7] bg-white hover:border-[#C7D4FF] hover:bg-[#F8F9FF]'
                  }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <span className={`mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 border ${
                        s.group === 'A'
                          ? 'bg-[#4F73F7]/10 text-[#4F73F7] border-[#C7D4FF]'
                          : 'bg-orange-100 text-orange-700 border-orange-200'
                      }`}>
                        {s.catCode}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#1A1F3C] leading-tight">{s.label}</p>
                        <p className="text-xs text-[#6B7A99] mt-0.5 leading-relaxed">{s.reason}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${style.badge}`}>
                        {style.label}
                      </span>
                      <span className={`text-sm font-bold ${isSelected ? 'text-[#4F73F7]' : 'text-[#1A1F3C]'}`}>
                        {fmtDateRu(s.date)}
                      </span>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-[#4F73F7] font-medium">
                      <Check size={12} /> Выбрано как дата уведомления
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-[#E8EBF7]">
            <p className="text-xs font-semibold text-[#6B7A99] mb-2">
              {selectedSuggId ? 'Выбранная дата (можно изменить):' : 'Или задать дату вручную:'}
            </p>
            <div className="flex items-center gap-3">
              <input type="date" className="input w-48" value={notifDate}
                onChange={e => { setNotifDate(e.target.value); setSelectedSuggId(null) }} />
              {notifDate && !selectedSuggId && (
                <span className="text-xs text-[#6B7A99] bg-[#F0F2FA] px-3 py-1.5 rounded-lg">
                  Ручная дата: {fmtDateRu(notifDate)}
                </span>
              )}
              {notifDate && (
                <button onClick={() => { setNotifDate(''); setSelectedSuggId(null) }}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors">
                  Сбросить
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Save ── */}
      {grand_unit > 0 && (
        <div className="mt-4 rounded-xl border border-[#C7D4FF] bg-[#F8F9FF] p-5">
          <p className="text-xs font-bold text-[#9BA8C0] uppercase tracking-wide mb-4">Сохранение на дашборд</p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="label">Ответственный</label>
              <input type="text" className="input" value={recipient}
                onChange={e => setRecipient(e.target.value)}
                placeholder="ФИО или отдел" />
            </div>
            <div>
              <label className="label">Дата уведомления</label>
              <div className="flex items-center gap-2">
                <input type="date" className="input flex-1" value={notifDate}
                  onChange={e => { setNotifDate(e.target.value); setSelectedSuggId(null) }} />
                {notifDate && (
                  <span className="text-xs text-[#4F73F7] font-semibold whitespace-nowrap">
                    {fmtDateRu(notifDate)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <textarea className="input w-full mb-4 resize-none" rows={2} value={saveNote}
            onChange={e => setSaveNote(e.target.value)}
            placeholder="Примечание (необязательно)" />
          <button onClick={() => {
            // Merge all summaryRows (local + linked equipment) by catId
            const allRaw = [
              ...summaries.map(s => ({
                catId: s.cat.id, catCode: s.cat.code, catLabel: s.cat.label,
                group: s.cat.group as 'A' | 'B',
                totalPerUnit: s.totalPerUnit, totalPerPeriod: s.totalPerPeriod,
              })),
              ...customSummaries.map(s => ({
                catId: s.cc.id, catCode: '★', catLabel: s.cc.name || 'Своя категория',
                group: 'custom' as const,
                totalPerUnit: s.totalPerUnit, totalPerPeriod: s.totalPerPeriod,
              })),
              ...linkedSummaries.map(s => ({
                catId: s.cat.id, catCode: s.cat.code, catLabel: s.cat.label,
                group: 'B' as const,
                totalPerUnit: s.totalPerUnit, totalPerPeriod: s.totalPerPeriod,
              })),
            ]
            const mergedMap = new Map<string, typeof allRaw[0]>()
            for (const r of allRaw) {
              const existing = mergedMap.get(r.catId)
              if (existing) {
                existing.totalPerUnit += r.totalPerUnit
                existing.totalPerPeriod += r.totalPerPeriod
              } else {
                mergedMap.set(r.catId, { ...r })
              }
            }
            const normData: import('./types').CostNorm = {
              id: '',
              createdAt: '',
              product,
              summaryRows: [...mergedMap.values()],
              grandUnit: grand_unit,
              grandPeriod: grand_period,
              notificationDate: notifDate || null,
              recipient,
              note: saveNote,
              linkedEquipmentIds: linkedEquipmentIds ?? [],
              wizardState: {
                selectedGroup,
                rows,
                enabled,
                customCats,
                catConverters,
              },
            }
            onSave(normData)
            navigate('/')
          }} className="btn-primary">
            {editMode ? 'Сохранить изменения' : 'Сохранить и разместить на дашборде'} <ChevronRight size={15} />
          </button>
        </div>
      )}

      <div className="flex justify-start mt-4">
        <button onClick={onBack} className="btn-secondary">
          <ChevronLeft size={15} /> Назад к затратам
        </button>
      </div>
    </div>
  )
}

// ── Equipment-mode link/save step ───────────────────────────────────────────

function EquipmentLinkStep({ costNorms, linkedProductIds, onToggle, onBack, onSave, editMode, product, rows, enabled }: {
  costNorms: CostNorm[]
  linkedProductIds: string[]
  onToggle: (id: string) => void
  onBack: () => void
  onSave: () => void
  editMode: boolean
  product: CostProduct
  rows: Record<string, CostRow[]>
  enabled: Record<string, boolean>
}) {
  const sym = currencySymbol(product.currency)
  const dummyProduct = { ...product, outputVolume: product.outputVolume > 0 ? product.outputVolume : 1, periodMonths: product.periodMonths > 0 ? product.periodMonths : 1 }

  const totalPerMonth = useMemo(() => {
    return CATEGORIES
      .filter(c => c.group === 'B' && enabled[c.id])
      .reduce((sum, cat) => {
        const { totalPerPeriod } = calcCategoryTotal(rows[cat.id] ?? [], cat.calcType, dummyProduct)
        return sum + totalPerPeriod
      }, 0)
  }, [rows, enabled, product])

  return (
    <div className="max-w-2xl mx-auto">
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-[#EEF2FF] flex items-center justify-center shrink-0">
            <Link2 size={18} className="text-[#4F73F7]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#1A1F3C]">Привязка к нормам расходов</h2>
            <p className="text-sm text-[#6B7A99]">Выберите продукты, в себестоимость которых входит это оборудование</p>
          </div>
        </div>

        <p className="text-xs text-[#9BA8C0] mb-5 bg-[#F0F2FA] px-3 py-2 rounded-lg">
          Затраты будут автоматически распределены на себестоимость единицы продукции пропорционально плановому объёму выпуска.
        </p>

        {totalPerMonth > 0 && (
          <div className="mb-4 rounded-xl bg-orange-50 border border-orange-200 px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs font-bold text-orange-600 uppercase tracking-wide">Итого затрат за период</span>
            <span className="text-base font-bold text-orange-700">{fmtCurrency(totalPerMonth)} {sym}</span>
          </div>
        )}

        {costNorms.length === 0 ? (
          <div className="text-center py-10 text-[#9BA8C0]">
            <div className="w-12 h-12 rounded-2xl bg-[#EEF2FF] flex items-center justify-center mx-auto mb-3">
              <Link2 size={20} className="text-[#4F73F7]/40" />
            </div>
            <p className="text-sm font-medium text-[#6B7A99]">Нет созданных норм расходов (Группа А)</p>
            <p className="text-xs mt-1">Сначала создайте норму расходов на продукт</p>
          </div>
        ) : (
          <div className="space-y-2">
            {costNorms.map(norm => {
              const isLinked = linkedProductIds.includes(norm.id)
              const normSym = currencySymbol(norm.product.currency)
              return (
                <button key={norm.id} onClick={() => onToggle(norm.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left
                    ${isLinked
                      ? 'border-[#4F73F7] bg-[#EEF2FF]'
                      : 'border-[#E0E5F5] bg-white hover:border-[#4F73F7]/40 hover:bg-[#F5F7FF]'}`}>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all
                    ${isLinked ? 'border-[#4F73F7] bg-[#4F73F7]' : 'border-[#C4CEDF] bg-white'}`}>
                    {isLinked && <Check size={11} className="text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-[#1A1F3C]">{norm.product.name || 'Без названия'}</div>
                    {norm.product.article && <div className="text-xs text-[#9BA8C0] truncate">{norm.product.article}</div>}
                    <div className="text-xs text-[#9BA8C0] mt-0.5">
                      {norm.product.outputVolume.toLocaleString('ru-RU')} {norm.product.unit} / {norm.product.period}
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <div className="text-sm font-bold text-[#4F73F7]">
                      {norm.grandUnit.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {normSym}
                    </div>
                    <div className="text-[10px] text-[#9BA8C0]">себест./ед.</div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        <div className="flex justify-between mt-6 pt-4 border-t border-[#F0F2FA]">
          <button onClick={onBack} className="btn-secondary">
            <ChevronLeft size={15} /> Назад
          </button>
          <button onClick={onSave} className="btn-primary">
            {editMode ? 'Сохранить изменения' : 'Сохранить оборудование'} <Check size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main wizard ─────────────────────────────────────────────────────────────

export function CostWizard() {
  const { id: editId } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const isEquipmentMode = location.pathname.startsWith('/equipment')
  const {
    costNorms, addCostNorm, updateCostNorm,
    equipmentNorms, addEquipmentNorm, updateEquipmentNorm, linkEquipmentToProducts,
  } = useStore()

  const editingCostNorm = !isEquipmentMode && editId ? costNorms.find(n => n.id === editId) ?? null : null
  const editingEquipment = isEquipmentMode && editId ? equipmentNorms.find(e => e.id === editId) ?? null : null
  const editMode = (editingCostNorm ?? editingEquipment) != null

  const equipmentDerivedProduct: CostProduct | null = editingEquipment
    ? (editingEquipment.product ?? {
        ...DEFAULT_PRODUCT,
        name: editingEquipment.name,
        article: editingEquipment.description,
        currency: editingEquipment.currency,
      })
    : null

  const ws = editingCostNorm?.wizardState ?? editingEquipment?.wizardState

  const [step, setStep] = useState(isEquipmentMode || editMode ? 1 : 0)
  const [selectedGroup, setSelectedGroup] = useState<GroupChoice>(
    isEquipmentMode ? 'B' : (ws?.selectedGroup ?? 'A')
  )
  const [product, setProduct] = useState<CostProduct>(
    editingCostNorm?.product ?? equipmentDerivedProduct ?? (isEquipmentMode ? { ...DEFAULT_PRODUCT, period: 'месяц', periodMonths: 1 } : DEFAULT_PRODUCT)
  )
  const [rows, setRows] = useState<Record<string, CostRow[]>>(ws?.rows ?? editingEquipment?.rows ?? initRows())
  const [enabled, setEnabled] = useState<Record<string, boolean>>(ws?.enabled ?? editingEquipment?.enabled ?? initEnabled())
  const [customCats, setCustomCats] = useState<CustomCategory[]>(ws?.customCats ?? [])
  const [catConverters, setCatConverters] = useState<Record<string, { currency: string; rate: number }>>(ws?.catConverters ?? editingEquipment?.catConverters ?? {})
  const [linkedEquipmentIds, setLinkedEquipmentIds] = useState<string[]>(editingCostNorm?.linkedEquipmentIds ?? [])
  const [linkedProductIds, setLinkedProductIds] = useState<string[]>(() =>
    isEquipmentMode && editId
      ? costNorms.filter(n => (n.linkedEquipmentIds ?? []).includes(editId)).map(n => n.id)
      : []
  )
  const [exchangeRate, setExchangeRate] = useState(0)
  const [convertCurrency, setConvertCurrency] = useState('USD')

  const goTo = (i: number) => {
    const minStep = (isEquipmentMode || editMode) ? 1 : 0
    if (i >= minStep && (i <= step || i === step + 1)) setStep(i)
  }

  const toggleCategory = useCallback((catId: string) => {
    setEnabled(prev => {
      const next = !prev[catId]
      if (next && rows[catId].length === 0) {
        const newRow: CostRow = {
          id: `new-${++_newId}`,
          subcategory: '', name: '', article: '', unit: '',
          field1: null, field2: null, price: null, supplier: '', note: '',
        }
        setRows(r => ({ ...r, [catId]: [newRow] }))
      }
      return { ...prev, [catId]: next }
    })
  }, [rows])

  const updateRow = useCallback((catId: string, rowId: string, changes: Partial<CostRow>) => {
    setRows(prev => ({
      ...prev,
      [catId]: prev[catId].map(r => r.id === rowId ? { ...r, ...changes } : r),
    }))
  }, [])

  const addRow = useCallback((catId: string) => {
    const lastRow = rows[catId][rows[catId].length - 1]
    const newRow: CostRow = {
      id: `new-${++_newId}`,
      subcategory: lastRow?.subcategory ?? '',
      name: '', article: '', unit: lastRow?.unit ?? '',
      field1: null, field2: null, price: null, supplier: '', note: '',
    }
    setRows(prev => ({ ...prev, [catId]: [...prev[catId], newRow] }))
    if (!enabled[catId]) setEnabled(prev => ({ ...prev, [catId]: true }))
  }, [rows, enabled])

  const deleteRow = useCallback((catId: string, rowId: string) => {
    setRows(prev => ({ ...prev, [catId]: prev[catId].filter(r => r.id !== rowId) }))
  }, [])

  const addCustomCat = useCallback(() => {
    const newRow: CostRow = { id: `cr${++_newId}`, subcategory: '', name: '', article: '', unit: '', field1: null, field2: null, price: null, supplier: '', note: '' }
    setCustomCats(prev => [...prev, { id: `cc${++_newId}`, name: '', rows: [newRow], group: selectedGroup }])
  }, [selectedGroup])

  const updateCustomCatName = useCallback((catId: string, name: string) => {
    setCustomCats(prev => prev.map(c => c.id === catId ? { ...c, name } : c))
  }, [])

  const addCustomCatRow = useCallback((catId: string) => {
    setCustomCats(prev => prev.map(c => {
      if (c.id !== catId) return c
      const last = c.rows[c.rows.length - 1]
      const newRow: CostRow = { id: `cr${++_newId}`, subcategory: '', name: '', article: '', unit: last?.unit ?? '', field1: null, field2: null, price: null, supplier: '', note: '' }
      return { ...c, rows: [...c.rows, newRow] }
    }))
  }, [])

  const updateCustomCatRow = useCallback((catId: string, rowId: string, changes: Partial<CostRow>) => {
    setCustomCats(prev => prev.map(c => {
      if (c.id !== catId) return c
      return { ...c, rows: c.rows.map(r => r.id === rowId ? { ...r, ...changes } : r) }
    }))
  }, [])

  const deleteCustomCatRow = useCallback((catId: string, rowId: string) => {
    setCustomCats(prev => prev.map(c => {
      if (c.id !== catId) return c
      return { ...c, rows: c.rows.filter(r => r.id !== rowId) }
    }))
  }, [])

  const deleteCustomCat = useCallback((catId: string) => {
    setCustomCats(prev => prev.filter(c => c.id !== catId))
  }, [])

  const handleSave = useCallback((data: import('./types').CostNorm) => {
    const payload = {
      product: data.product,
      summaryRows: data.summaryRows,
      grandUnit: data.grandUnit,
      grandPeriod: data.grandPeriod,
      notificationDate: data.notificationDate,
      recipient: data.recipient,
      note: data.note,
      wizardState: data.wizardState,
      linkedEquipmentIds: data.linkedEquipmentIds ?? [],
    }
    if (editingCostNorm) {
      updateCostNorm(editingCostNorm.id, payload)
    } else {
      addCostNorm(payload)
    }
  }, [editingCostNorm, addCostNorm, updateCostNorm])

  const handleSaveEquipment = useCallback(() => {
    const data: Omit<EquipmentNorm, 'id' | 'createdAt'> = {
      name: product.name,
      description: product.article,
      currency: product.currency,
      rows,
      enabled,
      catConverters,
      product,
      wizardState: {
        selectedGroup: 'B',
        rows,
        enabled,
        customCats,
        catConverters,
      },
    }
    let equipId: string
    if (editingEquipment) {
      updateEquipmentNorm(editingEquipment.id, data)
      equipId = editingEquipment.id
    } else {
      const norm = addEquipmentNorm(data)
      equipId = norm.id
    }
    linkEquipmentToProducts(equipId, linkedProductIds)
    navigate('/')
  }, [product, rows, enabled, catConverters, customCats, editingEquipment, linkedProductIds, addEquipmentNorm, updateEquipmentNorm, linkEquipmentToProducts, navigate])

  const toggleLinkedProduct = useCallback((normId: string) => {
    setLinkedProductIds(prev =>
      prev.includes(normId) ? prev.filter(id => id !== normId) : [...prev, normId]
    )
  }, [])

  // Используем "linkMode" — финальный шаг = EquipmentLinkStep:
  //   • редактируем EquipmentNorm (/equipment/edit/:id)
  //   • либо создаём новую запись Гр.Б в /cost/new (станет EquipmentNorm)
  const isLinkMode = isEquipmentMode || (selectedGroup === 'B' && !editingCostNorm)

  const wizardSteps = isEquipmentMode
    ? ['Объект', 'Затраты Гр.Б', 'Привязка']
    : [
        ...(editMode ? [] : ['Инструкция']),
        selectedGroup === 'B' ? 'Период' : 'Продукт',
        selectedGroup === 'B' ? 'Затраты Гр.Б' : 'Затраты',
        isLinkMode ? 'Привязка' : 'Сводка',
      ]
  const stepOffset = isEquipmentMode ? 1 : (editMode ? 1 : 0)

  const editingTitle = editingCostNorm?.product.name
    ?? editingEquipment?.name
    ?? (isEquipmentMode ? 'Оборудование' : 'Норма расходов')

  return (
    <div>
      {editMode && (
        <div className={`mb-4 flex items-center gap-3 px-4 py-2.5 rounded-xl border ${
          isEquipmentMode ? 'bg-orange-50 border-orange-200' : 'bg-amber-50 border-amber-200'
        }`}>
          <span className="text-base">✏️</span>
          <span className={`text-sm font-semibold ${isEquipmentMode ? 'text-orange-800' : 'text-amber-800'}`}>
            Редактирование: <span className={isEquipmentMode ? 'text-orange-900' : 'text-amber-900'}>{editingTitle}</span>
          </span>
        </div>
      )}

      <WizardSteps current={step - stepOffset} steps={wizardSteps} onGo={i => goTo(i + stepOffset)} />

      {step === 0 && !editMode && !isEquipmentMode && (
        <InstructionStep onNext={g => {
          setSelectedGroup(g)
          setStep(1)
        }} />
      )}
      {step === 1 && (
        <ProductStep product={product} group={selectedGroup} onChange={setProduct}
          onNext={() => setStep(2)}
          onBack={() => (isEquipmentMode || editMode) ? undefined : setStep(0)} />
      )}
      {step === 2 && (
        <CostsStep rows={rows} product={product} group={selectedGroup} enabled={enabled}
          onToggle={toggleCategory}
          onUpdate={updateRow}
          onAdd={addRow}
          onDelete={deleteRow}
          customCats={customCats}
          onAddCustomCat={addCustomCat}
          onUpdateCustomCatName={updateCustomCatName}
          onAddCustomCatRow={addCustomCatRow}
          onUpdateCustomCatRow={updateCustomCatRow}
          onDeleteCustomCatRow={deleteCustomCatRow}
          onDeleteCustomCat={deleteCustomCat}
          catConverters={catConverters} setCatConverters={setCatConverters}
          exchangeRate={exchangeRate} setExchangeRate={setExchangeRate}
          convertCurrency={convertCurrency} setConvertCurrency={setConvertCurrency}
          linkedEquipmentIds={linkedEquipmentIds}
          setLinkedEquipmentIds={setLinkedEquipmentIds}
          equipmentNorms={equipmentNorms}
          onNext={() => setStep(3)}
          onBack={() => setStep(1)} />
      )}
      {step === 3 && isLinkMode && (
        <EquipmentLinkStep
          costNorms={costNorms}
          linkedProductIds={linkedProductIds}
          onToggle={toggleLinkedProduct}
          onBack={() => setStep(2)}
          onSave={handleSaveEquipment}
          editMode={editMode}
          product={product}
          rows={rows}
          enabled={enabled} />
      )}
      {step === 3 && !isLinkMode && (
        <SummaryStep rows={rows} product={product} enabled={enabled}
          customCats={customCats} catConverters={catConverters}
          exchangeRate={exchangeRate} setExchangeRate={setExchangeRate}
          convertCurrency={convertCurrency} setConvertCurrency={setConvertCurrency}
          selectedGroup={selectedGroup}
          editMode={editMode}
          initialNotifDate={editingCostNorm?.notificationDate ?? ''}
          initialRecipient={editingCostNorm?.recipient ?? ''}
          initialNote={editingCostNorm?.note ?? ''}
          linkedEquipmentIds={linkedEquipmentIds}
          equipmentNorms={equipmentNorms}
          onSave={handleSave}
          onBack={() => setStep(2)} />
      )}
    </div>
  )
}
