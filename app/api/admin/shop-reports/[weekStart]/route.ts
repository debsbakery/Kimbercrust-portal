import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { parseWeekStart, getWeekEnd, formatWeekStart } from '@/lib/week-utils'
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
  const weekEnd   = getWeekEnd(weekStart)
  const wsStr     = formatWeekStart(weekStart)

  const [
    { data: shops },
    { data: daily },
    { data: wages },
    { data: settings },
    { data: purchases },
  ] = await Promise.all([
    supabase.from('shops')
      .select('*')
      .eq('is_active', true)
      .order('sort_order'),
    supabase.from('shop_daily_reports')
      .select('*')
      .gte('report_date', wsStr)
      .lte('report_date', format(weekEnd, 'yyyy-MM-dd')),
    supabase.from('shop_weekly_wages')
      .select('*')
      .eq('week_start', wsStr),
    supabase.from('report_settings')
      .select('*')
      .single(),
    supabase.from('shop_weekly_purchases')
      .select('*')
      .eq('week_start', wsStr),
  ])

  return NextResponse.json({
    shops:     shops     ?? [],
    daily:     daily     ?? [],
    wages:     wages     ?? [],
    settings:  settings  ?? null,
    purchases: purchases ?? [],
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

  const { dailyRows, wageRows, purchaseRows } = await req.json()

   if (dailyRows?.length) {
    // Strip undefined/null id fields so Supabase uses default gen_random_uuid()
    const cleanDaily = dailyRows.map((r: any) => {
      const { id, created_at, updated_at, created_by, notes, ...rest } = r
      return id ? { id, ...rest } : rest
    })
    const { error } = await supabase
      .from('shop_daily_reports')
      .upsert(cleanDaily, { onConflict: 'shop_id,report_date' })
    if (error) {
      console.error('[daily upsert]', error, 'rows:', JSON.stringify(dailyRows).slice(0, 800))
      return NextResponse.json({ error: error.message, where: 'daily', detail: error }, { status: 500 })
    }
  }

   if (wageRows?.length) {
    const cleanWages = wageRows.map((r: any) => {
      const { id, created_at, updated_at, created_by, ...rest } = r
      return id ? { id, ...rest } : rest
    })
    const { error } = await supabase
      .from('shop_weekly_wages')
      .upsert(cleanWages, { onConflict: 'shop_id,week_start' })
    if (error) {
      console.error('[wages upsert]', error, 'rows:', JSON.stringify(wageRows).slice(0, 800))
      return NextResponse.json({ error: error.message, where: 'wages', detail: error }, { status: 500 })
    }
  }

  if (purchaseRows?.length) {
    const { error } = await supabase
      .from('shop_weekly_purchases')
      .upsert(purchaseRows, { onConflict: 'week_start,supplier' })
    if (error) {
      console.error('[purchases upsert]', error, 'rows:', JSON.stringify(purchaseRows).slice(0, 800))
      return NextResponse.json({ error: error.message, where: 'purchases', detail: error }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}