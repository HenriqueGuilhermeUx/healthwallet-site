'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, Pill, Loader2, AlertTriangle } from 'lucide-react'
import { api, type Medicamento } from '@/lib/api'

type Props = {
  value: Medicamento | null
  onChange: (med: Medicamento | null, label: string) => void
  placeholder?: string
  disabled?: boolean
}

/**
 * Autocomplete de medicamento com debounce 300ms.
 * Mostra tarja + nome comercial + princípio ativo + concentração.
 * Fallback: se o usuário digitar e não encontrar nada, ele pode usar texto livre
 * (a propriedade onChange recebe label mesmo com med=null).
 */
export function MedicationAutocomplete({ value, onChange, placeholder, disabled }: Props) {
  const [query, setQuery] = useState(value?.nome_comercial || '')
  const [results, setResults] = useState<Medicamento[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const list = await api.searchMedications(query, 20)
        setResults(list)
        setOpen(true)
        setHighlight(0)
      } catch (e) {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  function pickMed(med: Medicamento) {
    onChange(med, med.nome_comercial)
    setQuery(med.nome_comercial)
    setOpen(false)
  }

  function pickFreeText() {
    onChange(null, query)
    setOpen(false)
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); onChange(null, e.target.value) }}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={(e) => {
            if (!open) return
            if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, results.length)) }
            if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)) }
            if (e.key === 'Enter') {
              e.preventDefault()
              if (results[highlight]) pickMed(results[highlight])
              else if (query.length >= 2) pickFreeText()
            }
            if (e.key === 'Escape') setOpen(false)
          }}
          placeholder={placeholder || 'Buscar remédio (nome comercial ou princípio ativo)…'}
          disabled={disabled}
          className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm disabled:bg-gray-50"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
        )}
      </div>

      {open && (results.length > 0 || query.length >= 2) && (
        <div className="absolute z-20 mt-1 w-full max-h-80 overflow-auto bg-white border border-gray-200 rounded-lg shadow-lg">
          {results.length === 0 && !loading && (
            <button
              type="button"
              onClick={pickFreeText}
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2"
            >
              <Pill className="w-4 h-4 text-gray-400" />
              <span>Usar <strong>"{query}"</strong> como texto livre (não consta do catálogo)</span>
            </button>
          )}
          {results.map((med, i) => (
            <button
              key={med.id}
              type="button"
              onClick={() => pickMed(med)}
              onMouseEnter={() => setHighlight(i)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 ${i === highlight ? 'bg-emerald-50' : ''}`}
            >
              <div className="flex items-start gap-2">
                <Pill className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">
                    {med.nome_comercial}{med.concentracao ? ` ${med.concentracao}` : ''}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {med.principio_ativo && <>Princípio ativo: {med.principio_ativo}</>}
                    {med.laboratorio && <> • {med.laboratorio}</>}
                  </div>
                  {(med.tarja || med.regime_controlado) && (
                    <div className="flex items-center gap-2 mt-1">
                      {med.tarja && med.tarja !== 'sem_tarja' && (
                        <span className="text-[10px] uppercase font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                          {med.tarja.replace('_', ' ')}
                        </span>
                      )}
                      {med.regime_controlado && (
                        <span className="text-[10px] uppercase font-semibold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Controlado
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
