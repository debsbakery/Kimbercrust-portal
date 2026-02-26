'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Clock, Users, BarChart3, Package, RefreshCw, Truck,
  DollarSign, FileText, ShoppingCart, ChefHat, Receipt,
  Copy, Play, FileMinus,
} from 'lucide-react';

// Import views
import OrdersView from './orders-view';
import StandingOrdersView from './standing-orders-view';
import ContractPricingPage from './pricing/page';
import ProductsView from './products-view';

// ✅ Import the customers page component
import CustomersPage from '../customers/page';

// ✅ Add 'customers' to the type
type Tab = 'orders' | 'standing-orders' | 'pricing' | 'products' | 'customers';

export default function AdminClientView() {
  const [activeTab, setActiveTab] = useState<Tab>('orders');
  const supabase = createClient();
  const [testingStandingOrders, setTestingStandingOrders] = useState(false);

  async function testStandingOrderGeneration() {
    if (!confirm('⚠️ This will generate standing orders for the upcoming week.\n\nContinue?')) return;
    setTestingStandingOrders(true);
    try {
      const response = await fetch('/api/standing-orders/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (data.success) {
        let message = `✅ SUCCESS!\n\n${data.ordersCreated} orders created\n\n`;
        if (data.orders?.length > 0) {
          message += 'Orders:\n';
          data.orders.forEach((order: any) => {
            message += `• ${order.customer} - ${order.deliveryDay} (${order.deliveryDate}) - $${order.total.toFixed(2)}\n`;
          });
        }
        if (data.errors?.length > 0) {
          message += `\n⚠️ ${data.errors.length} error(s) - check console`;
          console.error('Errors:', data.errors);
        }
        alert(message);
        if (data.ordersCreated > 0) window.location.reload();
      } else {
        throw new Error(data.error || 'Generation failed');
      }
    } catch (error: any) {
      alert(`❌ Error: ${error.message}`);
    } finally {
      setTestingStandingOrders(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: '#006A4E' }}>
                Admin Dashboard
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Manage your wholesale bakery operations
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={testStandingOrderGeneration}
                disabled={testingStandingOrders}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-md transition-all disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {testingStandingOrders ? (
                  <><RefreshCw className="h-4 w-4 animate-spin" />Generating...</>
                ) : (
                  <><Play className="h-4 w-4" />Test Standing Orders</>
                )}
              </button>

              <a href="/admin/production"
                className="flex items-center gap-2 px-4 py-2 text-white rounded-md hover:opacity-90 shadow-md"
                style={{ backgroundColor: '#006A4E' }}>
                <ChefHat className="h-4 w-4" />Production
              </a>

              <a href="/admin/batch-invoice"
                className="flex items-center gap-2 px-4 py-2 text-white rounded-md hover:opacity-90 shadow-md"
                style={{ backgroundColor: '#CE1126' }}>
                <FileText className="h-4 w-4" />Batch Invoice
              </a>

              <a href="/admin/direct-invoice"
                className="flex items-center gap-2 px-4 py-2 text-white rounded-md hover:opacity-90 shadow-md"
                style={{ backgroundColor: '#CE1126' }}>
                <Receipt className="h-4 w-4" />Direct Invoice
              </a>

              <a href="/admin/gst-report"
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 shadow-md">
                <BarChart3 className="h-4 w-4" />GST Report
              </a>

              <a href="/admin/customers/pending"
                className="flex items-center gap-2 px-4 py-2 text-white text-sm rounded-md hover:opacity-90 shadow-md"
                style={{ backgroundColor: '#ea580c' }}>
                <Clock className="h-4 w-4" />Pending Approvals
              </a>

              <a href="/admin/customers/repeat-order-search"
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 shadow-md">
                <Copy className="h-4 w-4" />Repeat Order
              </a>

              {/* ✅ Customers button now switches tab */}
              <button
                onClick={() => setActiveTab('customers')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium shadow-md transition-colors ${
                  activeTab === 'customers'
                    ? 'text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                style={activeTab === 'customers' ? { backgroundColor: '#006A4E' } : {}}
              >
                <Users className="h-4 w-4" />
                Customers
              </button>

              <a href="/admin/products"
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 shadow-md">
                <Package className="h-4 w-4" />Products
              </a>

              <a href="/admin/routes"
                className="flex items-center gap-2 px-4 py-2 text-white rounded-md hover:opacity-90 shadow-md"
                style={{ backgroundColor: '#CE1126' }}>
                <Truck className="h-4 w-4" />Routes
              </a>

              <a href="/admin/ar"
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700 shadow-md">
                <DollarSign className="h-4 w-4" />AR Dashboard
              </a>

              <a href="/admin/payments/record"
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 shadow-md">
                <DollarSign className="h-4 w-4" />Record Payment
              </a>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 overflow-x-auto pb-0">
            {[
              { id: 'orders',          icon: <Package className="h-4 w-4" />,   label: 'Orders' },
              { id: 'standing-orders', icon: <RefreshCw className="h-4 w-4" />, label: 'Standing Orders' },
              { id: 'products',        icon: <ShoppingCart className="h-4 w-4" />, label: 'Products' },
              { id: 'pricing',         icon: <DollarSign className="h-4 w-4" />, label: 'Contract Pricing' },
              { id: 'customers',       icon: <Users className="h-4 w-4" />,     label: 'Customers' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm whitespace-nowrap transition-all border-b-2 ${
                  activeTab === tab.id
                    ? 'border-green-600 text-green-700 bg-green-50'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="container mx-auto px-4 py-6">
        {activeTab === 'orders'          && <OrdersView supabase={supabase} />}
        {activeTab === 'standing-orders' && <StandingOrdersView supabase={supabase} />}
        {activeTab === 'products'        && <ProductsView />}
        {activeTab === 'pricing'         && <ContractPricingPage />}
        {/* ✅ Customers tab content */}
        {activeTab === 'customers'       && (
          <iframe
            src="/admin/customers"
            className="w-full border-0 rounded-lg"
            style={{ height: 'calc(100vh - 200px)' }}
          />
        )}
      </div>
    </div>
  );
}