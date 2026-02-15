'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Invoice {
  id: string
  invoice_id: string | null
  invoice_number: string | null
  amount: number
  remaining_balance: number
  due_date: string | null
  description: string | null
  created_at: string
  days_overdue: number
}

interface PaymentFormProps {
  customerId: string
  customerName: string
  currentBalance: number
}

export function PaymentForm({ customerId, customerName, currentBalance }: PaymentFormProps) {
  const router = useRouter()
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [paymentMode, setPaymentMode] = useState<'auto' | 'manual'>('auto')
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set())
  const [loadingInvoices, setLoadingInvoices] = useState(true)

  useEffect(() => {
    loadUnpaidInvoices()
  }, [customerId])

  async function loadUnpaidInvoices() {
    setLoadingInvoices(true)
    try {
      const res = await fetch(`/api/ar/invoices/${customerId}`)
      if (!res.ok) {
        setInvoices([])
        return
      }

      const text = await res.text()
      if (!text) {
        setInvoices([])
        return
      }

      const data = JSON.parse(text)
      if (data.success && Array.isArray(data.invoices)) {
        setInvoices(data.invoices)
      } else {
        setInvoices([])
      }
    } catch (error) {
      console.error('Error loading invoices:', error)
      setInvoices([])
    } finally {
      setLoadingInvoices(false)
    }
  }

  const handleInvoiceToggle = (invoiceId: string) => {
    const newSelected = new Set(selectedInvoices)
    if (newSelected.has(invoiceId)) {
      newSelected.delete(invoiceId)
    } else {
      newSelected.add(invoiceId)
    }
    setSelectedInvoices(newSelected)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount')
      return
    }

    if (parseFloat(amount) > currentBalance) {
      const confirmed = confirm(
        `Amount ($${amount}) is greater than balance ($${currentBalance.toFixed(2)}). This will create a credit. Continue?`
      )
      if (!confirmed) return
    }

    setLoading(true)

    try {
      const payload: any = {
        customerId,
        amount: parseFloat(amount),
        description: description || `Payment from ${customerName}`,
        applyToInvoices: paymentMode === 'manual' ? Array.from(selectedInvoices) : undefined
      }

      const res = await fetch('/api/ar/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const result = await res.json()

      if (result.success) {
        alert(`✅ Payment of $${parseFloat(amount).toFixed(2)} recorded!\nNew balance: $${result.newBalance.toFixed(2)}\nInvoices paid: ${result.paidInvoices}`)
        setAmount('')
        setDescription('')
        setSelectedInvoices(new Set())
        router.refresh()
        loadUnpaidInvoices()
      } else {
        alert('❌ Error: ' + result.error)
      }
    } catch (error) {
      alert('❌ Error recording payment: ' + error)
    } finally {
      setLoading(false)
    }
  }

  const selectedTotal = invoices
    .filter(inv => selectedInvoices.has(inv.id))
    .reduce((sum, inv) => sum + inv.remaining_balance, 0)

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Record Payment</h3>

      {/* Current Balance */}
      <div className="mb-4 p-3 bg-gray-50 rounded">
        <p className="text-sm text-gray-600">Current Balance:</p>
        <p className={`text-2xl font-bold ${currentBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
          ${currentBalance.toFixed(2)}
        </p>
      </div>

      {/* Unpaid Invoices Summary */}
      {!loadingInvoices && invoices.length > 0 && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-sm font-medium text-yellow-800">
            {invoices.length} unpaid invoice{invoices.length !== 1 ? 's' : ''} totalling ${invoices.reduce((s, i) => s + i.remaining_balance, 0).toFixed(2)}
          </p>
        </div>
      )}

      {/* Payment Mode Toggle */}
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => {
            setPaymentMode('auto')
            setSelectedInvoices(new Set())
            setAmount('')
          }}
          className={`flex-1 px-3 py-2 rounded text-sm font-medium transition ${
            paymentMode === 'auto'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Auto Apply (FIFO)
        </button>
        <button
          type="button"
          onClick={() => {
            setPaymentMode('manual')
            setAmount('')
          }}
          className={`flex-1 px-3 py-2 rounded text-sm font-medium transition ${
            paymentMode === 'manual'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Select Invoices
        </button>
      </div>

      {/* Invoice Selection (Manual Mode) */}
      {paymentMode === 'manual' && (
        <div className="mb-4 border rounded-lg max-h-72 overflow-y-auto">
          <div className="p-3 bg-gray-50 border-b sticky top-0">
            <p className="text-sm font-medium text-gray-700">Select Invoices to Pay:</p>
          </div>

          {loadingInvoices ? (
            <p className="p-4 text-sm text-gray-500">Loading invoices...</p>
          ) : invoices.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">No unpaid invoices</p>
          ) : (
            <div className="divide-y">
              {invoices.map((invoice) => {
                const isOverdue = invoice.days_overdue > 0

                return (
                  <label
                    key={invoice.id}
                    className={`flex items-start gap-3 p-3 cursor-pointer transition ${
                      selectedInvoices.has(invoice.id)
                        ? 'bg-blue-50'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedInvoices.has(invoice.id)}
                      onChange={() => handleInvoiceToggle(invoice.id)}
                      className="w-4 h-4 mt-1 rounded"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        {invoice.invoice_number ? (
                          <span className="font-mono text-sm font-semibold text-blue-600">
                            {invoice.invoice_number}
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-gray-400">
                            #{invoice.id.substring(0, 8)}
                          </span>
                        )}
                        {isOverdue && (
                          <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded">
                            {invoice.days_overdue}d overdue
                          </span>
                        )}
                      </div>

                      <div className="text-sm text-gray-700">
                        {invoice.description || 'Invoice'}
                      </div>

                      <div className="text-xs text-gray-500 mt-0.5">
                        {invoice.due_date && (
                          <span>Due: {new Date(invoice.due_date).toLocaleDateString('en-AU')}</span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-bold text-sm text-gray-900">
                        ${invoice.remaining_balance.toFixed(2)}
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>
          )}

          {selectedInvoices.size > 0 && (
            <div className="p-3 bg-blue-50 border-t sticky bottom-0">
              <div className="flex justify-between text-sm font-semibold">
                <span>{selectedInvoices.size} invoice{selectedInvoices.size !== 1 ? 's' : ''} selected</span>
                <span className="text-blue-600">${selectedTotal.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Payment Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Payment Amount
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-gray-500">$</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={loading}
            />
          </div>
          {paymentMode === 'manual' && selectedInvoices.size > 0 && (
            <button
              type="button"
              onClick={() => setAmount(selectedTotal.toFixed(2))}
              className="text-xs text-blue-600 hover:underline mt-1"
            >
              Fill with selected total: ${selectedTotal.toFixed(2)}
            </button>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description / Reference
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Cheque #1234, bank transfer, cash, etc."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          disabled={loading || !amount || parseFloat(amount) <= 0 || (paymentMode === 'manual' && selectedInvoices.size === 0)}
          className="w-full px-4 py-2.5 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {loading ? 'Recording...' : `Record Payment — $${amount || '0.00'}`}
        </button>
      </form>

      {/* Tip */}
      <div className="mt-4 p-3 bg-gray-50 rounded text-xs text-gray-600">
        💡 {paymentMode === 'auto'
          ? 'Payment will be applied to oldest invoices first (FIFO)'
          : 'Select invoices and enter any amount (partial payments allowed)'}
      </div>
    </div>
  )
}