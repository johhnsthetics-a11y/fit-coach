import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const cssSource = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')

test('mobile navigation exposes module tones and rounded menu hooks', () => {
  assert.match(appSource, /coach-mobile-menu-panel/)
  assert.match(appSource, /coach-mobile-bottom-button tone-\$\{item\.tone\}/)
  assert.match(appSource, /student-mobile-menu-panel/)
  assert.match(appSource, /student-mobile-nav-button tone-\$\{item\.tone\}/)
  assert.match(appSource, /student-mobile-nav-button tone-emerald/)
})

test('navigation polish styles cover floating shells and module colors', () => {
  assert.match(cssSource, /\.coach-mobile-menu-panel/)
  assert.match(cssSource, /\.student-mobile-menu-panel/)
  assert.match(cssSource, /\.student-bottom-nav\s*\{[^}]*border-radius:/s)
  assert.match(cssSource, /\.tone-lime\s*\{\s*--nav-tone:/)
  assert.match(cssSource, /\.tone-orange\s*\{\s*--nav-tone:/)
  assert.match(cssSource, /\.student-mobile-nav-button\.is-active/)
  assert.match(cssSource, /\.coach-mobile-bottom-button\.is-active/)
})
