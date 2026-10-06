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
  assert.match(css, /@keyframes salesShowcaseFloat[\s\S]*?translate:\s*0 -5px/)
  assert.match(css, /\.sales-showcase-interactive\s+\.sales-phone-mockup[^}]*pointer-events:\s*auto/)
})

test('showcase keeps the three pulse cards below the phones without the old floating callouts', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')
  const start = app.indexOf('function SalesPhoneShowcase()')
  const end = app.indexOf('\nfunction ', start + 1)
  const showcase = app.slice(start, end)

  assert.doesNotMatch(showcase, /sales-showcase-metric|sales-floating-badge|sales-showcase-float/)
  assert.match(showcase, /\['message', 'Mensagens'\][\s\S]*\['trophy', 'Evolução'\][\s\S]*\['wallet', 'Faturas'\]/)
  assert.match(showcase, /sales-showcase-pulse-row[\s\S]*sales-showcase-pulse-card/)
  assert.match(css, /@keyframes salesShowcasePulse[\s\S]*?transform:\s*translateY\(-5px\) scale\(1\.02\)/)
  assert.match(app, /className="sales-hero-benefit-line[^"]*"/)
  assert.match(css, /\.sales-hero-benefit-line\s*\{[^}]*font-size:\s*clamp\(/)
})

test('mobile side phones remain inside narrow viewports', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')

  assert.match(css, /@media \(max-width: 767px\)[\s\S]*?position-left[\s\S]*?min\(24vw, 96px\)[\s\S]*?scale\(0\.64\)/)
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*?position-right[\s\S]*?min\(24vw, 96px\)[\s\S]*?scale\(0\.64\)/)
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
