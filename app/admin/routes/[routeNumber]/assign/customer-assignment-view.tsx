'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, ArrowUp, ArrowDown, Save, Users } from 'lucide-react';

interface Customer {
  id: string;
  business_name: string;
  contact_name: string;
  address: string;
  phone: string;
  email: string;
  route_number: string | null;
  drop_sequence: number | null;
}

interface AssignedCustomer extends Customer {
  drop_sequence: number;
}

interface Props {
  routeNumber: string;
  initialCustomers: Customer[];
}

export default function CustomerAssignmentView({ routeNumber, initialCustomers }: Props) {
  const router = useRouter();
  const [assignedCustomers, setAssignedCustomers] = useState<AssignedCustomer[]>([]);
  const [availableCustomers, setAvailableCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchAllCustomers();
  }, []);

  const fetchAllCustomers = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/customers');
      const data = await response.json();

      if (data.error) throw new Error(data.error);

      const customers = data.customers || [];

      const assigned = customers
        .filter((c: Customer) => c.route_number === routeNumber.toUpperCase())
        .sort((a: Customer, b: Customer) => (a.drop_sequence || 999) - (b.drop_sequence || 999));

      const available = customers.filter((c: Customer) => !c.route_number || c.route_number !== routeNumber.toUpperCase());

      setAssignedCustomers(assigned);
      setAvailableCustomers(available);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignCustomer = (customer: Customer) => {
    const nextSequence = assignedCustomers.length > 0
      ? Math.max(...assignedCustomers.map(c => c.drop_sequence || 0)) + 1
      : 1;

    const newAssigned = {
      ...customer,
      drop_sequence: nextSequence,
    };

    setAssignedCustomers([...assignedCustomers, newAssigned]);
    setAvailableCustomers(availableCustomers.filter(c => c.id !== customer.id));
  };

  const handleUnassignCustomer = (customerId: string) => {
    const customer = assignedCustomers.find(c => c.id === customerId);
    if (!customer) return;

    setAvailableCustomers([...availableCustomers, { ...customer, route_number: null, drop_sequence: null }]);
    setAssignedCustomers(assignedCustomers.filter(c => c.id !== customerId));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;

    const newAssigned = [...assignedCustomers];
    [newAssigned[index - 1], newAssigned[index]] = [newAssigned[index], newAssigned[index - 1]];

    newAssigned.forEach((c, i) => {
      c.drop_sequence = i + 1;
    });

    setAssignedCustomers(newAssigned);
  };

  const handleMoveDown = (index: number) => {
    if (index === assignedCustomers.length - 1) return;

    const newAssigned = [...assignedCustomers];
    [newAssigned[index], newAssigned[index + 1]] = [newAssigned[index + 1], newAssigned[index]];

    newAssigned.forEach((c, i) => {
      c.drop_sequence = i + 1;
    });

    setAssignedCustomers(newAssigned);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');

    try {
      const assignedUpdates = assignedCustomers.map(c => ({
        customer_id: c.id,
        route_number: routeNumber.toUpperCase(),
        drop_sequence: c.drop_sequence,
      }));

      const originalIds = initialCustomers.map(c => c.id);
      const currentIds = assignedCustomers.map(c => c.id);
      const removedIds = originalIds.filter(id => !currentIds.includes(id));

      const unassignedUpdates = removedIds.map(id => ({
        customer_id: id,
        route_number: null,
        drop_sequence: null,
      }));

      const allUpdates = [...assignedUpdates, ...unassignedUpdates];

      const response = await fetch('/api/customers/bulk-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments: allUpdates }),
      });

      const data = await response.json();

      if (data.error) throw new Error(data.error);

      router.push(`/admin/routes/${routeNumber}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredAvailable = availableCustomers.filter(c =>
    c.business_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.address?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
        <p className="mt-3 text-gray-500">Loading customers...</p>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Assigned Customers */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Users className="h-5 w-5" style={{ color: "#006A4E" }} />
            Assigned Customers ({assignedCustomers.length})
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Delivery order from top to bottom
          </p>
        </div>

        <div className="p-6">
          {assignedCustomers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No customers assigned yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Select customers from the right to add them
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {assignedCustomers.map((customer, index) => (
                <div
                  key={customer.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: "#006A4E" }}
                  >
                    {index + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{customer.business_name}</p>
                    <p className="text-sm text-gray-600 truncate">{customer.address}</p>
                  </div>

                  <div className="flex gap-1">
                    <button
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move up"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleMoveDown(index)}
                      disabled={index === assignedCustomers.length - 1}
                      className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move down"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleUnassignCustomer(customer.id)}
                      className="p-1.5 rounded hover:bg-red-100 text-red-600"
                      title="Remove from route"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Available Customers */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Plus className="h-5 w-5" style={{ color: "#CE1126" }} />
            Available Customers ({availableCustomers.length})
          </h2>

          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search customers..."
            className="w-full mt-3 px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        <div className="p-6 max-h-[600px] overflow-y-auto">
          {filteredAvailable.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">
                {searchTerm ? 'No customers found' : 'All customers assigned'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredAvailable.map((customer) => (
                <div
                  key={customer.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-green-500 transition-colors cursor-pointer"
                  onClick={() => handleAssignCustomer(customer)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{customer.business_name}</p>
                    <p className="text-sm text-gray-600 truncate">{customer.address}</p>
                    {customer.route_number && (
                      <p className="text-xs text-blue-600 mt-1">
                        Currently on: {customer.route_number}
                      </p>
                    )}
                  </div>
                  <button
                    className="flex-shrink-0 p-2 rounded-full hover:bg-green-100 text-green-600"
                    title="Add to route"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="lg:col-span-2 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 font-semibold">❌ Error</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      )}

      <div className="lg:col-span-2 flex gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 px-6 py-3 rounded-md text-white font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{ backgroundColor: "#006A4E" }}
        >
          {saving ? (
            <>
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Saving...
            </>
          ) : (
            <>
              <Save className="h-5 w-5" />
              Save Assignments
            </>
          )}
        </button>
        <button
          onClick={() => router.back()}
          disabled={saving}
          className="px-6 py-3 rounded-md border border-gray-300 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}