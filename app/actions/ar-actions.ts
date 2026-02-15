'use server'

import { revalidatePath } from 'next/cache'
import { StatementService } from '@/lib/services/statement-service'
import { ReminderService } from '@/lib/services/reminder-service'
import { AgingService } from '@/lib/services/aging-service'
import { prisma } from '@/lib/prisma'
import { startOfMonth, endOfMonth } from 'date-fns'
import { Prisma } from '@prisma/client'

export async function sendStatementAction(customerId: string) {
  try {
    const service = new StatementService()
    const startDate = startOfMonth(new Date())
    const endDate = endOfMonth(new Date())
    
    await service.emailStatement(customerId, startDate, endDate)
    
    revalidatePath('/ar')
    revalidatePath(`/ar/customers/${customerId}`)
    
    return { success: true, message: 'Statement sent successfully' }
  } catch (error) {
    console.error('Send statement error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to send statement' 
    }
  }
}

export async function processRemindersAction() {
  try {
    const service = new ReminderService()
    const result = await service.processOverdueReminders()
    
    revalidatePath('/ar')
    
    return { success: true, ...result }
  } catch (error) {
    console.error('Process reminders error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to process reminders' 
    }
  }
}

export async function updateAgingAction() {
  try {
    const service = new AgingService()
    const count = await service.updateAllAging()
    
    revalidatePath('/ar/aging')
    
    return { success: true, count, message: `Updated aging for ${count} customers` }
  } catch (error) {
    console.error('Update aging error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update aging' 
    }
  }
}

export async function recordPaymentAction(data: {
  customerId: string
  amount: number
  description: string
  paymentDate?: Date
}) {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: data.customerId }
    })

    if (!customer) {
      return { success: false, error: 'Customer not found' }
    }

    const newBalance = Number(customer.balance) - data.amount

    await prisma.$transaction(async (tx) => {
      // Create payment transaction
      await tx.arTransaction.create({
        data: {
          customerId: data.customerId,
          type: 'payment',
          amount: new Prisma.Decimal(data.amount),
          balanceAfter: new Prisma.Decimal(newBalance),
          paidDate: data.paymentDate || new Date(),
          description: data.description
        }
      })

      // Update customer balance
      await tx.customer.update({
        where: { id: data.customerId },
        data: { balance: new Prisma.Decimal(newBalance) }
      })

      // Mark oldest unpaid invoices as paid (FIFO)
      const unpaidInvoices = await tx.arTransaction.findMany({
        where: {
          customerId: data.customerId,
          type: 'invoice',
          paidDate: null
        },
        orderBy: { dueDate: 'asc' }
      })

      let remainingPayment = data.amount

      for (const invoice of unpaidInvoices) {
        if (remainingPayment <= 0) break

        const invoiceAmount = Number(invoice.amount)

        if (remainingPayment >= invoiceAmount) {
          // Fully pay this invoice
          await tx.arTransaction.update({
            where: { id: invoice.id },
            data: { paidDate: data.paymentDate || new Date() }
          })
          remainingPayment -= invoiceAmount
        } else {
          break
        }
      }
    })

    revalidatePath('/ar')
    revalidatePath(`/ar/customers/${data.customerId}`)

    return { success: true, message: 'Payment recorded successfully' }
  } catch (error) {
    console.error('Record payment error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to record payment' 
    }
  }
}

export async function getCustomerBalanceAction(customerId: string) {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        name: true,
        email: true,
        balance: true,
        paymentTerms: true,
        lastStatementDate: true
      }
    })

    if (!customer) {
      return { success: false, error: 'Customer not found' }
    }

    return { success: true, data: customer }
  } catch (error) {
    console.error('Get balance error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to get balance' 
    }
  }
}