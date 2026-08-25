import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowUp } from 'lucide-react'
import { fetchDocHtml, fetchDocs, type DocMeta } from '../api'
import { TypeBadge } from '../components/Sidebar'
import FileSource from '../components/FileSource'

interface TocItem {
  id: string
  text: string
  level: number
}

function DocSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-7 w-1/3 rounded" style={{ backgroundColor: 'var(--color-panel)', opacity: 0.5 }} />
      <div className="h-4 w-full rounded" style={{ backgroundColor: 'var(--color-panel)', opacity: 0.5 }} />
      <div className="h-4 w-5/6 rounded" style={{ backgroundColor: 'var(--color-panel)', opacity: 0.5 }} />
      <div className="mt-8 h-40 w-full rounded-lg" style={{ backgroundColor: 'var(--color-panel)', opacity: 0.5 }} />
      <div className="h-4 w-2/3 rounded" style={{ backgroundColor: 'var(--color-panel)', opacity: 0.5 }} />
    </div>
  )
}

export default function DocPage() {
  const { slug = '' } = useParams()
  const [html, setHtml] = useState<string | null>(null)
  const [compileError, setCompileError] = useState<string | null>(null)
  const [rawContent, setRawContent] = useState<string>('')
  const [meta, setMeta] = useState<DocMeta | null>(null)
  const [files, setFiles] = useState<string[]>([])
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
        setFiles(doc.files ?? [])
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

  // Noted-line hover: show the note as a floating tooltip on the code line
  useEffect(() => {
    if (html === null) return
    const root = articleRef.current
    if (!root) return

    const tooltip = document.createElement('div')
    tooltip.className = 'cb-tooltip'
    document.body.appendChild(tooltip)

    const show = (el: HTMLElement): void => {
      const note = el.dataset.note
      if (!note) return
      tooltip.innerHTML = note.replace(/</g, '&lt;')
      tooltip.classList.add('cb-tooltip--visible')
      const rect = el.getBoundingClientRect()
      const tt = tooltip.getBoundingClientRect()
      let left = rect.left
      let top = rect.bottom + 6
      // clamp to viewport
      if (left + tt.width > window.innerWidth - 8) left = window.innerWidth - tt.width - 8
      if (left < 8) left = 8
      if (top + tt.height > window.innerHeight - 8) top = rect.top - tt.height - 6
      if (top < 8) top = 8
      tooltip.style.left = `${left}px`
      tooltip.style.top = `${top}px`
    }
    const hide = (): void => tooltip.classList.remove('cb-tooltip--visible')

    const onOver = (e: Event): void => {
      const el = (e.target as HTMLElement).closest('.cb-code-line--noted') as HTMLElement | null
      if (el) show(el)
      else hide()
    }
    const onOut = (): void => hide()

    root.addEventListener('mouseover', onOver)
    root.addEventListener('mouseleave', onOut)
    return () => {
      root.removeEventListener('mouseover', onOver)
      root.removeEventListener('mouseleave', onOut)
      tooltip.remove()
    }
  }, [html])

  // Sort blocks within each file section by their line range (ascending),
  // so the document reads top-to-bottom like the file itself.
  useEffect(() => {
    if (html === null) return
    const root = articleRef.current
    if (!root) return

    const byStart = (a: Element, b: Element): number =>
      Number(a.getAttribute('data-line-start') ?? Infinity) -
      Number(b.getAttribute('data-line-start') ?? Infinity)

    // Group sibling blocks that belong to the same file section: the <h3>
    // heading acts as the section boundary.
    let section: { h3: Element; blocks: Element[] } | null = null
    const sections: { h3: Element; blocks: Element[] }[] = []
    for (const el of Array.from(root.querySelectorAll('h3[id], .cb-block'))) {
      if (el.tagName === 'H3') {
        section = { h3: el, blocks: [] }
        sections.push(section)
      } else if (section && el.classList.contains('cb-block')) {
        section.blocks.push(el)
      }
    }
    for (const s of sections) {
      if (s.blocks.length < 2) continue
      const sorted = [...s.blocks].sort(byStart)
      const same = sorted.every((b, i) => b === s.blocks[i])
      if (same) continue
      s.blocks.forEach((b) => b.remove())
      // re-insert after the h3 heading, in sorted order
      for (const b of sorted) s.h3.after(b)
    }
  }, [html])

  return (
    <div className="flex">
      <article ref={articleRef} className="mx-auto min-w-0 max-w-3xl flex-1 px-8 py-6">
        {/* Sticky header */}
        {(meta || html !== null) && (
          <div
            className="sticky top-0 z-10 -mx-8 mb-6 px-8 py-3 backdrop-blur"
            style={{
              borderBottom: '1px solid var(--color-border-subtle)',
              backgroundColor: 'color-mix(in srgb, var(--color-bg) 85%, transparent)',
            }}
          >
            <div className="flex items-center gap-2">
              <Link
                to="/"
                className="rounded p-1 transition-colors hover:bg-white/5"
                style={{ color: 'var(--color-text-faint)' }}
                title="All documents"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              {meta && <TypeBadge type={meta.type} />}
              {meta && (
                <span className="text-xs" style={{ color: 'var(--color-text-faint)' }}>
                  {meta.date}
                </span>
              )}
            </div>
            {meta && (
              <h1 className="mt-1 truncate text-base font-semibold tracking-tight" style={{ color: '#e8eaed' }}>
                {meta.title}
              </h1>
            )}
          </div>
        )}

        {!html && !compileError && <DocSkeleton />}

        {compileError && (
          <>
            <div
              className="rounded-lg p-4 text-sm"
              style={{
                backgroundColor: 'rgba(232,120,120,0.1)',
                border: '1px solid rgba(232,120,120,0.3)',
                color: '#e8a0a0',
              }}
            >
              This document could not be compiled as MDX (usually a stray{' '}
              <code>&lt;</code> character in the LLM output). Showing the raw text instead.
            </div>
            <pre
              className="cb-raw mt-4 whitespace-pre-wrap rounded-lg p-5 font-mono text-sm leading-relaxed"
              style={{
                backgroundColor: 'var(--color-inset)',
                border: '1px solid var(--color-border-subtle)',
                color: 'var(--color-text)',
              }}
            >
              {rawContent || compileError}
            </pre>
          </>
        )}

        {html !== null && (
          <>
            <div
              id="doc-body"
              className="prose prose-invert max-w-none prose-headings:scroll-mt-28"
              dangerouslySetInnerHTML={{ __html: html }}
            />

            {/* Full source of each referenced file */}
            {files.length > 0 && (
              <div className="mt-8 border-t pt-5" style={{ borderColor: 'var(--color-border-subtle)' }}>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-faint)' }}>
                  Source files
                </div>
                <div className="space-y-2">
                  {files.map((f) => (
                    <FileSource key={f} path={f} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </article>

      {/* Table of contents */}
      {toc.length > 1 && (
        <nav
          className="sticky top-0 hidden h-screen w-60 shrink-0 overflow-y-auto px-4 py-16 lg:block cb-scroll"
          style={{ borderLeft: '1px solid var(--color-border-subtle)' }}
        >
          <div
            className="mb-2 text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--color-text-faint)' }}
          >
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
                item.level === 3 ? 'pl-5' : 'pl-2 font-medium'
              }`}
              style={
                activeId === item.id
                  ? {
                      borderColor: 'var(--color-accent)',
                      color: 'var(--color-highlight)',
                    }
                  : {
                      borderColor: 'transparent',
                      color: 'var(--color-text-faint)',
                    }
              }
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
          className="fixed bottom-6 right-6 z-20 flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition-transform hover:-translate-y-0.5"
          style={{
            backgroundColor: 'var(--color-accent)',
            color: 'var(--color-bg)',
            boxShadow: '0 4px 20px rgba(113,90,90,0.3)',
          }}
          title="Back to top"
        >
          <ArrowUp size={16} />
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
