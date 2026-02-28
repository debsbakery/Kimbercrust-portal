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
  invoiceNumber?: string  // Pass in from orders table if available
}

// ── Colours — minimal ink palette ────────────────────────────────────────────

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
  const PW     = 210  // page width mm
  const PH     = 297  // page height mm

  // ── Build item list ────────────────────────────────────────────────────────

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

  // ── Dates ──────────────────────────────────────────────────────────────────

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

  // ── Draw header (repeated on each page via didDrawPage) ────────────────────

  const HEADER_H   = 28   // header block height
  const CUSTOMER_H = 22   // customer info block height
  const HEADER_TOTAL = HEADER_H + CUSTOMER_H + 4

  const drawPageHeader = (pageNum: number, totalPages: number) => {
    // White background for entire header area
    doc.setFillColor(...C.white)
    doc.rect(0, 0, PW, HEADER_TOTAL + 2, 'F')

    // ── Thin top border line (green, 1mm) ──
    doc.setFillColor(...C.green)
    doc.rect(0, 0, PW, 2, 'F')

    // ── Bakery name left ──
    doc.setTextColor(...C.green)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text(bakeryInfo.name, margin, 13)

    // ── Bakery contact right ──
    doc.setTextColor(...C.midGray)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text(bakeryInfo.phone, PW - margin, 9, { align: 'right' })
    doc.text(bakeryInfo.address, PW - margin, 14, { align: 'right' })

    // ── "PACKING SLIP" label ──
    doc.setTextColor(...C.darkGray)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('PACKING SLIP', PW - margin, 22, { align: 'right' })

    // Page number if multi-page
    if (totalPages > 1) {
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...C.midGray)
      doc.text(`Page ${pageNum} of ${totalPages}`, PW - margin, 26, { align: 'right' })
    }

    // ── Thin divider line ──
    doc.setDrawColor(...C.lightGray)
    doc.setLineWidth(0.3)
    doc.line(margin, HEADER_H, PW - margin, HEADER_H)

    // ── Customer info block (light border, no fill) ──
    const cy = HEADER_H + 2

    doc.setDrawColor(...C.lightGray)
    doc.setLineWidth(0.3)
    doc.roundedRect(margin, cy, PW - margin * 2, CUSTOMER_H, 1.5, 1.5, 'S')

    // DELIVER TO label
    doc.setTextColor(...C.green)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.text('DELIVER TO', margin + 3, cy + 6)

    // Customer name — bold, prominent
    const customerName = order.customer_business_name || order.customer_email || 'Customer'
    doc.setTextColor(...C.black)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text(customerName, margin + 3, cy + 15)

    // Customer address below if available
    const customerAddress = (order as any).customer_address
    if (customerAddress) {
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...C.midGray)
      doc.text(customerAddress, margin + 3, cy + 20)
    }

    // Delivery date — right side
    doc.setTextColor(...C.red)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.text('DELIVERY DATE', PW - margin - 3, cy + 6, { align: 'right' })

    doc.setTextColor(...C.black)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(deliveryDateShort, PW - margin - 3, cy + 14, { align: 'right' })

    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.midGray)
    // Weekday on second line
    const weekday = order.delivery_date
      ? new Date(order.delivery_date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long' })
      : ''
    doc.text(weekday, PW - margin - 3, cy + 19, { align: 'right' })

    // Invoice number if available
    if (invoiceNumber) {
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...C.midGray)
      doc.text(`Invoice #${invoiceNumber}`, PW - margin - 3, cy + 24, { align: 'right' })
    }

    // ── Notes strip if present ──────────────────────────────────
    // (drawn inline in main flow, not in header, so it only appears page 1)
  }

  // ── Calculate if we need multi-page ───────────────────────────────────────
  // Rough estimate: each row ~8mm, header ~60mm, footer ~35mm
  const ITEMS_PER_PAGE_FIRST  = Math.floor((PH - HEADER_TOTAL - 70) / 8)
  const ITEMS_PER_PAGE_AFTER  = Math.floor((PH - HEADER_TOTAL - 20) / 8)
  const remainingAfterFirst   = Math.max(0, items.length - ITEMS_PER_PAGE_FIRST)
  const extraPages             = remainingAfterFirst > 0
    ? Math.ceil(remainingAfterFirst / ITEMS_PER_PAGE_AFTER)
    : 0
  const totalPages = 1 + extraPages

  // Draw header on page 1
  drawPageHeader(1, totalPages)

  let yPos = HEADER_TOTAL + 4

  // ── Notes (page 1 only) ────────────────────────────────────────────────────
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

  // ── Product code range label ───────────────────────────────────────────────
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

  // ── Items table ────────────────────────────────────────────────────────────

  const tableData = items.map((item) => [
    (item as any).product_code?.toString() ?? '—',
    item.product_name ?? '—',
    item.quantity.toString(),
    '',  // picked — checkbox drawn via hook
  ])

  autoTable(doc, {
    startY: yPos,

    head: [['Code', 'Product', 'Qty', 'Picked']],
    body: tableData,

    // ── No heavy fills — ink-light theme ──
    theme: 'plain',

    headStyles: {
      textColor:   C.black,
      fontStyle:   'bold',
      fontSize:    9,
      cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
      lineWidth:   { bottom: 0.5 },
      lineColor:   C.black,
      fillColor:   C.white,
    },

    bodyStyles: {
      fontSize:    9.5,
      textColor:   C.black,
      cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
      lineWidth:   { bottom: 0.15 },
      lineColor:   [210, 210, 210],
      fillColor:   C.white,
    },

    // Alternate rows with very subtle tint — almost no ink
    alternateRowStyles: {
      fillColor: [248, 248, 248] as [number, number, number],
    },

    columnStyles: {
      0: { cellWidth: 20, halign: 'center', fontStyle: 'bold', fontSize: 9 },
      1: { cellWidth: 118 },
      2: { cellWidth: 18, halign: 'center', fontStyle: 'bold', fontSize: 11 },
      3: { cellWidth: 18, halign: 'center' },
    },

    margin: { left: margin, right: margin },

    // Header on every page
    showHead: 'everyPage',

    // ── Draw checkbox in picked column ──────────────────────────
    didDrawCell: (hook) => {
      if (hook.section === 'body' && hook.column.index === 3) {
        const { x, y, width, height } = hook.cell
        const size = 5.5
        const cx = x + width / 2 - size / 2
        const cy = y + height / 2 - size / 2
        doc.setDrawColor(...C.black)
        doc.setLineWidth(0.35)
        doc.rect(cx, cy, size, size)
      }
    },

    // ── Repeat header on each new page ──────────────────────────
    didDrawPage: (hook) => {
      const pageNum = hook.pageNumber
      if (pageNum > 1) {
        drawPageHeader(pageNum, totalPages)
      }
    },
  })

  const tableEndY = (doc as any).lastAutoTable.finalY as number

  // ── Totals bar ────────────────────────────────────────────────────────────
  // Light border box — no black fill
  const totalQty   = items.reduce((sum, item) => sum + item.quantity, 0)
  const totalLines = items.length

  const totalsY = tableEndY + 3
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

  // ── Packed by line ────────────────────────────────────────────────────────
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

  // ── CUSTOMER NAME STRIP AT BOTTOM (last page) ─────────────────────────────
  // Sits below the page content, sticks out of bread crate
  // Black border box — no heavy fill, large bold text
  const bottomStripY = PH - 22

  doc.setFillColor(...C.white)
  doc.setDrawColor(...C.black)
  doc.setLineWidth(0.8)
  doc.rect(margin, bottomStripY, PW - margin * 2, 18, 'FD')

  // Customer name scaled to fit
  const customerName = (order.customer_business_name || order.customer_email || 'CUSTOMER').toUpperCase()
  const textWidth    = PW - margin * 2 - 8

  // Auto-scale font to fit the box
  let fontSize = 26
  doc.setFont('helvetica', 'bold')
  while (fontSize > 10) {
    doc.setFontSize(fontSize)
    const w = doc.getTextWidth(customerName)
    if (w <= textWidth) break
    fontSize -= 1
  }

  doc.setTextColor(...C.black)
  doc.setFontSize(fontSize)
  doc.setFont('helvetica', 'bold')
  doc.text(customerName, PW / 2, bottomStripY + 11, { align: 'center' })

  // Delivery date in small text below name inside strip
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...C.midGray)
  doc.text(deliveryDateLong, PW / 2, bottomStripY + 17, { align: 'center' })

  return doc
}