import fs from 'node:fs'
import path from 'node:path'
import { simpleGit, type SimpleGit } from 'simple-git'
import { CodebreakError } from '../errors.js'

export async function getGit(cwd: string): Promise<SimpleGit> {
  const git = simpleGit({ baseDir: cwd })
  try {
    const inside = (await git.revparse(['--is-inside-work-tree'])).trim()
    if (inside !== 'true') throw new Error('not a work tree')
  } catch {
    throw new CodebreakError(
      'Not inside a git repository.\n' +
        'The --changes and --commit modes require a git repo; ' +
        'file & feature-description modes work in any folder.',
    )
  }
  return git
}

/** Walk up directories until .git is found (file or dir); null if not found */
export function findGitRoot(startDir: string): string | null {
  let cur = path.resolve(startDir)
  while (true) {
    if (fs.existsSync(path.join(cur, '.git'))) return cur
    const parent = path.dirname(cur)
    if (parent === cur) return null
    cur = parent
  }
}

export async function repoRoot(git: SimpleGit): Promise<string> {
  return (await git.revparse(['--show-toplevel'])).trim()
}

export async function currentBranch(git: SimpleGit): Promise<string> {
  try {
    return (await git.revparse(['--abbrev-ref', 'HEAD'])).trim()
  } catch {
    return '(detached)'
  }
}

export interface UntrackedFile {
  path: string
  content: string
  truncated: boolean
}

export interface ChangesGather {
  /** Combined staged+unstaged diff against HEAD (tracked files) */
  diff: string
  untracked: UntrackedFile[]
}

/**
 * Local changes = staged + unstaged against HEAD, plus untracked file contents.
 * Also works in a repo with no commits yet (empty diff, everything untracked).
 */
export async function gatherChanges(
  git: SimpleGit,
  opts: { extensions?: Set<string>; maxUntrackedBytes?: number } = {},
): Promise<ChangesGather> {
  const root = await repoRoot(git)
  const status = await git.status()

  let diff = ''
  const hasTrackedChange = status.files.some((f) => f.index !== '?' || f.working_dir !== '?')
  if (hasTrackedChange) {
    try {
      diff = await git.diff(['--no-color', '--no-ext-diff', 'HEAD'])
    } catch {
      // Repo without a first commit: git diff HEAD fails → treat everything as untracked.
      diff = ''
    }
  }

  const maxBytes = opts.maxUntrackedBytes ?? 64 * 1024
  const untrackedPaths = status.files.filter((f) => f.index === '?').map((f) => f.path)
  const untracked: UntrackedFile[] = []
  for (const rel of untrackedPaths) {
    const abs = path.join(root, rel)
    let stat: fs.Stats
    try {
      stat = fs.statSync(abs)
    } catch {
      continue
    }
    if (!stat.isFile()) continue
    if (opts.extensions && !matchExtension(rel, opts.extensions)) continue
    if (isBinaryFile(abs)) continue
    const raw = fs.readFileSync(abs)
    const clipped = raw.subarray(0, maxBytes)
    untracked.push({
      path: rel,
      content: clipped.toString('utf8'),
      truncated: raw.length > maxBytes,
    })
  }

  return { diff, untracked }
}

export interface CommitSpec {
  kind: 'single' | 'range'
  ref?: string
  from?: string
  to?: string
  /** The exact string as typed by the user, used as the document label */
  label: string
}

/** Parse "HEAD", "abc1234", or a range "A..B" / "A...B" */
export function parseCommitRef(input: string): CommitSpec {
  const trimmed = input.trim()
  const m = /^(.+?)\.{2,3}(.+)$/.exec(trimmed)
  if (m && m[1] && m[2]) {
    return { kind: 'range', from: m[1].trim(), to: m[2].trim(), label: trimmed }
  }
  return { kind: 'single', ref: trimmed, label: trimmed }
}

async function assertRefExists(git: SimpleGit, ref: string): Promise<void> {
  try {
    // "<ref>^{}" validates that the ref exists AND can be peeled to its base object
    await git.revparse([`${ref}^{}`])
  } catch {
    throw new CodebreakError(`Unknown git ref: "${ref}"`)
  }
}

export interface CommitGather {
  spec: CommitSpec
  /** Subject + author + date for the document title */
  meta: string
  /** Patch/diff material */
  patch: string
  /** List of "hash subject" entries for range mode */
  commits: string[]
}

export async function gatherCommit(git: SimpleGit, spec: CommitSpec): Promise<CommitGather> {
  if (spec.kind === 'single') {
    await assertRefExists(git, spec.ref!)
    const meta = (
      await git.show(['-s', '--no-color', '--format=%s%n%h · %an · %ad', '--date=short', spec.ref!])
    ).trim()
    const patch = await git.show(['--no-color', '--no-ext-diff', '--format=', spec.ref!])
    return { spec, meta, patch, commits: [] }
  }

  const { from, to } = spec
  await assertRefExists(git, from!)
  await assertRefExists(git, to!)
  const meta = `Changes from ${from} to ${to}`
  const log = await git.raw(['log', '--no-color', '--format=%h %s', `${from}..${to}`])
  const patch = await git.diff(['--no-color', '--no-ext-diff', from!, to!])
  return { spec, meta, patch, commits: log.split('\n').filter(Boolean) }
}

const BINARY_EXTENSIONS = new Set([
  '.png','.jpg','.jpeg','.gif','.webp','.ico','.bmp','.pdf','.zip','.tar','.gz','.tgz','.bz2',
  '.7z','.rar','.exe','.dll','.so','.dylib','.bin','.o','.a','.woff','.woff2','.ttf','.eot','.otf',
  '.mp3','.mp4','.mov','.avi','.mkv','.wav','.flac','.sqlite','.db','.pyc','.class','.jar',
])

function matchExtension(file: string, exts: Set<string>): boolean {
  const ext = path.extname(file).toLowerCase()
  // extensionless files only pass when the filter is inactive
  return ext === '' ? false : exts.has(ext)
}

export function isBinaryFile(absPath: string): boolean {
  if (BINARY_EXTENSIONS.has(path.extname(absPath).toLowerCase())) return true
  let fd: number
  try {
    fd = fs.openSync(absPath, 'r')
  } catch {
    return true
  }
  try {
    const sample = Buffer.alloc(8192)
    const bytes = fs.readSync(fd, sample, 0, sample.length, 0)
    return sample.subarray(0, bytes).includes(0)
  } finally {
    fs.closeSync(fd)
  }
}

export function normalizeExtensions(langs: string[]): Set<string> {
  return new Set(
    langs.map((l) => {
      const s = l.trim().toLowerCase().replace(/^\./, '')
      return `.${s}`
    }),
  )
}
