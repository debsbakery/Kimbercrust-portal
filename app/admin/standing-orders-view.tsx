'use client';

import { useState, useEffect } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { 
  RefreshCw, 
  Plus, 
  Edit2, 
  Trash2, 
  Package,
  Pause,
  Play,
  AlertCircle
} from 'lucide-react';

// ✅ CORRECTED INTERFACE - matches actual database schema
interface StandingOrder {
  id: string;
  customer_id: string;
  delivery_days: string; // ✅ Single day (lowercase string)
  frequency: string;
  active: boolean; // ✅ NOT is_active
  notes: string | null;
  created_at: string;
  customers: {
    business_name: string;
    email: string;
  };
  standing_order_items: Array<{
    id: string;
    product_id: string;
    quantity: number;
    products: {
      name: string;
      price: number;
      unit_price: number;
    };
  }>;
}

// Map of days for ordering
const DAY_ORDER: Record<string, number> = {
  'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4,
  'friday': 5, 'saturday': 6, 'sunday': 7
};

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function StandingOrdersView({ supabase }: { supabase: SupabaseClient }) {
  const [standingOrders, setStandingOrders] = useState<StandingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  useEffect(() => {
    loadStandingOrders();
  }, []);

  async function loadStandingOrders() {
    setLoading(true);
    
    const { data } = await supabase
      .from('standing_orders')
      .select(`
        *,
        customers (
          business_name,
          email
        ),
        standing_order_items (
          id,
          product_id,
          quantity,
          products (
            name,
            price,
            unit_price
          )
        )
      `)
      .order('created_at', { ascending: false });

    // ✅ FIX: Add explicit type annotations to both map callbacks
    const normalizedData = data?.map((order: any) => ({
      ...order,
      standing_order_items: order.standing_order_items.map((item: any) => ({
        ...item,
        products: {
          ...item.products,
          unit_price: item.products.unit_price || item.products.price || 0
        }
      }))
    }));
    
    setStandingOrders(normalizedData || []);
    setLoading(false);
  }

  async function toggleActive(orderId: string, currentStatus: boolean) {
    const { error } = await supabase
      .from('standing_orders')
      .update({ active: !currentStatus }) // ✅ Using 'active', not 'is_active'
      .eq('id', orderId);

    if (error) {
      console.error('Error toggling status:', error);
      alert('Failed to update status');
    } else {
      loadStandingOrders();
    }
  }

  async function deleteOrder(orderId: string) {
    if (!confirm('Are you sure you want to delete this standing order?')) return;

    const { error: itemsError } = await supabase
      .from('standing_order_items')
      .delete()
      .eq('standing_order_id', orderId);

    if (itemsError) {
      console.error('Error deleting items:', itemsError);
      alert('Failed to delete order items');
      return;
    }

    const { error } = await supabase
      .from('standing_orders')
      .delete()
      .eq('id', orderId);

    if (error) {
      console.error('Error deleting order:', error);
      alert('Failed to delete standing order');
    } else {
      loadStandingOrders();
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount);
  };

  const calculateTotal = (items: StandingOrder['standing_order_items']) => {
    return items.reduce((sum, item) => sum + (item.quantity * item.products.unit_price), 0);
  };

  // Group orders by customer
  const ordersByCustomer = standingOrders.reduce((acc, order) => {
    const key = order.customer_id;
    if (!acc[key]) {
      acc[key] = {
        customer: order.customers,
        orders: []
      };
    }
    acc[key].orders.push(order);
    return acc;
  }, {} as Record<string, { customer: any; orders: StandingOrder[] }>);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        <span className="ml-3 text-gray-600">Loading standing orders...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Standing Orders</h2>
          <p className="text-gray-600 mt-1">
            Manage recurring weekly orders • {standingOrders.length} delivery days configured
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Delivery Days</p>
              <p className="text-3xl font-bold text-green-600">
                {standingOrders.filter(o => o.active).length}
              </p>
            </div>
            <Play className="h-12 w-12 text-green-200" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-gray-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Paused Delivery Days</p>
              <p className="text-3xl font-bold text-gray-600">
                {standingOrders.filter(o => !o.active).length}
              </p>
            </div>
            <Pause className="h-12 w-12 text-gray-200" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Customers with Standing Orders</p>
              <p className="text-3xl font-bold text-blue-600">
                {Object.keys(ordersByCustomer).length}
              </p>
            </div>
            <RefreshCw className="h-12 w-12 text-blue-200" />
          </div>
        </div>
      </div>

      {/* Standing Orders List - Grouped by Customer */}
      <div className="bg-white rounded-lg shadow">
        {Object.keys(ordersByCustomer).length === 0 ? (
          <div className="text-center py-12">
            <RefreshCw className="h-16 w-16 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg">No standing orders yet</p>
          </div>
        ) : (
          <div className="divide-y">
            {Object.entries(ordersByCustomer).map(([customerId, { customer, orders }]) => {
              // Sort orders by day of week
              const sortedOrders = [...orders].sort((a, b) => 
                (DAY_ORDER[a.delivery_days] || 0) - (DAY_ORDER[b.delivery_days] || 0)
              );

              const totalValue = sortedOrders.reduce((sum, order) => 
                sum + calculateTotal(order.standing_order_items), 0
              );

              return (
                <div key={customerId} className="p-6">
                  {/* Customer Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold">{customer.business_name}</h3>
                      <p className="text-sm text-gray-600">{customer.email}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {sortedOrders.length} delivery day(s) configured
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600 mb-1">Weekly Value</p>
                      <p className="text-2xl font-bold text-green-600">
                        {formatCurrency(totalValue)}
                      </p>
                    </div>
                  </div>

                  {/* Delivery Days */}
                  <div className="space-y-3">
                    {sortedOrders.map((order) => {
                      const isExpanded = expandedOrder === order.id;
                      const orderValue = calculateTotal(order.standing_order_items);

                      return (
                        <div key={order.id} className="border rounded-lg p-4 bg-gray-50">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                                order.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                              }`}>
                                {order.delivery_days.charAt(0).toUpperCase() + order.delivery_days.slice(1)}
                              </span>
                              <span className="text-sm text-gray-600">
                                {order.frequency} • {order.standing_order_items.length} items
                              </span>
                              <span className="text-sm font-semibold text-gray-700">
                                {formatCurrency(orderValue)}
                              </span>
                            </div>

                            <div className="flex gap-2">
                              <button
                                onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                                className="px-3 py-1.5 text-sm bg-white hover:bg-gray-100 rounded-md font-semibold flex items-center gap-2 border"
                              >
                                <Package className="h-4 w-4" />
                                {isExpanded ? 'Hide' : 'View'}
                              </button>

                              <button
                                onClick={() => toggleActive(order.id, order.active)}
                                className={`px-3 py-1.5 text-sm rounded-md font-semibold flex items-center gap-2 ${
                                  order.active
                                    ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800'
                                    : 'bg-green-100 hover:bg-green-200 text-green-800'
                                }`}
                              >
                                {order.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                                {order.active ? 'Pause' : 'Activate'}
                              </button>

                              <button
                                onClick={() => deleteOrder(order.id)}
                                className="px-3 py-1.5 text-sm bg-red-100 hover:bg-red-200 text-red-800 rounded-md font-semibold flex items-center gap-2"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>

                          {/* Expanded Items */}
                          {isExpanded && (
                            <div className="mt-4 pt-4 border-t">
                              <table className="w-full text-sm">
                                <thead className="bg-white border-b">
                                  <tr>
                                    <th className="py-2 px-3 text-left">Product</th>
                                    <th className="py-2 px-3 text-center">Quantity</th>
                                    <th className="py-2 px-3 text-right">Unit Price</th>
                                    <th className="py-2 px-3 text-right">Subtotal</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {order.standing_order_items.map((item) => (
                                    <tr key={item.id} className="border-b">
                                      <td className="py-2 px-3">{item.products.name}</td>
                                      <td className="py-2 px-3 text-center font-semibold">{item.quantity}</td>
                                      <td className="py-2 px-3 text-right">{formatCurrency(item.products.unit_price)}</td>
                                      <td className="py-2 px-3 text-right font-semibold">
                                        {formatCurrency(item.quantity * item.products.unit_price)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-blue-900">About Standing Orders</h3>
            <p className="text-blue-800 text-sm mt-1">
              Standing orders are configured per delivery day. Each customer can have multiple days set up.
              Paused orders won't generate new orders until reactivated.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}