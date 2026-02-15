import { NextRequest, NextResponse } from 'next/server';
import { createClient } from "@/lib/supabase/server";

async function checkAdmin() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const adminEmails = ['debs_bakery@outlook.com', 'admin@allstarsbakery.com'];
    return adminEmails.includes(user.email?.toLowerCase() || '');
  } catch {
    return false;
  }
}

async function getForecastData(date: string) {
  try {
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: orders } = await supabase
      .from('orders')
      .select(`
        id, delivery_date, source, customer_id,
        items:order_items(
          product_id, product_name, quantity,
          product:products(product_number, name, unit, category)
        )
      `)
      .eq('delivery_date', date)
      .in('status', ['pending', 'confirmed', 'in_production']);

    const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const { data: standingOrders } = await supabase
      .from('standing_orders')
      .select(`
        customer_id,
        items:standing_order_items(
          product_id, quantity,
          product:products(product_number, name, unit, category)
        )
      `)
      .eq('delivery_day', dayOfWeek)
      .eq('active', true);

    const products: Record<string, any> = {};
    const customerIdsWithOrders = new Set<string>();
    let confirmedOrders = 0;
    let standingOrderProjections = 0;

    if (orders) {
      orders.forEach((order) => {
        customerIdsWithOrders.add(order.customer_id);
        confirmedOrders++;
        if (order.items) {
          order.items.forEach((item: any) => {
            const key = item.product_id;
            if (!products[key]) {
              products[key] = {
                product_number: item.product?.product_number || 0,
                product_name: item.product?.name || item.product_name,
                unit: item.product?.unit || 'unit',
                category: item.product?.category || '',
                quantity: 0,
                sources: { manual: 0, standing_order_confirmed: 0, standing_order_projected: 0, online: 0 }
              };
            }
            products[key].quantity += item.quantity;
            if (order.source === 'standing_order') products[key].sources.standing_order_confirmed += item.quantity;
            else if (order.source === 'online') products[key].sources.online += item.quantity;
            else products[key].sources.manual += item.quantity;
          });
        }
      });
    }

    if (standingOrders) {
      standingOrders.forEach((so) => {
        if (!customerIdsWithOrders.has(so.customer_id)) {
          standingOrderProjections++;
          if (so.items) {
            so.items.forEach((item: any) => {
              const key = item.product_id;
              if (!products[key]) {
                products[key] = {
                  product_number: item.product?.product_number || 0,
                  product_name: item.product?.name || 'Unknown',
                  unit: item.product?.unit || 'unit',
                  category: item.product?.category || '',
                  quantity: 0,
                  sources: { manual: 0, standing_order_confirmed: 0, standing_order_projected: 0, online: 0 }
                };
              }
              products[key].quantity += item.quantity;
              products[key].sources.standing_order_projected += item.quantity;
            });
          }
        }
      });
    }

    const productsArray = Object.values(products).sort((a: any, b: any) => a.product_number - b.product_number);
    const totalItems = productsArray.reduce((sum, p: any) => sum + p.quantity, 0);

    return {
      products: productsArray,
      totalOrders: confirmedOrders + standingOrderProjections,
      confirmedOrders,
      standingOrderProjections,
      totalItems
    };
  } catch (error) {
    console.error('❌ Error:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const isAdmin = await checkAdmin();
  if (!isAdmin) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().split('T')[0];
  const selectedDate = searchParams.get('date') || defaultDate;
  
  const data = await getForecastData(selectedDate);
  const printDate = new Date(selectedDate).toLocaleDateString('en-AU', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  });

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Production Sheet - ${printDate}</title>
  <style>
    @media print {
      @page { margin: 0.5in; }
      .no-print { display: none !important; }
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 11pt; padding: 20px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #333; padding: 10px 8px; }
    th { background-color: #006A4E; color: white; font-weight: bold; text-transform: uppercase; font-size: 10pt; }
    .header { margin-bottom: 20px; padding-bottom: 15px; border-bottom: 3px solid #006A4E; }
    .total-row { background-color: #f0f0f0; font-weight: bold; border-top: 2px solid #333; }
    .controls { padding: 20px; background: #f5f5f5; margin-bottom: 20px; border-radius: 8px; }
    .btn { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; text-decoration: none; display: inline-block; }
    .btn-primary { background: #006A4E; color: white; }
    .btn-danger { background: #CE1126; color: white; }
    .btn-secondary { background: #666; color: white; }
  </style>
</head>
<body>
  <div class="controls no-print">
    <form method="get" style="display: flex; gap: 20px; align-items: end; flex-wrap: wrap; margin-bottom: 15px;">
      <div>
        <label for="date" style="display: block; margin-bottom: 5px; font-weight: bold;">Production Date:</label>
        <input type="date" id="date" name="date" value="${selectedDate}" style="padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
      </div>
      <button type="submit" class="btn btn-primary">📅 Load Date</button>
    </form>
    <div style="display: flex; gap: 10px;">
      <button onclick="window.print()" class="btn btn-danger">🖨️ Print</button>
      <a href="/admin/production" class="btn btn-secondary">← Back</a>
    </div>
  </div>

  ${data && data.products.length > 0 ? `
    <div class="header">
      <h1 style="color: #006A4E; font-size: 24pt; margin-bottom: 5px;">🥖 Production Sheet</h1>
      <h2 style="font-size: 18pt; margin: 10px 0 0 0;">${printDate}</h2>
      <p style="margin: 5px 0;"><strong>Orders:</strong> ${data.totalOrders} (${data.confirmedOrders} confirmed${data.standingOrderProjections > 0 ? `, ${data.standingOrderProjections} standing` : ''})</p>
      <p style="margin: 5px 0;"><strong>Total Items:</strong> ${data.totalItems}</p>
      <p style="margin: 5px 0; font-size: 9pt; color: #666;">Printed: ${new Date().toLocaleString('en-AU')}</p>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 80px;">#</th>
          <th>Product</th>
          <th style="width: 100px; text-align: right;">Quantity</th>
          <th style="width: 150px;">Source</th>
          <th style="width: 80px;">Done ✓</th>
        </tr>
      </thead>
      <tbody>
        ${data.products.map((p: any) => `
          <tr>
            <td style="font-family: monospace; font-weight: bold;">#${p.product_number}</td>
            <td>
              <strong>${p.product_name}</strong>
              ${p.category ? `<br><span style="font-size: 9pt; color: #666;">${p.category}</span>` : ''}
            </td>
            <td style="text-align: right; font-size: 14pt;"><strong>${p.quantity}</strong> ${p.unit}</td>
            <td style="font-size: 9pt; line-height: 1.6;">
              ${p.sources.manual > 0 ? `✅ Manual: ${p.sources.manual}<br>` : ''}
              ${p.sources.standing_order_confirmed > 0 ? `✅ Standing: ${p.sources.standing_order_confirmed}<br>` : ''}
              ${p.sources.standing_order_projected > 0 ? `🔄 Standing (proj): ${p.sources.standing_order_projected}<br>` : ''}
              ${p.sources.online > 0 ? `🌐 Online: ${p.sources.online}` : ''}
            </td>
            <td style="text-align: center;"><input type="checkbox" style="width: 18px; height: 18px;"></td>
          </tr>
        `).join('')}
        <tr class="total-row">
          <td colspan="2" style="text-align: right; font-size: 12pt;">TOTAL ITEMS:</td>
          <td style="text-align: right; font-size: 16pt;"><strong>${data.totalItems}</strong></td>
          <td colspan="2"></td>
        </tr>
      </tbody>
    </table>

    <div style="margin-top: 40px; border-top: 1px solid #ccc; padding-top: 20px;">
      <p style="font-weight: bold; margin-bottom: 10px;">Production Notes:</p>
      <div style="border: 1px solid #ccc; min-height: 80px; padding: 10px; background: #f9f9f9;"></div>
    </div>

    <div style="margin-top: 30px; display: flex; justify-content: space-between; gap: 20px;">
      <div style="flex: 1;">
        <p style="margin-bottom: 40px;">Prepared by: _______________________</p>
        <p>Date: _______________________</p>
      </div>
      <div style="flex: 1;">
        <p style="margin-bottom: 40px;">Checked by: _______________________</p>
        <p>Date: _______________________</p>
      </div>
    </div>
  ` : `
    <div style="text-align: center; padding: 60px 20px;">
      <p style="font-size: 18px; color: #666; margin-bottom: 10px;">No production data for ${printDate}</p>
      <p style="font-size: 14px; color: #999;">Try selecting a different date or ensure there are orders/standing orders scheduled.</p>
    </div>
  `}

  <script>
    document.addEventListener('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        window.print();
      }
    });
  </script>
</body>
</html>
  `;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}