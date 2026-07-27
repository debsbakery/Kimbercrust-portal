'use client'

import { useState } from 'react'

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

const fmt = (n: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n)

const fmtWeek = (ws: string) => {
  const start = new Date(ws + 'T00:00:00')
  const end   = new Date(start)
  end.setDate(end.getDate() + 6)
  return `${start.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`
}

function calcTotals(data: PortalWeekData | null) {
  if (!data) return { revenue: 0, costs: 0, profit: 0 }
  const revenue = data.order_revenue + data.shop_total_sales
  const costs   = data.ingredient_cost + data.overhead + data.bakery_wages +
                  data.shop_wages + data.shop_purchases + data.shop_overhead
  return { revenue, costs, profit: revenue - costs }
}

export default function CrossPortalView({ weeks, portals }: Props) {
  const [view, setView] = useState<'summary' | 'detail'>('summary')

  // Grand totals across all portals all weeks
  const grand = weeks.flatMap(w => w.portals).reduce((acc, p) => {
    const t = calcTotals(p.data)
    return {
      revenue: acc.revenue + t.revenue,
      costs:   acc.costs   + t.costs,
      profit:  acc.profit  + t.profit,
    }
  }, { revenue: 0, costs: 0, profit: 0 })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🌐 Cross-Portal Summary</h1>
          <p className="text-sm text-gray-500 mt-0.5">All portals combined — weekly P&L</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView('summary')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === 'summary' ? 'bg-gray-900 text-white' : 'border text-gray-600 hover:bg-gray-50'
            }`}
          >
            Summary
          </button>
          <button
            onClick={() => setView('detail')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === 'detail' ? 'bg-gray-900 text-white' : 'border text-gray-600 hover:bg-gray-50'
            }`}
          >
            Detail
          </button>
        </div>
      </div>

      {/* Grand total cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs text-blue-600 font-medium">Total Revenue (All Portals)</p>
          <p className="text-2xl font-bold text-blue-800 mt-1">{fmt(grand.revenue)}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs text-red-600 font-medium">Total Costs (All Portals)</p>
          <p className="text-2xl font-bold text-red-800 mt-1">{fmt(grand.costs)}</p>
        </div>
        <div className={`rounded-xl p-4 border ${grand.profit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <p className={`text-xs font-medium ${grand.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>Net Profit (All Portals)</p>
          <p className={`text-2xl font-bold mt-1 ${grand.profit >= 0 ? 'text-green-800' : 'text-red-800'}`}>{fmt(grand.profit)}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {grand.revenue > 0 ? ((grand.profit / grand.revenue) * 100).toFixed(1) : '0'}% margin
          </p>
        </div>
      </div>

      {/* Weekly table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 w-36">Week</th>
              {portals.map(p => (
                <th key={p.key} className="text-center px-2 py-3 font-semibold" style={{ color: p.color }} colSpan={view === 'detail' ? 3 : 3}>
                  {p.label}
                </th>
              ))}
              <th className="text-center px-2 py-3 font-semibold text-gray-700" colSpan={3}>Combined</th>
            </tr>
            <tr className="border-b border-gray-100">
              <th className="px-4 py-2"></th>
              {portals.map(p => (
                <>
                  <th key={`${p.key}-rev`}  className="text-right px-2 py-2 text-gray-500 font-medium">Revenue</th>
                  <th key={`${p.key}-cost`} className="text-right px-2 py-2 text-gray-500 font-medium">Costs</th>
                  <th key={`${p.key}-pft`}  className="text-right px-2 py-2 text-gray-500 font-medium">Profit</th>
                </>
              ))}
              <th className="text-right px-2 py-2 text-blue-600 font-medium">Revenue</th>
              <th className="text-right px-2 py-2 text-red-600 font-medium">Costs</th>
              <th className="text-right px-2 py-2 text-green-600 font-medium">Profit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {weeks.map((week, wi) => {
              const combined = week.portals.reduce((acc, p) => {
                const t = calcTotals(p.data)
                return { revenue: acc.revenue + t.revenue, costs: acc.costs + t.costs, profit: acc.profit + t.profit }
              }, { revenue: 0, costs: 0, profit: 0 })

              return (
                <tr key={week.week_start} className={`hover:bg-gray-50 ${wi === 0 ? 'bg-blue-50/30' : ''}`}>
                  <td className="px-4 py-2.5 font-medium text-gray-800 whitespace-nowrap">
                    {fmtWeek(week.week_start)}
                    {wi === 0 && <span className="ml-1 text-[10px] bg-green-100 text-green-700 px-1 py-0.5 rounded-full">Now</span>}
                  </td>
                  {week.portals.map(p => {
                    const t = calcTotals(p.data)
                    return (
                      <>
                        <td key={`${p.key}-rev`}  className="px-2 py-2.5 text-right font-mono text-gray-700">{t.revenue > 0 ? fmt(t.revenue) : '—'}</td>
                        <td key={`${p.key}-cost`} className="px-2 py-2.5 text-right font-mono text-red-500">{t.costs   > 0 ? fmt(t.costs)   : '—'}</td>
                        <td key={`${p.key}-pft`}  className={`px-2 py-2.5 text-right font-mono font-semibold ${t.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {t.revenue > 0 ? fmt(t.profit) : '—'}
                        </td>
                      </>
                    )
                  })}
                  <td className="px-2 py-2.5 text-right font-mono font-bold text-blue-700">{combined.revenue > 0 ? fmt(combined.revenue) : '—'}</td>
                  <td className="px-2 py-2.5 text-right font-mono font-bold text-red-600">{combined.costs   > 0 ? fmt(combined.costs)   : '—'}</td>
                  <td className={`px-2 py-2.5 text-right font-mono font-bold ${combined.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {combined.revenue > 0 ? fmt(combined.profit) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
          {/* Grand total footer */}
          <tfoot className="bg-gray-100 border-t-2 border-gray-300 font-bold text-xs">
            <tr>
              <td className="px-4 py-3 text-gray-800">All Time</td>
              {portals.map(p => {
                const t = weeks.flatMap(w => w.portals.filter(pp => pp.key === p.key)).reduce((acc, pp) => {
                  const tt = calcTotals(pp.data)
                  return { revenue: acc.revenue + tt.revenue, costs: acc.costs + tt.costs, profit: acc.profit + tt.profit }
                }, { revenue: 0, costs: 0, profit: 0 })
                return (
                  <>
                    <td key={`${p.key}-rev`}  className="px-2 py-3 text-right font-mono text-gray-800">{fmt(t.revenue)}</td>
                    <td key={`${p.key}-cost`} className="px-2 py-3 text-right font-mono text-red-700">{fmt(t.costs)}</td>
                    <td key={`${p.key}-pft`}  className={`px-2 py-3 text-right font-mono ${t.profit >= 0 ? 'text-green-800' : 'text-red-800'}`}>{fmt(t.profit)}</td>
                  </>
                )
              })}
              <td className="px-2 py-3 text-right font-mono text-blue-800">{fmt(grand.revenue)}</td>
              <td className="px-2 py-3 text-right font-mono text-red-800">{fmt(grand.costs)}</td>
              <td className={`px-2 py-3 text-right font-mono ${grand.profit >= 0 ? 'text-green-800' : 'text-red-800'}`}>{fmt(grand.profit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}