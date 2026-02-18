export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';

// Helper to create service client (bypasses RLS)
async function createServiceClient() {
  const { createClient } = await import('@supabase/supabase-js');
  
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

// GET: Fetch shadow orders
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    const supabase = await createServiceClient(); // Use service client for admin access

    let targetCustomerId = customerId;

    // If no customerId provided, try to get from authenticated user
    if (!targetCustomerId) {
      // Import regular client for user auth
      const { createClient: createRegularClient } = await import('@/lib/supabase/server');
      const regularSupabase = await createRegularClient();
      
      const { data: { user } } = await regularSupabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Get customer ID from user
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('email', user.email)
        .single();

      if (!customer) {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
      }

      targetCustomerId = customer.id;
    }

    // Fetch shadow orders with product details
    const { data: shadowOrders, error } = await supabase
      .from('shadow_orders')
      .select(`
        id,
        product_id,
        default_quantity,
        display_order,
        product:products (
          id,
          product_number,
          name,
          description,
          price,
          unit,
          image_url,
          category,
          is_available
        )
      `)
      .eq('customer_id', targetCustomerId)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('❌ Error fetching shadow orders:', error);
      throw error;
    }

    console.log(`✅ Fetched ${shadowOrders?.length || 0} shadow orders for customer ${targetCustomerId}`);

    return NextResponse.json({ shadowOrders: shadowOrders || [] });
  } catch (error: any) {
    console.error('❌ Shadow orders fetch error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch favorites' },
      { status: 500 }
    );
  }
}

// POST: Add product to favorites
export async function POST(request: NextRequest) {
  try {
    const { createClient: createRegularClient } = await import('@/lib/supabase/server');
    const supabase = await createRegularClient();
    const serviceSupabase = await createServiceClient();
    
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { product_id, productId, default_quantity = 1 } = body;

    // Support both product_id and productId (your catalog uses productId)
    const finalProductId = product_id || productId;

    if (!finalProductId) {
      return NextResponse.json({ error: 'product_id required' }, { status: 400 });
    }

    // Get customer ID
    const { data: customer } = await serviceSupabase
      .from('customers')
      .select('id')
      .eq('email', user.email)
      .single();

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Check if already exists
    const { data: existing } = await serviceSupabase
      .from('shadow_orders')
      .select('id')
      .eq('customer_id', customer.id)
      .eq('product_id', finalProductId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Product already in favorites' }, { status: 400 });
    }

    // Get next display order
    const { data: maxOrder } = await serviceSupabase
      .from('shadow_orders')
      .select('display_order')
      .eq('customer_id', customer.id)
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = (maxOrder?.display_order || 0) + 1;

    // Insert
    const { data: newFavorite, error } = await serviceSupabase
      .from('shadow_orders')
      .insert({
        customer_id: customer.id,
        product_id: finalProductId,
        default_quantity,
        display_order: nextOrder,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(newFavorite);
  } catch (error: any) {
    console.error('❌ Add favorite error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to add favorite' },
      { status: 500 }
    );
  }
}

// DELETE: Remove from favorites
export async function DELETE(request: NextRequest) {
  try {
    const { createClient: createRegularClient } = await import('@/lib/supabase/server');
    const supabase = await createRegularClient();
    const serviceSupabase = await createServiceClient();
    
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const shadowOrderId = searchParams.get('id');

    if (!shadowOrderId) {
      return NextResponse.json({ error: 'Shadow order ID required' }, { status: 400 });
    }

    const { error } = await serviceSupabase
      .from('shadow_orders')
      .delete()
      .eq('id', shadowOrderId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ Remove favorite error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to remove favorite' },
      { status: 500 }
    );
  }
}

// PATCH: Update display order or default quantity
export async function PATCH(request: NextRequest) {
  try {
    const { createClient: createRegularClient } = await import('@/lib/supabase/server');
    const supabase = await createRegularClient();
    const serviceSupabase = await createServiceClient();
    
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, display_order, default_quantity } = body;

    if (!id) {
      return NextResponse.json({ error: 'Shadow order ID required' }, { status: 400 });
    }

    const updates: any = {};
    if (display_order !== undefined) updates.display_order = display_order;
    if (default_quantity !== undefined) updates.default_quantity = default_quantity;

    const { data, error } = await serviceSupabase
      .from('shadow_orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('❌ Update favorite error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update favorite' },
      { status: 500 }
    );
  }
}
