import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  css: {
    preprocessorOptions: {
      scss: {
        // Bootstrap 5.3 SCSS uses legacy Dart Sass APIs (@import, global color
        // functions, old if() syntax) that are deprecated in Sass 1.x.
        // These warnings come from node_modules — silence them here since we
        // cannot change Bootstrap's source.
        silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'if-function'],
      },
    },
  },
  server: {
    proxy: {
      '/clinic/api': 'https://backend-production-12d0.up.railway.app',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/main.tsx',
        'src/**/*.d.ts',
        'src/test/**',
        'src/types/**',
      ],
    },
  },
})
