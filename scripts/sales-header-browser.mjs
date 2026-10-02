import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createServer } from 'vite'

const playwrightModule = process.env.PLAYWRIGHT_MODULE_PATH
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href
  : 'playwright'
const { chromium } = await import(playwrightModule)
const output = resolve('__qa-output/sales-header-mobile')
mkdirSync(output, { recursive: true })

const server = await createServer({
  mode: 'test',
  envFile: false,
  define: {
    'import.meta.env.VITE_SUPABASE_URL': 'undefined',
    'import.meta.env.VITE_SUPABASE_ANON_KEY': 'undefined',
  },
  server: { host: '127.0.0.1', port: 0, hmr: false },
})
await server.listen()

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH,
})
const base = server.resolvedUrls.local[0]

try {
  for (const width of [320, 375, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 700 },
      isMobile: true,
      hasTouch: true,
    })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error' && !message.text().includes('net::ERR')) errors.push(message.text())
    })

    await page.goto(base)
    const header = page.locator('.sales-header')
    const logo = page.locator('.sales-header-logo-link')
    const login = page.getByRole('button', { name: 'Entrar', exact: true })
    await login.waitFor()

    const [headerBox, logoBox, loginBox] = await Promise.all([
      header.boundingBox(),
      logo.boundingBox(),
      login.boundingBox(),
    ])
    assert.ok(headerBox && headerBox.y >= 0 && headerBox.y + headerBox.height <= 100)
    assert.ok(loginBox && loginBox.x >= 0 && loginBox.x + loginBox.width <= width)
    assert.ok(loginBox.height >= 44)
    assert.ok(logoBox && logoBox.x + logoBox.width <= loginBox.x + 1, `Logo e Entrar não podem se sobrepor em ${width}px`)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
    assert.deepEqual(errors, [])

    await page.screenshot({ path: resolve(output, `header-${width}.png`) })
    await login.click()
    await page.waitForURL(/\/login\?mode=signin/)
    await page.getByRole('heading', { name: 'Entrar no painel', exact: true }).waitFor()
    await context.close()
  }

  console.log('PASS cabeçalho mobile: 320px, 375px e 390px')
} finally {
  await browser.close()
  await server.close()
}
