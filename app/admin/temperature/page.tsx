// app/admin/temperature/page.tsx
'use client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { getWeekStart, formatWeekStart } from '@/lib/week-utils'

export default function TemperatureIndex() {
  const router = useRouter()
  useEffect(() => {
    router.replace(`/admin/temperature/${formatWeekStart(getWeekStart(new Date()))}`)
  }, [router])
  return <div className="p-8 text-gray-400">Loading current week...</div>
}
