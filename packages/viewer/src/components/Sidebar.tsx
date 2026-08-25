import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { fetchDocs } from '../api'
import type { DocMeta } from '../docs-meta'

/* ── Type → color (mapped into the green palette via opacity) ──────────────── */

export const TYPE_COLOR: Record<string, string> = {
  changes: '#2a835f',
  commit: '#8bbb92',
  file: '#4a9d7e',
  description: '#6ba889',
  note: '#3d7060',
}

export function TypeBadge({ type }: { type: string }) {
  const hex = TYPE_COLOR[type] ?? '#4d7268'
  return (
    <span
      className="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em]"
      style={{ backgroundColor: `${hex}1a`, color: hex, boxShadow: `inset 0 0 0 1px ${hex}40` }}
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

/* ── A single logbook entry ────────────────────────────────────────────────── */

function Entry({ doc, active }: { doc: DocMeta; active: boolean }) {
  const hex = TYPE_COLOR[doc.type] ?? '#4d7268'
  return (
    <Link
      to={`/doc/${doc.slug}`}
      className="group block rounded-lg px-3 py-2.5 transition-colors"
      style={active ? { backgroundColor: `${hex}1a` } : undefined}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.backgroundColor = 'rgba(139,187,146,0.06)'
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.backgroundColor = 'transparent'
      }}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full transition-opacity"
          style={{ backgroundColor: hex, opacity: active ? 1 : 0.5 }}
        />
        <span
          className="flex-1 truncate text-[13px] font-medium leading-snug transition-colors"
          style={{
            color: active ? '#e8f4f0' : 'var(--color-text)',
          }}
        >
          {doc.title}
        </span>
      </div>
      {doc.source && (
        <p className="mt-1 truncate pl-4 text-[11px]" style={{ color: 'var(--color-text-faint)' }}>
          {doc.source}
        </p>
      )}
    </Link>
  )
}

/* ── Sticky date divider ──────────────────────────────────────────────────── */

function DateDivider({ label }: { label: string }) {
  return (
    <div
      className="sticky top-0 z-10 -mx-3 mb-1 mt-4 px-3 py-1.5 first:mt-0"
      style={{ backgroundColor: 'var(--color-panel)' }}
    >
      <div className="flex items-center gap-2">
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: 'var(--color-text-faint)' }}
        >
          {label}
        </span>
        <span className="h-px flex-1" style={{ backgroundColor: 'var(--color-border-subtle)' }} />
      </div>
    </div>
  )
}

/* ── Main sidebar ─────────────────────────────────────────────────────────── */

export default function Sidebar() {
  const [docs, setDocs] = useState<DocMeta[]>([])
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
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

  const searching = query.trim() !== ''
  const q = query.trim().toLowerCase()
  const visible = docs.filter((doc) => {
    if (!searching) return true
    return (
      doc.title.toLowerCase().includes(q) ||
      doc.source.toLowerCase().includes(q) ||
      doc.slug.toLowerCase().includes(q)
    )
  })

  const groups = useMemo(() => {
    const map = new Map<string, DocMeta[]>()
    for (const doc of visible) {
      const key = searching ? 'Results' : relativeDate(doc.date)
      const list = map.get(key) ?? []
      list.push(doc)
      map.set(key, list)
    }
    return map
  }, [visible, searching])

  const lastUpdated = docs[0]?.date
  const statusLine = `${docs.length} ${docs.length === 1 ? 'entry' : 'entries'}${
    lastUpdated ? ` · last ${relativeDate(lastUpdated).toLowerCase()}` : ''
  }`

  /* ── Collapsed rail ──────────────────────────────────────────────────────── */
  if (collapsed) {
    return (
      <aside
        className="sticky top-0 flex h-screen w-14 shrink-0 flex-col items-center py-5"
        style={{ backgroundColor: 'var(--color-panel)', borderRight: '1px solid var(--color-border)' }}
      >
        <Link to="/" className="mb-6 rounded-md p-1 hover:bg-white/5" title="Home">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold"
            style={{ backgroundColor: 'rgba(42,131,95,0.2)', color: 'var(--color-highlight)' }}
          >
            c
          </div>
        </Link>
        <button
          onClick={toggleCollapse}
          className="rounded-md p-2 transition-colors hover:bg-white/5"
          style={{ color: 'var(--color-text-faint)' }}
          title="Expand"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div
          className="mt-auto rotate-180 text-[10px] uppercase tracking-[0.2em] [writing-mode:vertical-rl]"
          style={{ color: 'var(--color-text-faint)' }}
        >
          {statusLine}
        </div>
      </aside>
    )
  }

  /* ── Expanded panel ─────────────────────────────────────────────────────── */
  return (
    <aside
      className="sticky top-0 flex h-screen w-80 shrink-0 flex-col"
      style={{ backgroundColor: 'var(--color-panel)', borderRight: '1px solid var(--color-border)' }}
    >
      {/* Editorial header */}
      <div className="flex items-start justify-between px-5 pt-5">
        <div>
          <Link
            to="/"
            className="text-[15px] font-semibold tracking-tight hover:opacity-90"
            style={{ color: '#e8f4f0' }}
          >
            code<span style={{ color: 'var(--color-highlight)' }}>break</span>
          </Link>
          <div
            className="mt-0.5 text-[10px] uppercase tracking-[0.1em]"
            style={{ color: 'var(--color-text-faint)' }}
          >
            {statusLine}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSearchOpen((v) => !v)}
            className="rounded-md p-1.5 transition-colors hover:bg-white/5"
            style={{
              color: searchOpen ? 'var(--color-highlight)' : 'var(--color-text-faint)',
            }}
            title="Search"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
            </svg>
          </button>
          <button
            onClick={toggleCollapse}
            className="rounded-md p-1.5 transition-colors hover:bg-white/5"
            style={{ color: 'var(--color-text-faint)' }}
            title="Collapse"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expandable search */}
      {searchOpen && (
        <div className="px-4 pt-3">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && (setSearchOpen(false), setQuery(''))}
            placeholder="Search title, source, slug…"
            className="w-full rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-1"
            style={{
              backgroundColor: 'var(--color-inset)',
              border: '1px solid var(--color-border-subtle)',
              color: 'var(--color-text)',
              // @ts-expect-error CSS custom prop
              '--tw-ring-color': 'var(--color-accent)',
            }}
          />
        </div>
      )}

      {/* The logbook stream */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-8 cb-scroll">
        {error && (
          <p className="px-3 py-4 text-sm" style={{ color: '#e87878' }}>
            {error}
          </p>
        )}

        {!error && visible.length === 0 && (
          <div className="px-3 py-16 text-center">
            <div
              className="mx-auto mb-3 h-8 w-8 rounded-full"
              style={{ border: '1px solid var(--color-border)' }}
            />
            <p className="text-[13px]" style={{ color: 'var(--color-text-faint)' }}>
              {searching ? 'Nothing matches.' : 'Your logbook is empty.'}
            </p>
            {!searching && (
              <p className="mt-1 text-[11px]" style={{ color: 'var(--color-text-faint)', opacity: 0.6 }}>
                Run a command to start understanding code.
              </p>
            )}
          </div>
        )}

        {[...groups.entries()].map(([label, items]) => (
          <div key={label}>
            <DateDivider label={label} />
            {items.map((doc) => (
              <Entry key={doc.slug} doc={doc} active={location.pathname === `/doc/${doc.slug}`} />
            ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}
