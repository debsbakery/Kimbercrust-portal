import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const isAdmin = await checkAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { original_order_id, new_delivery_date } = await request.json();

    const supabase = await createClient();

    // Get original order with items
    const { data: originalOrder, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          product_id,
          product_name,
          quantity,
          unit_price,
          gst_applicable
        )
      `)
      .eq('id', original_order_id)
      .single();

    if (orderError || !originalOrder) {
      return NextResponse.json({ error: 'Original order not found' }, { status: 404 });
    }

    // Calculate totals
    const subtotal = originalOrder.order_items.reduce(
      (sum: number, item: any) => sum + item.quantity * item.unit_price,
      0
    );
    const gst = originalOrder.order_items.reduce(
      (sum: number, item: any) =>
        sum + (item.gst_applicable ? item.quantity * item.unit_price * 0.1 : 0),
      0
    );
    const total = subtotal + gst;

    // Create new order
    const { data: newOrder, error: createError } = await supabase
      .from('orders')
      .insert({
        customer_id: originalOrder.customer_id,
        customer_email: originalOrder.customer_email,
        customer_business_name: originalOrder.customer_business_name,
        customer_address: originalOrder.customer_address,
        customer_abn: originalOrder.customer_abn,
        delivery_date: new_delivery_date,
        status: 'pending',
        source: 'manual',
        total_amount: total,
        notes: `Repeated from order #${original_order_id.slice(0, 8)}`,
        copied_from_order_id: original_order_id,
      })
      .select()
      .single();

    if (createError) {
      console.error('Create order error:', createError);
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    // Create order items
    const { error: itemsError } = await supabase.from('order_items').insert(
      originalOrder.order_items.map((item: any) => ({
        order_id: newOrder.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.quantity * item.unit_price,
        gst_applicable: item.gst_applicable,
      }))
    );

    if (itemsError) {
      console.error('Create items error:', itemsError);
      return NextResponse.json({ error: 'Failed to copy items' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      new_order_id: newOrder.id,
      message: 'Order created successfully'
    });
  } catch (error: any) {
    console.error('Repeat order error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
