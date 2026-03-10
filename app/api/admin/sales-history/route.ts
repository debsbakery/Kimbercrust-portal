export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)

  const productId  = searchParams.get('product_id')
  const customerId = searchParams.get('customer_id')
  const from       = searchParams.get('from')
  const to         = searchParams.get('to')

  try {
    let query = supabase
      .from('order_items')
      .select(`
        id,
        product_id,
        product_name,
        quantity,
        unit_price,
        subtotal,
        gst_applicable,
        orders!inner (
          id,
          customer_id,
          delivery_date,
          status,
          customers ( id, business_name, contact_name )
        ),
        products ( id, name, code )
      `)
      .not('orders.status', 'in', '("cancelled","draft")')
      .order('orders(delivery_date)', { ascending: false })

    if (productId)  query = query.eq('product_id', productId)
    if (customerId) query = query.eq('orders.customer_id', customerId)
    if (from)       query = query.gte('orders.delivery_date', from)
    if (to)         query = query.lte('orders.delivery_date', to)

    const { data, error } = await query

    if (error) throw error

    const items = (data ?? []).map((item: any) => ({
      id:item.id,
      product_id:     item.product_id,
      product_name:   item.product_name,
      product_code:   item.products?.code ?? null,
      quantity:       Number(item.quantity),
      unit_price:     Number(item.unit_price),
      subtotal:       Number(item.subtotal),
      gst_applicable: item.gst_applicable,
      gst_amount:     item.gst_applicable ? Number(item.subtotal) * 0.1 : 0,
      order_id:       item.orders?.id,
      delivery_date:  item.orders?.delivery_date,
      customer_id:    item.orders?.customers?.id,
      customer_name:  item.orders?.customers?.business_name,
    }))

    const totalQty = items.reduce((s, i) => s + i.quantity, 0)
    const totalRev = items.reduce((s, i) => s + i.subtotal + i.gst_amount, 0)
    const totalGst = items.reduce((s, i) => s + i.gst_amount, 0)

    return NextResponse.json({
      items,
      summary: {
        total_quantity: totalQty,
        total_revenue:  totalRev,
        total_gst:      totalGst,
        net_revenue:    totalRev - totalGst,
      },})
  } catch (error: any) {
    console.error('Sales history error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
