import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email-sender';

export async function POST(request: NextRequest) {
  try {
    const { orderId } = await request.json();
    
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID required' }, { status: 400 });
    }
    
    const supabase = await createClient();
    
    // Get order details
    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items(*),
        customers(*)
      `)
      .eq('id', orderId)
      .single();
    
    if (error || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    
    const customer = order.customers as any;
    const invoiceNumber = `INV-${orderId.slice(0, 8).toUpperCase()}`;
    
    // Get AR transaction for due date
    const { data: arTrans } = await supabase
      .from('ar_transactions')
      .select('due_date')
      .eq('invoice_id', orderId)
      .single();
    
    const paymentTerms = customer?.payment_terms || 30;
    const dueDate = arTrans?.due_date || new Date(Date.now() + paymentTerms * 24 * 60 * 60 * 1000);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://debsbakery-portal.vercel.app';
    
    await sendEmail({
      to: customer.email,
      subject: `Invoice ${invoiceNumber} - Debs Bakery`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #006A4E; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">Deb's Bakery</h1>
            <p style="margin: 5px 0 0 0;">Tax Invoice</p>
          </div>
          
          <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #006A4E; margin-top: 0;">Invoice ${invoiceNumber}</h2>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Customer:</strong> ${customer.business_name || customer.email}</p>
              <p><strong>Delivery Date:</strong> ${new Date(order.delivery_date).toLocaleDateString('en-AU', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}</p>
              <p style="font-size: 1.2em; margin-top: 20px;">
                <strong>Total Amount:</strong> 
                <span style="color: #CE1126; font-size: 1.3em;">$${order.total_amount.toFixed(2)}</span>
              </p>
              <p><strong>Payment Due:</strong> ${new Date(dueDate).toLocaleDateString('en-AU', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${siteUrl}/api/invoice/${orderId}" 
                 style="background: #CE1126; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                📄 Download Invoice PDF
              </a>
            </div>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Payment Options:</h3>
              <ul style="line-height: 1.8;">
                <li><strong>Bank Transfer:</strong> BSB 123-456, Account 78901234</li>
                <li><strong>Cash/Check:</strong> At delivery or in person</li>
                <li><strong>Reference:</strong> ${invoiceNumber}</li>
              </ul>
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 0.9em; color: #666; text-align: center;">
              <p>Questions? Contact us at ${process.env.BAKERY_EMAIL || 'debs_bakery@outlook.com'}</p>
              <p>Phone: ${process.env.BAKERY_PHONE || '(04) 1234-5678'}</p>
            </div>
          </div>
        </div>
      `,
    });
    
    console.log(`✅ Invoice email sent: ${invoiceNumber} to ${customer.email}`);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Invoice sent successfully' 
    });
    
  } catch (error: any) {
    console.error('❌ Invoice email error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}