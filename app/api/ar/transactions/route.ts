export const dynamic = 'force-dynamic'

// app/api/ar/transactions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'


// GET: Fetch transactions (optionally by customer)
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  try {
    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customer_id')
    const limit = parseInt(searchParams.get('limit') || '100')

    let query = supabase
      .from('ar_transactions')
      .select('*, customers(business_name, email)')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (customerId) {
      query = query.eq('customer_id', customerId)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ success: true, transactions: data })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

// POST: Create a new transaction
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  try {
    const body = await request.json()
    const { customer_id, type, amount, description, due_date, invoice_id } = body

    if (!customer_id || !type || amount === undefined) {
      return NextResponse.json(
        { error: 'customer_id, type, and amount are required' },
        { status: 400 }
      )
    }

    // Get current balance
    const { data: customer } = await supabase
      .from('customers')
      .select('balance')
      .eq('id', customer_id)
      .single()

    const currentBalance = parseFloat(customer?.balance || '0')
    const txAmount = parseFloat(amount)

    // Calculate new balance
    // invoice/charge = increases balance, payment/credit = decreases balance
    let balanceChange = 0
    if (type === 'invoice' || type === 'charge' || type === 'late_fee') {
      balanceChange = txAmount
    } else if (type === 'payment' || type === 'credit' || type === 'adjustment') {
      balanceChange = -txAmount
    }

    const newBalance = currentBalance + balanceChange

    // Insert transaction
    const { data: transaction, error: txError } = await supabase
      .from('ar_transactions')
      .insert({
        customer_id,
        type,
        amount: txAmount.toFixed(2),
        balance_after: newBalance.toFixed(2),
        description: description || `${type} - ${new Date().toLocaleDateString('en-AU')}`,
        due_date: due_date || null,
        invoice_id: invoice_id || null,
        paid_date: type === 'payment' ? new Date().toISOString().split('T')[0] : null,
      })
      .select()
      .single()

    if (txError) throw txError

    // Update customer balance
    await supabase
      .from('customers')
      .update({ balance: newBalance.toFixed(2) })
      .eq('id', customer_id)

    console.log(
      `💰 AR Transaction: ${type} $${txAmount.toFixed(2)} for ${customer_id} ` +
      `(balance: $${currentBalance.toFixed(2)} → $${newBalance.toFixed(2)})`
    )

    return NextResponse.json({ success: true, transaction, newBalance })
  } catch (error: any) {
    console.error('❌ AR transaction error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

