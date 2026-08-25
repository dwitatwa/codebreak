import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { fetchDocs } from '../api'
import type { DocMeta } from '../docs-meta'

export const TYPE_DOT: Record<string, string> = {
  changes: 'bg-emerald-400',
  commit: 'bg-sky-400',
  file: 'bg-violet-400',
  description: 'bg-amber-400',
  note: 'bg-rose-400',
}

export function TypeDot({ type }: { type: string }) {
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${TYPE_DOT[type] ?? 'bg-zinc-500'}`}
      title={type}
    />
  )
}

export function TypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    changes: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30',
    commit: 'bg-sky-500/10 text-sky-300 ring-sky-500/30',
    file: 'bg-violet-500/10 text-violet-300 ring-violet-500/30',
    description: 'bg-amber-500/10 text-amber-300 ring-amber-500/30',
    note: 'bg-rose-500/10 text-rose-300 ring-rose-500/30',
  }
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${
        styles[type] ?? 'bg-zinc-800 text-zinc-400 ring-zinc-700'
      }`}
    >
      {type}
    </span>
  )
}

/** 'YYYY-MM-DD' → Today / Yesterday / N days ago / 'Aug 12, 2026' */
export function relativeDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffDays = Math.floor(
    (startOfToday.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) /
      86_400_000,
  )
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const FILTERS = ['all', 'changes', 'commit', 'file', 'description', 'note'] as const

export default function Sidebar() {
  const [docs, setDocs] = useState<DocMeta[]>([])
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<string>('all')
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('cb-sidebar') === 'collapsed')
  const location = useLocation()

  useEffect(() => {
    let alive = true
    fetchDocs()
      .then((list) => alive && setDocs(list))
      .catch((err) => alive && setError(String(err)))
    // re-fetch on page change (e.g. right after a new document is created)
    return () => {
      alive = false
    }
  }, [location.pathname])

  const toggleCollapse = (): void => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('cb-sidebar', next ? 'collapsed' : 'open')
  }

  const counts = new Map<string, number>()
  for (const doc of docs) counts.set(doc.type, (counts.get(doc.type) ?? 0) + 1)

  const searching = query.trim() !== ''
  const q = query.trim().toLowerCase()
  const visible = docs.filter((doc) => {
    if (filter !== 'all' && doc.type !== filter) return false
    if (!searching) return true
    return (
      doc.title.toLowerCase().includes(q) ||
      doc.source.toLowerCase().includes(q) ||
      doc.slug.toLowerCase().includes(q)
    )
  })

  const groups = new Map<string, DocMeta[]>()
  for (const doc of visible) {
    const key = searching ? 'Results' : relativeDate(doc.date)
    const list = groups.get(key) ?? []
    list.push(doc)
    groups.set(key, list)
  }

  if (collapsed) {
    return (
      <aside className="sticky top-0 flex h-screen w-14 shrink-0 flex-col items-center border-r border-zinc-800 bg-zinc-900 py-4">
        <Link to="/" className="mb-4 rounded-md p-1 hover:bg-zinc-800" title="Home">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-emerald-500/15 text-sm font-bold text-emerald-400">
            c
          </div>
        </Link>
        <button
          onClick={toggleCollapse}
          className="rounded-md p-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
          title="Expand sidebar"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </aside>
    )
  }

  return (
    <aside className="sticky top-0 flex h-screen w-72 shrink-0 flex-col border-r border-zinc-800 bg-zinc-900">
      <div className="flex items-center justify-between px-4 pt-4">
        <Link to="/" className="block rounded-md px-1 py-0.5 hover:opacity-80">
          <div className="text-lg font-bold tracking-tight">
            code<span className="text-emerald-400">break</span>
          </div>
          <div className="-mt-0.5 text-[11px] text-neutral-500">code explanation documents</div>
        </Link>
        <button
          onClick={toggleCollapse}
          className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
          title="Collapse sidebar"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="px-4 pb-3 pt-3">
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500"
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents…"
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 py-1.5 pl-8 pr-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
          />
        </div>

        {!searching && (
          <div className="mt-3 flex flex-wrap gap-1">
            {FILTERS.map((f) => {
              const active = filter === f
              const count = f === 'all' ? docs.length : (counts.get(f) ?? 0)
              return (
                <button
                  key={f}
                  onClick={() => setFilter(active ? 'all' : f)}
                  className={`rounded border px-1.5 py-0.5 text-[11px] capitalize transition-colors ${
                    active
                      ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                  }`}
                >
                  {f} · {count}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-6 cb-scroll">
        {error && <p className="px-2 py-3 text-sm text-red-400">{error}</p>}
        {!error && visible.length === 0 && (
          <p className="px-2 py-3 text-sm text-zinc-500">
            {searching || filter !== 'all' ? 'No matching documents.' : 'No documents yet.'}
          </p>
        )}
        {[...groups.entries()].map(([label, items]) => (
          <div key={label} className="mt-4">
            <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
              {label}
            </div>
            {items.map((doc) => {
              const active = location.pathname === `/doc/${doc.slug}`
              return (
                <Link
                  key={doc.slug}
                  to={`/doc/${doc.slug}`}
                  className={`mb-0.5 flex items-center gap-2 rounded-md border-l-2 py-1.5 pl-2 pr-1 text-sm transition-colors ${
                    active
                      ? 'border-emerald-400 bg-emerald-500/10 text-emerald-200'
                      : 'border-transparent text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200'
                  }`}
                >
                  <TypeDot type={doc.type} />
                  <span className="truncate">{truncateTitle(doc.title)}</span>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
    </aside>
  )
}

function truncateTitle(title: string): string {
  return title.length > 34 ? `${title.slice(0, 33)}…` : title
}
