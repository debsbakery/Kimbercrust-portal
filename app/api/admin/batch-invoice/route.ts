import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email-sender'

export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const { delivery_date, sendEmails = false } = await request.json()

    if (!delivery_date) {
      return NextResponse.json({ 
        success: false, 
        error: 'delivery_date required' 
      }, { status: 400 })
    }

    console.log('📊 Batch invoicing for date:', delivery_date)

    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        customer_id,
        total_amount,
        delivery_date,
        invoice_number,
        created_at,
        notes,
        purchase_order_number,
        docket_number,
        customers (
          id,
          business_name,
          contact_name,
          email,
          phone,
          address,
          abn,
          payment_terms
        ),
        order_items (
          id,
          quantity,
          unit_price,
          subtotal,
          gst_applicable,
          products (
            id,
            product_code,
            name,
            description
          )
        )
      `)
      .eq('status', 'pending')
      .eq('delivery_date', delivery_date)

    if (ordersError) {
      console.error('❌ Error fetching orders:', ordersError)
      throw ordersError
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No pending orders to invoice for this date',
        invoiced: 0,
        total_amount: 0,
        emails_sent: 0
      })
    }

    console.log(`✅ Found ${orders.length} pending orders`)
    
    // 🔍 DEBUG: Log full order data
    console.log('🔍 DEBUG - First order complete data:', JSON.stringify(orders[0], null, 2))
    console.log('🔍 DEBUG - Order items:', orders[0].order_items)
    console.log('🔍 DEBUG - Customer data:', orders[0].customers)
    console.log('🔍 DEBUG - Environment check:', {
      BAKERY_BANK_BSB: process.env.BAKERY_BANK_BSB || 'MISSING',
      BAKERY_BANK_ACCOUNT: process.env.BAKERY_BANK_ACCOUNT || 'MISSING',
      BAKERY_BANK_NAME: process.env.BAKERY_BANK_NAME || 'MISSING',
      BAKERY_ADDRESS: process.env.BAKERY_ADDRESS || 'MISSING'
    })

    const arTransactions = orders.map(order => {
      const customer = order.customers as any
      const paymentTerms = customer?.payment_terms || 30
      const dueDate = new Date(delivery_date)
      dueDate.setDate(dueDate.getDate() + paymentTerms)

      return {
        customer_id: order.customer_id,
        type: 'invoice',
        amount: order.total_amount,
        amount_paid: 0,
        invoice_id: order.id,
        description: `Invoice for order ${order.id.substring(0, 8)} - ${customer?.business_name || 'Customer'}`,
        due_date: dueDate.toISOString().split('T')[0],
        created_at: new Date().toISOString()
      }
    })

    const { error: arError } = await supabase
      .from('ar_transactions')
      .insert(arTransactions)

    if (arError) {
      console.error('❌ Error creating AR transactions:', arError)
      throw arError
    }

    console.log('✅ Created AR transactions')

    const { data: updatedOrders, error: updateError } = await supabase
      .from('orders')
      .update({ 
        status: 'invoiced',
        invoiced_at: new Date().toISOString()
      })
      .in('id', orders.map(o => o.id))
      .select('id, invoice_number, customer_id')

    if (updateError) {
      console.error('❌ Error updating order statuses:', updateError)
      throw updateError
    }

    console.log('✅ Updated order statuses to invoiced')

    const totalAmount = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0)

    let emailsSent = 0
    const emailErrors: string[] = []
    
    if (sendEmails) {
      console.log('📧 Sending detailed invoice emails...')
      
      // ✅ BAKERY INFO FROM VERCEL ENV VARS
      const bakeryName = process.env.BAKERY_NAME || "Deb's Bakery"
      const bakeryEmail = process.env.BAKERY_EMAIL || 'debs_bakery@outlook.com'
      const bakeryPhone = process.env.BAKERY_PHONE || '(07) 4632 9475'
      const bakeryAddress = process.env.BAKERY_ADDRESS || '20 Mann St, Toowoomba QLD 4350'
      const bakeryABN = process.env.BAKERY_ABN || '81 067 719 439'
      const bankBSB = process.env.BAKERY_BANK_BSB || 'BSB: XXX-XXX'
      const bankAccount = process.env.BAKERY_BANK_ACCOUNT || 'Account: XXXXXXXXXX'
      const bankName = process.env.BAKERY_BANK_NAME || 'Bank Name'
      
      console.log('🏦 Using bakery details:', {
        name: bakeryName,
        email: bakeryEmail,
        phone: bakeryPhone,
        address: bakeryAddress
      })
      
      for (const order of orders) {
        try {
          const customer = order.customers as any
          
          if (!customer?.email) {
            console.warn(`  ⚠️ No email for order ${order.id}`)
            continue
          }
          
          const updatedOrder = updatedOrders?.find(u => u.id === order.id)
          const invoiceNumber = updatedOrder?.invoice_number 
            ? String(updatedOrder.invoice_number).padStart(6, '0')
            : `TEMP-${order.id.slice(0, 8).toUpperCase()}`
          
          const paymentTerms = customer.payment_terms || 30
          const dueDate = new Date(delivery_date)
          dueDate.setDate(dueDate.getDate() + paymentTerms)
          
          // ✅ CORRECT DATES - Fixed timezone handling
          const todayDate = new Date() // Today (invoice generation date)
          const orderCreatedDate = new Date(order.created_at) // When order was placed
          const deliveryDateObj = new Date(delivery_date + 'T00:00:00') // Delivery date (force local timezone)

          console.log('📅 Date Debug:', {
            today: todayDate.toLocaleDateString('en-AU'),
            orderCreated: orderCreatedDate.toLocaleDateString('en-AU'),
            delivery: deliveryDateObj.toLocaleDateString('en-AU'),
            delivery_date_raw: delivery_date
          })
          
          // Calculate totals
          const subtotal = (order.order_items as any[]).reduce((sum, item) => sum + (item.subtotal || 0), 0)
          const gstTotal = (order.order_items as any[]).reduce((sum, item) => {
            const hasGST = item.gst_applicable !== false
            return sum + (hasGST ? (item.subtotal || 0) * 0.1 : 0)
          }, 0)
          const total = subtotal + gstTotal
          
          console.log(`💰 Invoice ${invoiceNumber}: ${order.order_items?.length} items, Total=$${total.toFixed(2)}`)
          
          // Build line items HTML
          const lineItemsHtml = (order.order_items as any[])
            .map(item => {
              const product = item.products || {}
              const hasGST = item.gst_applicable !== false
              
              return `
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #ddd;">${product.product_code || 'N/A'}</td>
                  <td style="padding: 10px; border-bottom: 1px solid #ddd;">${product.name || 'Unknown Product'}</td>
                  <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center;">${item.quantity}</td>
                  <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">$${(item.unit_price || 0).toFixed(2)}</td>
                  <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center;">${hasGST ? 'Yes' : 'No'}</td>
                  <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right; font-weight: bold;">$${(item.subtotal || 0).toFixed(2)}</td>
                </tr>
              `
            })
            .join('')
          
          const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://debsbakery-portal.vercel.app'
          
          const emailHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 700px; margin: 0 auto; }
    .header { background: #006A4E; color: white; padding: 30px; text-align: center; }
    .content { padding: 30px; background: #f9f9f9; }
    .card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .invoice-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .invoice-table th { background: #333; color: white; padding: 12px; text-align: left; font-size: 13px; }
    .invoice-table td { padding: 10px; border-bottom: 1px solid #ddd; font-size: 13px; }
    .totals { text-align: right; margin: 20px 0; }
    .totals-row { margin: 8px 0; font-size: 14px; }
    .total-grand { font-size: 1.3em; font-weight: bold; color: #CE1126; padding-top: 10px; border-top: 2px solid #333; margin-top: 10px; }
    .btn { display: inline-block; background: #006A4E; color: white; padding: 14px 28px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 8px; }
    .btn-secondary { background: #CE1126; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 13px; border-top: 1px solid #ddd; margin-top: 30px; }
    .reference-box { background: #f8f9fa; padding: 10px; border-left: 4px solid #006A4E; margin: 10px 0; }
    .bakery-details { background: #f0fdf4; padding: 15px; border-radius: 5px; margin: 10px 0; font-size: 13px; }
    .payment-box { background: #f0fdf4; padding: 20px; border-radius: 8px; border-left: 4px solid #16a34a; }
    .bank-details { background: white; padding: 15px; border-radius: 5px; margin: 10px 0; border: 1px solid #ddd; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 32px;">🥖 ${bakeryName}</h1>
      <p style="margin: 10px 0 0 0; font-size: 18px;">Tax Invoice</p>
      <div class="bakery-details">
        <p style="margin: 3px 0;">${bakeryAddress}</p>
        <p style="margin: 3px 0;">📧 ${bakeryEmail} | 📞 ${bakeryPhone}</p>
        <p style="margin: 3px 0;"><strong>ABN:</strong> ${bakeryABN}</p>
      </div>
    </div>
    
    <div class="content">
      <div class="card">
        <h2 style="color: #006A4E; margin-top: 0;">Invoice #${invoiceNumber}</h2>
        
        ${order.purchase_order_number || order.docket_number ? `
        <div class="reference-box">
          ${order.purchase_order_number ? `<p style="margin: 5px 0;"><strong>📋 PO Number:</strong> ${order.purchase_order_number}</p>` : ''}
          ${order.docket_number ? `<p style="margin: 5px 0;"><strong>🧾 Docket Number:</strong> ${order.docket_number}</p>` : ''}
        </div>
        ` : ''}
        
        <table style="width: 100%; margin-top: 20px;">
          <tr>
            <td style="width: 50%; vertical-align: top;">
              <p style="margin: 5px 0;"><strong>Bill To:</strong></p>
              <p style="margin: 5px 0; font-size: 15px; font-weight: bold;">${customer.business_name || 'N/A'}</p>
              ${customer.contact_name ? `<p style="margin: 5px 0;">Attn: ${customer.contact_name}</p>` : ''}
              ${customer.address ? `<p style="margin: 5px 0;">${customer.address}</p>` : ''}
              ${customer.phone ? `<p style="margin: 5px 0;">📞 ${customer.phone}</p>` : ''}
              ${customer.abn ? `<p style="margin: 5px 0;"><strong>ABN:</strong> ${customer.abn}</p>` : ''}
            </td>
            <td style="width: 50%; vertical-align: top; text-align: right;">
              <p style="margin: 5px 0;"><strong>Order Date:</strong> ${orderCreatedDate.toLocaleDateString('en-AU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              })}</p>
              <p style="margin: 5px 0;"><strong>Invoice Date:</strong> ${todayDate.toLocaleDateString('en-AU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              })}</p>
              <p style="margin: 5px 0;"><strong>Delivery Date:</strong> ${deliveryDateObj.toLocaleDateString('en-AU', {
                weekday: 'long',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              })}</p>
              <p style="margin: 5px 0;"><strong>Payment Due:</strong> ${dueDate.toLocaleDateString('en-AU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              })}</p>
              <p style="margin: 5px 0; color: #666;">(${paymentTerms} days)</p>
            </td>
          </tr>
        </table>
      </div>

      ${order.notes ? `
      <div class="card" style="background: #fffbeb; border-left: 4px solid #f59e0b;">
        <p style="margin: 0; font-weight: bold; color: #92400e;">📝 Order Notes:</p>
        <p style="margin: 10px 0 0 0;">${order.notes}</p>
      </div>
      ` : ''}

      <div class="card">
        <h3 style="margin-top: 0;">Order Details</h3>
        <table class="invoice-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Product</th>
              <th style="text-align: center;">Qty</th>
              <th style="text-align: right;">Unit Price</th>
              <th style="text-align: center;">GST</th>
              <th style="text-align: right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${lineItemsHtml}
          </tbody>
        </table>

        <div class="totals">
          <div class="totals-row">
            <strong>Subtotal:</strong> $${subtotal.toFixed(2)}
          </div>
          <div class="totals-row">
            <strong>GST (10%):</strong> $${gstTotal.toFixed(2)}
          </div>
          <div class="totals-row total-grand">
            <strong>TOTAL:</strong> $${total.toFixed(2)}
          </div>
        </div>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${siteUrl}/api/invoice/${order.id}" target="_blank" rel="noopener" class="btn">
          👁️ View Invoice Online
        </a>
        <a href="${siteUrl}/api/invoice/${order.id}?download=true" download="invoice-${invoiceNumber}.pdf" class="btn btn-secondary">
          📥 Download PDF
        </a>
      </div>

      <div class="payment-box">
        <h3 style="margin-top: 0; color: #166534;">💳 Payment Information</h3>
        
        <div class="bank-details">
          <p style="margin: 5px 0; font-weight: bold; font-size: 15px;">Bank Transfer Details:</p>
          <p style="margin: 5px 0;"><strong>Bank:</strong> ${bankName}</p>
          <p style="margin: 5px 0;"><strong>BSB:</strong> ${bankBSB}</p>
          <p style="margin: 5px 0;"><strong>Account:</strong> ${bankAccount}</p>
          <p style="margin: 5px 0;"><strong>Reference:</strong> ${invoiceNumber}</p>
        </div>
        
        <p style="margin: 15px 0 5px 0;"><strong>Other Payment Methods:</strong></p>
        <ul style="line-height: 2; margin: 5px 0;">
          <li>Cash or Cheque at delivery</li>
          <li>In person at ${bakeryAddress}</li>
        </ul>
        
        <p style="margin: 15px 0 0 0; padding: 15px; background: white; border-radius: 5px; border-left: 4px solid #16a34a;">
          <strong>📅 Payment Due:</strong> ${dueDate.toLocaleDateString('en-AU', {
            weekday: 'long',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          })}
        </p>
      </div>

      <div class="footer">
        <p style="margin: 5px 0;"><strong>${bakeryName}</strong></p>
        <p style="margin: 5px 0;">${bakeryAddress}</p>
        <p style="margin: 5px 0;">📧 ${bakeryEmail} | 📞 ${bakeryPhone}</p>
        <p style="margin: 5px 0;"><strong>ABN:</strong> ${bakeryABN}</p>
        <p style="margin: 15px 0 5px 0; font-size: 11px; color: #999;">
          This is a Tax Invoice for GST purposes. Total includes GST of $${gstTotal.toFixed(2)} where applicable.
        </p>
        <p style="margin: 5px 0; font-size: 11px; color: #999;">
          Generated: ${todayDate.toLocaleString('en-AU')}
        </p>
      </div>
    </div>
  </div>
</body>
</html>`
          
          console.log(`📧 Sending to ${customer.email}...`)
          
          await sendEmail({
            to: customer.email,
            subject: `Invoice ${invoiceNumber} - ${bakeryName}`,
            html: emailHtml,
          })
          
          emailsSent++
          console.log(`  ✅ Sent successfully`)
        } catch (emailError: any) {
          const custEmail = (order.customers as any)?.email || 'unknown'
          console.error(`  ❌ Failed:`, emailError.message)
          emailErrors.push(`${custEmail}: ${emailError.message}`)
        }
      }
      
      console.log(`✅ Batch complete: ${emailsSent}/${orders.length} sent`)
    }

    return NextResponse.json({ 
      success: true, 
      invoiced: orders.length,
      total_amount: totalAmount,
      emails_sent: emailsSent,
      email_errors: emailErrors.length > 0 ? emailErrors : undefined,
      date: delivery_date
    })

  } catch (error: any) {
    console.error('❌ Batch invoice error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to process batch invoice' 
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    let query = supabase
      .from('orders')
      .select(`delivery_date, status, total_amount`)
      .eq('status', 'pending')
      .order('delivery_date')

    if (startDate) query = query.gte('delivery_date', startDate)
    if (endDate) query = query.lte('delivery_date', endDate)

    const { data: orders, error } = await query

    if (error) throw error

    const grouped = (orders || []).reduce((acc: any, order) => {
      const date = order.delivery_date
      if (!acc[date]) {
        acc[date] = { delivery_date: date, count: 0, total_amount: 0 }
      }
      acc[date].count += 1
      acc[date].total_amount += order.total_amount || 0
      return acc
    }, {})

    return NextResponse.json({ 
      success: true, 
      pending_by_date: Object.values(grouped)
    })
  } catch (error: any) {
    console.error('❌ GET error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}