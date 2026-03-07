import { createAdminClient } from '@/lib/supabase/admin'

export interface ProductCosting {
  product_id: string
  product_name: string
  product_code: string | null
  sale_price: number
  weight_grams: number | null
  has_recipe: boolean
  ingredient_cost: number | null
  labour_cost: number | null
  overhead_cost: number | null
  total_cost: number | null
  net_profit: number | null
  margin_pct: number | null
  ingredient_lines: IngredientLine[]
}

export interface IngredientLine {
  name: string
  quantity_grams: number
  cost: number
  is_sub_recipe: boolean
}

// ── Recursively calculate cost per gram for a recipe ──────────────
export async function calcCostPerGram(
  supabase: ReturnType<typeof createAdminClient>,
  recipeId: string,
  depth = 0
): Promise<number> {
  if (depth > 3) return 0

  const { data: lines } = await supabase
    .from('recipe_lines')
    .select(`
      quantity_grams,
      sub_qty_grams,
      ingredient_id,
      sub_recipe_id,
      ingredients ( unit_cost )
    `)
    .eq('recipe_id', recipeId)

  if (!lines || lines.length === 0) return 0

  let totalCost   = 0
  let totalWeight = 0

  for (const line of lines) {
    if (line.ingredient_id && line.ingredients) {
      const qty  = Number(line.quantity_grams ?? 0)
      const cost = Number((line.ingredients as any).unit_cost ?? 0)
      totalCost   += (qty / 1000) * cost
      totalWeight += qty
    } else if (line.sub_recipe_id) {
      const subCostPerGram = await calcCostPerGram(supabase, line.sub_recipe_id, depth + 1)
      const qty = Number(line.sub_qty_grams ?? 0)
      totalCost   += qty * subCostPerGram
      totalWeight += qty
    }
  }

  return totalWeight > 0 ? totalCost / totalWeight : 0
}

// ── Flatten all ingredients (explode sub-recipes) ─────────────────
export async function flattenIngredients(
  supabase: ReturnType<typeof createAdminClient>,
  recipeId: string,
  scaleFactor = 1,
  depth = 0
): Promise<IngredientLine[]> {
  if (depth > 3) return []

  const { data: lines } = await supabase
    .from('recipe_lines')
    .select(`
      quantity_grams,
      sub_qty_grams,
      ingredient_id,
      sub_recipe_id,
      ingredients ( name, unit_cost )
    `)
    .eq('recipe_id', recipeId)

  if (!lines) return []

  const result: IngredientLine[] = []

  for (const line of lines) {
    if (line.ingredient_id && line.ingredients) {
      const ing = line.ingredients as any
      const qty = Number(line.quantity_grams ?? 0) * scaleFactor
      result.push({
        name:           ing.name,
        quantity_grams: qty,
        cost:           (qty / 1000) * Number(ing.unit_cost ?? 0),
        is_sub_recipe:  false,
      })
    } else if (line.sub_recipe_id) {
      const subQty = Number(line.sub_qty_grams ?? 0)

      const { data: subLines } = await supabase
        .from('recipe_lines')
        .select('quantity_grams, sub_qty_grams')
        .eq('recipe_id', line.sub_recipe_id)

      const subTotalWeight = (subLines ?? []).reduce((s, l) =>
        s + Number(l.quantity_grams ?? l.sub_qty_grams ?? 0), 0)

      const subScale = subTotalWeight > 0
        ? (subQty / subTotalWeight) * scaleFactor
        : 0

      const subIngredients = await flattenIngredients(
        supabase, line.sub_recipe_id, subScale, depth + 1
      )
      result.push(...subIngredients)
    }
  }

  return result
}

// ── Calculate full costing for one product ────────────────────────
export async function calcProductCosting(
  supabase: ReturnType<typeof createAdminClient>,
  product: any,
  recipe: any,
  globalLabourPct: number,
  overheadPerKg: number
): Promise<ProductCosting> {
  const salePrice   = Number(product.price ?? 0)
  const weightGrams = product.weight_grams ? Number(product.weight_grams) : null
  const labourPct   = product.labour_pct != null
    ? Number(product.labour_pct)
    : globalLabourPct

  let ingredientCost: number | null = null
  let ingredientLines: IngredientLine[] = []

  if (recipe) {
    const costPerGram = await calcCostPerGram(supabase, recipe.id)
    ingredientCost = weightGrams != null
      ? weightGrams * costPerGram
      : null

    if (weightGrams) {
      const { data: subLines } = await supabase
        .from('recipe_lines')
        .select('quantity_grams, sub_qty_grams')
        .eq('recipe_id', recipe.id)

      const recipeTotalWeight = (subLines ?? []).reduce((s: number, l: any) =>
        s + Number(l.quantity_grams ?? l.sub_qty_grams ?? 0), 0)

      const scaleFactor = recipeTotalWeight > 0
        ? weightGrams / recipeTotalWeight
        : 0

      ingredientLines = await flattenIngredients(supabase, recipe.id, scaleFactor)
    }
  }

  // ✅ Labour + overhead calculate independently — no recipe needed
  const labourCost   = salePrice > 0
    ? salePrice * labourPct / 100
    : null

  const overheadCost = weightGrams != null
    ? (weightGrams / 1000) * overheadPerKg
    : null

  // ✅ Total shows if labour + overhead available
  // Ingredient cost treated as 0 if no recipe yet
  const canCalcTotal = labourCost != null && overheadCost != null
  const totalCost    = canCalcTotal
    ? (ingredientCost ?? 0) + labourCost + overheadCost
    : null

  const netProfit = totalCost != null
    ? salePrice - totalCost
    : null

  const marginPct = totalCost != null && salePrice > 0
    ? ((salePrice - totalCost) / salePrice) * 100
    : null

  return {
    product_id:       product.id,
    product_name:     product.name,
    product_code:     product.code,
    sale_price:       salePrice,
    weight_grams:     weightGrams,
    has_recipe:       !!recipe,
    ingredient_cost:  ingredientCost,
    labour_cost:      labourCost,
    overhead_cost:    overheadCost,
    total_cost:       totalCost,
    net_profit:       netProfit,
    margin_pct:       marginPct,
    ingredient_lines: ingredientLines,
  }
}