import { NextResponse } from 'next/server'
import { StatementService } from '@/lib/services/statement-service'
import { createClient } from '@/lib/supabase/server'
import { subMonths, startOfMonth, endOfMonth } from 'date-fns'

export async function POST() {
  try {
    const supabase = await createClient()
    const service = new StatementService()

    // Get all customers with balance
    const { data: customers } = await supabase
      .from('customers')
      .select('id, business_name, contact_name, email')
      .gt('balance', 0)

    if (!customers || customers.length === 0) {
      return NextResponse.json({ success: true, sent: 0, message: 'No customers with balance' })
    }

    // Last month's dates
    const endDate = endOfMonth(subMonths(new Date(), 1))
    const startDate = startOfMonth(subMonths(new Date(), 1))

    let sent = 0
    let failed = 0

    for (const customer of customers) {
      try {
        await service.emailStatement(customer.id, startDate, endDate)
        sent++
      } catch (error) {
        console.error(`Failed to send statement to ${customer.email}:`, error)
        failed++
      }
    }

    console.log(`✅ Sent ${sent} statements, ${failed} failed`)

    return NextResponse.json({
      success: true,
      sent,
      failed,
      total: customers.length
    })
  } catch (error) {
    console.error('Send all statements error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}