export const dynamic = 'force-dynamic'

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

// GET all routes
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServiceClient();
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';

    let query = supabase
      .from('routes')
      .select(`
        *,
        customers:customers(
          id,
          business_name,
          contact_name,
          address,
          phone,
          drop_sequence,
          delivery_notes
        )
      `)
      .order('route_number');

    if (activeOnly) {
      query = query.eq('active', true);
    }

    const { data: routes, error } = await query;

    if (error) throw error;

    const routesWithSortedCustomers = routes?.map(route => ({
      ...route,
      customers: route.customers?.sort((a: any, b: any) => 
        (a.drop_sequence || 999) - (b.drop_sequence || 999)
      ) || []
    }));

    return NextResponse.json({ routes: routesWithSortedCustomers });
  } catch (error: any) {
    console.error('❌ Error fetching routes:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Create new route
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServiceClient();
    const body = await request.json();
    const { route_number, route_name, driver_name, start_time, estimated_duration_minutes, notes } = body;

    if (!route_number || !route_name) {
      return NextResponse.json(
        { error: 'route_number and route_name are required' },
        { status: 400 }
      );
    }

    const { data: route, error } = await supabase
      .from('routes')
      .insert({
        route_number: route_number.toUpperCase(),
        route_name,
        driver_name: driver_name || null,
        start_time: start_time || null,
        estimated_duration_minutes: estimated_duration_minutes || null,
        notes: notes || null,
        active: true
      })
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Route created:', route.route_number);

    return NextResponse.json({ route }, { status: 201 });
  } catch (error: any) {
    console.error('❌ Error creating route:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

