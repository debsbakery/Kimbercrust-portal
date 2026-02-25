import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

interface PackingSlipData {
  id: string
  delivery_date: string
  customer: {
    business_name?: string
    contact_name?: string
  }
  order_items: Array<{
    quantity: number
    product: {
      name: string
      product_code?: string
    }
  }>
}

export async function generateBatchPackingSlips(orders: PackingSlipData[]): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()
  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`
  }

  for (const order of orders) {
    const page = pdfDoc.addPage([595, 842])
    const { width, height } = page.getSize()

    const drawText = (
      text: string,
      x: number,
      y: number,
      opts: { size?: number; bold?: boolean; color?: [number, number, number] } = {}
    ) => {
      page.drawText(String(text), {
        x,
        y,
        size: opts.size ?? 10,
        font: opts.bold ? fontBold : font,
        color: opts.color ? rgb(...opts.color) : rgb(0.2, 0.2, 0.2),
      })
    }

    const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
      page.drawLine({
        start: { x: x1, y: y1 },
        end:   { x: x2, y: y2 },
        thickness: 0.5,
        color: rgb(0.7, 0.7, 0.7),
      })
    }

    let y = height - 50

    // ── Header ────────────────────────────────────────────
    drawText("Deb's Bakery",  50, y,      { size: 24, bold: true, color: [0, 0.416, 0.306] })
    drawText('(04) 1234-5678', 50, y - 25, { size: 10, color: [0.4, 0.4, 0.4] })

    // Centered "PACKING SLIP"
    drawText('PACKING SLIP', width / 2 - 60, y - 5, { size: 20, bold: true, color: [0.808, 0.067, 0.149] })

    y -= 70

    // ── Customer details ──────────────────────────────────
    drawText(
      `Customer: ${order.customer.business_name || order.customer.contact_name || 'Unknown'}`,
      50, y, { size: 12, bold: true }
    )
    y -= 18
    drawText(`Delivery Date: ${formatDate(order.delivery_date)}`, 50, y, { size: 11 })
    y -= 18
    drawText(`Order #: ${order.id.slice(0, 8)}`, 50, y, { size: 11 })

    y -= 25
    drawLine(50, y, width - 50, y)
    y -= 18

    // ── Table header ──────────────────────────────────────
    drawText('Item', 50,  y, { size: 10, bold: true })
    drawText('Qty',  400, y, { size: 10, bold: true })
    drawText('Code', 470, y, { size: 10, bold: true })
    y -= 14
    drawLine(50, y, width - 50, y)
    y -= 16

    // ── Items ─────────────────────────────────────────────
    for (const item of order.order_items) {
      const name = item.product.name.length > 45
        ? item.product.name.slice(0, 43) + '..'
        : item.product.name

      drawText(name,50,  y, { size: 10 })
      drawText(item.quantity.toString(),          400, y, { size: 10 })
      drawText(item.product.product_code || '-', 470, y, { size: 10 })
      y -= 18
    }

    // ── Footer ────────────────────────────────────────────
    drawText('Thank you for your order!', width / 2 - 60, 40, {
      size: 10,
      color: [0.4, 0.4, 0.4],
    })
  }

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}