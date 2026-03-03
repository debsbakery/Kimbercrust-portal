export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkAdmin } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const isAdmin = await checkAdmin()
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orderId } = await request.json()
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  // Idempotent — return existing if already assigned
  const { data: existing } = await supabase
    .from('invoice_numbers')
    .select('invoice_number')
    .eq('order_id', orderId)
    .maybeSingle()

  if (existing?.invoice_number) {
    return NextResponse.json({ invoiceNumber: existing.invoice_number })
  }

  // Get next number
  const { data: maxRow } = await supabase
    .from('invoice_numbers')
    .select('invoice_number')
    .order('invoice_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextNumber = ((maxRow?.invoice_number as number) ?? 0) + 1

  // Insert into invoice_numbers
  const { error: insertError } = await supabase
    .from('invoice_numbers')
    .insert({ order_id: orderId, invoice_number: nextNumber })

  if (insertError) {
    console.error('Failed to insert invoice_number:', insertError)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Write back to orders table too
  await supabase
    .from('orders')
    .update({ invoice_number: nextNumber })
    .eq('id', orderId)

  return NextResponse.json({ invoiceNumber: nextNumber })
}