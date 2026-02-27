'use client';

import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Save, CheckCircle, AlertCircle } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  category: string | null;
  code: string | null;
  price: number;
}

export default function BulkCodesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'missing' | 'all'>('missing');
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      const prods: Product[] = data.products || [];
      setProducts(prods);

      // Pre-fill codes from existing values
      const initial: Record<string, string> = {};
      prods.forEach((p) => {
        initial[p.id] = p.code || '';
      });
      setCodes(initial);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const saveCode = async (productId: string) => {
  const code = codes[productId]?.trim();
  if (!code) return;

  setSaving((prev) => ({ ...prev, [productId]: true }));
  setErrors((prev) => ({ ...prev, [productId]: '' }));

  // Find the full product so we can send name + price too
  const product = products.find((p) => p.id === productId);
  if (!product) return;

  try {
    const res = await fetch(`/api/products/${productId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: product.name,        // send existing name
        price: product.price,      // send existing price
        category: product.category,
        code: code,                // only thing we're actually changing
      }),
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error);

    setSaved((prev) => ({ ...prev, [productId]: true }));

    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, code } : p))
    );

    setTimeout(() => {
      setSaved((prev) => ({ ...prev, [productId]: false }));
    }, 2000);
  } catch (err: any) {
    setErrors((prev) => ({ ...prev, [productId]: err.message }));
  } finally {
    setSaving((prev) => ({ ...prev, [productId]: false }));
  }
};

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    productId: string,
    currentIndex: number
  ) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      // Save current
      saveCode(productId);
      // Move to next input
      const nextIndex = currentIndex + 1;
      const nextProduct = displayedProducts[nextIndex];
      if (nextProduct) {
        inputRefs.current[nextProduct.id]?.focus();
      }
    }
  };

  const saveAll = async () => {
    const unsaved = displayedProducts.filter(
      (p) => codes[p.id]?.trim() && codes[p.id] !== p.code
    );
    for (const p of unsaved) {
      await saveCode(p.id);
    }
  };

  const displayedProducts =
    filter === 'missing'
      ? products.filter((p) => !p.code || p.code.startsWith('PROD-'))
      : products;

  const missingCount = products.filter(
    (p) => !p.code || p.code.startsWith('PROD-')
  ).length;

  const filledCount = displayedProducts.filter(
    (p) => codes[p.id]?.trim()
  ).length;

  const getCategoryColor = (category: string | null) => {
    const cat = (category || '').toLowerCase();
    if (cat.includes('cake')) return 'bg-pink-100 text-pink-800';
    if (cat.includes('bread')) return 'bg-amber-100 text-amber-800';
    if (cat.includes('roll') || cat.includes('bun')) return 'bg-orange-100 text-orange-800';
    if (cat.includes('pie')) return 'bg-yellow-100 text-yellow-800';
    if (cat.includes('sweet') || cat.includes('slice')) return 'bg-purple-100 text-purple-800';
    if (cat.includes('sourdough')) return 'bg-green-100 text-green-800';
    return 'bg-gray-100 text-gray-700';
  };

  const getCodeHint = (category: string | null) => {
    const cat = (category || '').toLowerCase();
    if (cat.includes('cake')) return '1000-1999';
    if (cat.includes('bread')) return '2000-2750';
    if (cat.includes('sourdough')) return '2400-2750';
    if (cat.includes('roll') || cat.includes('bun')) return '2751-3750';
    if (cat.includes('pie')) return '3751-4000';
    return '4001+';
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-gray-500">Loading products...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <a
        href="/admin/products"
        className="flex items-center gap-1 text-sm mb-4 hover:opacity-80"
        style={{ color: '#CE1126' }}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Products
      </a>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Bulk Code Entry</h1>
          <p className="text-sm text-gray-500 mt-1">
            Tab or Enter to save and move to next product
          </p>
        </div>
        <button
          onClick={saveAll}
          className="flex items-center gap-2 px-4 py-2 rounded-md text-white font-semibold hover:opacity-90"
          style={{ backgroundColor: '#006A4E' }}
        >
          <Save className="h-4 w-4" />
          Save All
        </button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4 text-center">
          <p className="text-2xl font-bold text-gray-800">{products.length}</p>
          <p className="text-xs text-gray-500 mt-1">Total Products</p>
        </div>
        <div className="bg-white rounded-lg border p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{missingCount}</p>
          <p className="text-xs text-gray-500 mt-1">Missing Codes</p>
        </div>
        <div className="bg-white rounded-lg border p-4 text-center">
          <p className="text-2xl font-bold text-green-600">
            {products.length - missingCount}
          </p>
          <p className="text-xs text-gray-500 mt-1">Codes Assigned</p>
        </div>
      </div>

      {/* Code Range Reference */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-xs font-semibold text-blue-800 mb-2">Code Range Reference</p>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
          {[
            { range: '1000-1999', label: 'Cakes', color: 'text-pink-700' },
            { range: '2000-2750', label: 'Bread', color: 'text-amber-700' },
            { range: '2751-3750', label: 'Rolls', color: 'text-orange-700' },
            { range: '3751-4000', label: 'Pies', color: 'text-yellow-700' },
            { range: '4001+', label: 'Other', color: 'text-purple-700' },
            { range: '900', label: 'Admin', color: 'text-blue-700' },
          ].map((item) => (
            <div key={item.range} className="flex flex-col items-center bg-white rounded p-2 border">
              <span className={`font-mono font-bold ${item.color}`}>{item.range}</span>
              <span className="text-gray-600 mt-0.5">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filter Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFilter('missing')}
          className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
            filter === 'missing'
              ? 'bg-red-600 text-white border-red-600'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          Missing Codes ({missingCount})
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
            filter === 'all'
              ? 'bg-gray-800 text-white border-gray-800'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          All Products ({products.length})
        </button>
      </div>

      {/* Progress Bar */}
      {filter === 'missing' && missingCount > 0 && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{filledCount} of {displayedProducts.length} filled in this session</span>
            <span>{Math.round((filledCount / displayedProducts.length) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${(filledCount / displayedProducts.length) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Product Table */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase w-1/2">
                Product Name
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase w-1/6">
                Category
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase w-1/6">
                Hint
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase w-1/4">
                Code
              </th>
            </tr>
          </thead>
          <tbody>
            {displayedProducts.map((product, index) => (
              <tr
                key={product.id}
                className={`border-b last:border-0 transition-colors ${
                  saved[product.id] ? 'bg-green-50' : 'hover:bg-gray-50'
                }`}
              >
                {/* Name */}
                <td className="px-4 py-3">
                  <span className="text-sm font-medium text-gray-800">
                    {product.name}
                  </span>
                </td>

                {/* Category badge */}
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(
                      product.category
                    )}`}
                  >
                    {product.category || 'None'}
                  </span>
                </td>

                {/* Code hint */}
                <td className="px-4 py-3">
                  <span className="text-xs font-mono text-gray-400">
                    {getCodeHint(product.category)}
                  </span>
                </td>

                {/* Code Input */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <input
                      ref={(el) => {
                        inputRefs.current[product.id] = el;
                      }}
                      type="text"
                      value={codes[product.id] || ''}
                      onChange={(e) =>
                        setCodes((prev) => ({
                          ...prev,
                          [product.id]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => handleKeyDown(e, product.id, index)}
                      onBlur={() => {
                        if (codes[product.id]?.trim()) {
                          saveCode(product.id);
                        }
                      }}
                      className={`w-28 px-2 py-1.5 border rounded font-mono text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                        errors[product.id]
                          ? 'border-red-400 bg-red-50'
                          : saved[product.id]
                          ? 'border-green-400 bg-green-50'
                          : 'border-gray-300'
                      }`}
                      placeholder="e.g. 2001"
                    />

                    {/* Status icon */}
                    {saving[product.id] && (
                      <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                    )}
                    {saved[product.id] && !saving[product.id] && (
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    )}
                    {errors[product.id] && (
                      <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    )}
                  </div>
                  {errors[product.id] && (
                    <p className="text-xs text-red-600 mt-1">{errors[product.id]}</p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {displayedProducts.length === 0 && (
          <div className="text-center py-12">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <p className="text-gray-600 font-semibold">All products have codes assigned!</p>
          </div>
        )}
      </div>

      {/* Bottom Save All */}
      {displayedProducts.length > 0 && (
        <div className="mt-6 flex justify-end">
          <button
            onClick={saveAll}
            className="flex items-center gap-2 px-6 py-3 rounded-md text-white font-semibold hover:opacity-90"
            style={{ backgroundColor: '#006A4E' }}
          >
            <Save className="h-4 w-4" />
            Save All Unsaved
          </button>
        </div>
      )}
    </div>
  );
}