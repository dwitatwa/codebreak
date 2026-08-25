import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pc from 'picocolors'
import { CodebreakError } from '../errors.js'
import { findGitRoot } from '../git/repo.js'
import { binScriptName, openInBrowser } from '../util/platform.js'

export function docsDirFor(cwd: string): string {
  const root = findGitRoot(cwd) ?? cwd
  return path.join(root, '.codebreak', 'docs')
}

function viewerDir(): string {
  try {
    const pkgUrl = import.meta.resolve('@codebreak/viewer/package.json')
    return path.dirname(fileURLToPath(pkgUrl))
  } catch {
    throw new CodebreakError(
      'Package @codebreak/viewer tidak ditemukan.\nJalankan `pnpm install` di root proyek codebreak.',
    )
  }
}

export interface ViewOptions {
  port?: number
  open?: boolean
}

/**
 * Jalankan viewer (vite dev) dengan CODEBREAK_DOCS_DIR menunjuk
 * repo aktif. Proses tetap hidup sampai Ctrl+C; dokumen baru hasil
 * `codebreak explain`/`add` otomatis muncul lewat hot reload.
 */
export async function runView(opts: ViewOptions = {}): Promise<void> {
  const dir = viewerDir()
  const viteBin = path.join(dir, 'node_modules', '.bin', binScriptName('vite'))
  if (!fs.existsSync(viteBin)) {
    throw new CodebreakError(
      'Binary vite tidak ditemukan di package viewer.\nJalankan `pnpm install` di root proyek codebreak.',
    )
  }

  const port = opts.port ?? 5173
  const docsDir = docsDirFor(process.cwd())
  fs.mkdirSync(docsDir, { recursive: true })

  console.log(pc.dim(`Docs dir : ${docsDir}`))
  console.log(pc.dim('Tekan Ctrl+C untuk menghentikan.'))

  const child = spawn(viteBin, ['--port', String(port), '--strictPort'], {
    cwd: dir,
    env: { ...process.env, CODEBREAK_DOCS_DIR: docsDir },
    stdio: ['inherit', 'pipe', 'inherit'],
    shell: process.platform === 'win32',
  })

  let opened = false
  let url = `http://localhost:${port}/`
  const openOnce = (): void => {
    if (opened || opts.open === false) return
    opened = true
    if (!openInBrowser(url)) {
      console.log(pc.yellow(`Tidak menemukan pembuka browser — buka manual: ${url}`))
    }
  }

  child.stdout?.on('data', (chunk: Buffer) => {
    process.stdout.write(chunk)
    const m = /Local:\s+(https?:\/\/\S+)/.exec(chunk.toString())
    if (m?.[1]) {
      url = m[1]
      console.log(pc.cyan('\nViewer siap — dokumen baru dari `codebreak explain`/`add` langsung muncul di sini.'))
    }
    openOnce()
  })

  child.on('error', (err) => {
    throw new CodebreakError(`Gagal menjalankan viewer: ${err.message}`)
  })

  child.on('exit', (code) => {
    process.exit(code ?? 0)
  })

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      child.kill(signal)
    })
  }

  // Fallback kalau pola "Local:" tidak pernah tercetak
  setTimeout(openOnce, 20_000).unref()

  await new Promise(() => {})
}
