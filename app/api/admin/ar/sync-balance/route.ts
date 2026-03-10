import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const formData = await request.formData()
  const customerId = formData.get('customer_id') as string

  if (!customerId) {
    return NextResponse.json({ error: 'Missing customer_id' }, { status: 400 })
  }

  try {
    const [
      { data: orders },
      { data: payments },
      { data: credits },
    ] = await Promise.all([
      supabase.from('orders').select('total_amount').eq('customer_id', customerId),
      supabase.from('payments').select('amount').eq('customer_id', customerId),
      supabase.from('credit_memos').select('total_amount, amount').eq('customer_id', customerId),
    ])

    const balance =
      (orders   || []).reduce((s, o) => s + parseFloat(o.total_amount || '0'), 0) -
      (payments || []).reduce((s, p) => s + parseFloat(p.amount || '0'), 0) -
      (credits  || []).reduce((s, c) => s + Math.abs(parseFloat(c.total_amount || c.amount || '0')), 0)

    const { error } = await supabase
      .from('customers')
      .update({ balance })
      .eq('id', customerId)

    if (error) throw error

    return NextResponse.redirect(new URL(`/admin/ar/${customerId}`, request.url))
  } catch (error: any) {
    console.error('Balance sync error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
