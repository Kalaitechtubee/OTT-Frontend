import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      // Forward all /api and /health requests to the backend
      // This eliminates cross-origin issues in development entirely
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        xfwd: true,   // sets X-Forwarded-Host / X-Forwarded-Proto on each request
      },
      '/health': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        xfwd: true,
      },
    },
  },
})