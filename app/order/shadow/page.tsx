import { ShadowOrderManager } from '@/components/order/shadow-order-manager'

export default function ShadowOrderPage() {
  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">My Usual Order</h1>
        <p className="text-gray-600">
          Manage your default items for quick ordering
        </p>
      </div>

      <ShadowOrderManager />
    </div>
  )
}