'use client';

import { useState, useEffect } from 'react';
import { Truck, MapPin, Clock, Edit, Trash2, Users } from 'lucide-react';
import Link from 'next/link';

interface Route {
  id: string;
  route_number: string;
  route_name: string;
  driver_name: string | null;
  start_time: string | null;
  estimated_duration_minutes: number | null;
  active: boolean;
  notes: string | null;
  customers?: Customer[];
}

interface Customer {
  id: string;
  business_name: string;
  contact_name: string;
  address: string;
  phone: string;
  drop_sequence: number | null;
  delivery_notes: string | null;
}

export default function RoutesView() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);

  useEffect(() => {
    fetchRoutes();
  }, [activeOnly]);

  const fetchRoutes = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`/api/routes?active=${activeOnly}`);
      const data = await response.json();
      
      if (data.error) throw new Error(data.error);
      
      setRoutes(data.routes || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (routeNumber: string) => {
    if (!confirm(`Deactivate route ${routeNumber}? This will not delete customer assignments.`)) return;
    
    try {
      const response = await fetch(`/api/routes/${routeNumber}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) throw new Error('Failed to deactivate route');
      
      fetchRoutes();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          <p className="ml-3 text-gray-500">Loading routes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700 font-semibold">❌ Error loading routes</p>
        <p className="text-red-600 text-sm mt-1">{error}</p>
        <button 
          onClick={fetchRoutes}
          className="mt-3 text-sm text-red-700 underline hover:no-underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Filter Toggle */}
      <div className="mb-6 flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          <span className="text-sm font-medium">Show active routes only</span>
        </label>
        <span className="text-sm text-gray-600">
          ({routes.length} route{routes.length !== 1 ? 's' : ''})
        </span>
      </div>

      {/* Routes Grid */}
      {routes.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <Truck className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg font-medium">No routes found</p>
          <p className="text-gray-400 text-sm mt-2">
            {activeOnly 
              ? 'No active routes. Try unchecking "Show active only" or create a new route.'
              : 'Create your first delivery route to get started'
            }
          </p>
          <Link
            href="/admin/routes/create"
            className="inline-block mt-4 px-6 py-2 rounded-md text-white font-semibold hover:opacity-90"
            style={{ backgroundColor: "#006A4E" }}
          >
            + Create Route
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {routes.map((route) => (
            <div
              key={route.route_number}
              className={`bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow ${
                !route.active ? 'opacity-60' : ''
              }`}
            >
              {/* Header */}
              <div
                className="p-4 rounded-t-lg text-white"
                style={{ backgroundColor: route.active ? "#006A4E" : "#6B7280" }}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold">{route.route_number}</h3>
                    <p className="text-sm opacity-90">{route.route_name}</p>
                  </div>
                  {!route.active && (
                    <span className="bg-white/20 px-2 py-1 rounded text-xs font-semibold">
                      Inactive
                    </span>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="p-4 space-y-3">
                {/* Driver */}
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-700">
                    {route.driver_name || <em className="text-gray-400">No driver assigned</em>}
                  </span>
                </div>

                {/* Start Time */}
                {route.start_time && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <span className="text-gray-700">
                      Starts at {route.start_time}
                      {route.estimated_duration_minutes && (
                        <span className="text-gray-500 ml-1">
                          (~{route.estimated_duration_minutes} min)
                        </span>
                      )}
                    </span>
                  </div>
                )}

                {/* Customer Count */}
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-700">
                    {route.customers?.length || 0} stop{route.customers?.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Notes */}
                {route.notes && (
                  <div className="mt-3 p-2 bg-gray-50 rounded text-xs text-gray-600 border border-gray-200">
                    {route.notes}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="p-4 border-t flex gap-2">
                <Link
                  href={`/admin/routes/${route.route_number}`}
                  className="flex-1 text-center px-3 py-2 rounded-md text-white text-sm font-semibold hover:opacity-90"
                  style={{ backgroundColor: "#006A4E" }}
                >
                  <Edit className="h-4 w-4 inline mr-1" />
                  Edit
                </Link>
                <Link
                  href={`/admin/routes/${route.route_number}/run-sheet`}
                  className="flex-1 text-center px-3 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
                >
                  📋 Run Sheet
                </Link>
                {route.active && (
                  <button
                    onClick={() => handleDeactivate(route.route_number)}
                    className="px-3 py-2 rounded-md bg-red-100 text-red-700 hover:bg-red-200"
                    title="Deactivate route"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}