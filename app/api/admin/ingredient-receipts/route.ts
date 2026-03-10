export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const ingredientId = searchParams.get('ingredient_id')

  let query = supabase
    .from('ingredient_receipts')
    .select(`
      id,
      ingredient_id,
      supplier,
      quantity_kg,
      unit_cost,
      total_cost,
      invoice_ref,
      received_date,
      notes,
      created_at,
      ingredients ( id, name, unit, unit_cost )
    `)
    .order('received_date', { ascending: false })

  if (ingredientId) query = query.eq('ingredient_id', ingredientId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()

  try {
    const body = await req.json()
    const {
      ingredient_id,
      supplier,
      quantity_kg,
      unit_cost,
      invoice_ref,
      received_date,
      notes,
      update_cost,
    } = body

    if (!ingredient_id || !quantity_kg || !unit_cost || !received_date) {
      return NextResponse.json(
        { error: 'ingredient_id, quantity_kg, unit_cost and received_date are required' },
        { status: 400 }
      )
    }

    const { data: receipt, error: receiptError } = await supabase
      .from('ingredient_receipts')
      .insert({
        ingredient_id,
        supplier:      supplier      || null,
        quantity_kg:   Number(quantity_kg),
        unit_cost:     Number(unit_cost),
        invoice_ref:   invoice_ref   || null,
        received_date,
        notes:         notes         || null,
      })
      .select()
      .single()

    if (receiptError) throw receiptError

    if (update_cost) {
      const { data: existing } = await supabase
        .from('ingredients')
        .select('unit_cost, name')
        .eq('id', ingredient_id)
        .single()

      const previousCost = existing?.unit_cost ?? 0

      await supabase
        .from('ingredients')
        .update({
          unit_cost:  Number(unit_cost),
          supplier:   supplier || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ingredient_id)

      if (Number(previousCost) !== Number(unit_cost)) {
        await supabase.from('ingredient_price_history').insert({
          ingredient_id,
          unit_cost:      Number(unit_cost),
          effective_date: received_date,
          notes: 'Receipt ' + (invoice_ref || receipt.id) + ' - prev $' + Number(previousCost).toFixed(4),
        })
      }
    }

    return NextResponse.json({ data: receipt }, { status: 201 })
  } catch (error: any) {
    console.error('Ingredient receipt error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = createAdminClient()
  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    const { error } = await supabase
      .from('ingredient_receipts')
      .delete()
      .eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
