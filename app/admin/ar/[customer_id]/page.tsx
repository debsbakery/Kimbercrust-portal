export const dynamic = 'force-dynamic'

import { redirect } from "next/navigation"
import { formatCurrency } from "@/lib/utils"
import { checkAdmin } from "@/lib/auth"
import { ArrowLeft, Download } from "lucide-react"
import Link from "next/link"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

async function getLedger(customerId: string) {
  console.log('🔍 Starting getLedger for:', customerId)
  console.log('🔑 SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
  console.log('🔑 SERVICE_ROLE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)
  console.log('🔑 SERVICE_ROLE_KEY length:', process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0)

  // ✅ Use service role to bypass RLS
  const { createClient } = await import('@supabase/supabase-js')
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )

  console.log('✅ Supabase service client created')

  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id, email, business_name, address, abn, balance')
    .eq('id', customerId)
    .maybeSingle()

  console.log('📊 Query result - customer:', !!customer)
  console.log('📊 Query result - error:', customerError)

  if (customerError) {
    console.error('❌ Database error:', JSON.stringify(customerError, null, 2))
  }

  if (!customer) {
    console.error('❌ No customer found with ID:', customerId)
    
    // ✅ Try fetching ALL customers to see if ANY work
    const { data: allCustomers, error: allError } = await supabase
      .from('customers')
      .select('id, business_name')
      .limit(5)
    
    console.log('🔍 Sample of all customers:', allCustomers?.map(c => c.business_name))
    console.log('🔍 All customers error:', allError)
    
    return null
  }

  console.log('✅ Found customer:', customer.business_name || customer.email)

  const { data: transactions } = await supabase
    .from('ar_transactions')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: true })

  console.log(`📊 Transactions found: ${transactions?.length || 0}`)

  let runningBalance = 0
  const ledger = (transactions || []).map((tx) => {
    const amount = parseFloat(tx.amount)
    const isDebit = ['invoice', 'charge', 'late_fee'].includes(tx.type)
    
    if (isDebit) {
      runningBalance += amount
    } else {
      runningBalance -= amount
    }

    return {
      date: tx.created_at,
      description: tx.description,
      type: tx.type,
      invoice_id: tx.invoice_id,
      debit: isDebit ? amount : 0,
      credit: !isDebit ? amount : 0,
      balance: runningBalance,
      paid_date: tx.paid_date,
      due_date: tx.due_date,
      amount_paid: parseFloat(tx.amount_paid || '0'),
    }
  })

  return {
    customer: {
      id: customer.id,
      business_name: customer.business_name,
      email: customer.email,
      address: customer.address,
      abn: customer.abn,
      current_balance: customer.balance,
    },
    ledger,
    summary: {
      total_charges: ledger.reduce((sum, tx) => sum + tx.debit, 0),
      total_payments: ledger.reduce((sum, tx) => sum + tx.credit, 0),
      current_balance: runningBalance,
    },
  }
}

function formatDateSafe(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    const day = d.getDate().toString().padStart(2, "0")
    const month = (d.getMonth() + 1).toString().padStart(2, "0")
    const year = d.getFullYear()
    const hours = d.getHours().toString().padStart(2, "0")
    const mins = d.getMinutes().toString().padStart(2, "0")
    return `${day}/${month}/${year} ${hours}:${mins}`
  } catch {
    return dateStr
  }
}

