export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { checkAdmin } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import CrossPortalView from './cross-portal-view'

const PORTALS = [
  {
    key: 'kimbercrust',
    label: 'Kimbercrust',
    url:  process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key_: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    color: '#006A4E',
  },
  {
    key: 'norbake',
    label: 'Norbake',
    url:  process.env.NORBAKE_SUPABASE_URL!,
    key_: process.env.NORBAKE_SUPABASE_KEY!,
    color: '#1d4ed8',
  },
  {
    key: 'debs',
    label: 'Debs',
    url:  process.env.DEBS_SUPABASE_URL!,
    key_: process.env.DEBS_SUPABASE_KEY!,
    color: '#b45309',
  },
  {
    key: 'stods',
    label: 'Stods',
    url:  process.env.STODS_SUPABASE_URL!,
    key_: process.env.STODS_SUPABASE_KEY!,
    color: '#7c3aed',
  },
]

function getWeekStart(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00Z')
  const day = date.getUTCDay()
  date.setUTCDate(date.getUTCDate() - day)
  return date.toISOString().split('T')[0]
}

async function fetchPortalData(portal: typeof PORTALS[0]) {
  const supabase = createClient(portal.url, portal.key_)

  const weekMap = new Map<string, {
    order_revenue: number
    ingredient_cost: number
    overhead: number
    bakery_wages: number
    shop_total_sales: number
    shop_wages: number
    shop_purchases: number
    shop_overhead: number
  }>()

  function ensureWeek(ws: string) {
    if (!weekMap.has(ws)) {
      weekMap.set(ws, {
        order_revenue: 0, ingredient_cost: 0, overhead: 0,
        bakery_wages: 0, shop_total_sales: 0, shop_wages: 0,
        shop_purchases: 0, shop_overhead: 0,
      })
    }
    return weekMap.get(ws)!
  }

  // Cost settings
  const { data: costSettings } = await supabase
    .from('cost_settings')
    .select('setting_key, value')

  const overheadPerKg = Number(
    costSettings?.find((s: any) => s.setting_key === 'overhead_per_kg')?.value ?? 1.50
  )

  // Report settings
  const { data: reportSettings } = await supabase
    .from('report_settings')
    .select('weekly_overhead')
    .single()

  const shopWeeklyOverhead = Number(reportSettings?.weekly_overhead ?? 0)

  // Products weight
  const { data: products } = await supabase
    .from('products')
    .select('id, weight_grams')

  const productWeightMap = new Map<string, number>()
  for (const p of products ?? []) {
    if (p.weight_grams) productWeightMap.set(p.id, Number(p.weight_grams))
  }

  // Recipe costs
  const { data: recipes } = await supabase
    .from('recipes')
    .select('id, product_id')
    .not('product_id', 'is', null)

  const productRecipeMap = new Map<string, string>()
  const allRecipeIds: string[] = []
  for (const r of recipes ?? []) {
    if (r.product_id) {
      productRecipeMap.set(r.product_id, r.id)
      allRecipeIds.push(r.id)
    }
  }

  const productIngCostMap = new Map<string, number>()

  if (allRecipeIds.length > 0) {
    const { data: topLines } = await supabase
      .from('recipe_lines')
      .select('recipe_id, ingredient_id, quantity_grams, sub_recipe_id, sub_qty_grams, ingredients ( unit_cost )')
      .in('recipe_id', allRecipeIds)

    const subRecipeIds = [...new Set(
      (topLines ?? []).filter((l: any) => l.sub_recipe_id).map((l: any) => l.sub_recipe_id as string)
    )]

    let subLines: any[] = []
    if (subRecipeIds.length > 0) {
      const { data } = await supabase
        .from('recipe_lines')
        .select('recipe_id, ingredient_id, quantity_grams, sub_recipe_id, sub_qty_grams, ingredients ( unit_cost )')
        .in('recipe_id', subRecipeIds)
      subLines = data ?? []
    }

    const linesByRecipe = new Map<string, any[]>()
    for (const line of [...(topLines ?? []), ...subLines]) {
      if (!linesByRecipe.has(line.recipe_id)) linesByRecipe.set(line.recipe_id, [])
      linesByRecipe.get(line.recipe_id)!.push(line)
    }

    function calcCpg(recipeId: string, depth = 0): number {
      if (depth > 3) return 0
      const lines = linesByRecipe.get(recipeId) ?? []
      let totalCost = 0, totalWeight = 0
      for (const line of lines) {
        if (line.ingredient_id && line.ingredients) {
          const qty = Number(line.quantity_grams ?? 0)
          totalCost += (qty / 1000) * Number(line.ingredients.unit_cost ?? 0)
          totalWeight += qty
        } else if (line.sub_recipe_id) {
          const subCpg = calcCpg(line.sub_recipe_id, depth + 1)
          const qty = Number(line.sub_qty_grams ?? 0)
          totalCost += qty * subCpg
          totalWeight += qty
        }
      }
      return totalWeight > 0 ? totalCost / totalWeight : 0
    }

    for (const [productId, recipeId] of productRecipeMap.entries()) {
      const productWeight = productWeightMap.get(productId)
      if (!productWeight) continue
      const lines = linesByRecipe.get(recipeId) ?? []
      const recipeWeight = lines.reduce((s: number, l: any) =>
        s + Number(l.quantity_grams ?? l.sub_qty_grams ?? 0), 0)
      if (recipeWeight < productWeight * 0.5) continue
      const cpg = calcCpg(recipeId)
      if (cpg > 0) productIngCostMap.set(productId, productWeight * cpg)
    }
  }

  // Order items
  let rawItems: any[] = []
  let from = 0
  while (true) {
    const { data: page, error } = await supabase
      .from('order_items')
      .select('subtotal, quantity, product_id, gst_applicable, orders!inner ( delivery_date, status )')
      .gte('orders.delivery_date', '2026-01-01')
      .range(from, from + 999)
    if (error || !page || page.length === 0) break
    rawItems = rawItems.concat(page)
    if (page.length < 1000) break
    from += 1000
  }

  for (const item of rawItems) {
    const order = item.orders as any
    if (!order?.delivery_date || order.status === 'cancelled') continue
    const ws = getWeekStart(order.delivery_date)
    const week = ensureWeek(ws)
    const subtotal = Number(item.subtotal ?? 0)
    const exGst = item.gst_applicable ? subtotal / 1.1 : subtotal
    week.order_revenue += exGst
    const ingCost = item.product_id ? productIngCostMap.get(item.product_id) : undefined
    week.ingredient_cost += ingCost ? ingCost * Number(item.quantity ?? 1) : exGst * 0.30
    const wg = item.product_id ? productWeightMap.get(item.product_id) : undefined
    if (wg) week.overhead += (Number(item.quantity ?? 1) * wg / 1000) * overheadPerKg
  }

  // Shop daily reports
  const { data: dailyReports } = await supabase
    .from('shop_daily_reports')
    .select('report_date, sales')
    .gte('report_date', '2026-01-01')

  for (const r of dailyReports ?? []) {
    const ws = getWeekStart(r.report_date)
    ensureWeek(ws).shop_total_sales += Number(r.sales || 0)
  }

  // Bakery wages
  const { data: bakeryWages } = await supabase
    .from('weekly_wages')
    .select('week_start, wages')
  for (const w of bakeryWages ?? []) {
    ensureWeek(w.week_start).bakery_wages = Number(w.wages || 0)
  }

  // Shop wages
  const { data: shopWages } = await supabase
    .from('shop_weekly_wages')
    .select('week_start, wages')
  for (const w of shopWages ?? []) {
    ensureWeek(w.week_start).shop_wages += Number(w.wages || 0)
  }

  // Shop purchases
  const { data: shopPurchases } = await supabase
    .from('shop_weekly_purchases')
    .select('week_start, amount')
  for (const p of shopPurchases ?? []) {
    ensureWeek(p.week_start).shop_purchases += Number(p.amount || 0)
  }

  // Shop overhead
  for (const week of weekMap.values()) {
    week.shop_overhead = shopWeeklyOverhead
  }

  return {
    key:   portal.key,
    label: portal.label,
    color: portal.color,
    weeks: Object.fromEntries(
      Array.from(weekMap.entries()).map(([ws, w]) => [ws, {
        ...w,
        order_revenue:    Math.round(w.order_revenue    * 100) / 100,
        ingredient_cost:  Math.round(w.ingredient_cost  * 100) / 100,
        overhead:         Math.round(w.overhead         * 100) / 100,
        shop_total_sales: Math.round(w.shop_total_sales * 100) / 100,
        bakery_wages:     Math.round(w.bakery_wages     * 100) / 100,
        shop_wages:       Math.round(w.shop_wages       * 100) / 100,
        shop_purchases:   Math.round(w.shop_purchases   * 100) / 100,
        shop_overhead:    Math.round(w.shop_overhead    * 100) / 100,
      }])
    ),
  }
}

export default async function CrossPortalPage() {
  const isAdmin = await checkAdmin()
  if (!isAdmin) redirect('/')

  const results = await Promise.all(PORTALS.map(fetchPortalData))

  // Collect all week starts
  const allWeekStarts = [...new Set(
    results.flatMap(r => Object.keys(r.weeks))
  )].sort((a, b) => b.localeCompare(a))

  const todayStr = new Date().toISOString().split('T')[0]
  const weeks = allWeekStarts
    .filter(ws => ws <= todayStr)
    .map(ws => ({
      week_start: ws,
      portals: results.map(r => ({
        key:   r.key,
        label: r.label,
        color: r.color,
        data:  r.weeks[ws] ?? null,
      })),
    }))

  return (
    <div className="container mx-auto px-4 py-8 max-w-full">
      <a href="/admin/reports/summary" className="flex items-center gap-1 text-sm mb-4 hover:opacity-80" style={{ color: '#CE1126' }}>
        <ArrowLeft className="h-4 w-4" />
        Back to Summary
      </a>
      <CrossPortalView weeks={weeks} portals={results.map(r => ({ key: r.key, label: r.label, color: r.color }))} />
    </div>
  )
}