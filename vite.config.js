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
    chunkSizeWarningLimit: 600,
  },
})
