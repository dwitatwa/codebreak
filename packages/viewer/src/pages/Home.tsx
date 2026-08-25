import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchDocs, type DocMeta } from '../api'
import { relativeDate } from '../components/Sidebar'
import { TypeDot, TypeBadge } from '../components/Sidebar'

const TYPE_ORDER = ['changes', 'commit', 'file', 'description', 'note'] as const

function Skeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 rounded-lg bg-zinc-900" />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-lg bg-zinc-900" />
        ))}
      </div>
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

  if (loading) return <div className="mx-auto max-w-4xl px-8 py-10"><Skeleton /></div>
  if (error) return <div className="p-10 text-red-400">{error}</div>

  const counts = new Map<string, number>()
  for (const doc of docs) counts.set(doc.type, (counts.get(doc.type) ?? 0) + 1)

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
      <p className="mt-1 text-sm text-zinc-500">
        LLM-written explanations of changes, commits, files, and feature descriptions in this repo.
      </p>

      {docs.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-zinc-800 bg-zinc-900/50 p-8 text-center">
          <p className="text-zinc-400">No documents yet.</p>
          <pre className="mx-auto mt-4 max-w-md rounded-lg bg-zinc-950 p-4 text-left text-xs leading-relaxed text-emerald-300 ring-1 ring-zinc-800">
{`codebreak explain --changes
codebreak explain --commit HEAD
codebreak explain src/auth/
codebreak explain "user authentication flow"`}
          </pre>
          <p className="mt-3 text-xs text-neutral-500">
            New documents appear here automatically — no refresh needed.
          </p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-4 py-3">
              <div className="text-2xl font-bold text-emerald-300">{docs.length}</div>
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">total</div>
            </div>
            {TYPE_ORDER.filter((t) => (counts.get(t) ?? 0) > 0).map((t) => (
              <div key={t} className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3">
                <div className="flex items-center gap-1.5 text-xl font-semibold text-zinc-200">
                  <TypeDot type={t} />
                  {counts.get(t)}
                </div>
                <div className="text-[11px] capitalize tracking-wide text-zinc-500">{t}</div>
              </div>
            ))}
          </div>

          {/* Recent documents */}
          <h2 className="mb-3 mt-10 text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Recent
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {docs.map((doc) => (
              <Link
                key={doc.slug}
                to={`/doc/${doc.slug}`}
                className="group rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 transition-all hover:-translate-y-0.5 hover:border-emerald-500/40 hover:bg-zinc-900"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <TypeBadge type={doc.type} />
                    <span className="text-xs text-zinc-600">{relativeDate(doc.date)}</span>
                  </div>
                  <span className="text-zinc-700 transition-colors group-hover:text-emerald-400">→</span>
                </div>
                <div className="mt-2 truncate font-medium text-zinc-100">{doc.title}</div>
                <p className="truncate text-sm text-zinc-500">{doc.source}</p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
