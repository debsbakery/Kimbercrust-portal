import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST: Copy an existing order (admin tool)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { order_id, new_delivery_date } = body

    if (!order_id || !new_delivery_date) {
      return NextResponse.json(
        { error: 'order_id and new_delivery_date required' },
        { status: 400 }
      )
    }

    // Fetch original order
    const { data: originalOrder, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single()

    if (orderError || !originalOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Fetch original order items
    const { data: originalItems, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order_id)

    if (itemsError) throw itemsError

    // Create new order
    const { data: newOrder, error: newOrderError } = await supabase
      .from('orders')
      .insert({
        customer_id: originalOrder.customer_id,
        customer_email: originalOrder.customer_email,
        customer_business_name: originalOrder.customer_business_name,
        customer_address: originalOrder.customer_address,
        customer_abn: originalOrder.customer_abn,
        delivery_date: new_delivery_date,
        notes: originalOrder.notes ? `Copied from order. Original notes: ${originalOrder.notes}` : 'Copied from previous order',
        status: 'pending',
        total_amount: originalOrder.total_amount,
        source: 'copied',
        copied_from_order_id: order_id
      })
      .select()
      .single()

    if (newOrderError) throw newOrderError

    // Copy order items
    const { error: copyItemsError } = await supabase
      .from('order_items')
      .insert(
        (originalItems || []).map(item => ({
          order_id: newOrder.id,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.subtotal,
          gst_applicable: item.gst_applicable
        }))
      )

    if (copyItemsError) throw copyItemsError

    return NextResponse.json(newOrder)
  } catch (error: any) {
    console.error('Order copy error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to copy order' },
      { status: 500 }
    )
  }
}