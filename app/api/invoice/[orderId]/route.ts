import { createClient } from "@/lib/supabase/server";
import { generateInvoice } from "@/lib/invoice";
import { NextRequest, NextResponse } from "next/server";
import { OrderWithItems } from "@/lib/types";

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  const startTime = Date.now();
  
  try {
    const { orderId } = await context.params;
    
    console.log("📄 Generating invoice for order:", orderId);

    const supabase = await createClient();

    // ✅ Complete query with all required fields
    const { data: order, error } = await supabase
      .from("orders")
      .select(`
        id,
        customer_id,
        status,
        invoice_number,
        customer_email,
        customer_business_name,
        customer_address,
        customer_abn,
        delivery_date,
        total_amount,
        notes,
        source,
        copied_from_order_id,
        created_at,
        updated_at,
        invoiced_at,
        po_number,
        docket_number,
        order_items (
          id,
          order_id,
          product_id,
          product_name,
          quantity,
          unit_price,
          subtotal,
          gst_applicable,
          created_at
        ),
        customers (
          business_name,
          email,
          address,
          abn
        )
      `)
      .eq("id", orderId)
      .maybeSingle();

    console.log(`⏱️ Query: ${Date.now() - startTime}ms`);

    if (error) {
      console.error("🔴 Database error:", error);
      return NextResponse.json({ 
        error: 'Database error',
        details: error.message 
      }, { status: 500 });
    }

    if (!order) {
      console.error("🔴 Order not found:", orderId);
      return new NextResponse(
        `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Invoice Not Found</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { 
                font-family: Arial, sans-serif; 
                max-width: 600px; 
                margin: 100px auto; 
                text-align: center;
                padding: 20px;
              }
              h1 { color: #CE1126; }
              .order-id { 
                background: #f5f5f5; 
                padding: 10px; 
                border-radius: 5px;
                word-break: break-all;
                font-family: monospace;
                margin: 20px 0;
              }
              a { 
                display: inline-block;
                margin-top: 20px;
                padding: 10px 20px;
                background: #006A4E;
                color: white;
                text-decoration: none;
                border-radius: 5px;
              }
            </style>
          </head>
          <body>
            <h1>❌ Invoice Not Found</h1>
            <p>The order you're trying to view doesn't exist or has been deleted.</p>
            <div class="order-id">Order ID: ${orderId}</div>
            <p>If you believe this is an error, please contact us:</p>
            <p>📧 ${process.env.BAKERY_EMAIL || 'debs_bakery@outlook.com'}<br>
            📞 ${process.env.BAKERY_PHONE || '(04) 1234-5678'}</p>
            <a href="/portal">Return to Portal</a>
          </body>
        </html>
        `,
        {
          status: 404,
          headers: { 'Content-Type': 'text/html' }
        }
      );
    }

    console.log("✅ Order found with", order.order_items?.length || 0, "items");

    const pdfStartTime = Date.now();
    
    // ✅ Generate PDF - now with correct type
    const pdf = await generateInvoice({
      order: order as OrderWithItems,
      bakeryInfo: {
        name: process.env.BAKERY_NAME || "Deb's Bakery",
        email: process.env.BAKERY_EMAIL || "debs_bakery@outlook.com",
        phone: process.env.BAKERY_PHONE || "(04) 1234-5678",
        address: process.env.BAKERY_ADDRESS || "Melbourne, Australia",
        abn: process.env.BAKERY_ABN,
      },
    });

    console.log(`⏱️ PDF generation: ${Date.now() - pdfStartTime}ms`);

    const invoiceNumber = order.invoice_number 
      ? String(order.invoice_number).padStart(6, '0')
      : `TEMP-${orderId.slice(0, 8).toUpperCase()}`;

    const pdfBuffer = Buffer.from(pdf.output('arraybuffer'));
    
    console.log(`⏱️ Total time: ${Date.now() - startTime}ms`);
    
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="invoice-${invoiceNumber}.pdf"`,
        'Cache-Control': 'public, max-age=3600',
      },
    });

  } catch (error: any) {
    console.error("🔴 Invoice error:", error);
    console.error(`⏱️ Failed after: ${Date.now() - startTime}ms`);
    
    return new NextResponse(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice Generation Error</title>
          <meta charset="utf-8">
          <style>
            body { 
              font-family: Arial, sans-serif; 
              max-width: 600px; 
              margin: 100px auto; 
              padding: 20px;
            }
            h1 { color: #CE1126; }
            .error { 
              background: #fee; 
              border: 1px solid #fcc;
              padding: 15px; 
              border-radius: 5px;
              margin: 20px 0;
              text-align: left;
              font-family: monospace;
              font-size: 12px;
              overflow-x: auto;
            }
          </style>
        </head>
        <body>
          <h1>⚠️ Invoice Generation Failed</h1>
          <p>An error occurred while generating the invoice:</p>
          <div class="error">${error.message}</div>
          <p>Please contact support:</p>
          <p>📧 ${process.env.BAKERY_EMAIL || 'debs_bakery@outlook.com'}</p>
        </body>
      </html>
      `,
      {
        status: 500,
        headers: { 'Content-Type': 'text/html' }
      }
    );
  }
}