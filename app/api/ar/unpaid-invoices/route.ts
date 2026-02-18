export const dynamic = 'force-dynamic'

// app/api/ar/unpaid-invoices/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'


export async function GET(request: NextRequest) {
  const supabase = await createClient()
  try {
    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customer_id')
    const showPaid = searchParams.get('show_paid') === 'true'

    if (!customerId) {
      return NextResponse.json(
        { error: 'customer_id required' },
        { status: 400 }
      )
    }

    let query = supabase
      .from('ar_transactions')
      .select('*')
      .eq('customer_id', customerId)
      .eq('type', 'invoice')
      .order('due_date', { ascending: true })

    if (!showPaid) {
      query = query.is('paid_date', null)
    }

    const { data: invoices, error } = await query

    if (error) throw error

    const formattedInvoices = (invoices || []).map((inv) => {
      const totalAmount = parseFloat(inv.amount)
      const amountPaid = parseFloat(inv.amount_paid || '0')
      const balanceRemaining = totalAmount - amountPaid

      return {
        id: inv.id,
        invoice_id: inv.invoice_id,
        amount: totalAmount.toFixed(2),
        amount_paid: amountPaid.toFixed(2),
        balance_remaining: balanceRemaining.toFixed(2),
        due_date: inv.due_date,
        description: inv.description,
        paid_date: inv.paid_date,
        is_paid: inv.paid_date !== null,
        percent_paid: totalAmount > 0 ? Math.round((amountPaid / totalAmount) * 100) : 0,
      }
    })

    return NextResponse.json({
      success: true,
      invoices: formattedInvoices,
    })
  } catch (error: any) {
    console.error('âŒ Unpaid invoices fetch error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
