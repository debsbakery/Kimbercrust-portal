import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { OrderWithItems } from './types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PackingSlipData {
  order: OrderWithItems
  bakeryInfo: {
    name: string
    phone: string
    address: string
  }
  productCodeRange?: {
    start: number
    end: number
  }
  invoiceNumber?: string
}

// ── Colours ───────────────────────────────────────────────────────────────────

const C = {
  green:     [0, 106, 78]    as [number, number, number],
  red:       [206, 17, 38]   as [number, number, number],
  black:     [0, 0, 0]       as [number, number, number],
  white:     [255, 255, 255] as [number, number, number],
  lightGray: [240, 240, 240] as [number, number, number],
  midGray:   [100, 100, 100] as [number, number, number],
  darkGray:  [50, 50, 50]    as [number, number, number],
}

// ── Main Export ───────────────────────────────────────────────────────────────

export async function generatePackingSlip(data: PackingSlipData): Promise<jsPDF> {
  const { order, bakeryInfo, productCodeRange, invoiceNumber } = data

  const doc    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const margin = 14
  const PW     = 210
  const PH     = 297

  // ── Build item list ───────────────────────────────────────────────────────

  let items = [...(order.order_items || [])]

  if (productCodeRange) {
    items = items.filter((item) => {
      const code = parseInt((item as any).product_code?.toString() ?? '0', 10)
      return code >= productCodeRange.start && code <= productCodeRange.end
    })
  }

  items.sort((a, b) => {
    const cA = parseInt((a as any).product_code?.toString() ?? '9999', 10)
    const cB = parseInt((b as any).product_code?.toString() ?? '9999', 10)
    return cA - cB
  })

  // ── Dates ─────────────────────────────────────────────────────────────────

  const deliveryDateLong = order.delivery_date
    ? new Date(order.delivery_date + 'T00:00:00').toLocaleDateString('en-AU', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })
    : '—'

  const deliveryDateShort = order.delivery_date
    ? new Date(order.delivery_date + 'T00:00:00').toLocaleDateString('en-AU', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      })
    : '—'

  // ── Header dimensions ─────────────────────────────────────────────────────

  const HEADER_H     = 28
  const CUSTOMER_H   = 22
  const HEADER_TOTAL = HEADER_H + CUSTOMER_H + 4

  // ── Draw page header ──────────────────────────────────────────────────────

  const drawPageHeader = () => {
    doc.setFillColor(...C.white)
    doc.rect(0, 0, PW, HEADER_TOTAL + 2, 'F')

    doc.setFillColor(...C.green)
    doc.rect(0, 0, PW, 2, 'F')

    doc.setTextColor(...C.green)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text(bakeryInfo.name, margin, 13)

    doc.setTextColor(...C.midGray)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text(bakeryInfo.phone, PW - margin, 9, { align: 'right' })
    doc.text(bakeryInfo.address, PW - margin, 14, { align: 'right' })

    doc.setTextColor(...C.darkGray)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('PACKING SLIP', PW - margin, 22, { align: 'right' })

    doc.setDrawColor(...C.lightGray)
    doc.setLineWidth(0.3)
    doc.line(margin, HEADER_H, PW - margin, HEADER_H)

    const cy = HEADER_H + 2
    doc.setDrawColor(...C.lightGray)
    doc.setLineWidth(0.3)
    doc.roundedRect(margin, cy, PW - margin * 2, CUSTOMER_H, 1.5, 1.5, 'S')

    doc.setTextColor(...C.green)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.text('DELIVER TO', margin + 3, cy + 6)

    const customerName = order.customer_business_name || order.customer_email || 'Customer'
    doc.setTextColor(...C.black)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text(customerName, margin + 3, cy + 15)

    const customerAddress = (order as any).customer_address
    if (customerAddress) {
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...C.midGray)
      doc.text(customerAddress, margin + 3, cy + 20)
    }

    doc.setTextColor(...C.red)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.text('DELIVERY DATE', PW - margin - 3, cy + 6, { align: 'right' })

    doc.setTextColor(...C.black)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(deliveryDateShort, PW - margin - 3, cy + 14, { align: 'right' })

    const weekday = order.delivery_date
      ? new Date(order.delivery_date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long' })
      : ''
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.midGray)
    doc.text(weekday, PW - margin - 3, cy + 19, { align: 'right' })

    if (invoiceNumber) {
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...C.midGray)
      doc.text(`Invoice #${invoiceNumber}`, PW - margin - 3, cy + 24, { align: 'right' })
    }
  }

  // ── Draw header on page 1 ─────────────────────────────────────────────────

  drawPageHeader()

  let yPos = HEADER_TOTAL + 4

  // ── Notes ─────────────────────────────────────────────────────────────────

  if (order.notes) {
    doc.setDrawColor(251, 191, 36)
    doc.setLineWidth(0.4)
    doc.setFillColor(255, 253, 245)
    const noteLines = doc.splitTextToSize(`Note: ${order.notes}`, PW - margin * 2 - 8)
    const noteH = noteLines.length * 4.5 + 5
    doc.roundedRect(margin, yPos, PW - margin * 2, noteH, 1, 1, 'FD')
    doc.setTextColor(140, 90, 0)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text(noteLines, margin + 4, yPos + 6)
    yPos += noteH + 3
  }

  // ── Product code range label ──────────────────────────────────────────────

  if (productCodeRange) {
    doc.setTextColor(...C.midGray)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text(
      `Showing product codes ${productCodeRange.start} - ${productCodeRange.end}`,
      PW / 2, yPos, { align: 'center' }
    )
    yPos += 4
  }

  // ── Auto-scale font based on item count ───────────────────────────────────

  const itemCount = items.length
  let bodyFontSize = 9.5
  let cellPadding  = { top: 3.5, bottom: 3.5, left: 3, right: 3 }

  if (itemCount > 30) {
    bodyFontSize = 6.5
    cellPadding  = { top: 1, bottom: 1, left: 2, right: 2 }
  } else if (itemCount > 25) {
    bodyFontSize = 7
    cellPadding  = { top: 1.5, bottom: 1.5, left: 2, right: 2 }
  } else if (itemCount > 18) {
    bodyFontSize = 8
    cellPadding  = { top: 2, bottom: 2, left: 2, right: 2 }
  } else if (itemCount > 12) {
    bodyFontSize = 9
    cellPadding  = { top: 2.5, bottom: 2.5, left: 3, right: 3 }
  }

  // ── Table data ────────────────────────────────────────────────────────────

  const tableData = items.map((item) => [
    (item as any).product_code?.toString() ?? '—',
    item.product_name ?? '—',
    item.quantity.toString(),
    '',
  ])

  // ── Items table ───────────────────────────────────────────────────────────

  autoTable(doc, {
    startY: yPos,
    head:   [['Code', 'Product', 'Qty', 'Picked']],
    body:   tableData,
    theme:  'plain',

    headStyles: {
      textColor:   C.black,
      fontStyle:   'bold',
      fontSize:    bodyFontSize - 0.5,
      cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
      lineWidth:   { bottom: 0.5 },
      lineColor:   C.black,
      fillColor:   C.white,
    },

    bodyStyles: {
      fontSize:    bodyFontSize,
      textColor:   C.black,
      cellPadding: cellPadding,
      lineWidth:   { bottom: 0.15 },
      lineColor:   [210, 210, 210],
      fillColor:   C.white,
    },

    alternateRowStyles: {
      fillColor: [248, 248, 248] as [number, number, number],
    },

    columnStyles: {
      0: { cellWidth: 20,  halign: 'center', fontStyle: 'bold', fontSize: bodyFontSize - 0.5 },
      1: { cellWidth: 118 },
      2: { cellWidth: 18,  halign: 'center', fontStyle: 'bold', fontSize: bodyFontSize + 1 },
      3: { cellWidth: 18,  halign: 'center' },
    },

    // ✅ Limit table to available space — never overflow to next page
    margin:    { left: margin, right: margin },
    showHead:  'everyPage',
    pageBreak: 'avoid',

    didDrawCell: (hook) => {
      if (hook.section === 'body' && hook.column.index === 3) {
        const { x, y, width, height } = hook.cell
        const size = 5
        const cx   = x + width  / 2 - size / 2
        const cy   = y + height / 2 - size / 2
        doc.setDrawColor(...C.black)
        doc.setLineWidth(0.35)
        doc.rect(cx, cy, size, size)
      }
    },

    // ✅ Redraw header if table forces a new page (edge case for very large orders)
    didDrawPage: (hook) => {
      if (hook.pageNumber > 1) {
        drawPageHeader()
      }
    },
  })

  const tableEndY = (doc as any).lastAutoTable.finalY as number

  // ── Totals bar ────────────────────────────────────────────────────────────

  const totalQty   = items.reduce((sum, item) => sum + item.quantity, 0)
  const totalLines = items.length
  const totalsY    = tableEndY + 3

  doc.setDrawColor(...C.black)
  doc.setLineWidth(0.5)
  doc.setFillColor(...C.white)
  doc.roundedRect(PW - margin - 70, totalsY, 70, 10, 1, 1, 'FD')

  doc.setTextColor(...C.black)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text(
    `${totalLines} line${totalLines !== 1 ? 's' : ''}   |   ${totalQty} units`,
    PW - margin - 35, totalsY + 6.5,
    { align: 'center' }
  )

  // ── Packed by signature line ──────────────────────────────────────────────

  const sigY = totalsY + 16
  doc.setDrawColor(...C.midGray)
  doc.setLineWidth(0.25)
  doc.line(margin, sigY, margin + 65, sigY)
  doc.setTextColor(...C.midGray)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.text('Packed by:', margin, sigY - 2)
  doc.text('Signature / Initial', margin, sigY + 4)

  // ── Printed date ──────────────────────────────────────────────────────────

  doc.setFontSize(6.5)
  doc.setTextColor(...C.midGray)
  doc.text(
    `Printed: ${new Date().toLocaleDateString('en-AU')}`,
    PW / 2, sigY + 8, { align: 'center' }
  )

  // ── Customer name strip at bottom ─────────────────────────────────────────
  // Always at fixed position — sticks out of bread crate

  const bottomStripY = PH - 22

  doc.setFillColor(...C.white)
  doc.setDrawColor(...C.black)
  doc.setLineWidth(0.8)
  doc.rect(margin, bottomStripY, PW - margin * 2, 18, 'FD')

  const customerNameUpper = (
    order.customer_business_name || order.customer_email || 'CUSTOMER'
  ).toUpperCase()

  const textWidth = PW - margin * 2 - 8
  let nameFontSize = 26
  doc.setFont('helvetica', 'bold')

  while (nameFontSize > 10) {
    doc.setFontSize(nameFontSize)
    if (doc.getTextWidth(customerNameUpper) <= textWidth) break
    nameFontSize -= 1
  }

  doc.setTextColor(...C.black)
  doc.setFontSize(nameFontSize)
  doc.setFont('helvetica', 'bold')
  doc.text(customerNameUpper, PW / 2, bottomStripY + 11, { align: 'center' })

  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...C.midGray)
  doc.text(deliveryDateLong, PW / 2, bottomStripY + 17, { align: 'center' })

  return doc
}
