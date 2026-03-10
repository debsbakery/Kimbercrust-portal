'use client'

import { useState } from 'react'
import { Download, Loader2, Calendar, Mail, MailX, RefreshCw } from 'lucide-react'

interface BatchInvoiceGeneratorProps {
  availableDates: string[]
}

function getBrisbaneToday(): string {
  const brisbane = new Date(Date.now() + 10 * 60 * 60 * 1000)
  return brisbane.toISOString().split('T')[0]
}

export default function BatchInvoiceGenerator({ availableDates }: BatchInvoiceGeneratorProps) {
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [customDate,   setCustomDate]   = useState<string>(getBrisbaneToday())
  const [sendEmails,   setSendEmails]   = useState(false)
  const [emailOnly,    setEmailOnly]    = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [result,       setResult]       = useState<any>(null)

  const activeDate = selectedDate || customDate

  const handleGenerateBatch = async () => {
    if (!activeDate) {
      alert('Please select a date')
      return
    }

    const confirmMsg = emailOnly
      ? 'This will RESEND invoice emails to all customers for this date. Continue?'
      : sendEmails
        ? 'This will generate invoices AND send emails to all customers. Continue?'
        : null

    if (confirmMsg && !confirm(confirmMsg)) return

    setIsGenerating(true)
    setResult(null)

    try {
      const response = await fetch('/api/admin/batch-invoice', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delivery_date: activeDate,
          sendEmails:    emailOnly ? true : sendEmails,
          emailOnly,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate batch invoices')
      }

      setResult(data)

    } catch (error: any) {
      console.error('Batch invoice error:', error)
      setResult({ success: false, error: error.message })
    } finally {
      setIsGenerating(false)
    }
  }

  const formatAusDate = (dateStr: string) => {
    try {
      return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', {
        weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-6">

      <h2 className="text-xl font-semibold">Select Delivery Date</h2>

      {/* Dropdown */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Choose from existing order dates
        </label>
        <select
          value={selectedDate}
          onChange={(e) => { setSelectedDate(e.target.value); setCustomDate('') }}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 text-sm"
        >
          <option value="">-- Select a date --</option>
          {availableDates.map((date) => (
            <option key={date} value={date}>{formatAusDate(date)}</option>
          ))}
        </select>
      </div>

      {/* Manual date — defaults to Brisbane today */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Or enter any date manually
        </label>
        <input
          type="date"
          value={customDate}
          onChange={(e) => { setCustomDate(e.target.value); setSelectedDate('') }}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 text-sm"
        />
      </div>

      {/* Email toggle */}
      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border">
        <button
          type="button"
          onClick={() => { setSendEmails(!sendEmails); if (emailOnly) setEmailOnly(false) }}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            sendEmails ? 'bg-green-600' : 'bg-gray-300'
          }`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            sendEmails ? 'translate-x-6' : 'translate-x-1'
          }`} />
        </button>
        <div className="flex items-center gap-2">
          {sendEmails
            ? <Mail  className="h-4 w-4 text-green-600" />
            : <MailX className="h-4 w-4 text-gray-400"  />
          }
          <span className="text-sm font-medium">
{sendEmails ? 'Invoice with emails' : 'Invoice — no emails'}
          </span>
        </div>
      </div>

      {/* Resend emails toggle — only show after invoicing done */}
      <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
        <button
          type="button"
          onClick={() => { setEmailOnly(!emailOnly); if (!emailOnly) setSendEmails(false) }}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            emailOnly ? 'bg-amber-500' : 'bg-gray-300'
          }`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            emailOnly ? 'translate-x-6' : 'translate-x-1'
          }`} />
        </button>
        <div className="flex items-center gap-2">
          <RefreshCw className={`h-4 w-4 ${emailOnly ? 'text-amber-600' : 'text-gray-400'}`} />
          <div>
            <p className="text-sm font-medium">
              {emailOnly ? 'Resend mode — emails only, no new invoices' : 'Resend emails only'}
            </p>
            <p className="text-xs text-gray-500">
              Use this if invoices were generated but emails were not sent
            </p>
          </div>
        </div>
      </div>

      {/* Active date display */}
      {activeDate && (
        <div className={`p-3 rounded-lg text-sm border ${
          emailOnly
            ? 'bg-amber-50 border-amber-200'
            : 'bg-green-50 border-green-200'
        }`}>
          <span className={`font-medium ${emailOnly ? 'text-amber-800' : 'text-green-800'}`}>
            {emailOnly ? 'Resending emails for: ' : 'Selected: '}
            {formatAusDate(activeDate)}
          </span>
          {sendEmails && !emailOnly && (
            <span className="ml-2 text-green-600">+ sending emails</span>
          )}
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={handleGenerateBatch}
        disabled={!activeDate || isGenerating}
        className={`w-full py-3 rounded-lg text-white font-semibold transition-opacity
          disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
        style={{ backgroundColor: emailOnly ? '#d97706' : '#2c2c2c' }}
      >
        {isGenerating ? (
          <><Loader2 className="h-4 w-4 animate-spin" />Processing...</>
        ) : emailOnly ? (
          <><RefreshCw className="h-4 w-4" />Resend Emails for {activeDate ? formatAusDate(activeDate) : '...'}</>
        ) : (
          <><Download className="h-4 w-4" />Generate Invoices for {activeDate ? formatAusDate(activeDate) : '...'}</>
        )}
      </button>

      {/* Result */}
      {result && (
        <div className={`p-4 rounded-lg border text-sm ${
          result.success
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {result.success ? (
            <div className="space-y-1">
              <p className="font-semibold">
                {result.resend_mode ? 'Email resend complete' : 'Batch invoicing complete'}
              </p>
              {!result.resend_mode && <p>Orders invoiced: {result.invoiced}</p>}
              <p>Total amount: ${Number(result.total_amount ?? 0).toFixed(2)}</p>
              {result.emails_sent !== undefined && (
                <p>Emails sent: {result.emails_sent}</p>
              )}
              {result.email_errors && result.email_errors.length > 0 && (
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
                  <p className="font-medium">Email errors:</p>
                  {result.email_errors.map((err: string, i: number) => (
                    <p key={i} className="text-xs">{err}</p>
                  ))}
                </div>
              )}
              {result.invoiced === 0 && !result.resend_mode && (
                <p className="text-gray-600">No pending orders found for this date.</p>
              )}
            </div>
          ) : (
            <p>Error: {result.error}</p>
          )}
        </div>
      )}

      {/* Quick select grid */}
      {availableDates.length > 0 && (
        <div className="border-t pt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Quick Select</h3>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
            {availableDates.slice(0, 10).map((date) => (
              <button
                key={date}
                onClick={() => { setSelectedDate(date); setCustomDate('') }}
                className={`p-3 text-sm rounded-lg border-2 transition-all ${
                  activeDate === date
                    ? 'border-green-600 bg-green-50 text-green-800 font-semibold'
                    : 'border-gray-200 hover:border-green-400 hover:bg-gray-50'
                }`}
              >
                <Calendar className="h-4 w-4 mx-auto mb-1" />
                {formatAusDate(date)}
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}