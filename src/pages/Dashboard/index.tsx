import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import { Badge } from '../../components/ui/Badge'
import { Calculator, Plus, Trash2, Bell, ChevronDown, ChevronRight, Pencil, Factory } from 'lucide-react'
import { CostNorm, EquipmentNorm } from '../CostWizard/types'
import { CATEGORIES } from '../CostWizard/templates'
import { calcCategoryTotal } from '../CostWizard/formulas'

const CURRENCY_SYMBOLS: Record<string, string> = {
  UZS: 'сум', USD: '$', EUR: '€', CNY: '¥', RUB: '₽',
}
function currSym(code: string) { return CURRENCY_SYMBOLS[code] ?? code }
function fmtMoney(val: number) {
  return val.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}


function NormRow({ norm }: { norm: CostNorm }) {
  const { deleteCostNorm, equipmentNorms } = useStore()
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)

  const today = Date.now()
  const sym = currSym(norm.product.currency)
  const notifMs = norm.notificationDate ? new Date(norm.notificationDate).getTime() : null
  const daysLeft = notifMs != null ? Math.ceil((notifMs - today) / 86400000) : null
  const badgeVariant = daysLeft == null ? 'slate'
    : daysLeft < 0 ? 'red' : daysLeft <= 7 ? 'orange' : daysLeft <= 30 ? 'yellow' : 'green'

  const linkedEqContributions = useMemo(() => {
    if (!norm.linkedEquipmentIds?.length) return []
    return norm.linkedEquipmentIds.flatMap(eqId => {
      const eq = equipmentNorms.find(e => e.id === eqId)
      if (!eq) return []
      let totalPerPeriod = 0
      for (const cat of CATEGORIES.filter(c => c.group === 'B' && eq.enabled[c.id])) {
        const { totalPerPeriod: tp } = calcCategoryTotal(eq.rows[cat.id] ?? [], cat.calcType, norm.product)
        totalPerPeriod += tp
      }
      const perUnit = norm.product.outputVolume > 0 ? totalPerPeriod / norm.product.outputVolume : 0
      return [{ eq, perUnit, perPeriod: totalPerPeriod }]
    })
  }, [norm, equipmentNorms])

  const hasA = norm.summaryRows.some(r => r.group === 'A')
  const hasB = norm.summaryRows.some(r => r.group === 'B') || (norm.linkedEquipmentIds?.length ?? 0) > 0
  const groupColor = hasA && !hasB ? 'border-l-[#4F73F7]' : hasB && !hasA ? 'border-l-orange-400' : 'border-l-emerald-400'

  return (
    <>
      <tr className={`border-b border-[#F0F2FA] hover:bg-[#FAFBFF] transition-colors border-l-2 ${groupColor} cursor-pointer`}
        onClick={() => setExpanded(e => !e)}>
        <td className="px-3 py-4 w-8">
          {expanded
            ? <ChevronDown size={14} className="text-[#9BA8C0]" />
            : <ChevronRight size={14} className="text-[#C4CEDF]" />}
        </td>

        <td className="px-3 py-4">
          <div className="font-semibold text-sm text-[#1A1F3C]">{norm.product.name || 'Без названия'}</div>
          {norm.product.article && <div className="text-xs text-[#9BA8C0]">{norm.product.article}</div>}
          <div className="flex gap-1 mt-1">
            {hasA && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#4F73F7]/10 text-[#4F73F7]">А — перем.</span>}
            {hasB && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">Б — пост.</span>}
          </div>
        </td>

        <td className="px-3 py-4 text-sm text-[#4A5578]">
          {norm.product.period}
          <div className="text-xs text-[#9BA8C0]">{norm.product.outputVolume.toLocaleString('ru-RU')} {norm.product.unit}</div>
        </td>

        <td className="px-3 py-4 font-mono font-bold text-[#4F73F7] whitespace-nowrap">
          {fmtMoney(norm.grandUnit)} {sym}
        </td>

        <td className="px-3 py-4 font-mono text-sm text-[#4A5578] whitespace-nowrap">
          {fmtMoney(norm.grandPeriod)} {sym}
        </td>

        <td className="px-3 py-4 text-sm text-[#4A5578]">
          {norm.recipient || <span className="text-[#C4CEDF] text-xs">не указан</span>}
        </td>

        <td className="px-3 py-4">
          {norm.notificationDate ? (
            <div>
              <div className="text-xs text-[#6B7A99] mb-1">
                {new Date(norm.notificationDate).toLocaleDateString('ru-RU')}
              </div>
              <Badge variant={badgeVariant}>
                {daysLeft! < 0 ? 'Просрочено' : daysLeft === 0 ? 'Сегодня' : `${daysLeft} дн.`}
              </Badge>
            </div>
          ) : (
            <button onClick={e => { e.stopPropagation(); navigate(`/cost/edit/${norm.id}`) }}
              className="text-xs text-[#4F73F7] hover:underline flex items-center gap-1">
              <Plus size={11} /> Задать дату
            </button>
          )}
        </td>

        <td className="px-3 py-4 text-xs text-[#9BA8C0] whitespace-nowrap">
          {new Date(norm.createdAt).toLocaleDateString('ru-RU')}
        </td>

        <td className="px-3 py-4" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-1">
            <button onClick={() => navigate(`/cost/edit/${norm.id}`)}
              className="w-7 h-7 rounded flex items-center justify-center text-[#C4CEDF] hover:text-[#4F73F7] hover:bg-[#EEF2FF] transition-all"
              title="Редактировать">
              <Pencil size={13} />
            </button>
            <button onClick={() => deleteCostNorm(norm.id)}
              className="w-7 h-7 rounded flex items-center justify-center text-[#C4CEDF] hover:text-red-500 hover:bg-red-50 transition-all"
              title="Удалить">
              <Trash2 size={13} />
            </button>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className={`border-b border-[#F0F2FA] border-l-2 ${groupColor}`}>
          <td colSpan={9} className="px-5 pb-5 pt-0 bg-[#FAFBFF]">
            <div className="pt-4 space-y-3">
              {norm.summaryRows.filter(r => r.totalPerUnit > 0).length > 0 && (
                <>
                  <p className="text-[10px] font-bold text-[#9BA8C0] uppercase tracking-wide">Группа А — переменные затраты</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {norm.summaryRows.filter(r => r.totalPerUnit > 0).map(r => (
                      <div key={r.catId}
                        className={`rounded-lg px-3 py-2 flex items-start gap-2 ${r.group === 'A' ? 'bg-[#EEF2FF]' : r.group === 'B' ? 'bg-orange-50' : 'bg-[#F0F2FA]'}`}>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5
                          ${r.group === 'A' ? 'bg-[#4F73F7]/15 text-[#4F73F7]' : r.group === 'B' ? 'bg-orange-200 text-orange-700' : 'bg-[#E0E5F5] text-[#6B7A99]'}`}>
                          {r.catCode}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-[#1A1F3C] truncate">{r.catLabel}</div>
                          <div className={`text-xs font-bold ${r.group === 'A' ? 'text-[#4F73F7]' : r.group === 'B' ? 'text-orange-600' : 'text-[#4A5578]'}`}>
                            {fmtMoney(r.totalPerUnit)} {sym}
                          </div>
                          <div className="text-[10px] text-[#9BA8C0]">
                            {((r.totalPerUnit / norm.grandUnit) * 100).toFixed(1)}% от итога
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {linkedEqContributions.length > 0 && (
                <>
                  <p className="text-[10px] font-bold text-[#9BA8C0] uppercase tracking-wide">Группа Б — постоянные затраты (оборудование)</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {linkedEqContributions.map(({ eq, perUnit }) => (
                      <div key={eq.id} className="rounded-lg px-3 py-2 flex items-start gap-2 bg-orange-50">
                        <Factory size={14} className="text-orange-500 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-[#1A1F3C] truncate">{eq.name}</div>
                          {perUnit > 0 ? (
                            <>
                              <div className="text-xs font-bold text-orange-600">{fmtMoney(perUnit)} {sym}</div>
                              <div className="text-[10px] text-[#9BA8C0]">
                                {((perUnit / norm.grandUnit) * 100).toFixed(1)}% от итога
                              </div>
                            </>
                          ) : (
                            <div className="text-xs text-[#C4CEDF]">нет данных о стоимости</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {norm.note && (
                <p className="text-xs text-[#6B7A99] italic bg-[#F0F2FA] px-3 py-2 rounded-lg w-fit">
                  {norm.note}
                </p>
              )}
              <button onClick={() => navigate(`/cost/edit/${norm.id}`)}
                className="flex items-center gap-1.5 text-xs text-[#4F73F7] hover:underline font-medium">
                <Pencil size={11} /> Редактировать норму в визарде
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Equipment Norm row ───────────────────────────────────────────────────────

const CURRENCY_SYMS: Record<string, string> = { UZS: 'сум', USD: '$', EUR: '€', CNY: '¥', RUB: '₽' }

function EquipmentNormRow({ eq }: { eq: EquipmentNorm }) {
  const { deleteEquipmentNorm, costNorms } = useStore()
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)

  const sym = CURRENCY_SYMS[eq.currency] ?? eq.currency

  const DUMMY_PRODUCT = {
    name: '', article: '', unit: 'шт', currency: eq.currency, outputVolume: 1,
    period: 'месяц', periodMonths: 1, workingDays: 22, workingHours: 176,
    staffCount: 0, equipmentCount: 0, date: '', responsible: '',
  }

  const totalPerMonth = useMemo(() => {
    return CATEGORIES
      .filter(c => c.group === 'B' && eq.enabled[c.id])
      .reduce((sum, cat) => {
        const { totalPerPeriod } = calcCategoryTotal(eq.rows[cat.id] ?? [], cat.calcType, DUMMY_PRODUCT)
        return sum + totalPerPeriod
      }, 0)
  }, [eq])

  const linkedProducts = costNorms.filter(n => (n.linkedEquipmentIds ?? []).includes(eq.id))

  const linkedContributions = useMemo(() => {
    return linkedProducts.map(norm => {
      let totalPerPeriod = 0
      for (const cat of CATEGORIES.filter(c => c.group === 'B' && eq.enabled[c.id])) {
        const { totalPerPeriod: tp } = calcCategoryTotal(eq.rows[cat.id] ?? [], cat.calcType, norm.product)
        totalPerPeriod += tp
      }
      const perUnit = norm.product.outputVolume > 0 ? totalPerPeriod / norm.product.outputVolume : 0
      return { norm, perUnit, perPeriod: totalPerPeriod }
    })
  }, [eq, linkedProducts])

  return (
    <>
      <tr className="border-b border-[#F0F2FA] hover:bg-[#FFF9F5] transition-colors border-l-2 border-l-orange-300 cursor-pointer"
        onClick={() => setExpanded(e => !e)}>
        <td className="px-3 py-4 w-8">
          {expanded
            ? <ChevronDown size={14} className="text-[#9BA8C0]" />
            : <ChevronRight size={14} className="text-[#C4CEDF]" />}
        </td>
        <td className="px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
              <Factory size={14} className="text-orange-600" />
            </div>
            <div>
              <div className="font-semibold text-sm text-[#1A1F3C]">{eq.name || 'Без названия'}</div>
              {eq.description && <div className="text-xs text-[#9BA8C0] mt-0.5 max-w-xs truncate">{eq.description}</div>}
              <div className="flex flex-wrap gap-1 mt-1">
                {CATEGORIES.filter(c => c.group === 'B' && eq.enabled[c.id]).map(cat => (
                  <span key={cat.id} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">
                    {cat.code}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </td>
        <td className="px-4 py-4 font-mono font-bold text-orange-600 whitespace-nowrap">
          {totalPerMonth > 0 ? `${fmtMoney(totalPerMonth)} ${sym}/мес` : <span className="text-[#C4CEDF] text-xs">нет данных</span>}
        </td>
        <td className="px-4 py-4">
          {linkedProducts.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {linkedProducts.map(p => (
                <span key={p.id} className="text-[10px] bg-[#EEF2FF] text-[#4F73F7] px-2 py-0.5 rounded font-medium">
                  {p.product.name || 'Без названия'}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-xs text-[#C4CEDF]">не привязано</span>
          )}
        </td>
        <td className="px-4 py-4 text-xs text-[#9BA8C0] whitespace-nowrap">
          {new Date(eq.createdAt).toLocaleDateString('ru-RU')}
        </td>
        <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-1">
            <button onClick={() => navigate(`/equipment/edit/${eq.id}`)}
              className="w-7 h-7 rounded flex items-center justify-center text-[#C4CEDF] hover:text-orange-500 hover:bg-orange-50 transition-all"
              title="Редактировать">
              <Pencil size={13} />
            </button>
            <button onClick={() => deleteEquipmentNorm(eq.id)}
              className="w-7 h-7 rounded flex items-center justify-center text-[#C4CEDF] hover:text-red-500 hover:bg-red-50 transition-all"
              title="Удалить">
              <Trash2 size={13} />
            </button>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-[#F0F2FA] border-l-2 border-l-orange-300">
          <td colSpan={6} className="px-5 pb-5 pt-0 bg-[#FFF9F5]">
            <div className="pt-4 space-y-3">
              <p className="text-[10px] font-bold text-[#9BA8C0] uppercase tracking-wide">Привязанные нормы расходов</p>

              {linkedContributions.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-[#9BA8C0] py-2">
                  <span>Не привязано ни к одной норме расходов.</span>
                  <button onClick={() => navigate(`/equipment/edit/${eq.id}`)}
                    className="text-[#4F73F7] hover:underline font-medium flex items-center gap-1">
                    <Pencil size={11} /> Изменить привязку
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {linkedContributions.map(({ norm, perUnit }) => {
                    const normSym = CURRENCY_SYMS[norm.product.currency] ?? norm.product.currency
                    return (
                      <div key={norm.id} className="rounded-lg px-3 py-2 bg-[#EEF2FF] flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-[#1A1F3C] truncate">{norm.product.name || 'Без названия'}</div>
                          <div className="text-[10px] text-[#9BA8C0] mt-0.5">
                            {norm.product.outputVolume.toLocaleString('ru-RU')} {norm.product.unit} / {norm.product.period}
                          </div>
                          {perUnit > 0 ? (
                            <>
                              <div className="text-xs font-bold text-[#4F73F7] mt-1">{fmtMoney(perUnit)} {normSym}/ед.</div>
                              <div className="text-[10px] text-[#9BA8C0]">
                                {((perUnit / norm.grandUnit) * 100).toFixed(1)}% от себест.
                              </div>
                            </>
                          ) : (
                            <div className="text-xs text-[#C4CEDF] mt-1">нет данных о стоимости</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <button onClick={() => navigate(`/equipment/edit/${eq.id}`)}
                className="flex items-center gap-1.5 text-xs text-orange-600 hover:underline font-medium">
                <Pencil size={11} /> Редактировать оборудование
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export function Dashboard() {
  const { costNorms, equipmentNorms } = useStore()
  const today = Date.now()

  const stats = useMemo(() => {
    const total = costNorms.length
    const withNotif = costNorms.filter(n => n.notificationDate).length
    const overdue = costNorms.filter(n => n.notificationDate && new Date(n.notificationDate).getTime() < today).length
    const soon = costNorms.filter(n => {
      if (!n.notificationDate) return false
      const diff = (new Date(n.notificationDate).getTime() - today) / 86400000
      return diff >= 0 && diff <= 30
    }).length
    return { total, withNotif, overdue, soon }
  }, [costNorms, today])

  const statCards = [
    { label: 'Норм расходов',        value: stats.total,     color: 'text-[#4F73F7]',  bg: 'bg-[#EEF2FF]',  icon: Calculator },
    { label: 'С уведомлением',        value: stats.withNotif, color: 'text-blue-500',   bg: 'bg-blue-50',    icon: Bell       },
    { label: 'Просроченных',          value: stats.overdue,   color: 'text-red-500',    bg: 'bg-red-50',     icon: Bell       },
    { label: 'Пересмотр за 30 дней',  value: stats.soon,      color: 'text-orange-500', bg: 'bg-orange-50',  icon: Bell       },
  ]

  return (
    <div className="space-y-6">

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(s => (
          <div key={s.label} className="card p-5">
            <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-4`}>
              <s.icon size={18} className={s.color} />
            </div>
            <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-sm text-[#6B7A99] mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Cost norms table */}
      <div className="card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0F2FA]">
          <h2 className="text-base font-bold text-[#1A1F3C]">Нормы расходов (себестоимость)</h2>
          <Link to="/cost/new" className="btn-primary">
            <Plus size={15} /> Новая норма
          </Link>
        </div>

        {costNorms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#9BA8C0]">
            <div className="w-12 h-12 rounded-2xl bg-[#EEF2FF] flex items-center justify-center mb-4">
              <Calculator size={22} className="text-[#4F73F7]" />
            </div>
            <p className="font-medium text-[#6B7A99]">Норм пока нет</p>
            <p className="text-sm text-[#9BA8C0] mt-1 mb-4">Рассчитайте себестоимость в визарде</p>
            <Link to="/cost/new" className="btn-primary">
              <Plus size={15} /> Создать первую норму
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-[#F0F2FA]">
                  <th className="w-8" />
                  {['Продукт / Объект', 'Период / Объём', 'На 1 ед.', 'За период', 'Ответственный', 'Пересмотр', 'Создана', ''].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-[#9BA8C0] uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {costNorms.map(norm => <NormRow key={norm.id} norm={norm} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Equipment norms table */}
      <div className="card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0F2FA]">
          <div>
            <h2 className="text-base font-bold text-[#1A1F3C]">Оборудование и ресурсы (Группа Б)</h2>
            <p className="text-xs text-[#9BA8C0] mt-0.5">Постоянные затраты — независимые объекты, привязываются к нормам продуктов</p>
          </div>
          <Link to="/cost/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white transition-colors">
            <Plus size={15} /> Новое оборудование
          </Link>
        </div>

        {equipmentNorms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-[#9BA8C0]">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center mb-4">
              <Factory size={22} className="text-orange-400" />
            </div>
            <p className="font-medium text-[#6B7A99]">Оборудование не добавлено</p>
            <p className="text-sm text-[#9BA8C0] mt-1 mb-4">Создайте объект Группы Б для многократного использования</p>
            <Link to="/cost/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white transition-colors">
              <Plus size={15} /> Добавить оборудование
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-[#F0F2FA]">
                  <th className="w-8" />
                  {['Оборудование / ресурс', 'Стоимость/мес', 'Привязано к', 'Добавлено', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#9BA8C0] uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {equipmentNorms.map(eq => <EquipmentNormRow key={eq.id} eq={eq} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
