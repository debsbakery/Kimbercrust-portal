import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// POST — create new ingredient
export async function POST(req: Request) {
  try {
    const { name, unit, unit_cost } = await req.json()

    if (!name || !unit || typeof unit_cost !== 'number' || unit_cost < 0) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: ingredient, error } = await supabase
      .from('ingredients')
      .insert({ name, unit, unit_cost })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ingredient })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// PUT — update existing ingredient + log price history if cost changed
export async function PUT(req: Request) {
  try {
    const { id, name, unit, unit_cost, previous_cost } = await req.json()

    if (!id || !name || !unit || typeof unit_cost !== 'number' || unit_cost < 0) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: ingredient, error } = await supabase
      .from('ingredients')
      .update({ name, unit, unit_cost })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Log to price history if cost changed
   // Log to price history if cost changed
if (previous_cost !== null && previous_cost !== unit_cost) {
  await supabase.from('ingredient_price_history').insert({
    ingredient_id: id,
    unit_cost: unit_cost,                              // new price
    effective_date: new Date().toISOString().split('T')[0],
    notes: `Price changed from $${previous_cost} to $${unit_cost}`,
  })
}

    return NextResponse.json({ ingredient })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE — remove ingredient
export async function DELETE(req: Request) {
  try {
    const { id } = await req.json()

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { error } = await supabase
      .from('ingredients')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
