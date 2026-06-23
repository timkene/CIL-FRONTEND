'use client'
import { useState, useRef, useEffect, useCallback } from 'react'

export interface ComboOption {
  code: string
  name: string
}

interface SearchComboBoxProps {
  code: string
  name: string
  onSelect: (code: string, name: string) => void
  fetchOptions: (q: string) => Promise<ComboOption[]>
  placeholder?: string
  error?: boolean
  disabled?: boolean
  className?: string
}

export function SearchComboBox({
  code, name, onSelect, fetchOptions,
  placeholder = 'Search…', error = false, disabled = false, className = '',
}: SearchComboBoxProps) {
  const [query,     setQuery]     = useState(name)
  const [options,   setOptions]   = useState<ComboOption[]>([])
  const [open,      setOpen]      = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({})

  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef     = useRef<HTMLInputElement>(null)

  useEffect(() => { setQuery(name) }, [name])

  function calcDropPos() {
    if (!inputRef.current) return
    const r = inputRef.current.getBoundingClientRect()
    setDropStyle({
      position: 'fixed',
      top:    r.bottom + 2,
      left:   r.left,
      width:  Math.max(r.width, 280),
      zIndex: 9999,
    })
  }

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setOptions([]); setOpen(false); return }
    setLoading(true)
    try {
      const results = await fetchOptions(q)
      setOptions(results)
      if (results.length > 0) {
        calcDropPos()
        setOpen(true)
      } else {
        setOpen(false)
      }
      setActiveIdx(-1)
    } catch {
      setOptions([])
    } finally {
      setLoading(false)
    }
  }, [fetchOptions])

  function handleInput(q: string) {
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(q), 250)
  }

  function handleSelect(opt: ComboOption) {
    setQuery(opt.name)
    setOpen(false)
    setOptions([])
    onSelect(opt.code, opt.name)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, options.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); handleSelect(options[activeIdx]) }
    if (e.key === 'Escape') setOpen(false)
  }

  useEffect(() => {
    function onOut(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    // Close when table scrolls so the dropdown doesn't float away from its anchor
    function onScroll() { setOpen(false) }
    document.addEventListener('mousedown', onOut)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onOut)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [])

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Code badge */}
      <div className={`text-[10px] font-mono font-bold mb-0.5 ${code ? 'text-slate-600' : 'text-slate-300'}`}>
        {code || '—'}
      </div>
      {/* Name search input */}
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => handleInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (query.length >= 2) { calcDropPos(); search(query) } }}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full text-xs border rounded px-1.5 py-0.5 focus:outline-none focus:border-[#137fec] transition-colors ${
          error   ? 'border-rose-400 bg-rose-50/40' :
          'border-transparent hover:border-slate-200'
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-transparent' : 'bg-transparent'}`}
      />
      {/* Dropdown — position:fixed escapes overflow-x:auto table clipping */}
      {open && (
        <div
          style={dropStyle}
          className="max-h-56 overflow-y-auto bg-white rounded-lg shadow-xl border border-slate-200"
        >
          {loading ? (
            <div className="px-3 py-2 text-xs text-slate-400">Searching…</div>
          ) : (
            options.map((opt, i) => (
              <div
                key={`${opt.code}-${i}`}
                onMouseDown={() => handleSelect(opt)}
                className={`px-3 py-2 cursor-pointer flex items-start gap-2 text-xs transition-colors ${
                  i === activeIdx ? 'bg-[#137fec]/10 text-[#137fec]' : 'hover:bg-slate-50'
                }`}
              >
                <span className="font-mono font-bold text-slate-500 shrink-0 pt-0.5">{opt.code}</span>
                <span className="text-slate-700 leading-tight">{opt.name}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
