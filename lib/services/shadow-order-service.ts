import { createClient } from '@/lib/supabase/server'

export class ShadowOrderService {
  
  /**
   * Get shadow order items for a customer
   */
  async getShadowOrder(customerId: string) {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('shadow_orders')
      .select(`
        *,
        product:products(
          id,
          product_number,
          name,
          description,
          price,
          unit,
          min_quantity,
          max_quantity,
          is_available
        )
      `)
      .eq('customer_id', customerId)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) throw error

    return data || []
  }

  /**
   * Add item to shadow order
   */
  async addShadowItem(customerId: string, productId: string, quantity: number) {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('shadow_orders')
      .upsert({
        customer_id: customerId,
        product_id: productId,
        default_quantity: quantity
      }, {
        onConflict: 'customer_id,product_id'
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * Update shadow item quantity
   */
  async updateShadowItem(shadowItemId: string, quantity: number) {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('shadow_orders')
      .update({ default_quantity: quantity })
      .eq('id', shadowItemId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * Remove item from shadow order
   */
  async removeShadowItem(shadowItemId: string) {
    const supabase = await createClient()

    const { error } = await supabase
      .from('shadow_orders')
      .delete()
      .eq('id', shadowItemId)

    if (error) throw error
  }

  /**
   * Reorder shadow items (drag and drop)
   */
  async reorderShadowItems(customerId: string, itemIds: string[]) {
    const supabase = await createClient()

    // Update display_order for each item
    const updates = itemIds.map((id, index) => 
      supabase
        .from('shadow_orders')
        .update({ display_order: index })
        .eq('id', id)
        .eq('customer_id', customerId)
    )

    await Promise.all(updates)
  }
}