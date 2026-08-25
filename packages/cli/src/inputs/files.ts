import fs from 'node:fs'
import path from 'node:path'
import ignore from 'ignore'

const ALWAYS_SKIP_DIRS = new Set([
  '.git', 'node_modules', 'dist', 'build', 'out', '.next', '.nuxt',
  '.cache', 'coverage', '__pycache__', '.venv', 'venv', 'target',
])

export interface WalkOptions {
  extensions?: Set<string>
  maxFiles?: number
}

/**
 * Walk folder secara rekursif (relatif terhadap rootDir), hormati
 * .gitignore di rootDir + direktori berat bawaan. Hasil urut alfabetis.
 */
export function walkFiles(rootDir: string, opts: WalkOptions = {}): string[] {
  const maxFiles = opts.maxFiles ?? 3000
  const ig = ignore()
  const gitignorePath = path.join(rootDir, '.gitignore')
  if (fs.existsSync(gitignorePath)) {
    ig.add(fs.readFileSync(gitignorePath, 'utf8'))
  }

  const out: string[] = []
  const visit = (dirRel: string): void => {
    if (out.length >= maxFiles) return
    const entries = fs.readdirSync(path.join(rootDir, dirRel), { withFileTypes: true })
    for (const entry of entries) {
      if (out.length >= maxFiles) return
      const rel = dirRel ? `${dirRel}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        if (ALWAYS_SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue
        if (ig.ignores(`${rel}/`)) continue
        visit(rel)
      } else if (entry.isFile()) {
        if (ig.ignores(rel)) continue
        if (opts.extensions && !opts.extensions.has(path.extname(entry.name).toLowerCase())) continue
        out.push(rel)
      }
    }
  }

  visit('')
  return out.sort()
}
