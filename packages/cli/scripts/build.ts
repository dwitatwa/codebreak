/**
 * codebreak build pipeline:
 *   1. vite build for the frontend shell (build-time only)
 *   2. generate asset manifest → bundled deterministically into the binary
 *   3. plain dist/cli.js bundle (for symlink/dev)
 *   4. compile standalone binaries × N target platforms
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { mdPlugin } from './md-plugin.ts'
import { generateManifest } from './gen-manifest.ts'

const repoRoot = path.resolve(import.meta.dir, '../../..')
const cliDir = path.join(repoRoot, 'packages', 'cli')

function runStep(cmd: string[], cwd: string): void {
  console.log(`→ ${cmd.join(' ')}  (cwd: ${path.relative(repoRoot, cwd) || '.'})`)
  const proc = Bun.spawnSync(cmd, { cwd, stdout: 'inherit', stderr: 'inherit' })
  if (proc.exitCode !== 0) process.exit(proc.exitCode ?? 1)
}

// ── 1. Shell frontend ────────────────────────────────────────────────────────
console.log('▸ build viewer shell')
runStep(['bun', 'run', 'build:viewer'], repoRoot)

// ── 2. Asset manifest ────────────────────────────────────────────────────────
console.log('▸ generate asset manifest')
generateManifest()

// ── 3. Plain bundle (dist/cli.js for symlink/dev) ───────────────────────────
console.log('▸ bundle dist/cli.js')
mkdirSync(path.join(cliDir, 'dist'), { recursive: true })
const plain = await Bun.build({
  entrypoints: [path.join(cliDir, 'src/cli.ts')],
  target: 'bun',
  minify: true,
  plugins: [mdPlugin],
})
if (!plain.success) {
  console.error(plain.logs)
  process.exit(1)
}
// Non-compile builds keep artifacts in memory — write them manually to dist/
const jsOutput = plain.outputs.find((o) => o.kind === 'entry-point')
if (!jsOutput) {
  console.error('entry-point output not found')
  process.exit(1)
}
await Bun.write(path.join(cliDir, 'dist', 'cli.js'), jsOutput)

// ── 4. Compile binaries ──────────────────────────────────────────────────────
const TARGETS = [
  'bun-linux-x64',
  'bun-linux-arm64',
  'bun-windows-x64',
] as const

const outDir = path.join(cliDir, 'dist-binaries')
mkdirSync(outDir, { recursive: true })

for (const target of TARGETS) {
  const suffix = target.replace(/^bun-/, '')
  const outfile = path.join(outDir, `codebreak-${suffix}${suffix.startsWith('windows') ? '.exe' : ''}`)
  console.log(`▸ compile ${target}`)
  const result = await Bun.build({
    entrypoints: [path.join(cliDir, 'src/cli.ts')],
    target: 'bun',
    minify: true,
    plugins: [mdPlugin],
    // The compile type is incomplete in some versions of @types/bun
    compile: { target, outfile },
  } as never)
  if (!result.success) {
    console.error(result.logs)
    process.exit(1)
  }
}

console.log('\n✓ Done. Binaries in packages/cli/dist-binaries/')
