import fs from 'node:fs'
import path from 'node:path'
import pc from 'picocolors'
import { parse as parseYaml } from 'yaml'
import { CodebreakError } from '../errors.js'
import { repairMdxBody, writeAgentDoc } from '../render/mdx.js'

export interface AddFlags {
  title?: string
  type?: string
  source?: string
  model?: string
  locale?: string
  depth?: string
}

const KNOWN_TYPES = new Set(['changes', 'commit', 'file', 'description', 'note'])

/** Fallback title comes only from the first H1 (# Title) — not sub-headings like ## Summary */
function firstHeading(body: string): string | undefined {
  const m = /^#\s+(.+?)\s*$/m.exec(body)
  return m?.[1]
}

export interface ParsedAgentDoc {
  frontmatter: Record<string, unknown>
  body: string
}

/**
 * Merge the file's built-in frontmatter, CLI flags, and defaults.
 * Priority: flags > file frontmatter > first heading (title) > default.
 * `date` is always set to today; `model` marks the doc as agent-generated.
 */
export function parseAgentDoc(raw: string, flags: AddFlags): ParsedAgentDoc {
  let body = raw.trim()
  if (!body) throw new CodebreakError('Document content is empty.')

  let existing: Record<string, unknown> = {}
  const fmMatch = /^---\r?\n([\s\S]*?)\r?\n---\s*\n?/.exec(body)
  if (fmMatch) {
    try {
      const parsed = parseYaml(fmMatch[1] ?? '')
      if (typeof parsed === 'object' && parsed !== null) existing = parsed as Record<string, unknown>
    } catch {
      // broken frontmatter → discard it and continue without it
    }
    body = body.slice(fmMatch[0].length).trim()
  }

  const title =
    flags.title ??
    (typeof existing.title === 'string' && existing.title.trim() ? existing.title.trim() : undefined) ??
    firstHeading(body) ??
    'Agent Notes'

  const rawType = (flags.type ?? (typeof existing.type === 'string' ? existing.type : '') ?? '').toLowerCase()
  const type = KNOWN_TYPES.has(rawType) ? rawType : 'note'

  const frontmatter: Record<string, unknown> = { ...existing }
  frontmatter.title = title
  frontmatter.type = type
  frontmatter.source = flags.source ?? (typeof existing.source === 'string' && existing.source ? existing.source : 'agent')
  frontmatter.date = new Date().toISOString().slice(0, 10)
  frontmatter.model = flags.model ?? (typeof existing.model === 'string' && existing.model ? existing.model : 'external-agent')
  if (flags.locale) frontmatter.locale = flags.locale

  const depth = flags.depth ?? (typeof existing.depth === 'string' ? existing.depth : undefined)
  if (depth === 'overview' || depth === 'block' || depth === 'line') frontmatter.depth = depth
  else delete frontmatter.depth

  return { frontmatter, body }
}

export async function runAdd(target: string | undefined, flags: AddFlags): Promise<void> {
  let raw: string
  if (!target || target === '-') {
    raw = await readPipedStdin()
  } else {
    const abs = path.resolve(target)
    try {
      raw = fs.readFileSync(abs, 'utf8')
    } catch {
      throw new CodebreakError(`Could not read file: ${abs}`)
    }
  }

  const { frontmatter, body } = parseAgentDoc(raw, flags)
  const repaired = await repairMdxBody(body)
  if (repaired.repaired) {
    console.log(pc.yellow('⚠ Fixed invalid MDX (escaped stray < characters in the prose).'))
  }
  const doc = writeAgentDoc(process.cwd(), frontmatter, repaired.body)

  console.log(`✔ Document saved: ${pc.bold(doc.relPath)}`)
  console.log(pc.dim('Open the viewer: codebreak view'))
}

function readPipedStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    throw new CodebreakError(
      'No input provided. Pass a file path, or pipe content in: cat doc.md | codebreak add -',
    )
  }
  return new Promise((resolve) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => (data += chunk))
    process.stdin.on('end', () => resolve(data))
    process.stdin.on('error', () => resolve(data))
  })
}
