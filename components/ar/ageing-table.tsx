'use client'

import { useState } from 'react'
import { updateAgingAction } from '@/app/actions/ar-actions'

interface AgingData {
  id: string
  name: string
  email: string
  paymentTerms: number
  current: number
  days1To30: number
  days31To60: number
  days61To90: number
  daysOver90: number
  totalDue: number
  updatedAt: Date | null
}

export function AgingTable({ data }: { data: AgingData[] }) {
  const [loading, setLoading] = useState(false)

  const handleRefresh = async () => {
    setLoading(true)
    const result = await updateAgingAction()
    if (result.success) {
      window.location.reload() // Or use router.refresh()
    }
    setLoading(false)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value)
  }

  const getRowClass = (daysOver90: number) => {
    if (daysOver90 > 0) return 'bg-red-50'
    return ''
  }

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">AR Aging Report</h2>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Updating...' : 'Refresh Aging'}
        </button>
      </div>

      <div className="overflow-x-auto shadow-md rounded-lg">
        <table className="min-w-full bg-white">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Terms</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Current</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">1-30 Days</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">31-60 Days</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">61-90 Days</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Over 90</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Total Due</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.map((customer) => (
              <tr key={customer.id} className={getRowClass(customer.daysOver90)}>
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                  <div className="text-sm text-gray-500">{customer.email}</div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">NET {customer.paymentTerms}</td>
                <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatCurrency(customer.current)}</td>
                <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatCurrency(customer.days1To30)}</td>
                <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatCurrency(customer.days31To60)}</td>
                <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatCurrency(customer.days61To90)}</td>
                <td className="px-4 py-3 text-sm font-semibold text-red-600 text-right">
                  {formatCurrency(customer.daysOver90)}
                </td>
                <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                  {formatCurrency(customer.totalDue)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50">
            <tr>
              <td colSpan={2} className="px-4 py-3 text-sm font-bold">TOTALS</td>
              <td className="px-4 py-3 text-sm font-bold text-right">
                {formatCurrency(data.reduce((sum, c) => sum + c.current, 0))}
              </td>
              <td className="px-4 py-3 text-sm font-bold text-right">
                {formatCurrency(data.reduce((sum, c) => sum + c.days1To30, 0))}
              </td>
              <td className="px-4 py-3 text-sm font-bold text-right">
                {formatCurrency(data.reduce((sum, c) => sum + c.days31To60, 0))}
              </td>
              <td className="px-4 py-3 text-sm font-bold text-right">
                {formatCurrency(data.reduce((sum, c) => sum + c.days61To90, 0))}
              </td>
              <td className="px-4 py-3 text-sm font-bold text-red-600 text-right">
                {formatCurrency(data.reduce((sum, c) => sum + c.daysOver90, 0))}
              </td>
              <td className="px-4 py-3 text-sm font-bold text-right">
                {formatCurrency(data.reduce((sum, c) => sum + c.totalDue, 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}