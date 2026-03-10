import { createAdminClient } from "@/lib/supabase/admin";

export async function getInvoiceNumber(orderId: string): Promise<number> {
  const supabase = createAdminClient();
  
  // Check if invoice number already exists
  const { data: existing } = await supabase
    .from("invoice_numbers")
    .select("invoice_number")
    .eq("order_id", orderId)
    .single();
  
  if (existing) {
    return existing.invoice_number;
  }
  
  // Generate new invoice number
  const { data, error } = await supabase
    .rpc("get_next_invoice_number");
  
  if (error) throw error;
  
  const invoiceNumber = data;
  
  // Save it
  await supabase
    .from("invoice_numbers")
    .insert({
      order_id: orderId,
      invoice_number: invoiceNumber
    });
  
  return invoiceNumber;
}
