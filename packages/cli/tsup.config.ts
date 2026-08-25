import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  sourcemap: true,
  clean: true,
  dts: false,
  // Sertakan skill kanonik ke dist agar CLI bisa memasangkannya ke harness mana pun.
  // process.cwd() di sini selalu packages/cli (dijalankan sebagai pnpm script).
  onSuccess: async () => {
    const src = path.resolve(process.cwd(), '../../skills/codebreak/SKILL.md')
    const outDir = path.resolve(process.cwd(), 'dist/skill')
    fs.mkdirSync(outDir, { recursive: true })
    fs.copyFileSync(src, path.join(outDir, 'SKILL.md'))
  },
})
