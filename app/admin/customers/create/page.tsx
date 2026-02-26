export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { checkAdmin } from '@/lib/auth'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import CustomerForm from '../components/customer-form'

export default async function CreateCustomerPage() {
  const isAdmin = await checkAdmin()
  if (!isAdmin) redirect('/')

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Link
        href="/admin/customers"
        className="flex items-center gap-1 text-sm mb-4 hover:opacity-80"
        style={{ color: '#CE1126' }}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Customers
      </Link>
      <h1 className="text-3xl font-bold mb-8">Add Customer</h1>
      <CustomerForm />
    </div>
  )
}