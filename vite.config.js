import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

function removeCloudflareRedirects() {
  return {
    name: 'remove-cloudflare-redirects',
    closeBundle() {
      const redirectsFile = resolve('dist', '_redirects')
      if (existsSync(redirectsFile)) {
        rmSync(redirectsFile, { force: true })
        console.log('Removed _redirects from dist for Cloudflare Workers deploy.')
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), removeCloudflareRedirects()],
  publicDir: 'public',
  build: {
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor'
          }
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) {
            return 'charts-vendor'
          }
          return undefined
        },
      },
    },
  },
})
