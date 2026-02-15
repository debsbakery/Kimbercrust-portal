import { NextRequest, NextResponse } from 'next/server';

async function createServiceClient() {
  const { createClient } = await import('@supabase/supabase-js');
  
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || new Date().toISOString().split('T')[0];
    const days = parseInt(searchParams.get('days') || '7');
    const includeHistorical = searchParams.get('includeHistorical') !== 'false'; // Default true

    const supabase = await createServiceClient();

    // Calculate date ranges
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + days);
    const endDate = end.toISOString().split('T')[0];

    // Calculate historical lookback period (get last 4 weeks for pattern analysis)
    const historicalStart = new Date(start);
    historicalStart.setDate(historicalStart.getDate() - 28); // 4 weeks back
    const historicalStartDate = historicalStart.toISOString().split('T')[0];

    console.log(`📊 Generating forecast from ${startDate} to ${endDate}`);
    if (includeHistorical) {
      console.log(`📈 Including historical data from ${historicalStartDate}`);
    }

    // === FETCH ALL DATA ===

    // 1. Get confirmed/pending orders within forecast range
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        delivery_date,
        status,
        source,
        customer_id,
        customer_business_name,
        items:order_items(
          id,
          product_id,
          product_name,
          quantity,
          product:products(
            id,
            product_number,
            name,
            unit,
            category
          )
        )
      `)
      .gte('delivery_date', startDate)
      .lte('delivery_date', endDate)
      .in('status', ['pending', 'confirmed', 'in_production', 'delivered'])
      .order('delivery_date');

    if (ordersError) throw ordersError;

    // 2. Get historical orders (last 4 weeks)
    let historicalOrders: any[] = [];
    if (includeHistorical) {
      const { data: histOrders, error: histError } = await supabase
        .from('orders')
        .select(`
          id,
          delivery_date,
          customer_id,
          customer_business_name,
          items:order_items(
            id,
            product_id,
            product_name,
            quantity,
            product:products(
              id,
              product_number,
              name,
              unit,
              category
            )
          )
        `)
        .gte('delivery_date', historicalStartDate)
        .lt('delivery_date', startDate)
        .in('status', ['confirmed', 'in_production', 'delivered'])
        .order('delivery_date', { ascending: false });

      if (!histError) {
        historicalOrders = histOrders || [];
      }
    }

    // 3. Get active standing orders
    const { data: standingOrders, error: standingError } = await supabase
      .from('standing_orders')
      .select(`
        id,
        delivery_day,
        customer_id,
        customer:customers(id, business_name),
        items:standing_order_items(
          id,
          product_id,
          quantity,
          product:products(
            id,
            product_number,
            name,
            unit,
            category
          )
        )
      `)
      .eq('active', true);

    if (standingError) throw standingError;

    // 4. Get all customers (to forecast for everyone)
    const { data: allCustomers, error: customersError } = await supabase
      .from('customers')
      .select('id, business_name')
      .order('business_name');

    if (customersError) throw customersError;

    // === BUILD FORECAST ===

    const forecast: any = {};
    const productSummary: any = {};
    
    // Track which customers have been forecasted for each date
    const customersForecastedPerDate: Record<string, Map<string, string>> = {}; // date -> customer_id -> source

    // === STEP 1: Process confirmed orders (HIGHEST PRIORITY) ===
    orders?.forEach((order: any) => {
      const date = order.delivery_date;
      
      if (!forecast[date]) {
        forecast[date] = {
          date,
          dayOfWeek: new Date(date).toLocaleDateString('en-AU', { weekday: 'long' }),
          products: {},
          totalOrders: 0,
          totalItems: 0,
          confirmedOrders: 0,
          standingOrderProjections: 0,
          historicalProjections: 0,
          customers: new Set(),
        };
      }

      if (!customersForecastedPerDate[date]) {
        customersForecastedPerDate[date] = new Map();
      }

      // Mark this customer as forecasted (confirmed order)
      customersForecastedPerDate[date].set(order.customer_id, 'confirmed');
      forecast[date].customers.add(order.customer_id);
      forecast[date].confirmedOrders += 1;

      order.items?.forEach((item: any) => {
        const productId = item.product_id;
        const productKey = `${productId}`;

        if (!forecast[date].products[productKey]) {
          forecast[date].products[productKey] = {
            product_id: productId,
            product_number: item.product?.product_number,
            product_name: item.product?.name || item.product_name,
            unit: item.product?.unit,
            category: item.product?.category,
            quantity: 0,
            confirmed_quantity: 0,
            standing_order_quantity: 0,
            historical_quantity: 0,
            sources: { 
              manual: 0, 
              standing_order_confirmed: 0,
              standing_order_projected: 0, 
              historical_projected: 0,
              online: 0 
            },
          };
        }

        forecast[date].products[productKey].quantity += item.quantity;
        forecast[date].products[productKey].confirmed_quantity += item.quantity;
        
        // Track source
        if (order.source === 'standing_order') {
          forecast[date].products[productKey].sources.standing_order_confirmed += item.quantity;
        } else if (order.source === 'online') {
          forecast[date].products[productKey].sources.online += item.quantity;
        } else {
          forecast[date].products[productKey].sources.manual += item.quantity;
        }
        
        forecast[date].totalItems += item.quantity;

        // Update product summary
        updateProductSummary(productSummary, productKey, item, 'confirmed');
      });
    });

    // === STEP 2: Add standing order projections (MEDIUM PRIORITY) ===
    const currentDate = new Date(startDate);
    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayOfWeek = currentDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

      if (!forecast[dateStr]) {
        forecast[dateStr] = {
          date: dateStr,
          dayOfWeek: currentDate.toLocaleDateString('en-AU', { weekday: 'long' }),
          products: {},
          totalOrders: 0,
          totalItems: 0,
          confirmedOrders: 0,
          standingOrderProjections: 0,
          historicalProjections: 0,
          customers: new Set(),
        };
      }

      if (!customersForecastedPerDate[dateStr]) {
        customersForecastedPerDate[dateStr] = new Map();
      }

      // Find standing orders for this day
      standingOrders?.forEach((so: any) => {
        if (so.delivery_day === dayOfWeek) {
          // Only add if customer hasn't placed a confirmed order
          if (!customersForecastedPerDate[dateStr].has(so.customer_id)) {
            customersForecastedPerDate[dateStr].set(so.customer_id, 'standing_order');
            forecast[dateStr].standingOrderProjections += 1;
            forecast[dateStr].customers.add(so.customer_id);
            
            so.items?.forEach((item: any) => {
              const productId = item.product_id;
              const productKey = `${productId}`;

              if (!forecast[dateStr].products[productKey]) {
                forecast[dateStr].products[productKey] = {
                  product_id: productId,
                  product_number: item.product?.product_number,
                  product_name: item.product?.name,
                  unit: item.product?.unit,
                  category: item.product?.category,
                  quantity: 0,
                  confirmed_quantity: 0,
                  standing_order_quantity: 0,
                  historical_quantity: 0,
                  sources: { 
                    manual: 0, 
                    standing_order_confirmed: 0,
                    standing_order_projected: 0, 
                    historical_projected: 0,
                    online: 0 
                  },
                };
              }

              forecast[dateStr].products[productKey].quantity += item.quantity;
              forecast[dateStr].products[productKey].standing_order_quantity += item.quantity;
              forecast[dateStr].products[productKey].sources.standing_order_projected += item.quantity;
              forecast[dateStr].totalItems += item.quantity;

              updateProductSummary(productSummary, productKey, item, 'standing_order');
            });
          }
        }
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // === STEP 3: Add historical projections (LOWEST PRIORITY) ===
    if (includeHistorical && historicalOrders.length > 0) {
      // Build historical patterns map: customer_id -> day_of_week -> items[]
      const historicalPatterns: Map<string, Map<string, any[]>> = new Map();

      historicalOrders.forEach((order: any) => {
        const orderDate = new Date(order.delivery_date);
        const orderDayOfWeek = orderDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        const customerId = order.customer_id;

        if (!historicalPatterns.has(customerId)) {
          historicalPatterns.set(customerId, new Map());
        }

        const customerPatterns = historicalPatterns.get(customerId)!;
        if (!customerPatterns.has(orderDayOfWeek)) {
          customerPatterns.set(orderDayOfWeek, []);
        }

        customerPatterns.get(orderDayOfWeek)!.push(order);
      });

      // Apply historical forecasts
      const forecastDate = new Date(startDate);
      while (forecastDate <= end) {
        const dateStr = forecastDate.toISOString().split('T')[0];
        const dayOfWeek = forecastDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

        if (!forecast[dateStr]) {
          forecast[dateStr] = {
            date: dateStr,
            dayOfWeek: forecastDate.toLocaleDateString('en-AU', { weekday: 'long' }),
            products: {},
            totalOrders: 0,
            totalItems: 0,
            confirmedOrders: 0,
            standingOrderProjections: 0,
            historicalProjections: 0,
            customers: new Set(),
          };
        }

        if (!customersForecastedPerDate[dateStr]) {
          customersForecastedPerDate[dateStr] = new Map();
        }

        // Check each customer for historical pattern
        allCustomers?.forEach((customer: any) => {
          // Skip if already forecasted
          if (customersForecastedPerDate[dateStr].has(customer.id)) {
            return;
          }

          // Check if this customer has a pattern for this day
          if (historicalPatterns.has(customer.id)) {
            const customerPatterns = historicalPatterns.get(customer.id)!;
            if (customerPatterns.has(dayOfWeek)) {
              const dayOrders = customerPatterns.get(dayOfWeek)!;
              
              // Use most recent order for this day (already sorted descending)
              const mostRecentOrder = dayOrders[0];

              customersForecastedPerDate[dateStr].set(customer.id, 'historical');
              forecast[dateStr].historicalProjections += 1;
              forecast[dateStr].customers.add(customer.id);

              mostRecentOrder.items?.forEach((item: any) => {
                const productId = item.product_id;
                const productKey = `${productId}`;

                if (!forecast[dateStr].products[productKey]) {
                  forecast[dateStr].products[productKey] = {
                    product_id: productId,
                    product_number: item.product?.product_number,
                    product_name: item.product?.name || item.product_name,
                    unit: item.product?.unit,
                    category: item.product?.category,
                    quantity: 0,
                    confirmed_quantity: 0,
                    standing_order_quantity: 0,
                    historical_quantity: 0,
                    sources: { 
                      manual: 0, 
                      standing_order_confirmed: 0,
                      standing_order_projected: 0, 
                      historical_projected: 0,
                      online: 0 
                    },
                  };
                }

                forecast[dateStr].products[productKey].quantity += item.quantity;
                forecast[dateStr].products[productKey].historical_quantity += item.quantity;
                forecast[dateStr].products[productKey].sources.historical_projected += item.quantity;
                forecast[dateStr].totalItems += item.quantity;

                updateProductSummary(productSummary, productKey, item, 'historical');
              });
            }
          }
        });

        forecastDate.setDate(forecastDate.getDate() + 1);
      }
    }

    // Calculate totals for each day
    Object.values(forecast).forEach((day: any) => {
      day.totalOrders = day.confirmedOrders + day.standingOrderProjections + day.historicalProjections;
      day.customers = Array.from(day.customers);
    });

    // Calculate product summary averages
    Object.values(productSummary).forEach((product: any) => {
      const daysOrdered = Object.keys(forecast).filter(date => 
        forecast[date].products[product.product_id]
      ).length;
      product.days_ordered = daysOrdered;
      product.avg_daily = daysOrdered > 0 ? product.total_quantity / daysOrdered : 0;
    });

    // Convert to arrays and sort
    const forecastArray = Object.values(forecast).sort((a: any, b: any) => 
      a.date.localeCompare(b.date)
    );

    const productSummaryArray = Object.values(productSummary).sort((a: any, b: any) => 
      b.total_quantity - a.total_quantity
    );

    console.log(`✅ Forecast generated: ${forecastArray.length} days, ${productSummaryArray.length} products`);

    return NextResponse.json({
      forecast: forecastArray,
      productSummary: productSummaryArray,
      dateRange: { start: startDate, end: endDate },
      stats: {
        totalDays: forecastArray.length,
        totalProducts: productSummaryArray.length,
        totalConfirmedOrders: forecastArray.reduce((sum: number, day: any) => sum + day.confirmedOrders, 0),
        totalStandingOrderProjections: forecastArray.reduce((sum: number, day: any) => sum + day.standingOrderProjections, 0),
        totalHistoricalProjections: forecastArray.reduce((sum: number, day: any) => sum + day.historicalProjections, 0),
        historicalDataIncluded: includeHistorical,
      },
    });

  } catch (error: any) {
    console.error('❌ Error generating forecast:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate forecast' },
      { status: 500 }
    );
  }
}

// Helper function to update product summary
function updateProductSummary(productSummary: any, productKey: string, item: any, source: 'confirmed' | 'standing_order' | 'historical') {
  if (!productSummary[productKey]) {
    productSummary[productKey] = {
      product_id: item.product_id,
      product_number: item.product?.product_number,
      product_name: item.product?.name || item.product_name,
      unit: item.product?.unit,
      category: item.product?.category,
      total_quantity: 0,
      confirmed_quantity: 0,
      standing_order_quantity: 0,
      historical_quantity: 0,
      days_ordered: 0,
      avg_daily: 0,
    };
  }

  productSummary[productKey].total_quantity += item.quantity;
  
  if (source === 'confirmed') {
    productSummary[productKey].confirmed_quantity += item.quantity;
  } else if (source === 'standing_order') {
    productSummary[productKey].standing_order_quantity += item.quantity;
  } else if (source === 'historical') {
    productSummary[productKey].historical_quantity += item.quantity;
  }
}