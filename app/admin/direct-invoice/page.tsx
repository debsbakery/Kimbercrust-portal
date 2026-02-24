'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, FileText, DollarSign, ArrowLeft } from 'lucide-react'

interface Customer {
  id: string
  business_name: string
  email: string
  address: string
  abn: string
  payment_terms: number
}

interface Product {
  id: string
  product_number: string
  name: string
  price: number
  unit_price: number
}

interface LineItem {
  id: string
  productId: string
  productName: string
  quantity: number
  unitPrice: number
}

export default function DirectInvoicePage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    customerId: '',
    deliveryDate: new Date().toISOString().split('T')[0],
    purchaseOrderNumber: '',  // ✅ ADD
    docketNumber: '',          // ✅ ADD
    notes: ''
  })

  const supabase = createClient()

  useEffect(() => {
    loadCustomers()
    loadProducts()
  }, [])

  async function loadCustomers() {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .order('business_name')

    if (data) setCustomers(data)
  }

  async function loadProducts() {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('is_available', true)
      .order('product_number')

    if (data) setProducts(data)
  }

  function addLineItem() {
    setLineItems([
      ...lineItems,
      {
        id: Math.random().toString(36).substr(2, 9),
        productId: '',
        productName: '',
        quantity: 1,
        unitPrice: 0
      }
    ])
  }

  function updateLineItem(id: string, field: string, value: any) {
    setLineItems(lineItems.map(item => {
      if (item.id === id) {
        if (field === 'productId') {
          const product = products.find(p => p.id === value)
          if (product) {
            return {
              ...item,
              productId: value,
              productName: product.name,
              unitPrice: product.unit_price || product.price
            }
          }
        }
        return { ...item, [field]: value }
      }
      return item
    }))
  }

  function removeLineItem(id: string) {
    setLineItems(lineItems.filter(item => item.id !== id))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      console.log('Creating invoice for customer:', formData.customerId)

      // Validate
      if (!formData.customerId) {
        throw new Error('Please select a customer')
      }

      if (lineItems.length === 0) {
        throw new Error('Please add at least one line item')
      }

      if (lineItems.some(item => !item.productId || item.quantity <= 0)) {
        throw new Error('Please complete all line items')
      }

      // ✅ Get customer details
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', formData.customerId)
        .single()

      if (customerError || !customer) {
        throw new Error('Customer not found')
      }

      console.log('✅ Customer found:', customer.business_name)

      // ✅ Calculate total
      const totalAmount = lineItems.reduce((sum, item) => {
        return sum + (item.quantity * item.unitPrice)
      }, 0)

      console.log('✅ Total amount:', totalAmount)

      // ✅ Create order WITH PO AND DOCKET
      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: formData.customerId,
          customer_email: customer.email,
          customer_business_name: customer.business_name,
          customer_address: customer.address,
          customer_abn: customer.abn,
          delivery_date: formData.deliveryDate,
          total_amount: totalAmount,
          status: 'invoiced',
          source: 'direct_invoice',
          notes: formData.notes || null,
          purchase_order_number: formData.purchaseOrderNumber || null,  // ✅ ADD
          docket_number: formData.docketNumber || null                   // ✅ ADD
        })
        .select()
        .single()

      if (orderError) {
        console.error('Order creation error:', orderError)
        throw new Error(`Order creation failed: ${orderError.message}`)
      }

      console.log('✅ Order created:', newOrder.id)

      // ✅ Create order items
      const orderItems = lineItems.map(item => ({
        order_id: newOrder.id,
        product_id: item.productId,
        product_name: item.productName,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        subtotal: item.quantity * item.unitPrice
      }))

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems)

      if (itemsError) {
        console.error('Order items error:', itemsError)
        // Rollback: delete the order
        await supabase.from('orders').delete().eq('id', newOrder.id)
        throw new Error(`Order items failed: ${itemsError.message}`)
      }

      console.log('✅ Order items created')

      // ✅ Create AR transaction
      const paymentTerms = customer.payment_terms || 30
      const dueDate = new Date(formData.deliveryDate)
      dueDate.setDate(dueDate.getDate() + paymentTerms)

      const { error: arError } = await supabase
        .from('ar_transactions')
        .insert({
          customer_id: formData.customerId,
          type: 'invoice',
          amount: totalAmount,
          amount_paid: 0,
          invoice_id: newOrder.id,
          description: `Direct invoice ${newOrder.id.substring(0, 8)} - ${customer.business_name}`,
          due_date: dueDate.toISOString().split('T')[0],
          created_at: new Date().toISOString()
        })

      if (arError) {
        console.error('AR transaction error:', arError)
        throw new Error(`AR transaction failed: ${arError.message}`)
      }

      console.log('✅ AR transaction created')
// ✅ UPDATE CUSTOMER BALANCE
const currentBalance = customer.balance || 0;
const newBalance = currentBalance + totalAmount;

const { error: balanceError } = await supabase
  .from('customers')
  .update({ balance: newBalance })
  .eq('id', formData.customerId);

if (balanceError) {
  console.error('Balance update error:', balanceError);
  throw new Error(`Failed to update customer balance: ${balanceError.message}`);
}

