/**
 * Build shell frontend viewer menjadi aset statis (dist-static/).
 * Vite is used here as a build-time tool only — the runtime never touches it.
 */
import path from 'node:path'

const viewerRoot = path.resolve(import.meta.dir, '..')
const proc = Bun.spawnSync(['bunx', 'vite', 'build'], {
  cwd: viewerRoot,
  stdout: 'inherit',
  stderr: 'inherit',
})
process.exit(proc.exitCode ?? 0)
