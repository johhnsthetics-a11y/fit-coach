import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { swapShowcasePositions } from '../src/showcaseCarousel.js'

test('selecting a phone swaps only its position with the centered phone', () => {
  const initial = ['left', 'center', 'right']
  const afterLeft = swapShowcasePositions(initial, 0)

  assert.deepEqual(afterLeft, ['center', 'left', 'right'])
  assert.deepEqual(swapShowcasePositions(afterLeft, 2), ['right', 'left', 'center'])
  assert.deepEqual(initial, ['left', 'center', 'right'])
})

test('selecting the centered phone leaves the positions unchanged', () => {
  assert.deepEqual(swapShowcasePositions(['left', 'center', 'right'], 1), ['left', 'center', 'right'])
  assert.deepEqual(swapShowcasePositions(['left', 'center', 'right'], 3), ['left', 'center', 'right'])
})

test('interactive phones stay keyboard-clickable and keep the separate float motion', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')

  assert.match(app, /sales-phone-mockup[^\n]*position-\$\{position\}/)
  assert.match(app, /role="button"[\s\S]*onClick=\{selectScreen\}[\s\S]*onKeyDown=/)
  assert.doesNotMatch(app, /sales-phone-mockup sales-showcase-float/)
  assert.match(css, /@keyframes salesShowcaseFloat[\s\S]*?translate:\s*0 -6px/)
  assert.match(css, /\.sales-showcase-interactive\s+\.sales-phone-mockup[^}]*pointer-events:\s*auto/)
  assert.match(css, /\.sales-phone-mockup:nth-of-type\(2\)\s*\{[^}]*animation-delay:\s*-1\.6s/s)
  assert.match(css, /\.sales-phone-mockup:nth-of-type\(3\)\s*\{[^}]*animation-delay:\s*-3\.2s/s)
})

test('showcase keeps only the three floating phones without auxiliary cards', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')
  const start = app.indexOf('function SalesPhoneShowcase()')
  const end = app.indexOf('\nfunction ', start + 1)
  const showcase = app.slice(start, end)

  assert.doesNotMatch(showcase, /sales-showcase-metric|sales-floating-badge|sales-showcase-float|sales-showcase-pulse/)
  assert.doesNotMatch(css, /@keyframes salesShowcasePulse|\.sales-showcase-pulse-/)
  assert.match(app, /className="sales-hero-benefit-line[^"]*"/)
  assert.match(css, /\.sales-hero-benefit-line\s*\{[^}]*font-size:\s*clamp\(/)
})

test('desktop showcase fills its column with balanced phone proportions', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')

  assert.match(css, /\.sales-page \.sales-showcase-interactive\s*\{[^}]*--showcase-phone-offset:\s*min\(26vw, 190px\)/s)
  assert.match(css, /\.sales-page \.sales-showcase-interactive\s*\{[^}]*--showcase-side-scale:\s*0\.78/s)
  assert.match(css, /\.sales-page \.sales-showcase-interactive\s*\{[^}]*min-height:\s*clamp\(35rem, 46vw, 42rem\)/s)
})

test('phone previews restore the original theme-aware mobile navigation', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')

  assert.match(app, /\['dashboard', 'Início', 'emerald'\]/)
  assert.match(app, /type === 'nutrition' \? 'Pacientes' : 'Alunos'/)
  assert.match(app, /\['dumbbell', 'Treino', 'lime'\]/)
  assert.match(css, /\.sales-phone-bottom-nav\s*\{[^}]*border-radius:\s*18px[^}]*background:\s*rgba\(2, 6, 10, 0\.9\)/s)
  assert.match(css, /\.sales-app-modern-showcase-v1 \.sales-phone-bottom-nav\s*\{\s*grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\);\s*\}/s)
  assert.doesNotMatch(css, /\.sales-app-modern-showcase-v1 \.sales-phone-bottom-nav\s*\{[^}]*border-radius:\s*999px/s)
  assert.match(css, /\.sales-theme-light \.sales-app-modern-showcase-v1 \.sales-phone-bottom-nav\s*\{[^}]*background:\s*rgba\(255, 255, 255, 0\.92\) !important/s)
  assert.match(css, /\.sales-phone-nav-item\.tone-cyan\s*\{\s*--phone-nav-color:\s*#80e7f2/)
  assert.match(css, /\.sales-phone-nav-item\.tone-lime\s*\{\s*--phone-nav-color:\s*#c1e879/)
})

test('mobile side phones remain inside narrow viewports', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')

  assert.match(css, /@media \(max-width: 767px\)[\s\S]*?--showcase-phone-offset:\s*min\(24vw, 96px\)[\s\S]*?--showcase-side-scale:\s*0\.64/)
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*?position-left[\s\S]*?var\(--showcase-phone-offset\)[\s\S]*?var\(--showcase-side-scale\)/)
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*?position-right[\s\S]*?var\(--showcase-phone-offset\)[\s\S]*?var\(--showcase-side-scale\)/)
})

test('phone previews omit temporary status pills', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const start = app.indexOf('function SalesPhoneShowcase()')
  const end = app.indexOf('\nfunction ', start + 1)
  const showcase = app.slice(start, end)

  assert.doesNotMatch(showcase, /'ao vivo'|'2 planos'|'hoje'/)
})

test('phone swaps animate with transforms and keep the float loop independent', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')

  assert.match(app, /sales-phone-mockup[^\n]*position-\$\{position\}/)
  assert.doesNotMatch(app, /sales-phone-mockup sales-showcase-float/)
  assert.match(css, /\.sales-showcase-interactive \.sales-phone-mockup\s*\{[^}]*transition:[^}]*transform\s+550ms/s)
  assert.doesNotMatch(css, /\.sales-showcase-interactive \.sales-phone-mockup\s*\{[^}]*transition:[^}]*left\s+\d+ms/s)
  assert.match(css, /\.sales-showcase-interactive \.sales-phone-mockup\s*\{[^}]*animation:\s*salesShowcaseFloat/s)
  assert.match(css, /\.sales-showcase-interactive \.sales-phone-mockup\.position-left[\s\S]{0,220}left:\s*50% !important;[\s\S]{0,180}transform:\s*translate3d\(/)
})
