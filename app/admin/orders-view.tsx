'use client';

import { useState, useEffect } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { Package, FileDown, FileText, Calendar, TrendingUp, DollarSign } from 'lucide-react';

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface Order {
  id: string;
  customer_email: string;
  customer_business_name: string | null;
  delivery_date: string;
  notes: string | null;
  status: string;
  total_amount: number | null;
  source: string | null;
  created_at: string;
  order_items: OrderItem[];
}

interface Stats {
  totalOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  todayOrders: number;
}

export default function OrdersView({ supabase }: { supabase: SupabaseClient }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalOrders: 0,
    pendingOrders: 0,
    totalRevenue: 0,
    todayOrders: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrders();
    loadStats();
  }, []);

  async function loadOrders() {
    const { data } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (*)
      `)
      .order('created_at', { ascending: false });

    if (data) {
      setOrders(data as Order[]);
    }
    setLoading(false);
  }

  async function loadStats() {
    const { count: totalOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });

    const { count: pendingOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    const { data: revenueData } = await supabase
      .from('orders')
      .select('total_amount')
      .not('total_amount', 'is', null);

    const totalRevenue = revenueData?.reduce(
      (sum, order) => sum + (order.total_amount || 0),
      0
    ) || 0;

    const today = new Date().toISOString().split('T')[0];
    const { count: todayOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today);

    setStats({
      totalOrders: totalOrders || 0,
      pendingOrders: pendingOrders || 0,
      totalRevenue,
      todayOrders: todayOrders || 0
    });
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-AU');
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-AU');
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-blue-100 text-blue-800',
      preparing: 'bg-purple-100 text-purple-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };

    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    );
  };

  const getSourceBadge = (source: string | null) => {
    if (source === 'online') {
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
          🌐 Online
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-600">
        ✏️ Manual
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Package className="h-8 w-8 animate-spin text-gray-400" />
        <span className="ml-3 text-gray-600">Loading orders...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4" style={{ borderColor: '#CE1126' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600">Total Orders</p>
            <Package className="h-5 w-5 text-gray-400" />
          </div>
          <p className="text-3xl font-bold">{stats.totalOrders}</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-l-4" style={{ borderColor: '#006A4E' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600">Pending Orders</p>
            <Calendar className="h-5 w-5 text-gray-400" />
          </div>
          <p className="text-3xl font-bold" style={{ color: '#CE1126' }}>
            {stats.pendingOrders}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-l-4" style={{ borderColor: '#CE1126' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600">Total Revenue</p>
            <DollarSign className="h-5 w-5 text-gray-400" />
          </div>
          <p className="text-3xl font-bold" style={{ color: '#006A4E' }}>
            {formatCurrency(stats.totalRevenue)}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-l-4" style={{ borderColor: '#006A4E' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600">Today's Orders</p>
            <TrendingUp className="h-5 w-5 text-gray-400" />
          </div>
          <p className="text-3xl font-bold">{stats.todayOrders}</p>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold">Recent Orders</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Order ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Delivery</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Items</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Total</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Source</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Created</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {orders.length > 0 ? (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-sm">
                      #{order.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{order.customer_business_name || '—'}</p>
                        <p className="text-sm text-gray-500">{order.customer_email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">{formatDate(order.delivery_date)}</td>
                    <td className="px-4 py-3">
                      <div className="max-w-[200px]">
                        {order.order_items.slice(0, 2).map((item, idx) => (
                          <p key={idx} className="text-sm truncate">
                            {item.quantity}× {item.product_name}
                          </p>
                        ))}
                        {order.order_items.length > 2 && (
                          <p className="text-xs text-gray-500">
                            +{order.order_items.length - 2} more
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {formatCurrency(order.total_amount || 0)}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(order.status)}</td>
                    <td className="px-4 py-3">{getSourceBadge(order.source)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDateTime(order.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-center">
                        <a
                          href={`/api/invoice/${order.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md text-white hover:opacity-90"
                          style={{ backgroundColor: '#CE1126' }}
                        >
                          <FileDown className="h-4 w-4" />
                          Invoice
                        </a>
                        <a
                          href={`/api/packing-slip/${order.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md text-white hover:opacity-90"
                          style={{ backgroundColor: '#006A4E' }}
                        >
                          <Package className="h-4 w-4" />
                          Slip
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    No orders yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}