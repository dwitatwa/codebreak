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

      const docMatch = /^\/api\/doc\/(.+)$/.exec(url.pathname)
      if (docMatch?.[1]) {
        const slug = decodeURIComponent(docMatch[1])
        const raw = readDocFile(docsDir, slug)
        if (raw === null) return json({ ok: false, error: 'document not found' }, 404)

        const { frontmatter, body } = splitFrontmatter(raw)
        const rendered = await renderDoc(body)
        return json({ ...rendered, frontmatter })
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
