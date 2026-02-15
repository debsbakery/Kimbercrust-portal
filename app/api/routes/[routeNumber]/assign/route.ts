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

// POST - Assign customers to route
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ routeNumber: string }> }
) {
  try {
    const { routeNumber } = await params;
    const supabase = await createServiceClient();
    const body = await request.json();
    const { customer_assignments } = body;

    if (!customer_assignments || !Array.isArray(customer_assignments)) {
      return NextResponse.json(
        { error: 'customer_assignments array required' },
        { status: 400 }
      );
    }

    const { data: route, error: routeError } = await supabase
      .from('routes')
      .select('route_number')
      .eq('route_number', routeNumber.toUpperCase())
      .single();

    if (routeError || !route) {
      return NextResponse.json({ error: 'Route not found' }, { status: 404 });
    }

    const updates = customer_assignments.map(async (assignment: any) => {
      return supabase
        .from('customers')
        .update({
          route_number: routeNumber.toUpperCase(),
          drop_sequence: assignment.drop_sequence || null
        })
        .eq('id', assignment.customer_id);
    });

    await Promise.all(updates);

    console.log(`✅ Assigned ${customer_assignments.length} customers to route ${routeNumber}`);

    return NextResponse.json({ 
      message: 'Customers assigned successfully',
      count: customer_assignments.length
    });
  } catch (error: any) {
    console.error('❌ Error assigning customers:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Unassign customer
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ routeNumber: string }> }
) {
  try {
    const { routeNumber } = await params;
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    if (!customerId) {
      return NextResponse.json({ error: 'customerId required' }, { status: 400 });
    }

    const supabase = await createServiceClient();

    const { error } = await supabase
      .from('customers')
      .update({
        route_number: null,
        drop_sequence: null
      })
      .eq('id', customerId)
      .eq('route_number', routeNumber.toUpperCase());

    if (error) throw error;

    console.log(`✅ Unassigned customer ${customerId} from route ${routeNumber}`);

    return NextResponse.json({ message: 'Customer unassigned successfully' });
  } catch (error: any) {
    console.error('❌ Error unassigning customer:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}