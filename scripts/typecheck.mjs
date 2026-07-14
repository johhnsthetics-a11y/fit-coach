import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const failures = []

function read(path) {
  return readFileSync(join(root, path), 'utf8')
}

function assert(condition, message) {
  if (!condition) failures.push(message)
}

for (const path of [
  'src/App.jsx',
  'src/supabaseApi.js',
  'src/main.jsx',
  'vite.config.js',
  'supabase/functions/cartpanda-webhook/index.ts',
  'supabase/functions/delete-coach-account/index.ts',
]) {
  assert(existsSync(join(root, path)), `Arquivo obrigatorio ausente: ${path}`)
}

const app = read('src/App.jsx')
const api = read('src/supabaseApi.js')

assert(/deleteRemoteCoachAccount/.test(app), 'App nao possui fluxo de exclusao de conta.')
assert(/async function requestAccountDeletion/.test(app), 'Handler requestAccountDeletion nao encontrado.')
assert(/export async function deleteRemoteCoachAccount/.test(api), 'API nao exporta deleteRemoteCoachAccount.')
assert(/Liberação automática/.test(app), 'Fluxo visual de liberacao automatica nao encontrado.')
assert(/hydrateMessageRow/.test(api), 'Assinatura temporaria de anexos do chat nao encontrada.')
assert(/hydrateWorkoutRow/.test(api), 'Assinatura temporaria de videos de treino nao encontrada.')

if (failures.length) {
  console.error(failures.map((item) => `- ${item}`).join('\n'))
  process.exit(1)
}

console.log('Typecheck leve concluido.')
