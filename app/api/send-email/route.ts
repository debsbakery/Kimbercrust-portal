import { createAdminClient } from "@/lib/supabase/admin";
import { sendOrderEmails } from "@/lib/email";
import { NextResponse } from "next/server";
import { OrderWithItems } from "@/lib/types";

export async function POST(request: Request) {
  try {
    console.log("📧 Email API route called");
    
    const body = await request.json();
    console.log("📧 Request body:", body);
    
    const { orderId } = body;

    if (!orderId) {
      console.error("🔴 No orderId provided");
      return NextResponse.json({ error: "Order ID required" }, { status: 400 });
    }

    console.log("📧 Fetching order:", orderId);

    const supabase = createAdminClient();

    const { data: order, error } = await supabase
      .from("orders")
      .select(`
        *,
        order_items (*)
      `)
      .eq("id", orderId)
      .single();

    if (error) {
      console.error("🔴 Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!order) {
      console.error("🔴 Order not found");
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    console.log("✅ Order found:", order.id);
    console.log("✅ Customer email:", order.customer_email);
    console.log("✅ Order items:", order.order_items?.length || 0);

    console.log("📧 Calling sendOrderEmails...");

    const result = await sendOrderEmails({
      order: order as OrderWithItems,
      customerEmail: order.customer_email,
    });

    console.log("✅ sendOrderEmails completed");
    console.log("✅ Result:", result);

    return NextResponse.json({ 
      success: true, 
      result,
      message: "Emails sent successfully"
    });
    
  } catch (error: any) {
    console.error("🔴 Email API error:", error);
    console.error("🔴 Error message:", error.message);
    console.error("🔴 Error stack:", error.stack);
    
    return NextResponse.json(
      { 
        error: error.message || "Failed to send emails",
        details: error.toString()
      },
      { status: 500 }
    );
  }
}