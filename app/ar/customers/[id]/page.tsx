import { createClient } from '@/lib/supabase/server'
import { PaymentForm } from '@/components/ar/payment-form'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function CustomerARPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  // Await params (Next.js 15+ requirement)
  const { id } = await params
  
  const supabase = await createClient()
  
  // Get customer details
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single()

  // Handle not found
  if (customerError || !customer) {
    console.error('Customer not found:', id, customerError)
    notFound()
  }

  // Get transaction history
  const { data: transactions } = await supabase
    .from('ar_transactions')
    .select('*')
    .eq('customer_id', id)
    .order('created_at', { ascending: false })
    .limit(20)

  const displayName = customer.business_name || customer.contact_name || customer.email || 'Unknown Customer'

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold">{displayName}</h1>
          <p className="text-gray-600">{customer.email}</p>
          {customer.phone && <p className="text-gray-600">{customer.phone}</p>}
          {customer.abn && <p className="text-sm text-gray-500">ABN: {customer.abn}</p>}
        </div>
        <Link href="/ar" className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
          Back to Dashboard
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-600">Current Balance</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            ${parseFloat(customer.balance || '0').toFixed(2)}
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-600">Payment Terms</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            NET {customer.payment_terms || 30}
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-600">Last Statement</h3>
          <p className="text-lg text-gray-900 mt-2">
            {customer.last_statement_date 
              ? new Date(customer.last_statement_date).toLocaleDateString()
              : 'Never'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Transaction History */}
        <div className="lg:col-span-2">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Recent Transactions</h3>
            
            {transactions && transactions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Date</th>
                      <th className="text-left py-2">Type</th>
                      <th className="text-left py-2">Description</th>
                      <th className="text-right py-2">Amount</th>
                      <th className="text-right py-2">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((txn: any) => (
                      <tr key={txn.id} className="border-b">
                        <td className="py-2 text-sm">
                          {new Date(txn.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-2">
                          <span className={`px-2 py-1 text-xs rounded ${
                            txn.type === 'invoice' ? 'bg-red-100 text-red-800' :
                            txn.type === 'payment' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {txn.type}
                          </span>
                        </td>
                        <td className="py-2 text-sm">{txn.description || '-'}</td>
                        <td className="py-2 text-sm text-right">
                          ${parseFloat(txn.amount || '0').toFixed(2)}
                        </td>
                        <td className="py-2 text-sm font-semibold text-right">
                          ${parseFloat(txn.balance_after || '0').toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500">No transactions yet</p>
            )}
          </div>
        </div>

        {/* Payment Form - Right Sidebar */}
        <div>
          <PaymentForm
            customerId={customer.id}
            customerName={displayName}
            currentBalance={parseFloat(customer.balance || '0')}
          />
        </div>
      </div>
    </div>
  )
}