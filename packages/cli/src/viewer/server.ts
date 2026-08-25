import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { listDocs, readDocFile, splitFrontmatter } from './docs.js'
import { renderDoc } from './render-docs.js'
import { ASSETS } from './assets.generated.ts'

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
}

/** Resolve repo root from the docs dir (.codebreak/docs → repo root) */
function repoRootFromDocsDir(docsDir: string): string {
  return path.dirname(path.dirname(docsDir))
}

/** Protect against path traversal: the resolved path must stay inside the repo */
function safeRepoPath(root: string, rel: string): string | null {
  const resolved = path.resolve(root, rel)
  if (!resolved.startsWith(root + path.sep) && resolved !== root) return null
  return resolved
}

/**
 * Dev mode: manifest belum digenerate → layani shell dari dist-static/ di disk.
 * Dicari dengan menelusuri ke atas dari lokasi modul (tahan perubahan layout bundel).
 */
let staticRootCache: string | null | undefined
function findStaticRoot(): string | null {
  staticRootCache ??= (() => {
    let cur = path.dirname(fileURLToPath(import.meta.url))
    for (let i = 0; i < 6; i += 1) {
      for (const rel of ['packages/viewer/dist-static', 'dist-static']) {
        const candidate = path.join(cur, rel)
        if (fs.existsSync(path.join(candidate, 'index.html'))) return candidate
      }
      const parent = path.dirname(cur)
      if (parent === cur) return null
      cur = parent
    }
    return null
  })()
  return staticRootCache
}

function readAssetFromDisk(key: string): string | null {
  const root = findStaticRoot()
  if (!root) return null
  // cegah path traversal
  const abs = path.resolve(root, key)
  if (!abs.startsWith(root)) return null
  try {
    return fs.readFileSync(abs, 'utf8')
  } catch {
    return null
  }
}

export interface ViewerServerOptions {
  docsDir: string
  port?: number
}

export interface ViewerServer {
  url: string
  stop(): void
}

/**
 * Web viewer lokal untuk dokumen .codebreak/docs — berjalan in-process
 * di atas Bun.serve (tanpa Vite/Node di runtime).
 *
 * - `/` & `/assets/*`   : frontend shell statis dari asset manifest
 * - `/api/docs`         : metadata semua dokumen (?raw=<slug> untuk teks mentah)
 * - `/api/doc/<slug>`   : MDX dikompilasi on-demand menjadi HTML string
 * - `/events`           : SSE — dokumen baru/berubah memicu reload browser
 */
export function startViewerServer(opts: ViewerServerOptions): ViewerServer {
  const { docsDir } = opts
  const enc = new TextEncoder()
  const sseClients = new Set<ReadableStreamDefaultController>()

  const broadcastReload = (): void => {
    for (const controller of sseClients) {
      try {
        controller.enqueue(enc.encode('event: reload\ndata: {}\n\n'))
      } catch {
        sseClients.delete(controller)
      }
    }
  }

  // Hot reload: pantau folder dokumen dengan debounce kecil.
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  const watcher = fs.watch(docsDir, () => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(broadcastReload, 120)
  })

  const json = (data: unknown, status = 200): Response =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'content-type': 'application/json' },
    })

  const server = Bun.serve({
    port: opts.port ?? 5173,
    async fetch(req) {
      const url = new URL(req.url)

      if (url.pathname === '/events') {
        let registered: ReadableStreamDefaultController | undefined
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(enc.encode(': connected\n\n'))
            registered = controller
            sseClients.add(controller)
          },
          cancel() {
            if (registered) sseClients.delete(registered)
          },
        })
        return new Response(stream, {
          headers: {
            'content-type': 'text/event-stream',
            'cache-control': 'no-cache',
            connection: 'keep-alive',
          },
        })
      }

      if (url.pathname === '/api/docs') {
        const rawSlug = url.searchParams.get('raw')
        if (rawSlug) {
          const raw = readDocFile(docsDir, decodeURIComponent(rawSlug))
          if (raw === null) return new Response('(document not found)', { status: 404 })
          return new Response(raw, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
        }
        return json(listDocs(docsDir))
      }

      // /api/file?path=src/auth/login.ts → the file's current source (line-numbered
      // rendering happens client-side; we serve the raw text safely).
      if (url.pathname === '/api/file') {
        const rel = url.searchParams.get('path')
        if (!rel) return json({ error: 'missing path' }, 400)
        const root = repoRootFromDocsDir(docsDir)
        const abs = safeRepoPath(root, rel)
        if (!abs) return json({ error: 'invalid path' }, 400)
        let content: string
        try {
          content = fs.readFileSync(abs, 'utf8')
        } catch {
          return json({ error: 'file not found' }, 404)
        }
        return json({ path: rel, content })
      }

      const docMatch = /^\/api\/doc\/(.+)$/.exec(url.pathname)
      if (docMatch?.[1]) {
        const slug = decodeURIComponent(docMatch[1])
        const raw = readDocFile(docsDir, slug)
        if (raw === null) return json({ ok: false, error: 'document not found' }, 404)

        const { frontmatter, body } = splitFrontmatter(raw)
        const rendered = await renderDoc(body)
        // Extract file paths referenced by the document (### path/to/file.ext headings)
        const files = extractDocFiles(body)
        return json({ ...rendered, frontmatter, files })
      }

      // Static shell — disk first (freshest during development), then the
      // embedded manifest (what compiled binaries rely on).
      const key = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1))
      const body = readAssetFromDisk(key) ?? ASSETS[key]
      if (body !== undefined) {
        const ext = key.slice(key.lastIndexOf('.'))
        return new Response(body, {
          headers: {
            'content-type': MIME[ext] ?? 'application/octet-stream',
            'cache-control': 'no-cache',
          },
        })
      }

      // SPA fallback: any path that isn't an API route or a static asset
      // (e.g. /doc/some-slug) gets index.html so React Router can handle it.
      // This makes direct-refresh on deep links work.
      const indexBody = readAssetFromDisk('index.html') ?? ASSETS['index.html']
      if (indexBody !== undefined) {
        return new Response(indexBody, {
          headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' },
        })
      }

      return new Response('not found', { status: 404 })
    },
  })

  return {
    url: server.url.toString(),
    stop() {
      watcher.close()
      server.stop(true)
    },
  }
}

/**
 * Extract file paths referenced by a document body.
 * The document contract uses "### path/to/file.ext" headings per file discussed.
 * We skip headings that are clearly not file paths (e.g. "## Summary").
 */
export function extractDocFiles(body: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const re = /^###\s+(.+?)\s*$/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) {
    const raw = m[1]?.trim()
    if (!raw) continue
    // A plausible file path: has an extension, no spaces, not a section label
    if (!/\.\w{1,6}$/.test(raw)) continue
    if (/\s/.test(raw)) continue
    if (raw.startsWith('/') || raw.startsWith('\\')) continue
    const clean = raw.replace(/^\.\//, '')
    if (!seen.has(clean)) {
      seen.add(clean)
      out.push(clean)
    }
  }
  return out
}
