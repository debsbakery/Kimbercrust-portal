import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { checkAdmin } from '@/lib/auth'

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const isAdmin = await checkAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const updates = await request.json()
    const supabase = createAdminClient()

    // ── Status-only update (e.g. cancel) ──────────────────────────────────
    if (updates.status && !updates.items) {
      const { error } = await supabase
        .from('orders')
        .update({
          status:     updates.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) throw error
      return NextResponse.json({ success: true })
    }

    // ── Load current order (need old data for AR recalc) ──────────────────
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single()

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // ── Full order edit (items + total) ───────────────────────────────────

    // 1. Delete old items
    await supabase.from('order_items').delete().eq('order_id', id)

    // 2. Insert new items
    if (updates.items?.length > 0) {
      const { error: insertErr } = await supabase
        .from('order_items')
        .insert(
          updates.items.map((item: any) => ({
            order_id:           id,
            product_id:         item.product_id,
            product_name:       item.product_name,
            custom_description: item.custom_description ?? null,
            quantity:           item.quantity,
            unit_price:         item.unit_price,
            subtotal:           item.subtotal ?? (item.quantity * item.unit_price),
            gst_applicable:     item.gst_applicable || false,
          }))
        )

      if (insertErr) {
        return NextResponse.json(
          { error: `Items insert failed: ${insertErr.message}` },
          { status: 500 }
        )
      }
    }

    // 3. Update order record
    const updateFields: any = {
      total_amount:          updates.total_amount,
      updated_at:            new Date().toISOString(),
    }
    if (updates.purchase_order_number !== undefined) {
      updateFields.purchase_order_number = updates.purchase_order_number || null
    }
    if (updates.docket_number !== undefined) {
      updateFields.docket_number = updates.docket_number || null
    }

    const { error: updateErr } = await supabase
      .from('orders')
      .update(updateFields)
      .eq('id', id)

    if (updateErr) throw updateErr

    // ── 4. AR Recalculation (if invoiced order was edited) ────────────────

    if (updates.recalculate_ar) {
      const previousTotal = updates.old_total ?? order.total_amount ?? 0
      const customerId    = updates.old_customer_id || order.customer_id
      const newTotal      = updates.total_amount

      // 4a: Reverse old customer balance
      await supabase.rpc('increment_customer_balance', {
        p_customer_id: customerId,
        p_amount:      -previousTotal,
      })

      // 4b: Delete old AR transactions for this order
      const { error: deleteArErr } = await supabase
        .from('ar_transactions')
        .delete()
        .eq('invoice_id', id)

      if (deleteArErr) {
        console.error('AR delete warning:', deleteArErr.message)
      }

      // 4c: Delete old credit memos + items for this order
      const { data: oldMemos } = await supabase
        .from('credit_memos')
        .select('id')
        .eq('reference_order_id', id)

      if (oldMemos && oldMemos.length > 0) {
        const memoIds = oldMemos.map((m: any) => m.id)
        await supabase
          .from('credit_memo_items')
          .delete()
          .in('credit_memo_id', memoIds)
        await supabase
          .from('credit_memos')
          .delete()
          .eq('reference_order_id', id)
      }

      // 4d: Load customer for payment terms
      const { data: customer } = await supabase
        .from('customers')
        .select('payment_terms, business_name')
        .eq('id', order.customer_id)
        .single()

      const paymentTerms = customer?.payment_terms || 30
      const dueDate      = new Date(order.delivery_date || new Date())
      dueDate.setDate(dueDate.getDate() + paymentTerms)

      // 4e: Create new AR transaction
      const { error: arInsertErr } = await supabase
        .from('ar_transactions')
        .insert({
          customer_id:  order.customer_id,
          type:         newTotal < 0 ? 'credit' : 'invoice',
          amount:       Math.abs(newTotal),
          amount_paid:  0,
          invoice_id:   id,
          description:  `${newTotal < 0 ? 'Credit invoice' : 'Invoice'} (edited) — ${customer?.business_name || ''}`,
          due_date:     dueDate.toISOString().split('T')[0],
        })

      if (arInsertErr) {
        console.error('AR insert error:', arInsertErr.message)
      }

      // 4f: Apply new total to customer balance
      await supabase.rpc('increment_customer_balance', {
        p_customer_id: order.customer_id,
        p_amount:      newTotal,
      })
    }

    // ── 5. Credit Memo (if credit lines in the edit) ──────────────────────

    if (updates.credit_memo?.items?.length > 0) {
      try {
        const cm = updates.credit_memo

        const { data: memo, error: memoErr } = await supabase
          .from('credit_memos')
          .insert({
            customer_id:        order.customer_id,
            reference_order_id: id,
            credit_type:        cm.credit_type || 'product_credit',
            credit_number:      `CM-${Date.now().toString().slice(-6)}`,
            credit_date:        order.delivery_date || new Date().toISOString().split('T')[0],
            status:             'issued',
            notes:              null,
            reason:             'Order edit credit',
            applied_amount:     0,
            subtotal:           cm.subtotal,
            gst_amount:         cm.gst_amount,
            total_amount:       cm.total_amount,
            amount:             Math.abs(cm.total_amount),
          })
          .select()
          .single()

        if (!memoErr && memo) {
          await supabase.from('credit_memo_items').insert(
            cm.items.map((i: any) => ({
              credit_memo_id:     memo.id,
              product_id:         i.product_id,
              product_name:       i.product_name,
              product_code:       i.product_code || '',
              custom_description: i.product_name,
              quantity:           i.quantity,
              unit_price:         i.unit_price,
              total:              Math.abs(i.quantity * i.unit_price),
              credit_percent:     i.credit_percent || 100,
              line_total:         Math.abs(
                i.quantity * i.unit_price *
                (1 + (i.gst_applicable ? 0.1 : 0)) *
                ((i.credit_percent || 100) / 100)
              ),
              gst_applicable:     i.gst_applicable ?? false,
              gst_amount:         i.gst_applicable
                ? Math.abs(i.quantity * i.unit_price * 0.1 * ((i.credit_percent || 100) / 100))
                : 0,
              credit_type:        i.credit_type || 'product_credit',
            }))
          )
        } else if (memoErr) {
          console.error('Credit memo insert error:', memoErr.message)
        }
      } catch (memoErr) {
        console.error('Credit memo exception:', memoErr)
        // Don't fail the whole request for credit memo issues
      }
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Order update error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}