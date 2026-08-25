import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchDocHtml, fetchDocs, type DocMeta } from '../api'
import { TypeBadge } from '../components/Sidebar'

interface TocItem {
  id: string
  text: string
  level: number
}

function DocSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-7 w-1/3 rounded bg-zinc-900" />
      <div className="h-4 w-full rounded bg-zinc-900" />
      <div className="h-4 w-5/6 rounded bg-zinc-900" />
      <div className="mt-8 h-40 w-full rounded-lg bg-zinc-900" />
      <div className="h-4 w-2/3 rounded bg-zinc-900" />
    </div>
  )
}

export default function DocPage() {
  const { slug = '' } = useParams()
  const [html, setHtml] = useState<string | null>(null)
  const [compileError, setCompileError] = useState<string | null>(null)
  const [rawContent, setRawContent] = useState<string>('')
  const [meta, setMeta] = useState<DocMeta | null>(null)
  const [toc, setToc] = useState<TocItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showTop, setShowTop] = useState(false)
  const articleRef = useRef<HTMLElement>(null)

  useEffect(() => {
    let alive = true
    setHtml(null)
    setCompileError(null)
    setRawContent('')
    setToc([])

    fetchDocs()
      .then((list) => {
        if (alive) setMeta(list.find((d) => d.slug === slug) ?? null)
      })
      .catch(() => {})

    fetchDocHtml(slug).then((doc) => {
      if (!alive) return
      if (!doc.ok) {
        setCompileError(doc.error ?? 'The document module is empty.')
        void loadRaw(slug).then((raw) => alive && setRawContent(raw))
      } else {
        setHtml(doc.html)
      }
    })

    return () => {
      alive = false
    }
  }, [slug])

  // TOC is read from the DOM after the document HTML renders (rehype-slug assigns heading ids)
  useLayoutEffect(() => {
    if (html === null || !articleRef.current) return
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
  }, [html])

  // Scroll-spy + back-to-top button
  useEffect(() => {
    if (html === null) return
    let raf = 0
    const onScroll = (): void => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        setShowTop(window.scrollY > 500)
        const root = articleRef.current
        if (!root) return
        let current: string | null = null
        for (const h of Array.from(root.querySelectorAll('h2[id], h3[id]'))) {
          if (h.getBoundingClientRect().top <= 130) current = h.id
          else break
        }
        setActiveId(current)
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [html])

  return (
    <div className="flex">
      <article ref={articleRef} className="mx-auto min-w-0 max-w-3xl flex-1 px-8 py-6">
        {/* Sticky header */}
        {(meta || html !== null) && (
          <div className="sticky top-0 z-10 -mx-8 mb-6 border-b border-zinc-800/80 bg-zinc-950/85 px-8 py-3 backdrop-blur">
            <div className="flex items-center gap-2">
              <Link
                to="/"
                className="rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                title="All documents"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              {meta && <TypeBadge type={meta.type} />}
              {meta && <span className="text-xs text-zinc-600">{meta.date}</span>}
            </div>
            {meta && <h1 className="mt-1 truncate text-base font-semibold tracking-tight">{meta.title}</h1>}
          </div>
        )}

        {!html && !compileError && <DocSkeleton />}

        {compileError && (
          <>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
              This document could not be compiled as MDX (usually a stray{' '}
              <code>&lt;</code> character in the LLM output). Showing the raw text instead.
            </div>
            <pre className="cb-raw mt-4 whitespace-pre-wrap rounded-lg border border-zinc-800 bg-neutral-950 p-5 font-mono text-sm leading-relaxed text-zinc-200">
              {rawContent || compileError}
            </pre>
          </>
        )}

        {html !== null && (
          <div
            id="doc-body"
            className="prose prose-invert max-w-none prose-headings:scroll-mt-28 prose-pre:border prose-pre:border-zinc-800"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </article>

      {/* Table of contents */}
      {toc.length > 1 && (
        <nav className="sticky top-0 hidden h-screen w-60 shrink-0 overflow-y-auto border-l border-zinc-800 px-4 py-16 lg:block cb-scroll">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
            On this page
          </div>
          {toc.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={(e) => {
                e.preventDefault()
                document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' })
              }}
              className={`block border-l-2 py-0.5 text-sm transition-colors ${
                item.level === 3 ? 'pl-5' : 'pl-2'
              } ${
                activeId === item.id
                  ? 'border-emerald-400 font-medium text-emerald-300'
                  : 'border-transparent text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
              }`}
            >
              {item.text}
            </a>
          ))}
        </nav>
      )}

      {/* Back to top */}
      {showTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-500/25 transition-transform hover:-translate-y-0.5 hover:bg-emerald-400"
          title="Back to top"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  )
}

/** Raw text endpoint for the UI fallback when MDX compilation fails */
async function loadRaw(slug: string): Promise<string> {
  const res = await fetch(`/api/docs?raw=${encodeURIComponent(slug)}`)
  if (!res.ok) throw new Error('could not load raw content')
  return res.text()
}
