import { NextResponse } from 'next/server'
import { StatementService } from '@/lib/services/statement-service'
import { subMonths, startOfMonth, endOfMonth } from 'date-fns'

// GET: Download statement PDF
export async function GET(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await params
    const { searchParams } = new URL(request.url)

    // Default: last month. Allow custom range via query params
    const monthsBack = parseInt(searchParams.get('months') || '1')
    const endDate = endOfMonth(subMonths(new Date(), monthsBack === 0 ? 0 : monthsBack - 1))
    const startDate = startOfMonth(subMonths(new Date(), monthsBack))

    const service = new StatementService()
    const data = await service.generateStatementData(customerId, startDate, endDate)
    const pdfBuffer = service.generateStatementPDF(data)

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="statement-${customerId.substring(0, 8)}.pdf"`
      }
    })
  } catch (error) {
    console.error('Statement PDF error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST: Email statement to customer
export async function POST(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await params
    const body = await request.json().catch(() => ({}))

    const monthsBack = body.months || 1
    const endDate = endOfMonth(subMonths(new Date(), monthsBack === 0 ? 0 : monthsBack - 1))
    const startDate = startOfMonth(subMonths(new Date(), monthsBack))

    const service = new StatementService()
    await service.emailStatement(customerId, startDate, endDate)

    return NextResponse.json({
      success: true,
      message: 'Statement emailed successfully'
    })
  } catch (error) {
    console.error('Email statement error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}