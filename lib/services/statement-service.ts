import { createClient } from '@/lib/supabase/server';

export class StatementService {
  static async sendStatement(customerId: string) {
    const supabase = await createClient();
    
    const { data: customer } = await supabase
      .from('customers')
      .select('email, business_name, balance')
      .eq('id', customerId)
      .single();
    
    if (!customer) {
      throw new Error('Customer not found');
    }

    console.log('Sending statement to ' + customer.email);
    
    await supabase.from('ar_emails').insert({
      customer_id: customerId,
      type: 'statement',
      subject: 'Account Statement - ' + customer.business_name,
      status: 'sent',
      sent_at: new Date().toISOString(),
    });

    return { success: true };
  }
}

