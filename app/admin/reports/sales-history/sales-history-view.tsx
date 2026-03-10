'use client'

import { useState } from 'react'
import { Search, Download } from 'lucide-react'

interface Product {
  id: string
  name: string
  code: string | null
}

interface Customer {
  id: string
  business_name: string
  contact_name: string | null
}

interface SalesItem {
  id: string
  product_id: string
  product_name: string
  product_code: string | null
  quantity: number
  unit_price: number
  subtotal: number
  gst_applicable: boolean
  gst_amount: number
  order_id: string
  delivery_date: string
  customer_id: string
  customer_name: string
}

interface Props {
  products: Product[]
  customers: Customer[]
}

export default function SalesHistoryView({ products, customers }: Props) {
  const [productId, setProductId]   = useState('')
  const [customerId, setCustomerId] = useState('')
  const [from, setFrom]             = useState('')
  const [to, setTo]                 = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [items, setItems]           = useState<SalesItem[]>([])
  const [summary, setSummary]       = useState<any>(null)

  async function handleSearch() {
    if (!productId && !customerId) {
      setError('Select at least one filter (product or customer)')
      return
    }

    setError('')
    setLoading(true)

    try {
      const params = new URLSearchParams()
      if (productId)  params.set('product_id', productId)
      if (customerId) params.set('customer_id', customerId)
      if (from)       params.set('from', from)
      if (to)         params.set('to', to)

      const res = await fetch('/api/admin/sales-history?' + params.toString())
      const json = await res.json()

      if (!res.ok) throw new Error(json.error)

      setItems(json.items ?? [])
      setSummary(json.summary ?? null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleClear() {
    setProductId('')
    setCustomerId('')
    setFrom('')
    setTo('')
    setItems([])
    setSummary(null)
    setError('')
  }

  function exportCSV() {
    if (items.length === 0) return

    const headers = ['Date', 'Customer', 'Product', 'Code', 'Qty', 'Unit Price', 'Subtotal', 'GST', 'Total']
    const rows = items.map((i) => [
      i.delivery_date,
      i.customer_name,
      i.product_code ?? '',
      i.quantity,
      i.unit_price.toFixed(2),
      i.subtotal.toFixed(2),
      i.gst_amount.toFixed(2),
      (i.subtotal + i.gst_amount).toFixed(2),
    ])

    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sales-history-' + Date.now() + '.csv'
    a.click()
  }

  return (
    <div className="space-y-6">

      {/* Search Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h2 className="font-bold text-gray-800">Search Filters</h2>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Product</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">All products</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code ? `[${p.code}] ` : ''}{p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Customer</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">All customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.business_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">From Date</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">To Date</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-6 py-2.5 rounded-lg text-white font-semibold text-sm hover:opacity-90 disabled:opacity-50 flex items-center gap-2"style={{ backgroundColor: '#ffffff' }}
          >
            <Search className="h-4 w-4" />
            {loading ? 'Searching...' : 'Search'}
          </button>
          <button
            onClick={handleClear}
            className="px-6 py-2.5 rounded-lg border border-gray-300 hover:bg-gray-50 font-semibold text-sm"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Units</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{summary.total_quantity.toLocaleString()}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Revenue</p>
            <p className="text-3xl font-bold text-green-700 mt-1">${summary.total_revenue.toFixed(2)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">GST Collected</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">${summary.total_gst.toFixed(2)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Net Revenue</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">${summary.net_revenue.toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* Results Table - GROUPED */}
      {items.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-gray-800">Sales Summary</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Grouped by {productId && customerId ? 'product' : productId ? 'customer' : 'product'}
              </p>
            </div>
            <button
              onClick={exportCSV}
              className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 flex items-center gap-1.5 text-sm font-semibold"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>

          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {!productId && (
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Product</th>
                )}
                {!customerId && (
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Customer</th>
                )}
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Total Qty</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Avg Price</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Subtotal</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase">GST</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(() => {
                const grouped: Record<string, {
                  key: string
                  label: string
                  code: string
                  qty: number
                  subtotal: number
                  gst: number
                  count: number
                }> = {}

                for (const item of items) {
                  const key = productId
                    ? item.customer_id + '|' + item.customer_name
                    : item.product_id + '|' + item.product_name + '|' + (item.product_code ?? '')

                  if (!grouped[key]) {
                    grouped[key] = {
                      key,
                      label: productId ? item.customer_name : item.product_name,
                      code: productId ? '' : (item.product_code ?? ''),
                      qty: 0,
                      subtotal: 0,
                      gst: 0,
                      count: 0,
                    }
                  }

                  grouped[key].qty      += item.quantity
                  grouped[key].subtotal += item.subtotal
                  grouped[key].gst      += item.gst_amount
                  grouped[key].count    += 1
                }

                const rows = Object.values(grouped).sort((a, b) => b.subtotal - a.subtotal)

                return rows.map((row) => {
                  const total = row.subtotal + row.gst
                  const avgPrice = row.subtotal / row.qty

                  return (
                    <tr key={row.key} className="hover:bg-gray-50">
                      {!productId && (
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {row.label}{row.code && (
                            <span className="ml-2 text-xs text-gray-400 font-mono">#{row.code}</span>
                          )}
                        </td>
                      )}
                      {!customerId && (
                        <td className="px-4 py-3 font-medium text-gray-900">{row.label}</td>
                      )}
                      <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">
                        {row.qty.toFixed(0)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">${avgPrice.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        ${row.subtotal.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">${row.gst.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">${total.toFixed(2)}</td>
                    </tr>
                  )
                })
              })()}
            </tbody>
            <tfoot className="border-t-2 border-gray-300 bg-gray-50">
              <tr>
                <td
                  colSpan={productId && customerId ? 1 : productId || customerId ? 2 : 1}
                  className="px-4 py-3 font-bold text-gray-800"
                >
                  Total
                </td>
                <td className="px-4 py-3 text-right font-bold font-mono text-gray-900">
                  {summary.total_quantity}
                </td>
                <td></td>
                <td className="px-4 py-3 text-right font-bold text-gray-900">
                  ${(summary.total_revenue - summary.total_gst).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right font-bold text-gray-900">
                  ${summary.total_gst.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right font-bold text-gray-900">
                  ${summary.total_revenue.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {items.length === 0 && summary === null && (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <p className="text-gray-400">Select filters and click Search to view sales history</p>
        </div>
      )}</div>
  )
}
