import { defineConfig, transformWithEsbuild } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    {
      name: 'treat-js-files-as-jsx',
      async transform(code, id) {
        if (!id.match(/src\/.*\.js$/)) return null
        return transformWithEsbuild(code, id, { loader: 'jsx' })
      },
    },
    react(),
  ],
  build: {
    outDir: 'build',
  },
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:3001',
      '^/w/': 'http://localhost:3001',
      '^/i/': 'http://localhost:3001',
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
  define: {
    'import.meta.env.VITE_VERSION': JSON.stringify(process.env.npm_package_version),
    'import.meta.env.VITE_NAME': JSON.stringify(process.env.npm_package_name),
  },
})
