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

// GET single route
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ routeNumber: string }> }
) {
  try {
    const { routeNumber } = await params;
    const supabase = await createServiceClient();

    const { data: route, error } = await supabase
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
      .eq('route_number', routeNumber.toUpperCase())
      .single();

    if (error) throw error;

    if (route.customers) {
      route.customers.sort((a: any, b: any) => 
        (a.drop_sequence || 999) - (b.drop_sequence || 999)
      );
    }

    return NextResponse.json({ route });
  } catch (error: any) {
    console.error('❌ Error fetching route:', error);
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
}

// PUT - Update route
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ routeNumber: string }> }
) {
  try {
    const { routeNumber } = await params;
    const supabase = await createServiceClient();
    const body = await request.json();

    const updates: any = {
      updated_at: new Date().toISOString()
    };

    if (body.route_name !== undefined) updates.route_name = body.route_name;
    if (body.driver_name !== undefined) updates.driver_name = body.driver_name || null;
    if (body.start_time !== undefined) updates.start_time = body.start_time || null;
    if (body.estimated_duration_minutes !== undefined) updates.estimated_duration_minutes = body.estimated_duration_minutes || null;
    if (body.notes !== undefined) updates.notes = body.notes || null;
    if (body.active !== undefined) updates.active = body.active;

    const { data: route, error } = await supabase
      .from('routes')
      .update(updates)
      .eq('route_number', routeNumber.toUpperCase())
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Route updated:', route.route_number);

    return NextResponse.json({ route });
  } catch (error: any) {
    console.error('❌ Error updating route:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Deactivate route
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ routeNumber: string }> }
) {
  try {
    const { routeNumber } = await params;
    const supabase = await createServiceClient();

    const { error } = await supabase
      .from('routes')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('route_number', routeNumber.toUpperCase());

    if (error) throw error;

    console.log('✅ Route deactivated:', routeNumber);

    return NextResponse.json({ message: 'Route deactivated successfully' });
  } catch (error: any) {
    console.error('❌ Error deactivating route:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}