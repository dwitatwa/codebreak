import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Build-time only: compiles the frontend shell into static assets.
 * Nothing to do with the runtime — the document server lives in
 * packages/cli/src/viewer/server.ts (Bun.serve).
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist-static',
    emptyOutDir: true,
  },
})
