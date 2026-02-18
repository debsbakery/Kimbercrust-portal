export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { customerId, amount, description, applyToInvoices } = body

    if (!customerId || !amount) {
      return NextResponse.json(
        { success: false, error: 'Missing customerId or amount' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const paymentAmount = parseFloat(amount)

    // Get current customer balance
    const { data: customer } = await supabase
      .from('customers')
      .select('balance, business_name, contact_name')
      .eq('id', customerId)
      .single()

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      )
    }

    const currentBalance = parseFloat(customer.balance || '0')
    const newBalance = currentBalance - paymentAmount

    // Create payment transaction
    const { error: txnError } = await supabase
      .from('ar_transactions')
      .insert({
        customer_id: customerId,
        type: 'payment',
        amount: paymentAmount,
        balance_after: newBalance,
        paid_date: new Date().toISOString().split('T')[0],
        description: description || 'Payment received'
      })

    if (txnError) throw txnError

    // Update customer balance
    const { error: updateError } = await supabase
      .from('customers')
      .update({ balance: newBalance })
      .eq('id', customerId)

    if (updateError) throw updateError

    // --- Apply payment to invoices ---
    let paidInvoiceIds: string[] = []

    if (applyToInvoices && Array.isArray(applyToInvoices) && applyToInvoices.length > 0) {
      // MANUAL MODE: Mark selected invoices as paid
      const { error: markError } = await supabase
        .from('ar_transactions')
        .update({ paid_date: new Date().toISOString().split('T')[0] })
        .in('id', applyToInvoices)
        .eq('customer_id', customerId)
        .eq('type', 'invoice')

      if (markError) {
        console.error('Error marking invoices paid:', markError)
      }

      paidInvoiceIds = applyToInvoices
    } else {
      // AUTO MODE (FIFO): Apply to oldest unpaid invoices first
      const { data: unpaidInvoices } = await supabase
        .from('ar_transactions')
        .select('id, amount')
        .eq('customer_id', customerId)
        .eq('type', 'invoice')
        .is('paid_date', null)
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true })

      let remainingPayment = paymentAmount

      for (const invoice of unpaidInvoices || []) {
        if (remainingPayment <= 0) break

        const invoiceAmount = parseFloat(invoice.amount)

        if (remainingPayment >= invoiceAmount) {
          // Fully pay this invoice
          const { error: markError } = await supabase
            .from('ar_transactions')
            .update({ paid_date: new Date().toISOString().split('T')[0] })
            .eq('id', invoice.id)

          if (!markError) {
            paidInvoiceIds.push(invoice.id)
            remainingPayment -= invoiceAmount
          }
        }
        // If remainingPayment < invoiceAmount, skip (partial payment — invoice stays unpaid)
        // The customer balance is still reduced, so it's tracked at the account level
      }
    }

    // Recalculate aging after payment
    try {
      await recalculateAging(supabase, customerId)
    } catch (agingError) {
      console.error('Aging recalculation error (non-fatal):', agingError)
    }

    console.log(`✅ Payment of $${paymentAmount.toFixed(2)} recorded for customer ${customerId}. ${paidInvoiceIds.length} invoices marked paid.`)

    return NextResponse.json({
      success: true,
      newBalance,
      paidInvoices: paidInvoiceIds.length,
      paidInvoiceIds
    })
  } catch (error) {
    console.error('Record payment error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Recalculate aging buckets after payment
async function recalculateAging(supabase: any, customerId: string) {
  const { data: openInvoices } = await supabase
    .from('ar_transactions')
    .select('amount, due_date')
    .eq('customer_id', customerId)
    .eq('type', 'invoice')
    .is('paid_date', null)

  const buckets = { current: 0, days_1_30: 0, days_31_60: 0, days_61_90: 0, days_over_90: 0 }
  const today = new Date()

  for (const inv of openInvoices || []) {
    if (!inv.due_date) continue
    const diff = Math.floor((today.getTime() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24))
    const amt = parseFloat(inv.amount)

    if (diff <= 0) buckets.current += amt
    else if (diff <= 30) buckets.days_1_30 += amt
    else if (diff <= 60) buckets.days_31_60 += amt
    else if (diff <= 90) buckets.days_61_90 += amt
    else buckets.days_over_90 += amt
  }

  const total_due = Object.values(buckets).reduce((s, v) => s + v, 0)

  await supabase.from('ar_aging').upsert({
    customer_id: customerId,
    ...buckets,
    total_due
  })
}
