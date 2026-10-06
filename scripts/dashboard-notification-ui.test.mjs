import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')

function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))
  assert.ok(match, `Missing CSS rule: ${selector}`)
  return match[1]
}

test('dashboard quick actions and mobile metrics do not draw filled card surfaces', () => {
  assert.match(rule('.coach-mobile-action-card'), /background:\s*transparent/)
  assert.match(rule('.coach-mobile-action-card'), /box-shadow:\s*none/)
  assert.match(rule('.coach-auth-shell .coach-metric-card'), /background:\s*transparent/)
  assert.match(rule('.coach-auth-shell .coach-metric-card'), /box-shadow:\s*none/)
})

test('notification panel and rows stay opaque and rows cannot collapse in the scroll list', () => {
  assert.match(rule('.coach-notification-popover'), /background:\s*#0[789][0-9a-f]{4,5}/i)
  assert.match(rule('.coach-notification-popover-item'), /flex:\s*0 0 auto/)
  assert.match(rule('.coach-notification-popover-item'), /background:\s*#[0-9a-f]{6}/i)
  assert.match(rule('.app-theme-light .coach-notification-popover'), /background:\s*#fff(?:fff)?\s*!important/i)
  assert.match(rule('.app-theme-light .coach-notification-popover-item'), /background:\s*#f[0-9a-f]{5}\s*!important/i)
})
