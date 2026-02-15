import { createClient } from '@/lib/supabase/server'

export interface PricingResult {
  price: number
  isContractPrice: boolean
  standardPrice: number
  savingsAmount: number
}

/**
 * Get the effective price for a customer/product combination
 * Checks contract pricing first, falls back to standard price
 */
export async function getCustomerPrice(
  customerId: string,
  productId: string,
  date: Date = new Date()
): Promise<PricingResult> {
  const supabase = await createClient()

  // Get standard product price
  const { data: product } = await supabase
    .from('products')
    .select('price')
    .eq('id', productId)
    .single()

  const standardPrice = parseFloat(product?.price || '0')

  // Check for active contract price
  const dateStr = date.toISOString().split('T')[0]

  const { data: contractPricing } = await supabase
    .from('customer_pricing')
    .select('contract_price')
    .eq('customer_id', customerId)
    .eq('product_id', productId)
    .lte('effective_from', dateStr)
    .or(`effective_to.is.null,effective_to.gte.${dateStr}`)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (contractPricing) {
    const contractPrice = parseFloat(contractPricing.contract_price)
    return {
      price: contractPrice,
      isContractPrice: true,
      standardPrice,
      savingsAmount: standardPrice - contractPrice
    }
  }

  return {
    price: standardPrice,
    isContractPrice: false,
    standardPrice,
    savingsAmount: 0
  }
}

/**
 * Get prices for multiple products at once (batch lookup)
 */
export async function getCustomerPricesForProducts(
  customerId: string,
  productIds: string[],
  date: Date = new Date()
): Promise<Map<string, PricingResult>> {
  const supabase = await createClient()
  const dateStr = date.toISOString().split('T')[0]

  // Get all standard prices
  const { data: products } = await supabase
    .from('products')
    .select('id, price')
    .in('id', productIds)

  const standardPrices = new Map(
    (products || []).map(p => [p.id, parseFloat(p.price)])
  )

  // Get all contract prices
  const { data: contractPrices } = await supabase
    .from('customer_pricing')
    .select('product_id, contract_price')
    .eq('customer_id', customerId)
    .in('product_id', productIds)
    .lte('effective_from', dateStr)
    .or(`effective_to.is.null,effective_to.gte.${dateStr}`)

  const contracts = new Map(
    (contractPrices || []).map(cp => [cp.product_id, parseFloat(cp.contract_price)])
  )

  // Build result map
  const results = new Map<string, PricingResult>()

  for (const productId of productIds) {
    const standardPrice = standardPrices.get(productId) || 0
    const contractPrice = contracts.get(productId)

    if (contractPrice !== undefined) {
      results.set(productId, {
        price: contractPrice,
        isContractPrice: true,
        standardPrice,
        savingsAmount: standardPrice - contractPrice
      })
    } else {
      results.set(productId, {
        price: standardPrice,
        isContractPrice: false,
        standardPrice,
        savingsAmount: 0
      })
    }
  }

  return results
}