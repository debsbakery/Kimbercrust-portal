'use client';

import { SupabaseClient } from '@supabase/supabase-js';
import { ShoppingCart } from 'lucide-react';

export default function ProductsView({ supabase }: { supabase: SupabaseClient }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-3 mb-4">
        <ShoppingCart className="h-6 w-6 text-green-600" />
        <h2 className="text-2xl font-bold">Products Management</h2>
      </div>
      <p className="text-gray-600">Product management interface coming soon...</p>
    </div>
  );
}