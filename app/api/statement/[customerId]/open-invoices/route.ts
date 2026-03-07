// app/api/statement/[customerId]/open-invoices/route.ts
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateOpenInvoicesPDF } from '@/lib/pdf/open-invoices'

interface RouteParams {
  params: Promise<{ customerId: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = createAdminClient()
    const { customerId } = await params

    const { data: customer } = await supabase
      .from('customers')
      .select('id, business_name, contact_name, email, address, balance, payment_terms')
      .eq('id', customerId)
      .single()

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Get all unpaid/partial invoices
    const { data: arTx, error } = await supabase
      .from('ar_transactions')
      .select('id, type, amount, amount_paid, description, created_at, invoice_id, due_date')
      .eq('customer_id', customerId)
      .eq('type', 'invoice')
      .order('due_date', { ascending: true })

    if (error) throw error

    // Invoice number map
    const invoiceIds = (arTx ?? [])
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

    // Build open invoice lines
    const openInvoices = (arTx ?? [])
      .map(tx => {
        const amount     = Number(tx.amount)
        const amountPaid = Number(tx.amount_paid || 0)
        const outstanding = Math.max(amount - amountPaid, 0)
        const invoiceNum  = tx.invoice_id ? invoiceMap[tx.invoice_id] : null
        const reference   = invoiceNum
          ? `INV-${String(invoiceNum).padStart(4, '0')}`
          : 'INVOICE'

        return {
          date:        tx.created_at,
          due_date:    tx.due_date,
          reference,
          description: tx.description || reference,
          amount,
          amount_paid:  amountPaid,
          outstanding,
          status:      amountPaid >= amount - 0.01
            ? 'paid'
            : amountPaid > 0
            ? 'partial'
            : 'unpaid',
        }
      })
      .filter(inv => inv.status !== 'paid') // exclude fully paid

    const totalOutstanding = openInvoices.reduce((s, inv) => s + inv.outstanding, 0)

    const pdfBuffer = await generateOpenInvoicesPDF({
      customer,
      invoices: openInvoices,
      totalOutstanding,
      asAt: new Date().toISOString().split('T')[0],
    })

    const safeName = (customer.business_name || customer.id)
      .replace(/[^a-z0-9]/gi, '-').toLowerCase()

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="open-invoices-${safeName}.pdf"`,
      },
    })

  } catch (error: any) {
    console.error('Open invoices error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}