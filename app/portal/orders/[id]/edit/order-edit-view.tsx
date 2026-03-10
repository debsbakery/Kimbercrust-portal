'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Minus, X, ArrowLeft, Save } from 'lucide-react';

interface OrderEditViewProps {
  order: any;
  products: any[];
}

export default function OrderEditView({ order, products }: OrderEditViewProps) {
  const router = useRouter();
  const [items, setItems] = useState(order.order_items || []);
  const [saving, setSaving] = useState(false);

  function calculateTotals() {
    const subtotal = items.reduce(
      (sum: number, item: any) => sum + item.quantity * item.unit_price,
      0
    );
    const gst = items.reduce(
      (sum: number, item: any) =>
        sum + (item.gst_applicable ? item.quantity * item.unit_price * 0.1 : 0),
      0
    );
    const total = subtotal + gst;
    return { subtotal, gst, total };
  }

  function updateQuantity(itemId: string, newQuantity: number) {
    setItems(
      items
        .map((item: any) =>
          item.id === itemId ? { ...item, quantity: Math.max(0, newQuantity) } : item
        )
        .filter((item: any) => item.quantity > 0)
    );
  }

  function removeItem(itemId: string) {
    setItems(items.filter((item: any) => item.id !== itemId));
  }

  function addProduct(productId: string) {
    const product = products.find((p: any) => p.id === productId);
    if (!product) return;

    const existingItem = items.find((item: any) => item.product?.id === productId);

    if (existingItem) {
      updateQuantity(existingItem.id, existingItem.quantity + 1);
    } else {
      setItems([
        ...items,
        {
          id: `new-${Date.now()}`,
          product_id: product.id,
          product_name: product.name,
          product: product,
          quantity: 1,
          unit_price: product.price,
          gst_applicable: product.gst_applicable || false,
        },
      ]);
    }
  }

  async function saveChanges() {
    if (items.length === 0) {
      alert('⚠️ Order must have at least one item');
      return;
    }

    setSaving(true);

    const { total } = calculateTotals();

    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((item: any) => ({
            product_id: item.product?.id || item.product_id,
            product_name: item.product?.name || item.product_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            gst_applicable: item.gst_applicable,
          })),
          total_amount: total,
        }),
      });

      if (response.ok) {
        alert('✅ Order updated successfully!');
        router.push('/portal');
      } else {
        const error = await response.json();
        alert(`❌ Failed to update order: ${error.error}`);
      }
    } catch (error) {
      alert('❌ An error occurred while saving');
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  const { subtotal, gst, total } = calculateTotals();

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/portal')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Portal
        </button>

        <h1 className="text-3xl font-bold text-gray-900">Edit Order</h1>
        <p className="text-gray-600 mt-2">
          Order #{order.id.slice(0, 8).toUpperCase()} • Delivery:{' '}
          {new Date(order.delivery_date).toLocaleDateString('en-AU', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Current Items */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Order Items</h2>

            {items.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <p className="text-gray-500 text-lg mb-1">No items in order</p>
                <p className="text-sm text-gray-400">Add products from the sidebar →</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item: any) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{item.product?.name || item.product_name}</p>
                      <p className="text-sm text-gray-500">
                        #{item.product?.product_number || '—'} • ${item.unit_price.toFixed(2)} per{' '}
                        {item.product?.unit || 'ea'}
                        {item.gst_applicable && <span className="ml-2 text-xs text-blue-600">+GST</span>}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded hover:bg-gray-300 transition-colors"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-12 text-center font-semibold">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded hover:bg-gray-300 transition-colors"
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="w-24 text-right font-semibold">
                      ${(item.quantity * item.unit_price).toFixed(2)}
                    </div>

                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-red-600 hover:text-red-800 transition-colors"
                      title="Remove item"
                      aria-label="Remove item"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Add Products Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6 sticky top-6">
            <h2 className="text-lg font-semibold mb-4">Add Products</h2>

            <div className="space-y-2 max-h-96 overflow-y-auto mb-6">
              {products.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No products available</p>
              ) : (
                products.map((product: any) => (
                  <button
                    key={product.id}
                    onClick={() => addProduct(product.id)}
                    className="w-full text-left border border-gray-300 rounded p-3 hover:border-green-500 hover:bg-green-50 transition-all"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{product.name}</p>
                        <p className="text-xs text-gray-500">#{product.product_number || '—'}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm">${product.price.toFixed(2)}</p>
                        <p className="text-xs text-gray-500">per {product.unit}</p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Order Summary */}
            <div className="border-t pt-4">
              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>GST (10%):</span>
                  <span>${gst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                  <span>Total:</span>
                  <span className="text-green-600">${total.toFixed(2)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <button
                  onClick={saveChanges}
                  disabled={saving || items.length === 0}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 text-white rounded-lg font-medium transition-all disabled:bg-gray-300 disabled:cursor-not-allowed"
                  style={{ backgroundColor: items.length > 0 && !saving ? '#ffffff' : undefined }}
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>

                <button
                  onClick={() => router.push('/portal')}
                  disabled={saving}
                  className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}