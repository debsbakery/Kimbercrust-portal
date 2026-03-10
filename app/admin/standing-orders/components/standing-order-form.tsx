'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, AlertCircle, CheckCircle } from 'lucide-react'
import { SearchableSelect, SelectOption } from '@/components/ui/searchable-select'

interface Customer {
  id: string
  business_name: string
  email: string
  contact_name: string | null
}

interface Product {
  id: string
  code: string | null
  name: string
  price: number
  category: string | null
  is_available: boolean
}

interface ContractPrice {
  product_id: string
  contract_price: number
}

interface OrderItem {
  product_id: string
  quantity: number
}

interface ExistingStandingOrder {
  id: string
  customer_id: string
  delivery_days: string
  active: boolean
  notes: string | null
  items: { id: string; product_id: string; quantity: number }[]
}

interface Props {
  customers: Customer[]
  products: Product[]
  standingOrder?: ExistingStandingOrder  // present = edit mode
}

const WEEKDAYS = [
  { value: 'monday',    label: 'Mon' },
  { value: 'tuesday',   label: 'Tue' },
  { value: 'wednesday', label: 'Wed' },
  { value: 'thursday',  label: 'Thu' },
  { value: 'friday',    label: 'Fri' },
  { value: 'saturday',  label: 'Sat' },
  { value: 'sunday',    label: 'Sun' },
]

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(amount)
}

