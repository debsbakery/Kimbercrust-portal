// app/api/ar/customer-ledger/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customer_id')
    const format = searchParams.get('format') || 'json' // json or pdf

    if (!customerId) {
      return NextResponse.json({ error: 'customer_id required' }, { status: 400 })
    }

    // Get customer details
    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single()

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Get all transactions
    const { data: transactions } = await supabase
      .from('ar_transactions')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: true })

    // Calculate running balance
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
      }
    })

    if (format === 'pdf') {
      // TODO: Generate PDF (use existing invoice PDF logic as template)
      return NextResponse.json({ error: 'PDF generation not yet implemented' }, { status: 501 })
    }

    return NextResponse.json({
      success: true,
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
    })
  } catch (error: any) {
    console.error('❌ Ledger error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}