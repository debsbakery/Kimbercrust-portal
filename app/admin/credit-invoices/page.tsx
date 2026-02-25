export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { checkAdmin } from '@/lib/auth'
import { redirect } from 'next/navigation'
import CreditInvoicePage from '@/components/credit-invoices/CreditInvoicePage'

export default async function Page() {
  const isAdmin = await checkAdmin()
  if (!isAdmin) redirect('/')

  const supabase = await createClient()

  const [{ data: customers }, { data: products }] = await Promise.all([
    supabase
      .from('customers')
      .select('id, business_name, contact_name, email, address, abn, balance')
      .order('business_name'),
    supabase
      .from('products')
      .select('id, name, code, product_code, unit_price, price, gst_applicable, is_available')
      .eq('is_available', true)
      .order('name'),
  ])

  return (
    <CreditInvoicePage
      customers={customers || []}
      products={products || []}
    />
  )
}