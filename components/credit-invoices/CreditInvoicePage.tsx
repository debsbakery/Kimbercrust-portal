'use client'

import { useState } from 'react'
import { Loader2, Plus, Trash2, Download, Mail, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'

interface Customer {
  id: string
  business_name?: string
  contact_name?: string
  email?: string
  address?: string
  abn?: string
  balance: number
}

interface Product {
  id: string
  name: string
  code?: string
  product_code?: number
  unit_price?: number
  price?: number
  gst_applicable: boolean
  is_available: boolean
}

interface LineItem {
  product_id: string
  product_name: string
  product_code: string
  quantity: number
  unit_price: number
  credit_percent: number
  gst_applicable: boolean
  credit_type: 'product_credit' | 'stale_return'
}

interface CreditInvoice {
  id: string
  credit_number: string
  credit_date: string
  credit_type: string
  amount: number
  total_amount: number
  status: string
  notes?: string
  customer: Customer
}

interface Props {
  customers: Customer[]
  products: Product[]
}

const CREDIT_PERCENTS = [100, 75, 50, 25]

export default function CreditInvoicePage({ customers, products }: Props) {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerSearch, setCustomerSearch]     = useState('')
  const [creditType, setCreditType]             = useState<'product_credit' | 'stale_return'>('product_credit')
  const [notes, setNotes]                       = useState('')
  const [items, setItems]                       = useState<LineItem[]>([])
  const [saving, setSaving]                     = useState(false)
  const [recentInvoices, setRecentInvoices]     = useState<CreditInvoice[]>([])
  const [loadingList, setLoadingList]           = useState(false)
  const [actionLoading, setActionLoading]       = useState<string | null>(null)

  const filteredCustomers = customers.filter(c => {
    const name = (c.business_name || c.contact_name || '').toLowerCase()
    return name.includes(customerSearch.toLowerCase())
  })

  const selectCustomer = async (customer: Customer) => {
    setSelectedCustomer(customer)
    setCustomerSearch(customer.business_name || customer.contact_name || '')
    setLoadingList(true)
    try {
      const res = await fetch(`/api/credit-memos?customer_id=${customer.id}`)
      const data = await res.json()
      setRecentInvoices(data.data || [])
    } finally {
      setLoadingList(false)
    }
  }

  const addLine = () => {
    setItems(prev => [...prev, {
      product_id: '', product_name: '', product_code: '',
      quantity: 1, unit_price: 0, credit_percent: 100,
      gst_applicable: true, credit_type: creditType,
    }])
  }

  const updateLine = (index: number, field: keyof LineItem, value: any) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item
      if (field === 'product_id') {
        const p = products.find(p => p.id === value)
        if (!p) return item
        return {
          ...item,
          product_id:     p.id,
          product_name:   p.name,
          product_code:   p.code || p.product_code?.toString() || '',
          unit_price:     p.unit_price || p.price || 0,
          gst_applicable: p.gst_applicable,
        }
      }
      return { ...item, [field]: value }
    }))
  }

  const removeLine = (index: number) => setItems(prev => prev.filter((_, i) => i !== index))

  const calcLine = (item: LineItem) => {
    const base = item.quantity * item.unit_price * (item.credit_percent / 100)
    const gst  = item.gst_applicable ? base * 0.1 : 0
    return { base, gst, total: base + gst }
  }

  const totals = items.reduce(
    (acc, item) => {
      const { base, gst, total } = calcLine(item)
      return { subtotal: acc.subtotal + base, gst: acc.gst + gst, total: acc.total + total }
    },
    { subtotal: 0, gst: 0, total: 0 }
  )

  const handleIssue = async () => {
    if (!selectedCustomer) return alert('Select a customer')
    if (!items.length)      return alert('Add at least one item')

    setSaving(true)
    try {
      const res = await fetch('/api/credit-memos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: selectedCustomer.id,
          credit_type: creditType,
          notes,
          items: items.map(item => ({ ...item, credit_type: creditType })),
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }

      const { data: newMemo } = await res.json()
      alert(`Credit Invoice ${newMemo.credit_number} issued successfully`)

      // Reset form
      setItems([])
      setNotes('')

      // Refresh list and customer balance
      await selectCustomer(selectedCustomer)

    } catch (err: any) {
      alert(`Failed: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDownloadPDF = async (memoId: string, creditNumber: string) => {
    setActionLoading(`pdf-${memoId}`)
    try {
      const res = await fetch(`/api/credit-memos/${memoId}/pdf`)
      if (!res.ok) throw new Error('Failed to generate PDF')
      const blob = await res.blob()
      const url  = window.URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `credit-invoice-${creditNumber}.pdf`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      alert(`Failed: ${err.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleEmailPDF = async (memoId: string, email: string, creditNumber: string) => {
    if (!email) return alert('Customer has no email address')
    if (!confirm(`Email credit invoice ${creditNumber} to ${email}?`)) return

    setActionLoading(`email-${memoId}`)
    try {
      const res = await fetch(`/api/credit-memos/${memoId}/email`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to send email')
      alert(`Credit invoice emailed to ${email}`)
    } catch (err: any) {
      alert(`Failed: ${err.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <FileText className="h-7 w-7" style={{ color: '#1a1a1a' }} />
        <h1 className="text-2xl font-bold" style={{ color: '#1a1a1a' }}>
          Credit Invoices
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── LEFT: Create form ─────────────────────────────── */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border p-5 space-y-4">
            <h2 className="font-semibold text-lg">New Credit Invoice</h2>

            {/* Customer search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer
              </label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="Search customer..."
                value={customerSearch}
                onChange={e => {
                  setCustomerSearch(e.target.value)
                  setSelectedCustomer(null)
                }}
              />
              {customerSearch && !selectedCustomer && filteredCustomers.length > 0 && (
                <div className="border rounded mt-1 max-h-48 overflow-y-auto shadow-lg bg-white z-10 relative">
                  {filteredCustomers.map(c => (
                    <button
                      key={c.id}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b last:border-0"
                      onClick={() => selectCustomer(c)}
                    >
                      <span className="font-medium">{c.business_name || c.contact_name}</span>
                      {c.email && <span className="text-gray-400 ml-2 text-xs">{c.email}</span>}
                    </button>
                  ))}
                </div>
              )}
              {selectedCustomer && (
                <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm">
                  <span className="font-medium text-green-800">
                    {selectedCustomer.business_name || selectedCustomer.contact_name}
                  </span>
                  <span className="text-green-600 ml-2">
                    Balance: ${parseFloat(selectedCustomer.balance?.toString() || '0').toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            {/* Credit type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Credit Type
              </label>
              <div className="flex gap-2">
                {(['product_credit', 'stale_return'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setCreditType(type)}
                    className={`flex-1 py-2 rounded border text-sm font-medium transition-colors ${
                      creditType === type
                        ? 'bg-green-700 text-white border-green-700'
                        : 'border-gray-300 text-gray-600 hover:border-green-600'
                    }`}
                  >
                    {type === 'product_credit' ? 'Product Credit' : 'Stale Return'}
                  </button>
                ))}
              </div>
            </div>

            {/* Line items */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Items
              </label>

              {items.length > 0 && (
                <div className="space-y-2 mb-2">
                  {items.map((item, i) => {
                    const { total } = calcLine(item)
                    return (
                      <div key={i} className="border rounded p-3 bg-gray-50 space-y-2">
                        {/* Product select */}
                        <select
                          className="w-full border rounded px-2 py-1.5 text-sm bg-white"
                          value={item.product_id}
                          onChange={e => updateLine(i, 'product_id', e.target.value)}
                        >
                          <option value="">Select product...</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} {p.code ? `(${p.code})` : ''} — ${(p.unit_price || p.price || 0).toFixed(2)}
                            </option>
                          ))}
                        </select>

                        {/* Qty / Price / Credit % */}
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-xs text-gray-500">Qty</label>
                            <input
                              type="number" min="0.1" step="0.1"
                              className="w-full border rounded px-2 py-1 text-sm"
                              value={item.quantity}
                              onChange={e => updateLine(i, 'quantity', parseFloat(e.target.value) || 0)}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">Unit Price</label>
                            <input
                              type="number" min="0" step="0.01"
                              className="w-full border rounded px-2 py-1 text-sm"
                              value={item.unit_price}
                              onChange={e => updateLine(i, 'unit_price', parseFloat(e.target.value) || 0)}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">Credit %</label>
                            <select
                              className="w-full border rounded px-2 py-1 text-sm bg-white"
                              value={item.credit_percent}
                              onChange={e => updateLine(i, 'credit_percent', parseFloat(e.target.value))}
                            >
                              {CREDIT_PERCENTS.map(p => (
                                <option key={p} value={p}>{p}%</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* GST + line total + delete */}
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 text-sm text-gray-600">
                            <input
                              type="checkbox"
                              checked={item.gst_applicable}
                              onChange={e => updateLine(i, 'gst_applicable', e.target.checked)}
                            />
                            GST applicable
                          </label>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-red-600">
                              ({`$${total.toFixed(2)}`})
                            </span>
                            <button onClick={() => removeLine(i)} className="text-gray-400 hover:text-red-500">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <Button variant="outline" size="sm" onClick={addLine} className="gap-1 w-full">
                <Plus className="h-4 w-4" /> Add Item
              </Button>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                className="w-full border rounded px-3 py-2 text-sm"
                rows={2}
                placeholder="Reason for credit (optional)"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>

            {/* Totals */}
            {items.length > 0 && (
              <div className="bg-red-50 border border-red-100 rounded p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="text-red-600 font-medium">({`$${totals.subtotal.toFixed(2)}`})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">GST (10%)</span>
                  <span className="text-red-600 font-medium">({`$${totals.gst.toFixed(2)}`})</span>
                </div>
                <div className="flex justify-between border-t pt-1 font-bold">
                  <span>Total Credit</span>
                  <span className="text-red-600">({`$${totals.total.toFixed(2)}`})</span>
                </div>
              </div>
            )}

            <Button
              onClick={handleIssue}
              disabled={saving || !items.length || !selectedCustomer}
              className="w-full gap-2"
              style={{ backgroundColor: '#1a1a1a', color: 'white' }}
            >
              {saving
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Issuing...</>
                : 'Issue Credit Invoice'
              }
            </Button>
          </div>
        </div>

        {/* ── RIGHT: Recent credit invoices ────────────────── */}
        <div>
          <div className="bg-white rounded-lg border p-5">
            <h2 className="font-semibold text-lg mb-4">
              {selectedCustomer
                ? `Credit Invoices — ${selectedCustomer.business_name || selectedCustomer.contact_name}`
                : 'Select a customer to view credit invoices'
              }
            </h2>

            {loadingList ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : recentInvoices.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">
                {selectedCustomer ? 'No credit invoices found' : ''}
              </p>
            ) : (
              <div className="space-y-3">
                {recentInvoices.map((inv: any) => (
                  <div
                    key={inv.id}
                    className="border rounded p-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-medium text-sm">{inv.credit_number}</span>
                        <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                          inv.credit_type === 'stale_return'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {inv.credit_type === 'stale_return' ? 'Stale Return' : 'Product Credit'}
                        </span>
                      </div>
                      <span className="text-red-600 font-bold text-sm">
                        (${parseFloat(inv.total_amount || inv.amount || '0').toFixed(2)})
                      </span>
                    </div>

                    <div className="text-xs text-gray-500 mb-3">
                      {inv.credit_date
                        ? format(new Date(inv.credit_date), 'dd/MM/yyyy')
                        : format(new Date(inv.created_at), 'dd/MM/yyyy')
                      }
                      {inv.notes && <span className="ml-2">· {inv.notes}</span>}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-xs"
                        disabled={actionLoading === `pdf-${inv.id}`}
                        onClick={() => handleDownloadPDF(inv.id, inv.credit_number)}
                      >
                        {actionLoading === `pdf-${inv.id}`
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <Download className="h-3 w-3" />
                        }
                        PDF
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-xs"
                        disabled={actionLoading === `email-${inv.id}` || !selectedCustomer?.email}
                        onClick={() => handleEmailPDF(
                          inv.id,
                          selectedCustomer?.email || '',
                          inv.credit_number
                        )}
                      >
                        {actionLoading === `email-${inv.id}`
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <Mail className="h-3 w-3" />
                        }
                        Email
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}