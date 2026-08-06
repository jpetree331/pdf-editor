import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Port 5179: 5173/5174/5178 are claimed by other local frontends.
export default defineConfig({
  plugins: [react()],
  server: { port: 5179 },
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
