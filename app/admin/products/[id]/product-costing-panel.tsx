'use client'

import { ExternalLink, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react'

interface IngredientRow {
  id: string
  quantity_grams: number | null
  sub_qty_grams: number | null
  ingredient_id: string | null
  sub_recipe_id: string | null
  ingredients: {
    id: string
    name: string
    unit_cost: number
    unit: string
  } | null
  sub_recipes: {
    id: string
    name: string | null
    products: { name: string } | null
  } | null
}

interface CostingData {
  recipe: {
    id: string
    name: string | null
    batch_weight_grams: number | null
    yield_qty: number | null
  }
  lines: IngredientRow[]
  subRecipeCosts: Record<string, number>
  labourPct: number
  overheadPerKg: number
}

interface Props {
  productId: string
  productPrice: number
  productWeightGrams: number | null
  productLabourPct: number | null
  costing: CostingData | null
}

function calcLineCost(line: IngredientRow, subRecipeCosts: Record<string, number>): number {
  if (line.ingredient_id && line.ingredients) {
    return ((line.quantity_grams ?? 0) / 1000) * Number(line.ingredients.unit_cost)
  }
  if (line.sub_recipe_id && subRecipeCosts[line.sub_recipe_id]) {
    return (line.sub_qty_grams ?? 0) * subRecipeCosts[line.sub_recipe_id]
  }
  return 0
}

export default function ProductCostingPanel({
  productId,
  productPrice,
  productWeightGrams,
  productLabourPct,
  costing,
}: Props) {

  if (!costing) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Costing Summary</h2>
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">No recipe linked</p>
            <p className="text-sm text-amber-700 mt-1">
              Create a recipe in the costings section to see ingredient costs and margin analysis.
            </p>
            <a
              href="/admin/costings/recipes"
              className="inline-flex items-center gap-1 mt-3 text-sm font-semibold text-amber-700 hover:text-amber-900 underline"
            >
              Go to Recipes
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    )
  }

  const { recipe, lines, subRecipeCosts, labourPct, overheadPerKg } = costing

  const totalIngredientCost = lines.reduce(
    (sum, line) => sum + calcLineCost(line, subRecipeCosts),
    0
  )
  const totalWeightGrams = lines.reduce(
    (sum, line) => sum + (line.quantity_grams ?? line.sub_qty_grams ?? 0),
    0
  )
  const costPerKg = totalWeightGrams > 0
    ? totalIngredientCost / (totalWeightGrams / 1000)
    : 0

  const effectiveLabourPct = productLabourPct ?? labourPct
  const productWeight = productWeightGrams ?? 0

  const ingredientCostPerUnit = productWeight > 0
    ? (productWeight / 1000) * costPerKg
    : null

  const overheadCostPerUnit = productWeight > 0
    ? (productWeight / 1000) * overheadPerKg
    : null

  const labourCostPerUnit = ingredientCostPerUnit !== null
    ? (effectiveLabourPct / 100) * productPrice
    : null

  const totalCostPerUnit =
    ingredientCostPerUnit !== null &&
    overheadCostPerUnit !== null &&
    labourCostPerUnit !== null
      ? ingredientCostPerUnit + overheadCostPerUnit + labourCostPerUnit
      : null

  const margin = totalCostPerUnit !== null ? productPrice - totalCostPerUnit : null
  const marginPct = margin !== null && productPrice > 0
    ? (margin / productPrice) * 100
    : null

  const isGoodMargin = marginPct !== null && marginPct >= 20

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">

      {/* Header */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Costing Summary</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Recipe: {recipe.name ?? 'Unnamed'}
          </p>
        </div>
        <a
          href={'/admin/costings/recipes/' + recipe.id}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-indigo-300 text-indigo-700 hover:bg-indigo-50 transition-colors"
        >
          Edit Recipe
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* Ingredient Lines Table */}
      {lines.length === 0 ? (
        <div className="px-6 py-8 text-center text-gray-400 text-sm">
          No ingredients on this recipe yet.{' '}
          <a
            href={'/admin/costings/recipes/' + recipe.id}
            className="text-indigo-600 hover:underline"
          >
            Add ingredients
          </a>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Ingredient
              </th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Qty
              </th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Unit Cost
              </th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Line Cost
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lines.map((line) => {
              const lineCost = calcLineCost(line, subRecipeCosts)
              const ingName = line.ingredients?.name
                ?? line.sub_recipes?.name
                ?? line.sub_recipes?.products?.name
                ?? 'Unknown'
              const qty = line.quantity_grams ?? line.sub_qty_grams ?? 0
              const unitCost = line.ingredients
                ? Number(line.ingredients.unit_cost)
                : null
              const subCostPerKg = line.sub_recipe_id && subRecipeCosts[line.sub_recipe_id]
                ? subRecipeCosts[line.sub_recipe_id] * 1000
                : null

              return (
                <tr key={line.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-900">
                    {ingName}
                    {line.sub_recipe_id && (
                      <span className="ml-1.5 text-xs text-indigo-500">(sub-recipe)</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-gray-600">
                    {qty.toLocaleString()}g
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-500 text-xs">
                    {unitCost !== null
                      ? '$' + unitCost.toFixed(4) + '/kg'
                      : subCostPerKg !== null
                        ? '$' + subCostPerKg.toFixed(4) + '/kg'
                        : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                    ${lineCost.toFixed(4)}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="border-t-2 border-gray-300 bg-gray-50">
            <tr>
              <td className="px-4 py-2.5 font-bold text-gray-800">Batch Total</td>
              <td className="px-4 py-2.5 text-right font-mono font-semibold text-gray-800">
                {totalWeightGrams.toLocaleString()}g
              </td>
              <td></td>
              <td className="px-4 py-2.5 text-right font-bold text-gray-900">
                ${totalIngredientCost.toFixed(4)}
              </td>
            </tr>
            <tr>
              <td colSpan={3} className="px-4 py-1.5 text-xs text-indigo-600 font-semibold">
                Ingredient cost per kg
              </td>
              <td className="px-4 py-1.5 text-right text-xs font-bold text-indigo-600">
                ${costPerKg.toFixed(4)}/kg
              </td>
            </tr>
          </tfoot>
        </table>
      )}

      {/* Per-Unit Breakdown */}
      <div className="px-6 py-5 border-t border-gray-200 space-y-3">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
          Per Unit Analysis
        </h3>

        {productWeight === 0 ? (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700">
              Set <strong>Weight (grams)</strong> on this product to calculate per-unit costs and margin.
            </p>
          </div>
        ) : (
          <div className="space-y-2">

            <div className="grid grid-cols-2 gap-x-4 text-sm">
              <span className="text-gray-600">Product weight</span>
              <span className="text-right font-mono font-semibold text-gray-800">
                {productWeight.toLocaleString()}g
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 text-sm">
              <span className="text-gray-600">Ingredient cost / unit</span>
              <span className="text-right font-mono font-semibold text-gray-800">
                {ingredientCostPerUnit !== null
                  ? '$' + ingredientCostPerUnit.toFixed(4)
                  : '—'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 text-sm">
              <span className="text-gray-600">
                Overhead / unit
                <span className="text-xs text-gray-400 ml-1">
                  (${overheadPerKg.toFixed(2)}/kg)
                </span>
              </span>
              <span className="text-right font-mono font-semibold text-gray-800">
                {overheadCostPerUnit !== null
                  ? '$' + overheadCostPerUnit.toFixed(4)
                  : '—'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 text-sm">
              <span className="text-gray-600">
                Labour / unit
                <span className="text-xs text-gray-400 ml-1">
                  ({effectiveLabourPct.toFixed(0)}% of sell price
                  {productLabourPct !== null ? ' - product override' : ' - global default'})
                </span>
              </span>
              <span className="text-right font-mono font-semibold text-gray-800">
                {labourCostPerUnit !== null
                  ? '$' + labourCostPerUnit.toFixed(4)
                  : '—'}
              </span>
            </div>

            <div className="border-t border-gray-200 pt-2 grid grid-cols-2 gap-x-4 text-sm">
              <span className="font-bold text-gray-800">Total cost / unit</span>
              <span className="text-right font-mono font-bold text-gray-900">
                {totalCostPerUnit !== null
                  ? '$' + totalCostPerUnit.toFixed(4)
                  : '—'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 text-sm">
              <span className="text-gray-600">Sell price</span>
              <span className="text-right font-mono font-semibold text-gray-800">
                ${productPrice.toFixed(2)}
              </span>
            </div>

            {margin !== null && marginPct !== null && (
              <div className={
                'mt-2 p-3 rounded-lg flex items-center justify-between ' +
                (isGoodMargin
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200')
              }>
                <div className="flex items-center gap-2">
                  {isGoodMargin
                    ? <TrendingUp className="h-4 w-4 text-green-600" />
                    : <TrendingDown className="h-4 w-4 text-red-500" />
                  }
                  <span className={
                    'text-sm font-bold ' +
                    (isGoodMargin ? 'text-green-800' : 'text-red-700')
                  }>
                    Margin
                  </span>
                </div>
                <div className="text-right">
                  <span className={
                    'text-base font-bold font-mono ' +
                    (isGoodMargin ? 'text-green-700' : 'text-red-600')
                  }>
                    ${margin.toFixed(4)}
                  </span>
                  <span className={
                    'ml-2 text-sm font-semibold ' +
                    (isGoodMargin ? 'text-green-600' : 'text-red-500')
                  }>
                    ({marginPct.toFixed(1)}%)
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
        <p className="text-xs text-gray-400">
          Labour and overhead from{' '}
          <a href="/admin/costings/settings" className="underline hover:text-gray-600">
            cost settings
          </a>
          . Labour uses product override if set, otherwise global default.
        </p>
      </div>

    </div>
  )
}