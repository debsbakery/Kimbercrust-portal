'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { 
  Package, 
  RefreshCw,
  Truck,
  DollarSign,
  FileText
} from 'lucide-react';

// Import views
import OrdersView from './orders-view';
import StandingOrdersView from './standing-orders-view';

export default function AdminClientView() {
  const [activeTab, setActiveTab] = useState<'orders' | 'standing-orders'>('orders');
  const supabase = createClient();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Action Buttons */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="container mx-auto px-4">
          {/* Top Bar with Buttons */}
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
            <div className="flex gap-2">
              <a
                href="/admin/production"
                className="flex items-center gap-2 px-4 py-2 text-white rounded-md hover:opacity-90 shadow-md transition-all"
                style={{ backgroundColor: '#006A4E' }}
              >
                <Package className="h-4 w-4" />
                Production
              </a>

              <a
                href="/admin/direct-invoice"
                className="flex items-center gap-2 px-4 py-2 text-white rounded-md hover:opacity-90 shadow-md transition-all"
                style={{ backgroundColor: '#CE1126' }}
              >
                <FileText className="h-4 w-4" />
                Direct Invoice
              </a>

              <a
                href="/admin/routes"
                className="flex items-center gap-2 px-4 py-2 text-white rounded-md hover:opacity-90 shadow-md transition-all"
                style={{ backgroundColor: '#CE1126' }}
              >
                <Truck className="h-4 w-4" />
                Routes
              </a>

              <a
                href="/admin/ar"
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700 shadow-md transition-all"
              >
                <DollarSign className="h-4 w-4" />
                AR Dashboard
              </a>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 overflow-x-auto pb-0">
            <button
              onClick={() => setActiveTab('orders')}
              className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm whitespace-nowrap transition-all border-b-2 ${
                activeTab === 'orders'
                  ? 'border-green-600 text-green-700 bg-green-50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Package className="h-4 w-4" />
              Orders
            </button>

            <button
              onClick={() => setActiveTab('standing-orders')}
              className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm whitespace-nowrap transition-all border-b-2 ${
                activeTab === 'standing-orders'
                  ? 'border-green-600 text-green-700 bg-green-50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <RefreshCw className="h-4 w-4" />
              Standing Orders
            </button>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="container mx-auto px-4 py-6">
        {activeTab === 'orders' && <OrdersView supabase={supabase} />}
        {activeTab === 'standing-orders' && <StandingOrdersView supabase={supabase} />}
      </div>
    </div>
  );
}