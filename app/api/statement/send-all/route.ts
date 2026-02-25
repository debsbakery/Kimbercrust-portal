export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateStatementPDF } from '@/lib/pdf/statement'
import { Resend } from 'resend'
import pLimit from 'p-limit'

const resend = new Resend(process.env.RESEND_API_KEY)

// Process 3 customers concurrently — balances Resend rate limits vs speed
const limit = pLimit(3)

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const endDate = new Date().toISOString().split('T')[0]
    const startDate = new Date(new Date().setMonth(new Date().getMonth() - 3))
      .toISOString()
      .split('T')[0]

    // Single query: customers with balance + email
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('id, email, business_name, balance, address, payment_terms')
      .gt('balance', 0)
      .not('email', 'is', null)

    if (customersError) {
      return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 })
    }

    if (!customers || customers.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        failed: 0,
        message: 'No customers with outstanding balances and email addresses',
      })
    }

    // Batch-fetch ALL orders and payments in 2 queries instead of N*4
    const customerIds = customers.map(c => c.id)

    const [
      { data: allOrders },
      { data: allPayments },
      { data: allPriorOrders },
      { data: allPriorPayments },
    ] = await Promise.all([
      supabase
        .from('orders')
        .select('id, order_number, delivery_date, total_amount, status, customer_id')
        .in('customer_id', customerIds)
        .gte('delivery_date', startDate)
        .lte('delivery_date', endDate)
        .order('delivery_date', { ascending: true }),

      supabase
        .from('payments')
        .select('id, payment_date, amount, payment_method, reference_number, customer_id')
        .in('customer_id', customerIds)
        .gte('payment_date', startDate)
        .lte('payment_date', endDate)
        .order('payment_date', { ascending: true }),

      supabase
        .from('orders')
        .select('total_amount, customer_id')
        .in('customer_id', customerIds)
        .lt('delivery_date', startDate),

      supabase
        .from('payments')
        .select('amount, customer_id')
        .in('customer_id', customerIds)
        .lt('payment_date', startDate),
    ])

    // Group by customer_id for O(1) lookup
    const ordersByCustomer = groupBy(allOrders ?? [], 'customer_id')
    const paymentsByCustomer = groupBy(allPayments ?? [], 'customer_id')
    const priorOrdersByCustomer = groupBy(allPriorOrders ?? [], 'customer_id')
    const priorPaymentsByCustomer = groupBy(allPriorPayments ?? [], 'customer_id')

    let sent = 0
    let failed = 0
    const errors: string[] = []

    // Process concurrently with p-limit
    await Promise.all(
      customers.map(customer =>
        limit(async () => {
          try {
            const orders = ordersByCustomer[customer.id] ?? []
            const payments = paymentsByCustomer[customer.id] ?? []

            const priorInvoiceTotal = (priorOrdersByCustomer[customer.id] ?? [])
              .reduce((sum, o) => sum + parseFloat(o.total_amount || '0'), 0)

            const priorPaymentTotal = (priorPaymentsByCustomer[customer.id] ?? [])
              .reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0)

            const openingBalance = priorInvoiceTotal - priorPaymentTotal

            const pdfBuffer = await generateStatementPDF({
              customer,
              orders,
              payments,
              openingBalance,
              startDate,
              endDate,
            })

            await resend.emails.send({
              from: 'debs_bakery@outlook.com',
              to: customer.email!,
              subject: `Monthly Statement - ${customer.business_name || customer.email}`,
              html: `
                <div style="font-family: Arial, sans-serif;">
                  <h2 style="color: #006A4E;">Monthly Account Statement</h2>
                  <p>Dear ${customer.business_name || 'Valued Customer'},</p>
                  <p>Please find attached your monthly account statement.</p>
                  <p><strong>Current Balance: $${parseFloat(customer.balance || '0').toFixed(2)}</strong></p>
                  <p>Thank you for your continued business.</p>
                  <p>Best regards,<br/>Deb's Bakery</p>
                </div>
              `,
              attachments: [
                {
                  filename: `statement-${customer.business_name?.replace(/\s/g, '-') || customer.id}.pdf`,
                  content: pdfBuffer,
                },
              ],
            })

            console.log(`Statement sent to ${customer.email}`)
            sent++

          } catch (error: any) {
            console.error(`Failed for ${customer.email}:`, error)
            failed++
            errors.push(`${customer.email}: ${error.message}`)
          }
        })
      )
    )

    return NextResponse.json({
      success: true,
      sent,
      failed,
      total: customers.length,
      errors: errors.length > 0 ? errors : undefined,
    })

  } catch (error: any) {
    console.error('Send all statements error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send statements' },
      { status: 500 }
    )
  }
}

// Simple groupBy utility
function groupBy<T extends Record<string, any>>(arr: T[], key: string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const group = item[key]
    acc[group] = acc[group] ?? []
    acc[group].push(item)
    return acc
  }, {} as Record<string, T[]>)
}