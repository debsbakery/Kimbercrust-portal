export const dynamic = 'force-dynamic'
import { redirect } from "next/navigation"
import { createServiceClient } from "@/lib/supabase/server"
import { checkAdmin } from "@/lib/auth"
import { ArrowLeft, Calendar, Plus, RefreshCw } from "lucide-react"
import Link from "next/link"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import StandingOrderActions from "./components/standing-order-actions"

interface StandingOrder {
  id: string
  customer_id: string
  delivery_days: string | null
  frequency: string
  active: boolean
  notes: string | null
  created_at: string
  next_generation_date: string | null
  last_generated_date: string | null
  customer: {
    id: string
    business_name: string
    email: string
    contact_name: string | null
    phone: string | null
  } | null
  items: Array<{
    id: string
    product_id: string
    quantity: number
    product: {
      id: string
      name: string
      price: number
      code: string | null
    } | null
  }>
}

async function getStandingOrdersData() {
  const supabase = await createServiceClient()

  const { data: standingOrders, error } = await supabase
    .from('standing_orders')
    .select(`
      *,
      customer:customers(
        id, business_name, email, contact_name, phone
      ),
      items:standing_order_items(
        id, product_id, quantity,
        product:products(
          id, name, price, code
        )
      )
    `)
    .order('delivery_days', { ascending: true })

  if (error) {
    console.error('Error fetching standing orders:', error)
    return { standingOrders: [] }
  }

  return { standingOrders: (standingOrders || []) as StandingOrder[] }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(amount)
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "—"
  try {
    return new Date(dateString).toLocaleDateString("en-AU", {
      weekday: 'short', month: 'short', day: 'numeric'
    })
  } catch { return "—" }
}

function capitalizeDay(day: string | null | undefined): string {
  if (!day) return "—"
  return day.charAt(0).toUpperCase() + day.slice(1)
}

function getDayBadgeColor(day: string | null | undefined): string {
  if (!day) return 'bg-gray-100 text-gray-800'
  const colors: Record<string, string> = {
    monday:    'bg-blue-100 text-blue-800',
    tuesday:   'bg-green-100 text-green-800',
    wednesday: 'bg-yellow-100 text-yellow-800',
    thursday:  'bg-purple-100 text-purple-800',
    friday:    'bg-pink-100 text-pink-800',
    saturday:  'bg-orange-100 text-orange-800',
    sunday:    'bg-red-100 text-red-800',
  }
  return colors[day.toLowerCase()] || 'bg-gray-100 text-gray-800'
}

const DAY_ORDER: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6
}

const ALL_DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']

