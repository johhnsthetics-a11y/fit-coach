import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')
const output = resolve('__qa-output/build46-sales-showcase')
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
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
})

try {
  const base = server.resolvedUrls.local[0]
  const viewportCases = [
    { name: 'mobile', width: 390, height: 844, showcase: '.sales-hero-device-mobile .sales-showcase-interactive' },
    { name: 'desktop', width: 1440, height: 900, showcase: '.sales-hero-device .sales-showcase-interactive' },
  ]

  for (const viewport of viewportCases) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.width < 600 ? 2 : 1,
      isMobile: viewport.width < 600,
      hasTouch: viewport.width < 600,
    })
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url())
      return url.hostname === '127.0.0.1'
        ? route.continue()
        : route.fulfill({ status: 204, body: '' })
    })
    await context.addInitScript(() => {
      localStorage.setItem('coachfitpro-ui-theme-20260831', 'dark')
    })

    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error' && !message.text().includes('net::ERR')) errors.push(message.text())
    })

    await page.goto(base, { waitUntil: 'networkidle' })
    if (await page.locator('.sales-page').count() === 0) {
      await page.goto(`${base}login?mode=signin`, { waitUntil: 'networkidle' })
    }
    const salesPage = page.locator('.sales-page')
    await salesPage.waitFor({ state: 'visible', timeout: 15000 })
    const showcase = page.locator(viewport.showcase)
    await showcase.waitFor({ state: 'visible', timeout: 15000 })
    await page.evaluate(() => document.fonts.ready)

    const activePhone = showcase.locator('.sales-phone-mockup.is-active')
    await activePhone.waitFor({ state: 'visible', timeout: 10000 })
    const darkImage = activePhone.locator('.sales-phone-screenshot-dark-v0')
    await darkImage.waitFor({ state: 'visible', timeout: 10000 })
    const imageStatus = await darkImage.evaluate(async (image) => {
      await image.decode()
      const screen = image.closest('.sales-phone-screen')
      const screenBox = screen.getBoundingClientRect()
      return {
        src: new URL(image.currentSrc).pathname,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        screenWidth: screenBox.width,
        screenHeight: screenBox.height,
        objectFit: getComputedStyle(image).objectFit,
        fontLoaded: document.fonts.check('16px "Plus Jakarta Sans"'),
        viewportWidth: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
      }
    })
    const darkSafeArea = await activePhone.locator('.sales-phone-safe-area-v0').evaluate((mask) => {
      const screen = mask.closest('.sales-phone-screen')
      const image = screen.querySelector('.sales-phone-screenshot-dark-v0')
      return { height: getComputedStyle(mask).height, display: getComputedStyle(mask).display, background: getComputedStyle(mask).backgroundColor, maskZ: Number(getComputedStyle(mask).zIndex), imageZ: Number(getComputedStyle(image).zIndex) }
    })
    assert.ok(imageStatus.src.endsWith('workouts-dark.png'), `${viewport.name}: Treinos deve ser o aparelho central inicial`)
    assert.ok(imageStatus.naturalWidth > 0 && imageStatus.naturalHeight > 0, `${viewport.name}: screenshot dark deve carregar`)
    assert.equal(imageStatus.naturalWidth, 1170, `${viewport.name}: a captura deve manter a largura exportada @3x`)
    assert.equal(imageStatus.naturalHeight, 2532, `${viewport.name}: a captura deve manter a altura exportada @3x`)
    assert.equal(imageStatus.objectFit, 'contain', `${viewport.name}: screenshot precisa caber sem corte`)
    assert.ok(imageStatus.screenHeight >= (imageStatus.screenWidth * 844 / 390) + 19, `${viewport.name}: o frame deve reservar a safe area sem cortar a captura`)
    assert.equal(imageStatus.fontLoaded, true, `${viewport.name}: Plus Jakarta Sans local deve estar carregada`)
    assert.ok(imageStatus.documentWidth <= imageStatus.viewportWidth + 1, `${viewport.name}: não deve haver overflow horizontal`)
    assert.equal(darkSafeArea.height, '20px', `${viewport.name}: a safe area deve ser proporcional à tela do aparelho`)
    assert.notEqual(darkSafeArea.display, 'none', `${viewport.name}: a safe area deve estar visível`)
    assert.ok(darkSafeArea.maskZ > darkSafeArea.imageZ, `${viewport.name}: a safe area deve ficar acima do PNG do app`)
    await page.screenshot({ path: resolve(output, `sales-showcase-${viewport.name}-dark.png`), fullPage: false, animations: 'disabled' })
    await showcase.screenshot({ path: resolve(output, `sales-showcase-mockup-${viewport.name}-dark.png`), animations: 'disabled' })

    await page.locator('.sales-theme-toggle').filter({ visible: true }).first().click()
    await salesPage.waitFor({ state: 'visible' })
    await page.waitForFunction(() => document.querySelector('.sales-page')?.classList.contains('sales-theme-light'))
    const lightSafeArea = await activePhone.locator('.sales-phone-safe-area-v0').evaluate((mask) => getComputedStyle(mask).backgroundColor)
    const lightImage = activePhone.locator('.sales-phone-screenshot-light-v0')
    await lightImage.waitFor({ state: 'visible', timeout: 10000 })
    const lightStatus = await lightImage.evaluate(async (image) => {
      await image.decode()
      return { src: new URL(image.currentSrc).pathname, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight }
    })
    assert.ok(lightStatus.src.endsWith('workouts-light.png'), `${viewport.name}: o toggle precisa exibir a captura light correspondente`)
    assert.ok(lightStatus.naturalWidth > 0 && lightStatus.naturalHeight > 0, `${viewport.name}: screenshot light deve carregar`)
    assert.equal(lightSafeArea, 'rgb(255, 255, 255)', `${viewport.name}: safe area do tema claro deve usar fundo branco`)
    await page.screenshot({ path: resolve(output, `sales-showcase-${viewport.name}-light.png`), fullPage: false, animations: 'disabled' })
    await showcase.screenshot({ path: resolve(output, `sales-showcase-mockup-${viewport.name}-light.png`), animations: 'disabled' })

    const sidePhone = showcase.locator('.sales-phone-mockup.position-left').first()
    await sidePhone.focus()
    await sidePhone.press('Enter')
    const selectedPhone = showcase.locator('.sales-phone-mockup.is-active')
    assert.equal(await selectedPhone.getAttribute('aria-pressed'), 'true', `${viewport.name}: seleção por teclado deve manter estado acessível`)
    const selectedLightSource = await selectedPhone.locator('.sales-phone-screenshot-light-v0').getAttribute('src')
    assert.ok(selectedLightSource?.endsWith('overview-light.png'), `${viewport.name}: Enter deve promover a visão geral para o centro e manter o tema claro`)

    const reducedMotion = await page.locator(`${viewport.showcase} .sales-phone-mockup.is-active`).evaluate((element) => getComputedStyle(element).animationName)
    assert.equal(reducedMotion, 'none', `${viewport.name}: showcase não deve ficar em flutuação contínua decorativa`)
    assert.deepEqual(errors, [], `${viewport.name}: sem erros de React/JavaScript durante a prévia`)
    console.log(`${viewport.name}: ${JSON.stringify({ imageStatus, darkSafeArea, lightStatus, lightSafeArea, reducedMotion })}`)
    await context.close()
  }

  console.log(`Capturas e smoke checks salvos em ${output}`)
} finally {
  await browser.close()
  await server.close()
}
