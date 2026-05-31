'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle, Search, Truck,
} from 'lucide-react'
import InventoryReceivedView from './inventory-received-view'

interface Usage {
  daily_avg: number
  weekly_avg: number
  days_remaining: number | null
  weeks_remaining: number | null
}

interface Ingredient {
  id: string
  name: string
  unit: string
  unit_cost: number
  current_stock: number | null
  reorder_point: number | null
  supplier_id: string | null
  suppliers: { id: string; name: string } | null
  usage: Usage | null
}

interface Receipt {
  id: string
  ingredient_id: string
  supplier_id: string | null
  supplier: string | null
  quantity_kg: number
  unit_cost: number
  total_cost: number
  invoice_ref: string | null
  received_date: string
  notes: string | null
  packs: number | null
  pack_size_kg: number | null
  cost_per_pack: number | null
  ingredients: { id: string; name: string; unit: string } | null
  suppliers: { id: string; name: string } | null
}

interface Supplier {
  id: string
  name: string
}

interface Props {
  ingredients: Ingredient[]
  initialReceipts: Receipt[]
  suppliers: Supplier[]
}

function formatDate(d: string) {
  if (!d) return '-'
  const date = new Date(d + 'T00:00:00')
  return [
    date.getDate().toString().padStart(2, '0'),
    (date.getMonth() + 1).toString().padStart(2, '0'),
    date.getFullYear(),
  ].join('/')
}

export default function InventoryDashboard({ ingredients, initialReceipts, suppliers }: Props) {
  const router = useRouter()
  const [receipts]          = useState(initialReceipts)
  const [tab, setTab]       = useState<'overview' | 'receive' | 'history'>('overview')
  const [search, setSearch] = useState('')

  // Stats
  const lowStock = ingredients.filter(i => {
    const days = i.usage?.days_remaining
    if (days !== null && days !== undefined && days <= 7) return true
    if ((i.reorder_point || 0) > 0 && (i.current_stock || 0) <= (i.reorder_point || 0)) return true
    return false
  })

  const withUsage = ingredients.filter(i => i.usage && i.usage.weekly_avg > 0)
  const totalStockValue = ingredients.reduce((sum, i) =>
    sum + ((i.current_stock || 0) * (i.unit_cost || 0)), 0
  )

  const filteredIngredients = ingredients.filter(i => {
    if (!search) return i.usage && i.usage.weekly_avg > 0
    return i.name.toLowerCase().includes(search.toLowerCase())
  }).sort((a, b) => {
    const aDays = a.usage?.days_remaining ?? 999
    const bDays = b.usage?.days_remaining ?? 999
    return aDays - bDays
  })

  return (
    <div>
      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 text-center">
          <p className="text-xs text-blue-500 mb-1">Tracked Ingredients</p>
          <p className="text-2xl font-bold text-blue-700">{withUsage.length}</p>
        </div>
        <div className="p-4 bg-green-50 rounded-lg border border-green-100 text-center">
          <p className="text-xs text-green-500 mb-1">Stock Value</p>
          <p className="text-2xl font-bold text-green-700">${totalStockValue.toFixed(0)}</p>
        </div>
        <div className={`p-4 rounded-lg border text-center ${
          lowStock.length > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100'
        }`}>
          <p className="text-xs text-gray-500 mb-1">Low Stock Alerts</p>
          <p className={`text-2xl font-bold ${lowStock.length > 0 ? 'text-red-700' : 'text-gray-400'}`}>
            {lowStock.length}
          </p>
        </div>
        <div className="p-4 bg-purple-50 rounded-lg border border-purple-100 text-center">
          <p className="text-xs text-purple-500 mb-1">Deliveries This Month</p>
          <p className="text-2xl font-bold text-purple-700">
            {receipts.filter(r => {
              const d = new Date(r.received_date)
              const now = new Date()
              return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
            }).length}
          </p>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStock.length > 0 && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <h3 className="font-semibold text-red-800">Low Stock — Order Soon</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStock.map(i => (
              <span key={i.id} className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                {i.name}: {i.current_stock ?? 0} {i.unit}
                {i.usage?.days_remaining != null && ` (~${i.usage.days_remaining}d left)`}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(['overview', 'receive', 'history'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              tab === t
                ? 'bg-green-700 text-white border-green-700'
                : 'bg-white text-gray-600 border-gray-300 hover:border-green-600'
            }`}
          >
            {t === 'overview' && '📊 Stock Overview'}
            {t === 'receive' && '📦 Receive Delivery'}
            {t === 'history' && '📋 Delivery History'}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab === 'overview' && (
        <>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search ingredients..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
            />
          </div>
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Ingredient</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">In Stock</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Weekly Use</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">$/Unit</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Supplier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredIngredients.map(i => {
                  const stock = i.current_stock ?? 0
                  const days  = i.usage?.days_remaining
                  const isLow = days !== null && days !== undefined && days <= 7
                  return (
                    <tr key={i.id} className={`hover:bg-gray-50 ${isLow ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-3 font-medium text-gray-900">{i.name}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">
                        {stock > 0 ? `${stock} ${i.unit}` : <span className="text-gray-300">0</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-600">
                        {i.usage?.weekly_avg ? `${i.usage.weekly_avg.toFixed(1)} ${i.unit}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {days !== null && days !== undefined ? (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            days <= 3  ? 'bg-red-600 text-white' :
                            days <= 7  ? 'bg-red-100 text-red-700' :
                            days <= 14 ? 'bg-orange-100 text-orange-700' :
                            days <= 21 ? 'bg-amber-100 text-amber-700' :
                                         'bg-green-100 text-green-700'
                          }`}>
                            {days <= 0 ? 'OUT' : `~${i.usage?.weeks_remaining}w`}
                          </span>
                        ) : stock > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">OK</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-600">
                        ${Number(i.unit_cost).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {(i.suppliers as any)?.name || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── RECEIVE TAB ── */}
   {tab === 'receive' && (
  <InventoryReceivedView
    ingredients={ingredients.map(i => ({
      ...i,
      supplier: (i.suppliers as any)?.name ?? null,
    }))}
    initialReceipts={receipts as any}
    suppliers={suppliers}
  />
)}

      {/* ── HISTORY TAB ── */}
      {tab === 'history' && (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Ingredient</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Supplier</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Packs</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Pack Size</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total (kg)</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">$/Pack</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total Cost</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Ref</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {receipts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                    No deliveries recorded yet
                  </td>
                </tr>
              ) : (
                receipts.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600">{formatDate(r.received_date)}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {(r.ingredients as any)?.name || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {(r.suppliers as any)?.name || r.supplier || '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{r.packs ?? '-'}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-600">
                      {r.pack_size_kg ? `${r.pack_size_kg}kg` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">
                      {r.quantity_kg.toFixed(2)} kg
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {r.cost_per_pack ? `$${Number(r.cost_per_pack).toFixed(2)}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-green-700">
                      ${Number(r.total_cost).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{r.invoice_ref || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}