import fs from 'node:fs'
import path from 'node:path'
import { CodebreakError } from '../errors.js'
import { walkFiles } from '../inputs/files.js'
import { truncateMiddle } from '../util/truncate.js'
import type { LlmProvider } from './types.js'

const REPO_MAP_MAX_CHARS = 40_000

export interface SelectOptions {
  extensions?: Set<string>
  maxFiles: number
}

/** Compact repo map: list of relative paths (already filtered by gitignore & extension) */
export function buildRepoMap(rootDir: string, extensions?: Set<string>): string {
  const rels = walkFiles(rootDir, { extensions, maxFiles: 2500 })
  if (rels.length === 0) return ''
  const joined = rels.join('\n')
  return truncateMiddle(joined, REPO_MAP_MAX_CHARS).text
}

const SELECT_SYSTEM = [
  'You are a precise code-search assistant inside a local repository.',
  'The user gives you a repo map (list of file paths) and a description of what they want explained.',
  'Select the files most likely to contain the relevant code.',
  'Reply with ONLY a JSON object, no prose, no code fences:',
  '{"files": ["relative/path/a.ts", "relative/path/b.ts"], "reason": "one short sentence"}',
  '- Paths must be copied EXACTLY from the repo map.',
  '- Order files by relevance, most relevant first.',
].join('\n')

/**
 * Relevance pipeline v1: repo map → LLM picks up to N files → validate existence.
 * A single selection round; a multi-round agent loop is intentionally left for a later version.
 */
export async function selectRelevantFiles(
  rootDir: string,
  description: string,
  llm: LlmProvider,
  opts: SelectOptions,
): Promise<string[]> {
  const map = buildRepoMap(rootDir, opts.extensions)
  if (!map.trim()) {
    throw new CodebreakError('No files could be mapped in this directory.')
  }

  const user = [
    `<repo-map>\n${map}\n</repo-map>`,
    '',
    `<description>\n${description}\n</description>`,
    '',
    `Select up to ${opts.maxFiles} files most relevant to the description.`,
  ].join('\n')

  const raw = await llm.complete({ system: SELECT_SYSTEM, user, temperature: 0 })
  const parsed = extractJson(raw)

  const listed = parsed?.files
  if (!Array.isArray(listed)) {
    throw new CodebreakError('The LLM did not return a valid file list. Try again or pass explicit paths.')
  }

  const seen = new Set<string>()
  const valid: string[] = []
  for (const item of listed) {
    if (typeof item !== 'string' || item.trim() === '') continue
    const rel = item.trim().replace(/^\.\//, '')
    if (seen.has(rel)) continue
    seen.add(rel)
    const abs = path.resolve(rootDir, rel)
    let stat: fs.Stats
    try {
      stat = fs.statSync(abs)
    } catch {
      continue
    }
    if (!stat.isFile()) continue
    if (opts.extensions && !opts.extensions.has(path.extname(abs).toLowerCase())) continue
    valid.push(rel)
    if (valid.length >= opts.maxFiles) break
  }

  if (valid.length === 0) {
    throw new CodebreakError(
      'The LLM suggested files but none matched this repository. Try a more specific description.',
    )
  }
  return valid
}

/** Extract a JSON object from an LLM reply, tolerating code fences and preamble chatter */
export function extractJson(text: string): Record<string, unknown> | null {
  let t = text.trim()
  const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(t)
  if (fence?.[1]) t = fence[1].trim()
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    return JSON.parse(t.slice(start, end + 1)) as Record<string, unknown>
  } catch {
    return null
  }
}
