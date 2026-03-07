'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Search } from 'lucide-react'

interface Recipe {
  id: string
  product_id: string | null
  base_ingredient_id: string | null
  name: string | null
  products?: {
    id: string
    name: string
    code: string | null
  } | null
}

interface Product {
  id: string
  name: string
  code: string | null
}

interface Props {
  recipes: Recipe[]
  availableProducts: Product[]
}

export default function RecipesView({ recipes: initial, availableProducts }: Props) {
  const router = useRouter()
  const [recipes, setRecipes] = useState<Recipe[]>(initial)
  const [showNewForm, setShowNewForm] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'base' | 'product'>('all')
  const [newRecipe, setNewRecipe] = useState({
    product_id: '',
    is_base: false,
  })
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // ── Filter logic ──────────────────────────────────────────────────
  const filteredRecipes = recipes.filter((r) => {
    const name = r.name || r.products?.name || ''
    const code = r.products?.code || ''
    const matchesSearch =
      name.toLowerCase().includes(search.toLowerCase()) ||
      code.toLowerCase().includes(search.toLowerCase())
    const matchesType =
      typeFilter === 'all' ? true :
      typeFilter === 'base' ? !r.product_id :
      !!r.product_id
    return matchesSearch && matchesType
  })

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setMessage(null)

    if (!newRecipe.is_base && !newRecipe.product_id) {
      setMessage({ type: 'error', text: 'Please select a product' })
      setCreating(false)
      return
    }

    const res = await fetch('/api/admin/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: newRecipe.is_base ? null : newRecipe.product_id,
      }),
    })

    const json = await res.json()
    setCreating(false)

    if (!res.ok) {
      setMessage({ type: 'error', text: json.error ?? 'Failed to create recipe' })
      return
    }

    router.push(`/admin/costings/recipes/${json.recipe.id}`)
  }

  async function handleDelete(recipe: Recipe) {
    const name = recipe.name || recipe.products?.name || 'this recipe'
    if (!confirm(`Delete "${name}"? This will also delete all ingredient lines.`)) return

    setDeleting(recipe.id)

    const res = await fetch(`/api/admin/recipes/${recipe.id}`, {
      method: 'DELETE',
    })

    if (res.ok) {
      setRecipes(prev => prev.filter(r => r.id !== recipe.id))
    } else {
      alert('Failed to delete recipe')
    }

    setDeleting(null)
  }

  return (
    <div className="space-y-6 max-w-5xl">

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recipes</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {recipes.length} recipe{recipes.length !== 1 ? 's' : ''} —
            ingredient formulas for products
          </p>
        </div>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition"
        >
          {showNewForm ? 'Cancel' : '+ New Recipe'}
        </button>
      </div>

      {/* ── New Recipe Form ───────────────────────────────────────── */}
      {showNewForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white border border-indigo-200 rounded-xl p-6 shadow-sm space-y-4"
        >
          <h2 className="text-base font-semibold text-gray-800">Create New Recipe</h2>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_base"
              checked={newRecipe.is_base}
              onChange={(e) =>
                setNewRecipe({ ...newRecipe, is_base: e.target.checked, product_id: '' })
              }
              className="w-4 h-4 rounded border-gray-300 text-indigo-600"
            />
            <label htmlFor="is_base" className="text-sm text-gray-600">
              This is a <strong>base recipe</strong> (e.g. White Dough — shared between products)
            </label>
          </div>

          {!newRecipe.is_base && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Select Product <span className="text-red-500">*</span>
              </label>
              <select
                value={newRecipe.product_id}
                onChange={(e) => setNewRecipe({ ...newRecipe, product_id: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              >
                <option value="">— Select a product —</option>
                {availableProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code ? `[${p.code}] ` : ''}{p.name}
                  </option>
                ))}
              </select>
              {availableProducts.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  All products already have recipes.
                </p>
              )}
            </div>
          )}

          {message && (
            <div className={`rounded-lg px-3 py-2 text-sm ${
              message.type === 'error'
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-green-50 text-green-700 border border-green-200'
            }`}>
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={creating}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg text-sm transition"
          >
            {creating ? 'Creating...' : 'Create Recipe'}
          </button>
        </form>
      )}

      {/* ── Search + Filter ───────────────────────────────────────── */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search recipes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 border border-gray-300 rounded-lg py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as any)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Types</option>
          <option value="base">Base Only</option>
          <option value="product">Product Only</option>
        </select>
      </div>

      {/* ── Recipes Table ─────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {filteredRecipes.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            {search || typeFilter !== 'all'
              ? 'No recipes match your search.'
              : 'No recipes yet — create one above.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Recipe Name</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Type</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRecipes.map((recipe) => (
                <tr key={recipe.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    {recipe.products ? (
                      <div>
                        <span className="font-medium text-gray-900">
                          {recipe.products.name}
                        </span>
                        {recipe.products.code && (
                          <span className="text-xs text-gray-400 ml-2 font-mono">
                            #{recipe.products.code}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="font-medium text-gray-900">
                        {recipe.name || (
                          <span className="text-gray-400 italic">
                            Unnamed — click Edit to name
                          </span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {recipe.products ? (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                        Product
                      </span>
                    ) : (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">
                        Base
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => router.push(`/admin/costings/recipes/${recipe.id}`)}
                        className="text-indigo-600 hover:text-indigo-800 font-medium text-xs px-3 py-1.5 rounded-md hover:bg-indigo-50 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(recipe)}
                        disabled={deleting === recipe.id}
                        className="text-red-400 hover:text-red-600 disabled:opacity-40 p-1.5 rounded-md hover:bg-red-50 transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
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