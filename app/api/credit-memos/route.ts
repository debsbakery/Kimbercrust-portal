export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const customerId = searchParams.get('customer_id')
  const type       = searchParams.get('type')
  const from       = searchParams.get('from')
  const to         = searchParams.get('to')

  let query = supabase
    .from('credit_memos')
    .select(`
      *,
      customer:customers(id, business_name, contact_name, email, address, abn),
      items:credit_memo_items(*)
    `)
    .order('created_at', { ascending: false })

  if (customerId) query = query.eq('customer_id', customerId)
  if (type)       query = query.eq('credit_type', type)
  if (from)       query = query.gte('created_at', from)
  if (to)         query = query.lte('created_at', to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    const body = await request.json()
    const { customer_id, order_id, credit_type, notes, items } = body

    if (!customer_id || !items?.length) {
      return NextResponse.json({ error: 'customer_id and items required' }, { status: 400 })
    }

    // Calculate totals
    let subtotal   = 0
    let gst_amount = 0

    const processedItems = items.map((item: any) => {
      const creditPercent = item.credit_percent ?? 100
      const lineTotal     = -(item.quantity * item.unit_price * (creditPercent / 100))
      const lineGst       = item.gst_applicable ? lineTotal * 0.1 : 0
      subtotal   += lineTotal
      gst_amount += lineGst

      return {
        product_id:     item.product_id || null,
        product_name:   item.product_name,
        product_code:   item.product_code || null,
        // existing columns
        custom_description: item.product_name,
        quantity:       item.quantity,
        unit_price:     item.unit_price,
        total:          lineTotal,
        // new columns
        credit_percent: creditPercent,
        line_total:     lineTotal,
        gst_applicable: item.gst_applicable ?? true,
        gst_amount:     lineGst,
        credit_type:    item.credit_type || credit_type,
      }
    })

    const total_amount = subtotal + gst_amount

    // Generate credit number
    const creditNumber = `CM-${Date.now().toString().slice(-6)}`

    // Create memo using existing + new columns
    const { data: memo, error: memoError } = await supabase
      .from('credit_memos')
      .insert({
        customer_id,
        reference_order_id: order_id || null,
        credit_type,
        notes,
        reason:       credit_type === 'stale_return' ? 'Stale Return' : 'Product Credit',
        credit_number: creditNumber,
        credit_date:  new Date().toISOString().split('T')[0],
        status:       'issued',
        subtotal,
        gst_amount,
        total_amount,
        amount:       Math.abs(total_amount),   // existing amount column
      })
      .select()
      .single()

    if (memoError) throw memoError

    // Insert line items
    const { error: itemsError } = await supabase
      .from('credit_memo_items')
      .insert(
        processedItems.map((i: any) => ({ ...i, credit_memo_id: memo.id }))
      )

    if (itemsError) throw itemsError

    // Update customer balance immediately
    const { data: cust } = await supabase
      .from('customers')
      .select('balance')
      .eq('id', customer_id)
      .single()

    await supabase
      .from('customers')
      .update({ 
        balance: (parseFloat(cust?.balance || '0') + total_amount)
      })
      .eq('id', customer_id)

    // Record AR transaction
    await supabase.from('ar_transactions').insert({
  customer_id,
  type:        'credit',           // ← was 'credit_memo'
  invoice_id:  memo.id,
  amount:      Math.abs(total_amount),  // ← always positive
  description: `Credit Memo ${creditNumber} - ${
    credit_type === 'stale_return' ? 'Stale Return' : 'Product Credit'
  }`,
})

    return NextResponse.json({ data: memo }, { status: 201 })

  } catch (error: any) {
    console.error('Credit memo error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
