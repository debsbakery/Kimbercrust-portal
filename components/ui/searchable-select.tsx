'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, ChevronDown, X } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
  sublabel?: string
  badge?: string
}

// ── Category grouping helper ──────────────────────────────────────────────────
// ✅ Already correct from earlier — double check it reads:
const CATEGORIES = [
  { label: '🎂 Cakes', min: 1000, max: 1999 },
  { label: '🍞 Bread', min: 2000, max: 2750 },
  { label: '🥖 Rolls', min: 2751, max: 3750 },
  { label: '🥧 Pies',  min: 3751, max: 4000 },
  { label: '🧁 Other', min: 4001, max: Infinity },
]

function groupOptions(options: SelectOption[]) {
  return CATEGORIES
    .map(cat => ({
      label: cat.label,
      items: options.filter(o => {
        const n = Number(o.badge ?? o.value)
        return n >= cat.min && n <= cat.max
      }),
    }))
    .filter(cat => cat.items.length > 0)
}
// ─────────────────────────────────────────────────────────────────────────────

interface SearchableSelectProps {
  options:      SelectOption[]
  value?:       string
  onChange:     (value: string, option: SelectOption) => void
  placeholder?: string
  label?:       string
  disabled?:    boolean
  className?:   string
  required?:    boolean
  name?:        string
  grouped?:     boolean   // ← NEW: enables category grouping
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Search...',
  label,
  disabled = false,
  className = '',
  required,
  name,
  grouped = false,        // ← default off — fully backwards compatible
}: SearchableSelectProps) {
  const [open,  setOpen]  = useState(false)
  const [query, setQuery] = useState('')
  const containerRef      = useRef<HTMLDivElement>(null)
  const inputRef          = useRef<HTMLInputElement>(null)

  const selected = options.find((o) => o.value === value)

  // Filter by search query
  const filtered = query.trim() === ''
    ? options
    : options.filter((o) => {
        const q = query.toLowerCase()
        return (
          o.label.toLowerCase().includes(q) ||
          (o.sublabel ?? '').toLowerCase().includes(q) ||
          (o.badge ?? '').toLowerCase().includes(q)
        )
      })

  // When searching, flatten even in grouped mode
  const isSearching = query.trim() !== ''
  const groups = (!isSearching && grouped) ? groupOptions(filtered) : null

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  function handleSelect(opt: SelectOption) {
    onChange(opt.value, opt)
    setOpen(false)
    setQuery('')
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange('', { value: '', label: '' })
    setQuery('')
  }

  // Reusable option row
  function OptionRow({ opt }: { opt: SelectOption }) {
    return (
      <button
        key={opt.value}
        type="button"
        onClick={() => handleSelect(opt)}
        className={`
          w-full text-left px-3 py-2.5 text-sm hover:bg-green-50
          flex items-center gap-2 border-b border-gray-50
          transition-colors
          ${opt.value === value ? 'bg-green-50 font-medium' : ''}
        `}
      >
        {opt.badge && (
          <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 shrink-0 min-w-[2.5rem] text-center">
            {opt.badge}
          </span>
        )}
        <span className="flex flex-col min-w-0">
          <span className="truncate font-medium">{opt.label}</span>
          {opt.sublabel && (
            <span className="text-xs text-gray-400 truncate">{opt.sublabel}</span>
          )}
        </span>
      </button>
    )
  }

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {name && <input type="hidden" name={name} value={value ?? ''} />}

      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className={`
          w-full flex items-center justify-between gap-2
          border rounded-md px-3 py-2 text-sm text-left
          bg-white hover:border-gray-400 transition-colors
          focus:outline-none focus:ring-2 focus:ring-offset-1
          ${disabled ? 'bg-gray-50 cursor-not-allowed text-gray-400' : 'cursor-pointer'}
          ${open ? 'border-green-600 ring-2 ring-green-200' : 'border-gray-300'}
        `}
        style={open ? { borderColor: '#ffffff' } : {}}
      >
        <span className="flex-1 truncate">
          {selected ? (
            <span className="flex items-center gap-2">
              {selected.badge && (
                <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                  {selected.badge}
                </span>
              )}
              {selected.label}
            </span>
          ) : (
            <span className="text-gray-400">{placeholder}</span>
          )}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {selected && !disabled && (
            <span
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
            >
              <X className="h-3 w-3" />
            </span>
          )}
          <ChevronDown
            className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-72 flex flex-col">
          {/* Search input */}
          <div className="p-2 border-b sticky top-0 bg-white">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type to search..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border rounded focus:outline-none focus:ring-1"
              />
            </div>
          </div>

          {/* Options list */}
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-gray-400 text-center">
                No results for &ldquo;{query}&rdquo;
              </div>

            ) : groups ? (
              // ── GROUPED MODE ──────────────────────────────────────────
              groups.map(group => (
                <div key={group.label}>
                  {/* Category header */}
                  <div className="px-3 py-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-200 sticky top-0">
                    {group.label}
                    <span className="ml-2 font-normal normal-case text-gray-400">
                      ({group.items.length})
                    </span>
                  </div>
                  {group.items.map(opt => (
                    <OptionRow key={opt.value} opt={opt} />
                  ))}
                </div>
              ))

            ) : (
              // ── FLAT MODE (default / when searching) ─────────────────
              filtered.map(opt => (
                <OptionRow key={opt.value} opt={opt} />
              ))
            )}
          </div>

          {/* Result count when searching */}
          {query && (
            <div className="px-3 py-1.5 text-xs text-gray-400 border-t bg-gray-50">
              {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}
    </div>
  )
}