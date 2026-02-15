import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await params

    const supabase = await createClient()

    // Get unpaid invoices
    const { data: invoices, error } = await supabase
      .from('ar_transactions')
      .select('*')
      .eq('customer_id', customerId)
      .eq('type', 'invoice')
      .is('paid_date', null)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { success: false, error: error.message, invoices: [] },
        { status: 500 }
      )
    }

    // Get invoice numbers for any invoices linked to orders
    const orderIds = (invoices || [])
      .map(inv => inv.invoice_id)
      .filter(Boolean)

    let invoiceNumberMap: Record<string, number> = {}

    if (orderIds.length > 0) {
      const { data: invoiceNumbers } = await supabase
        .from('invoice_numbers')
        .select('order_id, invoice_number')
        .in('order_id', orderIds)

      if (invoiceNumbers) {
        for (const row of invoiceNumbers) {
          if (row.order_id) {
            invoiceNumberMap[row.order_id] = row.invoice_number
          }
        }
      }
    }

    // Format invoices with real invoice numbers and remaining balance
    const invoicesWithDetails = (invoices || []).map(inv => {
      const originalAmount = parseFloat(inv.amount || 0)
      const daysOverdue = inv.due_date
        ? Math.max(0, Math.floor((Date.now() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24)))
        : 0

      // Get real invoice number from invoice_numbers table
      let invoiceNumber: string | null = null
      if (inv.invoice_id && invoiceNumberMap[inv.invoice_id]) {
        invoiceNumber = `INV-${invoiceNumberMap[inv.invoice_id]}`
      } else if (inv.invoice_id) {
        invoiceNumber = inv.invoice_id.substring(0, 8).toUpperCase()
      }

      return {
        id: inv.id,
        invoice_id: inv.invoice_id,
        invoice_number: invoiceNumber,
        amount: originalAmount,
        remaining_balance: originalAmount, // unpaid invoices have full balance remaining
        due_date: inv.due_date,
        description: inv.description,
        created_at: inv.created_at,
        days_overdue: daysOverdue
      }
    })

    return NextResponse.json({
      success: true,
      invoices: invoicesWithDetails
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        invoices: []
      },
      { status: 500 }
    )
  }
}