export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { checkAdmin } from '@/lib/auth'
import { ArrowLeft } from 'lucide-react'
import ProductForm from '../components/product-form'
import ProductCostingPanel from './product-costing-panel'
import { createAdminClient } from '@/lib/supabase/admin'

async function calcCostPerGram(
  supabase: ReturnType<typeof createAdminClient>,
  recipeId: string
): Promise<number> {
  const { data: lines } = await supabase
    .from('recipe_lines')
    .select('quantity_grams, sub_qty_grams, ingredient_id, sub_recipe_id, ingredients ( unit_cost )')
    .eq('recipe_id', recipeId)

  if (!lines || lines.length === 0) return 0

  let totalCost = 0
  let totalWeight = 0

  for (const line of lines) {
    if (line.ingredient_id && line.ingredients) {
      const qty = Number(line.quantity_grams ?? 0)
      const cost = Number((line.ingredients as any).unit_cost ?? 0)
      totalCost += (qty / 1000) * cost
      totalWeight += qty
    } else if (line.sub_recipe_id) {
      const subCostPerGram = await calcCostPerGram(supabase, line.sub_recipe_id)
      const qty = Number(line.sub_qty_grams ?? 0)
      totalCost += qty * subCostPerGram
      totalWeight += qty
    }
  }

  return totalWeight > 0 ? totalCost / totalWeight : 0
}

async function getProduct(id: string) {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/products/${id}`,
    { cache: 'no-store' }
  )
  if (!response.ok) return null
  const data = await response.json()
  return data.product
}

async function getProductCosting(productId: string) {
  const supabase = createAdminClient()

  const { data: recipe } = await supabase
    .from('recipes')
    .select('id, name, batch_weight_grams, yield_qty')
    .eq('product_id', productId)
    .maybeSingle()

  if (!recipe) return null

  const { data: lines } = await supabase
    .from('recipe_lines')
    .select(`
      id,
      quantity_grams,
      sub_qty_grams,
      ingredient_id,
      sub_recipe_id,
      ingredients ( id, name, unit_cost, unit ),
      sub_recipes:recipes!recipe_lines_sub_recipe_id_fkey (
        id,
        name,
        products ( name )
      )
    `)
    .eq('recipe_id', recipe.id)
    .order('id', { ascending: true })

  const validLines = (lines ?? []).filter(
    (l) => l.ingredient_id !== null || l.sub_recipe_id !== null
  )

  const subRecipeCosts: Record<string, number> = {}
  for (const line of validLines) {
    if (line.sub_recipe_id && !subRecipeCosts[line.sub_recipe_id]) {
      subRecipeCosts[line.sub_recipe_id] = await calcCostPerGram(
        supabase,
        line.sub_recipe_id
      )
    }
  }

  const { data: costSettings } = await supabase
    .from('cost_settings')
    .select('setting_key, value')

  const settingsMap: Record<string, number> = {}
  for (const s of costSettings ?? []) {
    settingsMap[s.setting_key] = Number(s.value)
  }

  return {
    recipe,
    lines: validLines,
    subRecipeCosts,
    labourPct: settingsMap['labour_pct'] ?? 30,
    overheadPerKg: settingsMap['overhead_per_kg'] ?? 2,
  }
}

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const isAdmin = await checkAdmin()
  if (!isAdmin) redirect('/')

  const { id } = await params
  const [product, costing] = await Promise.all([
    getProduct(id),
    getProductCosting(id),
  ])

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
          <p className="text-red-700 font-semibold text-lg">Product not found</p>
          <a
            href="/admin/products"
            className="inline-block mt-4 text-red-600 hover:underline"
          >
            Back to products
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <a
        href="/admin/products"
        className="flex items-center gap-1 text-sm mb-4 hover:opacity-80"
        style={{ color: '#CE1126' }}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Products
      </a>

      <h1 className="text-3xl font-bold mb-8">
        Edit Product: {product.name}
      </h1>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
        <div className="max-w-2xl w-full">
          <ProductForm product={product} isEditing={true} />
        </div>
        <div>
          <ProductCostingPanel
            productId={id}
            productPrice={Number(product.price)}
            productWeightGrams={product.weight_grams ? Number(product.weight_grams) : null}
            productLabourPct={product.labour_pct ? Number(product.labour_pct) : null}
            costing={costing}
          />
        </div>
      </div>
    </div>
  )
}