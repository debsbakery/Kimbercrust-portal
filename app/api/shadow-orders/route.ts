import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET: Fetch customer's shadow orders (usual items)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId') || user.id;

    console.log('🔍 Fetching shadow orders for customer:', customerId);

    // Get shadow orders with product details
    const { data: shadowOrders, error } = await supabase
      .from('shadow_orders')
      .select(`
        id,
        customer_id,
        product_id,
        quantity,
        created_at,
        updated_at,
        products (
          id,
          name,
          price,
          unit,
          gst_applicable,
          category,
          image_url
        )
      `)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching shadow orders:', error);
      throw error;
    }

    console.log('✅ Shadow orders fetched:', shadowOrders?.length || 0);

    return NextResponse.json(shadowOrders || []);
  } catch (error: any) {
    console.error('❌ Error fetching shadow orders:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Add product to shadow orders (favorites)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { product_id, quantity = 1 } = body;

    if (!product_id) {
      return NextResponse.json({ error: 'Product ID required' }, { status: 400 });
    }

    // Check if already in shadow orders
    const { data: existing } = await supabase
      .from('shadow_orders')
      .select('id, quantity')
      .eq('customer_id', user.id)
      .eq('product_id', product_id)
      .maybeSingle();

    if (existing) {
      // Update quantity if already exists
      const { data, error } = await supabase
        .from('shadow_orders')
        .update({ 
          quantity: existing.quantity + quantity,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    } else {
      // Insert new shadow order
      const { data, error } = await supabase
        .from('shadow_orders')
        .insert({
          customer_id: user.id,
          product_id,
          quantity,
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    }
  } catch (error: any) {
    console.error('❌ Error adding to shadow orders:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH: Update shadow order quantity
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { items } = body;

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Items array required' }, { status: 400 });
    }

    // Update multiple shadow orders
    const updates = items.map(async (item: any) => {
      const { data, error } = await supabase
        .from('shadow_orders')
        .update({
          quantity: item.quantity,
          updated_at: new Date().toISOString()
        })
        .eq('id', item.id)
        .eq('customer_id', user.id) // Ensure user owns this shadow order
        .select();

      if (error) throw error;
      return data;
    });

    const results = await Promise.all(updates);

    return NextResponse.json({ success: true, updated: results });
  } catch (error: any) {
    console.error('❌ Error updating shadow orders:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Remove shadow order
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Shadow order ID required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('shadow_orders')
      .delete()
      .eq('id', id)
      .eq('customer_id', user.id); // Ensure user owns this shadow order

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ Error deleting shadow order:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
