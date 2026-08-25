import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'

export interface DocMeta {
  slug: string
  title: string
  type: string
  date: string
  source: string
}

export interface ParsedDocFile {
  frontmatter: Record<string, unknown>
  body: string
}

/** Pisahkan frontmatter YAML dari isi dokumen */
export function splitFrontmatter(raw: string): ParsedDocFile {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\s*\n?/.exec(raw)
  if (!m?.[1]) return { frontmatter: {}, body: raw }
  let fm: Record<string, unknown> = {}
  try {
    const parsed = yaml.load(m[1])
    if (typeof parsed === 'object' && parsed !== null) fm = parsed as Record<string, unknown>
  } catch {
    // frontmatter rusak — diperlakukan sebagai dokumen tanpa metadata
  }
  return { frontmatter: fm, body: raw.slice(m[0].length).trim() }
}

export function readDocFile(dir: string, slug: string): string | null {
  const safeName = path.basename(`${slug}.mdx`)
  try {
    return fs.readFileSync(path.join(dir, safeName), 'utf8')
  } catch {
    return null
  }
}

export function listDocs(dir: string): DocMeta[] {
  let names: string[]
  try {
    names = fs.readdirSync(dir).filter((f) => f.endsWith('.mdx'))
  } catch {
    return []
  }

  const metas: DocMeta[] = []
  for (const name of names) {
    const raw = readDocFile(dir, name.replace(/\.mdx$/, ''))
    if (raw === null) continue
    const { frontmatter } = splitFrontmatter(raw)
    metas.push({
      slug: name.replace(/\.mdx$/, ''),
      title: String(frontmatter.title ?? name),
      type: String(frontmatter.type ?? 'file'),
      date:
        frontmatter.date instanceof Date
          ? frontmatter.date.toISOString().slice(0, 10)
          : String(frontmatter.date ?? ''),
      source: String(frontmatter.source ?? ''),
    })
  }

  return metas.sort((a, b) => (b.date + b.slug).localeCompare(a.date + a.slug))
}
