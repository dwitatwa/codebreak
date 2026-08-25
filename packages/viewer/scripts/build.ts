/**
 * Build shell frontend viewer menjadi aset statis (dist-static/).
 * Vite dipakai di sini sebagai build-time tool saja — runtime tidak menyentuhnya.
 */
import path from 'node:path'

const viewerRoot = path.resolve(import.meta.dir, '..')
const proc = Bun.spawnSync(['bunx', 'vite', 'build'], {
  cwd: viewerRoot,
  stdout: 'inherit',
  stderr: 'inherit',
})
process.exit(proc.exitCode ?? 0)
