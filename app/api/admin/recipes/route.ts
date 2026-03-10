import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { product_id } = await req.json()

    const supabase = createAdminClient()

    const { data: recipe, error } = await supabase
      .from('recipes')
      .insert({
        product_id: product_id || null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ recipe })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
