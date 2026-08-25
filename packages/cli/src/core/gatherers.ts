import fs from 'node:fs'
import path from 'node:path'
import { CodebreakError } from '../errors.js'
import {
  gatherChanges,
  gatherCommit,
  getGit,
  isBinaryFile,
  normalizeExtensions,
  parseCommitRef,
} from '../git/repo.js'
import type { GatheredContext } from '../inputs/context.js'
import { walkFiles } from '../inputs/files.js'
import { CharBudget } from '../util/budget.js'

export interface GatherOptions {
  /** Filter ekstensi dari --lang, sudah dinormalisasi jadi ".ts" dst */
  extensions?: Set<string>
  maxContextChars: number
}

export function extensionSet(langs?: string[]): Set<string> | undefined {
  return langs && langs.length > 0 ? normalizeExtensions(langs) : undefined
}

const EXT_TO_LANG: Record<string, string> = {
  '.ts': 'ts', '.tsx': 'tsx', '.mts': 'ts', '.cts': 'ts',
  '.js': 'js', '.jsx': 'jsx', '.mjs': 'js', '.cjs': 'js',
  '.py': 'python', '.go': 'go', '.rs': 'rust', '.java': 'java',
  '.rb': 'ruby', '.php': 'php', '.cs': 'csharp', '.swift': 'swift',
  '.kt': 'kotlin', '.c': 'c', '.h': 'c', '.cpp': 'cpp', '.hpp': 'cpp', '.cc': 'cpp',
  '.sh': 'bash', '.bash': 'bash', '.zsh': 'bash',
  '.json': 'json', '.yml': 'yaml', '.yaml': 'yaml', '.toml': 'toml',
  '.html': 'html', '.css': 'css', '.scss': 'scss', '.md': 'markdown',
  '.sql': 'sql', '.vue': 'html', '.svelte': 'html',
}

function langOf(file: string): string {
  return EXT_TO_LANG[path.extname(file).toLowerCase()] ?? ''
}

const MAX_BYTES_PER_FILE = 96 * 1024

/** Satu seksi file berbentuk heading + code fence, siap masuk material */
export function fileSection(absPath: string, displayPath: string): string | null {
  if (isBinaryFile(absPath)) return null
  let stat: fs.Stats
  try {
    stat = fs.statSync(absPath)
  } catch {
    return null
  }
  if (!stat.isFile()) return null
  const raw = fs.readFileSync(absPath)
  const clipped = raw.subarray(0, MAX_BYTES_PER_FILE)
  const note =
    raw.length > MAX_BYTES_PER_FILE ? `\n[... file truncated at ${MAX_BYTES_PER_FILE} bytes ...]` : ''
  return `### File: ${displayPath}\n\n\`\`\`${langOf(displayPath)}\n${clipped.toString('utf8')}${note}\n\`\`\``
}

export async function gatherChangesContext(cwd: string, opts: GatherOptions): Promise<GatheredContext> {
  const git = await getGit(cwd)
  const { diff, untracked } = await gatherChanges(git, { extensions: opts.extensions })
  if (!diff.trim() && untracked.length === 0) {
    throw new CodebreakError(
      'Nothing to explain — the working tree is clean. ' +
        'Try `codebreak explain --commit HEAD` or a file path.',
    )
  }

  const budget = new CharBudget(opts.maxContextChars)
  const parts: string[] = []

  if (diff.trim()) {
    const taken = budget.take(`## Diff (staged + unstaged vs HEAD)\n\n\`\`\`diff\n${diff}\n\`\`\``)
    if (taken !== null) parts.push(taken)
  }

  const untrackedSections: string[] = []
  for (const u of untracked) {
    const taken = budget.take(
      `### New file (untracked): ${u.path}\n\n\`\`\`${langOf(u.path)}\n${u.content}${u.truncated ? '\n[... truncated ...]' : ''}\n\`\`\``,
    )
    if (taken === null) break
    untrackedSections.push(taken)
  }
  if (untrackedSections.length > 0) {
    parts.push(`## Untracked files (${untrackedSections.length} file(s))\n\n${untrackedSections.join('\n\n')}`)
  }

  return {
    kind: 'changes',
    title: 'Local Changes',
    sourceLabel: 'local changes',
    material: parts.join('\n\n'),
    truncated: budget.remaining <= 0,
  }
}

export async function gatherCommitContext(cwd: string, refInput: string, opts: GatherOptions): Promise<GatheredContext> {
  const spec = parseCommitRef(refInput)
  const git = await getGit(cwd)
  const { meta, patch, commits } = await gatherCommit(git, spec)

  if (!patch.trim()) {
    throw new CodebreakError(`Commit "${spec.label}" has no diff (empty, or a merge commit without changes).`)
  }

  const budget = new CharBudget(opts.maxContextChars)
  const parts: string[] = []

  if (commits.length > 0) {
    const taken = budget.take(`## Commit dalam range\n\n${commits.map((c) => `- ${c}`).join('\n')}`)
    if (taken !== null) parts.push(taken)
  }
  const taken = budget.take(`## Patch\n\n\`\`\`diff\n${patch}\n\`\`\``)
  if (taken !== null) parts.push(taken)

  const subject = meta.split('\n')[0] ?? spec.label
  const title = spec.kind === 'range' ? `Commit Range ${spec.label}` : `Commit ${subject}`

  return {
    kind: 'commit',
    title,
    sourceLabel: `commit ${spec.label}`,
    material: `${meta}\n\n${parts.join('\n\n')}`,
    truncated: budget.remaining <= 0,
  }
}

export function gatherFilesContext(targetAbs: string, opts: GatherOptions): GatheredContext {
  let stat: fs.Stats
  try {
    stat = fs.statSync(targetAbs)
  } catch {
    throw new CodebreakError(`Path not found: ${targetAbs}`)
  }

  const budget = new CharBudget(opts.maxContextChars)
  const rootDir = stat.isDirectory() ? targetAbs : path.dirname(targetAbs)
  const rels = stat.isDirectory()
    ? walkFiles(targetAbs, { extensions: opts.extensions })
    : [path.basename(targetAbs)]

  const sections: string[] = []
  for (const rel of rels) {
    const section = fileSection(path.join(rootDir, rel), rel)
    if (section === null) continue
    const taken = budget.take(section)
    if (taken === null) break
    sections.push(taken)
  }

  if (sections.length === 0) {
    const hint = opts.extensions ? ` dengan filter ekstensi ${[...(opts.extensions ?? [])].join(',')}` : ''
    throw new CodebreakError(`No readable text files found in ${targetAbs}${hint}.`)
  }

  const base = path.basename(targetAbs)
  return {
    kind: 'file',
    title: stat.isDirectory() ? `Folder ${base}/` : base,
    sourceLabel: stat.isDirectory() ? `${base}/ (${rels.length} file)` : base,
    material: sections.join('\n\n'),
    selectedFiles: rels,
    truncated: budget.remaining <= 0,
  }
}

/** Dipakai mode description setelah LLM memilih file relevan */
export function gatherSelectedFiles(rootDir: string, files: string[], maxContextChars: number): { material: string; truncated: boolean } {
  const budget = new CharBudget(maxContextChars)
  const sections: string[] = []
  for (const rel of files) {
    const section = fileSection(path.join(rootDir, rel), rel)
    if (section === null) continue
    const taken = budget.take(section)
    if (taken === null) break
    sections.push(taken)
  }
  return { material: sections.join('\n\n'), truncated: budget.remaining <= 0 }
}
