export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

async function createServiceClient() {
  const { createClient } = await import('@supabase/supabase-js')
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// GET single standing order
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServiceClient()

    const { data: standingOrder, error } = await supabase
      .from('standing_orders')
      .select(`
        *,
        customer:customers(id, business_name, email, contact_name),
        items:standing_order_items(
          id,
          product_id,
          quantity,
          product:products(id, name, price, code, gst_applicable)
        )
      `)
      .eq('id', id)
      .single()

    if (error) throw error

    return NextResponse.json({ standingOrder }, { status: 200 })
  } catch (error: any) {
    console.error('Error fetching standing order:', error)
    return NextResponse.json(
      { error: error.message || 'Standing order not found' },
      { status: 404 }
    )
  }
}

// PUT - Update standing order
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServiceClient()
    const body = await request.json()

    // Accept delivery_days (correct column name)
    const { delivery_days, active, notes, items } = body

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (delivery_days !== undefined) {
      updates.delivery_days = delivery_days.toLowerCase()
      updates.next_generation_date = calculateNextGenerationDate(delivery_days.toLowerCase())
    }
    if (active !== undefined) updates.active = active
    if (notes !== undefined) updates.notes = notes || null

    const { data: standingOrder, error: updateError } = await supabase
      .from('standing_orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (updateError) throw updateError

    // Update items if provided — delete all then reinsert
    if (items !== undefined) {
      const { error: deleteError } = await supabase
        .from('standing_order_items')
        .delete()
        .eq('standing_order_id', id)

      if (deleteError) throw deleteError

      if (items.length > 0) {
        const orderItems = items.map((item: any) => ({
          standing_order_id: id,
          product_id: item.product_id,
          quantity: item.quantity,
        }))

        const { error: itemsError } = await supabase
          .from('standing_order_items')
          .insert(orderItems)

        if (itemsError) throw itemsError

        // Sync shadow orders
        const shadowItems = items.map((item: any) => ({
          customer_id: standingOrder.customer_id,
          product_id: item.product_id,
          default_quantity: item.quantity,
        }))

        await supabase
          .from('shadow_orders')
          .upsert(shadowItems, { onConflict: 'customer_id,product_id' })
      }
    }

    return NextResponse.json(
      { message: 'Standing order updated successfully', standingOrder },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error updating standing order:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update standing order' },
      { status: 500 }
    )
  }
}

// DELETE - hard delete standing order and its items
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServiceClient()

    // Delete items first
    await supabase
      .from('standing_order_items')
      .delete()
      .eq('standing_order_id', id)

    // Then delete the order
    const { error } = await supabase
      .from('standing_orders')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting standing order:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete standing order' },
      { status: 500 }
    )
  }
}

function calculateNextGenerationDate(deliveryDay: string): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const targetDayIndex = days.indexOf(deliveryDay)
  const today = new Date()
  const currentDayIndex = today.getDay()

  let daysUntilDelivery = targetDayIndex - currentDayIndex
  if (daysUntilDelivery <= 0) daysUntilDelivery += 7

  const daysUntilGeneration = daysUntilDelivery - 2
  const generationDate = new Date(today)
  generationDate.setDate(today.getDate() + daysUntilGeneration)

  return generationDate.toISOString().split('T')[0]
}