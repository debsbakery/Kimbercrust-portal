import { NextRequest, NextResponse } from 'next/server';

// ✅ Helper to create service client
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

// GET single standing order
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServiceClient(); // ✅ Use service client

    const { data: standingOrder, error } = await supabase
      .from('standing_orders')
      .select(`
        *,
        customer:customers(id, business_name, email, contact_name, address, abn),
        items:standing_order_items(
          id,
          product_id,
          quantity,
          product:products(id, name, price, unit, product_number, gst_applicable)
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    return NextResponse.json({ standingOrder }, { status: 200 });
  } catch (error: any) {
    console.error('❌ Error fetching standing order:', error);
    return NextResponse.json(
      { error: error.message || 'Standing order not found' },
      { status: 404 }
    );
  }
}

// PUT - Update standing order
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServiceClient(); // ✅ Use service client
    const body = await request.json();
    const { delivery_day, active, notes, items } = body;

    console.log('📝 Updating standing order:', id);

    // Update standing order
    const updates: any = { updated_at: new Date().toISOString() };
    
    if (delivery_day !== undefined) {
      updates.delivery_day = delivery_day.toLowerCase();
      updates.next_generation_date = calculateNextGenerationDate(delivery_day.toLowerCase());
    }
    if (active !== undefined) updates.active = active;
    if (notes !== undefined) updates.notes = notes;

    const { data: standingOrder, error: updateError } = await supabase
      .from('standing_orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    console.log('✅ Standing order updated');

    // Update items if provided
    if (items !== undefined) {
      // Delete existing items
      await supabase
        .from('standing_order_items')
        .delete()
        .eq('standing_order_id', id);

      console.log('🗑️ Deleted old items');

      // Insert new items
      if (items.length > 0) {
        const orderItems = items.map((item: any) => ({
          standing_order_id: id,
          product_id: item.product_id,
          quantity: item.quantity
        }));

        const { error: itemsError } = await supabase
          .from('standing_order_items')
          .insert(orderItems);

        if (itemsError) throw itemsError;

        console.log(`✅ Added ${items.length} new items`);

        // Update shadow orders
        const { data: orderData } = await supabase
          .from('standing_orders')
          .select('customer_id')
          .eq('id', id)
          .single();

        if (orderData) {
          const shadowOrderItems = items.map((item: any) => ({
            customer_id: orderData.customer_id,
            product_id: item.product_id,
            default_quantity: item.quantity
          }));

          await supabase
            .from('shadow_orders')
            .upsert(shadowOrderItems, { onConflict: 'customer_id,product_id' });

          console.log('✅ Synced to shadow orders');
        }
      }
    }

    return NextResponse.json(
      { message: 'Standing order updated successfully', standingOrder },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('❌ Error updating standing order:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update standing order' },
      { status: 500 }
    );
  }
}

// DELETE - Deactivate standing order
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServiceClient(); // ✅ Use service client

    const { error } = await supabase
      .from('standing_orders')
      .update({ active: false })
      .eq('id', id);

    if (error) throw error;

    console.log('✅ Standing order deactivated:', id);

    return NextResponse.json(
      { message: 'Standing order deactivated successfully' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('❌ Error deactivating standing order:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to deactivate standing order' },
      { status: 500 }
    );
  }
}

function calculateNextGenerationDate(deliveryDay: string): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const targetDayIndex = days.indexOf(deliveryDay.toLowerCase());
  
  const today = new Date();
  const currentDayIndex = today.getDay();
  
  let daysUntilDelivery = targetDayIndex - currentDayIndex;
  if (daysUntilDelivery <= 0) {
    daysUntilDelivery += 7;
  }
  
  const daysUntilGeneration = daysUntilDelivery - 2;
  const generationDate = new Date(today);
  generationDate.setDate(today.getDate() + daysUntilGeneration);
  
  return generationDate.toISOString().split('T')[0];
}