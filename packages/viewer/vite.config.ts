import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'
import { compile } from '@mdx-js/mdx'
import remarkGfm from 'remark-gfm'
import remarkFrontmatter from 'remark-frontmatter'
import rehypeSlug from 'rehype-slug'
import rehypeShikiFromHighlighter from '@shikijs/rehype/core'
import { createHighlighter, type Highlighter } from 'shiki'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin, type ViteDevServer } from 'vite'

const dirname = path.dirname(fileURLToPath(import.meta.url))

function docsDir(): string {
  return process.env.CODEBREAK_DOCS_DIR ?? path.resolve(dirname, '../../.codebreak/docs')
}

export interface DocMeta {
  slug: string
  title: string
  type: string
  date: string
  source: string
}

function listDocs(): DocMeta[] {
  const dir = docsDir()
  let names: string[]
  try {
    names = fs.readdirSync(dir).filter((f) => f.endsWith('.mdx'))
  } catch {
    return []
  }

  const metas: DocMeta[] = []
  for (const name of names) {
    let raw: string
    try {
      raw = fs.readFileSync(path.join(dir, name), 'utf8')
    } catch {
      continue
    }
    const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw)
    if (!m?.[1]) continue
    try {
      const fm = (yaml.load(m[1]) ?? {}) as Record<string, unknown>
      metas.push({
        slug: name.replace(/\.mdx$/, ''),
        title: String(fm.title ?? name),
        type: String(fm.type ?? 'file'),
        date:
          fm.date instanceof Date ? fm.date.toISOString().slice(0, 10) : String(fm.date ?? ''),
        source: String(fm.source ?? ''),
      })
    } catch {
      // frontmatter rusak — lewati dari listing
    }
  }

  return metas.sort((a, b) => (b.date + b.slug).localeCompare(a.date + a.slug))
}

const VDOC_PREFIX = '/@codebreak-doc/'
const VIRTUAL_PREFIX = '\0codebreak-doc:'

let highlighterPromise: Promise<Highlighter> | undefined

function getHighlighter(): Promise<Highlighter> {
  highlighterPromise ??= createHighlighter({
    themes: ['github-dark'],
    langs: [
      'typescript', 'tsx', 'javascript', 'jsx', 'json', 'bash', 'shell',
      'python', 'go', 'rust', 'java', 'ruby', 'php', 'c', 'cpp', 'csharp',
      'swift', 'kotlin', 'html', 'css', 'scss', 'yaml', 'toml', 'markdown', 'sql', 'diff',
    ],
  })
  return highlighterPromise
}

/**
 * Plugin inti viewer:
 * - /api/docs          → metadata semua dokumen (JSON)
 * - /@codebreak-doc/*  → MDX dikompilasi on-the-fly jadi modul React
 * - watcher            → dokumen baru/berubah → hot reload browser
 */
function codebreakDocsPlugin(): Plugin {
  return {
    name: 'codebreak-docs',
    configureServer(server: ViteDevServer) {
      const dir = docsDir()
      server.watcher.add(dir)

      const onChange = async (file: string): Promise<void> => {
        if (!file.endsWith('.mdx') || !file.startsWith(dir)) return
        const url = `${VDOC_PREFIX}${path.basename(file)}`
        const mod = await server.moduleGraph.getModuleByUrl(url)
        if (mod) await server.moduleGraph.invalidateModule(mod)
        server.ws.send({ type: 'full-reload' })
      }
      server.watcher.on('change', onChange)
      server.watcher.on('add', onChange)
      server.watcher.on('unlink', onChange)

      server.middlewares.use('/api/docs', (req, res) => {
        const url = new URL(req.url ?? '/', 'http://local')
        const rawSlug = url.searchParams.get('raw')
        if (rawSlug) {
          // Konten mentah utk fallback UI saat MDX gagal dikompilasi
          const safeName = path.basename(`${rawSlug}.mdx`)
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          try {
            res.end(fs.readFileSync(path.join(dir, safeName), 'utf8'))
          } catch {
            res.statusCode = 404
            res.end('(dokumen tidak ditemukan)')
          }
          return
        }
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(listDocs()))
      })
    },

    resolveId(source) {
      if (source.startsWith(VDOC_PREFIX)) {
        return VIRTUAL_PREFIX + source.slice(VDOC_PREFIX.length)
      }
      return null
    },

    async load(id) {
      if (!id.startsWith(VIRTUAL_PREFIX)) return null
      const fileName = id.slice(VIRTUAL_PREFIX.length)
      const abs = path.join(docsDir(), decodeURIComponent(fileName))

      let raw: string
      try {
        raw = fs.readFileSync(abs, 'utf8')
      } catch {
        return `export const __error = "dokumen tidak ditemukan";\nexport default null;\n`
      }

      try {
        const highlighter = await getHighlighter()
        const compiled = await compile(raw, {
          remarkPlugins: [remarkGfm, remarkFrontmatter],
          rehypePlugins: [
            rehypeSlug,
            [rehypeShikiFromHighlighter, highlighter, { theme: 'github-dark' }],
          ],
        })
        return String(compiled)
      } catch (err) {
        // MDX tidak valid (mis. karakter < liar dari LLM) — kirim error,
        // UI akan menampilkan konten mentah sebagai fallback.
        return `export const __error = ${JSON.stringify(String(err))};\nexport default null;\n`
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), codebreakDocsPlugin()],
})
