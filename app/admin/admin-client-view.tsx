'use client'

import { useState } from 'react'
import {
  Clock, Users, BarChart3, Package, RefreshCw, Truck,
  DollarSign, FileText, ShoppingCart, ChefHat, Receipt,
  Copy, Play, ClipboardList, Printer, Store, X,
} from 'lucide-react'

import OrdersView from './orders-view'
import ContractPricingPage from './pricing/page'
import ProductsView from './products-view'

type Tab = 'orders' | 'standing-orders' | 'pricing' | 'products'

const ALL_DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
const DAY_LABELS: Record<string, string> = {
  sunday: 'Sun', monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat',
}

export default function AdminClientView({
  pendingCount = 0,
  weekRevenue = 0,
  weekStart = '',
  weekEnd = '',
}: {
  pendingCount?: number
  weekRevenue?: number
  weekStart?: string
  weekEnd?: string
}) {
  const [activeTab,                setActiveTab]                = useState<Tab>('orders')
  const [showSOModal,              setShowSOModal]              = useState(false)
  const [skippedDays,              setSkippedDays]              = useState<string[]>([])
  const [generatingStandingOrders, setGeneratingStandingOrders] = useState(false)
  const [soResult,                 setSoResult]                 = useState<{
    success: boolean; message: string; ordersCreated?: number
  } | null>(null)

  function toggleDay(day: string) {
    setSkippedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    )
  }

  function openModal() {
    setSkippedDays([])
    setSoResult(null)
    setShowSOModal(true)
  }

  async function generateStandingOrders() {
    const skipMsg = skippedDays.length > 0
      ? `\n\nSkipping: ${skippedDays.map(d => DAY_LABELS[d]).join(', ')}`
      : ''
    if (!confirm(`Generate orders for all active standing orders this week?${skipMsg}`)) return

    setGeneratingStandingOrders(true)
    setSoResult(null)

    try {
      const response = await fetch('/api/standing-orders/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ skip_days: skippedDays }),
      })
      const data = await response.json()
      if (response.ok && data.success) {
        setSoResult({
          success:       true,
          message:       data.message,
          ordersCreated: data.ordersCreated,
        })
        if (data.ordersCreated > 0) {
          setTimeout(() => window.location.reload(), 2000)
        }
      } else {
        setSoResult({ success: false, message: data.error || 'Generation failed' })
      }
    } catch (error: any) {
      setSoResult({ success: false, message: error.message })
    } finally {
      setGeneratingStandingOrders(false)
    }
  }

  const todayLabel = (() => {
    const brisbane = new Date(Date.now() + 10 * 60 * 60 * 1000)
    const iso = brisbane.toISOString().split('T')[0]
    return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-AU', {
      weekday: 'long', day: 'numeric', month: 'long',
    })
  })()

  const weekLabel = weekStart && weekEnd
    ? `${new Date(weekStart + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} – ${new Date(weekEnd + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`
    : ''

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Skip Days Modal ── */}
      {showSOModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">🗓️ Generate Standing Orders</h2>
              <button onClick={() => setShowSOModal(false)}
                className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Generates orders for all active standing orders this week.
              Tick any days to skip — e.g. public holidays.
            </p>
            <div className="mb-5">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Skip days <span className="text-gray-400 font-normal">(optional)</span>
              </p>
              <div className="flex gap-2 flex-wrap">
                {ALL_DAYS.map(day => {
                  const skipped = skippedDays.includes(day)
                  return (
                    <button
                      key={day}
                      onClick={() => toggleDay(day)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors
                        ${skipped
                          ? 'bg-red-100 border-red-300 text-red-700 line-through'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                      {DAY_LABELS[day]}
                    </button>
                  )
                })}
              </div>
              {skippedDays.length > 0 && (
                <p className="text-xs text-red-600 mt-2 font-medium">
                  ⚠️ Skipping: {skippedDays.map(d => DAY_LABELS[d]).join(', ')}
                </p>
              )}
            </div>
            {soResult && (
              <div className={`mb-4 p-3 rounded-lg text-sm
                ${soResult.success
                  ? 'bg-green-50 border border-green-200 text-green-800'
                  : 'bg-red-50 border border-red-200 text-red-800'
                }`}>
                <p className="font-semibold">{soResult.success ? '✅ Done' : '❌ Error'}</p>
                <p className="mt-0.5">{soResult.message}</p>
                {soResult.success && soResult.ordersCreated === 0 && (
                  <p className="mt-1 text-green-700">All orders already exist — no duplicates created.</p>
                )}
                {soResult.success && (soResult.ordersCreated ?? 0) > 0 && (
                  <p className="mt-1 text-green-700">Reloading page...</p>
                )}
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowSOModal(false)}
                className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={generateStandingOrders}
                disabled={generatingStandingOrders}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                {generatingStandingOrders
                  ? <><RefreshCw className="h-4 w-4 animate-spin" /> Generating...</>
                  : <><RefreshCw className="h-4 w-4" /> Generate Now</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-start py-4 gap-4">
            <div className="shrink-0">
              {/* ✅ Kimbercrust branding unchanged */}
              <h1 className="text-2xl font-bold" style={{ color: '#2c2c2c' }}>
                Admin Dashboard
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {todayLabel} — Kimbercrust Bakery
              </p>
              {weekRevenue > 0 && (
                <div className="mt-2 inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                  <BarChart3 className="h-4 w-4 text-green-600" />
                  <div>
                    <span className="text-xs text-green-600 font-medium">This Week ex-GST</span>
                    <span className="ml-2 text-base font-bold text-green-700">
                      ${weekRevenue.toLocaleString('en-AU', {
                        minimumFractionDigits: 2, maximumFractionDigits: 2,
                      })}
                    </span>
                    {weekLabel && (
                      <span className="ml-2 text-xs text-green-500">{weekLabel}</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 flex-wrap justify-end">
              <a href="/admin/batch-invoice"
                className="flex items-center gap-2 px-4 py-2 text-white rounded-md hover:opacity-90 shadow-md text-sm font-medium"
                style={{ backgroundColor: '#8B0000' }}>
                <FileText className="h-4 w-4" />Batch Invoice
              </a>
              <a href="/admin/direct-invoice"
                className="flex items-center gap-2 px-4 py-2 text-white rounded-md hover:opacity-90 shadow-md text-sm font-medium"
                style={{ backgroundColor: '#8B0000' }}>
                <Receipt className="h-4 w-4" />Direct Invoice
              </a>
              <a href="/admin/batch-packing-slips"
                className="flex items-center gap-2 px-4 py-2 text-white rounded-md hover:opacity-90 shadow-md text-sm font-medium"
                style={{ backgroundColor: '#0369a1' }}>
                <Printer className="h-4 w-4" />Packing Slips
              </a>
              <a href="/admin/production"
                className="flex items-center gap-2 px-4 py-2 text-white rounded-md hover:opacity-90 shadow-md text-sm font-medium"
                style={{ backgroundColor: '#2c2c2c' }}>
                <ChefHat className="h-4 w-4" />Production
              </a>
              <a href="/admin/orders/create"
                className="flex items-center gap-2 px-4 py-2 text-white rounded-md hover:opacity-90 shadow-md text-sm font-medium"
                style={{ backgroundColor: '#2c2c2c' }}>
                <ClipboardList className="h-4 w-4" />New Order
              </a>
              <a href="/admin/customers"
                className="flex items-center gap-2 px-4 py-2 text-white rounded-md hover:opacity-90 shadow-md text-sm font-medium"
                style={{ backgroundColor: '#0284c7' }}>
                <Users className="h-4 w-4" />Customers
              </a>
              <a href="/admin/customers/pending"
                className="relative flex items-center gap-2 px-4 py-2 text-white rounded-md hover:opacity-90 shadow-md text-sm font-medium"
                style={{ backgroundColor: '#ea580c' }}>
                <Clock className="h-4 w-4" />
                Pending
                {pendingCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
                    {pendingCount}
                  </span>
                )}
              </a>
              <a href="/admin/customers/repeat-order-search"
                className="flex items-center gap-2 px-4 py-2 text-white rounded-md hover:opacity-90 shadow-md text-sm font-medium"
                style={{ backgroundColor: '#7c3aed' }}>
                <Copy className="h-4 w-4" />Repeat Order
              </a>
              <a href="/admin/ar"
                className="flex items-center gap-2 px-4 py-2 text-white rounded-md hover:opacity-90 shadow-md text-sm font-medium"
                style={{ backgroundColor: '#1f2937' }}>
                <DollarSign className="h-4 w-4" />AR Dashboard
              </a>
              <a href="/admin/reports/weekly"
                className="flex items-center gap-2 px-4 py-2 text-white rounded-md hover:opacity-90 shadow-md text-sm font-medium"
                style={{ backgroundColor: '#7c3aed' }}>
                <BarChart3 className="h-4 w-4" />Weekly Report
              </a>
              <a href="/admin/reports/stales"
                className="flex items-center gap-2 px-4 py-2 text-white rounded-md hover:opacity-90 shadow-md text-sm font-medium"
                style={{ backgroundColor: '#dc2626' }}>
                <BarChart3 className="h-4 w-4" />Stales
              </a>
              <a href="/admin/reports/accountant"
                className="flex items-center gap-2 px-4 py-2 text-white rounded-md hover:opacity-90 shadow-md text-sm font-medium"
                style={{ backgroundColor: '#2563eb' }}>
                <FileText className="h-4 w-4" />Accountant
              </a>
              <a href="/admin/reports/sales-history"
                className="flex items-center gap-2 px-4 py-2 text-white rounded-md hover:opacity-90 shadow-md text-sm font-medium"
                style={{ backgroundColor: '#7c3aed' }}>
                <BarChart3 className="h-4 w-4" />Sales History
              </a>
              <a href="/admin/payments/record"
                className="flex items-center gap-2 px-4 py-2 text-white rounded-md hover:opacity-90 shadow-md text-sm font-medium"
                style={{ backgroundColor: '#16a34a' }}>
                <DollarSign className="h-4 w-4" />Record Payment
              </a>
              <a href="/admin/gst-report"
                className="flex items-center gap-2 px-4 py-2 text-white rounded-md hover:opacity-90 shadow-md text-sm font-medium"
                style={{ backgroundColor: '#7c3aed' }}>
                <BarChart3 className="h-4 w-4" />GST Report
              </a>
              <a href="/admin/routes"
                className="flex items-center gap-2 px-4 py-2 text-white rounded-md hover:opacity-90 shadow-md text-sm font-medium"
                style={{ backgroundColor: '#8B0000' }}>
                <Truck className="h-4 w-4" />Routes
              </a>
              <a href="/admin/products"
                className="flex items-center gap-2 px-4 py-2 text-white rounded-md hover:opacity-90 shadow-md text-sm font-medium"
                style={{ backgroundColor: '#006A4E' }}>
                <Package className="h-4 w-4" />Products
              </a>
              <a href="/admin/inventory"
                className="flex items-center gap-2 px-4 py-2 text-white rounded-md hover:opacity-90 shadow-md text-sm font-medium"
                style={{ backgroundColor: '#16a34a' }}>
                <Package className="h-4 w-4" />Inventory
              </a>
              <a href="/admin/stock-take"
                className="flex items-center gap-2 px-4 py-2 text-white rounded-md hover:opacity-90 shadow-md text-sm font-medium"
                style={{ backgroundColor: '#ea580c' }}>
                <ClipboardList className="h-4 w-4" />Stock Take
              </a>
              <a href="/admin/costings"
                className="flex items-center gap-2 px-4 py-2 text-white rounded-md hover:opacity-90 shadow-md text-sm font-medium"
                style={{ backgroundColor: '#ca8a04' }}>
                <DollarSign className="h-4 w-4" />Cost Settings
              </a>
              <a href="/admin/products/bulk-codes"
                className="flex items-center gap-2 px-4 py-2 text-white rounded-md hover:opacity-90 shadow-md text-sm font-medium"
                style={{ backgroundColor: '#4f46e5' }}>
                <ShoppingCart className="h-4 w-4" />Bulk Codes
              </a>
              <a href="/admin/products/bulk-weights"
                className="flex items-center gap-2 px-4 py-2 text-white rounded-md hover:opacity-90 shadow-md text-sm font-medium"
                style={{ backgroundColor: '#0d9488' }}>
                <Package className="h-4 w-4" />Bulk Weights
              </a>
              <a href="/admin/shop-reports"
                className="flex items-center gap-2 px-4 py-2 text-white rounded-md hover:opacity-90 shadow-md text-sm font-medium"
                style={{ backgroundColor: '#0f766e' }}>
                <Store className="h-4 w-4" />Shop Reports
              </a>
              <a href="/admin/portal-qr"
                className="flex items-center gap-2 px-4 py-2 text-white rounded-md hover:opacity-90 shadow-md text-sm font-medium"
                style={{ backgroundColor: '#db2777' }}>
                <FileText className="h-4 w-4" />Portal QR
              </a>

              {/* ✅ Generate S/O — now opens modal with skip days */}
              <button
                onClick={openModal}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-md text-sm font-medium">
                <RefreshCw className="h-4 w-4" />Generate S/O
              </button>
            </div>
          </div>

          <div className="flex gap-0 overflow-x-auto">
            {([
              { id: 'orders',          icon: <Package className="h-4 w-4" />,      label: 'Orders' },
              { id: 'standing-orders', icon: <RefreshCw className="h-4 w-4" />,    label: 'Standing Orders' },
              { id: 'products',        icon: <ShoppingCart className="h-4 w-4" />, label: 'Products' },
              { id: 'pricing',         icon: <DollarSign className="h-4 w-4" />,   label: 'Contract Pricing' },
            ] as { id: Tab; icon: React.ReactNode; label: string }[]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm whitespace-nowrap transition-all border-b-2 ${
                  activeTab === tab.id
                    ? 'border-green-600 text-green-700 bg-green-50'
                    : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {activeTab === 'orders' && <OrdersView />}
        {activeTab === 'standing-orders' && (
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">Standing Orders</h2>
                <p className="text-gray-500 mt-1">Manage recurring weekly orders for all customers</p>
              </div>
              <a href="/admin/standing-orders"
                className="flex items-center gap-2 px-6 py-3 rounded-lg text-white font-semibold hover:opacity-90"
                style={{ backgroundColor: '#2c2c2c' }}>
                <RefreshCw className="h-5 w-5" />Open Standing Orders
              </a>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <p className="text-sm text-green-700 font-medium">Full standing orders management</p>
                <p className="text-xs text-green-600 mt-1">View all customers, all days, expected vs actual</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <p className="text-sm text-blue-700 font-medium">Create multi-day orders</p>
                <p className="text-xs text-blue-600 mt-1">Set Mon-Fri in one entry with contract pricing</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                <p className="text-sm text-yellow-700 font-medium">Pause or delete orders</p>
                <p className="text-xs text-yellow-600 mt-1">Pause for holidays, delete permanently</p>
              </div>
            </div>
            <div className="text-center">
              <a href="/admin/standing-orders"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-lg text-white font-semibold hover:opacity-90 text-lg"
                style={{ backgroundColor: '#2c2c2c' }}>
                <RefreshCw className="h-6 w-6" />Go to Standing Orders
              </a>
            </div>
          </div>
        )}
        {activeTab === 'products' && <ProductsView />}
        {activeTab === 'pricing'  && <ContractPricingPage />}
      </div>
    </div>
  )
}