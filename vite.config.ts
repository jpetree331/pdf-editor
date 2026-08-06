import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Default port 5179: 5173/5174/5178 are claimed by other local frontends.
// PORT env (set by tooling) wins when present.
export default defineConfig({
  plugins: [react()],
  server: { port: Number(process.env.PORT) || 5179 },
  // Pre-bundle worker-only deps so their first use doesn't trigger a dev reload.
  optimizeDeps: { include: ['docx', 'fflate', 'pdf-lib', 'pdfjs-dist', 'nanoid'] },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('pdfjs-dist')) return 'pdfjs'
          if (id.includes('pdf-lib')) return 'pdflib'
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
