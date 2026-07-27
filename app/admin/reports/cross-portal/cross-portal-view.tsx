'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface PortalWeekData {
  order_revenue: number
  ingredient_cost: number
  overhead: number
  bakery_wages: number
  shop_total_sales: number
  shop_wages: number
  shop_purchases: number
  shop_overhead: number
}

interface PortalInfo {
  key: string
  label: string
  color: string
  data: PortalWeekData | null
}

interface WeekRow {
  week_start: string
  portals: PortalInfo[]
}

interface Props {
  weeks: WeekRow[]
  portals: { key: string; label: string; color: string }[]
}

const fmt  = (n: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n)
const fmtS = (n: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n)

const fmtWeek = (ws: string) => {
  const start = new Date(ws + 'T00:00:00')
  const end   = new Date(start)
  end.setDate(end.getDate() + 6)
  return `${start.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`
}

function calcTotals(data: PortalWeekData | null) {
  if (!data) return { revenue: 0, costs: 0, profit: 0, wholesale: 0, shops: 0, ingredients: 0, wages: 0, overhead: 0, shopCogs: 0, shopWages: 0, shopOH: 0 }
  const revenue     = data.order_revenue + data.shop_total_sales
  const ingredients = data.ingredient_cost
  const wages       = data.bakery_wages
  const overhead    = data.overhead
  const shopCogs    = data.shop_purchases
  const shopWages   = data.shop_wages
  const shopOH      = data.shop_overhead
  const costs       = ingredients + wages + overhead + shopCogs + shopWages + shopOH
  return {
    revenue, costs, profit: revenue - costs,
    wholesale: data.order_revenue,
    shops:     data.shop_total_sales,
    ingredients, wages, overhead, shopCogs, shopWages, shopOH,
  }
}

function sumPortals(portals: PortalInfo[]) {
  return portals.reduce((acc, p) => {
    const t = calcTotals(p.data)
    return {
      revenue:     acc.revenue     + t.revenue,
      costs:       acc.costs       + t.costs,
      profit:      acc.profit      + t.profit,
      wholesale:   acc.wholesale   + t.wholesale,
      shops:       acc.shops       + t.shops,
      ingredients: acc.ingredients + t.ingredients,
      wages:       acc.wages       + t.wages,
      overhead:    acc.overhead    + t.overhead,
      shopCogs:    acc.shopCogs    + t.shopCogs,
      shopWages:   acc.shopWages   + t.shopWages,
      shopOH:      acc.shopOH      + t.shopOH,
    }
  }, { revenue: 0, costs: 0, profit: 0, wholesale: 0, shops: 0, ingredients: 0, wages: 0, overhead: 0, shopCogs: 0, shopWages: 0, shopOH: 0 })
}

