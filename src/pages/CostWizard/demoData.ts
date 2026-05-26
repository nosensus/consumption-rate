import { CostNorm, EquipmentNorm, CostRow } from './types'

const ALL_CAT_IDS = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'b1', 'b2', 'b3', 'b4', 'b5', 'b7']
const ALL_B_CAT_IDS = ['b1', 'b2', 'b3', 'b4', 'b5', 'b7']

function enabled(activeIds: string[]): Record<string, boolean> {
  return Object.fromEntries(ALL_CAT_IDS.map(id => [id, activeIds.includes(id)]))
}

function bEnabled(activeIds: string[]): Record<string, boolean> {
  return Object.fromEntries(ALL_B_CAT_IDS.map(id => [id, activeIds.includes(id)]))
}

function rows(filled: Partial<Record<string, CostRow[]>>): Record<string, CostRow[]> {
  return Object.fromEntries(ALL_CAT_IDS.map(id => [id, (filled[id] ?? []) as CostRow[]]))
}

function bRows(filled: Partial<Record<string, CostRow[]>>): Record<string, CostRow[]> {
  return Object.fromEntries(ALL_B_CAT_IDS.map(id => [id, (filled[id] ?? []) as CostRow[]]))
}

// ── Equipment Norm: 4×ТПА + упаковочная линия + расходники ────────────────────
//
// Б1 Оборудование   — 117 333 334 сум/мес
//   ТПА×4:  4 × 3 200 000 000 / 120 = 106 666 667 сум/мес
//   Упак.×1: 1 × 1 024 000 000 /  96 =  10 666 667 сум/мес
//
// Б4 Расходники     —   1 460 000 сум/мес
//   Масло  20 л × 35 000   = 700 000
//   Фильтр  4 шт × 85 000  = 340 000
//   СОЖ    15 л × 28 000   = 420 000

export const DEMO_EQUIPMENT_NORMS: EquipmentNorm[] = [
  {
    id: 'eq_tpa_syringe',
    name: 'Линия инъекционного формования (4×ТПА)',
    description: '4×HAITIAN Jupiter III + упаковочная линия IMA + расходники. Производство медицинских шприцев и аналогичной продукции.',
    currency: 'UZS',
    rows: bRows({
      b1: [
        { id: 'dmo_tpa',  subcategory: 'Основное технологическое оборудование', name: 'Термопластавтомат HAITIAN Jupiter III (ТПА)',     article: 'HAITIAN-J3', unit: 'шт', field1: 4, field2: 120, price: 3_200_000_000, supplier: 'HAITIAN International', note: 'Впрыск PP/HDPE, 4 машины' },
        { id: 'dmo_pkln', subcategory: 'Основное технологическое оборудование', name: 'Упаковочная линия (блистер + укладка в ящик)',     article: 'PL-800',     unit: 'шт', field1: 1, field2: 96,  price: 1_024_000_000, supplier: 'IMA Group',              note: '' },
      ],
      b4: [
        { id: 'dmo_oil',  subcategory: 'Смазочные материалы',    name: 'Масло индустриальное И-20А',          article: 'И-20А', unit: 'л',  field1: 20, field2: null, price: 35_000, supplier: '', note: '' },
        { id: 'dmo_flt',  subcategory: 'Фильтры и очистка',      name: 'Фильтр масляный (ТПА)',                article: '',      unit: 'шт', field1: 4,  field2: null, price: 85_000, supplier: '', note: '' },
        { id: 'dmo_soj',  subcategory: 'Технические жидкости',   name: 'СОЖ (смазочно-охлаждающая жидкость)', article: '',      unit: 'л',  field1: 15, field2: null, price: 28_000, supplier: '', note: '' },
      ],
    }),
    enabled: bEnabled(['b1', 'b4']),
    catConverters: {},
    createdAt: '2026-05-26T09:00:00.000Z',
  },
]

// ── Demo: Шприц одноразовый 10 мл — 250 млн шт/месяц ─────────────────────────
//
// А1 Сырьё (осн.)   = 85.03 сум/шт     21 256 673 863 сум/мес
// А3 Упаковка       = 62.10 сум/шт     15 526 120 000 сум/мес
// Б1 Оборудование   =  0.47 сум/шт        117 333 334 сум/мес  ← из eq_tpa_syringe
// Б4 Расходники     =  0.006 сум/шт          1 460 000 сум/мес  ← из eq_tpa_syringe
// ─────────────────────────────────────────────────────────────────────────────
// ИТОГО             = 147.61 сум/шт    36 901 587 197 сум/мес

