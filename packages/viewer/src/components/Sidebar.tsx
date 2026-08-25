import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Search, Code2, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { fetchDocs } from '../api'
import type { DocMeta } from '../docs-meta'

/* ── Type → color (mapped into the palette) ───────────────────────────────── */

export const TYPE_COLOR: Record<string, string> = {
  changes: '#c4a8a8',
  commit: '#d3dad9',
  file: '#9a8e8e',
  description: '#b0a4a4',
  note: '#8a7a7a',
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
  return (
    <Link
      to={`/doc/${doc.slug}`}
      className="block rounded-lg px-3 py-2.5 transition-colors"
      style={active ? { backgroundColor: 'rgba(113,90,90,0.15)' } : undefined}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.backgroundColor = 'rgba(211,218,217,0.06)'
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.backgroundColor = 'transparent'
      }}
    >
      <span
        className="block truncate text-[13px] font-medium leading-snug"
        style={{ color: active ? '#e8eaed' : 'var(--color-text)' }}
      >
        {doc.title}
      </span>
      {doc.source && (
        <span className="mt-0.5 block truncate text-[11px]" style={{ color: 'var(--color-text-faint)' }}>
          {doc.source}
        </span>
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
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('cb-sidebar') === 'collapsed')
  const location = useLocation()
  const searchRef = useRef<HTMLInputElement>(null)
  const isMac = typeof navigator !== 'undefined' && /Mac|iP(hone|ad|od)/.test(navigator.platform)

  useEffect(() => {
    let alive = true
    fetchDocs()
      .then((list) => alive && setDocs(list))
      .catch((err) => alive && setError(String(err)))
    return () => {
      alive = false
    }
  }, [location.pathname])

  // ⌘K / Ctrl+K focuses search; '/' also focuses when not typing in an input
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (
        e.key === '/' &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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
          <Code2 size={16} strokeWidth={2.2} style={{ color: 'var(--color-highlight)' }} />
        </Link>
        <button
          onClick={toggleCollapse}
          className="rounded-md p-2 transition-colors hover:bg-white/5"
          style={{ color: 'var(--color-text-faint)' }}
          title="Expand sidebar"
        >
          <PanelLeftOpen size={16} />
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
      {/* Header: icon + wordmark row */}
      <div className="flex items-center justify-between px-4 pb-3 pt-4">
        <Link to="/" className="flex items-center gap-2 hover:opacity-90">
          <Code2
            size={16}
            strokeWidth={2.2}
            className="shrink-0 text-[var(--color-highlight)]"
          />
          <span
            className="text-[15px] font-semibold leading-none tracking-tight"
            style={{ color: '#e8eaed' }}
          >
            code<span style={{ color: 'var(--color-highlight)' }}>break</span>
          </span>
        </Link>
        <button
          onClick={toggleCollapse}
          className="rounded-md p-1.5 transition-colors hover:bg-white/5"
          style={{ color: 'var(--color-text-faint)' }}
          title="Collapse sidebar"
        >
          <PanelLeftClose size={15} />
        </button>
      </div>

      {/* Search */}
      <div className="px-4 pb-3">
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]"
          />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setQuery('')
                searchRef.current?.blur()
              }
            }}
            placeholder="Search the logbook…"
            className="w-full rounded-lg py-2 pl-9 pr-16 text-[13px] focus:outline-none focus:ring-1"
            style={{
              backgroundColor: 'var(--color-inset)',
              border: '1px solid var(--color-border-subtle)',
              color: 'var(--color-text)',
              // @ts-expect-error -- CSS custom property
              '--tw-ring-color': 'var(--color-accent)',
            }}
          />
          <kbd
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-[10px] font-medium"
            style={{ backgroundColor: 'rgba(211,218,217,0.08)', color: 'var(--color-text-faint)' }}
          >
            {isMac ? '⌘K' : 'Ctrl K'}
          </kbd>
        </div>
      </div>

      {/* The logbook stream */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-8 cb-scroll">
        {error && (
          <p className="px-3 py-4 text-sm" style={{ color: '#e8a0a0' }}>
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
