import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkAdmin } from "@/lib/auth";
import { ArrowLeft } from "lucide-react";
import StandingOrderForm from "../../components/standing-order-form";



async function getEditFormData(id: string) {
  const supabase = await createClient();

  // Fetch standing order with items
  const { data: standingOrder, error: orderError } = await supabase
    .from('standing_orders')
    .select(`
      *,
      items:standing_order_items(
        id,
        product_id,
        quantity
      )
    `)
    .eq('id', id)
    .single();

  if (orderError || !standingOrder) {
    return null;
  }

  // Fetch all customers
  const { data: customers } = await supabase
    .from('customers')
    .select('id, business_name, email, contact_name')
    .order('business_name');

  // Fetch all products
  const { data: products } = await supabase
    .from('products')
    .select('id, name, price, unit, product_number, is_available')
    .eq('is_available', true)
    .order('name');

  return {
    standingOrder,
    customers: customers || [],
    products: products || [],
  };
}

export default async function EditStandingOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const isAdmin = await checkAdmin();
  if (!isAdmin) redirect("/");

  const { id } = await params;
  const data = await getEditFormData(id);

  if (!data) {
    redirect("/admin/standing-orders");
  }

  const { standingOrder, customers, products } = data;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <a
          href="/admin/standing-orders"
          className="flex items-center gap-1 text-sm mb-4 hover:opacity-80"
          style={{ color: "#CE1126" }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Standing Orders
        </a>
        <h1 className="text-3xl font-bold">Edit Standing Order</h1>
        <p className="text-gray-600">Update recurring weekly order</p>
      </div>

      <StandingOrderForm
        customers={customers}
        products={products}
        standingOrder={standingOrder}
        mode="edit"
      />
    </div>
  );
}