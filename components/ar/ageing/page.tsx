import { AgingService } from '@/lib/services/aging-service'
import { AgingTable } from '@/components/ar/aging-table'

export default async function AgingReportPage() {
  const service = new AgingService()
  const report = await service.getAgingReport()

  const data = report.map(customer => ({
    id: customer.id,
    name: customer.name,
    email: customer.email,
    paymentTerms: customer.paymentTerms,
    current: customer.aging?.current ? Number(customer.aging.current) : 0,
    days1To30: customer.aging?.days1To30 ? Number(customer.aging.days1To30) : 0,
    days31To60: customer.aging?.days31To60 ? Number(customer.aging.days31To60) : 0,
    days61To90: customer.aging?.days61To90 ? Number(customer.aging.days61To90) : 0,
    daysOver90: customer.aging?.daysOver90 ? Number(customer.aging.daysOver90) : 0,
    totalDue: customer.aging?.totalDue ? Number(customer.aging.totalDue) : 0,
    updatedAt: customer.aging?.updatedAt || null
  }))

  return (
    <div className="container mx-auto p-6">
      <AgingTable data={data} />
    </div>
  )
}