export const dynamic = 'force-dynamic'

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { formatCurrency } from "@/lib/utils"
import { checkAdmin } from "@/lib/auth"
import { ArrowLeft, DollarSign, FileText } from "lucide-react"
import Link from "next/link"

async function getCustomerLedger(customerId: string) {
  const supabase = await createClient()

  // Get customer details
  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single()

  if (!customer) return null

  // Get invoices
  const { data: invoices } = await supabase
    .from('orders')
    .select('*')
    .eq('customer_id', customerId)
    .order('delivery_date', { ascending: false })

  // Get payments
  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .eq('customer_id', customerId)
    .order('payment_date', { ascending: false })

  // Calculate actual balance from unpaid invoices
  const calculatedBalance = (invoices || []).reduce((sum, inv) => {
    return sum + (inv.total_amount - (inv.amount_paid || 0))
  }, 0)

  return { customer, invoices: invoices || [], payments: payments || [], calculatedBalance }
}

export default async function CustomerLedgerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const isAdmin = await checkAdmin()
  if (!isAdmin) redirect("/")

  const { id } = await params
  const ledgerData = await getCustomerLedger(id)

  if (!ledgerData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
          <p className="text-red-700 font-semibold text-lg">Customer not found</p>
          <Link
            href="/admin/ar"
            className="inline-block mt-4 text-red-600 hover:underline"
          >
            ← Back to AR Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const { customer, invoices, payments, calculatedBalance } = ledgerData

  // Combine invoices and payments into ledger entries
  const ledgerEntries = [
    ...invoices.map((inv: any) => ({
      date: inv.delivery_date,
      type: 'invoice',
      description: `Invoice - ${inv.delivery_date}`,
      invoiceId: inv.id,
      debit: inv.total_amount,
      credit: 0,
      balance: 0, // Will calculate below
    })),
    ...payments.map((pay: any) => ({
      date: pay.payment_date,
      type: 'payment',
      description: `Payment - ${pay.payment_method} ${pay.reference_number || ''}`,
      paymentId: pay.id,
      debit: 0,
      credit: pay.amount,
      balance: 0,
    })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // Calculate running balance
  let runningBalance = 0
  ledgerEntries.forEach((entry) => {
    runningBalance += entry.debit - entry.credit
    entry.balance = runningBalance
  })

  return (
    <div className="container mx-auto px-4 py-8">
      <Link
        href="/admin/ar"
        className="flex items-center gap-1 text-sm mb-4 hover:opacity-80"
        style={{ color: "#CE1126" }}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to AR Dashboard
      </Link>

      {/* Customer Header */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#006A4E" }}>
              {customer.business_name || customer.contact_name}
            </h1>
            <p className="text-gray-600">{customer.email}</p>
            {customer.address && <p className="text-sm text-gray-500">{customer.address}</p>}
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Account Balance</p>
            <p className="text-3xl font-bold" style={{ color: runningBalance > 0 ? "#CE1126" : "#006A4E" }}>
              {formatCurrency(Math.abs(runningBalance))}
            </p>
            {customer.balance !== calculatedBalance && (
              <p className="text-xs text-orange-600 mt-1">
                ⚠️ Stored: {formatCurrency(customer.balance)}
              </p>
            )}
          </div>
        </div>

        {/* Balance Cards */}
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="p-3 bg-red-50 rounded border border-red-200">
            <p className="text-xs text-red-600">Total Invoiced</p>
            <p className="text-lg font-bold text-red-800">
              {formatCurrency(invoices.reduce((sum, inv) => sum + inv.total_amount, 0))}
            </p>
          </div>
          <div className="p-3 bg-green-50 rounded border border-green-200">
            <p className="text-xs text-green-600">Total Paid</p>
            <p className="text-lg font-bold text-green-800">
              {formatCurrency(payments.reduce((sum, pay) => sum + pay.amount, 0))}
            </p>
          </div>
          <div className="p-3 bg-blue-50 rounded border border-blue-200">
            <p className="text-xs text-blue-600">Balance Due</p>
            <p className="text-lg font-bold text-blue-800">
              {formatCurrency(calculatedBalance)}
            </p>
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold">Transaction Ledger</h2>
          <p className="text-sm text-gray-600">All invoices and payments</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Charges</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Payments</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {ledgerEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No transactions found
                  </td>
                </tr>
              ) : (
                ledgerEntries.map((entry, index) => (
                  <tr key={index} className={entry.type === 'payment' ? 'bg-green-50' : ''}>
                    <td className="px-4 py-3 text-sm">
                      {new Date(entry.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {entry.type === 'invoice' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                          <FileText className="h-3 w-3" />
                          Invoice
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                          <DollarSign className="h-3 w-3" />
                          Payment
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {entry.description}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-red-600">
                      {entry.debit > 0 ? formatCurrency(entry.debit) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-green-600">
                      {entry.credit > 0 ? formatCurrency(entry.credit) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold">
                      {formatCurrency(entry.balance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2">
              <tr>
                <td colSpan={3} className="px-4 py-3 text-right font-bold">Totals:</td>
                <td className="px-4 py-3 text-right font-bold text-red-600">
                  {formatCurrency(invoices.reduce((sum, inv) => sum + inv.total_amount, 0))}
                </td>
                <td className="px-4 py-3 text-right font-bold text-green-600">
                  {formatCurrency(payments.reduce((sum, pay) => sum + pay.amount, 0))}
                </td>
                <td className="px-4 py-3 text-right font-bold text-lg">
                  {formatCurrency(runningBalance)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex gap-4">
        <Link
          href={`/admin/payments/record?customer=${customer.id}`}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
        >
          💰 Record Payment
        </Link>
      </div>
    </div>
  )
}