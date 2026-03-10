export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to   = searchParams.get('to')

  let query = supabase
    .from('credit_memo_items')
    .select(`
      product_name,
      product_code,
      quantity,
      unit_price,
      credit_percent,
      line_total,
      credit_memo:credit_memos(
        memo_number,
        created_at,
        customer:customers(business_name, contact_name)
      )
    `)
    .eq('credit_type', 'stale_return')
    .order('product_name')

  if (from) query = query.gte('credit_memos.created_at', from)
  if (to)   query = query.lte('credit_memos.created_at', to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Group by product for summary
  const byProduct: Record<string, any> = {}
  for (const item of data || []) {
    const key = item.product_name
    if (!byProduct[key]) {
      byProduct[key] = {
        product_name: item.product_name,
        product_code: item.product_code,
        total_quantity: 0,
        total_value: 0,
        occurrences: 0,
      }
    }
    byProduct[key].total_quantity += item.quantity
    byProduct[key].total_value    += Math.abs(item.line_total)
    byProduct[key].occurrences    += 1
  }

  return NextResponse.json({
    items: data,
    summary: Object.values(byProduct).sort((a, b) => b.total_value - a.total_value),
    total_value: data?.reduce((s, i) => s + Math.abs(i.line_total), 0) || 0,})
}
