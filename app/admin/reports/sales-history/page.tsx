export const dynamic = 'force-dynamic'

import { checkAdmin } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import SalesHistoryView from './sales-history-view'

async function getData() {
  const supabase = createAdminClient()

  const [{ data: products }, { data: customers }] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, code')
      .eq('is_available', true)
      .order('name', { ascending: true }),

    supabase
      .from('customers')
      .select('id, business_name, contact_name')
      .order('business_name', { ascending: true }),
  ])

  return {
    products: (products ?? []).map((p) => ({
      id:   p.id,
      name: p.name,
      code: p.code,
    })),
    customers: (customers ?? []).map((c) => ({
      id:            c.id,
      business_name: c.business_name,
      contact_name:  c.contact_name,
    })),
  }
}

export default async function SalesHistoryPage() {
  const isAdmin = await checkAdmin()
  if (!isAdmin) redirect('/')

  const { products, customers } = await getData()

  return (
    <div className="container mx-auto px-4 py-8">
      <a
        href="/admin/reports"
        className="flex items-center gap-1 text-sm mb-4 hover:opacity-80"
        style={{ color: '#8B0000' }}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Reports
      </a>

      <div className="mb-6">
        <h1 className="text-3xl font-bold">Sales History</h1>
        <p className="text-gray-600 mt-1">
          Search orders by product and customer
        </p>
      </div>

      <SalesHistoryView
        products={products}
        customers={customers}
      />
    </div>
  )
}