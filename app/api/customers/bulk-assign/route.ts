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

// POST - Bulk assign customers to routes
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServiceClient();
    const body = await request.json();
    const { assignments } = body; // Array of { customer_id, route_number, drop_sequence }

    if (!assignments || !Array.isArray(assignments)) {
      return NextResponse.json(
        { error: 'assignments array required' },
        { status: 400 }
      );
    }

    // Update all customers in parallel
    const updates = assignments.map(async (assignment: any) => {
      return supabase
        .from('customers')
        .update({
          route_number: assignment.route_number || null,
          drop_sequence: assignment.drop_sequence || null
        })
        .eq('id', assignment.customer_id);
    });

    const results = await Promise.all(updates);

    // Check for errors
    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      console.error('❌ Some assignments failed:', errors);
      return NextResponse.json(
        { error: 'Some assignments failed', details: errors },
        { status: 500 }
      );
    }

    console.log(`✅ Bulk assigned ${assignments.length} customers`);

    return NextResponse.json({ 
      message: 'Customers assigned successfully',
      count: assignments.length
    });
  } catch (error: any) {
    console.error('❌ Error bulk assigning customers:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

