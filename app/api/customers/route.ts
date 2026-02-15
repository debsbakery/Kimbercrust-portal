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

// GET all customers
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServiceClient();

    const { data: customers, error } = await supabase
      .from('customers')
      .select('*')
      .order('business_name');

    if (error) throw error;

    return NextResponse.json({ customers: customers || [] });
  } catch (error: any) {
    console.error('❌ Error fetching customers:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}