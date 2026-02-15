import { prisma } from '@/lib/prisma'
import { ReminderControls } from '@/components/ar/reminder-controls'
import Link from 'next/link'

export default async function ArDashboard() {
  // Get summary stats
  const totalBalance = await prisma.customer.aggregate({
    _sum: { balance: true },
    where: { balance: { gt: 0 } }
  })

  const customersWithBalance = await prisma.customer.count({
    where: { balance: { gt: 0 } }
  })

  const overdueInvoices = await prisma.arTransaction.count({
    where: {
      type: 'invoice',
      paidDate: null,
      dueDate: { lt: new Date() }
    }
  })

  const recentEmails = await prisma.arEmail.findMany({
    take: 10,
    orderBy: { sentAt: 'desc' },
    include: {
      customer: {
        select: { name: true }
      }
    }
  })

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Accounts Receivable Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-600">Total Outstanding</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            ${Number(totalBalance._sum.balance || 0).toFixed(2)}
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
            {overdueInvoices}
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
            <Link
              href="/ar/customers"
              className="block px-4 py-2 bg-gray-600 text-white text-center rounded hover:bg-gray-700"
            >
              Customer List
            </Link>
          </div>
        </div>

        <ReminderControls />
      </div>

      {/* Recent Email Activity */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Recent Email Activity</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Customer</th>
                <th className="text-left py-2">Type</th>
                <th className="text-left py-2">Status</th>
                <th className="text-left py-2">Sent At</th>
              </tr>
            </thead>
            <tbody>
              {recentEmails.map((email) => (
                <tr key={email.id} className="border-b">
                  <td className="py-2">{email.customer.name}</td>
                  <td className="py-2">
                    <span className="px-2 py-1 text-xs rounded bg-gray-100">
                      {email.type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-2">
                    <span className={`px-2 py-1 text-xs rounded ${
                      email.status === 'sent' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {email.status}
                    </span>
                  </td>
                  <td className="py-2 text-sm text-gray-600">
                    {new Date(email.sentAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}