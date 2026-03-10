export const dynamic = 'force-dynamic'

import { createServiceClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { checkAdmin } from "@/lib/auth"
import { ArrowLeft, Printer } from "lucide-react"
import Link from "next/link"
import BatchPackingSlipGenerator from "./batch-packing-slip-generator"

export default async function BatchPackingSlipsPage() {
  const isAdmin = await checkAdmin()
  if (!isAdmin) redirect("/")

  const supabase = await createServiceClient()

  const { data: recentOrders } = await supabase
    .from('orders')
    .select('delivery_date')
    .in('status', ['pending', 'confirmed'])
    .order('delivery_date', { ascending: true })
    .limit(30)

  const uniqueDates = Array.from(
    new Set(recentOrders?.map((o: any) => o.delivery_date) || [])
  ).sort() as string[]

  return (
    <div className="container mx-auto px-4 py-8">
      <Link
        href="/admin"
        className="flex items-center gap-1 text-sm mb-4 hover:opacity-80"
        style={{ color: "#8B000" }}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Admin
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3" style={{ color: "#ffffff" }}>
          <Printer className="h-8 w-8" />
          Batch Packing Slips
        </h1>
        <p className="text-gray-600 mt-2">
          Generate packing slips for all orders on a delivery date
        </p>
      </div>

      <BatchPackingSlipGenerator availableDates={uniqueDates} /></div>
  )
}