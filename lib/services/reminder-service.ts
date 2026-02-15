import { prisma } from '@/lib/prisma'
import { differenceInDays } from 'date-fns'

export class ReminderService {
  
  async processOverdueReminders() {
    console.log('🔍 Scanning for overdue accounts...')

    const customers = await prisma.customer.findMany({
      where: { balance: { gt: 0 } },
      include: {
        transactions: {
          where: {
            type: 'invoice',
            paidDate: null,
            dueDate: { lt: new Date() }
          }
        }
      }
    })

    let sentCount = 0

    for (const customer of customers) {
      const reminderLevel = await this.determineReminderLevel(customer)
      
      if (reminderLevel > 0) {
        await this.sendReminder(customer, reminderLevel)
        sentCount++
      }
    }

    console.log(`📧 Sent ${sentCount} reminder emails`)
    return { sent: sentCount, total: customers.length }
  }

  private async determineReminderLevel(customer: any): Promise<number> {
    if (!customer.transactions || customer.transactions.length === 0) {
      return 0
    }

    const today = new Date()
    const maxDaysOverdue = Math.max(
      ...customer.transactions.map(inv => 
        differenceInDays(today, new Date(inv.dueDate!))
      )
    )

    // Get last reminder
    const lastReminder = await prisma.arEmail.findFirst({
      where: {
        customerId: customer.id,
        type: { in: ['reminder_1', 'reminder_2', 'reminder_3'] }
      },
      orderBy: { sentAt: 'desc' }
    })

    const daysSinceLastReminder = lastReminder 
      ? differenceInDays(today, new Date(lastReminder.sentAt))
      : 999

    // Escalation logic
    if (maxDaysOverdue >= 60 || (maxDaysOverdue >= 45 && daysSinceLastReminder >= 7)) {
      return 3 // Final notice
    } else if (maxDaysOverdue >= 30 || (maxDaysOverdue >= 15 && daysSinceLastReminder >= 7)) {
      return 2 // Second reminder
    } else if (maxDaysOverdue >= 7 && daysSinceLastReminder >= 7) {
      return 1 // First reminder
    }

    return 0
  }

  private async sendReminder(customer: any, level: number) {
    const { sendReminderEmail } = await import('./email-service')

    try {
      await sendReminderEmail(customer, level)

      // Log success
      await prisma.arEmail.create({
        data: {
          customerId: customer.id,
          type: `reminder_${level}` as any,
          subject: this.getReminderSubject(level),
          status: 'sent'
        }
      })

      console.log(`✅ Reminder level ${level} sent to ${customer.name}`)
    } catch (error) {
      console.error(`❌ Failed to send reminder to ${customer.email}:`, error)

      await prisma.arEmail.create({
        data: {
          customerId: customer.id,
          type: `reminder_${level}` as any,
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      })
    }
  }

  private getReminderSubject(level: number): string {
    const subjects: Record<number, string> = {
      1: 'Friendly Reminder: Payment Due',
      2: 'Second Notice: Payment Overdue',
      3: 'URGENT: Final Notice - Account Past Due'
    }
    return subjects[level] || 'Payment Reminder'
  }
}