export const DEMO_COST_NORMS: CostNorm[] = [
  {
    id: 'demo_syringe_10ml',
    product: {
      name: 'Шприц одноразовый 10 мл',
      article: 'Полипропилен, Ø10мм, ГОСТ 24861',
      unit: 'шт',
      currency: 'UZS',
      outputVolume: 250_000_000,
      period: 'месяц',
      periodMonths: 1,
      workingDays: 22,
      workingHours: 176,
      staffCount: 0,
      equipmentCount: 0,
      date: '',
      responsible: 'Плановый отдел',
    },
    summaryRows: [
      { catId: 'a1', catCode: 'А1', catLabel: 'Сырьё', group: 'A',
        totalPerUnit: 85.03, totalPerPeriod: 21_256_673_863 },
      { catId: 'a3', catCode: 'А3', catLabel: 'Упаковка', group: 'A',
        totalPerUnit: 62.10, totalPerPeriod: 15_526_120_000 },
    ],
    grandUnit: 147.61,
    grandPeriod: 36_901_587_197,
    linkedEquipmentIds: ['eq_tpa_syringe'],
    notificationDate: '2026-06-12',
    recipient: 'Плановый отдел',
    note: 'Базовая норма расходов. Цены на ПП и ПЭНД пересматривать ежеквартально. Амортизация ТПА пересчитывается при замене линии.',
    createdAt: '2026-05-26T09:00:00.000Z',

    wizardState: {
      selectedGroup: 'A',
      rows: rows({
        // ── А1 Сырьё ────────────────────────────────────────────────────────
        a1: [
          { id: 'dmo_pp',  subcategory: 'Полимеры и пластмассы', name: 'Полипропилен гранулированный J-560M',               article: 'J-560M',      unit: 'кг', field1: 0.00314418, field2: 1.0, price: 15_000,     supplier: 'ООО ПолиТрейд', note: '' },
          { id: 'dmo_crd', subcategory: 'Полимеры и пластмассы', name: 'Скользящая добавка Кродамид Crodamide OR BEAD',      article: '',            unit: 'кг', field1: 0.00000943, field2: 1.0, price: 126_600,    supplier: '',              note: '' },
          { id: 'dmo_hd',  subcategory: 'Полимеры и пластмассы', name: 'Полиэтилен низкого давления марки I-1561',           article: 'HDPE I-1561', unit: 'кг', field1: 0.00304682, field2: 1.0, price: 11_500,     supplier: 'ООО ПолиТрейд', note: '' },
          { id: 'dmo_sc',  subcategory: 'Полимеры и пластмассы', name: 'Суперконцентрат на основе полиэтилена белый UN-0005', article: '',            unit: 'кг', field1: 0.00000914, field2: 1.0, price: 84_400,     supplier: '',              note: '' },
          { id: 'dmo_eth', subcategory: 'Полимеры и пластмассы', name: 'Спирт этиловый',                                     article: '',            unit: 'л',  field1: 0.00000119, field2: 1.0, price: 15_515.11, supplier: '',              note: '' },
        ],
        // ── А3 Упаковка ─────────────────────────────────────────────────────
        a3: [
          { id: 'dmo_film', subcategory: 'Первичная упаковка', name: 'Плёнка блистерная (70 мкм, ш. 422 мм)',    article: 'BF-422-70', unit: 'кг',  field1: 0.000364, field2: 1.0, price: 32_000, supplier: 'Blister Pack LLC', note: '' },
          { id: 'dmo_inst', subcategory: 'Вторичная упаковка', name: 'Инструкция на шприц (вкладыш)',             article: '',          unit: 'шт',  field1: 1.0,      field2: 1.0, price: 10,    supplier: '',                 note: '' },
          { id: 'dmo_box',  subcategory: 'Вторичная упаковка', name: 'Гофрокороб 600×400×430 мм (100 шт/кор.)',  article: '',          unit: 'шт',  field1: 0.01,     field2: 0.5, price: 3_200, supplier: 'Картон-Сервис',   note: '' },
          { id: 'dmo_lbl',  subcategory: 'Вторичная упаковка', name: 'Этикетка на шприц (самоклеящаяся)',        article: 'LBL-10ML', unit: 'шт',  field1: 1.0,      field2: 1.0, price: 8,     supplier: '',                 note: '' },
        ],
        // Б1 и Б4 перенесены в eq_tpa_syringe (linkedEquipmentIds)
      }),
      enabled: enabled(['a1', 'a3']),
      customCats: [],
      catConverters: {},
    },
  },
]
