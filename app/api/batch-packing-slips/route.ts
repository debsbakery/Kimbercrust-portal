import { createClient } from "@/lib/supabase/server";
import { generateBatchPackingSlips } from "@/lib/batch-packing-slip";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { date } = await request.json();
    
    const supabase = await createClient();

    const { data: orders } = await supabase
      .from("orders")
      .select(`
        id,
        customer_business_name,
        customer_email,
        delivery_date,
        order_items (
          product_name,
          quantity
        )
      `)
      .eq("delivery_date", date)
      .order("customer_business_name");

    if (!orders || orders.length === 0) {
      return NextResponse.json({ error: "No orders found" }, { status: 404 });
    }

    const pdf = await generateBatchPackingSlips(orders, {
      name: process.env.BAKERY_NAME || "Deb's Bakery",
      phone: process.env.BAKERY_PHONE || "(04) 1234-5678",
    });

    const pdfBuffer = Buffer.from(pdf.output('arraybuffer'));

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="packing-slips-${date}.pdf"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}