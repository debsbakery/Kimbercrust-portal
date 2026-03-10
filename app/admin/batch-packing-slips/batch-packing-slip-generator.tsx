'use client'

import { useState } from 'react'
import { Printer, Loader2, Calendar, Thermometer } from 'lucide-react'

interface Props {
  availableDates: string[]
}

// ── Preset code ranges for packers ────────────────────────────────────────────
const CODE_RANGES = [
  { label: 'All Products',       min: 0,    max: 99999, color: 'gray' },
  { label: 'Cakes (1000-1999)',  min: 1000, max: 1999,  color: 'pink' },
  { label: 'Bread (2000-2750)',  min: 2000, max: 2750,  color: 'yellow' },
  { label: 'Rolls (2751-3750)', min: 2751, max: 3750,  color: 'orange' },
  { label: 'Pies — Fridge (3751-4000)', min: 3751, max: 4000, color: 'blue' },
  { label: 'Other (4001+)',      min: 4001, max: 99999, color: 'purple' },
]

export default function BatchPackingSlipGenerator({ availableDates }: Props) {
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [customDate,   setCustomDate]   = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [codeMin,      setCodeMin]      = useState<number>(0)
  const [codeMax,      setCodeMax]      = useState<number>(99999)
  const [rangeLabel,   setRangeLabel]   = useState<string>('All Products')

  const activeDate = selectedDate || customDate

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-AU', {
        weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  function selectRange(range: typeof CODE_RANGES[0]) {
    setCodeMin(range.min)
    setCodeMax(range.max)
    setRangeLabel(range.label)
  }

  const handleGenerate = async () => {
    if (!activeDate) {
      alert('Please select a date')
      return
    }

    setIsGenerating(true)

    try {
      const response = await fetch('/api/batch-packing-slips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date:    activeDate,
          codeMin: codeMin,
          codeMax: codeMax,
        }),
      })

      if (!response.ok) {
        const text = await response.text()
        alert(`Error ${response.status}: ${text}`)
        return
      }

      const blob = await response.blob()
      const url  = window.URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.target   = '_blank'
      a.rel      = 'noopener'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

    } catch (error: any) {
      console.error('Error:', error)
      alert(`Failed: ${error.message}`)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-6">

      {/* ── Date selection ── */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Select Delivery Date</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Choose from existing dates
            </label>
            <select
              value={selectedDate}
              onChange={(e) => { setSelectedDate(e.target.value); setCustomDate('') }}
              className="w-full px-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-green-500"
            >
              <option value="">-- Select a date --</option>
              {availableDates.map((date) => (
                <option key={date} value={date}>{formatDate(date)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Or enter date manually
            </label>
            <input
              type="date"
              value={customDate}
              onChange={(e) => { setCustomDate(e.target.value); setSelectedDate('') }}
              className="w-full px-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Quick date buttons */}
        {availableDates.length > 0 && (
          <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
            {availableDates.slice(0, 10).map((date) => (
              <button
                key={date}
                onClick={() => { setSelectedDate(date); setCustomDate('') }}
                className={`p-2 text-xs rounded-lg border-2 transition-all ${
                  activeDate === date
                    ? 'border-green-600 bg-green-50 text-green-800 font-semibold'
                    : 'border-gray-200 hover:border-green-400 hover:bg-gray-50'
                }`}
              >
                <Calendar className="h-3 w-3 mx-auto mb-1" />
                {formatDate(date)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Product code range ── */}
      <div className="border-t pt-6">
        <div className="flex items-center gap-2 mb-3">
          <Thermometer className="h-5 w-5 text-blue-600" />
          <h2 className="text-xl font-semibold">Product Range</h2>
          <span className="text-sm text-gray-500">— filter slips by product code</span>
        </div>

        {/* Preset buttons */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
          {CODE_RANGES.map((range) => (
            <button
              key={range.label}
              onClick={() => selectRange(range)}
              className={`px-3 py-2 rounded-lg border-2 text-sm font-medium text-left transition-all ${
                codeMin === range.min && codeMax === range.max
                  ? 'border-blue-600 bg-blue-50 text-blue-800'
                  : 'border-gray-200 hover:border-blue-400 bg-white text-gray-700'
              }`}
            >
              {range.label}
              {range.label.includes('Fridge') && (
                <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                  FRIDGE
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Custom range */}
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Min Code
            </label>
            <input
              type="number"
              value={codeMin}
              onChange={(e) => {
                setCodeMin(Number(e.target.value))
                setRangeLabel('Custom range')
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm
                         focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="pb-2 text-gray-400 font-bold">—</div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Max Code
            </label>
            <input
              type="number"
              value={codeMax}
              onChange={(e) => {
                setCodeMax(Number(e.target.value))
                setRangeLabel('Custom range')
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm
                         focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* ── Summary & generate ── */}
      {activeDate && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm space-y-1">
          <p className="font-medium text-green-800">
            Date: {formatDate(activeDate)}
          </p>
          <p className="text-green-700">
            Products: {rangeLabel} (codes {codeMin}–{codeMax === 99999 ? 'all' : codeMax})
          </p>
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={!activeDate || isGenerating}
        className="w-full py-3 rounded-lg text-white font-semibold transition-opacity
                   disabled:opacity-50 disabled:cursor-not-allowed
                   flex items-center justify-center gap-2"
        style={{ backgroundColor: '#1a1a1a' }}
      >
        {isGenerating ? (
          <><Loader2 className="h-4 w-4 animate-spin" />Generating...</>
        ) : (
          <><Printer className="h-4 w-4" />Generate Packing Slips — {rangeLabel}</>
        )}
      </button>

      <p className="text-xs text-gray-400 text-center">
        PDF will open in a new tab — press Ctrl+P to print
      </p>
    </div>
  )
}