import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
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

  const missingAmountItems = app.getNutritionMealDisplayItems({ foods: 'Ovos, Aveia' })
  assert.deepEqual(missingAmountItems.map(({ name, amount, amountMissing }) => ({ name, amount, amountMissing })), [
    { name: 'Ovos', amount: 'Quantidade não informada', amountMissing: true },
    { name: 'Aveia', amount: 'Quantidade não informada', amountMissing: true },
  ])

  const explicitZeroItems = app.getNutritionMealDisplayItems({ foods: 'Ovos (0g)' })
  assert.deepEqual(explicitZeroItems.map(({ amount, amountMissing }) => ({ amount, amountMissing })), [
    { amount: '0 g', amountMissing: false },
  ])

  assert.equal(typeof app.getNutritionMealMacroSegments, 'function')
  assert.deepEqual(app.getNutritionMealMacroSegments('P 32 g | C 58 g | G 18 g'), [
    { label: 'P', value: '32 g' },
    { label: 'C', value: '58 g' },
    { label: 'G', value: '18 g' },
  ])
  assert.deepEqual(app.getNutritionMealMacroSegments('52P / 74C / 14G'), [
    { label: 'P', value: '52 g' },
    { label: 'C', value: '74 g' },
    { label: 'G', value: '14 g' },
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

  assert.equal(typeof app.NutritionMealAccordion, 'function', 'Cada refeição deve usar um accordion independente')
  const mealAccordionMarkup = renderToStaticMarkup(React.createElement(app.NutritionMealAccordion, {
    meal: {
      id: 'meal-breakfast',
      name: 'Café da manhã',
      time: '07:30',
      foods: 'Ovos, Aveia',
      macros: 'P 32 g | C 58 g | G 18 g',
    },
    index: 0,
    defaultExpanded: true,
  }))
  assert.match(mealAccordionMarkup, /nutrition-meal-accordion-v3/)
  assert.match(mealAccordionMarkup, /aria-expanded="true"/)
  assert.match(mealAccordionMarkup, /aria-controls="[^"]+"/)
  assert.match(mealAccordionMarkup, /Quantidade não informada/)
  assert.doesNotMatch(mealAccordionMarkup, />0 g</)

  assert.equal(typeof app.NutritionPlanList, 'function', 'A listagem da dieta do aluno deve ser verificável isoladamente')
  const planMarkup = renderToStaticMarkup(React.createElement(app.NutritionPlanList, {
    plans: [{
      id: 'plan-1',
      studentId: 'student-1',
      title: 'Plano alimentar',
      calories: '2300 kcal',
      protein: '160 g',
      meals: [{ id: 'meal-1', name: 'Café da manhã', time: '07:30', foods: 'Ovos, Aveia', macros: 'P 32 g | C 58 g | G 18 g' }],
    }],
    selectedStudent: { id: 'student-1', name: 'Aluno Demonstração' },
  }))
  assert.match(planMarkup, /nutrition-student-plan-list-v2/)
  assert.match(planMarkup, /nutrition-plan-summary-main-v3/)
  assert.match(planMarkup, /nutrition-plan-summary-title-v3/)
  assert.match(planMarkup, /nutrition-plan-summary-meta-v3/)
  assert.match(planMarkup, /Minha dieta/)
  assert.doesNotMatch(planMarkup, /Dietas disponíveis/)
  assert.doesNotMatch(planMarkup, /Aluno: Aluno Demonstração/)

  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')
  assert.match(css, /nutrition-student-plan-list-v2/)
  assert.match(css, /nutrition-meal-macros-v2/)
  assert.match(css, /nutrition-meal-accordion-trigger-v3/)
  assert.match(css, /nutrition-meal-accordion-content-v3/)
  assert.match(css, /--diet-surface-raised:\s*#ffffff/)
  assert.match(css, /\.student-sidebar-nav-icon\.app-nav-tone-icon[^}]*color:\s*rgb\(var\(--nav-tone/s)
  assert.match(css, /\.nutrition-plan-summary-title-v3[^}]*overflow-wrap:\s*normal/s)
  assert.match(css, /safe-area-inset-bottom/)
  console.log('student workout and diet presentation tests passed')
} finally {
  await server.close()
}
