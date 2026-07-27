import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient(
    process.env.DEBS_SUPABASE_URL!,
    process.env.DEBS_SUPABASE_KEY!
  )
  const { data, error } = await supabase
    .from('orders')
    .select('id, delivery_date')
    .gte('delivery_date', '2026-01-01')
    .limit(3)

  return NextResponse.json({ data, error })
}