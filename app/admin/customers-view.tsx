'use client';

import { SupabaseClient } from '@supabase/supabase-js';
import { Users } from 'lucide-react';

export default function CustomersView({ supabase }: { supabase: SupabaseClient }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-3 mb-4">
        <Users className="h-6 w-6 text-green-600" />
        <h2 className="text-2xl font-bold">Customers Management</h2>
      </div>
      <p className="text-gray-600">Customer management interface coming soon...</p>
    </div>
  );
}