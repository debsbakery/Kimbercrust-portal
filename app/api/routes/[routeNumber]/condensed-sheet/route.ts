import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

export async function GET(
  request: Request,
  context: { params: Promise<{ routeNumber: string }> }
) {
  try {
    const { routeNumber } = await context.params
    const { searchParams } = new URL(request.url)
    const deliveryDate = searchParams.get('date') || new Date().toISOString().split('T')[0]

    const supabase = await createClient()

    const { data: route } = await supabase
      .from('routes')
      .select('*')
      .eq('route_number', routeNumber)
      .single()

    if (!route) {
      return NextResponse.json({ error: 'Route not found' }, { status: 404 })
    }

    const { data: customers } = await supabase
      .from('customers')
      .select(`
        id,
        business_name,
        contact_name,
        address,
        phone,
        drop_number,
        orders!inner(
          id,
          total_amount,
          order_items(
            id,
            quantity,
            product_name
          )
        )
      `)
      .eq('route_number', routeNumber)
      .eq('orders.delivery_date', deliveryDate)
      .order('drop_number', { ascending: true })

    // ── Build PDF ────────────────────────────────────────────
    const pdfDoc = await PDFDocument.create()
    const font     = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    let page = pdfDoc.addPage([595, 842])
    const { width, height } = page.getSize()
    let y = height - 40

    const drawText = (
      text: string,
      x: number,
      yPos: number,
      opts: { size?: number; bold?: boolean; color?: [number, number, number]; width?: number } = {}
    ) => {
      // Truncate if width provided to prevent overflow
      let str = String(text)
      if (opts.width) {
        const maxChars = Math.floor(opts.width / ((opts.size ?? 9) * 0.55))
        if (str.length > maxChars) str = str.slice(0, maxChars - 2) + '..'
      }
      page.drawText(str, {
        x,
        y: yPos,
        size: opts.size ?? 9,
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

    const formattedDate = new Date(deliveryDate).toLocaleDateString('en-AU', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    })

    // ── Header ───────────────────────────────────────────────
    drawText('Condensed Run Sheet', width / 2 - 70, y, { size: 18, bold: true, color: [0, 0.416, 0.306] })
    y -= 22
    drawText(`Route: ${route.route_name || route.route_number}`, width / 2 - 50, y, { size: 12 })
    y -= 16
    drawText(`Driver: ${route.driver_name || '-'}`, width / 2 - 40, y, { size: 12 })
    y -= 16
    drawText(formattedDate, width / 2 - 80, y, { size: 11 })
    y -= 20
    drawLine(40, y, width - 40, y)
    y -= 18

    // ── Table header ─────────────────────────────────────────
    drawText('Drop',     40,  y, { size: 10, bold: true })
    drawText('Customer', 80,  y, { size: 10, bold: true })
    drawText('Address',  250, y, { size: 10, bold: true })
    drawText('Items',    440, y, { size: 10, bold: true })
    drawText('Total',    500, y, { size: 10, bold: true })
    y -= 14
    drawLine(40, y, width - 40, y)
    y -= 16

    // ── Rows ─────────────────────────────────────────────────
    if (!customers || customers.length === 0) {
      drawText('No deliveries for this route on this date.', 40, y, { size: 10 })
    } else {
      for (const customer of customers as any[]) {
        if (y < 60) {
          page = pdfDoc.addPage([595, 842])
          y = height - 40
        }

        const totalItems = customer.orders[0]?.order_items?.reduce(
          (sum: number, item: any) => sum + item.quantity, 0
        ) || 0

        const totalAmount = parseFloat(customer.orders[0]?.total_amount || '0')

        drawText(customer.drop_number?.toString() || '-', 40,  y, { size: 9 })
        drawText(customer.business_name || customer.contact_name || '-', 80,  y, { size: 9, width: 160 })
        drawText(customer.address || '-', 250, y, { size: 9, width: 180 })
        drawText(`${totalItems} items`, 440, y, { size: 9 })
        drawText(`$${totalAmount.toFixed(2)}`, 500, y, { size: 9 })

        y -= 20
      }
    }

    // ── Footer ───────────────────────────────────────────────
    drawText(
      `Generated: ${new Date().toLocaleString('en-AU')}`,
      40, 25,
      { size: 8, color: [0.5, 0.5, 0.5] }
    )

    const pdfBytes = await pdfDoc.save()

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="condensed-run-sheet-${routeNumber}-${deliveryDate}.pdf"`,
      },
    })

  } catch (error: any) {
    console.error('Condensed sheet error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}