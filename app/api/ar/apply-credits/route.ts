export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()  // ✅ Move inside function
    const { customer_id } = await request.json()

    if (!customer_id) {
      return NextResponse.json({ error: 'customer_id required' }, { status: 400 })
    }

    console.log(`🔄 Applying unapplied credits for customer: ${customer_id}`)

    // Get all unapplied payments (no invoice_id)
    const { data: unappliedPayments } = await supabase
      .from('ar_transactions')
      .select('*')
      .eq('customer_id', customer_id)
      .in('type', ['payment', 'credit'])
      .is('invoice_id', null)
      .order('created_at', { ascending: true })

    if (!unappliedPayments || unappliedPayments.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No unapplied credits found',
        applied: 0,
      })
    }

    // Get all unpaid invoices (oldest first)
    const { data: unpaidInvoices } = await supabase
      .from('ar_transactions')
      .select('*')
      .eq('customer_id', customer_id)
      .eq('type', 'invoice')
      .is('paid_date', null)
      .order('due_date', { ascending: true })

    if (!unpaidInvoices || unpaidInvoices.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No unpaid invoices to apply credits to',
        applied: 0,
      })
    }

    let totalApplied = 0
    let remainingCredit = unappliedPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0)

    console.log(`  💰 Total unapplied credits: $${remainingCredit.toFixed(2)}`)
    console.log(`  📄 Unpaid invoices: ${unpaidInvoices.length}`)

    // Apply credits to invoices (oldest first)
    for (const invoice of unpaidInvoices) {
      if (remainingCredit <= 0) break

      const invoiceAmount = parseFloat(invoice.amount)
      const amountToApply = Math.min(remainingCredit, invoiceAmount)

      console.log(`     Applying $${amountToApply.toFixed(2)} to invoice ${invoice.invoice_id?.slice(0, 8)}`)

      // Link the first unapplied payment to this invoice
      const paymentToLink = unappliedPayments[0]
      
      await supabase
        .from('ar_transactions')
        .update({ invoice_id: invoice.invoice_id })
        .eq('id', paymentToLink.id)

      // If fully paid, mark invoice as paid
      if (amountToApply >= invoiceAmount) {
        await supabase
          .from('ar_transactions')
          .update({ paid_date: new Date().toISOString().split('T')[0] })
          .eq('id', invoice.id)

        console.log(`     ✅ Invoice fully paid`)
      } else {
        console.log(`     📝 Partial payment applied`)
      }

      remainingCredit -= amountToApply
      totalApplied += amountToApply

      // Remove this payment from the queue if fully used
      if (amountToApply >= parseFloat(paymentToLink.amount)) {
        unappliedPayments.shift()
      }
    }

    console.log(`  ✅ Applied $${totalApplied.toFixed(2)} to ${unpaidInvoices.length} invoices`)

    // Update aging
    await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/ar/aging/update`, {
      method: 'POST',
    })

    return NextResponse.json({
      success: true,
      applied: totalApplied,
      remainingCredit,
    })
  } catch (error: any) {
    console.error('❌ Apply credits error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
