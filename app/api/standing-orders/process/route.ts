export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET: Fetch customer's standing orders
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId')

    if (!customerId) {
      return NextResponse.json({ error: 'customerId required' }, { status: 400 })
    }

    const { data: standingOrders, error } = await supabase
      .from('standing_orders')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json(standingOrders || [])
  } catch (error: any) {
    console.error('Standing orders fetch error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch standing orders' },
      { status: 500 }
    )
  }
}

// POST: Create new standing order
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const {
      customer_id,
      name,
      frequency, // 'weekly' or 'monthly'
      day_of_week, // 0-6 (Sunday-Saturday) for weekly
      day_of_month, // 1-31 for monthly
      items, // [{ product_id, quantity }]
      notes
    } = body

    if (!customer_id || !name || !frequency || !items?.length) {
      return NextResponse.json(
        { error: 'customer_id, name, frequency, and items are required' },
        { status: 400 }
      )
    }

    // Calculate next delivery date
    const nextDeliveryDate = calculateNextDeliveryDate(frequency, day_of_week, day_of_month)

    // Create standing order
    const { data: standingOrder, error: orderError } = await supabase
      .from('standing_orders')
      .insert({
        customer_id,
        name,
        frequency,
        day_of_week: frequency === 'weekly' ? day_of_week : null,
        day_of_month: frequency === 'monthly' ? day_of_month : null,
        next_delivery_date: nextDeliveryDate,
        is_active: true,
        notes
      })
      .select()
      .single()

    if (orderError) throw orderError

    // Create standing order items (new table needed)
    const { error: itemsError } = await supabase
      .from('standing_order_items')
      .insert(
        items.map((item: any) => ({
          standing_order_id: standingOrder.id,
          product_id: item.product_id,
          quantity: item.quantity
        }))
      )

    if (itemsError) throw itemsError

    return NextResponse.json(standingOrder)
  } catch (error: any) {
    console.error('Standing order creation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create standing order' },
      { status: 500 }
    )
  }
}

// PATCH: Toggle active status or update next delivery
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { id, is_active, next_delivery_date } = body

    if (!id) {
      return NextResponse.json({ error: 'Standing order ID required' }, { status: 400 })
    }

    const updates: any = {}
    if (is_active !== undefined) updates.is_active = is_active
    if (next_delivery_date) updates.next_delivery_date = next_delivery_date

    const { data, error } = await supabase
      .from('standing_orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Standing order update error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update standing order' },
      { status: 500 }
    )
  }
}

function calculateNextDeliveryDate(
  frequency: string,
  dayOfWeek?: number,
  dayOfMonth?: number
): string {
  const today = new Date()
  let nextDate = new Date()

  if (frequency === 'weekly' && dayOfWeek !== undefined) {
    const currentDay = today.getDay()
    const daysUntilNext = (dayOfWeek - currentDay + 7) % 7
    nextDate.setDate(today.getDate() + (daysUntilNext === 0 ? 7 : daysUntilNext))
  } else if (frequency === 'monthly' && dayOfMonth !== undefined) {
    nextDate.setDate(dayOfMonth)
    if (nextDate <= today) {
      nextDate.setMonth(nextDate.getMonth() + 1)
    }
  }

  return nextDate.toISOString().split('T')[0]
}

