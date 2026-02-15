import { createClient } from "@/lib/supabase/server";
import { generatePackingSlip } from "@/lib/packing-slip";
import { NextResponse } from "next/server";
import { OrderWithItems } from "@/lib/types";

export async function GET(
  request: Request,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await context.params;

    const supabase = await createClient();

    const { data: order, error } = await supabase
      .from("orders")
      .select(`
        *,
        order_items (*)
      `)
      .eq("id", orderId)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const pdf = await generatePackingSlip({
      order: order as OrderWithItems,
      bakeryInfo: {
        name: process.env.BAKERY_NAME || "Deb's Bakery",
        phone: process.env.BAKERY_PHONE || "(04) 1234-5678",
        address: process.env.BAKERY_ADDRESS || "Melbourne, Australia",
      },
    });

    const pdfBuffer = Buffer.from(pdf.output('arraybuffer'));

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="packing-slip-${orderId.slice(0, 8)}.pdf"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}