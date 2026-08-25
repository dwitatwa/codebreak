import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { fetchDocs, type DocMeta } from '../api'
import { relativeDate, TypeBadge, TYPE_COLOR } from '../components/Sidebar'

const TYPE_ORDER = ['changes', 'commit', 'file', 'description', 'note'] as const

function HomeSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-lg p-4"
          style={{ backgroundColor: 'var(--color-panel)' }}
        >
          <div className="mb-2 h-3 w-1/3 rounded" style={{ backgroundColor: 'var(--color-inset)' }} />
          <div className="mb-1 h-4 w-3/4 rounded" style={{ backgroundColor: 'var(--color-inset)' }} />
          <div className="h-3 w-1/2 rounded" style={{ backgroundColor: 'var(--color-inset)' }} />
        </div>
      ))}
    </div>
  )
}

export default function Home() {
  const [docs, setDocs] = useState<DocMeta[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetchDocs()
      .then((list) => {
        if (!alive) return
        setDocs(list)
        setLoading(false)
      })
      .catch((err) => {
        if (!alive) return
        setError(String(err))
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-8 py-10">
        <div className="mb-2 h-7 w-1/3 animate-pulse rounded" style={{ backgroundColor: 'var(--color-panel)' }} />
        <div className="mb-8 h-4 w-1/2 animate-pulse rounded" style={{ backgroundColor: 'var(--color-panel)' }} />
        <HomeSkeleton />
      </div>
    )
  }
  if (error) return <div className="p-10" style={{ color: '#e8a0a0' }}>{error}</div>

  const counts = new Map<string, number>()
  for (const doc of docs) counts.set(doc.type, (counts.get(doc.type) ?? 0) + 1)

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#e8eaed' }}>
        Documents
      </h1>
      <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        LLM-written explanations of changes, commits, files, and feature descriptions in this repo.
      </p>

      {docs.length === 0 ? (
        <div
          className="mt-10 rounded-lg border border-dashed p-8 text-center"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <p style={{ color: 'var(--color-text-muted)' }}>No documents yet.</p>
          <pre
            className="mx-auto mt-4 max-w-md rounded-lg p-4 text-left text-xs leading-relaxed"
            style={{
              backgroundColor: 'var(--color-inset)',
              border: '1px solid var(--color-border-subtle)',
              color: 'var(--color-highlight)',
            }}
          >
{`codebreak explain --changes
codebreak explain --commit HEAD
codebreak explain src/auth/
codebreak explain "user authentication flow"`}
          </pre>
          <p className="mt-3 text-xs" style={{ color: 'var(--color-text-faint)' }}>
            New documents appear here automatically — no refresh needed.
          </p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div
              className="rounded-lg px-4 py-3"
              style={{
                backgroundColor: 'rgba(113,90,90,0.15)',
                border: '1px solid rgba(113,90,90,0.3)',
              }}
            >
              <div className="text-2xl font-bold" style={{ color: 'var(--color-highlight)' }}>
                {docs.length}
              </div>
              <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--color-text-faint)' }}>
                total
              </div>
            </div>
            {TYPE_ORDER.filter((t) => (counts.get(t) ?? 0) > 0).map((t) => (
              <div
                key={t}
                className="rounded-lg px-4 py-3"
                style={{
                  backgroundColor: 'var(--color-panel)',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                <div className="flex items-center gap-1.5 text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: TYPE_COLOR[t] ?? '#4d7268' }}
                  />
                  {counts.get(t)}
                </div>
                <div className="text-[11px] capitalize tracking-wide" style={{ color: 'var(--color-text-faint)' }}>
                  {t}
                </div>
              </div>
            ))}
          </div>

          {/* Recent documents */}
          <h2
            className="mb-3 mt-10 text-sm font-semibold uppercase tracking-wider"
            style={{ color: 'var(--color-text-faint)' }}
          >
            Recent
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {docs.map((doc) => (
              <Link
                key={doc.slug}
                to={`/doc/${doc.slug}`}
                className="group block rounded-lg p-4 transition-all hover:-translate-y-0.5"
                style={{
                  backgroundColor: 'var(--color-panel)',
                  border: '1px solid var(--color-border-subtle)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(113,90,90,0.5)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border-subtle)'
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <TypeBadge type={doc.type} />
                    <span className="text-xs" style={{ color: 'var(--color-text-faint)' }}>
                      {relativeDate(doc.date)}
                    </span>
                  </div>
                  <ArrowRight
                    size={14}
                    className="text-[var(--color-text-faint)] transition-colors group-hover:text-[var(--color-highlight)]"
                  />
                </div>
                <div className="mt-2 truncate font-medium" style={{ color: '#e8eaed' }}>
                  {doc.title}
                </div>
                <p className="truncate text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  {doc.source}
                </p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
