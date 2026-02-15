import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET customer's standing orders
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await params;
    const supabase = await createClient();

    const { data: standingOrders, error } = await supabase
      .from('standing_orders')
      .select(`
        *,
        items:standing_order_items(
          id,
          product_id,
          quantity,
          product:products(id, name, price, unit, product_number, gst_applicable)
        )
      `)
      .eq('customer_id', customerId)
      .order('delivery_day');

    if (error) throw error;

    return NextResponse.json({ standingOrders }, { status: 200 });
  } catch (error: any) {
    console.error('❌ Error fetching customer standing orders:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch standing orders' },
      { status: 500 }
    );
  }
}