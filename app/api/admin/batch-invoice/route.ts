import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const { delivery_date } = await request.json()

    if (!delivery_date) {
      return NextResponse.json({ 
        success: false, 
        error: 'delivery_date required' 
      }, { status: 400 })
    }

    console.log('📊 Batch invoicing for date:', delivery_date)

    // Get all pending orders for this delivery date
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        customer_id,
        total_amount,
        delivery_date,
        customers (
          business_name,
          email,
          payment_terms
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
        total_amount: 0
      })
    }

    console.log(`✅ Found ${orders.length} pending orders`)

    // Calculate due dates based on payment terms
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

    // Insert AR transactions
    const { error: arError } = await supabase
      .from('ar_transactions')
      .insert(arTransactions)

    if (arError) {
      console.error('❌ Error creating AR transactions:', arError)
      throw arError
    }

    console.log('✅ Created AR transactions')

    // Update order statuses to 'invoiced'
    const { error: updateError } = await supabase
      .from('orders')
      .update({ 
        status: 'invoiced',
        invoiced_at: new Date().toISOString()
      })
      .in('id', orders.map(o => o.id))

    if (updateError) {
      console.error('❌ Error updating order statuses:', updateError)
      throw updateError
    }

    console.log('✅ Updated order statuses to invoiced')

    const totalAmount = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0)

    return NextResponse.json({ 
      success: true, 
      invoiced: orders.length,
      total_amount: totalAmount,
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

// GET: Get pending orders summary by date
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
      .select(`
        delivery_date,
        status,
        total_amount
      `)
      .eq('status', 'pending')
      .order('delivery_date')

    if (startDate) query = query.gte('delivery_date', startDate)
    if (endDate) query = query.lte('delivery_date', endDate)

    const { data: orders, error } = await query

    if (error) throw error

    // Group by delivery date
    const grouped = (orders || []).reduce((acc: any, order) => {
      const date = order.delivery_date
      if (!acc[date]) {
        acc[date] = {
          delivery_date: date,
          count: 0,
          total_amount: 0
        }
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