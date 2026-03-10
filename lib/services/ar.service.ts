import { createClient } from '@/lib/supabase/server'
import { differenceInDays } from 'date-fns'

export class ARService {
  
  async calculateAging(customerId: string) {
    const supabase = await createClient()
    
    const buckets = {
      current: 0,
      days_1_30: 0,
      days_31_60: 0,
      days_61_90: 0,
      days_over_90: 0
    }
    
    const { data: openInvoices } = await supabase
      .from('ar_transactions')
      .select('*')
      .eq('customer_id', customerId)
      .eq('type', 'invoice')
      .is('paid_date', null)
    
    if (!openInvoices) return { ...buckets, total_due: 0 }
    
    const today = new Date()
    
    for (const invoice of openInvoices) {
      if (!invoice.due_date) continue
      
      const daysOverdue = differenceInDays(today, new Date(invoice.due_date))
      const amount = parseFloat(invoice.amount)
      
      if (daysOverdue <= 0) buckets.current += amount
      else if (daysOverdue <= 30) buckets.days_1_30 += amount
      else if (daysOverdue <= 60) buckets.days_31_60 += amount
      else if (daysOverdue <= 90) buckets.days_61_90 += amount
      else buckets.days_over_90 += amount
    }
    
    const totalDue = Object.values(buckets).reduce((sum, val) => sum + val, 0)
    
    await supabase.from('ar_aging').upsert({
      customer_id: customerId,
      current: buckets.current,
      days_1_30: buckets.days_1_30,
      days_31_60: buckets.days_31_60,
      days_61_90: buckets.days_61_90,
      days_over_90: buckets.days_over_90,
      total_due: totalDue
    })
    
    return { ...buckets, total_due: totalDue }
  }
  
  async getAgingReport() {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, email, payment_terms, balance, ar_aging(*)')
      .gt('balance', 0)
      .order('balance', { ascending: false })
    
    if (error) throw error
    return data || []
  }
  
  async getOverdueCustomers() {
    const supabase = await createClient()
    const today = new Date().toISOString().split('T')[0]
    
    const { data } = await supabase
      .from('customers')
      .select('id, name, email, balance, payment_terms')
      .gt('balance', 0)
    
    const overdueCustomers = []
    
    for (const customer of data || []) {
      const { data: overdueInvoices } = await supabase
        .from('ar_transactions')
        .select('*')
        .eq('customer_id', customer.id)
        .eq('type', 'invoice')
        .is('paid_date', null)
        .lt('due_date', today)
      
      if (overdueInvoices && overdueInvoices.length > 0) {
        overdueCustomers.push({ ...customer, overdue_invoices: overdueInvoices })
      }
    }
    
    return overdueCustomers
  }
  
  async recordPayment(customerId: string, amount: number, description: string) {
    const supabase = await createClient()
    
    const { data: customer } = await supabase
      .from('customers')
      .select('balance')
      .eq('id', customerId)
      .single()
    
    if (!customer) throw new Error('Customer not found')
    
    const newBalance = parseFloat(customer.balance) - amount
    
    await supabase.from('ar_transactions').insert({
      customer_id: customerId,
      type: 'payment',
      amount,
      balance_after: newBalance,
      paid_date: new Date().toISOString(),
      description
    })
    
    await supabase.from('customers').update({ balance: newBalance }).eq('id', customerId)
    
    return { success: true, newBalance }
  }
  
  async determineReminderLevel(customer: any): Promise<number> {
    const supabase = await createClient()
    
    if (!customer.overdue_invoices || customer.overdue_invoices.length === 0) return 0
    
    const today = new Date()
    const maxDaysOverdue = Math.max(
      ...customer.overdue_invoices.map((inv: any) => 
        differenceInDays(today, new Date(inv.due_date))
      )
    )
    
    const { data: lastReminder } = await supabase
      .from('ar_emails')
      .select('sent_at')
      .eq('customer_id', customer.id)
      .in('type', ['reminder_1', 'reminder_2', 'reminder_3'])
      .order('sent_at', { ascending: false })
      .limit(1)
      .single()
    
    const daysSinceLastReminder = lastReminder 
      ? differenceInDays(today, new Date(lastReminder.sent_at))
      : 999
    
    if (maxDaysOverdue >= 60 || (maxDaysOverdue >= 45 && daysSinceLastReminder >= 7)) return 3
    if (maxDaysOverdue >= 30 || (maxDaysOverdue >= 15 && daysSinceLastReminder >= 7)) return 2
    if (maxDaysOverdue >= 7 && daysSinceLastReminder >= 7) return 1
    
    return 0
  }
}
