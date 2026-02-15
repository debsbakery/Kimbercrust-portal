import { NextRequest, NextResponse } from 'next/server';

async function createServiceClient() {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}

// GET single product
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServiceClient();

    const { data: product, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    return NextResponse.json({ product });
  } catch (error: any) {
    console.error('❌ Error fetching product:', error);
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
}

// PUT - Update product
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServiceClient();
    const body = await request.json();

    const updates: any = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.price !== undefined) updates.price = body.price;
    if (body.description !== undefined) updates.description = body.description || null;
    if (body.category !== undefined) updates.category = body.category || null;
    if (body.image_url !== undefined) updates.image_url = body.image_url || null;

    const { data: product, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Product updated:', product.name);

    return NextResponse.json({ product });
  } catch (error: any) {
    console.error('❌ Error updating product:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE product
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServiceClient();

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) throw error;

    console.log('✅ Product deleted:', id);

    return NextResponse.json({ message: 'Product deleted successfully' });
  } catch (error: any) {
    console.error('❌ Error deleting product:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}