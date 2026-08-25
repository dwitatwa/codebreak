import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { fetchDocs, type DocMeta } from '../api'

export const TYPE_BADGE: Record<string, string> = {
  changes: 'bg-emerald-100 text-emerald-700',
  commit: 'bg-sky-100 text-sky-700',
  file: 'bg-violet-100 text-violet-700',
  description: 'bg-amber-100 text-amber-700',
  note: 'bg-rose-100 text-rose-700',
}

export function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        TYPE_BADGE[type] ?? 'bg-neutral-200 text-neutral-600'
      }`}
    >
      {type}
    </span>
  )
}

export default function Sidebar() {
  const [docs, setDocs] = useState<DocMeta[]>([])
  const [error, setError] = useState<string | null>(null)
  const location = useLocation()

  useEffect(() => {
    let alive = true
    fetchDocs()
      .then((list) => alive && setDocs(list))
      .catch((err) => alive && setError(String(err)))
    // refresh daftar saat pindah halaman (mis. dokumen baru dibuat)
    return () => {
      alive = false
    }
  }, [location.pathname])

  const groups = new Map<string, DocMeta[]>()
  for (const doc of docs) {
    const list = groups.get(doc.date) ?? []
    list.push(doc)
    groups.set(doc.date, list)
  }

  return (
    <aside className="w-72 shrink-0 border-r border-neutral-200 bg-white">
      <Link to="/" className="block px-5 py-4 hover:bg-neutral-50">
        <div className="text-lg font-bold tracking-tight">
          code<span className="text-emerald-600">break</span>
        </div>
        <div className="text-xs text-neutral-500">dokumen penjelasan kode</div>
      </Link>

      <nav className="max-h-[calc(100vh-5rem)] overflow-y-auto px-3 pb-6">
        {error && <p className="px-2 py-3 text-sm text-red-600">{error}</p>}
        {!error && docs.length === 0 && (
          <p className="px-2 py-3 text-sm text-neutral-500">
            Belum ada dokumen. Jalankan{' '}
            <code className="rounded bg-neutral-100 px-1">codebreak explain --changes</code> di repo
            Anda.
          </p>
        )}
        {[...groups.entries()].map(([date, items]) => (
          <div key={date} className="mt-4">
            <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              {date}
            </div>
            {items.map((doc) => {
              const active = location.pathname === `/doc/${doc.slug}`
              return (
                <Link
                  key={doc.slug}
                  to={`/doc/${doc.slug}`}
                  className={`mb-0.5 block rounded-md px-2 py-1.5 text-sm transition-colors ${
                    active ? 'bg-emerald-50 text-emerald-800' : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  <span className="mr-1.5 inline-block align-middle">
                    <TypeBadge type={doc.type} />
                  </span>
                  <span className="align-middle">{truncateTitle(doc.title)}</span>
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
