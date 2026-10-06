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

test('interactive phones reuse the showcase float animation and remain clickable', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')

  assert.match(app, /sales-phone-mockup[^\n]*sales-showcase-float/)
  assert.match(css, /\.sales-showcase-float\s*\{[^}]*animation:\s*salesShowcaseFloat/)
  assert.match(css, /\.sales-showcase-interactive\s+\.sales-phone-mockup[^}]*pointer-events:\s*auto/)
  assert.match(css, /\.sales-phone-mockup\.position-left[^}]*left:\s*13%/)
  assert.match(css, /\.sales-phone-mockup\.position-right[^}]*left:\s*87%/)
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*\.sales-phone-mockup\.position-left[^}]*left:\s*12%/)
})
