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
      className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${TYPE_DOT[type] ?? 'bg-slate-500'}`}
      title={type}
    />
  )
}

export function TypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    changes: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/25',
    commit: 'bg-sky-500/10 text-sky-300 ring-sky-500/25',
    file: 'bg-violet-500/10 text-violet-300 ring-violet-500/25',
    description: 'bg-amber-500/10 text-amber-300 ring-amber-500/25',
    note: 'bg-rose-500/10 text-rose-300 ring-rose-500/25',
  }
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${
        styles[type] ?? 'bg-slate-800 text-slate-400 ring-slate-700'
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
      <aside className="sticky top-0 flex h-screen w-14 shrink-0 flex-col items-center border-r border-slate-800/70 bg-[#161720] py-5">
        <Link to="/" className="mb-6 rounded-md p-1 hover:bg-slate-800/60" title="Home">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-sm font-bold text-emerald-400">
            c
          </div>
        </Link>
        <button
          onClick={toggleCollapse}
          className="rounded-md p-2 text-slate-500 hover:bg-slate-800/60 hover:text-slate-200"
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
    <aside className="sticky top-0 flex h-screen w-72 shrink-0 flex-col border-r border-slate-800/70 bg-[#161720]">
      {/* Brand + collapse */}
      <div className="flex items-center justify-between px-5 pt-5">
        <Link to="/" className="block rounded-md px-0.5 py-0.5 hover:opacity-90">
          <div className="text-[17px] font-semibold tracking-tight text-slate-100">
            code<span className="text-emerald-400">break</span>
          </div>
          <div className="-mt-0.5 text-[11px] font-normal text-slate-500">
            code explanation documents
          </div>
        </Link>
        <button
          onClick={toggleCollapse}
          className="rounded-md p-1.5 text-slate-600 hover:bg-slate-800/60 hover:text-slate-300"
          title="Collapse sidebar"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Search */}
      <div className="px-4 pb-3 pt-4">
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
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
            placeholder="Search…"
            className="w-full rounded-lg border border-slate-800/80 bg-[#11131b] py-2 pl-9 pr-3 text-[13px] text-slate-200 placeholder:text-slate-600 transition-colors focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
          />
        </div>

        {/* Type filters */}
        {!searching && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {FILTERS.map((f) => {
              const active = filter === f
              const count = f === 'all' ? docs.length : (counts.get(f) ?? 0)
              return (
                <button
                  key={f}
                  onClick={() => setFilter(active ? 'all' : f)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium capitalize transition-all ${
                    active
                      ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/40'
                      : 'text-slate-500 hover:bg-slate-800/50 hover:text-slate-300'
                  }`}
                >
                  {f}
                  <span className="ml-1 opacity-60">{count}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Document list */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-8 cb-scroll">
        {error && <p className="px-3 py-4 text-sm text-rose-400">{error}</p>}
        {!error && visible.length === 0 && (
          <div className="px-3 py-10 text-center">
            <p className="text-sm text-slate-600">
              {searching || filter !== 'all' ? 'No matching documents.' : 'No documents yet.'}
            </p>
          </div>
        )}
        {[...groups.entries()].map(([label, items]) => (
          <div key={label} className="mt-5 first:mt-2">
            <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
              {label}
            </div>
            {items.map((doc) => {
              const active = location.pathname === `/doc/${doc.slug}`
              return (
                <Link
                  key={doc.slug}
                  to={`/doc/${doc.slug}`}
                  className={`group mb-1 flex items-center gap-2.5 rounded-lg py-2 pl-2.5 pr-2 text-[13px] transition-colors ${
                    active
                      ? 'bg-emerald-500/10 text-emerald-200'
                      : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                  }`}
                >
                  <span
                    className={`h-0.5 w-0.5 shrink-0 rounded-full ${TYPE_DOT[doc.type] ?? 'bg-slate-500'}`}
                  />
                  <span className="truncate leading-snug">{truncateTitle(doc.title)}</span>
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
  return title.length > 32 ? `${title.slice(0, 31)}…` : title
}
