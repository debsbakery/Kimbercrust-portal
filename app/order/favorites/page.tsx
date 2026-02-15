import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ShadowOrderManager } from '@/components/order/shadow-order-manager'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default async function FavoritesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-6">
        <Link href="/catalog">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Catalog
          </Button>
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">My Favorite Products</h1>
        <p className="text-gray-600">
          Manage your frequently ordered items for faster ordering
        </p>
      </div>

      <ShadowOrderManager />
    </div>
  )
}