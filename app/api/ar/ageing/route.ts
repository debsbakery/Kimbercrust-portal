export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { ARService } from '@/lib/services/ar-service'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    console.log('📊 Starting aging report...')
    
    const service = new ARService()
    console.log('✅ ARService created')
    
    const report = await service.getAgingReport()
    console.log('✅ Report generated:', report?.length || 0, 'customers')
    
    return NextResponse.json({ 
      success: true, 
      data: report 
    })
  } catch (error) {
    // Better error logging
    console.error('❌ Aging report error:')
    console.error('Error name:', error instanceof Error ? error.name : 'Unknown')
    console.error('Error message:', error instanceof Error ? error.message : String(error))
    console.error('Full error:', error)
    
    // Stack trace
    if (error instanceof Error && error.stack) {
      console.error('Stack:', error.stack)
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : String(error),
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

export async function POST() {
  try {
    console.log('🔄 Starting aging update...')
    
    const service = new ARService()
    const supabase = await createClient()
    
    const { data: customers } = await supabase
      .from('customers')
      .select('id')
      .gt('balance', 0)
    
    console.log('Found', customers?.length || 0, 'customers with balances')
    
    if (customers) {
      for (const customer of customers) {
        await service.calculateAging(customer.id)
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Updated aging for ${customers?.length || 0} customers`,
      count: customers?.length || 0
    })
  } catch (error) {
    console.error('❌ Update aging error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
