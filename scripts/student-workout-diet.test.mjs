import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

const storage = new Map()
globalThis.window = {
  location: { search: '', href: 'http://localhost/', pathname: '/', hash: '' },
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  },
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  navigator: globalThis.navigator,
  addEventListener() {},
  removeEventListener() {},
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
}

const server = await createServer({ mode: 'test', envFile: false, server: { middlewareMode: true } })

try {
  const app = await server.ssrLoadModule('/src/App.jsx')
  assert.equal(typeof app.getNutritionMealDisplayItems, 'function', 'A dieta precisa expor o normalizador de alimentos para exibição')

  const items = app.getNutritionMealDisplayItems({
    foods: 'Arroz Branco (200g), Peito de Frango (180g)',
    items: [
      { foodName: 'Arroz Branco', grams: 200, quantity: 200, measureUnit: 'g', category: 'Carboidratos' },
      { foodName: 'Peito de Frango', grams: 180, quantity: 180, measureUnit: 'g', category: 'Carnes' },
    ],
  })
  assert.deepEqual(items.map(({ name, amount }) => ({ name, amount })), [
    { name: 'Arroz Branco', amount: '200 g' },
    { name: 'Peito de Frango', amount: '180 g' },
  ])

  const legacyItems = app.getNutritionMealDisplayItems({ foods: 'Ovos (100g), Banana (90g)' })
  assert.deepEqual(legacyItems.map(({ name, amount }) => ({ name, amount })), [
    { name: 'Ovos', amount: '100 g' },
    { name: 'Banana', amount: '90 g' },
  ])

  const muscleMarkup = renderToStaticMarkup(React.createElement(app.MuscleMap, {
    exercise: { name: 'Supino reto', primaryMuscle: 'peitoral', secondaryMuscles: ['triceps'] },
    compact: true,
  }))
  assert.match(muscleMarkup, /Músculo principal/)
  assert.match(muscleMarkup, /Peitoral/)
  assert.doesNotMatch(muscleMarkup, /<svg|<img|muscle-map-card|Mapa muscular|Mapa anatômico/)

  const foodMarkup = renderToStaticMarkup(React.createElement(app.NutritionMealFoodList, {
    meal: {
      name: 'Almoço',
      foods: 'Arroz Branco (200g), Peito de Frango (180g)',
      items: [
        { foodName: 'Arroz Branco', grams: 200, quantity: 200, measureUnit: 'g', category: 'Carboidratos' },
        { foodName: 'Peito de Frango', grams: 180, quantity: 180, measureUnit: 'g', category: 'Carnes' },
      ],
    },
  }))
  assert.equal((foodMarkup.match(/student-diet-food-row/g) || []).length, 2)
  assert.match(foodMarkup, /Arroz Branco/)
  assert.match(foodMarkup, /200 g/)
  console.log('student workout and diet presentation tests passed')
} finally {
  await server.close()
}
