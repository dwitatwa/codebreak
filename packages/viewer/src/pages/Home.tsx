import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchDocs, type DocMeta } from '../api'
import { TypeBadge } from '../components/Sidebar'

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

  if (loading) return <div className="p-10 text-neutral-500">Loading…</div>
  if (error) return <div className="p-10 text-red-600">{error}</div>

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <h1 className="text-2xl font-bold tracking-tight">codebreak documents</h1>
      <p className="mt-1 text-sm text-neutral-500">
        LLM-written explanations of changes, commits, files, and feature descriptions in this repo.
      </p>

      {docs.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center">
          <p className="text-neutral-600">No documents yet.</p>
          <pre className="mx-auto mt-4 max-w-md rounded bg-neutral-900 p-4 text-left text-xs leading-relaxed text-emerald-300">
{`codebreak explain --changes
codebreak explain --commit HEAD
codebreak explain src/auth/
codebreak explain "user authentication flow"`}
          </pre>
          <p className="mt-3 text-xs text-neutral-400">
            New documents appear here automatically — no refresh needed.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {[...new Set(docs.map((d) => d.date))].map((date) => (
            <section key={date}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-400">
                {date}
              </h2>
              <div className="space-y-2">
                {docs
                  .filter((d) => d.date === date)
                  .map((doc) => (
                    <Link
                      key={doc.slug}
                      to={`/doc/${doc.slug}`}
                      className="block rounded-lg border border-neutral-200 bg-white px-5 py-4 transition-shadow hover:border-emerald-300 hover:shadow-sm"
                    >
                      <div className="flex items-center gap-2">
                        <TypeBadge type={doc.type} />
                        <span className="truncate font-medium">{doc.title}</span>
                      </div>
                      <p className="mt-1 truncate text-sm text-neutral-500">{doc.source}</p>
                    </Link>
                  ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
