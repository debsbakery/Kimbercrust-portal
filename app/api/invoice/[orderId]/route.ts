import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import PDFDocument from 'pdfkit';

export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { orderId } = params;
    
    const supabase = await createClient();
    
    // Get order with items and customer details
    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (*),
        customers (*)
      `)
      .eq('id', orderId)
      .single();  // ✅ This fixes the "cannot coerce to single json object" error
    
    if (error || !order) {
      console.error('Order fetch error:', error);
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    
    // Get AR transaction for invoice number
    const { data: arTrans } = await supabase
      .from('ar_transactions')
      .select('*')
      .eq('invoice_id', orderId)
      .maybeSingle();
    
    const invoiceNumber = `INV-${orderId.slice(0, 8).toUpperCase()}`;
    const customer = order.customers as any;
    
    // Create PDF
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    
    doc.on('data', (chunk) => chunks.push(chunk));
    
    await new Promise<void>((resolve) => {
      doc.on('end', () => resolve());
      
      // Header
      doc
        .fontSize(24)
        .fillColor('#006A4E')
        .text("Deb's Bakery", 50, 50);
      
      doc
        .fontSize(10)
        .fillColor('#000')
        .text('123 Baker Street', 50, 80)
        .text('Bakeryville, NSW 2000', 50, 95)
        .text('ABN: 12 345 678 901', 50, 110);
      
      // Invoice title
      doc
        .fontSize(20)
        .fillColor('#CE1126')
        .text('TAX INVOICE', 400, 50);
      
      doc
        .fontSize(10)
        .fillColor('#000')
        .text(`Invoice No: ${invoiceNumber}`, 400, 80)
        .text(`Date: ${new Date().toLocaleDateString('en-AU')}`, 400, 95)
        .text(`Due: ${arTrans?.due_date ? new Date(arTrans.due_date).toLocaleDateString('en-AU') : 'On receipt'}`, 400, 110);
      
      // Customer details
      doc
        .fontSize(12)
        .text('Bill To:', 50, 150);
      
      doc
        .fontSize(10)
        .text(customer?.business_name || 'N/A', 50, 170)
        .text(customer?.address || '', 50, 185)
        .text(customer?.email || '', 50, 200);
      
      if (customer?.abn) {
        doc.text(`ABN: ${customer.abn}`, 50, 215);
      }
      
      // Order details
      doc
        .fontSize(10)
        .text(`Delivery Date: ${new Date(order.delivery_date).toLocaleDateString('en-AU', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}`, 400, 150);
      
      // Line items table
      const tableTop = 260;
      
      // Table header
      doc
        .fontSize(10)
        .fillColor('#006A4E')
        .text('Description', 50, tableTop)
        .text('Qty', 300, tableTop)
        .text('Unit Price', 350, tableTop)
        .text('GST', 420, tableTop)
        .text('Total', 480, tableTop, { align: 'right' });
      
      // Horizontal line
      doc
        .strokeColor('#006A4E')
        .lineWidth(1)
        .moveTo(50, tableTop + 15)
        .lineTo(545, tableTop + 15)
        .stroke();
      
      // Line items
      let yPosition = tableTop + 25;
      let subtotal = 0;
      let gstTotal = 0;
      
      const items = order.order_items || [];
      
      items.forEach((item: any) => {
        const lineTotal = item.unit_price * item.quantity;
        const gst = item.gst_applicable ? lineTotal * 0.1 : 0;
        
        subtotal += lineTotal;
        gstTotal += gst;
        
        doc
          .fontSize(9)
          .fillColor('#000')
          .text(item.product_name, 50, yPosition, { width: 240 })
          .text(item.quantity.toString(), 300, yPosition)
          .text(`$${item.unit_price.toFixed(2)}`, 350, yPosition)
          .text(item.gst_applicable ? 'Yes' : 'No', 420, yPosition)
          .text(`$${(lineTotal + gst).toFixed(2)}`, 480, yPosition, { align: 'right' });
        
        yPosition += 20;
      });
      
      // Totals
      const totalsY = yPosition + 20;
      
      doc
        .strokeColor('#CCC')
        .lineWidth(0.5)
        .moveTo(350, totalsY)
        .lineTo(545, totalsY)
        .stroke();
      
      doc
        .fontSize(10)
        .text('Subtotal:', 350, totalsY + 10)
        .text(`$${subtotal.toFixed(2)}`, 480, totalsY + 10, { align: 'right' });
      
      doc
        .text('GST (10%):', 350, totalsY + 25)
        .text(`$${gstTotal.toFixed(2)}`, 480, totalsY + 25, { align: 'right' });
      
      doc
        .strokeColor('#006A4E')
        .lineWidth(1)
        .moveTo(350, totalsY + 40)
        .lineTo(545, totalsY + 40)
        .stroke();
      
      doc
        .fontSize(12)
        .fillColor('#CE1126')
        .text('Total:', 350, totalsY + 45)
        .text(`$${(subtotal + gstTotal).toFixed(2)}`, 480, totalsY + 45, { align: 'right' });
      
      // Payment details
      const paymentY = totalsY + 80;
      
      doc
        .fontSize(11)
        .fillColor('#006A4E')
        .text('Payment Details', 50, paymentY);
      
      doc
        .fontSize(9)
        .fillColor('#000')
        .text('Bank Transfer:', 50, paymentY + 20)
        .text('BSB: 123-456', 70, paymentY + 35)
        .text('Account: 78901234', 70, paymentY + 50)
        .text(`Reference: ${invoiceNumber}`, 70, paymentY + 65);
      
      doc
        .text('Cash or Check:', 250, paymentY + 20)
        .text('At delivery or in person', 270, paymentY + 35);
      
      // Footer
      doc
        .fontSize(8)
        .fillColor('#666')
        .text(
          'Thank you for your business!',
          50,
          750,
          { align: 'center', width: 495 }
        );
      
      doc.end();
    });
    
    const pdfBuffer = Buffer.concat(chunks);
    
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoiceNumber}.pdf"`,
      },
    });
    
  } catch (error: any) {
    console.error('Invoice generation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate invoice' },
      { status: 500 }
    );
  }
}