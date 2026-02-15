// app/api/ar/aging/update/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST() {
  try {
    console.log('📊 Updating AR aging report...')

    // Get all customers
    const { data: customers, error: custError } = await supabase
      .from('customers')
      .select('id, business_name, email, payment_terms')

    if (custError) throw custError

    const today = new Date()
    let updated = 0

    for (const customer of customers || []) {
      // Get all unpaid invoices (transactions with type 'invoice' and no paid_date)
      const { data: unpaidInvoices } = await supabase
        .from('ar_transactions')
        .select('*')
        .eq('customer_id', customer.id)
        .eq('type', 'invoice')
        .is('paid_date', null)
        .gt('amount', 0)

      // Get all payments (to calculate true balance)
      const { data: allTransactions } = await supabase
        .from('ar_transactions')
        .select('*')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: true })

      // Calculate running balance from ALL transactions
      let runningBalance = 0
      for (const tx of allTransactions || []) {
        const amount = parseFloat(tx.amount || '0')
        if (tx.type === 'invoice' || tx.type === 'charge' || tx.type === 'late_fee') {
          runningBalance += amount
        } else if (tx.type === 'payment' || tx.type === 'credit' || tx.type === 'adjustment') {
          runningBalance -= amount
        }
      }

      // Calculate aging buckets based on UNPAID invoices
      let current = 0
      let days_1_30 = 0
      let days_31_60 = 0
      let days_61_90 = 0
      let days_over_90 = 0

      for (const inv of unpaidInvoices || []) {
        const dueDate = new Date(inv.due_date || inv.created_at)
        const daysOverdue = Math.floor(
          (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
        )

        const amount = parseFloat(inv.amount)

        if (daysOverdue <= 0) {
          current += amount
        } else if (daysOverdue <= 30) {
          days_1_30 += amount
        } else if (daysOverdue <= 60) {
          days_31_60 += amount
        } else if (daysOverdue <= 90) {
          days_61_90 += amount
        } else {
          days_over_90 += amount
        }
      }

      const unpaidTotal = current + days_1_30 + days_31_60 + days_61_90 + days_over_90

      // Upsert aging record
      const { error: upsertError } = await supabase
        .from('ar_aging')
        .upsert(
          {
            customer_id: customer.id,
            current: current.toFixed(2),
            days_1_30: days_1_30.toFixed(2),
            days_31_60: days_31_60.toFixed(2),
            days_61_90: days_61_90.toFixed(2),
            days_over_90: days_over_90.toFixed(2),
            total_due: unpaidTotal.toFixed(2),
          },
          { onConflict: 'customer_id' }
        )

      if (upsertError) {
        console.error(`❌ Aging upsert failed for ${customer.id}:`, upsertError)
        continue
      }

      // ✅ UPDATE BALANCE BASED ON ALL TRANSACTIONS (not just unpaid invoices)
      await supabase
        .from('customers')
        .update({ balance: runningBalance.toFixed(2) })
        .eq('id', customer.id)

      updated++
      console.log(
        `  📋 ${customer.business_name || customer.email}:`,
        `Balance: $${runningBalance.toFixed(2)}`,
        `| Unpaid: $${unpaidTotal.toFixed(2)}`,
        `(Current: $${current.toFixed(2)} | 1-30: $${days_1_30.toFixed(2)} | `,
        `31-60: $${days_31_60.toFixed(2)} | 61-90: $${days_61_90.toFixed(2)} | `,
        `90+: $${days_over_90.toFixed(2)})`
      )
    }

    console.log(`✅ Aging updated for ${updated} customers`)

    return NextResponse.json({
      success: true,
      updated,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('❌ Aging update error:', error)
    return NextResponse.json(
      { error: error.message || 'Aging update failed' },
      { status: 500 }
    )
  }
}