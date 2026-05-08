import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/clinic/api': 'https://backend-production-12d0.up.railway.app',
    },
  },
})
