export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { checkAdmin } from '@/lib/auth'
import { ArrowLeft } from 'lucide-react'
import StandingOrderForm from '../../components/standing-order-form'

async function getEditFormData(id: string) {
  const supabase = await createServiceClient()  // ← service client, bypasses RLS

  const { data: standingOrder, error: orderError } = await supabase
    .from('standing_orders')
    .select(`
      *,
      items:standing_order_items(
        id,
        product_id,
        quantity
      )
    `)
    .eq('id', id)
    .single()

  if (orderError || !standingOrder) {
    console.error('Error loading standing order:', orderError)
    return null
  }

  const [{ data: customers }, { data: products }] = await Promise.all([
    supabase
      .from('customers')
      .select('id, business_name, email, contact_name')
      .order('business_name'),
    supabase
      .from('products')
      .select('id, name, price, code, category, is_available')
      .eq('is_available', true)
      .order('code', { ascending: true, nullsFirst: false }),
  ])

  return {
    standingOrder,
    customers: customers || [],
    products: products || [],
  }
}

export default async function EditStandingOrderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const isAdmin = await checkAdmin()
  if (!isAdmin) redirect('/')

  const { id } = await params
  const data = await getEditFormData(id)

  if (!data) redirect('/admin/standing-orders')

  const { standingOrder, customers, products } = data

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <a
        href="/admin/standing-orders"
        className="flex items-center gap-1 text-sm mb-4 hover:opacity-80"
        style={{ color: '#8B0000' }}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Standing Orders
      </a>
      <h1 className="text-3xl font-bold mb-1">Edit Standing Order</h1>
      <p className="text-gray-500 mb-8 capitalize">
        {standingOrder.delivery_days} delivery
      </p>

      <StandingOrderForm
        customers={customers}
        products={products}
        standingOrder={standingOrder}
      />
    </div>
  )
}