function getMonthKey(ws: string) {
  const d = new Date(ws + 'T00:00:00')
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function getMonthLabel(mk: string) {
  return new Date(mk + '-01T00:00:00').toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
}

export default function CrossPortalView({ weeks, portals }: Props) {
  const [expandedWeeks,  setExpandedWeeks]  = useState<Set<string>>(new Set())
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(() => {
    if (weeks.length === 0) return new Set()
    return new Set([getMonthKey(weeks[0].week_start)])
  })
  const [activePortals, setActivePortals] = useState<Set<string>>(
    new Set(portals.map(p => p.key))
  )

  function toggleWeek(ws: string) {
    setExpandedWeeks(prev => {
      const next = new Set(prev)
      next.has(ws) ? next.delete(ws) : next.add(ws)
      return next
    })
  }

  function toggleMonth(mk: string) {
    setExpandedMonths(prev => {
      const next = new Set(prev)
      next.has(mk) ? next.delete(mk) : next.add(mk)
      return next
    })
  }

  function togglePortal(key: string) {
    setActivePortals(prev => {
      if (prev.size === 1 && prev.has(key)) return prev
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  // Filter weeks to only active portals
  const filteredWeeks = weeks.map(w => ({
    ...w,
    portals: w.portals.filter(p => activePortals.has(p.key)),
  }))

  // Group into months
  const monthMap = new Map<string, typeof filteredWeeks>()
  for (const week of filteredWeeks) {
    const mk = getMonthKey(week.week_start)
    if (!monthMap.has(mk)) monthMap.set(mk, [])
    monthMap.get(mk)!.push(week)
  }
  const months = Array.from(monthMap.entries()).sort(([a], [b]) => b.localeCompare(a))

  // Grand totals
  const grand = sumPortals(filteredWeeks.flatMap(w => w.portals))
  const grandMargin = grand.revenue > 0 ? (grand.profit / grand.revenue) * 100 : 0

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🌐 Cross-Portal Summary</h1>
          <p className="text-sm text-gray-500 mt-0.5">Combined P&L across all bakeries</p>
        </div>
        {/* Portal toggles */}
        <div className="flex gap-2 flex-wrap">
          {portals.map(p => (
            <button
              key={p.key}
              onClick={() => togglePortal(p.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                activePortals.has(p.key)
                  ? 'text-white border-transparent'
                  : 'bg-white text-gray-400 border-gray-200'
              }`}
              style={activePortals.has(p.key) ? { backgroundColor: p.color, borderColor: p.color } : {}}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grand total cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs text-blue-600 font-medium">Total Revenue</p>
          <p className="text-2xl font-bold text-blue-800 mt-1">{fmtS(grand.revenue)}</p>
          <p className="text-xs text-blue-400 mt-0.5">Wholesale {fmtS(grand.wholesale)} + Shops {fmtS(grand.shops)}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs text-red-600 font-medium">Total Costs</p>
          <p className="text-2xl font-bold text-red-800 mt-1">{fmtS(grand.costs)}</p>
          <p className="text-xs text-red-400 mt-0.5">
            Ingr {fmtS(grand.ingredients)} · Wages {fmtS(grand.wages + grand.shopWages)} · OH {fmtS(grand.overhead + grand.shopOH)}
          </p>
        </div>
        <div className={`rounded-xl p-4 border ${grand.profit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <p className={`text-xs font-medium ${grand.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>Net Profit</p>
          <p className={`text-2xl font-bold mt-1 ${grand.profit >= 0 ? 'text-green-800' : 'text-red-800'}`}>{fmtS(grand.profit)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{grandMargin.toFixed(1)}% margin</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 font-medium">Cost Breakdown</p>
          <div className="mt-1 space-y-0.5">
            <div className="flex justify-between text-xs"><span className="text-gray-500">Ingredients</span><span className="font-mono text-red-600">{fmtS(grand.ingredients)}</span></div>
            <div className="flex justify-between text-xs"><span className="text-gray-500">All Wages</span><span className="font-mono text-red-600">{fmtS(grand.wages + grand.shopWages)}</span></div>
            <div className="flex justify-between text-xs"><span className="text-gray-500">Shop COGS</span><span className="font-mono text-red-600">{fmtS(grand.shopCogs)}</span></div>
            <div className="flex justify-between text-xs"><span className="text-gray-500">Overhead</span><span className="font-mono text-orange-600">{fmtS(grand.overhead + grand.shopOH)}</span></div>
          </div>
        </div>
      </div>

      {/* Monthly accordions */}
      {months.map(([mk, monthWeeks]) => {
        const mt          = sumPortals(monthWeeks.flatMap(w => w.portals))
        const monthMargin = mt.revenue > 0 ? (mt.profit / mt.revenue) * 100 : 0
        const isOpen      = expandedMonths.has(mk)

        return (
          <div key={mk} className="bg-white rounded-xl border border-gray-200 overflow-hidden">

            {/* Month header */}
            <button
              onClick={() => toggleMonth(mk)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition"
            >
              <div className="flex items-center gap-3">
                {isOpen
                  ? <ChevronDown  className="h-5 w-5 text-gray-400" />
                  : <ChevronRight className="h-5 w-5 text-gray-400" />
                }
                <h2 className="text-base font-bold text-gray-900">{getMonthLabel(mk)}</h2>
                <span className="text-xs text-gray-400">({monthWeeks.length} wks)</span>
              </div>
              <div className="flex items-center gap-4 text-sm flex-wrap justify-end">
                <span className="text-gray-500 text-xs">Rev <strong className="text-blue-700">{fmtS(mt.revenue)}</strong></span>
                <span className="text-gray-500 text-xs">Costs <strong className="text-red-600">{fmtS(mt.costs)}</strong></span>
                <span className={`font-bold text-sm ${mt.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {fmtS(mt.profit)}
                  <span className="text-xs font-normal ml-1">({monthMargin.toFixed(0)}%)</span>
                </span>
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-gray-100">
                {monthWeeks.map((week, wi) => {
                  const combined    = sumPortals(week.portals)
                  const isExpanded  = expandedWeeks.has(week.week_start)
                  const profitColor = combined.profit >= 0 ? 'text-green-700' : 'text-red-700'
                  const isCurrentWeek = wi === 0 && mk === getMonthKey(weeks[0]?.week_start ?? '')

                  return (
                    <div key={week.week_start} className={`border-b border-gray-50 last:border-0 ${isCurrentWeek ? 'bg-blue-50/20' : ''}`}>

                      {/* Week summary row */}
                      <button
                        onClick={() => toggleWeek(week.week_start)}
                        className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition text-left"
                      >
                        <div className="flex items-center gap-2">
                          {isExpanded
                            ? <ChevronDown  className="h-4 w-4 text-gray-300" />
                            : <ChevronRight className="h-4 w-4 text-gray-300" />
                          }
                          <span className="text-sm font-medium text-gray-800 whitespace-nowrap">
                            {fmtWeek(week.week_start)}
                          </span>
                          {isCurrentWeek && (
                            <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Now</span>
                          )}
                        </div>

                        {/* Portal profit pills */}
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          {week.portals.map(p => {
                            const t = calcTotals(p.data)
                            if (t.revenue === 0) return null
                            return (
                              <span key={p.key} className="text-xs px-2 py-0.5 rounded-full font-medium"
                                style={{ backgroundColor: p.color + '18', color: p.color }}>
                                {p.label} {fmtS(t.profit)}
                              </span>
                            )
                          })}
                          <span className={`text-sm font-bold ml-2 ${profitColor}`}>
                            = {fmtS(combined.profit)}
                          </span>
                        </div>
                      </button>

                      {/* Expanded week detail */}
                      {isExpanded && (
                        <div className="px-5 pb-4 overflow-x-auto">
                          <table className="w-full text-xs min-w-[700px]">
                            <thead>
                              <tr className="border-b border-gray-100">
                                <th className="text-left py-2 pr-4 text-gray-400 font-medium w-28">Portal</th>
                                <th className="text-right py-2 px-2 text-gray-500">Wholesale</th>
                                <th className="text-right py-2 px-2 text-gray-500">Shop Sales</th>
                                <th className="text-right py-2 px-2 text-red-400">Ingredients</th>
                                <th className="text-right py-2 px-2 text-red-400">Wages</th>
                                <th className="text-right py-2 px-2 text-orange-400">Overhead</th>
                                <th className="text-right py-2 px-2 text-red-400">Shop COGS</th>
                                <th className="text-right py-2 px-2 text-red-400">Shop Wages</th>
                                <th className="text-right py-2 px-2 text-blue-500">Revenue</th>
                                <th className="text-right py-2 px-2 text-red-500">Costs</th>
                                <th className="text-right py-2 px-2 font-bold text-gray-700">Profit</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {week.portals.map(p => {
                                const t = calcTotals(p.data)
                                const margin = t.revenue > 0 ? (t.profit / t.revenue * 100).toFixed(0) : null
                                return (
                                  <tr key={p.key} className="hover:bg-gray-50">
                                    <td className="py-2 pr-4 font-semibold" style={{ color: p.color }}>{p.label}</td>
                                    <td className="py-2 px-2 text-right font-mono text-gray-600">{t.wholesale   > 0 ? fmt(t.wholesale)   : '—'}</td>
                                    <td className="py-2 px-2 text-right font-mono text-gray-600">{t.shops       > 0 ? fmt(t.shops)       : '—'}</td>
                                    <td className="py-2 px-2 text-right font-mono text-red-500">{t.ingredients > 0 ? fmt(t.ingredients) : '—'}</td>
                                    <td className="py-2 px-2 text-right font-mono text-red-500">{t.wages       > 0 ? fmt(t.wages)       : '—'}</td>
                                    <td className="py-2 px-2 text-right font-mono text-orange-500">{t.overhead  > 0 ? fmt(t.overhead)   : '—'}</td>
                                    <td className="py-2 px-2 text-right font-mono text-red-500">{t.shopCogs    > 0 ? fmt(t.shopCogs)    : '—'}</td>
                                    <td className="py-2 px-2 text-right font-mono text-red-500">{t.shopWages   > 0 ? fmt(t.shopWages)   : '—'}</td>
                                    <td className="py-2 px-2 text-right font-mono font-semibold text-blue-700">{t.revenue > 0 ? fmt(t.revenue) : '—'}</td>
                                    <td className="py-2 px-2 text-right font-mono font-semibold text-red-600">{t.costs   > 0 ? fmt(t.costs)   : '—'}</td>
                                    <td className={`py-2 px-2 text-right font-mono font-bold ${t.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                      {t.revenue > 0 ? (
                                        <span>{fmt(t.profit)}{margin && <span className="text-[10px] ml-1 opacity-60">{margin}%</span>}</span>
                                      ) : '—'}
                                    </td>
                                  </tr>
                                )
                              })}
                              {/* Combined row */}
                              <tr className="bg-gray-50 font-bold border-t border-gray-200">
                                <td className="py-2 pr-4 text-gray-700">Combined</td>
                                <td className="py-2 px-2 text-right font-mono text-gray-700">{combined.wholesale   > 0 ? fmt(combined.wholesale)   : '—'}</td>
                                <td className="py-2 px-2 text-right font-mono text-gray-700">{combined.shops       > 0 ? fmt(combined.shops)       : '—'}</td>
                                <td className="py-2 px-2 text-right font-mono text-red-600">{combined.ingredients > 0 ? fmt(combined.ingredients) : '—'}</td>
                                <td className="py-2 px-2 text-right font-mono text-red-600">{combined.wages       > 0 ? fmt(combined.wages)       : '—'}</td>
                                <td className="py-2 px-2 text-right font-mono text-orange-600">{combined.overhead  > 0 ? fmt(combined.overhead)   : '—'}</td>
                                <td className="py-2 px-2 text-right font-mono text-red-600">{combined.shopCogs    > 0 ? fmt(combined.shopCogs)    : '—'}</td>
                                <td className="py-2 px-2 text-right font-mono text-red-600">{combined.shopWages   > 0 ? fmt(combined.shopWages)   : '—'}</td>
                                <td className="py-2 px-2 text-right font-mono text-blue-800">{fmt(combined.revenue)}</td>
                                <td className="py-2 px-2 text-right font-mono text-red-700">{fmt(combined.costs)}</td>
                                <td className={`py-2 px-2 text-right font-mono ${combined.profit >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                                  {fmt(combined.profit)}
                                  {combined.revenue > 0 && (
                                    <span className="text-[10px] ml-1 opacity-60">
                                      {(combined.profit / combined.revenue * 100).toFixed(0)}%
                                    </span>
                                  )}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Month footer totals */}
                <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex flex-wrap gap-4 text-xs">
                  <span className="text-gray-500">Month total:</span>
                  <span>Wholesale <strong className="text-gray-800">{fmtS(mt.wholesale)}</strong></span>
                  <span>Shops <strong className="text-gray-800">{fmtS(mt.shops)}</strong></span>
                  <span>Ingredients <strong className="text-red-600">{fmtS(mt.ingredients)}</strong></span>
                  <span>Wages <strong className="text-red-600">{fmtS(mt.wages + mt.shopWages)}</strong></span>
                  <span>COGS <strong className="text-red-600">{fmtS(mt.shopCogs)}</strong></span>
                  <span>OH <strong className="text-orange-600">{fmtS(mt.overhead + mt.shopOH)}</strong></span>
                  <span className={`font-bold ml-auto ${mt.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    Profit {fmtS(mt.profit)} ({monthMargin.toFixed(0)}%)
                  </span>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}