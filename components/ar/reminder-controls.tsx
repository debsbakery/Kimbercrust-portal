'use client'

import { useState } from 'react'
import { processRemindersAction } from '@/app/actions/ar-actions'

export function ReminderControls() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ sent: number; total: number } | null>(null)

  const handleSendReminders = async () => {
    if (!confirm('Send overdue payment reminders now?')) return

    setLoading(true)
    const response = await processRemindersAction()
    
    if (response.success) {
      setResult({ sent: response.sent || 0, total: response.total || 0 })
    } else {
      alert('Error: ' + response.error)
    }
    
    setLoading(false)
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Payment Reminders</h3>
      
      <button
        onClick={handleSendReminders}
        disabled={loading}
        className="px-6 py-3 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
      >
        {loading ? 'Sending...' : 'Send Overdue Reminders'}
      </button>

      {result && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
          <p className="text-green-800">
            ✅ Sent {result.sent} reminders to {result.total} customers with overdue balances
          </p>
        </div>
      )}

      <div className="mt-4 text-sm text-gray-600">
        <p><strong>Reminder Schedule:</strong></p>
        <ul className="list-disc ml-5 mt-2 space-y-1">
          <li>Level 1: 7+ days overdue</li>
          <li>Level 2: 30+ days overdue</li>
          <li>Level 3: 60+ days overdue (Final Notice)</li>
        </ul>
      </div>
    </div>
  )
}