import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const productionMain = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8')

test('produção carrega o entrypoint src/main.jsx', () => {
  assert.match(indexHtml, /src\/main\.jsx/)
})

test('entrypoint real instala as melhorias profissionais do chat', () => {
  assert.match(productionMain, /installChatEnhancements/)
  assert.match(productionMain, /chat-enhancements\.css/)
})
