import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { parseWeekStart, getWeekDays } from '@/lib/week-utils'
import { format } from 'date-fns'

export async function GET(
  req: NextRequest,
  { params }: { params: { weekStart: string } }
) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const weekStart = parseWeekStart(params.weekStart)
  const weekDays = getWeekDays(weekStart)
  const dateFrom = format(weekDays[0], 'yyyy-MM-dd')
  const dateTo = format(weekDays[weekDays.length - 1], 'yyyy-MM-dd')

  // Temperature logs
  const { data: temps, error: tempError } = await supabase
    .from('temperature_log')
    .select('*')
    .gte('log_date', dateFrom)
    .lte('log_date', dateTo)
    .order('log_date')

  // Cash reconciliation
  const { data: cashRecon, error: reconError } = await supabase
    .from('cash_reconciliation')
    .select('*')
    .gte('recon_date', dateFrom)
    .lte('recon_date', dateTo)
    .order('recon_date')

  // Cash paid out items
  const { data: paidOuts, error: paidError } = await supabase
    .from('cash_paid_out')
    .select('*')
    .gte('paid_date', dateFrom)
    .lte('paid_date', dateTo)
    .order('paid_date')
    .order('sort_order')

  // Get previous day's carried forward
  const prevDate = format(new Date(weekDays[0].getTime() - 86400000), 'yyyy-MM-dd')
  const { data: prevRecon } = await supabase
    .from('cash_reconciliation')
    .select('carried_forward')
    .eq('shop_id', 'markets')
    .eq('recon_date', prevDate)
    .single()

  if (tempError || reconError || paidError) {
    console.error('Temperature API error:', tempError || reconError || paidError)
    return NextResponse.json({ error: 'Failed to load data' }, { status: 500 })
  }

  return NextResponse.json({
    temps: temps ?? [],
    cashRecon: cashRecon ?? [],
    paidOuts: paidOuts ?? [],
    previousCarriedForward: prevRecon?.carried_forward ?? 0,
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: { weekStart: string } }
) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { temps, cashRecon, paidOuts } = await req.json()

  // Upsert temperature logs
  if (temps && temps.length > 0) {
    const { error } = await supabase
      .from('temperature_log')
      .upsert(temps, { onConflict: 'shop_id,log_date' })
    if (error) {
      console.error('Temp upsert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  // Upsert cash reconciliation
  if (cashRecon && cashRecon.length > 0) {
    const { error } = await supabase
      .from('cash_reconciliation')
      .upsert(cashRecon, { onConflict: 'shop_id,recon_date' })
    if (error) {
      console.error('Cash recon upsert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  // Replace paid out items for the week
  if (paidOuts) {
    const weekStart = parseWeekStart(params.weekStart)
    const weekDays = getWeekDays(weekStart)
    const dateFrom = format(weekDays[0], 'yyyy-MM-dd')
    const dateTo = format(weekDays[weekDays.length - 1], 'yyyy-MM-dd')

    await supabase
      .from('cash_paid_out')
      .delete()
      .gte('paid_date', dateFrom)
      .lte('paid_date', dateTo)

    if (paidOuts.length > 0) {
      const { error } = await supabase
        .from('cash_paid_out')
        .insert(paidOuts)
      if (error) {
        console.error('Paid out insert error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }
  }

  return NextResponse.json({ success: true })
}