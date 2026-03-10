import { createClient } from '@/lib/supabase/server';

export class ReminderService {
  static async sendReminder(customerId: string) {
    const supabase = await createClient();
    
    const { data: customer } = await supabase
      .from('customers')
      .select('email, business_name, balance')
      .eq('id', customerId)
      .single();
    
    if (!customer) {
      throw new Error('Customer not found');
    }

    if (parseFloat(customer.balance || '0') <= 0) {
      throw new Error('No outstanding balance');
    }

    console.log('Sending reminder to ' + customer.email);
    
    await supabase.from('ar_emails').insert({
      customer_id: customerId,
      type: 'reminder',
      subject: 'Payment Reminder - ' + customer.business_name,
      status: 'sent',
      sent_at: new Date().toISOString(),
    });

    return { success: true };
  }
}

