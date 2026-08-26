import { spawn } from 'node:child_process'
import { accessSync, constants } from 'node:fs'
import path from 'node:path'

/** Windows runs .bin via .cmd shims, not POSIX scripts */
export function binScriptName(name: string): string {
  return process.platform === 'win32' ? `${name}.cmd` : name
}

/**
 * Open a URL in the OS default browser; never throws.
 * Linux/WSL tries xdg-open, then wslview.
 */
export function openInBrowser(url: string): boolean {
  try {
    if (process.platform === 'darwin') {
      spawn('open', [url], { stdio: 'ignore', detached: true }).unref()
      return true
    }
    if (process.platform === 'win32') {
      spawn('rundll32', ['url.dll,FileProtocolHandler', url], { stdio: 'ignore', detached: true }).unref()
      return true
    }
    for (const cmd of ['xdg-open', 'wslview']) {
      if (findOnPath(cmd)) {
        spawn(cmd, [url], { stdio: 'ignore', detached: true }).unref()
        return true
      }
    }
    return false
  } catch {
    return false
  }
}

/** Find an executable on PATH (cross-platform, no dependencies) */
export function findOnPath(cmd: string): string | null {
  const exts = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : ['']
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
    if (!dir) continue
    for (const ext of exts) {
      const candidate = path.join(dir, `${cmd}${ext}`)
      try {
        accessSync(candidate, constants.X_OK)
        return candidate
      } catch {
        continue
      }
    }
  }
  return null
}
