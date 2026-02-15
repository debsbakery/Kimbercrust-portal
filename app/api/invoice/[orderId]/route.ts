import { createClient } from "@/lib/supabase/server";
import { generateInvoice } from "@/lib/invoice";
import { NextResponse } from "next/server";
import { OrderWithItems } from "@/lib/types";

export async function GET(
  request: Request,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await context.params;
    
    console.log("📄 Generating invoice for order:", orderId);

    const supabase = await createClient();

    const { data: order, error } = await supabase
      .from("orders")
      .select(`
        *,
        order_items (*)
      `)
      .eq("id", orderId)
      .single();

    if (error) {
      console.error("🔴 Database error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!order) {
      console.error("🔴 Order not found");
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    console.log("✅ Order found, generating PDF...");

    const pdf = await generateInvoice({
      order: order as OrderWithItems,
      bakeryInfo: {
        name: process.env.BAKERY_NAME || "Deb's Bakery",
        email: process.env.BAKERY_EMAIL || "debs_bakery@outlook.com",
        phone: process.env.BAKERY_PHONE || "(04) 1234-5678",
        address: process.env.BAKERY_ADDRESS || "Melbourne, Australia",
        abn: process.env.BAKERY_ABN,
      },
    });

    console.log("✅ PDF generated");

    const pdfBuffer = Buffer.from(pdf.output('arraybuffer'));

    const invoiceNumber = order.id; // Will be replaced by actual number in filename
    
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoiceNumber}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error("🔴 Invoice error:", error);
    return NextResponse.json({ 
      error: error.message,
      details: "Failed to generate invoice"
    }, { status: 500 });
  }
}