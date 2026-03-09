'use client'

import { useState } from 'react'
import { Plus, Trash2, TrendingUp, Package, DollarSign, ChevronDown, ChevronUp } from 'lucide-react'

interface Ingredient {
  id: string
  name: string
  unit: string
  unit_cost: number
  supplier: string | null
}

interface Receipt {
  id: string
  ingredient_id: string
  supplier: string | null
  quantity_kg: number
  unit_cost: number
  total_cost: number
  invoice_ref: string | null
  received_date: string
  notes: string | null
  created_at: string
  ingredients: {
    id: string
    name: string
    unit: string
  } | null
}

interface Props {
  ingredients: Ingredient[]
  initialReceipts: Receipt[]
}

const EMPTY_FORM = {
  ingredient_id: '',
  supplier:      '',
  quantity_kg:   '',
  unit_cost:     '',
  invoice_ref:   '',
  received_date: new Date().toISOString().split('T')[0],
  notes:         '',
  update_cost:   true,
}

export default function InventoryReceivedView({ ingredients, initialReceipts }: Props) {
  const [receipts, setReceipts]   = useState<Receipt[]>(initialReceipts)
  const [form, setForm]           = useState({ ...EMPTY_FORM })
  const [saving, setSaving]       = useState(false)
  const [deleting, setDeleting]   = useState<string | null>(null)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState('')
  const [showForm, setShowForm]   = useState(true)
  const [filterIng, setFilterIng] = useState('')

  const selectedIngredient = ingredients.find((i) => i.id === form.ingredient_id)

  const prevCost = selectedIngredient ? Number(selectedIngredient.unit_cost) : null
  const newCost  = form.unit_cost ? Number(form.unit_cost) : null
  const costChanged = prevCost !== null && newCost !== null && prevCost !== newCost
  const costDiff = costChanged
    ? (((newCost - prevCost) / prevCost) * 100).toFixed(1)
    : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)

    try {
      const res = await fetch('/api/admin/ingredient-receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredient_id: form.ingredient_id,
          supplier:      form.supplier      || null,
          quantity_kg:   Number(form.quantity_kg),
          unit_cost:     Number(form.unit_cost),
          invoice_ref:   form.invoice_ref   || null,
          received_date: form.received_date,
          notes:         form.notes         || null,
          update_cost:   form.update_cost,
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error)

      setSuccess(
        'Receipt saved' +
        (form.update_cost ? ' — ingredient cost updated' : '') +
        '.'
      )
      setForm({ ...EMPTY_FORM })

      const refreshRes = await fetch('/api/admin/ingredient-receipts')
      const refreshJson = await refreshRes.json()
      if (refreshJson.data) setReceipts(refreshJson.data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this receipt record?')) return
    setDeleting(id)
    try {
      const res = await fetch('/api/admin/ingredient-receipts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error('Delete failed')
      setReceipts((prev) => prev.filter((r) => r.id !== id))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setDeleting(null)
    }
  }

  const filteredReceipts = filterIng
    ? receipts.filter((r) => r.ingredient_id === filterIng)
    : receipts

  const totalSpend = filteredReceipts.reduce(
    (s, r) => s + Number(r.total_cost ?? 0), 0
  )
  const totalKg = filteredReceipts.reduce(
    (s, r) => s + Number(r.quantity_kg ?? 0), 0
  )

  return (
    <div className="space-y-6">

      {/* Record New Receipt Form */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-green-700" />
            <span className="font-bold text-gray-800">Record New Delivery</span>
          </div>
          {showForm
            ? <ChevronUp className="h-4 w-4 text-gray-500" />
            : <ChevronDown className="h-4 w-4 text-gray-500" />
          }
        </button>

        {showForm && (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 font-semibold">
                {success}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

              {/* Ingredient */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Ingredient <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.ingredient_id}
                  onChange={(e) => {
                    const ing = ingredients.find((i) => i.id === e.target.value)
                    setForm({
                      ...form,
                      ingredient_id: e.target.value,
                      supplier: ing?.supplier ?? form.supplier,
                      unit_cost: ing ? String(ing.unit_cost) : form.unit_cost,
                    })
                  }}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">— Select ingredient —</option>
                  {ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} (current: ${Number(ing.unit_cost).toFixed(4)}/{ing.unit})
                    </option>
                  ))}
                </select>
              </div>

              {/* Received Date */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Received Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.received_date}
                  onChange={(e) => setForm({ ...form, received_date: e.target.value })}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Supplier */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Supplier
                </label>
                <input
                  type="text"
                  value={form.supplier}
                  onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                  placeholder="e.g. Allied Mills"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Quantity (kg) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={form.quantity_kg}
                  onChange={(e) => setForm({ ...form, quantity_kg: e.target.value })}
                  required
                  placeholder="e.g. 25"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Unit Cost */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Unit Cost ($/kg) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-400 text-sm">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.0001"
                    value={form.unit_cost}
                    onChange={(e) => setForm({ ...form, unit_cost: e.target.value })}
                    required
                    placeholder="e.g. 1.08"
                    className="w-full pl-7 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                {costChanged && costDiff && (
                  <p className={
                    'text-xs mt-1 font-semibold ' +
                    (Number(costDiff) > 0 ? 'text-red-600' : 'text-green-600')
                  }>
                    {Number(costDiff) > 0 ? 'Up' : 'Down'} {Math.abs(Number(costDiff))}% from ${prevCost!.toFixed(4)}
                  </p>
                )}
              </div>

              {/* Invoice Ref */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Invoice / Docket Ref
                </label>
                <input
                  type="text"
                  value={form.invoice_ref}
                  onChange={(e) => setForm({ ...form, invoice_ref: e.target.value })}
                  placeholder="e.g. INV-12345"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

            </div>

            {/* Total Cost Preview */}
            {form.quantity_kg && form.unit_cost && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                <span className="text-sm text-blue-700 font-semibold">Total delivery cost:</span>
                <span className="text-lg font-bold text-blue-800">
                  ${(Number(form.quantity_kg) * Number(form.unit_cost)).toFixed(2)}
                </span>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Optional notes"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* Update cost toggle */}
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <input
                type="checkbox"
                id="update_cost"
                checked={form.update_cost}
                onChange={(e) => setForm({ ...form, update_cost: e.target.checked })}
                className="mt-0.5 w-4 h-4 accent-green-600"
              />
              <label htmlFor="update_cost" className="text-sm text-amber-800 cursor-pointer">
                <span className="font-bold">Update ingredient cost to this delivery price</span>
                <span className="block text-xs text-amber-700 mt-0.5">
                  This will update recipe costs and product margins automatically.
                  Uncheck if this delivery price is a one-off anomaly.
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 rounded-lg text-white font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
              style={{ backgroundColor: '#006A4E' }}
            >
              {saving ? 'Saving...' : 'Record Delivery'}
            </button>

          </form>
        )}
      </div>

      {/* Receipt History */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-bold text-gray-800">Delivery History</h2>
            <p className="text-xs text-gray-500 mt-0.5">Last 100 receipts</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={filterIng}
              onChange={(e) => setFilterIng(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">All ingredients</option>
              {ingredients.map((ing) => (
                <option key={ing.id} value={ing.id}>{ing.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-3 divide-x divide-gray-200 border-b border-gray-200">
          <div className="px-5 py-3 flex items-center gap-2">
            <Package className="h-4 w-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Total Received</p>
              <p className="font-bold text-gray-800">{totalKg.toFixed(1)} kg</p>
            </div>
          </div>
          <div className="px-5 py-3 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Total Spend</p>
              <p className="font-bold text-gray-800">${totalSpend.toFixed(2)}</p>
            </div>
          </div>
          <div className="px-5 py-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Avg Cost/kg</p>
              <p className="font-bold text-gray-800">
                {totalKg > 0 ? '$' + (totalSpend / totalKg).toFixed(4) : '—'}
              </p>
            </div>
          </div>
        </div>

        {filteredReceipts.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            No delivery records yet
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Ingredient</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Supplier</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Ref</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Qty (kg)</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Unit Cost</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Total</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredReceipts.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">
                    {r.received_date}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {r.ingredients?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {r.supplier ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-500">
                    {r.invoice_ref ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">
                    {Number(r.quantity_kg).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    ${Number(r.unit_cost).toFixed(4)}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">
                    ${Number(r.total_cost).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(r.id)}
                      disabled={deleting === r.id}
                      className="text-red-400 hover:text-red-600 disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  )
}