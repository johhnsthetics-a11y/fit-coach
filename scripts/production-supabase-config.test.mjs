import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'

function parseEnv(source) {
  return Object.fromEntries(
    source
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .map(line => {
        const separator = line.indexOf('=')
        return [line.slice(0, separator), line.slice(separator + 1)]
      }),
  )
}

test('build de produção inclui somente a configuração pública do Supabase', async () => {
  const source = await readFile(new URL('../.env.production', import.meta.url), 'utf8')
  const env = parseEnv(source)

  assert.equal(env.VITE_SUPABASE_URL, 'https://zrlcisuuekudczkbapil.supabase.co')
  assert.match(env.VITE_SUPABASE_ANON_KEY, /^sb_publishable_[A-Za-z0-9_-]+$/)
  assert.doesNotMatch(env.VITE_SUPABASE_ANON_KEY, /service_role|sb_secret/i)
})
