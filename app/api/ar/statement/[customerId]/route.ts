import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await params
    const supabase = await createClient()

    // Get customer details
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single()

    if (customerError || !customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Get AR transactions
    const { data: transactions, error: transactionsError } = await supabase
      .from('ar_transactions')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: true })

    if (transactionsError) {
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
    }

    // Calculate running balance
    let runningBalance = 0
    const ledger = (transactions || []).map((tx: any) => {
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
        debit: isDebit ? amount : 0,
        credit: !isDebit ? amount : 0,
        balance: runningBalance,
      }
    })

    // Return JSON response (PDF generation can be added later)
    return NextResponse.json({
      customer: {
        business_name: customer.business_name,
        email: customer.email,
        address: customer.address,
        abn: customer.abn,
      },
      ledger,
      summary: {
        total_charges: ledger.reduce((sum: number, tx: any) => sum + tx.debit, 0),
        total_payments: ledger.reduce((sum: number, tx: any) => sum + tx.credit, 0),
        current_balance: runningBalance,
      },
    })
  } catch (error: any) {
    console.error('Statement generation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate statement' },
      { status: 500 }
    )
  }
}