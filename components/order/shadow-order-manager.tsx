'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Trash2, Star, GripVertical } from 'lucide-react'
import Image from 'next/image'

interface ShadowOrder {
  id: string
  default_quantity: number
  display_order: number
  products: {
    id: string
    product_number: number | null
    name: string
    description: string | null
    price: string
    image_url: string | null
    category: string | null
    available: boolean
  }
}

export function ShadowOrderManager() {
  const [favorites, setFavorites] = useState<ShadowOrder[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadFavorites()
  }, [])

  const loadFavorites = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/shadow-orders')
      if (res.ok) {
        const data = await res.json()
        setFavorites(data)
      }
    } catch (error) {
      console.error('Failed to load favorites:', error)
    } finally {
      setLoading(false)
    }
  }

  const removeFavorite = async (id: string) => {
    if (!confirm('Remove this product from your favorites?')) return

    setLoading(true)
    try {
      const res = await fetch(`/api/shadow-orders?id=${id}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        await loadFavorites()
      } else {
        alert('Failed to remove favorite')
      }
    } catch (error) {
      console.error('Remove favorite error:', error)
      alert('Failed to remove favorite')
    } finally {
      setLoading(false)
    }
  }

  const updateDefaultQuantity = async (id: string, quantity: number) => {
    try {
      await fetch('/api/shadow-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, default_quantity: quantity })
      })
    } catch (error) {
      console.error('Update quantity error:', error)
    }
  }

  if (loading && favorites.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading your favorites...</div>
      </div>
    )
  }

  if (favorites.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Star className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold mb-2">No Favorite Products Yet</h3>
          <p className="text-gray-600 mb-4">
            Add products to your favorites for quick ordering
          </p>
          <Button asChild>
            <a href="/catalog">Browse Products</a>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
            My Favorite Products ({favorites.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            These are your frequently ordered items. Use "Show My Usual" in the catalog to filter your view.
          </p>

          <div className="space-y-3">
            {favorites.map((fav) => (
              <div
                key={fav.id}
                className="flex items-center gap-4 p-4 border rounded-lg hover:bg-gray-50 transition"
              >
                <GripVertical className="w-5 h-5 text-gray-400 cursor-move" />

                <div className="w-16 h-16 relative bg-gray-100 rounded overflow-hidden flex-shrink-0">
                  {fav.products.image_url ? (
                    <Image
                      src={fav.products.image_url}
                      alt={fav.products.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">
                      🍞
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {fav.products.product_number && (
                      <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        #{fav.products.product_number}
                      </span>
                    )}
                    <h4 className="font-semibold truncate">{fav.products.name}</h4>
                  </div>
                  {fav.products.description && (
                    <p className="text-sm text-gray-600 truncate">
                      {fav.products.description}
                    </p>
                  )}
                  <p className="text-sm font-medium text-blue-600">
                    ${parseFloat(fav.products.price).toFixed(2)}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-500">Default Qty</label>
                    <Input
                      type="number"
                      min="1"
                      value={fav.default_quantity}
                      onChange={(e) => {
                        const newQty = parseInt(e.target.value) || 1
                        setFavorites(prev =>
                          prev.map(f =>
                            f.id === fav.id ? { ...f, default_quantity: newQty } : f
                          )
                        )
                        updateDefaultQuantity(fav.id, newQty)
                      }}
                      className="w-20"
                    />
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFavorite(fav.id)}
                    disabled={loading}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button asChild className="flex-1">
          <a href="/catalog?filter=favorites">
            <Star className="w-4 h-4 mr-2" />
            Shop My Favorites
          </a>
        </Button>

        <Button
          variant="outline"
          onClick={loadFavorites}
          disabled={loading}
        >
          Refresh
        </Button>
      </div>
    </div>
  )
}