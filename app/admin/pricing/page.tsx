'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, DollarSign } from 'lucide-react'

interface Customer {
  id: string
  business_name: string
  email: string
}

interface Product {
  id: string
  code: string | null
  name: string
  price: number
  category: string | null
}

interface ContractPrice {
  id: string
  customer_id: string
  product_id: string
  contract_price: number
  effective_from: string
  effective_to: string | null
  product_number: string
  product_name: string
  standard_price: number
}

export default function ContractPricingPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [contracts, setContracts] = useState<ContractPrice[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formError, setFormError] = useState('')

  const [formData, setFormData] = useState({
    productId: '',
    contractPrice: '',
    effectiveFrom: new Date().toISOString().split('T')[0],
    effectiveTo: ''
  })

  useEffect(() => {
    loadCustomers()
    loadProducts()
  }, [])

  useEffect(() => {
    if (selectedCustomer) {
      loadContracts(selectedCustomer)
    }
  }, [selectedCustomer])

  async function loadCustomers() {
    try {
      const res = await fetch('/api/customers')
      const data = await res.json()
      if (data.customers) setCustomers(data.customers)
    } catch (err) {
      console.error('Failed to load customers:', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadProducts() {
    try {
      const res = await fetch('/api/products')
      const data = await res.json()
      if (data.products) {
        // Sort by code numerically, nulls last
        const sorted = [...(data.products as Product[])].sort((a, b) => {
          if (!a.code && !b.code) return a.name.localeCompare(b.name)
          if (!a.code) return 1
          if (!b.code) return -1
          return parseInt(a.code) - parseInt(b.code)
        })
        setProducts(sorted)
      }
    } catch (err) {
      console.error('Failed to load products:', err)
    }
  }

  async function loadContracts(customerId: string) {
    try {
      const res = await fetch(`/api/admin/contract-pricing?customerId=${customerId}`)
      const result = await res.json()
      if (result.success) setContracts(result.contracts)
    } catch (err) {
      console.error('Failed to load contracts:', err)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')

    const res = await fetch('/api/admin/contract-pricing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: selectedCustomer,
        productId: formData.productId,
        contractPrice: parseFloat(formData.contractPrice),
        effectiveFrom: formData.effectiveFrom,
        effectiveTo: formData.effectiveTo || null
      })
    })

    const result = await res.json()

    if (result.success) {
      loadContracts(selectedCustomer)
      setShowForm(false)
      setFormData({
        productId: '',
        contractPrice: '',
        effectiveFrom: new Date().toISOString().split('T')[0],
        effectiveTo: ''
      })
    } else {
      setFormError(result.error || 'Error saving contract')
    }
  }

  async function handleDelete(contractId: string) {
    if (!confirm('Delete this contract price?')) return

    const res = await fetch(`/api/admin/contract-pricing?id=${contractId}`, {
      method: 'DELETE'
    })
    const result = await res.json()
    if (result.success) loadContracts(selectedCustomer)
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount)

  // Group products by category for the dropdown
  const groupedProducts = products.reduce<Record<string, Product[]>>((acc, p) => {
    const cat = p.category || 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(p)
    return acc
  }, {})

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2" style={{ color: '#006A4E' }}>
          <DollarSign className="h-8 w-8" />
          Contract Pricing
        </h1>
        <p className="text-gray-600 mt-2">Manage customer-specific pricing</p>
      </div>

      {/* Customer Selector */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <label className="block text-sm font-medium mb-2">Select Customer</label>
        <select
          value={selectedCustomer}
          onChange={(e) => {
            setSelectedCustomer(e.target.value)
            setContracts([])
            setShowForm(false)
          }}
          className="w-full px-4 py-2 border rounded-md"
        >
          <option value="">-- Choose a customer --</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.business_name || c.email}
            </option>
          ))}
        </select>
      </div>

      {/* Contracts Section */}
      {selectedCustomer && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Active Contract Prices</h2>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 px-4 py-2 rounded text-white hover:opacity-90"
              style={{ backgroundColor: '#006A4E' }}
            >
              <Plus className="h-4 w-4" />
              Add Contract Price
            </button>
          </div>

          {/* Add Form */}
          {showForm && (
            <form onSubmit={handleSubmit} className="mb-6 p-4 border rounded-lg bg-gray-50">
              {formError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                  {formError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Product</label>
                  <select
                    value={formData.productId}
                    onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                    required
                    className="w-full px-3 py-2 border rounded"
                  >
                    <option value="">-- Select Product --</option>
                    {Object.entries(groupedProducts).sort().map(([category, prods]) => (
                      <optgroup key={category} label={category}>
                        {prods.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.code ? `${p.code} - ` : ''}{p.name} ({formatCurrency(p.price)})
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Contract Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.contractPrice}
                      onChange={(e) => setFormData({ ...formData, contractPrice: e.target.value })}
                      required
                      className="w-full pl-7 pr-3 py-2 border rounded"
                      placeholder="5.50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Effective From</label>
                  <input
                    type="date"
                    value={formData.effectiveFrom}
                    onChange={(e) => setFormData({ ...formData, effectiveFrom: e.target.value })}
                    required
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Effective To (optional)</label>
                  <input
                    type="date"
                    value={formData.effectiveTo}
                    onChange={(e) => setFormData({ ...formData, effectiveTo: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  type="submit"
                  className="px-4 py-2 rounded text-white hover:opacity-90"
                  style={{ backgroundColor: '#006A4E' }}
                >
                  Save Contract Price
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setFormError('') }}
                  className="px-4 py-2 rounded border hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Contracts Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-2 px-3 text-sm font-semibold text-gray-600">Product</th>
                  <th className="text-right py-2 px-3 text-sm font-semibold text-gray-600">Standard</th>
                  <th className="text-right py-2 px-3 text-sm font-semibold text-gray-600">Contract</th>
                  <th className="text-right py-2 px-3 text-sm font-semibold text-gray-600">Saving</th>
                  <th className="text-left py-2 px-3 text-sm font-semibold text-gray-600">From</th>
                  <th className="text-left py-2 px-3 text-sm font-semibold text-gray-600">To</th>
                  <th className="text-center py-2 px-3 text-sm font-semibold text-gray-600">Del</th>
                </tr>
              </thead>
              <tbody>
                {contracts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-400">
                      No contract prices set for this customer
                    </td>
                  </tr>
                ) : (
                  contracts.map((contract) => {
                    const savings = contract.standard_price - contract.contract_price
                    const savingsPct = ((savings / contract.standard_price) * 100).toFixed(1)

                    return (
                      <tr key={contract.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3">
                          <div className="font-medium text-sm">{contract.product_name}</div>
                          <div className="text-xs text-gray-400">{contract.product_number}</div>
                        </td>
                        <td className="text-right py-2 px-3 text-sm">
                          {formatCurrency(contract.standard_price)}
                        </td>
                        <td className="text-right py-2 px-3 font-bold text-sm" style={{ color: '#006A4E' }}>
                          {formatCurrency(contract.contract_price)}
                        </td>
                        <td className="text-right py-2 px-3 text-sm text-green-600">
                          -{formatCurrency(savings)} ({savingsPct}%)
                        </td>
                        <td className="py-2 px-3 text-sm">
                          {new Date(contract.effective_from).toLocaleDateString('en-AU')}
                        </td>
                        <td className="py-2 px-3 text-sm text-gray-500">
                          {contract.effective_to
                            ? new Date(contract.effective_to).toLocaleDateString('en-AU')
                            : 'Ongoing'}
                        </td>
                        <td className="text-center py-2 px-3">
                          <button
                            onClick={() => handleDelete(contract.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}