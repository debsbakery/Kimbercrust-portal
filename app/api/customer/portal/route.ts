export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - Customer portal dashboard data
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get customer profile
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', user.id)
      .single();

    if (customerError || !customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Get standing orders
    const { data: standingOrders } = await supabase
      .from('standing_orders')
      .select(`
        *,
        items:standing_order_items(
          id,
          product_id,
          product_name,
          quantity,
          products(name, price, image_url)
        )
      `)
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false });

    // Get recent orders (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentOrders } = await supabase
      .from('orders')
      .select(`
        id,
        delivery_date,
        total_amount,
        status,
        created_at,
        order_items(product_name, quantity, unit_price)
      `)
      .eq('customer_id', user.id)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    // Get AR balance
    const { data: arData } = await supabase
      .from('ar_aging')
      .select('*')
      .eq('customer_id', user.id)
      .single();

    // Get recent invoices
    const { data: invoices } = await supabase
      .from('orders')
      .select('id, delivery_date, total_amount, status, created_at')
      .eq('customer_id', user.id)
      .in('status', ['confirmed', 'delivered'])
      .order('created_at', { ascending: false })
      .limit(10);

    // Get unread notifications
    const { data: notifications } = await supabase
      .from('customer_notifications')
      .select('*')
      .eq('customer_id', user.id)
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(5);

    // Update last login
    await supabase
      .from('customers')
      .update({ last_portal_login: new Date().toISOString() })
      .eq('id', user.id);

    return NextResponse.json({
      customer: {
        id: customer.id,
        business_name: customer.business_name,
        contact_name: customer.contact_name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        payment_terms: customer.payment_terms,
        credit_limit: customer.credit_limit,
        balance: customer.balance,
      },
      standingOrders: standingOrders || [],
      recentOrders: recentOrders || [],
      arBalance: {
        current: parseFloat(arData?.current || '0'),
        days_1_30: parseFloat(arData?.days_1_30 || '0'),
        days_31_60: parseFloat(arData?.days_31_60 || '0'),
        days_61_90: parseFloat(arData?.days_61_90 || '0'),
        days_over_90: parseFloat(arData?.days_over_90 || '0'),
        total_due: parseFloat(arData?.total_due || '0'),
      },
      invoices: invoices || [],
      notifications: notifications || [],
    });
  } catch (error: any) {
    console.error('❌ Error fetching portal data:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

