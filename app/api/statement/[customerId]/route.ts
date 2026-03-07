export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateStatementPDF } from '@/lib/pdf/statement'

interface RouteParams {
  params: Promise<{ customerId: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = createAdminClient()
    const { customerId } = await params

    const searchParams = request.nextUrl.searchParams
    const startDate    = searchParams.get('startDate')
    const endDate      = searchParams.get('endDate') || new Date().toISOString().split('T')[0]

    // ── Customer ──────────────────────────────────────────────
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, business_name, contact_name, email, address, balance, payment_terms')
      .eq('id', customerId)
      .single()

    if (customerError || !customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // ── AR Transactions in period ─────────────────────────────
    let txQuery = supabase
      .from('ar_transactions')
      .select('id, transaction_type, amount, description, created_at, order_id')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: true })

    if (startDate) txQuery = txQuery.gte('created_at', startDate)
    txQuery = txQuery.lte('created_at', endDate + 'T23:59:59')

    const { data: txRaw, error: txError } = await txQuery

    if (txError) {
      console.error('AR transactions error:', txError)
      throw txError
    }

    // ✅ Always an array — never null
    const transactions = txRaw ?? []

    // ── Invoice number map ────────────────────────────────────
    const orderIds = transactions
      .filter(t => t.order_id)
      .map(t => t.order_id)

    let invoiceMap: Record<string, string> = {}

    if (orderIds.length > 0) {
      const { data: invoiceNums } = await supabase
        .from('invoice_numbers')
        .select('order_id, invoice_number')
        .in('order_id', orderIds)

      // ✅ Guard null here too
      for (const inv of invoiceNums ?? []) {
        invoiceMap[inv.order_id] = inv.invoice_number
      }
    }

    // ── Opening balance — all AR before period start ──────────
    let openingBalance = 0

    if (startDate) {
      const { data: priorRaw } = await supabase
        .from('ar_transactions')
        .select('amount, transaction_type')
        .eq('customer_id', customerId)
        .lt('created_at', startDate)

      // ✅ Guard null
      const prior = priorRaw ?? []

      openingBalance = prior.reduce((sum, tx) => {
        const isCredit =
          tx.transaction_type === 'payment' ||
          tx.transaction_type === 'credit'
        return sum + (isCredit ? -Number(tx.amount) : Number(tx.amount))
      }, 0)
    }

    // ── Build statement lines with running balance ─────────────
    let runningBalance = openingBalance

    const lines = transactions.map(tx => {
      const isCredit =
        tx.transaction_type === 'payment' ||
        tx.transaction_type === 'credit'

      runningBalance = isCredit
        ? runningBalance - Number(tx.amount)
        : runningBalance + Number(tx.amount)

      const invoiceNum = tx.order_id ? invoiceMap[tx.order_id] : null
      const reference  = invoiceNum
        ? `INV-${String(invoiceNum).padStart(4, '0')}`
        : String(tx.transaction_type).toUpperCase()

      return {
        date:             tx.created_at,
        description:      isCredit
          ? (tx.transaction_type === 'credit' ? 'Credit note' : 'Payment received - thank you')
          : reference,
        reference,
        debit:            isCredit ? null : Number(tx.amount),
        credit:           isCredit ? Number(tx.amount) : null,
        balance:          Math.round(runningBalance * 100) / 100,
        transaction_type: tx.transaction_type,
      }
    })

    // ── Generate PDF ──────────────────────────────────────────
    const pdfBuffer = await generateStatementPDF({
      customer,
      lines,
      openingBalance:  Math.round(openingBalance  * 100) / 100,
      closingBalance:  Math.round(runningBalance  * 100) / 100,
      startDate,
      endDate,
    })

    const safeName = (customer.business_name || customer.id)
      .replace(/[^a-z0-9]/gi, '-')
      .toLowerCase()

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="statement-${safeName}-${endDate}.pdf"`,
      },
    })

  } catch (error: any) {
    console.error('Error generating statement:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate statement' },
      { status: 500 }
    )
  }
}