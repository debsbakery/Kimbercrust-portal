import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { LOGO_BASE64 } from '@/lib/logo-base64'

export class StatementService {

  async generateStatementData(customerId: string, startDate: Date, endDate: Date) {
    const supabase = await createClient()

    const { data: customer, error: custError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single()

    if (custError || !customer) {
      throw new Error(`Customer ${customerId} not found`)
    }

    const { data: transactions, error: txnError } = await supabase
      .from('ar_transactions')
      .select('*')
      .eq('customer_id', customerId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: true })

    if (txnError) throw txnError

    const previousBalance = await this.getPreviousBalance(customerId, startDate)

    const totalCharges = (transactions || [])
      .filter(t => t.type === 'invoice' || t.type === 'adjustment')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0)

    const totalCredits = (transactions || [])
      .filter(t => t.type === 'payment' || t.type === 'credit')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0)

    // Get invoice numbers for linked orders
    const orderIds = (transactions || []).map(t => t.invoice_id).filter(Boolean)
    let invoiceNumberMap: Record<string, number> = {}

    if (orderIds.length > 0) {
      const { data: invoiceNumbers } = await supabase
        .from('invoice_numbers')
        .select('order_id, invoice_number')
        .in('order_id', orderIds)

      if (invoiceNumbers) {
        for (const row of invoiceNumbers) {
          if (row.order_id) invoiceNumberMap[row.order_id] = row.invoice_number
        }
      }
    }

    return {
      customer,
      transactions: transactions || [],
      invoiceNumberMap,
      summary: {
        previousBalance,
        totalCharges,
        totalCredits,
        currentBalance: parseFloat(customer.balance || '0')
      }
    }
  }

  async getPreviousBalance(customerId: string, beforeDate: Date): Promise<number> {
    const supabase = await createClient()

    const { data: lastTxn } = await supabase
      .from('ar_transactions')
      .select('balance_after')
      .eq('customer_id', customerId)
      .lt('created_at', beforeDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    return lastTxn?.balance_after ? parseFloat(lastTxn.balance_after) : 0
  }

  generateStatementPDF(data: any): Buffer {
    const doc = new jsPDF()
    const customer = data.customer
    const customerName = customer.business_name || customer.contact_name || customer.email

    const logoColor: [number, number, number] = [206, 17, 38]
    const textColor: [number, number, number] = [0, 0, 0]
    const margin = 20
    let yPos = margin

    // Header background
    doc.setFillColor(255, 255, 255)
    doc.rect(0, 0, 210, 50, 'F')

    // Logo
    try {
      doc.addImage(LOGO_BASE64, 'PNG', margin, yPos + 2, 25, 25)
    } catch (error) {
      // Fallback
      doc.setFillColor(...logoColor)
      doc.circle(margin + 12, yPos + 12, 12, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('D', margin + 12, yPos + 15, { align: 'center' })
    }

    // Company name
    doc.setTextColor(...textColor)
    doc.setFontSize(24)
    doc.setFont('helvetica', 'bold')
    doc.text(process.env.BAKERY_NAME || "Deb's Bakery", margin + 30, yPos + 12)

    // Company details
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(process.env.BAKERY_EMAIL || 'debs_bakery@outlook.com', margin + 30, yPos + 20)
    doc.text(process.env.BAKERY_PHONE || '(04) 1234-5678', margin + 30, yPos + 25)
    doc.text(process.env.BAKERY_ADDRESS || 'Melbourne, Australia', margin + 30, yPos + 30)
    if (process.env.BAKERY_ABN) {
      doc.setFont('helvetica', 'bold')
      doc.text(`ABN: ${process.env.BAKERY_ABN}`, margin + 30, yPos + 36)
    }

    // ACCOUNT STATEMENT title
    doc.setTextColor(...textColor)
    doc.setFontSize(28)
    doc.setFont('helvetica', 'bold')
    doc.text('ACCOUNT STATEMENT', 210 - margin, 25, { align: 'right' })

    // Statement details box
    yPos = 60
    doc.setFillColor(250, 250, 250)
    doc.rect(210 - 90, yPos, 70, 32, 'F')

    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('Statement Date:', 210 - 85, yPos + 8)
    doc.text('Account ID:', 210 - 85, yPos + 16)
    doc.text('Payment Terms:', 210 - 85, yPos + 24)

    doc.setFont('helvetica', 'normal')
    doc.text(format(new Date(), 'dd/MM/yyyy'), 210 - margin - 2, yPos + 8, { align: 'right' })
    doc.text(customer.id.substring(0, 8).toUpperCase(), 210 - margin - 2, yPos + 16, { align: 'right' })
    doc.text(`Net ${customer.payment_terms || 30}`, 210 - margin - 2, yPos + 24, { align: 'right' })

    // Customer info - BILL TO
    yPos = 60
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('BILL TO:', margin, yPos)

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    yPos += 8

    if (customer.business_name) {
      doc.setFont('helvetica', 'bold')
      doc.text(customer.business_name, margin, yPos)
      yPos += 6
      doc.setFont('helvetica', 'normal')
    }

    doc.text(customer.email, margin, yPos)
    yPos += 5

    if (customer.address) {
      doc.text(customer.address, margin, yPos)
      yPos += 5
    }

    if (customer.abn) {
      doc.setFont('helvetica', 'bold')
      doc.text(`ABN: ${customer.abn}`, margin, yPos)
      yPos += 5
    }

    // Account summary box
    yPos = 105
    doc.setFillColor(250, 250, 250)
    doc.rect(margin, yPos, 170, 28, 'F')

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('ACCOUNT SUMMARY', margin + 5, yPos + 8)

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('Previous Balance:', margin + 5, yPos + 16)
    doc.text(`$${data.summary.previousBalance.toFixed(2)}`, margin + 50, yPos + 16)

    doc.text('Charges:', margin + 75, yPos + 16)
    doc.text(`$${data.summary.totalCharges.toFixed(2)}`, margin + 105, yPos + 16)

    doc.text('Payments:', margin + 125, yPos + 16)
    doc.text(`$${data.summary.totalCredits.toFixed(2)}`, margin + 160, yPos + 16)

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Balance Due:', margin + 5, yPos + 24)
    doc.text(`$${data.summary.currentBalance.toFixed(2)}`, margin + 160, yPos + 24, { align: 'right' })

    // Transaction table
    yPos = 140

    const tableData = data.transactions.map((txn: any) => {
      const isCharge = txn.type === 'invoice' || txn.type === 'adjustment'
      let desc = txn.description || txn.type

      // Add invoice number if available
      if (txn.invoice_id && data.invoiceNumberMap[txn.invoice_id]) {
        desc = `INV-${data.invoiceNumberMap[txn.invoice_id]} — ${desc}`
      }

      return [
        format(new Date(txn.created_at), 'dd/MM/yyyy'),
        desc.substring(0, 50),
        txn.type.charAt(0).toUpperCase() + txn.type.slice(1),
        isCharge ? `$${parseFloat(txn.amount).toFixed(2)}` : '',
        !isCharge ? `$${parseFloat(txn.amount).toFixed(2)}` : '',
        `$${parseFloat(txn.balance_after).toFixed(2)}`
      ]
    })

    autoTable(doc, {
      startY: yPos,
      head: [['Date', 'Description', 'Type', 'Charges', 'Payments', 'Balance']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [0, 0, 0],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [0, 0, 0]
      },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 65 },
        2: { cellWidth: 22 },
        3: { cellWidth: 25, halign: 'right' },
        4: { cellWidth: 25, halign: 'right' },
        5: { cellWidth: 25, halign: 'right' }
      },
      margin: { left: margin, right: margin }
    })

    // Footer
    const finalY = (doc as any).lastAutoTable?.finalY || 200
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text('Please remit payment within terms. Thank you for your business!', 105, finalY + 15, { align: 'center' })
    doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy')}`, 105, finalY + 20, { align: 'center' })

    // Return as Buffer
    const arrayBuffer = doc.output('arraybuffer')
    return Buffer.from(arrayBuffer)
  }

  async emailStatement(customerId: string, startDate: Date, endDate: Date) {
    const { sendStatementEmail } = await import('./email-service')

    const supabase = await createClient()
    const data = await this.generateStatementData(customerId, startDate, endDate)
    const pdfBuffer = this.generateStatementPDF(data)

    const customerName = data.customer.business_name || data.customer.contact_name || data.customer.email

    try {
      await sendStatementEmail({
        customer: data.customer,
        pdfBuffer,
        summary: data.summary
      })

      // Log success
      await supabase.from('ar_emails').insert({
        customer_id: customerId,
        type: 'statement',
        subject: `Account Statement - ${format(new Date(), 'dd/MM/yyyy')}`,
        status: 'sent'
      })

      // Update last statement date
      await supabase
        .from('customers')
        .update({ last_statement_date: new Date().toISOString().split('T')[0] })
        .eq('id', customerId)

      console.log(`✅ Statement emailed to ${customerName}`)
      return { success: true }
    } catch (error) {
      // Log failure
      await supabase.from('ar_emails').insert({
        customer_id: customerId,
        type: 'statement',
        status: 'failed'
      })

      throw error
    }
  }
}