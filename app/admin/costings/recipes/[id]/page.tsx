export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import RecipeBuilder from './recipe-builder'

export default async function RecipeBuilderPage({ params }: { params: { id: string } }) {
  const supabase = createAdminClient()

  const { data: recipe, error } = await supabase
    .from('recipes')
    .select(`
      *,
      products (
        id,
        name,
        code,
        weight_grams
      )
    `)
    .eq('id', params.id)
    .single()

  if (error || !recipe) return notFound()

  const { data: lines } = await supabase
    .from('recipe_lines')
    .select(`
      *,
      ingredients (
        id,
        name,
        unit_cost
      ),
      sub_recipes:recipes!recipe_lines_sub_recipe_id_fkey (
        id,
        products (
          name
        )
      )
    `)
    .eq('recipe_id', params.id)
    .order('id', { ascending: true })

  const { data: allIngredients } = await supabase
    .from('ingredients')
    .select('*')
    .order('name', { ascending: true })

  const { data: allRecipes } = await supabase
    .from('recipes')
    .select(`
      id,
      products (
        name
      )
    `)
    .neq('id', params.id)
    .order('id', { ascending: false })

  return (
    <RecipeBuilder
      recipe={recipe}
      lines={lines ?? []}
      allIngredients={allIngredients ?? []}
      allRecipes={allRecipes ?? []}
    />
  )
}


