import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }  // ← Promise
) {
  try {
    const { id } = await params  // ← await it
    const { ingredient_id, quantity_grams, sub_recipe_id, sub_qty_grams } = await req.json()

    const supabase = createAdminClient()

    const { error } = await supabase
      .from('recipe_lines')
      .insert({
        recipe_id: id,  // ← use awaited id
        ingredient_id: ingredient_id || null,
        quantity_grams: quantity_grams || null,
        sub_recipe_id: sub_recipe_id || null,
        sub_qty_grams: sub_qty_grams || null,
      })

    if (error) {
      console.error('Recipe line insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Recipe line POST error:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { line_id } = await req.json()

    const supabase = createAdminClient()

    const { error } = await supabase
      .from('recipe_lines')
      .delete()
      .eq('id', line_id)

    if (error) {
      console.error('Recipe line delete error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Recipe line DELETE error:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}