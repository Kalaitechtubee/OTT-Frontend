import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  // Load env variables from frontend directory
  const env = loadEnv(mode, process.cwd(), '')
  const backendTarget = env.VITE_BACKEND_URL || 'http://localhost:8080'

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: {
        // Forward all /api and /health requests to the configured backend target
        // This eliminates cross-origin issues in development entirely
        '/api': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
          xfwd: true,   // sets X-Forwarded-Host / X-Forwarded-Proto on each request
        },
        '/health': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
          xfwd: true,
        },
      },
    },
  }
})