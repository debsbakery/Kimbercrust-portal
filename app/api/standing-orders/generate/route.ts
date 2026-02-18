export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

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

export async function POST() {
  try {
    const supabase = await createServiceClient(); // ✅ Use service client
    const today = new Date().toISOString().split('T')[0];
    
    console.log(`🔄 Generating standing orders for ${today}...`);

    // ... rest of the function stays the same

    // Get all active standing orders that should be generated today
    const { data: standingOrders, error: fetchError } = await supabase
      .from('standing_orders')
      .select(`
        *,
        customer:customers(*),
        items:standing_order_items(
          *,
          product:products(*)
        )
      `)
      .eq('active', true)
      .lte('next_generation_date', today);

    if (fetchError) throw fetchError;

    if (!standingOrders || standingOrders.length === 0) {
      console.log('✅ No standing orders to generate today');
      return NextResponse.json({ 
        message: 'No standing orders to generate',
        ordersCreated: 0 
      });
    }

    let ordersCreated = 0;
    const errors: any[] = [];

    for (const standingOrder of standingOrders) {
      try {
        // Calculate delivery date (2 days from now)
        const deliveryDate = new Date();
        deliveryDate.setDate(deliveryDate.getDate() + 2);
        const deliveryDateStr = deliveryDate.toISOString().split('T')[0];

        // Check if order already exists for this delivery date
        const { data: existingOrder } = await supabase
          .from('orders')
          .select('id')
          .eq('customer_id', standingOrder.customer_id)
          .eq('delivery_date', deliveryDateStr)
          .eq('source', 'standing_order')
          .single();

        if (existingOrder) {
          console.log(`⏭️ Order already exists for ${standingOrder.customer.business_name} on ${deliveryDateStr}`);
          continue;
        }

        // Get customer pricing for accurate totals
        const itemsWithPricing = await Promise.all(
          standingOrder.items.map(async (item: any) => {
            const { data: pricing } = await supabase
              .from('customer_pricing')
              .select('contract_price')
              .eq('customer_id', standingOrder.customer_id)
              .eq('product_id', item.product_id)
              .lte('effective_from', deliveryDateStr)
              .or(`effective_to.is.null,effective_to.gte.${deliveryDateStr}`)
              .order('effective_from', { ascending: false })
              .limit(1)
              .single();

            const unitPrice = pricing?.contract_price || item.product.price;
            const subtotal = unitPrice * item.quantity;

            return {
              product_id: item.product_id,
              product_name: item.product.name,
              quantity: item.quantity,
              unit_price: unitPrice,
              subtotal,
              gst_applicable: item.product.gst_applicable
            };
          })
        );

        // Calculate totals
        const totalBeforeGST = itemsWithPricing.reduce((sum, item) => sum + item.subtotal, 0);
        const gstAmount = itemsWithPricing
          .filter(item => item.gst_applicable)
          .reduce((sum, item) => sum + (item.subtotal * 0.1), 0);
        const totalAmount = totalBeforeGST + gstAmount;

        // Create order
        const { data: newOrder, error: orderError } = await supabase
          .from('orders')
          .insert({
            customer_id: standingOrder.customer_id,
            customer_email: standingOrder.customer.email,
            customer_business_name: standingOrder.customer.business_name,
            customer_address: standingOrder.customer.address,
            customer_abn: standingOrder.customer.abn,
            delivery_date: deliveryDateStr,
            total_amount: totalAmount,
            status: 'confirmed', // Auto-approved
            source: 'standing_order',
            notes: `Auto-generated from ${standingOrder.delivery_day} standing order`
          })
          .select()
          .single();

        if (orderError) throw orderError;

        // Create order items
        const orderItems = itemsWithPricing.map(item => ({
          order_id: newOrder.id,
          ...item
        }));

        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(orderItems);

        if (itemsError) throw itemsError;

        // Update standing order's next generation date
        const nextGenDate = calculateNextGenerationDate(standingOrder.delivery_day);
        await supabase
          .from('standing_orders')
          .update({
            last_generated_date: today,
            next_generation_date: nextGenDate
          })
          .eq('id', standingOrder.id);

        ordersCreated++;
        console.log(`✅ Created order for ${standingOrder.customer.business_name} - Delivery: ${deliveryDateStr}`);

      } catch (error: any) {
        console.error(`❌ Error creating order for standing order ${standingOrder.id}:`, error);
        errors.push({
          standing_order_id: standingOrder.id,
          customer: standingOrder.customer.business_name,
          error: error.message
        });
      }
    }

    return NextResponse.json({
      message: `Successfully generated ${ordersCreated} orders`,
      ordersCreated,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error: any) {
    console.error('❌ Error in standing order generation:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate standing orders' },
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
