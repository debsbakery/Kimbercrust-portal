import { ARService } from '@/lib/services/ar-service'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function AgingReportPage() {
  const service = new ARService()
  const report = await service.getAgingReport()

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value)
  }

  const totals = report.reduce((acc, customer) => {
    const aging = customer.ar_aging?.[0] || customer.ar_aging || {}
    return {
      current: acc.current + parseFloat(aging?.current || '0'),
      days1To30: acc.days1To30 + parseFloat(aging?.days_1_30 || '0'),
      days31To60: acc.days31To60 + parseFloat(aging?.days_31_60 || '0'),
      days61To90: acc.days61To90 + parseFloat(aging?.days_61_90 || '0'),
      daysOver90: acc.daysOver90 + parseFloat(aging?.days_over_90 || '0'),
      totalDue: acc.totalDue + parseFloat(aging?.total_due || '0')
    }
  }, { current: 0, days1To30: 0, days31To60: 0, days61To90: 0, daysOver90: 0, totalDue: 0 })

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">AR Aging Report</h1>
        <Link href="/ar" className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
          Back to Dashboard
        </Link>
      </div>

      {report.length > 0 ? (
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
              {report.map((customer: any) => {
                const aging = customer.ar_aging?.[0] || customer.ar_aging || {}
                const daysOver90 = parseFloat(aging?.days_over_90 || '0')
                const displayName = customer.business_name || customer.contact_name || customer.email
                
                return (
                  <tr key={customer.id} className={daysOver90 > 0 ? 'bg-red-50' : ''}>
                    <td className="px-4 py-3">
                      <Link href={`/ar/customers/${customer.id}`} className="hover:underline">
                        <div className="text-sm font-medium text-blue-600 hover:text-blue-800">
                          {displayName}
                        </div>
                      </Link>
                      <div className="text-sm text-gray-500">{customer.email}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">NET {customer.payment_terms}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatCurrency(parseFloat(aging?.current || '0'))}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatCurrency(parseFloat(aging?.days_1_30 || '0'))}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatCurrency(parseFloat(aging?.days_31_60 || '0'))}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatCurrency(parseFloat(aging?.days_61_90 || '0'))}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-red-600 text-right">
                      {formatCurrency(daysOver90)}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                      {formatCurrency(parseFloat(aging?.total_due || '0'))}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td colSpan={2} className="px-4 py-3 text-sm font-bold">TOTALS</td>
                <td className="px-4 py-3 text-sm font-bold text-right">{formatCurrency(totals.current)}</td>
                <td className="px-4 py-3 text-sm font-bold text-right">{formatCurrency(totals.days1To30)}</td>
                <td className="px-4 py-3 text-sm font-bold text-right">{formatCurrency(totals.days31To60)}</td>
                <td className="px-4 py-3 text-sm font-bold text-right">{formatCurrency(totals.days61To90)}</td>
                <td className="px-4 py-3 text-sm font-bold text-red-600 text-right">{formatCurrency(totals.daysOver90)}</td>
                <td className="px-4 py-3 text-sm font-bold text-right">{formatCurrency(totals.totalDue)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">No customers with outstanding balances</p>
        </div>
      )}
    </div>
  )
}