export default async function StandingOrdersPage() {
  const isAdmin = await checkAdmin()
  if (!isAdmin) redirect("/")

  const { standingOrders } = await getStandingOrdersData()

  // Sort by day of week
  const sorted = [...standingOrders].sort((a, b) => {
    const da = DAY_ORDER[a.delivery_days?.toLowerCase() || ''] ?? 99
    const db = DAY_ORDER[b.delivery_days?.toLowerCase() || ''] ?? 99
    if (da !== db) return da - db
    return (a.customer?.business_name || '').localeCompare(b.customer?.business_name || '')
  })

  const activeOrders   = standingOrders.filter(so => so.active).length
  const totalCustomers = new Set(standingOrders.map(so => so.customer_id)).size

  // Group by day for expected customers view
  const byDay = ALL_DAYS.reduce<Record<string, StandingOrder[]>>((acc, day) => {
    acc[day] = sorted.filter(
      so => so.delivery_days?.toLowerCase() === day && so.active
    )
    return acc
  }, {})

  // Weekly value
  const weeklyTotal = standingOrders.reduce((sum, so) => {
    return sum + (so.items?.reduce((s, item) =>
      s + item.quantity * (item.product?.price || 0), 0) || 0)
  }, 0)

  return (
    <div className="container mx-auto px-4 py-8">

      {/* Header */}
      <div className="mb-8">
        <a
          href="/admin"
          className="flex items-center gap-1 text-sm mb-4 hover:opacity-80"
          style={{ color: "#8B000" }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Admin
        </a>
        <div className="flex justify-between items-start flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Calendar className="h-8 w-8" style={{ color: "#1a1a1a" }} />
              Standing Orders
            </h1>
            <p className="text-gray-600">Manage recurring weekly orders</p>
          </div>
          <div className="flex gap-3">
            <a
              href="/admin/standing-orders"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-50 text-sm font-medium"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </a>
            <Link
              href="/admin/standing-orders/create"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-white font-semibold hover:opacity-90"
              style={{ backgroundColor: "#1a1a1a" }}
            >
              <Plus className="h-5 w-5" />
              Create Standing Order
            </Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4" style={{ borderColor: "#1a1a1a" }}>
          <p className="text-sm text-gray-600">Active Orders</p>
          <p className="text-3xl font-bold" style={{ color: "#1a1a1a" }}>{activeOrders}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4" style={{ borderColor: "#8B000" }}>
          <p className="text-sm text-gray-600">Customers</p>
          <p className="text-3xl font-bold" style={{ color: "#8B000" }}>{totalCustomers}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
          <p className="text-sm text-gray-600">Total Orders</p>
          <p className="text-3xl font-bold text-blue-600">{standingOrders.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-yellow-500">
          <p className="text-sm text-gray-600">Est. Weekly Value</p>
          <p className="text-2xl font-bold text-yellow-700">{formatCurrency(weeklyTotal)}</p>
        </div>
      </div>

      {/* Expected Customers by Day */}
      <div className="bg-white rounded-lg shadow-md mb-8">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold">Expected Customers by Day</h2>
          <p className="text-sm text-gray-500 mt-1">
            Active standing orders only — use this to check all orders are in before generating
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-7 divide-y md:divide-y-0 md:divide-x">
          {ALL_DAYS.map((day) => {
            const dayOrders = byDay[day]
            const dayTotal = dayOrders.reduce((sum, so) =>
              sum + (so.items?.reduce((s, item) =>
                s + item.quantity * (item.product?.price || 0), 0) || 0), 0)

            return (
              <div key={day} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${getDayBadgeColor(day)}`}>
                    {capitalizeDay(day).slice(0, 3)}
                  </span>
                  <span className="text-xs text-gray-400 font-mono">
                    {dayOrders.length} cust
                  </span>
                </div>

                {dayOrders.length === 0 ? (
                  <p className="text-xs text-gray-300 italic">None</p>
                ) : (
                  <div className="space-y-1">
                    {dayOrders.map((so) => (
                      <div key={so.id} className="text-xs">
                        <p className="font-medium text-gray-700 truncate">
                          {so.customer?.business_name || '—'}
                        </p>
                        <p className="text-gray-400">
                          {so.items?.length || 0} items &middot; {formatCurrency(
                            so.items?.reduce((s, item) =>
                              s + item.quantity * (item.product?.price || 0), 0) || 0
                          )}
                        </p>
                      </div>
                    ))}
                    <p className="text-xs font-semibold text-gray-600 border-t pt-1 mt-2">
                      {formatCurrency(dayTotal)}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Full Table */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold">All Standing Orders</h2>
          <p className="text-sm text-gray-500 mt-1">Sorted by delivery day</p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Day</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Est. Value</TableHead>
                <TableHead>Next Gen</TableHead>
                <TableHead>Last Gen</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    No standing orders yet.
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((order) => {
                  const day = order.delivery_days
                  const estimatedTotal = order.items?.reduce(
                    (sum, item) => sum + item.quantity * (item.product?.price || 0), 0
                  ) || 0

                  return (
                    <TableRow key={order.id}>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getDayBadgeColor(day)}`}>
                          {capitalizeDay(day)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{order.customer?.business_name || "—"}</p>
                          <p className="text-xs text-gray-400">{order.customer?.contact_name}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm space-y-0.5">
                          {order.items && order.items.length > 0 ? (
                            <>
                              {order.items.slice(0, 3).map((item) => (
                                <div key={item.id} className="flex items-center gap-1.5">
                                  <span className="font-semibold text-gray-700">{item.quantity}x</span>
                                  <span className="text-gray-500 truncate max-w-32">
                                    {item.product?.name || 'Unknown'}
                                  </span>
                                </div>
                              ))}
                              {order.items.length > 3 && (
                                <p className="text-xs text-gray-400">
                                  +{order.items.length - 3} more
                                </p>
                              )}
                            </>
                          ) : (
                            <span className="text-gray-400 text-xs">No items</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(estimatedTotal)}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatDate(order.next_generation_date)}
                      </TableCell>
                      <TableCell className="text-sm text-gray-400">
                        {formatDate(order.last_generated_date)}
                      </TableCell>
                      <TableCell>
                        {order.active ? (
                          <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold bg-green-100 text-green-800">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold bg-gray-100 text-gray-800">
                            Paused
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/admin/standing-orders/edit/${order.id}`}
                          className="text-sm px-3 py-1.5 rounded-md text-white hover:opacity-90"
                          style={{ backgroundColor: "#1a1a1a" }}
                        >
                          Edit
                        </Link>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Generate Orders */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Generate Orders for the Week
        </h3>
        <p className="text-sm text-gray-700 mb-4">
          This will create orders for all active standing orders for the current week (Sun-Sat).
          Already-generated orders will be skipped.
        </p>
        <StandingOrderActions />
      </div>

    </div>
  )
}