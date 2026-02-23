import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { items } = await request.json();

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 });
    }

    // Get customer info
    const { data: customer } = await supabase
      .from('customers')
      .select('id, business_name, email, address, abn')
      .eq('id', user.id)
      .single();

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Get product details
    const productIds = items.map((item: any) => item.product_id);
    const { data: products } = await supabase
      .from('products')
      .select('id, name, price, unit, gst_applicable')
      .in('id', productIds);

    // Calculate totals
    let subtotal = 0;
    let gst = 0;

    const orderItems = items.map((item: any) => {
      const product = products?.find((p) => p.id === item.product_id);
      if (!product) return null;

      const itemSubtotal = item.quantity * product.price;
      const itemGst = product.gst_applicable ? itemSubtotal * 0.1 : 0;

      subtotal += itemSubtotal;
      gst += itemGst;

      return {
        product_id: product.id,
        product_name: product.name,
        quantity: item.quantity,
        unit_price: product.price,
        subtotal: itemSubtotal,
        gst_applicable: product.gst_applicable,
      };
    }).filter(Boolean);

    const total = subtotal + gst;

    // Create order
    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_id: user.id,
        customer_email: customer.email,
        customer_business_name: customer.business_name,
        customer_address: customer.address,
        customer_abn: customer.abn,
        delivery_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'pending',
        source: 'online',
        total_amount: total,
        notes: 'Ordered from usual items (shadow order)',
      })
      .select()
      .single();

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 500 });
    }

    // Create order items
    const { error: itemsError } = await supabase.from('order_items').insert(
      orderItems.map((item: any) => ({
        ...item,
        order_id: newOrder.id,
      }))
    );

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    // ✅ Send confirmation emails
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
      
      // Customer confirmation
      await fetch(`${siteUrl}/api/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: customer.email,
          subject: 'Order Confirmation - Debs Bakery',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #006A4E;">Thank you for your order!</h1>
              <p><strong>Order #${newOrder.id.slice(0, 8).toUpperCase()}</strong></p>
              <p>Delivery Date: ${new Date(newOrder.delivery_date).toLocaleDateString('en-AU', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</p>
              <p><strong>Total: $${newOrder.total_amount.toFixed(2)}</strong></p>
              <hr>
              <p>We'll send you another email when your order is out for delivery.</p>
              <p>View your order anytime in the <a href="${siteUrl}/portal">Customer Portal</a></p>
            </div>
          `,
        }),
      });

      // Admin notification
      await fetch(`${siteUrl}/api/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: 'debs_bakery@outlook.com',
          subject: `New Order from ${customer.business_name || customer.email}`,
          html: `
            <div style="font-family: Arial, sans-serif;">
              <h1>New Order Received</h1>
              <p><strong>Order #${newOrder.id.slice(0, 8).toUpperCase()}</strong></p>
              <p><strong>Customer:</strong> ${customer.business_name || 'N/A'}</p>
              <p><strong>Email:</strong> ${customer.email}</p>
              <p><strong>Delivery:</strong> ${new Date(newOrder.delivery_date).toLocaleDateString('en-AU')}</p>
              <p><strong>Total:</strong> $${newOrder.total_amount.toFixed(2)}</p>
              <hr>
              <p><a href="${siteUrl}/admin" style="background: #006A4E; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View in Admin Portal</a></p>
            </div>
          `,
        }),
      });
      
      console.log('✅ Confirmation emails sent');
    } catch (emailError) {
      console.error('⚠️ Email failed (order still created):', emailError);
    }

    return NextResponse.json({ success: true, order_id: newOrder.id });
  } catch (error: any) {
    console.error('Shadow order error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}