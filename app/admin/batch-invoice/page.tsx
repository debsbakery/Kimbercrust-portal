'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Calendar, DollarSign, FileText, CheckCircle, AlertCircle } from 'lucide-react'

interface PendingBatch {
  delivery_date: string
  count: number
  total_amount: number
}

export default function BatchInvoicePage() {
  const [pendingBatches, setPendingBatches] = useState<PendingBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const supabase = createClient()

  useEffect(() => {
    loadPendingBatches()
  }, [])

  async function loadPendingBatches() {
    const today = new Date().toISOString().split('T')[0]
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)
    const endDate = futureDate.toISOString().split('T')[0]

    const response = await fetch(`/api/admin/batch-invoice?start_date=${today}&end_date=${endDate}`)
    const result = await response.json()

    if (result.success) {
      setPendingBatches(result.pending_by_date || [])
    }
    setLoading(false)
  }

  async function handleBatchInvoice(deliveryDate: string) {
    if (!confirm(`Invoice all pending orders for ${formatDate(deliveryDate)}?`)) return

    setProcessing(deliveryDate)
    setMessage(null)

    const response = await fetch('/api/admin/batch-invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delivery_date: deliveryDate })
    })

    const result = await response.json()

    if (result.success) {
      setMessage({
        type: 'success',
        text: `✅ Invoiced ${result.invoiced} orders totaling ${formatCurrency(result.total_amount)}`
      })
      loadPendingBatches() // Refresh list
    } else {
      setMessage({
        type: 'error',
        text: `❌ Error: ${result.error}`
      })
    }

    setProcessing(null)
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-AU', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount)
  }

  if (loading) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2" style={{ color: '#006A4E' }}>
          <FileText className="h-8 w-8" />
          Batch Invoice
        </h1>
        <p className="text-gray-600 mt-2">Invoice pending orders by delivery date</p>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Pending Batches */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold">Pending Orders by Delivery Date</h2>
          <p className="text-sm text-gray-600 mt-1">
            Orders shown below are in "pending" status and ready to be invoiced
          </p>
        </div>

        <div className="p-6">
          {pendingBatches.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
              <p className="text-lg font-medium">No pending orders to invoice</p>
              <p className="text-sm mt-2">All orders are either invoiced or have future delivery dates</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingBatches.map((batch) => {
                const isProcessing = processing === batch.delivery_date
                const isPastDue = new Date(batch.delivery_date) < new Date()

                return (
                  <div 
                    key={batch.delivery_date}
                    className={`border rounded-lg p-4 flex justify-between items-center ${
                      isPastDue ? 'border-red-300 bg-red-50' : 'border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <Calendar className="h-8 w-8 text-gray-600" />
                      <div>
                        <div className="font-bold text-lg">
                          {formatDate(batch.delivery_date)}
                        </div>
                        <div className="text-sm text-gray-600">
                          {batch.count} order{batch.count !== 1 ? 's' : ''} • {formatCurrency(batch.total_amount)}
                        </div>
                        {isPastDue && (
                          <div className="text-sm text-red-600 font-medium flex items-center gap-1 mt-1">
                            <AlertCircle className="h-4 w-4" />
                            Past delivery date - invoice now!
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleBatchInvoice(batch.delivery_date)}
                      disabled={isProcessing}
                      className="flex items-center gap-2 px-6 py-3 rounded text-white font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: isPastDue ? '#CE1126' : '#006A4E' }}
                    >
                      <DollarSign className="h-5 w-5" />
                      {isProcessing ? 'Processing...' : 'Invoice Now'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg text-sm text-blue-800">
        <p className="font-semibold mb-2">📋 How Batch Invoicing Works:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Orders with "pending" status are shown grouped by delivery date</li>
          <li>Clicking "Invoice Now" creates AR transactions for all orders on that date</li>
          <li>Order status changes from "pending" to "invoiced"</li>
          <li>Due dates are calculated based on each customer's payment terms</li>
          <li>Invoices appear in customer AR ledgers immediately</li>
        </ul>
      </div>
    </div>
  )
}