import fs from 'node:fs'
import path from 'node:path'
import pc from 'picocolors'
import { CodebreakError } from '../errors.js'
import { findGitRoot } from '../git/repo.js'
import { openInBrowser } from '../util/platform.js'
import { startViewerServer } from '../viewer/server.js'

export function docsDirFor(cwd: string): string {
  const root = findGitRoot(cwd) ?? cwd
  return path.join(root, '.codebreak', 'docs')
}

export interface ViewOptions {
  port?: number
  open?: boolean
}

/**
 * Run the local web viewer for the active repo — the server runs in-process
 * on top of Bun.serve. The process stays alive until Ctrl+C; new docs from
 * `codebreak explain`/`add` show up automatically via SSE reload.
 */
export async function runView(opts: ViewOptions = {}): Promise<void> {
  const docsDir = docsDirFor(process.cwd())
  fs.mkdirSync(docsDir, { recursive: true })

  console.log(pc.dim(`Docs dir : ${docsDir}`))
  console.log(pc.dim('Press Ctrl+C to stop.'))

  const server = startViewerServer({ docsDir, port: opts.port })
  const url = server.url
  console.log(pc.cyan(`\nViewer ready — new docs from \`codebreak explain\`/\`add\` appear instantly at ${url}`))

  if (opts.open === false) {
    console.log(pc.dim('(—no-open set — open the URL above manually.)'))
  } else if (!openInBrowser(url)) {
    console.log(pc.yellow(`No browser opener found — open manually: ${url}`))
  }

  // Bun.serve keeps the event loop alive; this promise just makes the intent explicit.
  await new Promise(() => {})
}
