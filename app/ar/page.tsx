import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function ARDashboard() {
  const supabase = await createClient()
  
  // Get summary stats
  const { data: customers } = await supabase
    .from('customers')
    .select('balance')
  
  const totalBalance = customers?.reduce((sum, c) => sum + parseFloat(c.balance || '0'), 0) || 0
  const customersWithBalance = customers?.filter(c => parseFloat(c.balance || '0') > 0).length || 0
  
  // Get overdue count
  const today = new Date().toISOString().split('T')[0]
  const { data: overdueInvoices } = await supabase
    .from('ar_transactions')
    .select('id')
    .eq('type', 'invoice')
    .is('paid_date', null)
    .lt('due_date', today)
  
  const overdueCount = overdueInvoices?.length || 0

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Accounts Receivable Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-600">Total Outstanding</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            ${totalBalance.toFixed(2)}
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-600">Customers w/ Balance</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {customersWithBalance}
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-600">Overdue Invoices</h3>
          <p className="text-3xl font-bold text-red-600 mt-2">
            {overdueCount}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <Link
              href="/ar/aging"
              className="block px-4 py-2 bg-blue-600 text-white text-center rounded hover:bg-blue-700"
            >
              View Aging Report
            </Link>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Actions</h3>
          <form action="/api/ar/reminders" method="POST">
            <button
              type="submit"
              className="w-full px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
            >
              Send Overdue Reminders
            </button>
          </form>
          <p className="text-sm text-gray-600 mt-2">
            Sends tiered reminders based on days overdue
          </p>
        </div>
      </div>
    </div>
  )
}