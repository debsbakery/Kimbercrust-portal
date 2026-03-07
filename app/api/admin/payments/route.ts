export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient()

    const body = await request.json()

    const {
      customer_id,
      amount,
      payment_date,
      payment_method,
      reference_number,
      notes,
      allocations = [],
    } = body

    if (!customer_id || !amount) {
      return NextResponse.json(
        { error: 'customer_id and amount are required' },
        { status: 400 }
      )
    }

    // ── Get customer ──────────────────────────────────────────
    const { data: customer } = await supabase
      .from('customers')
      .select('business_name, contact_name, balance')
      .eq('id', customer_id)
      .single()

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // ── Insert payment ────────────────────────────────────────
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        customer_id,
        amount:           parseFloat(amount),
        payment_date:     payment_date || new Date().toISOString().split('T')[0],
        payment_method:   payment_method || null,
        reference_number: reference_number || null,
        notes:            notes || null,
        allocated_amount: allocations.reduce(
          (sum: number, a: any) => sum + (a.amount || 0), 0
        ),
      })
      .select()
      .single()

    if (paymentError) throw paymentError

    // ── Process invoice allocations ───────────────────────────
    if (Array.isArray(allocations) && allocations.length > 0) {
      for (const allocation of allocations) {
        if (!allocation.invoice_id || !allocation.amount) continue

        // Link payment to invoice
        await supabase.from('invoice_payments').insert({
          invoice_id: allocation.invoice_id,
          payment_id: payment.id,
          amount:     allocation.amount,
        })

        // Update invoice amount_paid on orders table
        const { data: invoice } = await supabase
          .from('orders')
          .select('amount_paid')
          .eq('id', allocation.invoice_id)
          .single()

        await supabase
          .from('orders')
          .update({
            amount_paid: (invoice?.amount_paid || 0) + allocation.amount,
          })
          .eq('id', allocation.invoice_id)
      }
    }

    // ── Balance updated automatically by DB trigger ───────────
    // trigger_balance_on_payment fires on INSERT to payments
    // No manual balance update needed here

    // ── Read back the new balance ─────────────────────────────
    const { data: updated } = await supabase
      .from('customers')
      .select('balance')
      .eq('id', customer_id)
      .single()

    const customerName = customer.business_name || customer.contact_name

    console.log('Payment recorded:', {
      customer:    customerName,
      amount,
      new_balance: updated?.balance,
    })

    return NextResponse.json({
      payment: {
        id:          payment.id,
        customer:    customerName,
        amount:      parseFloat(amount),
        new_balance: updated?.balance ?? 0,
        allocations: allocations.length,
      },
    })

  } catch (error: any) {
    console.error('Error recording payment:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}