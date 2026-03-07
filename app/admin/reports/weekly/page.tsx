export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import WeeklyReportView from './weekly-report-view'

export default async function WeeklyReportPage() {
  const supabase = createAdminClient()

  // ── Weekly revenue summary ─────────────────────────────────────
  const { data: weeklyData } = await supabase
    .rpc('get_weekly_revenue')
    .limit(12)

  // Fallback if RPC doesn't exist — use raw query via JS
  const { data: orders } = await supabase
    .from('orders')
    .select('delivery_date, total_amount, status, customer_business_name, customer_id')
    .in('status', ['invoiced', 'pending'])
    .gte('delivery_date', '2026-01-01')
    .order('delivery_date', { ascending: false })

  // ── Group by week in JS ────────────────────────────────────────
  const weekMap = new Map<string, {
    week_start: string
    first_day: string
    last_day: string
    order_count: number
    revenue: number
    invoiced_revenue: number
    pending_revenue: number
    customer_count: number
    customers: Set<string>
  }>()

  for (const order of orders ?? []) {
    const date   = new Date(order.delivery_date + 'T00:00:00Z')
    const day    = date.getUTCDay() // 0=Sun, 1=Mon
    const diff   = (day === 0 ? -6 : 1) - day // adjust to Monday
    const monday = new Date(date)
    monday.setUTCDate(date.getUTCDate() + diff)
    const weekKey = monday.toISOString().split('T')[0]

    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, {
        week_start:        weekKey,
        first_day:         order.delivery_date,
        last_day:          order.delivery_date,
        order_count:       0,
        revenue:           0,
        invoiced_revenue:  0,
        pending_revenue:   0,
        customer_count:    0,
        customers:         new Set(),
      })
    }

    const week = weekMap.get(weekKey)!
    week.order_count++
    week.revenue += Number(order.total_amount ?? 0)
    if (order.status === 'invoiced') week.invoiced_revenue += Number(order.total_amount ?? 0)
    if (order.status === 'pending')  week.pending_revenue  += Number(order.total_amount ?? 0)
    if (order.customer_id) week.customers.add(order.customer_id)
    if (order.delivery_date < week.first_day) week.first_day = order.delivery_date
    if (order.delivery_date > week.last_day)  week.last_day  = order.delivery_date
  }

  const weeks = Array.from(weekMap.values())
    .map(w => ({ ...w, customer_count: w.customers.size, customers: undefined }))
    .sort((a, b) => b.week_start.localeCompare(a.week_start))
    .slice(0, 12)

  // ── Top products this week ─────────────────────────────────────
  const thisWeekStart = weeks[0]?.week_start
  const { data: topProducts } = await supabase
    .from('order_items')
    .select(`
      product_name,
      quantity,
      unit_price,
      subtotal,
      orders!inner ( delivery_date, status )
    `)
    .in('orders.status', ['invoiced', 'pending'])
    .gte('orders.delivery_date', thisWeekStart ?? '2026-01-01')

  // Group top products
  const productMap = new Map<string, { name: string; qty: number; revenue: number }>()
  for (const item of topProducts ?? []) {
    const name = item.product_name ?? 'Unknown'
    if (!productMap.has(name)) {
      productMap.set(name, { name, qty: 0, revenue: 0 })
    }
    const p = productMap.get(name)!
    p.qty     += Number(item.quantity ?? 0)
    p.revenue += Number(item.subtotal ?? 0)
  }

  const topProductsList = Array.from(productMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  return (
    <WeeklyReportView
      weeks={weeks}
      topProducts={topProductsList}
      thisWeekStart={thisWeekStart ?? ''}
    />
  )
}