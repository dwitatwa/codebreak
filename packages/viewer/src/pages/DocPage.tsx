import { useEffect, useLayoutEffect, useRef, useState, type ComponentType } from 'react'
import { useParams } from 'react-router-dom'
import { fetchDocs, loadDocModule, type DocMeta } from '../api'
import { TypeBadge } from '../components/Sidebar'

interface TocItem {
  id: string
  text: string
  level: number
}

export default function DocPage() {
  const { slug = '' } = useParams()
  const [Comp, setComp] = useState<ComponentType | null>(null)
  const [compileError, setCompileError] = useState<string | null>(null)
  const [rawContent, setRawContent] = useState<string>('')
  const [meta, setMeta] = useState<DocMeta | null>(null)
  const [toc, setToc] = useState<TocItem[]>([])
  const articleRef = useRef<HTMLElement>(null)

  useEffect(() => {
    let alive = true
    setComp(null)
    setCompileError(null)
    setRawContent('')
    setToc([])

    fetchDocs()
      .then((list) => {
        if (alive) setMeta(list.find((d) => d.slug === slug) ?? null)
      })
      .catch(() => {})

    loadDocModule(slug).then((mod) => {
      if (!alive) return
      if (mod.__error || !mod.default) {
        setCompileError(mod.__error ?? 'Modul dokumen kosong.')
        void loadRaw(slug).then((raw) => alive && setRawContent(raw))
      } else {
        setComp(() => mod.default)
      }
    })

    return () => {
      alive = false
    }
  }, [slug])

  // TOC dibaca dari DOM setelah MDX ter-render (rehype-slug memberi id heading)
  useLayoutEffect(() => {
    if (!Comp || !articleRef.current) return
    const headings = articleRef.current.querySelectorAll('h2[id], h3[id]')
    const items: TocItem[] = []
    headings.forEach((h) => {
      items.push({
        id: h.id,
        text: h.textContent ?? '',
        level: h.tagName === 'H2' ? 2 : 3,
      })
    })
    setToc(items)
  }, [Comp])

  return (
    <div className="flex">
      <article ref={articleRef} className="mx-auto min-w-0 max-w-3xl flex-1 px-8 py-10">
        {meta && (
          <header className="mb-6 border-b border-neutral-200 pb-4">
            <div className="flex items-center gap-2">
              <TypeBadge type={meta.type} />
              <span className="text-xs text-neutral-400">{meta.date}</span>
            </div>
            <h1 className="mt-2 text-xl font-bold tracking-tight">{meta.title}</h1>
          </header>
        )}

        {!Comp && !compileError && <p className="text-neutral-500">Menyiapkan dokumen…</p>}

        {compileError && (
          <>
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
              Dokumen ini tidak bisa dikompilasi sebagai MDX (biasanya karena karakter{' '}
              <code>&lt;</code> liar dari output LLM). Ditampilkan sebagai teks mentah.
            </div>
            <pre className="cb-raw mt-4 whitespace-pre-wrap rounded-lg bg-neutral-900 p-5 text-sm leading-relaxed text-neutral-100">
              {rawContent || compileError}
            </pre>
          </>
        )}

        {Comp && (
          <div className="prose prose-neutral max-w-none prose-pre:bg-neutral-900 prose-pre:text-neutral-100">
            <Comp />
          </div>
        )}
      </article>

      {toc.length > 1 && (
        <nav className="sticky top-0 hidden h-screen w-60 shrink-0 overflow-y-auto border-l border-neutral-200 px-4 py-10 lg:block">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            Daftar isi
          </div>
          {toc.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={(e) => {
                e.preventDefault()
                document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' })
              }}
              className={`block border-l-2 border-transparent py-0.5 text-sm text-neutral-500 hover:border-emerald-400 hover:text-emerald-700 ${
                item.level === 3 ? 'pl-5' : 'pl-2 font-medium'
              }`}
            >
              {item.text}
            </a>
          ))}
        </nav>
      )}
    </div>
  )
}

/** Endpoint teks mentah untuk fallback — dilayani middleware /api/docs?raw=<slug> */
async function loadRaw(slug: string): Promise<string> {
  const res = await fetch(`/api/docs?raw=${encodeURIComponent(slug)}`)
  if (!res.ok) throw new Error('tidak bisa memuat konten mentah')
  return res.text()
}
