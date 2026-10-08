import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getExerciseMediaStartImage,
  normalizeExerciseMediaKey,
  resolveExerciseMedia,
} from '../src/exerciseMedia.js'

const benchMedia = {
  source: 'free-exercise-db',
  sourceId: 'Barbell_Bench_Press_-_Medium_Grip',
  matchType: 'exact',
  equipment: ['barbell'],
  images: [
    { role: 'start', url: 'https://media.coachfitpro.com.br/free-exercise-db/v1/bench/start.jpg' },
    { role: 'finish', url: 'https://media.coachfitpro.com.br/free-exercise-db/v1/bench/finish.jpg' },
  ],
}

const manifest = {
  'supino reto com barra': benchMedia,
  'bench press': benchMedia,
}

test('normaliza acentos, pontuação e espaços do nome do exercício', () => {
  assert.equal(normalizeExerciseMediaKey('  Elevação PÉLVICA - 45° '), 'elevacao pelvica 45')
})

test('resolve nome direto e alias sem alterar o registro do manifesto', () => {
  assert.equal(resolveExerciseMedia({ name: 'Supino reto com barra', equipment: 'Barra' }, manifest), benchMedia)
  assert.equal(resolveExerciseMedia({ name: 'Outro', aliases: ['Bench Press'], equipment: 'Barra' }, manifest), benchMedia)
})

test('rejeita mídia com conflito de equipamento conhecido', () => {
  assert.equal(resolveExerciseMedia({ name: 'Supino reto com barra', equipment: 'Halteres' }, manifest), null)
})

test('rejeita mídia incompleta, domínio externo e protocolo inseguro', () => {
  const incomplete = { ...benchMedia, images: benchMedia.images.slice(0, 1) }
  const external = {
    ...benchMedia,
    images: benchMedia.images.map((image) => ({ ...image, url: image.url.replace('media.coachfitpro.com.br', 'github.com') })),
  }
  const insecure = {
    ...benchMedia,
    images: benchMedia.images.map((image) => ({ ...image, url: image.url.replace('https:', 'http:') })),
  }

  assert.equal(resolveExerciseMedia({ name: 'Supino' }, { supino: incomplete }), null)
  assert.equal(resolveExerciseMedia({ name: 'Supino' }, { supino: external }), null)
  assert.equal(resolveExerciseMedia({ name: 'Supino' }, { supino: insecure }), null)
})

test('mantém prioridade de vídeo do coach e retorna vazio para desconhecidos', () => {
  assert.equal(resolveExerciseMedia({ name: 'Supino reto com barra', equipment: 'Barra', videoPreviewUrl: 'blob:preview' }, manifest), null)
  assert.equal(resolveExerciseMedia({ name: 'Supino reto com barra', equipment: 'Barra', videoUrl: 'https://coach.example/video.mp4' }, manifest), null)
  assert.equal(resolveExerciseMedia({ name: 'Movimento exclusivo' }, manifest), null)
})

test('retorna somente a imagem inicial validada', () => {
  assert.equal(
    getExerciseMediaStartImage({ name: 'Supino reto com barra', equipment: 'Barra' }, manifest),
    benchMedia.images[0].url,
  )
  assert.equal(getExerciseMediaStartImage({ name: 'Sem mídia' }, manifest), '')
})
