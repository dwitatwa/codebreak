import fs from 'node:fs'
import path from 'node:path'
import { stringify } from 'yaml'
import type { Depth } from '../config.js'
import type { ContextKind } from '../inputs/context.js'

export interface DocFrontmatter {
  title: string
  type: ContextKind
  source: string
  date: string
  model: string
  depth: Depth
  locale: string
}

export interface EmittedDoc {
  absPath: string
  /** Path relatif dari repo/cwd, mis. .codebreak/docs/2026-08-25-foo.mdx */
  relPath: string
}

export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
  return slug || 'explain'
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

interface ReservedDocFile {
  absPath: string
  relPath: string
}

/** Tentukan path dokumen unik <cwd>/.codebreak/docs/YYYY-MM-DD-<slug>.mdx (sufiks -2, -3, …) */
function reserveDocFile(cwd: string, title: string): ReservedDocFile {
  const docsDir = path.join(cwd, '.codebreak', 'docs')
  fs.mkdirSync(docsDir, { recursive: true })

  const base = `${today()}-${slugify(title)}`
  let name = `${base}.mdx`
  let n = 2
  while (fs.existsSync(path.join(docsDir, name))) {
    name = `${base}-${n}.mdx`
    n += 1
  }
  return { absPath: path.join(docsDir, name), relPath: path.join('.codebreak', 'docs', name) }
}

/**
 * Tulis dokumen ke <cwd>/.codebreak/docs/YYYY-MM-DD-<slug>.mdx.
 * Kalau nama sudah ada, tambah sufiks -2, -3, dst.
 */
export function emitDoc(cwd: string, body: string, fm: DocFrontmatter): EmittedDoc {
  const doc = reserveDocFile(cwd, fm.title)
  const frontmatter = stringify(fm, { sortMapEntries: false }).trimEnd()
  fs.writeFileSync(doc.absPath, `---\n${frontmatter}\n---\n\n${body.trim()}\n`, 'utf8')
  return doc
}

/**
 * Tulis dokumen hasil agen eksternal (mis. agent harness) dengan frontmatter bebas.
 * CLI hanya menjamin penamaan file & serialisasi YAML yang valid.
 */
export function writeAgentDoc(
  cwd: string,
  frontmatter: Record<string, unknown>,
  body: string,
): EmittedDoc {
  const title = typeof frontmatter.title === 'string' && frontmatter.title ? frontmatter.title : 'agent-doc'
  const doc = reserveDocFile(cwd, title)
  const yamlText = stringify(frontmatter, { sortMapEntries: false }).trimEnd()
  fs.writeFileSync(doc.absPath, `---\n${yamlText}\n---\n\n${body.trim()}\n`, 'utf8')
  return doc
}

/** Buang frontmatter kalau model menyelundupkannya, plus fence pembungkus utuh */
export function sanitizeBody(raw: string): string {
  let body = raw.trim()
  body = body.replace(/^```(?:markdown|md)\s*\n([\s\S]*?)\n```\s*$/, '$1')
  if (body.startsWith('---')) {
    const end = body.indexOf('\n---', 3)
    if (end !== -1) body = body.slice(end + 4).trimStart()
  }
  return body
}

const TLDR_RE = /^##\s+(Ringkasan|Summary)\s*\n([\s\S]*?)(?=\n##\s|\s*$)/i

/** Ekstrak seksi TL;DR untuk dicetak ke terminal; '' jika tidak ketemu */
export function extractTldr(body: string): string {
  const m = TLDR_RE.exec(body)
  if (!m?.[2]) return ''
  return m[2]
    .split('\n')
    // buang elemen HTML yang tidak informatif di terminal
    .filter((line) => !/^\s*<\/?(details|summary)/i.test(line))
    .join('\n')
    .trim()
    .split('\n')
    .slice(0, 40)
    .join('\n')
}
