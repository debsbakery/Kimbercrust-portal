export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCustomerPricesForProducts } from '@/lib/services/pricing-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { productIds } = body

    if (!productIds || !Array.isArray(productIds)) {
      return NextResponse.json({ error: 'productIds array required' }, { status: 400 })
    }

    const supabase = await createClient()
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log(`🔍 Fetching pricing for ${productIds.length} products for user ${user.id}`)

    // Get pricing for all products
    const pricingMap = await getCustomerPricesForProducts(user.id, productIds)

    // Convert Map to object for JSON
    const pricing: Record<string, { price: number; isContractPrice: boolean }> = {}
    
    for (const [productId, result] of pricingMap.entries()) {
      pricing[productId] = {
        price: result.price,
        isContractPrice: result.isContractPrice
      }
      
      if (result.isContractPrice) {
        console.log(`💰 Contract price for ${productId}: $${result.price} (standard: $${result.standardPrice})`)
      }
    }

    console.log(`✅ Pricing fetched for ${Object.keys(pricing).length} products`)

    return NextResponse.json({ success: true, pricing })
  } catch (error) {
    console.error('❌ Pricing API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

