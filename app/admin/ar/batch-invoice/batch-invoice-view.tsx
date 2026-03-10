'use client';

import { useState, useEffect } from 'react';
import { Mail, FileText, Loader2, Calendar } from 'lucide-react';

interface PendingBatch {
  delivery_date: string;
  count: number;
  total_amount: number;
}

export default function BatchInvoiceView() {
  const [pendingBatches, setPendingBatches] = useState<PendingBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
const [sendEmails, setSendEmails] = useState(false)
  useEffect(() => {
    loadPendingOrders();
  }, []);

  async function loadPendingOrders() {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 14);
      const endDateStr = endDate.toISOString().split('T')[0];

      const response = await fetch(`/api/admin/batch-invoice?start_date=${today}&end_date=${endDateStr}`);
      const data = await response.json();

      if (data.success) {
        setPendingBatches(data.pending_by_date || []);
      }
    } catch (error) {
      console.error('Error loading pending orders:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleBatchInvoice(deliveryDate: string) {
    if (!confirm(`Invoice ${pendingBatches.find(b => b.delivery_date === deliveryDate)?.count} orders for ${new Date(deliveryDate).toLocaleDateString('en-AU')}?${sendEmails ? '\n\n✅ Invoice emails will be sent to customers.' : '\n\n⚠️ Emails will NOT be sent.'}`)) {
      return;
    }

    try {
      setProcessing(deliveryDate);
      const response = await fetch('/api/admin/batch-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          delivery_date: deliveryDate,
          sendEmails 
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert(`✅ Success!\n\n` +
              `Invoiced: ${data.invoiced} orders\n` +
              `Total: $${data.total_amount.toFixed(2)}\n` +
              (data.emails_sent ? `Emails sent: ${data.emails_sent}` : 'No emails sent'));
        loadPendingOrders();
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (error: any) {
      console.error('Batch invoice error:', error);
      alert(`❌ Error: ${error.message}`);
    } finally {
      setProcessing(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6" style={{ color: '#8B0000' }} />
              Batch Invoice
            </h1>
            <p className="text-gray-600 mt-1">
              Invoice pending orders by delivery date
            </p>
          </div>
          
          {/* Email Toggle */}
          <div className="flex items-center gap-3 bg-gray-50 px-4 py-3 rounded-lg">
            <Mail className={`h-5 w-5 ${sendEmails ? 'text-green-600' : 'text-gray-400'}`} />
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sendEmails}
                onChange={(e) => setSendEmails(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <span className="font-medium text-sm">
Invoice with emails
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Pending Batches */}
      {pendingBatches.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-600 mb-2">
            No Pending Orders
          </h3>
          <p className="text-gray-500">
            All orders have been invoiced or there are no orders to process.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Delivery Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Orders
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Amount
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pendingBatches.map((batch) => (
                <tr key={batch.delivery_date} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="font-medium text-gray-900">
                        {new Date(batch.delivery_date).toLocaleDateString('en-AU', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">
                      {batch.count} {batch.count === 1 ? 'order' : 'orders'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium" style={{ color: '#8B0000' }}>
                      ${batch.total_amount.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button
                      onClick={() => handleBatchInvoice(batch.delivery_date)}
                      disabled={processing === batch.delivery_date}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-white font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                      style={{ backgroundColor: '#8B0000' }}
                    >
                      {processing === batch.delivery_date ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <FileText className="h-4 w-4" />
                          Invoice {batch.count} Order{batch.count !== 1 ? 's' : ''}
                          {sendEmails && <Mail className="h-4 w-4 ml-1" />}
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Email Notice */}
      {sendEmails && pendingBatches.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-green-900">
                Email notifications enabled
              </p>
              <p className="text-sm text-green-700 mt-1">
                Invoice PDFs will be emailed to customers after batch processing. 
                Customers will receive payment instructions and due dates.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}