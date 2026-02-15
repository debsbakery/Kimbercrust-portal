'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Plus } from 'lucide-react';

interface Customer {
  id: string;
  business_name: string;
  email: string;
  contact_name: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  unit: string;
  product_number: number;
  is_available: boolean;
}

interface StandingOrderItem {
  id?: string;
  product_id: string;
  quantity: number;
}

interface StandingOrder {
  id: string;
  customer_id: string;
  delivery_day: string;
  active: boolean;
  notes: string | null;
  items: StandingOrderItem[];
}

interface Props {
  customers: Customer[];
  products: Product[];
  standingOrder?: StandingOrder;
  mode: 'create' | 'edit';
}

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
];

export default function StandingOrderForm({
  customers,
  products,
  standingOrder,
  mode,
}: Props) {
  const router = useRouter();

  const [customerId, setCustomerId] = useState(standingOrder?.customer_id || '');
  const [deliveryDay, setDeliveryDay] = useState(
    mode === 'edit' 
      ? standingOrder?.delivery_day || 'monday' 
      : '' // Empty for multi-select in create mode
  );
  const [active, setActive] = useState(standingOrder?.active ?? true);
  const [notes, setNotes] = useState(standingOrder?.notes || '');
  const [items, setItems] = useState<StandingOrderItem[]>(
    standingOrder?.items || []
  );
  const [existingDays, setExistingDays] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add item to order
  const addItem = () => {
    setItems([...items, { product_id: '', quantity: 1 }]);
  };

  // Remove item from order
  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Update item
  const updateItem = (index: number, field: 'product_id' | 'quantity', value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  // Load customer's shadow orders (favorites)
  const loadCustomerFavorites = async () => {
    if (!customerId) return;

    try {
      const response = await fetch(`/api/shadow-orders?customerId=${customerId}`);
      const data = await response.json();

      console.log('📦 Shadow orders response:', data);

      if (data.shadowOrders && data.shadowOrders.length > 0) {
        const favoriteItems = data.shadowOrders.map((shadow: any) => ({
          product_id: shadow.product_id,
          quantity: shadow.default_quantity || 1,
        }));
        
        console.log('✅ Loaded favorites:', favoriteItems);
        setItems(favoriteItems);
      } else {
        console.log('⚠️ No favorites found for customer');
        alert('This customer has no favorite items yet.');
      }
    } catch (error) {
      console.error('❌ Failed to load favorites:', error);
      alert('Failed to load customer favorites');
    }
  };

  // Check which days already have standing orders for this customer
  const checkExistingDays = async (customerId: string) => {
    try {
      const response = await fetch(`/api/standing-orders/customer/${customerId}`);
      const data = await response.json();
      
      if (data.standingOrders) {
        const days = data.standingOrders
          .filter((so: any) => so.active) // Only show active ones
          .map((so: any) => so.delivery_day);
        setExistingDays(days);
        console.log('📅 Existing standing order days:', days);
      }
    } catch (error) {
      console.error('Failed to check existing days:', error);
    }
  };

  // Calculate estimated total
  const calculateTotal = () => {
    return items.reduce((sum, item) => {
      const product = products.find((p) => p.id === item.product_id);
      return sum + (product ? product.price * item.quantity : 0);
    }, 0);
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validation
    if (!customerId) {
      setError('Please select a customer');
      setLoading(false);
      return;
    }

    const selectedDays = deliveryDay.split(',').filter(d => d);
    if (selectedDays.length === 0) {
      setError('Please select at least one delivery day');
      setLoading(false);
      return;
    }

    if (items.length === 0) {
      setError('Please add at least one item');
      setLoading(false);
      return;
    }

    if (items.some((item) => !item.product_id || item.quantity < 1)) {
      setError('Please complete all item details');
      setLoading(false);
      return;
    }

    try {
      if (mode === 'edit') {
        // Edit mode - single day only
        const response = await fetch(`/api/standing-orders/${standingOrder?.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            delivery_day: deliveryDay,
            active,
            notes: notes || null,
            items: items.map((item) => ({
              product_id: item.product_id,
              quantity: parseInt(item.quantity.toString()),
            })),
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to update standing order');
        }

        router.push('/admin/standing-orders');
        router.refresh();
      } else {
        // Create mode - potentially multiple days
        const createdOrders: string[] = [];
        const skippedOrders: string[] = [];
        const errors: string[] = [];

        for (const day of selectedDays) {
          try {
            const response = await fetch('/api/standing-orders', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                customer_id: customerId,
                delivery_day: day,
                active,
                notes: notes || null,
                items: items.map((item) => ({
                  product_id: item.product_id,
                  quantity: parseInt(item.quantity.toString()),
                })),
              }),
            });

            const data = await response.json();

            if (response.status === 409 && data.skipped) {
              // Day already exists - skip gracefully
              skippedOrders.push(day);
              console.log(`⏭️ Skipped ${day} (already exists)`);
            } else if (!response.ok) {
              errors.push(`${day}: ${data.error}`);
            } else {
              createdOrders.push(day);
              console.log(`✅ Created standing order for ${day}`);
            }
          } catch (error: any) {
            errors.push(`${day}: ${error.message}`);
          }
        }

        // Build success message
        let successMessage = '';
        if (createdOrders.length > 0) {
          successMessage = `✅ Created ${createdOrders.length} standing order(s) for: ${createdOrders.join(', ')}`;
        }
        if (skippedOrders.length > 0) {
          successMessage += `\n⏭️ Skipped ${skippedOrders.length} day(s) (already exists): ${skippedOrders.join(', ')}`;
        }
        if (errors.length > 0) {
          successMessage += `\n❌ Errors: ${errors.join(', ')}`;
        }

        if (errors.length > 0 && createdOrders.length === 0) {
          // Only errors, no success
          setError(successMessage);
          setLoading(false);
        } else {
          // At least some success
          if (skippedOrders.length > 0 || errors.length > 0) {
            // Show message but still redirect
            alert(successMessage);
          }
          router.push('/admin/standing-orders');
          router.refresh();
        }
      }
    } catch (error: any) {
      setError(error.message || 'An error occurred');
      setLoading(false);
    }
  };

  // Delete standing order
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this standing order?')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/standing-orders/${standingOrder?.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete standing order');
      }

      router.push('/admin/standing-orders');
      router.refresh();
    } catch (error: any) {
      setError(error.message || 'An error occurred');
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amount);
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl">
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-700 font-semibold whitespace-pre-line">❌ {error}</p>
        </div>
      )}

      {/* Customer Selection */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Customer Details</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Customer *
            </label>
            <select
              value={customerId}
              onChange={(e) => {
                const newCustomerId = e.target.value;
                setCustomerId(newCustomerId);
                setItems([]); // Clear items when customer changes
                setExistingDays([]); // Clear existing days
                if (newCustomerId && mode === 'create') {
                  checkExistingDays(newCustomerId);
                }
              }}
              disabled={mode === 'edit'}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
              required
            >
              <option value="">Select a customer...</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.business_name} ({customer.contact_name})
                </option>
              ))}
            </select>
            {mode === 'edit' && (
              <p className="text-xs text-gray-500 mt-1">
                Customer cannot be changed after creation
              </p>
            )}
          </div>

          {customerId && items.length === 0 && (
            <button
              type="button"
              onClick={loadCustomerFavorites}
              className="text-sm text-blue-600 hover:underline"
            >
              ⭐ Load customer's favorite items
            </button>
          )}
        </div>
      </div>

      {/* Delivery Schedule */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Delivery Schedule</h2>

        <div className="space-y-4">
          {/* Multi-day selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Delivery Days * <span className="text-gray-500 text-xs">(Select one or more)</span>
            </label>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {DAYS_OF_WEEK.map((day) => {
                const isSelected = mode === 'edit' 
                  ? deliveryDay === day.value 
                  : deliveryDay.split(',').includes(day.value);
                
                const alreadyExists = existingDays.includes(day.value);

                return (
                  <label
                    key={day.value}
                    className={`flex items-center gap-3 p-3 border-2 rounded-md cursor-pointer transition-colors ${
                      alreadyExists
                        ? 'border-yellow-400 bg-yellow-50 opacity-60'
                        : isSelected
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                    title={alreadyExists ? 'Standing order already exists for this day' : ''}
                  >
                    <input
                      type={mode === 'edit' ? 'radio' : 'checkbox'}
                      name={mode === 'edit' ? 'delivery_day' : undefined}
                      value={day.value}
                      checked={isSelected}
                      disabled={alreadyExists && mode === 'create'}
                      onChange={(e) => {
                        if (mode === 'edit') {
                          setDeliveryDay(day.value);
                        } else {
                          const currentDays = deliveryDay.split(',').filter(d => d);
                          if (e.target.checked) {
                            setDeliveryDay([...currentDays, day.value].join(','));
                          } else {
                            setDeliveryDay(currentDays.filter(d => d !== day.value).join(','));
                          }
                        }
                      }}
                      className="h-4 w-4 text-green-600 disabled:opacity-50"
                    />
                    <span className="text-sm font-medium">
                      {day.label}
                      {alreadyExists && ' ⚠️'}
                    </span>
                  </label>
                );
              })}
            </div>

            {mode === 'create' && (
              <p className="text-xs text-gray-500 mt-2">
                💡 Selecting multiple days will create a separate standing order for each day
              </p>
            )}
            {mode === 'edit' && (
              <p className="text-xs text-gray-500 mt-2">
                ℹ️ To change delivery day, you must create a new standing order
              </p>
            )}
          </div>

          {/* Active/Paused toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-5 w-5 text-green-600"
              />
              <span className="text-sm font-medium">
                {active ? '✅ Active' : '⏸️ Paused'}
              </span>
            </label>
            <p className="text-xs text-gray-500 mt-1">
              {active ? 'Orders will be generated automatically' : 'No orders will be generated'}
            </p>
          </div>
        </div>
      </div>

      {/* Order Items */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Order Items</h2>
          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-md text-white hover:opacity-90"
            style={{ backgroundColor: '#006A4E' }}
          >
            <Plus className="h-4 w-4" />
            Add Item
          </button>
        </div>

        {items.length === 0 ? (
          <p className="text-center py-8 text-gray-500">
            No items added yet. Click "Add Item" to get started.
          </p>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => {
              const product = products.find((p) => p.id === item.product_id);
              const itemTotal = product ? product.price * item.quantity : 0;

              return (
                <div
                  key={index}
                  className="flex gap-3 items-start p-4 border border-gray-200 rounded-md"
                >
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Product
                    </label>
                    <select
                      value={item.product_id}
                      onChange={(e) => updateItem(index, 'product_id', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select product...</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          #{product.product_number} - {product.name} ({formatCurrency(product.price)}/{product.unit})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-32">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Quantity
                    </label>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div className="w-32 text-right">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Subtotal
                    </label>
                    <p className="font-semibold text-sm py-2">
                      {formatCurrency(itemTotal)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="mt-6 p-2 text-red-600 hover:bg-red-50 rounded-md"
                    title="Remove item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}

            {/* Total */}
            <div className="flex justify-end pt-4 border-t border-gray-200">
              <div className="text-right">
                <p className="text-sm text-gray-600">Estimated Weekly Total</p>
                <p className="text-2xl font-bold" style={{ color: '#006A4E' }}>
                  {formatCurrency(calculateTotal())}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Notes (Optional)</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          placeholder="Add any special instructions or notes..."
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 justify-between">
        <div>
          {mode === 'edit' && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="px-6 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              🗑️ Delete Standing Order
            </button>
          )}
        </div>

        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => router.push('/admin/standing-orders')}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            disabled={loading}
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 text-white rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#006A4E' }}
          >
            {loading ? '⏳ Saving...' : mode === 'create' ? '✅ Create Standing Order' : '✅ Update Standing Order'}
          </button>
        </div>
      </div>
    </form>
  );
}