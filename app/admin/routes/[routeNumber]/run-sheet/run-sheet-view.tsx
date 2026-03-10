'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Printer, Calendar } from 'lucide-react';

interface RunSheetData {
  route: {
    route_number: string;
    route_name: string;
    driver_name: string | null;
    start_time: string | null;
    customers: Array<{
      id: string;
      business_name: string;
      contact_name: string;
      address: string;
      phone: string;
      email: string;
      drop_sequence: number;
      delivery_notes: string | null;
      orders: Array<{
        id: string;
        total_amount: number;
        notes: string | null;
      }>;
    }>;
  };
  date: string;
}

export default function RunSheetView({ data }: { data: RunSheetData }) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(data.date);

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    router.push(`/admin/routes/${data.route.route_number}/run-sheet?date=${newDate}`);
  };

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-AU', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amount);
  };

  // Filter customers to only include those with orders
  const customersWithOrders = data.route.customers.filter(c => c.orders && c.orders.length > 0);
  
  const totalStops = data.route.customers.length;
  const activeStops = customersWithOrders.length;

  // Calculate total value
  const totalValue = customersWithOrders.reduce((sum, customer) => {
    const customerTotal = customer.orders.reduce((orderSum, order) => orderSum + (order.total_amount || 0), 0);
    return sum + customerTotal;
  }, 0);

  return (
    <div>
      {/* No-print controls */}
      <div className="no-print container mx-auto px-4 py-8">
        <a
          href={`/admin/routes/${data.route.route_number}`}
          className="flex items-center gap-1 text-sm mb-4 hover:opacity-80"
          style={{ color: "#8B0000" }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Route
        </a>

        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">Run Sheet: {data.route.route_number}</h1>
            <p className="text-gray-600">{data.route.route_name}</p>
          </div>

          <div className="flex gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gray-600" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={handlePrint}
              disabled={activeStops === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-white font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#2c2c2c" }}
            >
              <Printer className="h-5 w-5" />
              Print
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-md border-l-4" style={{ borderColor: "#2c2c2c" }}>
            <p className="text-sm text-gray-600">Total Customers</p>
            <p className="text-2xl font-bold">{totalStops}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-md border-l-4" style={{ borderColor: "#8B0000" }}>
            <p className="text-sm text-gray-600">Stops with Orders</p>
            <p className="text-2xl font-bold">{activeStops}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-md border-l-4" style={{ borderColor: "#FFD700" }}>
            <p className="text-sm text-gray-600">Start Time</p>
            <p className="text-2xl font-bold">{data.route.start_time || 'N/A'}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-md border-l-4" style={{ borderColor: "#2c2c2c" }}>
            <p className="text-sm text-gray-600">Total Value</p>
            <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
          </div>
        </div>

        {/* Warning if no orders */}
        {activeStops === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-yellow-800 font-semibold">⚠️ No orders for {formatDate(data.date)}</p>
            <p className="text-yellow-700 text-sm mt-1">
              No customers on this route have orders for the selected date. Try selecting a different date or check if orders have been placed.
            </p>
          </div>
        )}
      </div>

      {/* Printable content */}
      {activeStops > 0 && (
        <>
          <div className="print-only print-header">
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: '0' }}>
                DELIVERY RUN SHEET
              </h1>
              <p style={{ fontSize: '16px', color: '#666', margin: '5px 0' }}>
                {formatDate(data.date)}
              </p>
            </div>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(4, 1fr)', 
              gap: '20px',
              marginBottom: '20px', 
              borderBottom: '3px solid #000', 
              paddingBottom: '15px',
              fontSize: '14px'
            }}>
              <div>
                <strong>Route:</strong> {data.route.route_number} - {data.route.route_name}
              </div>
              <div>
                <strong>Driver:</strong> {data.route.driver_name || '_________________'}
              </div>
              <div>
                <strong>Start:</strong> {data.route.start_time || 'N/A'}
              </div>
              <div>
                <strong>Stops:</strong> {activeStops} | <strong>Value:</strong> {formatCurrency(totalValue)}
              </div>
            </div>
          </div>

          <div className="container mx-auto px-4 pb-8">
            <div className="space-y-3">
              {customersWithOrders.map((customer, index) => {
                const customerTotal = customer.orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
                
                return (
                  <div
                    key={customer.id}
                    className="bg-white border-2 border-gray-300 rounded-lg print-stop"
                    style={{ pageBreakInside: 'avoid' }}
                  >
                    {/* Customer Header */}
                    <div className="p-4 bg-gray-100 border-b-2 border-gray-300 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-12 h-12 border-2 border-gray-800 rounded-full flex items-center justify-center text-2xl font-bold"
                          style={{ backgroundColor: "#2c2c2c", color: "white" }}
                        >
                          {index + 1}
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">{customer.business_name}</h3>
                          {customer.contact_name && (
                            <p className="text-sm text-gray-600">Contact: {customer.contact_name}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-600">Order Value</p>
                        <p className="text-xl font-bold" style={{ color: "#2c2c2c" }}>
                          {formatCurrency(customerTotal)}
                        </p>
                      </div>
                    </div>

                    {/* Customer Details */}
                    <div className="p-4 grid md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 font-semibold mb-1">📍 ADDRESS</p>
                        <p className="text-base font-medium">{customer.address || 'No address'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 font-semibold mb-1">📞 PHONE</p>
                          <p className="text-base">{customer.phone || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 font-semibold mb-1">📧 EMAIL</p>
                          <p className="text-sm truncate">{customer.email || 'N/A'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Delivery Notes */}
                    {customer.delivery_notes && (
                      <div className="px-4 pb-4">
                        <div className="p-3 bg-yellow-100 border-2 border-yellow-400 rounded">
                          <p className="text-sm text-yellow-900 font-semibold">⚠️ DELIVERY INSTRUCTIONS:</p>
                          <p className="text-sm text-yellow-900 mt-1">{customer.delivery_notes}</p>
                        </div>
                      </div>
                    )}

                    {/* Order Notes */}
                    {customer.orders.some(o => o.notes) && (
                      <div className="px-4 pb-4">
                        <div className="p-3 bg-blue-50 border-2 border-blue-300 rounded">
                          <p className="text-sm text-blue-900 font-semibold">📝 ORDER NOTES:</p>
                          {customer.orders.map(order => 
                            order.notes && (
                              <p key={order.id} className="text-sm text-blue-900 mt-1">• {order.notes}</p>
                            )
                          )}
                        </div>
                      </div>
                    )}

                    {/* Checkbox Section */}
                    <div className="p-4 border-t-2 border-gray-300 bg-gray-50">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 border-2 border-gray-800 rounded"></div>
                          <span className="text-sm font-semibold">Packing Slip</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 border-2 border-gray-800 rounded"></div>
                          <span className="text-sm font-semibold">Invoice</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 border-2 border-gray-800 rounded"></div>
                          <span className="text-sm font-semibold">Delivered</span>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-600 font-semibold mb-1">DELIVERED BY</p>
                          <div className="border-b-2 border-gray-400 h-8"></div>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 font-semibold mb-1">TIME</p>
                          <div className="border-b-2 border-gray-400 h-8"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          
          .print-only,
          .print-only * {
            visibility: visible;
          }
          
          .print-header {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            padding: 20px;
            background: white;
          }
          
          .no-print {
            display: none !important;
          }
          
          .print-stop {
            page-break-inside: avoid;
            margin-bottom: 15px;
          }
          
          @page {
            margin: 1.5cm;
          }
        }
      `}</style>
    </div>
  );
}