console.log(`✅ Customer balance updated: $${currentBalance.toFixed(2)} → $${newBalance.toFixed(2)}`);

      // ✅ Success!
      alert(`✅ Invoice Created Successfully!\n\nOrder ID: ${newOrder.id.slice(0, 8)}\nTotal: ${formatCurrency(totalAmount)}\nDue Date: ${dueDate.toLocaleDateString('en-AU')}\n${formData.purchaseOrderNumber ? `PO#: ${formData.purchaseOrderNumber}\n` : ''}${formData.docketNumber ? `Docket#: ${formData.docketNumber}` : ''}`)
      
      // Reset form
      setFormData({
        customerId: '',
        deliveryDate: new Date().toISOString().split('T')[0],
        purchaseOrderNumber: '',  // ✅ RESET
        docketNumber: '',          // ✅ RESET
        notes: ''
      })
      setLineItems([])

    } catch (err: any) {
      console.error('Invoice creation error:', err)
      setError(err.message || 'Failed to create invoice')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount)
  }

  const calculateTotal = () => {
    return lineItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
  }

  return (
    <div className="p-8">
      {/* Back Button */}
      <a
        href="/admin"
        className="flex items-center gap-1 text-sm mb-4 hover:opacity-80"
        style={{ color: "#CE1126" }}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Admin Dashboard
      </a>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2" style={{ color: '#006A4E' }}>
          <FileText className="h-8 w-8" />
          Direct Invoice
        </h1>
        <p className="text-gray-600 mt-2">Create manual invoices for customers</p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-800 border border-red-200 rounded-lg">
          ❌ {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer Details */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">Customer Details</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer Selection */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Customer *</label>
              <select
                value={formData.customerId}
                onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                required
                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-green-500"
              >
                <option value="">-- Select Customer --</option>
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>
                    {customer.business_name || customer.email}
                  </option>
                ))}
              </select>
            </div>

            {/* Delivery Date */}
            <div>
              <label className="block text-sm font-medium mb-2">Delivery Date *</label>
              <input
                type="date"
                value={formData.deliveryDate}
                onChange={(e) => setFormData({ ...formData, deliveryDate: e.target.value })}
                required
                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* ✅ Purchase Order Number */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Purchase Order Number (Optional)
              </label>
              <input
                type="text"
                value={formData.purchaseOrderNumber}
                onChange={(e) => setFormData({ ...formData, purchaseOrderNumber: e.target.value })}
                placeholder="e.g., PO-2024-1234"
                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* ✅ Docket Number */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Docket Number (Optional)
              </label>
              <input
                type="text"
                value={formData.docketNumber}
                onChange={(e) => setFormData({ ...formData, docketNumber: e.target.value })}
                placeholder="e.g., DOC-5678"
                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* Notes */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-green-500"
                placeholder="Optional notes for this invoice..."
              />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Line Items</h2>
            <button
              type="button"
              onClick={addLineItem}
              className="flex items-center gap-2 px-4 py-2 rounded text-white hover:opacity-90"
              style={{ backgroundColor: '#006A4E' }}
            >
              <Plus className="h-4 w-4" />
              Add Line
            </button>
          </div>

          {lineItems.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No line items yet. Click "Add Line" to start.</p>
          ) : (
            <div className="space-y-3">
              {lineItems.map((item, index) => (
                <div key={item.id} className="flex gap-3 items-center border-b pb-3">
                  <div className="w-8 text-gray-600 font-medium">{index + 1}</div>
                  
                  <div className="flex-1">
                    <select
                      value={item.productId}
                      onChange={(e) => updateLineItem(item.id, 'productId', e.target.value)}
                      required
                      className="w-full px-3 py-2 border rounded"
                    >
                      <option value="">-- Select Product --</option>
                      {products.map(product => (
                        <option key={product.id} value={product.id}>
                          {product.product_number} - {product.name} (${product.unit_price || product.price})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-24">
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(item.id, 'quantity', parseInt(e.target.value))}
                      required
                      className="w-full px-3 py-2 border rounded"
                      placeholder="Qty"
                    />
                  </div>

                  <div className="w-28">
                    <input
                      type="number"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) => updateLineItem(item.id, 'unitPrice', parseFloat(e.target.value))}
                      required
                      className="w-full px-3 py-2 border rounded"
                      placeholder="Price"
                    />
                  </div>

                  <div className="w-28 text-right font-medium">
                    {formatCurrency(item.quantity * item.unitPrice)}
                  </div>

                  <button
                    type="button"
                    onClick={() => removeLineItem(item.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              ))}

              {/* Total */}
              <div className="flex justify-end items-center pt-4 border-t-2">
                <div className="text-right">
                  <p className="text-sm text-gray-600">Total Amount</p>
                  <p className="text-3xl font-bold" style={{ color: '#006A4E' }}>
                    {formatCurrency(calculateTotal())}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              setFormData({
                customerId: '',
                deliveryDate: new Date().toISOString().split('T')[0],
                purchaseOrderNumber: '',
                docketNumber: '',
                notes: ''
              })
              setLineItems([])
              setError(null)
            }}
            className="px-6 py-3 border rounded-md hover:bg-gray-50"
          >
            Clear Form
          </button>

          <button
            type="submit"
            disabled={loading || lineItems.length === 0}
            className="flex items-center gap-2 px-6 py-3 rounded text-white font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#CE1126' }}
          >
            <DollarSign className="h-5 w-5" />
            {loading ? 'Creating Invoice...' : 'Create Invoice'}
          </button>
        </div>
      </form>
    </div>
  )
}