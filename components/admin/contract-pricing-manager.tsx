'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Customer {
  id: string
  business_name: string | null
  contact_name: string | null
  email: string
}

interface Product {
  id: string
  product_number: number | null
  name: string
  price: number
}

interface ContractPricingManagerProps {
  customers: Customer[]
  products: Product[]
}

export function ContractPricingManager({ customers, products }: ContractPricingManagerProps) {
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [contractPrice, setContractPrice] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [effectiveTo, setEffectiveTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [contracts, setContracts] = useState<any[]>([])

  const selectedProduct = products.find(p => p.id === selectedProductId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch('/api/admin/contract-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          productId: selectedProductId,
          contractPrice: parseFloat(contractPrice),
          effectiveFrom,
          effectiveTo: effectiveTo || null
        })
      })

      const result = await res.json()

      if (result.success) {
        alert(result.updated ? '✅ Contract price updated!' : '✅ Contract price created!')
        setContractPrice('')
        setEffectiveFrom('')
        setEffectiveTo('')
        loadContracts()
      } else {
        alert('❌ Error: ' + result.error)
      }
    } catch (error) {
      alert('❌ Error saving contract price')
    } finally {
      setLoading(false)
    }
  }

  const loadContracts = async () => {
    if (!selectedCustomerId) return

    const res = await fetch(`/api/admin/contract-pricing?customerId=${selectedCustomerId}`)
    const data = await res.json()
    setContracts(data.contracts || [])
  }

  const handleDelete = async (contractId: string) => {
    if (!confirm('Delete this contract price?')) return

    try {
      const res = await fetch(`/api/admin/contract-pricing?id=${contractId}`, {
        method: 'DELETE'
      })
      const result = await res.json()
      
      if (result.success) {
        alert('✅ Contract deleted')
        loadContracts()
      } else {
        alert('❌ Error: ' + result.error)
      }
    } catch (error) {
      alert('❌ Error deleting contract')
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Add Contract Price</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Customer</Label>
              <select
                value={selectedCustomerId}
                onChange={(e) => {
                  setSelectedCustomerId(e.target.value)
                  loadContracts()
                }}
                className="w-full p-2 border rounded"
                required
              >
                <option value="">Select customer...</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.business_name || c.contact_name || c.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label>Product</Label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full p-2 border rounded"
                required
              >
                <option value="">Select product...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    #{p.product_number} - {p.name} (Standard: ${parseFloat(p.price as any).toFixed(2)})
                  </option>
                ))}
              </select>
            </div>

            {selectedProduct && (
              <div className="p-3 bg-gray-50 rounded">
                <p className="text-sm text-gray-600">
                  Standard Price: <strong>${parseFloat(selectedProduct.price as any).toFixed(2)}</strong>
                </p>
              </div>
            )}

            <div>
              <Label>Contract Price</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={contractPrice}
                onChange={(e) => setContractPrice(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Effective From</Label>
                <Input
                  type="date"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>Effective To (Optional)</Label>
                <Input
                  type="date"
                  value={effectiveTo}
                  onChange={(e) => setEffectiveTo(e.target.value)}
                />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Saving...' : 'Save Contract Price'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {selectedCustomerId && (
        <Card>
          <CardHeader>
            <CardTitle>Active Contracts</CardTitle>
          </CardHeader>
          <CardContent>
            {contracts.length === 0 ? (
              <p className="text-sm text-gray-500">No contract prices set</p>
            ) : (
              <div className="space-y-2">
                {contracts.map((contract: any) => (
                  <div key={contract.id} className="p-3 border rounded flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-semibold">
                        #{contract.product_number} {contract.product_name}
                      </div>
                      <div className="text-sm text-gray-600">
                        ${parseFloat(contract.contract_price).toFixed(2)} 
                        <span className="text-green-600 ml-2">
                          (save ${(parseFloat(contract.standard_price) - parseFloat(contract.contract_price)).toFixed(2)})
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {contract.effective_from} → {contract.effective_to || '∞'}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(contract.id)}
                      className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}