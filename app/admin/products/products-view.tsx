'use client';

import { useState, useEffect } from 'react';
import { Edit, Trash2, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';

interface Product {
  id: string;
  name: string;
  price: number;
  description: string | null;
  category: string | null;
  image_url: string | null;
}

export default function ProductsView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/products');
      const data = await response.json();

      if (data.error) throw new Error(data.error);

      setProducts(data.products || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;

    try {
      const response = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete product');

      fetchProducts();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
        <p className="mt-3 text-gray-500">Loading products...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700 font-semibold">❌ Error loading products</p>
        <p className="text-red-600 text-sm mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {products.length === 0 ? (
        <div className="col-span-full bg-white rounded-lg shadow-md p-12 text-center">
          <ImageIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg">No products yet</p>
          <Link
            href="/admin/products/create"
            className="inline-block mt-4 px-6 py-2 rounded-md text-white font-semibold hover:opacity-90"
            style={{ backgroundColor: "#006A4E" }}
          >
            + Add First Product
          </Link>
        </div>
      ) : (
        products.map((product) => (
          <div
            key={product.id}
            className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden"
          >
            {/* Product Image */}
            <div className="aspect-square bg-gray-100 relative">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="h-16 w-16 text-gray-300" />
                </div>
              )}
            </div>

            {/* Product Info */}
            <div className="p-4">
              <h3 className="text-lg font-bold mb-1">{product.name}</h3>
              {product.category && (
                <p className="text-xs text-gray-500 mb-2">{product.category}</p>
              )}
              {product.description && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                  {product.description}
                </p>
              )}
              <p className="text-2xl font-bold" style={{ color: "#006A4E" }}>
                {formatCurrency(product.price)}
              </p>
            </div>

            {/* Actions */}
            <div className="p-4 border-t flex gap-2">
              <Link
                href={`/admin/products/${product.id}`}
                className="flex-1 text-center px-3 py-2 rounded-md text-white text-sm font-semibold hover:opacity-90"
                style={{ backgroundColor: "#006A4E" }}
              >
                <Edit className="h-4 w-4 inline mr-1" />
                Edit
              </Link>
              <button
                onClick={() => handleDelete(product.id, product.name)}
                className="px-3 py-2 rounded-md bg-red-100 text-red-700 hover:bg-red-200"
                title="Delete product"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}