'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface RouteFormProps {
  route?: {
    route_number: string;
    route_name: string;
    driver_name: string | null;
    start_time: string | null;
    estimated_duration_minutes: number | null;
    notes: string | null;
  };
  isEditing?: boolean;
}

export default function RouteForm({ route, isEditing = false }: RouteFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    route_number: route?.route_number || '',
    route_name: route?.route_name || '',
    driver_name: route?.driver_name || '',
    start_time: route?.start_time || '06:00',
    estimated_duration_minutes: route?.estimated_duration_minutes?.toString() || '120',
    notes: route?.notes || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const url = isEditing
        ? `/api/routes/${route?.route_number}`
        : '/api/routes';

      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          estimated_duration_minutes: formData.estimated_duration_minutes
            ? parseInt(formData.estimated_duration_minutes)
            : null,
        }),
      });

      const data = await response.json();

      if (data.error) throw new Error(data.error);

      router.push('/admin/routes');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-700 font-semibold">❌ Error</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Route Number */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Route Number <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.route_number}
          onChange={(e) => setFormData({ ...formData, route_number: e.target.value.toUpperCase() })}
          className="w-full px-3 py-2 border rounded-md uppercase focus:ring-2 focus:ring-green-500 focus:border-transparent"
          placeholder="R1"
          required
          disabled={isEditing}
          maxLength={50}
        />
        <p className="text-xs text-gray-500 mt-1">
          {isEditing 
            ? 'Route number cannot be changed after creation'
            : 'Example: R1, R2, NORTH, SOUTH (will be uppercase)'
          }
        </p>
      </div>

      {/* Route Name */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Route Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.route_name}
          onChange={(e) => setFormData({ ...formData, route_name: e.target.value })}
          className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
          placeholder="North Route"
          required
        />
      </div>

      {/* Driver Name */}
      <div>
        <label className="block text-sm font-medium mb-2">Driver Name</label>
        <input
          type="text"
          value={formData.driver_name}
          onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })}
          className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
          placeholder="John Smith"
        />
        <p className="text-xs text-gray-500 mt-1">Optional - can be assigned later</p>
      </div>

      {/* Start Time & Duration */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Start Time</label>
          <input
            type="time"
            value={formData.start_time}
            onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Estimated Duration (minutes)
          </label>
          <input
            type="number"
            value={formData.estimated_duration_minutes}
            onChange={(e) => setFormData({ ...formData, estimated_duration_minutes: e.target.value })}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
            min="0"
            step="15"
            placeholder="120"
          />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium mb-2">Notes</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
          rows={3}
          placeholder="Any special instructions for this route..."
        />
      </div>

      {/* Actions */}
      <div className="flex gap-4 pt-4 border-t">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-6 py-3 rounded-md text-white font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          style={{ backgroundColor: "#006A4E" }}
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Saving...
            </span>
          ) : (
            isEditing ? 'Update Route' : 'Create Route'
          )}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-3 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors"
          disabled={loading}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}