export default async function CustomerLedgerPage({
  params,
}: {
  params: Promise<{ customer_id: string }>
}) {
  const isAdmin = await checkAdmin()
  if (!isAdmin) redirect("/")

  const resolvedParams = await params
  const customer_id = resolvedParams.customer_id

  console.log('🔑 URL Customer ID:', customer_id)

  const data = await getLedger(customer_id)

  if (!data) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Link
          href="/admin/ar"
          className="flex items-center gap-1 text-sm mb-4 hover:opacity-80"
          style={{ color: "#CE1126" }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to AR Summary
        </Link>
        
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-red-800 mb-2">Customer Not Found</h2>
          <p className="text-red-700">
            Could not find a customer with ID: <code className="bg-red-100 px-2 py-1 rounded">{customer_id}</code>
          </p>
          <Link
            href="/admin/ar"
            className="inline-block mt-4 px-4 py-2 rounded text-white hover:opacity-80"
            style={{ backgroundColor: "#006A4E" }}
          >
            Return to AR Summary
          </Link>
        </div>
      </div>
    )
  }

  const { customer, ledger, summary } = data

  return (
    <div className="container mx-auto px-4 py-8">
      <Link
        href="/admin/ar"
        className="flex items-center gap-1 text-sm mb-4 hover:opacity-80"
        style={{ color: "#CE1126" }}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to AR Summary
      </Link>

      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Customer Ledger</h1>
            <p className="text-xl mt-2 font-medium">
              {customer.business_name || customer.email}
            </p>
            {customer.address && (
              <p className="text-sm text-gray-600">{customer.address}</p>
            )}
            {customer.abn && (
              <p className="text-sm text-gray-600">ABN: {customer.abn}</p>
            )}
          </div>

          <div className="text-right">
            <p className="text-sm text-gray-600">Current Balance</p>
            <p
              className="text-3xl font-bold"
              style={{
                color: parseFloat(customer.current_balance) > 0 ? "#CE1126" : "#006A4E",
              }}
            >
              {formatCurrency(parseFloat(customer.current_balance))}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4" style={{ borderColor: "#CE1126" }}>
          <p className="text-sm text-gray-600">Total Charges</p>
          <p className="text-2xl font-bold" style={{ color: "#CE1126" }}>
            {formatCurrency(summary.total_charges)}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-l-4" style={{ borderColor: "#006A4E" }}>
          <p className="text-sm text-gray-600">Total Payments</p>
          <p className="text-2xl font-bold" style={{ color: "#006A4E" }}>
            {formatCurrency(summary.total_payments)}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-l-4" style={{ borderColor: "#FFD700" }}>
          <p className="text-sm text-gray-600">Net Balance</p>
          <p className="text-2xl font-bold">
            {formatCurrency(summary.current_balance)}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold">Transaction History</h2>
          <a
            href={`/api/ar/customer-ledger?customer_id=${customer_id}&format=pdf`}
            className="flex items-center gap-2 px-4 py-2 rounded-md border hover:bg-gray-50"
            style={{ borderColor: "#006A4E", color: "#006A4E" }}
          >
            <Download className="h-4 w-4" />
            Export PDF
          </a>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead className="text-right">Charges</TableHead>
                <TableHead className="text-right">Payments</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Payment Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    No transactions found
                  </TableCell>
                </TableRow>
              ) : (
                ledger.map((tx: any, idx: number) => {
                  const isPaid = tx.paid_date !== null
                  const isOverdue = tx.type === 'invoice' && !isPaid && 
                    tx.due_date && new Date(tx.due_date) < new Date()

                  return (
                    <TableRow
                      key={idx}
                      className={isOverdue ? "bg-red-50" : isPaid && tx.type === 'invoice' ? "bg-green-50" : ""}
                    >
                      <TableCell className="text-sm">
                        {formatDateSafe(tx.date)}
                      </TableCell>

                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                            tx.debit > 0
                              ? "bg-red-100 text-red-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {tx.type}
                        </span>
                      </TableCell>

                      <TableCell className="text-sm max-w-[300px]">
                        {tx.description || "—"}
                      </TableCell>

                      <TableCell className="text-sm font-mono">
                        {tx.invoice_id ? (
                          <a
                            href={`/api/invoice/${tx.invoice_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                            style={{ color: "#006A4E" }}
                          >
                            {tx.invoice_id.slice(0, 8).toUpperCase()}
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>

                      <TableCell className="text-right font-medium text-red-600">
                        {tx.debit > 0 ? formatCurrency(tx.debit) : "—"}
                      </TableCell>

                      <TableCell className="text-right font-medium text-green-600">
                        {tx.credit > 0 ? formatCurrency(tx.credit) : "—"}
                      </TableCell>

                      <TableCell className="text-right font-bold">
                        {formatCurrency(tx.balance)}
                      </TableCell>

                      <TableCell className="text-sm">
                        {tx.type === 'invoice' ? (
                          (() => {
                            const amountPaid = tx.amount_paid
                            const totalAmount = tx.debit
                            const percentPaid = totalAmount > 0 ? (amountPaid / totalAmount) * 100 : 0
                            const remaining = totalAmount - amountPaid

                            if (isPaid || percentPaid >= 100) {
                              return (
                                <span className="text-green-600 font-medium">
                                  ✅ Paid {tx.paid_date ? new Date(tx.paid_date).toLocaleDateString("en-AU") : ''}
                                </span>
                              )
                            } else if (amountPaid > 0) {
                              return (
                                <div className="text-sm">
                                  <span className="text-blue-600 font-medium">
                                    💵 {percentPaid.toFixed(0)}% Paid
                                  </span>
                                  <p className="text-xs text-gray-500">
                                    ${amountPaid.toFixed(2)} of ${totalAmount.toFixed(2)}
                                  </p>
                                  <p className="text-xs text-orange-600">
                                    ${remaining.toFixed(2)} owing
                                  </p>
                                </div>
                              )
                            } else if (isOverdue) {
                              return <span className="text-red-600 font-medium">⚠️ OVERDUE</span>
                            } else {
                              return <span className="text-yellow-600">⏳ Unpaid</span>
                            }
                          })()
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg text-sm text-blue-800">
        <p className="font-semibold mb-2">Reading the Ledger:</p>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>Charges</strong> (red) increase the balance — invoices, fees, etc.</li>
          <li><strong>Payments</strong> (green) decrease the balance — cash, EFT, credits, etc.</li>
          <li><strong>Balance</strong> shows running total after each transaction</li>
          <li><strong>Part payments</strong> show percentage paid and amount remaining</li>
          <li>Transactions are sorted chronologically (oldest first)</li>
        </ul>
      </div>
    </div>
  )
}