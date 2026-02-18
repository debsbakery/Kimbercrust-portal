export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import PDFDocument from 'pdfkit'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customer_id')
    const format = searchParams.get('format')

    if (!customerId) {
      return NextResponse.json({ error: 'customer_id required' }, { status: 400 })
    }

    // Get customer details
    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single()

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Get all transactions
    const { data: transactions } = await supabase
      .from('ar_transactions')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: true })

    // Calculate running balance
    let runningBalance = 0
    const ledger = (transactions || []).map((tx) => {
      const amount = parseFloat(tx.amount)
      const isDebit = ['invoice', 'charge', 'late_fee'].includes(tx.type)
      
      if (isDebit) {
        runningBalance += amount
      } else {
        runningBalance -= amount
      }

      return {
        date: tx.created_at,
        description: tx.description,
        type: tx.type,
        invoice_id: tx.invoice_id,
        debit: isDebit ? amount : 0,
        credit: !isDebit ? amount : 0,
        balance: runningBalance,
      }
    })

    if (format === 'pdf') {
      // Generate PDF
      const doc = new PDFDocument()
      const chunks: Buffer[] = []

      doc.on('data', (chunk: Buffer) => chunks.push(chunk))  // ✅ Type the chunk
      
      return new Promise<NextResponse>((resolve) => {  // ✅ Type the Promise
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(chunks)
          resolve(new NextResponse(pdfBuffer, {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="ledger-${customer.business_name || customer.email}.pdf"`,
            },
          }))
        })

        // PDF content
        doc.fontSize(20).text('Customer Ledger', { align: 'center' })
        doc.moveDown()
        doc.fontSize(12).text(`Customer: ${customer.business_name || customer.email}`)
        doc.text(`Current Balance: $${runningBalance.toFixed(2)}`)
        doc.moveDown()

        // Transaction table
        ledger.forEach((tx) => {
          doc.fontSize(10).text(
            `${new Date(tx.date).toLocaleDateString()} - ${tx.type} - $${tx.debit || tx.credit} - Balance: $${tx.balance.toFixed(2)}`
          )
        })

        doc.end()
      })
    }

    // Return JSON
    return NextResponse.json({
      success: true,
      customer: {
        id: customer.id,
        business_name: customer.business_name,
        email: customer.email,
        current_balance: runningBalance,
      },
      ledger,
      summary: {
        total_charges: ledger.reduce((sum, tx) => sum + tx.debit, 0),
        total_payments: ledger.reduce((sum, tx) => sum + tx.credit, 0),
        current_balance: runningBalance,
      },
    })
  } catch (error: any) {
    console.error('Customer ledger error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate ledger' },
      { status: 500 }
    )
  }
}