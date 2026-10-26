import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // En dev, les appels /api sont relayés vers le backend (même origine, pas de CORS)
    proxy: {
      '/api': process.env.API_PROXY_TARGET || 'http://localhost:3001',
    },
  },
})
