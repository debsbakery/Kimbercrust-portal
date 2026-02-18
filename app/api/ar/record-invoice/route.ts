export const dynamic = 'force-dynamic'

// app/api/ar/record-invoice/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'


export async function POST(request: NextRequest) {
  const supabase = await createClient()
  try {
    const { order_id } = await request.json()

    if (!order_id) {
      return NextResponse.json({ error: 'order_id required' }, { status: 400 })
    }

    console.log(`ðŸ“„ Recording invoice for order: ${order_id}`)

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single()

    if (orderError || !order) {
      console.error('âŒ Order not found:', orderError)
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (!order.customer_id) {
      console.error('âŒ Order has no customer_id')
      return NextResponse.json({ error: 'Order has no customer_id' }, { status: 400 })
    }

    console.log(`   Customer: ${order.customer_id}`)
    console.log(`   Total: $${order.total_amount}`)

    // Check if already recorded
    const { data: existing } = await supabase
      .from('ar_transactions')
      .select('id')
      .eq('invoice_id', order_id)
      .eq('type', 'invoice')
      .maybeSingle()

    if (existing) {
      console.log(`   â„¹ï¸ Invoice already recorded (transaction ${existing.id})`)
      
      // Get existing invoice number
      const { data: existingInv } = await supabase
        .from('invoice_numbers')
        .select('invoice_number')
        .eq('order_id', order_id)
        .maybeSingle()

      return NextResponse.json({
        success: true,
        message: 'Invoice already recorded',
        transaction_id: existing.id,
        invoiceNumber: existingInv?.invoice_number || null,
      })
    }

    // Get customer payment terms
    const { data: customer } = await supabase
      .from('customers')
      .select('balance, payment_terms, business_name')
      .eq('id', order.customer_id)
      .single()

    const paymentTerms = customer?.payment_terms || 30
    const currentBalance = parseFloat(customer?.balance || '0')
    const invoiceAmount = parseFloat(order.total_amount || '0')
    const newBalance = currentBalance + invoiceAmount

    console.log(`   Current balance: $${currentBalance.toFixed(2)}`)
    console.log(`   New balance: $${newBalance.toFixed(2)}`)

    // Calculate due date
    const dueDate = new Date(order.delivery_date || order.created_at)
    dueDate.setDate(dueDate.getDate() + paymentTerms)

    console.log(`   Due date: ${dueDate.toISOString().split('T')[0]}`)

    // Get or create invoice number
    let invoiceNumber = null
    const { data: existingInvNum } = await supabase
      .from('invoice_numbers')
      .select('invoice_number')
      .eq('order_id', order_id)
      .maybeSingle()

    if (existingInvNum) {
      invoiceNumber = existingInvNum.invoice_number
      console.log(`   Using existing invoice #${invoiceNumber}`)
    } else {
      // Get next invoice number
      const { data: maxInv } = await supabase
        .from('invoice_numbers')
        .select('invoice_number')
        .order('invoice_number', { ascending: false })
        .limit(1)
        .maybeSingle()

      invoiceNumber = (maxInv?.invoice_number || 1000) + 1

      const { error: invNumError } = await supabase
        .from('invoice_numbers')
        .insert({ order_id, invoice_number: invoiceNumber })

      if (invNumError) {
        console.error('âŒ Invoice number creation error:', invNumError)
        throw invNumError
      }

      console.log(`   Created invoice #${invoiceNumber}`)
    }

    // Create AR transaction
    const { data: transaction, error: txError } = await supabase
      .from('ar_transactions')
      .insert({
        customer_id: order.customer_id,
        type: 'invoice',
        invoice_id: order_id,
        amount: invoiceAmount.toFixed(2),
        balance_after: newBalance.toFixed(2),
        due_date: dueDate.toISOString().split('T')[0],
        description: `Invoice #${invoiceNumber} - Order ${order.id.slice(0, 8).toUpperCase()} - Delivery ${order.delivery_date}`,
      })
      .select()
      .single()

    if (txError) {
      console.error('âŒ AR transaction error:', txError)
      throw txError
    }

    console.log(`   âœ… AR transaction created: ${transaction.id}`)

    // Update customer balance
    const { error: balanceError } = await supabase
      .from('customers')
      .update({ balance: newBalance.toFixed(2) })
      .eq('id', order.customer_id)

    if (balanceError) {
      console.error('âŒ Balance update error:', balanceError)
      throw balanceError
    }

    console.log(`   âœ… Customer balance updated`)

    console.log(
      `âœ… Invoice #${invoiceNumber} recorded for ${customer?.business_name || order.customer_email} - ` +
      `$${invoiceAmount.toFixed(2)} (due: ${dueDate.toISOString().split('T')[0]})`
    )

    return NextResponse.json({
      success: true,
      transaction,
      invoiceNumber,
      newBalance,
    })
  } catch (error: any) {
    console.error('âŒ Record invoice error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to record invoice' },
      { status: 500 }
    )
  }
}
