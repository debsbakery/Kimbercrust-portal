export const dynamic = 'force-dynamic'

import { checkAdmin } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import InventoryReceivedView from './inventory-received-view'

async function getData() {
  const supabase = createAdminClient()

  const [{ data: ingredients }, { data: receipts }] = await Promise.all([
    supabase
      .from('ingredients')
      .select('id, name, unit, unit_cost, supplier')
      .order('name', { ascending: true }),

    supabase
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
        ingredients ( id, name, unit )
      `)
      .order('received_date', { ascending: false })
      .limit(100),
  ])

  return {
    ingredients: ingredients ?? [],
    receipts:    receipts    ?? [],
  }
}

export default async function InventoryPage() {
  const isAdmin = await checkAdmin()
  if (!isAdmin) redirect('/')

  const { ingredients, receipts } = await getData()

  return (
    <div className="container mx-auto px-4 py-8">
      <a
        href="/admin"
        className="flex items-center gap-1 text-sm mb-4 hover:opacity-80"
        style={{ color: '#CE1126' }}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Admin
      </a>

      <div className="mb-6">
        <h1 className="text-3xl font-bold">Inventory Received</h1>
        <p className="text-gray-600 mt-1">
          Record supplier deliveries — updates ingredient costs automatically
        </p>
      </div>

      <InventoryReceivedView
        ingredients={ingredients}
        initialReceipts={receipts}
      />
    </div>
  )
}