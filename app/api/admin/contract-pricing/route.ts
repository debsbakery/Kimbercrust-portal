import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET: Fetch contracts for a customer
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId')

    if (!customerId) {
      return NextResponse.json({ success: false, error: 'customerId required' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: contracts, error } = await supabase
      .from('customer_pricing')
      .select(`
        *,
        product:products(product_number, name, price)
      `)
      .eq('customer_id', customerId)
      .order('effective_from', { ascending: false })

    if (error) {
      console.error('❌ GET contracts error:', error)
      throw error
    }

    const formatted = (contracts || []).map(c => ({
      ...c,
      product_number: (c.product as any).product_number,
      product_name: (c.product as any).name,
      standard_price: (c.product as any).price
    }))

    return NextResponse.json({ success: true, contracts: formatted })
  } catch (error) {
    console.error('❌ GET error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST: Create or update contract price
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { customerId, productId, contractPrice, effectiveFrom, effectiveTo } = body

    console.log('📝 Creating/updating contract price:', {
      customerId,
      productId,
      contractPrice,
      effectiveFrom,
      effectiveTo
    })

    const supabase = await createClient()

    // Check if a contract already exists for this customer/product/date
    const { data: existing } = await supabase
      .from('customer_pricing')
      .select('id')
      .eq('customer_id', customerId)
      .eq('product_id', productId)
      .eq('effective_from', effectiveFrom)
      .maybeSingle()

    if (existing) {
      // UPDATE existing contract
      console.log('🔄 Updating existing contract:', existing.id)
      
      const { data, error } = await supabase
        .from('customer_pricing')
        .update({
          contract_price: contractPrice,
          effective_to: effectiveTo || null
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        console.error('❌ Update error:', JSON.stringify(error, null, 2))
        throw error
      }

      console.log('✅ Contract price updated')
      return NextResponse.json({ success: true, data, updated: true })
    } else {
      // INSERT new contract
      console.log('➕ Creating new contract')
      
      const { data, error } = await supabase
        .from('customer_pricing')
        .insert({
          customer_id: customerId,
          product_id: productId,
          contract_price: contractPrice,
          effective_from: effectiveFrom,
          effective_to: effectiveTo || null
        })
        .select()
        .single()

      if (error) {
        console.error('❌ Insert error:', JSON.stringify(error, null, 2))
        throw error
      }

      console.log('✅ Contract price created')
      return NextResponse.json({ success: true, data, updated: false })
    }
  } catch (error) {
    console.error('❌ POST error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error
      },
      { status: 500 }
    )
  }
}

// DELETE: Remove a contract price
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const contractId = searchParams.get('id')

    if (!contractId) {
      return NextResponse.json({ success: false, error: 'Contract ID required' }, { status: 400 })
    }

    const supabase = await createClient()

    const { error } = await supabase
      .from('customer_pricing')
      .delete()
      .eq('id', contractId)

    if (error) {
      console.error('❌ Delete error:', error)
      throw error
    }

    console.log('✅ Contract deleted:', contractId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ DELETE error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}