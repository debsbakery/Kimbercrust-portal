import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - Get customer's standing orders
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: standingOrders, error } = await supabase
      .from('standing_orders')
      .select(`
        *,
        items:standing_order_items(
          id,
          product_id,
          product_name,
          quantity,
          products(name, price, image_url, unit)
        )
      `)
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ standingOrders: standingOrders || [] });
  } catch (error: any) {
    console.error('❌ Error fetching standing orders:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Update standing order status (pause/resume)
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { standing_order_id, status } = body;

    if (!standing_order_id || !status) {
      return NextResponse.json(
        { error: 'standing_order_id and status required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: standingOrder, error: checkError } = await supabase
      .from('standing_orders')
      .select('id, customer_id')
      .eq('id', standing_order_id)
      .single();

    if (checkError || !standingOrder) {
      return NextResponse.json({ error: 'Standing order not found' }, { status: 404 });
    }

    if (standingOrder.customer_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Update status
    const { data: updated, error: updateError } = await supabase
      .from('standing_orders')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', standing_order_id)
      .select()
      .single();

    if (updateError) throw updateError;

    console.log(`✅ Standing order ${standing_order_id} ${status} by customer`);

    return NextResponse.json({ standingOrder: updated });
  } catch (error: any) {
    console.error('❌ Error updating standing order:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}