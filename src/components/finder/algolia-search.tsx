'use client'

import { useState, useTransition } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { algoliasearch } from 'algoliasearch'
import type { Tender } from '@/lib/types'

const APP_ID = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID ?? ''
const SEARCH_KEY = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY ?? ''

// Returns null if not configured — component hides gracefully
const searchClient = APP_ID && SEARCH_KEY ? algoliasearch(APP_ID, SEARCH_KEY) : null

interface AlgoliaSearchProps {
  uid: string
  onSelectTender?: (tender: Tender) => void
}

export function AlgoliaSearch({ uid, onSelectTender }: AlgoliaSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Tender[]>([])
  const [isPending, startTransition] = useTransition()

  // Don't render if Algolia not configured
  if (!searchClient) return null

  const handleSearch = (q: string) => {
    setQuery(q)
    if (!q.trim()) {
      setResults([])
      return
    }

    startTransition(async () => {
      try {
        const response = await searchClient.searchSingleIndex({
          indexName: 'tendersarthi_tenders',
          searchParams: {
            query: q,
            filters: `userId:${uid}`,
            attributesToRetrieve: ['name', 'gemId', 'category', 'state', 'status'],
            hitsPerPage: 10,
          },
        })
        setResults((response.hits as unknown as Tender[]) || [])
      } catch {
        setResults([])
      }
    })
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
        <Input
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search your saved tenders..."
          className="pl-9 pr-9"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('')
              setResults([])
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-navy"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {results.length > 0 && (
        <div className="border border-navy/10 rounded-xl overflow-hidden">
          {results.map((r, i) => (
            <button
              key={r.id ?? String(i)}
              onClick={() => onSelectTender?.(r)}
              className="w-full text-left px-4 py-3 hover:bg-navy/5 border-b border-navy/5 last:border-0 transition-colors"
            >
              <p className="text-sm font-medium text-navy truncate">{r.name}</p>
              <p className="text-xs text-muted mt-0.5">{r.category} · {r.state}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
