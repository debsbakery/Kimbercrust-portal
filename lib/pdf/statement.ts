// lib/pdf/statement.ts
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

interface StatementData {
  customer: any
  orders: any[]
  payments: any[]
  openingBalance: number
  startDate: string | null
  endDate: string
}

export async function generateStatementPDF(data: StatementData): Promise<Buffer> {
  const { customer, orders, payments, openingBalance, startDate, endDate } = data

  const pdfDoc = await PDFDocument.create()
  
  // ✅ StandardFonts are embedded — zero filesystem access
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

  let page = pdfDoc.addPage([595, 842]) // A4
  const { width, height } = page.getSize()

  const formatCurrency = (amount: number | string) =>
    `$${parseFloat(amount.toString()).toFixed(2)}`

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  // pdf-lib draws from BOTTOM-LEFT, so we track y from top
  let y = height - 50

  // Helper to draw text
  const drawText = (
    text: string,
    x: number,
    yPos: number,
    options: { size?: number; bold?: boolean; color?: [number, number, number] } = {}
  ) => {
    page.drawText(String(text), {
      x,
      y: yPos,
      size: options.size ?? 10,
      font: options.bold ? fontBold : font,
      color: options.color ? rgb(...options.color) : rgb(0.2, 0.2, 0.2),
    })
  }

  const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
    page.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    })
  }

  // ── Header ──────────────────────────────────────────────
  drawText("Deb's Bakery", 50, y, { size: 24, bold: true, color: [0, 0.416, 0.306] })
  y -= 20
  drawText('Account Statement', 50, y, { size: 10 })

  // ── Statement period (right side) ───────────────────────
  drawText('Statement Period:', 350, height - 50, { size: 10, bold: true })
  drawText(
    `${startDate ? formatDate(startDate) : 'Beginning'} - ${formatDate(endDate)}`,
    350,
    height - 65,
    { size: 9 }
  )
  drawText(`Date Printed: ${formatDate(new Date().toISOString())}`, 350, height - 80, { size: 9 })

  // ── Customer info ────────────────────────────────────────
  y -= 40
  drawText(`To: ${customer.business_name || customer.contact_name || customer.email}`, 50, y, {
    size: 11,
    bold: true,
  })
  if (customer.address) { y -= 15; drawText(customer.address, 50, y, { size: 9 }) }
  if (customer.email)   { y -= 13; drawText(customer.email,   50, y, { size: 9 }) }

  y -= 20
  drawLine(50, y, width - 50, y)

  // ── Opening balance ──────────────────────────────────────
  y -= 20
  drawText('Opening Balance:', 50, y, { size: 11, bold: true })
  drawText(formatCurrency(openingBalance), width - 100, y, { size: 11, bold: true })

  y -= 25

  // ── Table header ─────────────────────────────────────────
  drawText('Date',        50,  y, { size: 9, bold: true })
  drawText('Description', 120, y, { size: 9, bold: true })
  drawText('Charges',     380, y, { size: 9, bold: true })
  drawText('Payments',    470, y, { size: 9, bold: true })
  y -= 12
  drawLine(50, y, width - 50, y)
  y -= 15

  // ── Transactions ─────────────────────────────────────────
  const transactions = [
    ...orders.map(order => ({
      date: order.delivery_date,
      type: 'invoice' as const,
      description: `Invoice #${order.order_number || order.id.slice(0, 8)}`,
      amount: parseFloat(order.total_amount || '0'),
    })),
    ...payments.map(payment => ({
      date: payment.payment_date,
      type: 'payment' as const,
      description: `Payment - ${payment.payment_method}${payment.reference_number ? ` (${payment.reference_number})` : ''}`,
      amount: parseFloat(payment.amount || '0'),
    })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  let runningBalance = openingBalance

  for (const tx of transactions) {
    // Add new page if needed
    if (y < 100) {
      page = pdfDoc.addPage([595, 842])
      y = height - 50
    }

    drawText(formatDate(tx.date), 50,  y, { size: 8 })
    drawText(tx.description,      120, y, { size: 8 })

    if (tx.type === 'invoice') {
      drawText(formatCurrency(tx.amount), 380, y, { size: 8 })
      runningBalance += tx.amount
    } else {
      drawText(formatCurrency(tx.amount), 470, y, { size: 8 })
      runningBalance -= tx.amount
    }

    y -= 16
  }

  // ── Totals ───────────────────────────────────────────────
  y -= 5
  drawLine(50, y, width - 50, y)
  y -= 18

  const totalCharges  = orders.reduce((s, o) => s + parseFloat(o.total_amount || '0'), 0)
  const totalPayments = payments.reduce((s, p) => s + parseFloat(p.amount || '0'), 0)

  drawText('Total Charges:',  250, y, { size: 10, bold: true })
  drawText(formatCurrency(totalCharges),  380, y, { size: 10 })
  y -= 16
  drawText('Total Payments:', 250, y, { size: 10, bold: true })
  drawText(formatCurrency(totalPayments), 470, y, { size: 10 })

  y -= 8
  drawLine(50, y, width - 50, y)
  y -= 18

  drawText('Closing Balance:', 250, y, { size: 12, bold: true, color: [0.808, 0.067, 0.149] })
  drawText(formatCurrency(runningBalance), 400, y, { size: 12, bold: true, color: [0.808, 0.067, 0.149] })

  // ── Footer ───────────────────────────────────────────────
  y -= 35
  drawText(`Payment Terms: ${customer.payment_terms || 'Due on receipt'}`, 50, y, {
    size: 9,
    color: [0.4, 0.4, 0.4],
  })

  if (runningBalance > 0) {
    y -= 18
    drawText(
      'This account is overdue. Please arrange payment at your earliest convenience.',
      50, y,
      { size: 9, color: [0.808, 0.067, 0.149] }
    )
  }

  // ── Serialize ────────────────────────────────────────────
  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}