export default function StandingOrderForm({ customers, products, standingOrder }: Props) {
  const router = useRouter()
  const isEditing = !!standingOrder

  // In edit mode — single day only (can't change day when editing)
  const [customerId, setCustomerId]     = useState(standingOrder?.customer_id || '')
  const [selectedDays, setSelectedDays] = useState<string[]>(
    standingOrder?.delivery_days ? [standingOrder.delivery_days] : []
  )
  const [notes, setNotes]               = useState(standingOrder?.notes || '')
  const [active, setActive]             = useState(standingOrder?.active ?? true)
  const [items, setItems]               = useState<OrderItem[]>(
    standingOrder?.items?.map(i => ({
      product_id: i.product_id,
      quantity: i.quantity,
    })) || []
  )
  const [contractPrices, setContractPrices] = useState<ContractPrice[]>([])
  const [loadingContracts, setLoadingContracts] = useState(false)
  const [submitting, setSubmitting]     = useState(false)
  const [submitResults, setSubmitResults] = useState<
    { day: string; success: boolean; message: string }[]
  >([])
  const [error, setError]   = useState('')
  const [done, setDone]     = useState(false)

  // Load contract prices on mount if editing
  useEffect(() => {
    if (customerId) loadContractPrices(customerId)
  }, [])

  async function loadContractPrices(id: string) {
    setLoadingContracts(true)
    try {
      const res = await fetch(`/api/admin/contract-pricing?customerId=${id}`)
      const data = await res.json()
      if (data.success && data.contracts) {
        setContractPrices(
          data.contracts.map((c: any) => ({
            product_id: c.product_id,
            contract_price: c.contract_price,
          }))
        )
      }
    } catch (err) {
      console.error('Failed to load contract prices:', err)
    } finally {
      setLoadingContracts(false)
    }
  }

  async function handleCustomerChange(id: string) {
    setCustomerId(id)
    setItems([])
    setContractPrices([])
    if (id) loadContractPrices(id)
  }

  function getContractPrice(productId: string): number | null {
    const c = contractPrices.find(cp => cp.product_id === productId)
    return c ? c.contract_price : null
  }

  function getEffectivePrice(productId: string, standardPrice: number): number {
    return getContractPrice(productId) ?? standardPrice
  }

  function calculateTotal(): number {
    return items.reduce((sum, item) => {
      const product = products.find(p => p.id === item.product_id)
      if (!product) return sum
      return sum + getEffectivePrice(item.product_id, product.price) * item.quantity
    }, 0)
  }

  // Day toggle — disabled in edit mode
  function toggleDay(day: string) {
    if (isEditing) return
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    )
  }

  function addItem(productId: string) {
    if (!productId || items.find(i => i.product_id === productId)) return
    setItems(prev => [...prev, { product_id: productId, quantity: 1 }])
  }

  function updateQuantity(productId: string, qty: number) {
    if (qty < 1) return
    setItems(prev =>
      prev.map(i => i.product_id === productId ? { ...i, quantity: qty } : i)
    )
  }

  function removeItem(productId: string) {
    setItems(prev => prev.filter(i => i.product_id !== productId))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitResults([])

    if (!customerId) { setError('Please select a customer'); return }
    if (selectedDays.length === 0) { setError('Please select at least one delivery day'); return }
    if (items.length === 0) { setError('Please add at least one product'); return }

    setSubmitting(true)

    // EDIT MODE — PUT to update existing
    if (isEditing && standingOrder) {
      try {
        const res = await fetch(`/api/standing-orders/${standingOrder.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_id: customerId,
            delivery_days: selectedDays[0],
            active,
            notes: notes || null,
            items: items.map(i => ({
              product_id: i.product_id,
              quantity: i.quantity,
            })),
          }),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to update')

        setDone(true)
        setTimeout(() => router.push('/admin/standing-orders'), 1500)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setSubmitting(false)
      }
      return
    }

    // CREATE MODE — POST once per selected day
    const results: { day: string; success: boolean; message: string }[] = []

    for (const day of selectedDays) {
      try {
        const res = await fetch('/api/standing-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_id: customerId,
            delivery_days: day,
            active: true,
            notes: notes || null,
            items: items.map(i => ({
              product_id: i.product_id,
              quantity: i.quantity,
            })),
          }),
        })

        const data = await res.json()

        if (res.status === 409) {
          results.push({ day, success: false, message: 'Already exists — skipped' })
        } else if (!res.ok) {
          results.push({ day, success: false, message: data.error || 'Failed' })
        } else {
          results.push({ day, success: true, message: 'Created' })
        }
      } catch (err: any) {
        results.push({ day, success: false, message: err.message })
      }
    }

    setSubmitResults(results)
    setSubmitting(false)

    if (results.some(r => r.success)) {
      setDone(true)
      setTimeout(() => router.push('/admin/standing-orders'), 2000)
    }
  }

  // Build options
  const customerOptions: SelectOption[] = customers.map(c => ({
    value: c.id,
    label: c.business_name || c.email,
    sublabel: c.contact_name || c.email,
  }))

  const availableProductOptions: SelectOption[] = products
    .filter(p => !items.find(i => i.product_id === p.id))
    .map(p => ({
      value: p.id,
      label: p.name,
      badge: p.code || '—',
      sublabel: formatCurrency(getEffectivePrice(p.id, p.price)),
    }))

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Results */}
      {submitResults.length > 0 && (
        <div className="bg-white rounded-lg border shadow-sm p-4 space-y-2">
          <p className="font-semibold text-sm text-gray-700 mb-3">Results</p>
          {submitResults.map(r => (
            <div
              key={r.day}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm ${
                r.success ? 'bg-green-50 text-green-800' : 'bg-yellow-50 text-yellow-800'
              }`}
            >
              {r.success
                ? <CheckCircle className="h-4 w-4 flex-shrink-0" />
                : <AlertCircle className="h-4 w-4 flex-shrink-0" />}
              <span className="capitalize font-medium w-24">{r.day}</span>
              <span>{r.message}</span>
            </div>
          ))}
          {done && <p className="text-xs text-gray-400 mt-2">Redirecting...</p>}
        </div>
      )}

      {done && isEditing && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
          <CheckCircle className="h-5 w-5" />
          <p className="font-medium">Standing order updated! Redirecting...</p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Customer */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold mb-4">Customer</h2>
        <SearchableSelect
          label="Select Customer"
          options={customerOptions}
          value={customerId}
          onChange={handleCustomerChange}
          placeholder="Search by business name..."
          disabled={isEditing}
          required
        />
        {loadingContracts && (
          <p className="text-xs text-blue-600 mt-2">Loading contract prices...</p>
        )}
        {customerId && !loadingContracts && contractPrices.length > 0 && (
          <p className="text-xs text-green-600 mt-2">
            {contractPrices.length} contract price{contractPrices.length !== 1 ? 's' : ''} loaded
          </p>
        )}
        {customerId && !loadingContracts && contractPrices.length === 0 && (
          <p className="text-xs text-gray-400 mt-2">No contract prices — standard prices apply</p>
        )}
      </div>

      {/* Delivery Day */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Delivery Day</h2>
          {!isEditing && (
            <div className="flex gap-2 text-xs">
              <button type="button"
                onClick={() => setSelectedDays(['monday','tuesday','wednesday','thursday','friday'])}
                className="px-2 py-1 border rounded hover:bg-gray-50 text-gray-600">
                Mon-Fri
              </button>
              <button type="button"
                onClick={() => setSelectedDays(WEEKDAYS.map(d => d.value))}
                className="px-2 py-1 border rounded hover:bg-gray-50 text-gray-600">
                All
              </button>
              <button type="button"
                onClick={() => setSelectedDays([])}
                className="px-2 py-1 border rounded hover:bg-gray-50 text-gray-600">
                Clear
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {WEEKDAYS.map(day => {
            const selected = selectedDays.includes(day.value)
            return (
              <button
                key={day.value}
                type="button"
                onClick={() => toggleDay(day.value)}
                disabled={isEditing}
                className={`py-3 rounded-lg text-sm font-semibold border-2 transition-all ${
                  selected
                    ? 'border-green-600 bg-green-600 text-white shadow-sm'
                    : isEditing
                    ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                    : 'border-gray-200 text-gray-500 hover:border-gray-400'
                }`}
              >
                {day.label}
              </button>
            )
          })}
        </div>

        {isEditing && (
          <p className="text-xs text-gray-400 mt-3">
            Delivery day cannot be changed when editing. Delete and recreate to change the day.
          </p>
        )}

        {!isEditing && selectedDays.length > 0 && (
          <p className="text-sm text-gray-500 mt-3">
            {selectedDays.length} day{selectedDays.length !== 1 ? 's' : ''} selected —
            will create {selectedDays.length} standing order{selectedDays.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Active toggle — edit mode only */}
      {isEditing && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">Status</h2>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={active === true}
                onChange={() => setActive(true)}
                className="w-4 h-4 text-green-600"
              />
              <span className="text-sm font-medium text-green-700">Active</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={active === false}
                onChange={() => setActive(false)}
                className="w-4 h-4 text-gray-500"
              />
              <span className="text-sm font-medium text-gray-600">Paused</span>
            </label>
          </div>
        </div>
      )}

      {/* Products */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold mb-4">Products</h2>

        <div className="mb-4">
          <SearchableSelect
            label="Add Product"
            options={availableProductOptions}
            value=""
            onChange={productId => { if (productId) addItem(productId) }}
            placeholder="Search by code or name..."
            grouped={true}
          />
        </div>

        {items.length > 0 ? (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">Code</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">Product</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-600">Std</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-600">Contract</th>
                  <th className="text-center px-4 py-2 text-xs font-semibold text-gray-600">Qty</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-600">Subtotal</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const product = products.find(p => p.id === item.product_id)
                  if (!product) return null
                  const contractPrice = getContractPrice(item.product_id)
                  const effectivePrice = contractPrice ?? product.price

                  return (
                    <tr key={item.product_id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                          {product.code || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">{product.name}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-400">
                        {formatCurrency(product.price)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm">
                        {contractPrice !== null ? (
                          <span className="font-semibold text-green-700">
                            {formatCurrency(contractPrice)}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">Standard</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button type="button"
                            onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                            className="w-7 h-7 rounded border border-gray-300 flex items-center justify-center hover:bg-gray-100 font-bold text-gray-600">
                            -
                          </button>
                          <input
                            type="number" min="1"
                            value={item.quantity}
                            onChange={e => updateQuantity(item.product_id, parseInt(e.target.value) || 1)}
                            className="w-14 text-center border rounded py-1 text-sm font-semibold"
                          />
                          <button type="button"
                            onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                            className="w-7 h-7 rounded border border-gray-300 flex items-center justify-center hover:bg-gray-100 font-bold text-gray-600">
                            +
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold">
                        {formatCurrency(effectivePrice * item.quantity)}
                      </td>
                      <td className="px-2 py-3 text-center">
                        <button type="button"
                          onClick={() => removeItem(item.product_id)}
                          className="text-red-400 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                                {isEditing && standingOrder && (
          <button
            type="button"
            onClick={async () => {
              if (!confirm('Delete this standing order? This cannot be undone.')) return
              setSubmitting(true)
              try {
                const res = await fetch(`/api/standing-orders/${standingOrder.id}`, {
                  method: 'DELETE',
                })
                if (!res.ok) throw new Error('Failed to delete')
                router.push('/admin/standing-orders')
              } catch (err: any) {
                setError(err.message)
                setSubmitting(false)
              }
            }}
            disabled={submitting}
            className="px-6 py-3 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          >
            Delete
          </button>
        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-gray-50 border-t">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-right text-gray-600">
                    Value per delivery
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-lg" style={{ color: '#2c2c2c' }}>
                    {formatCurrency(calculateTotal())}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 text-sm">
            No products added yet — search above to add products
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold mb-4">Notes</h2>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500 text-sm"
          placeholder="Delivery instructions, special requests..."
        />
      </div>

      {/* Submit */}
      <div className="flex gap-4">
        <button
          type="submit"
          disabled={submitting || done}
          className="flex-1 py-3 rounded-lg text-white font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#2c2c2c' }}
        >
          {submitting
            ? 'Saving...'
            : isEditing
            ? 'Update Standing Order'
            : selectedDays.length > 1
            ? `Create ${selectedDays.length} Standing Orders`
            : 'Create Standing Order'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          disabled={submitting}
          className="px-6 py-3 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}