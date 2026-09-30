import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'

// Optional browser verification. Install Playwright separately; the default
// regression suite needs only the project's existing React/Vite dependencies.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')
const root = resolve(process.env.TEST_APP_ROOT || '.')
const output = resolve(process.env.TEST_OUTPUT_DIR || '../diagnostics')
const expectFailure = process.env.EXPECT_ORIGINAL_FAILURE === '1'
mkdirSync(output, { recursive: true })
const server = await createServer({
  root, mode: 'test', envFile: false,
  define: { 'import.meta.env.VITE_SUPABASE_URL': 'undefined', 'import.meta.env.VITE_SUPABASE_ANON_KEY': 'undefined' },
  server: { host: '127.0.0.1', port: 0, hmr: false },
})
await server.listen()
let browser
const results = []
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}),
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  })
  const student = { id: 'student-regression', name: 'Aluno Regressão', goal: 'Hipertrofia', level: 'Intermediário' }
  const workout = { id: 'workout-regression', studentId: student.id, title: 'Rotina Regressão', active: true, exercises: [{ name: 'Supino reto com barra', sets: '3', reps: '10', rest: '60s' }] }
  const scenarios = [
    { name: 'sem-treinos', students: [student], workouts: [] },
    { name: 'com-treinos', students: [student], workouts: [workout] },
    { name: 'sem-alunos', students: [], workouts: [] },
    { name: 'exercicios-nulos', students: [student], workouts: [{ ...workout, exercises: null }] },
  ]
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 768, height: 900 }, { width: 430, height: 932 }, { width: 414, height: 896 }, { width: 390, height: 844 }, { width: 360, height: 740 }, { width: 320, height: 740 }].filter(item => !process.env.QA_WIDTHS || process.env.QA_WIDTHS.split(',').includes(String(item.width)))) {
    for (const scenario of (expectFailure ? scenarios.slice(0, 1) : scenarios).filter(item => !process.env.QA_SCENARIO || process.env.QA_SCENARIO === item.name)) {
      const context = await browser.newContext({ viewport })
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', (error) => errors.push(error.stack))
      page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
      // Only external media is stubbed; app modules, route, hooks, state and
      // renderers execute unchanged. No real accounts or database writes.
      await context.route('**/*', (route) => {
        const url = new URL(route.request().url())
        return url.hostname === '127.0.0.1' ? route.continue() : route.fulfill({ status: 204, body: '' })
      })
      await context.addInitScript((data) => {
        if (sessionStorage.getItem('regression-seeded')) return
        localStorage.setItem('fitcoach-ai-pro-v2', JSON.stringify(data))
        sessionStorage.setItem('regression-seeded', '1')
      }, { user: { id: 'coach-regression', name: 'Treinador Regressão' }, students: scenario.students, workouts: scenario.workouts })
      const base = server.resolvedUrls.local[0]
      await page.goto(base + '?area=visao')
      if (viewport.width < 1024) await page.getByRole('button', { name: 'Abrir menu', exact: true }).click()
      await page.locator('.coach-nav-item').filter({ hasText: /^Treinos$/ }).click()
      if (expectFailure) {
        await page.getByText('Algo saiu do lugar, mas seus dados continuam seguros.', { exact: true }).waitFor()
        const diagnostic = await page.evaluate(() => JSON.parse(localStorage.getItem('coachfitpro-last-error')))
        assert.equal(diagnostic.message, 'editingPlan is not defined')
        writeFileSync(resolve(output, `browser-before-${viewport.width}.json`), JSON.stringify(diagnostic, null, 2))
        await page.screenshot({ path: resolve(output, `before-${viewport.width}.png`) })
        console.log(`Original ${viewport.width}: ${diagnostic.message}\n${diagnostic.stack}`)
      } else {
        for (const action of ['menu', 'url-direta', 'refresh']) {
          if (action === 'url-direta') await page.goto(base + '?area=treinos')
          if (action === 'refresh') await page.reload()
          await page.locator('.mobile-workout-manager').waitFor({ state: 'visible' })
          assert.equal(new URL(page.url()).searchParams.get('area'), 'treinos')
          assert.equal(await page.evaluate(() => localStorage.getItem('coachfitpro-last-error')), null)
          const viewportMetrics = await page.evaluate(() => ({
            clientWidth: document.documentElement.clientWidth,
            scrollWidth: document.documentElement.scrollWidth,
          }))
          assert.ok(viewportMetrics.scrollWidth <= viewportMetrics.clientWidth + 1, `Treinos não deve criar overflow horizontal em ${viewport.width}px`)
          const clippedFilters = await page.locator('.mobile-workout-filters button').evaluateAll((buttons) => buttons.filter((button) => {
            const buttonRect = button.getBoundingClientRect()
            const containerRect = button.parentElement.getBoundingClientRect()
            return buttonRect.left < containerRect.left - 1 || buttonRect.right > containerRect.right + 1
          }).length)
          assert.equal(clippedFilters, 0, `Todos os filtros devem ficar visíveis em ${viewport.width}px`)
          if (scenario.students.length) assert.equal(await page.locator('select[name="studentId"]').last().inputValue(), student.id)
          if (scenario.workouts.length) assert.ok(await page.getByText('Rotina Regressão', { exact: true }).count())
          results.push(`${viewport.width} / ${scenario.name} / ${action}: PASS`)
        }
        if (scenario.name === 'com-treinos') {
          await page.screenshot({ path: resolve(output, `after-${viewport.width}.png`) })
          const darkModeButton = page.getByRole('button', { name: 'Ativar modo escuro', exact: true }).first()
          assert.ok(await darkModeButton.count(), 'O alternador de tema deve permanecer disponível em Treinos')
          await darkModeButton.click()
          await page.locator('.app-theme-dark').first().waitFor({ state: 'visible' })
          await page.screenshot({ path: resolve(output, `after-dark-${viewport.width}.png`) })
          await page.getByRole('button', { name: 'Ativar modo claro', exact: true }).first().click()
          await page.getByRole('button', { name: 'Criar treino', exact: true }).click()
          await page.getByText('Criar novo treino', { exact: true }).waitFor()
          assert.ok(await page.locator('.mobile-workout-student-picker').count(), 'O aluno deve aparecer em um seletor contextual')
          await page.getByLabel('Nome da rotina', { exact: true }).fill(`Rotina QA ${viewport.width}`)
          await page.screenshot({ path: resolve(output, `student-picker-${viewport.width}.png`) })
          for (const step of ['Aluno', 'Dias', 'Exercícios', 'Revisar']) {
            assert.ok(await page.getByRole('button', { name: new RegExp(step) }).count(), `Etapa ${step} deve estar visível`)
          }
          await page.getByRole('button', { name: 'Continuar', exact: true }).click()
          await page.getByRole('button', { name: 'Adicionar primeiro dia', exact: true }).first().click()
          await page.getByRole('dialog', { name: 'Editar dia do treino', exact: true }).getByRole('button', { name: 'Salvar dia', exact: true }).click()
          await page.getByRole('button', { name: 'Continuar para exercícios', exact: true }).click()
          await page.getByRole('button', { name: /Adicionar (primeiro )?exercício/ }).first().click()
          const picker = page.getByRole('dialog', { name: 'Adicionar exercício', exact: true })
          await picker.waitFor({ state: 'visible' })
          const exerciseCards = picker.locator('.mobile-workout-picker-card-v2')
          assert.ok(await exerciseCards.count() >= 300)
          assert.equal(await picker.locator('.exercise-thumb').count(), 0, 'O catálogo não deve exibir ícones provisórios de exercício')
          assert.equal(await picker.locator('.mobile-workout-picker-check').count(), 0, 'Não deve existir um segundo botão de adicionar')
          assert.equal(
            await picker.getByRole('button', { name: /^(Adicionar|✓ Adicionado)$/ }).count(),
            await exerciseCards.count(),
            'Cada exercício deve ter exatamente um botão verde de adicionar',
          )
          assert.ok(await picker.getByText(/exercícios? selecionados?/).count())
          await exerciseCards.first().getByRole('button', { name: 'Favoritar exercício', exact: true }).click()
          await picker.getByRole('button', { name: 'Favoritos', exact: true }).click()
          assert.equal(await exerciseCards.count(), 1)
          await exerciseCards.first().getByRole('button', { name: 'Ver', exact: true }).click()
          const detail = page.getByRole('dialog', { name: 'Prévia do exercício', exact: true })
          await detail.waitFor()
          await detail.getByRole('button', { name: 'Fechar', exact: true }).click()
          await exerciseCards.first().getByRole('button', { name: 'Remover dos favoritos', exact: true }).click()
          assert.equal(await exerciseCards.count(), 0)
          await picker.getByRole('button', { name: 'Favoritos', exact: true }).click()
          const search = picker.getByPlaceholder(/Buscar: supino/)
          await search.fill('supino')
          assert.ok(await exerciseCards.count() > 0)
          await search.fill('zzzzqa-inexistente')
          assert.equal(await exerciseCards.count(), 0)
          await search.fill('')
          assert.ok(await exerciseCards.count() >= 300)
          await page.screenshot({ path: resolve(output, `picker-${viewport.width}.png`), fullPage: true })
          await picker.getByRole('button', { name: 'Adicionar', exact: true }).first().click()
          await picker.getByRole('button', { name: 'Adicionar', exact: true }).first().click()
          await picker.getByRole('button', { name: 'Adicionar', exact: true }).first().click()
          await picker.getByRole('button', { name: 'Fechar', exact: true }).click()
          await page.locator('.mobile-workout-live-preview').waitFor({ state: 'visible' })
          assert.ok(await page.getByText('Prévia ao vivo', { exact: true }).count())
          assert.ok(await page.getByRole('button', { name: 'Concluir série', exact: true }).count())
          assert.ok(await page.getByLabel('Carga (kg)', { exact: true }).count())
          assert.ok(await page.getByLabel('Repetições', { exact: true }).count())
          const preview = page.locator('.mobile-workout-live-preview')
          assert.equal(await preview.locator('.mobile-workout-live-preview-device.student-mobile-shell').count(), 1, 'A prévia deve usar o mesmo shell visual do aluno')
          assert.equal(await preview.locator('.is-compact').count(), 0, 'A prévia não deve usar uma versão compacta diferente da tela real')
          assert.equal(await preview.locator('.mobile-workout-current-heading-v5 h4').evaluate((heading) => {
            const rect = heading.getBoundingClientRect()
            const styles = getComputedStyle(heading)
            return rect.width >= 160 && styles.wordBreak !== 'break-all'
          }), true, 'O nome do exercício deve permanecer legível sem empilhar letras')
          const muscleMap = preview.locator('.mobile-workout-muscle-target-anatomy-v6')
          assert.equal(await muscleMap.count(), 1, 'A prévia deve exibir um único mapa muscular anatômico')
          assert.ok(await muscleMap.locator('.muscle-map-region.is-primary').count() > 0, 'O músculo principal deve estar destacado')
          assert.equal(await preview.locator('.mobile-workout-muscle-target-compact-v5').count(), 0, 'O boneco simplificado não deve permanecer na execução')
          assert.equal(await preview.evaluate((root) => {
            const heading = root.querySelector('.mobile-workout-current-heading-v5')
            const map = root.querySelector('.mobile-workout-muscle-target-anatomy-v6')
            const timer = root.querySelector('.mobile-workout-timer-panel-v5')
            return Boolean(heading && map && timer && heading.compareDocumentPosition(map) & Node.DOCUMENT_POSITION_FOLLOWING && map.compareDocumentPosition(timer) & Node.DOCUMENT_POSITION_FOLLOWING)
          }), true, 'O mapa muscular deve ficar entre o nome do exercício e o timer')
          assert.equal(await preview.locator('.mobile-workout-timer-panel-v5').evaluate((timer) => {
            const value = timer.querySelector('.mobile-workout-session-timer-v5 > strong')
            return timer.scrollWidth <= timer.clientWidth + 1 && value && value.getBoundingClientRect().right <= timer.getBoundingClientRect().right + 1
          }), true, 'O cronômetro deve permanecer contido no card')
          assert.equal(await preview.locator('.mobile-workout-orientations-v4').evaluate((element) => getComputedStyle(element).backgroundColor), 'rgb(234, 245, 242)', 'Orientações do coach deve receber destaque teal suave')
          assert.equal(await preview.getByRole('button', { name: 'Concluir série', exact: true }).first().evaluate((element) => getComputedStyle(element).backgroundColor), 'rgb(8, 125, 108)', 'Ação principal deve usar o verde do branding')
          assert.equal(await preview.locator('.mobile-workout-end-trigger-v5').evaluate((element) => getComputedStyle(element).backgroundColor), 'rgb(243, 207, 124)', 'Encerrar treino deve usar o âmbar de atenção')
          assert.equal(await preview.locator('.mobile-workout-finalize-primary-v5').evaluate((element) => getComputedStyle(element).backgroundColor), 'rgb(169, 199, 192)', 'Finalizar treino desabilitado deve manter fundo visível')
          assert.deepEqual(await preview.locator('.mobile-workout-execution-head-v4 > button:first-child').evaluate((element) => {
            const styles = getComputedStyle(element)
            return {
              background: styles.backgroundColor,
              rounded: Number.parseFloat(styles.borderRadius) >= 20,
              touchHeight: element.getBoundingClientRect().height >= 44,
            }
          }), { background: 'rgb(234, 245, 242)', rounded: true, touchHeight: true }, 'Voltar deve ser arredondado, confortável e integrado ao tema claro')
          const clipping = await preview.evaluate(root => [root, ...root.querySelectorAll('*')].filter(el => /^(hidden|clip)$/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 2).map(el => el.className))
          assert.deepEqual(clipping, [], 'A prévia não pode esconder séries ou conclusão')
          assert.equal(
            await preview.getByRole('button', { name: 'Finalizar treino', exact: true }).isDisabled(),
            true,
            'Finalizar treino deve permanecer indisponível antes de concluir as séries',
          )
          for (let exerciseIndex = 0; exerciseIndex < 3; exerciseIndex++) {
            const reps = preview.getByLabel('Repetições', { exact: true })
            for (let setIndex = 0; setIndex < await reps.count(); setIndex++) await reps.nth(setIndex).fill('10')
            const sets = preview.getByRole('button', { name: 'Concluir série', exact: true })
            while (await sets.count()) await sets.first().click()
            if (exerciseIndex < 2) await preview.getByRole('button', { name: 'Concluir exercício e ir para o próximo →', exact: true }).click()
          }
          await preview.getByRole('button', { name: 'Finalizar treino', exact: true }).click()
          await preview.getByText(/Simulação concluída/).waitFor()
          assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('fitcoach-ai-pro-v2')).workoutLogs.length), 0, 'Simulação não grava XP')
          await page.screenshot({ path: resolve(output, `builder-${viewport.width}.png`), fullPage: true })
          await page.getByRole('button', { name: 'Revisar treino', exact: true }).click()
          page.once('dialog', dialog => dialog.accept())
          await page.getByRole('button', { name: 'Publicar treino', exact: true }).click()
          await page.getByText('Treino publicado e atribuído ao aluno.', { exact: true }).waitFor()
          await page.reload()
          const saved = await page.evaluate(title => JSON.parse(localStorage.getItem('fitcoach-ai-pro-v2')).workouts.find(item => item.title === title), `Rotina QA ${viewport.width}`)
          assert.equal(saved.studentId, student.id)
          assert.equal(saved.exercises.length, 3)
          await page.getByRole('button', { name: 'Visão do aluno', exact: true }).click()
          const modal = page.getByRole('dialog', { name: 'Visão do aluno', exact: true })
          assert.equal(
            await modal.getByRole('button', { name: 'Finalizar treino', exact: true }).isDisabled(),
            true,
            'A visão do aluno não deve finalizar um treino sem séries concluídas',
          )
          assert.equal(await modal.evaluate(el => el.scrollWidth > el.clientWidth + 1), false, 'Modal deve caber sem corte horizontal')
          await page.screenshot({ path: resolve(output, `expanded-${viewport.width}.png`) })
          await modal.locator('.mobile-workout-timer-panel-v5').scrollIntoViewIfNeeded()
          await page.screenshot({ path: resolve(output, `timer-${viewport.width}.png`) })
          await modal.locator('.mobile-workout-orientations-v4').scrollIntoViewIfNeeded()
          await page.screenshot({ path: resolve(output, `orientations-${viewport.width}.png`) })
          await modal.getByRole('button', { name: /Voltar para edição/ }).click()
        }
        if (viewport.width < 1024) await page.getByRole('button', { name: 'Abrir menu', exact: true }).click()
        await page.locator('.coach-nav-item').filter({ hasText: /^Visão geral$/ }).click()
        await page.locator('.coach-dashboard-metrics').waitFor({ state: 'visible' })
        assert.deepEqual(errors, [], 'No browser exceptions or console errors')
      }
      await context.close()
    }
  }
  writeFileSync(resolve(output, expectFailure ? 'browser-before.txt' : 'browser-after.txt'), results.join('\n'))
  if (!expectFailure) console.log(results.join('\n') + `\n${results.length} browser checks passed; return navigation and console checks passed.`)
} finally {
  await browser?.close()
  await server.close()
}
