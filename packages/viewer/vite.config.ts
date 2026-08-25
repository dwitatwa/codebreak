import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Build-time only: mengompilasi frontend shell menjadi aset statis.
 * Tidak ada hubungannya dengan runtime — server dokumen ada di
 * packages/cli/src/viewer/server.ts (Bun.serve).
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist-static',
    emptyOutDir: true,
  },
})
