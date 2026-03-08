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
    const endDate      = searchParams.get('endDate')
      || new Date().toISOString().split('T')[0]

    // Customer
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, business_name, contact_name, email, address, balance, payment_terms')
      .eq('id', customerId)
      .single()

    if (customerError || !customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // AR transactions in period (invoices + credits)
    let txQuery = supabase
      .from('ar_transactions')
      .select('id, type, amount, amount_paid, description, created_at, invoice_id')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: true })

    if (startDate) txQuery = txQuery.gte('created_at', startDate)
    txQuery = txQuery.lte('created_at', endDate + 'T23:59:59')

    const { data: txRaw, error: txError } = await txQuery
    if (txError) throw new Error(txError.message)
    const transactions = txRaw ?? []

    // Payments in period
    let pmtQuery = supabase
      .from('payments')
      .select('id, amount, payment_date, payment_method, reference_number')
      .eq('customer_id', customerId)
      .order('payment_date', { ascending: true })

    if (startDate) pmtQuery = pmtQuery.gte('payment_date', startDate)
    pmtQuery = pmtQuery.lte('payment_date', endDate)

    const { data: pmtRaw, error: pmtError } = await pmtQuery
    if (pmtError) throw new Error(pmtError.message)
    const payments = pmtRaw ?? []

    // Invoice number map
    const invoiceIds = transactions
      .filter(t => t.invoice_id)
      .map(t => t.invoice_id as string)

    let invoiceMap: Record<string, string> = {}
    if (invoiceIds.length > 0) {
      const { data: invNums } = await supabase
        .from('invoice_numbers')
        .select('id, invoice_number')
        .in('id', invoiceIds)
      for (const inv of invNums ?? []) {
        invoiceMap[inv.id] = inv.invoice_number
      }
    }

    // Opening balance BEFORE period
    let openingBalance = 0
    if (startDate) {
      const { data: priorTxRaw } = await supabase
        .from('ar_transactions')
        .select('amount, type')
        .eq('customer_id', customerId)
        .lt('created_at', startDate)

      const priorInvoiceTotal = (priorTxRaw ?? []).reduce((sum, tx) => {
        return sum + (tx.type === 'credit' ? -Number(tx.amount) : Number(tx.amount))
      }, 0)

      const { data: priorPmtRaw } = await supabase
        .from('payments')
        .select('amount')
        .eq('customer_id', customerId)
        .lt('payment_date', startDate)

      const priorPaymentTotal = (priorPmtRaw ?? []).reduce(
        (sum, p) => sum + Number(p.amount), 0
      )

      openingBalance = priorInvoiceTotal - priorPaymentTotal
    }

    // Merge all lines into unified sorted list
    type RawLine = {
      date: string
      type: 'invoice' | 'credit' | 'payment'
      amount: number
      amount_paid: number
      description: string
      reference: string
      paid_status: 'paid' | 'partial' | 'unpaid' | 'na'
    }

    const rawLines: RawLine[] = []

    // Invoice + credit lines
    for (const tx of transactions) {
      const isCredit   = tx.type === 'credit'
      const invoiceNum = tx.invoice_id ? invoiceMap[tx.invoice_id] : null
      const reference  = invoiceNum
        ? 'INV-' + String(invoiceNum).padStart(4, '0')
        : String(tx.type ?? '').toUpperCase()

      const txAmount  = Number(tx.amount || 0)
      const amtPaid   = Number(tx.amount_paid || 0)

      const paidStatus: 'paid' | 'partial' | 'unpaid' | 'na' = isCredit
        ? 'na'
        : amtPaid >= txAmount - 0.01
        ? 'paid'
        : amtPaid > 0
        ? 'partial'
        : 'unpaid'

      rawLines.push({
        date:        tx.created_at,
        type:        isCredit ? 'credit' : 'invoice',
        amount:      txAmount,
        amount_paid: amtPaid,
        description: tx.description || reference,
        reference,
        paid_status: paidStatus,
      })
    }

    // Payment lines
    for (const pmt of payments) {
      const method = pmt.payment_method
        ? pmt.payment_method.replace(/_/g, ' ')
        : 'payment'
      const ref = pmt.reference_number ? ' - ' + pmt.reference_number : ''

      rawLines.push({
        date:        pmt.payment_date + 'T12:00:00',
        type:        'payment',
        amount:      Number(pmt.amount),
        amount_paid: 0,
        description: 'Payment received - thank you (' + method + ')' + ref,
        reference:   pmt.reference_number || 'PAYMENT',
        paid_status: 'na',
      })
    }

    // Sort oldest first (ascending) for statement
    rawLines.sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    // Build final lines with running balance
    let runningBalance = openingBalance

    const lines = rawLines.map(raw => {
      const isCredit = raw.type === 'payment' || raw.type === 'credit'

      runningBalance = isCredit
        ? runningBalance - raw.amount
        : runningBalance + raw.amount

      return {
        date:             raw.date,
        description:      raw.description,
        reference:        raw.reference,
        debit:            isCredit ? null : raw.amount,
        credit:           isCredit ? raw.amount : null,
        balance:          Math.round(runningBalance * 100) / 100,
        transaction_type: raw.type,
        paid_status:      raw.paid_status,
        amount_paid:      raw.amount_paid,
      }
    })

    // Generate PDF
    const pdfBuffer = await generateStatementPDF({
      customer,
      lines,
      openingBalance: Math.round(openingBalance * 100) / 100,
      closingBalance: Math.round(runningBalance  * 100) / 100,
      startDate,
      endDate,
    })

    const safeName = (customer.business_name || customer.id)
      .replace(/[^a-z0-9]/gi, '-')
      .toLowerCase()

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': 'attachment; filename="statement-' + safeName + '-' + endDate + '.pdf"',
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