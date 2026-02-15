import { NextRequest, NextResponse } from 'next/server';

async function createServiceClient() {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}

// GET run sheet data for a specific route and date
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ routeNumber: string }> }
) {
  try {
    const { routeNumber } = await params;
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    const supabase = await createServiceClient();

    // Get route with assigned customers
    const { data: route, error: routeError } = await supabase
      .from('routes')
      .select(`
        *,
        customers:customers(
          id,
          business_name,
          contact_name,
          address,
          phone,
          email,
          drop_sequence,
          delivery_notes
        )
      `)
      .eq('route_number', routeNumber.toUpperCase())
      .single();

    if (routeError) throw routeError;

    // Sort customers by drop sequence
    const sortedCustomers = (route.customers || []).sort(
      (a: any, b: any) => (a.drop_sequence || 999) - (b.drop_sequence || 999)
    );

    // Get orders for each customer for the specified date (NO order_items!)
    const customerIds = sortedCustomers.map((c: any) => c.id);

    let orders: any[] = [];
    if (customerIds.length > 0) {
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          customer_id,
          delivery_date,
          total_amount,
          notes,
          status
        `)
        .in('customer_id', customerIds)
        .eq('delivery_date', date)
        .in('status', ['pending', 'confirmed', 'preparing']);

      if (ordersError) {
        console.error('Error fetching orders:', ordersError);
      } else {
        orders = ordersData || [];
      }
    }

    // Map orders to customers
    const customersWithOrders = sortedCustomers.map((customer: any) => {
      const customerOrders = orders.filter(
        (order: any) => order.customer_id === customer.id
      );

      return {
        ...customer,
        orders: customerOrders,
      };
    });

    return NextResponse.json({
      route: {
        ...route,
        customers: customersWithOrders,
      },
      date,
    });
  } catch (error: any) {
    console.error('❌ Error fetching run sheet:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}