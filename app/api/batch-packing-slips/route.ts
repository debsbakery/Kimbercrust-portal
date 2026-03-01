export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateBatchPackingSlips } from '@/lib/batch-packing-slip'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { date, orderIds } = await request.json()

    let query = supabase
      .from('orders')
      .select(`
        *,
        customer:customer_id (
          business_name,
          contact_name
        ),
        order_items (
          quantity,
          product:product_id (
            name,
            code
          )
        )
      `)

    if (date) {
      query = query.eq('delivery_date', date)
    } else if (orderIds && orderIds.length > 0) {
      query = query.in('id', orderIds)
    } else {
      return NextResponse.json({ error: 'Either date or orderIds required' }, { status: 400 })
    }

    const { data: orders, error } = await query

    if (error) throw error

    if (!orders || orders.length === 0) {
      return NextResponse.json({ error: 'No orders found for this date' }, { status: 404 })
    }

    // Map to match the interface expected by generateBatchPackingSlips
    const mapped = orders.map((o: any) => ({
      id:o.id,
      delivery_date: o.delivery_date,
      customer: {
        business_name: o.customer?.business_name || o.customer_business_name || 'Unknown',
        contact_name:  o.customer?.contact_name  || o.customer_contact_name  || '',
      },
      order_items: (o.order_items || []).map((item: any) => ({
        quantity: item.quantity,
        product: {
          name:         item.product?.name || item.product_name || '—',
          product_code: item.product?.code || '',
        },
      })),
    }))

    const pdfBuffer = await generateBatchPackingSlips(mapped)

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="packing-slips-${date || 'batch'}.pdf"`,
      },
    })

  } catch (error: any) {
    console.error('Batch packing slips error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate packing slips' },
      { status: 500 }
    )
  }
}