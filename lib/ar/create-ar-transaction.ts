import { createClient } from '@/lib/supabase/server'

export async function createARTransactionFromOrder(
  orderId: string,
  customerId: string,
  amount: number,
  deliveryDate?: string
) {
  const supabase = await createClient()

  try {
    // Get customer info
    const { data: customer } = await supabase
      .from('customers')
      .select('balance, payment_terms')
      .eq('id', customerId)
      .single()

    if (!customer) throw new Error('Customer not found')

    // Calculate new balance
    const currentBalance = parseFloat(customer.balance || '0')
    const newBalance = currentBalance + amount

    // Calculate due date
    const paymentTerms = customer.payment_terms || 30
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + paymentTerms)

    // Create AR transaction
    const { error: txnError } = await supabase
      .from('ar_transactions')
      .insert({
        customer_id: customerId,
        type: 'invoice',
        invoice_id: orderId,
        amount,
        balance_after: newBalance,
        due_date: dueDate.toISOString().split('T')[0],
        description: `Order ${orderId.substring(0, 8).toUpperCase()}${deliveryDate ? ` - Delivery: ${deliveryDate}` : ''}`
      })

    if (txnError) throw txnError

    // Update customer balance
    const { error: balanceError } = await supabase
      .from('customers')
      .update({ balance: newBalance })
      .eq('id', customerId)

    if (balanceError) throw balanceError

    console.log(`✅ AR transaction created for order ${orderId.substring(0, 8)}`)

    return { success: true, newBalance }
  } catch (error) {
    console.error('❌ Failed to create AR transaction:', error)
    throw error
  }
}