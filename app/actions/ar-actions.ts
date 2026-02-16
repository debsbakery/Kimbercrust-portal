'use server'

import { createClient } from '@/lib/supabase/server'
import { StatementService } from '@/lib/services/statement-service'
import { ReminderService } from '@/lib/services/reminder-service'
import { AgingService } from '@/lib/services/aging-service'
import { startOfMonth, endOfMonth } from 'date-fns'

export async function sendStatementAction(customerId: string) {
  try {
    await StatementService.sendStatement(customerId)
    return { success: true }
  } catch (error: any) {
    console.error('Error sending statement:', error)
    return { success: false, error: error.message }
  }
}

export async function sendAllStatementsAction() {
  try {
    const supabase = await createClient()
    
    const { data: customers, error } = await supabase
      .from('customers')
      .select('id, business_name')
    
    if (error) throw error
    
    let sent = 0
    for (const customer of customers || []) {
      try {
        await StatementService.sendStatement(customer.id)
        sent++
      } catch (err) {
        console.error(`Failed to send statement to ${customer.business_name}:`, err)
      }
    }
    
    return { success: true, sent, total: customers?.length || 0 }
  } catch (error: any) {
    console.error('Error sending statements:', error)
    return { success: false, error: error.message }
  }
}

export async function sendPaymentReminderAction(customerId: string) {
  try {
    await ReminderService.sendReminder(customerId)
    return { success: true }
  } catch (error: any) {
    console.error('Error sending reminder:', error)
    return { success: false, error: error.message }
  }
}

export async function sendAllRemindersAction() {
  try {
    const supabase = await createClient()
    
    // Get customers with overdue balances
    const { data: customers, error } = await supabase
      .from('customers')
      .select('id, business_name, balance')
      .gt('balance', 0)
    
    if (error) throw error
    
    let sent = 0
    for (const customer of customers || []) {
      try {
        await ReminderService.sendReminder(customer.id)
        sent++
      } catch (err) {
        console.error(`Failed to send reminder to ${customer.business_name}:`, err)
      }
    }
    
    return { success: true, sent, total: customers?.length || 0 }
  } catch (error: any) {
    console.error('Error sending reminders:', error)
    return { success: false, error: error.message }
  }
}

export async function updateAgingAction() {
  try {
    await AgingService.updateAllAging()
    return { success: true }
  } catch (error: any) {
    console.error('Error updating aging:', error)
    return { success: false, error: error.message }
  }
}

export async function recordPaymentAction(
  customerId: string,
  amount: number,
  paymentMethod: string,
  reference?: string
) {
  try {
    const supabase = await createClient()
    
    // Get current balance
    const { data: customer } = await supabase
      .from('customers')
      .select('balance')
      .eq('id', customerId)
      .single()
    
    if (!customer) throw new Error('Customer not found')
    
    const currentBalance = parseFloat(customer.balance || '0')
    const newBalance = currentBalance - amount
    
    // Record transaction
    const { error: txError } = await supabase
      .from('ar_transactions')
      .insert({
        customer_id: customerId,
        type: 'payment',
        amount: amount.toString(),
        balance_after: newBalance.toString(),
        description: `Payment - ${paymentMethod}${reference ? ` - Ref: ${reference}` : ''}`,
        paid_date: new Date().toISOString()
      })
    
    if (txError) throw txError
    
    // Update customer balance
    const { error: balanceError } = await supabase
      .from('customers')
      .update({ balance: newBalance.toString() })
      .eq('id', customerId)
    
    if (balanceError) throw balanceError
    
    return { success: true, newBalance }
  } catch (error: any) {
    console.error('Error recording payment:', error)
    return { success: false, error: error.message }
  }
}

export async function getMonthlyReportAction(month?: Date) {
  try {
    const supabase = await createClient()
    const targetMonth = month || new Date()
    const start = startOfMonth(targetMonth)
    const end = endOfMonth(targetMonth)
    
    // Get transactions for the month
    const { data: transactions, error } = await supabase
      .from('ar_transactions')
      .select('*, customers(business_name)')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    // Calculate totals
    const invoices = transactions?.filter(t => t.type === 'invoice') || []
    const payments = transactions?.filter(t => t.type === 'payment') || []
    
    const totalInvoiced = invoices.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0)
    const totalPaid = payments.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0)
    
    return {
      success: true,
      data: {
        transactions,
        totalInvoiced,
        totalPaid,
        netChange: totalInvoiced - totalPaid,
        invoiceCount: invoices.length,
        paymentCount: payments.length
      }
    }
  } catch (error: any) {
    console.error('Error generating report:', error)
    return { success: false, error: error.message }
  }
}
