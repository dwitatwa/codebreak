import fs from 'node:fs'
import path from 'node:path'
import pc from 'picocolors'
import { CodebreakError } from '../errors.js'
import pkg from '../../package.json'

const REPO = 'dwitatwa/codebreak'

interface ReleaseAsset {
  name: string
  id: number
  size: number
}

interface GithubRelease {
  tag_name: string
  assets: ReleaseAsset[]
}

/** Semver-ish compare — true when `latest` is newer than `current` */
export function isNewerVersion(latest: string, current: string): boolean {
  const parse = (v: string): number[] =>
    v.replace(/^v/i, '').split('.').map((p) => Number.parseInt(p, 10) || 0)
  const a = parse(latest)
  const b = parse(current)
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (x !== y) return x > y
  }
  return false
}

/** Release asset name for this machine; null when no prebuilt binary exists */
export function binaryAssetName(platform: NodeJS.Platform, arch: string): string | null {
  if (platform === 'win32' && arch === 'x64') return 'codebreak-windows-x64.exe'
  if (platform === 'linux' && arch === 'x64') return 'codebreak-linux-x64'
  if (platform === 'linux' && arch === 'arm64') return 'codebreak-linux-arm64'
  return null
}

/** GH_TOKEN / GITHUB_TOKEN env wins; falls back to the gh CLI's stored token */
export function getGithubToken(): string | undefined {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN
  try {
    const res = Bun.spawnSync(['gh', 'auth', 'token'])
    const out = res.stdout.toString().trim()
    return out || undefined
  } catch {
    return undefined
  }
}

/**
 * Path of the running standalone binary. Null when codebreak is running
 * from source (dev mode or a symlinked dist/cli.js) — those can't self-swap.
 */
function standaloneBinaryPath(): string | null {
  const script = process.argv[1] ?? ''
  if (/cli\.(js|ts)$/.test(script)) return null // running from source
  const exe = process.execPath
  if (!exe || path.basename(exe).match(/^(bun|node)(\.exe)?$/i)) return null
  return exe
}

function githubHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = { accept: 'application/vnd.github+json' }
  if (token) headers.authorization = `Bearer ${token}`
  return headers
}

async function fetchLatestRelease(token?: string): Promise<GithubRelease> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: githubHeaders(token),
  })
  if (!res.ok) {
    throw new CodebreakError(
      `Could not fetch the latest release (HTTP ${res.status}).` +
        (res.status === 404 ? '\nIf the repo is private, authenticate first: gh auth login' : ''),
    )
  }
  return (await res.json()) as GithubRelease
}

/** Stream an asset via the API octostream (works for private repos too) */
async function downloadAsset(assetId: number, token?: string): Promise<Buffer> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/assets/${assetId}`, {
    headers: { ...githubHeaders(token), accept: 'application/octet-stream' },
  })
  if (!res.ok) throw new CodebreakError(`Download failed (HTTP ${res.status}).`)
  const total = Number(res.headers.get('content-length') ?? 0)
  const chunks: Uint8Array[] = []
  let received = 0
  let lastReported = 0
  const reader = res.body!.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.length
    const mb = received / 1024 / 1024
    if (mb - lastReported >= 10) {
      lastReported = mb
      const totalMb = total ? ` / ${(total / 1024 / 1024).toFixed(0)} MB` : ''
      process.stdout.write(`\r  ${mb.toFixed(0)} MB${totalMb}`)
    }
  }
  process.stdout.write('\r' + ' '.repeat(40) + '\r')
  return Buffer.concat(chunks.map((c) => Buffer.from(c)))
}

export interface UpgradeOptions {
  /** Only report whether a newer version exists */
  check?: boolean
}

/**
 * Self-upgrade for standalone binary installs:
 * latest release → download platform asset → atomic-ish swap of the running exe.
 */
export async function runUpgrade(opts: UpgradeOptions = {}): Promise<void> {
  const selfPath = standaloneBinaryPath()
  if (!selfPath && !opts.check) {
    throw new CodebreakError(
      'This copy runs from source, so it cannot self-upgrade.\n' +
        'Upgrade it with: cd <codebreak repo> && git pull && bun install && bun run build',
    )
  }

  console.log('Checking the latest release…')
  let release: GithubRelease
  try {
    release = await fetchLatestRelease(getGithubToken())
  } catch (err) {
    if (err instanceof CodebreakError) throw err
    throw new CodebreakError(`Could not reach GitHub: ${(err as Error).message}`)
  }

  const latest = release.tag_name.replace(/^v/, '')
  if (!isNewerVersion(latest, pkg.version)) {
    console.log(pc.green(`Already on the latest version (${pkg.version}).`))
    return
  }
  console.log(`New version available: ${latest} (current: ${pkg.version})`)
  if (opts.check) return

  const assetName = binaryAssetName(process.platform, process.arch)
  if (!assetName) {
    throw new CodebreakError(`No prebuilt binary for ${process.platform}/${process.arch}.`)
  }
  const asset = release.assets.find((a) => a.name === assetName)
  if (!asset) {
    throw new CodebreakError(`Release ${release.tag_name} does not contain ${assetName}.`)
  }

  if (!selfPath) {
    throw new CodebreakError(
      'This copy runs from source, so it cannot self-upgrade.\n' +
        'Upgrade it with: cd <codebreak repo> && git pull && bun install && bun run build',
    )
  }

  console.log(`Downloading ${assetName} (${(asset.size / 1024 / 1024).toFixed(0)} MB)…`)
  const buffer = await downloadAsset(asset.id, getGithubToken())

  // Swap the binary: write beside the target, then rename (Windows-safe dance).
  const target = selfPath
  const tmp = `${target}.new-${process.pid}`
  fs.writeFileSync(tmp, buffer)
  fs.chmodSync(tmp, 0o755)
  try {
    fs.renameSync(tmp, target)
  } catch {
    // Windows: rename over a running exe fails — move the old one aside first.
    const old = `${target}.old`
    try {
      fs.rmSync(old, { force: true })
    } catch {}
    fs.renameSync(target, old)
    fs.renameSync(tmp, target)
  }

  console.log('')
  console.log(pc.green(`✓ Upgraded to ${latest}: ${target}`))
  console.log(pc.dim('If a running terminal still shows the old version, it will pick up the new one on next launch.'))
}
