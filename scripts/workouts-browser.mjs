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
    { name: 'rascunho-salvo', students: [student], workouts: [{ ...workout, active: false }] },
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
        localStorage.setItem('coachfitpro-ui-theme-20260831', 'light')
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
          if (scenario.students.length) {
            const manager = page.locator('.mobile-workout-manager')
            await manager.getByRole('tab', { name: /Alunos/ }).click()
            const studentCard = manager.locator('.mobile-workout-student-card').filter({ hasText: student.name })
            await studentCard.waitFor()
            await studentCard.getByRole('button', { name: 'Criar treino', exact: true }).click()
            const recoveryDialog = page.getByRole('dialog').filter({ hasText: 'Já existe uma edição salva' })
            if (await recoveryDialog.count()) {
              await recoveryDialog.getByRole('button', { name: 'Descartar e começar outro', exact: true }).click()
            }
            const creator = manager.locator('.mobile-workout-creator')
            await creator.waitFor({ state: 'visible', timeout: 5000 }).catch(async () => {
              const context = {
                managerText: (await manager.innerText()).slice(0, 1400),
                dialogs: await page.locator('[role="dialog"]').allTextContents(),
                errors,
              }
              throw new Error(`O rascunho direcionado ao aluno não abriu o criador: ${JSON.stringify(context)}`)
            })
            await creator.locator('.mobile-workout-stepper').getByRole('button', { name: /Aluno/ }).click()
            const studentSelect = creator.locator('select[name="studentId"]')
            await studentSelect.waitFor()
            assert.equal(await studentSelect.inputValue(), student.id, 'O criador deve manter o aluno QA selecionado')
            await creator.locator('.mobile-workout-creator-head').getByRole('button', { name: 'Fechar', exact: true }).click()
          }
          if (scenario.workouts.length) assert.ok(await page.getByText('Rotina Regressão', { exact: true }).count())
          if (scenario.name === 'rascunho-salvo') assert.ok(await page.getByRole('button', { name: 'Continuar rascunho', exact: true }).count())
          results.push(`${viewport.width} / ${scenario.name} / ${action}: PASS`)
        }
        if (scenario.name === 'com-treinos') {
          const workoutManager = page.locator('.mobile-workout-manager')
          await workoutManager.getByRole('tab', { name: /Planos/ }).click()
          const planIntro = workoutManager.locator('.trainer-workout-plan-list-intro-v2')
          await planIntro.waitFor({ state: 'visible' })
          assert.equal((await planIntro.locator('h4').innerText()).trim(), 'Seus planos')
          assert.match(await planIntro.locator('div > span').innerText(), /Selecione um plano para ver detalhes/)
          const introGeometry = await planIntro.evaluate((panel) => {
            const panelRect = panel.getBoundingClientRect()
            const countRect = panel.querySelector(':scope > strong')?.getBoundingClientRect()
            return { panelWidth: panel.clientWidth, panelScrollWidth: panel.scrollWidth, panelRight: panelRect.right, countRight: countRect?.right ?? null }
          })
          assert.ok(introGeometry.panelScrollWidth <= introGeometry.panelWidth + 1, `O cabeçalho não deve criar overflow em ${viewport.width}px: ${JSON.stringify(introGeometry)}`)
          assert.ok(introGeometry.countRight !== null && introGeometry.countRight <= introGeometry.panelRight + 1, `A contagem deve permanecer dentro do painel em ${viewport.width}px: ${JSON.stringify(introGeometry)}`)
          const publishedPlanRow = page.locator('.trainer-workout-plan-row').filter({ hasText: 'Rotina Regressão' }).first()
          await publishedPlanRow.waitFor()
          const archiveGeometry = await publishedPlanRow.evaluate((row) => {
            const rowRect = row.getBoundingClientRect()
            const archiveRect = row.querySelector('.trainer-workout-plan-row-actions button:last-child')?.getBoundingClientRect()
            return { cardBottom: rowRect.bottom, archiveBottom: archiveRect?.bottom ?? null }
          })
          assert.ok(archiveGeometry.archiveBottom !== null && archiveGeometry.archiveBottom <= archiveGeometry.cardBottom + 1, `Arquivar deve ficar contido no cartão em ${viewport.width}px: ${JSON.stringify(archiveGeometry)}`)
          await publishedPlanRow.locator('.trainer-workout-plan-row-main').click()
          const publishedActions = page.locator('.mobile-workout-action-bar')
          await publishedActions.waitFor()
          assert.deepEqual(await publishedActions.locator('.is-secondary').evaluate((button) => {
            const style = getComputedStyle(button)
            return { background: style.backgroundColor, color: style.color }
          }), { background: 'rgb(223, 243, 238)', color: 'rgb(7, 95, 83)' })
          assert.deepEqual(await publishedActions.locator('.is-accent').evaluate((button) => {
            const style = getComputedStyle(button)
            return { background: style.backgroundColor, color: style.color }
          }), { background: 'rgb(8, 125, 108)', color: 'rgb(255, 255, 255)' })
          await page.screenshot({ path: resolve(output, `after-${viewport.width}.png`) })
          const darkModeButton = page.getByRole('button', { name: 'Ativar modo escuro', exact: true }).first()
          assert.ok(await darkModeButton.count(), 'O alternador de tema deve permanecer disponível em Treinos')
          await darkModeButton.click()
          await page.locator('.app-theme-dark').first().waitFor({ state: 'visible' })
          await page.waitForTimeout(220)
          const darkNavSurface = await page.locator('.coach-nav-item:not([aria-current="page"])').first().evaluate((button) => {
            const style = getComputedStyle(button)
            return { background: style.backgroundColor, color: style.color }
          })
          const darkNavChannels = darkNavSurface.background.match(/[\d.]+/g)?.map(Number) || []
          const darkNavUsesDarkSurface = darkNavChannels.length >= 4
            ? darkNavChannels[3] <= 0.1
            : darkNavChannels.length === 3 && darkNavChannels.every((channel) => channel < 80)
          assert.ok(darkNavUsesDarkSurface, `Menu escuro deve usar superfície escura, recebido ${JSON.stringify(darkNavSurface)}`)
          await page.screenshot({ path: resolve(output, `after-dark-${viewport.width}.png`) })
          await page.getByRole('button', { name: 'Ativar modo claro', exact: true }).first().click()
          await page.getByRole('button', { name: 'Criar treino', exact: true }).click()
          const newDraftRecovery = page.getByRole('dialog').filter({ hasText: 'Já existe uma edição salva' })
          if (await newDraftRecovery.count()) {
            await newDraftRecovery.getByRole('button', { name: 'Descartar e começar outro', exact: true }).click()
          }
          await page.locator('.mobile-workout-creator').waitFor({ state: 'visible' })
          await page.getByText('Criar novo treino', { exact: true }).waitFor()
          assert.ok(await page.locator('.mobile-workout-student-picker').count(), 'O aluno deve aparecer em um seletor contextual')
          await page.getByLabel('Nome da rotina', { exact: true }).fill(`Rotina QA ${viewport.width}`)
          await page.screenshot({ path: resolve(output, `student-picker-${viewport.width}.png`) })
          for (const step of ['Aluno', 'Dias', 'Exercícios', 'Revisar']) {
            assert.ok(await page.getByRole('button', { name: new RegExp(step) }).count(), `Etapa ${step} deve estar visível`)
          }
          await page.getByRole('button', { name: 'Continuar', exact: true }).click()
          const addFirstDayButton = page.getByRole('button', { name: 'Adicionar primeiro dia', exact: true }).first()
          if (await addFirstDayButton.count()) {
            await addFirstDayButton.click()
            await page.getByRole('dialog', { name: 'Editar dia do treino', exact: true }).getByRole('button', { name: 'Salvar dia', exact: true }).click()
            await page.getByRole('button', { name: 'Continuar para exercícios', exact: true }).click()
          } else {
            await page.getByRole('button', { name: 'Continuar para exercícios', exact: true }).click()
          }
          await page.getByRole('button', { name: /Adicionar (primeiro )?exercício/ }).first().click()
          const picker = page.getByRole('dialog', { name: 'Adicionar exercício', exact: true })
          await picker.waitFor({ state: 'visible' })
          const exerciseCards = picker.locator('.mobile-workout-picker-card-v2')
          assert.ok(await exerciseCards.count() >= 100, 'O catalogo curado deve manter pelo menos 100 exercicios uteis')
          const scrollCue = picker.getByRole('button', { name: 'Ver mais exercícios abaixo', exact: true })
          await scrollCue.waitFor({ state: 'visible' })
          await scrollCue.click()
          await page.waitForFunction(() => document.querySelector('.mobile-workout-picker-results')?.scrollTop > 20)
          await picker.locator('.mobile-workout-picker-results').evaluate((list) => { list.scrollTop = 0 })
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
          assert.equal(await detail.locator('.mobile-workout-creator-head h4').count(), 1, 'A prévia deve identificar o exercício aberto')
          assert.equal(await detail.getByText('Dica técnica', { exact: true }).count(), 1, 'A prévia deve mostrar a orientação técnica real')
          assert.equal(await detail.getByText('Erro comum', { exact: true }).count(), 1, 'A prévia deve mostrar um erro comum a evitar')
          await detail.screenshot({ path: resolve(output, `exercise-preview-${viewport.width}.png`) })
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
          assert.ok(await exerciseCards.count() >= 100, 'A busca limpa deve restaurar o catalogo curado')
          await page.screenshot({ path: resolve(output, `picker-${viewport.width}.png`), fullPage: true })
          await picker.getByRole('button', { name: 'Adicionar', exact: true }).first().click()
          await picker.getByRole('button', { name: 'Adicionar', exact: true }).first().click()
          await picker.getByRole('button', { name: 'Adicionar', exact: true }).first().click()
          await picker.getByRole('button', { name: 'Fechar', exact: true }).click()
          assert.equal(await page.locator('.mobile-workout-live-preview').count(), 0, 'A montagem não deve manter uma prévia lateral concorrente')
          assert.equal(await page.locator('.mobile-workout-exercises .exercise-thumb').count(), 0, 'Exercícios adicionados não devem exibir miniaturas provisórias')
          await page.getByRole('button', { name: 'Prévia completa do aluno', exact: true }).click()
          const preview = page.getByRole('dialog', { name: 'Prévia completa da jornada do aluno', exact: true })
          await preview.waitFor({ state: 'visible' })
          const expectedExerciseCount = await preview.locator('.student-workout-figma-sequence-row').count()
          assert.ok(expectedExerciseCount >= 3, `A prévia deve conservar os exercícios reais do dia ativo; encontrado(s): ${expectedExerciseCount}`)
          await preview.getByRole('tab', { name: 'Execução', exact: true }).click()
          assert.ok(await preview.getByRole('button', { name: 'Concluir série', exact: true }).count())
          assert.ok(await preview.getByLabel('Carga (kg)', { exact: true }).count())
          assert.ok(await preview.getByLabel('Repetições realizadas', { exact: true }).count())
          assert.equal(await preview.locator('.mobile-workout-day-preview-student-shell.student-mobile-shell').count(), 1, 'A prévia deve usar o mesmo shell visual do aluno')
          assert.equal(await preview.locator('.mobile-workout-day-preview-head-v2').evaluate((element) => getComputedStyle(element).backgroundColor), 'rgb(244, 251, 249)', 'O cabeçalho da prévia clara não pode permanecer preto')
          assert.equal(await preview.locator('.is-compact').count(), 0, 'A prévia não deve usar uma versão compacta diferente da tela real')
          assert.equal(await preview.locator('.mobile-workout-current-heading-v5 h4').evaluate((heading) => {
            const rect = heading.getBoundingClientRect()
            const styles = getComputedStyle(heading)
            return rect.width >= 160 && styles.wordBreak !== 'break-all'
          }), true, 'O nome do exercício deve permanecer legível sem empilhar letras')
          const exerciseHeading = preview.locator('.mobile-workout-current-heading-v5 h4')
          const progressHead = preview.locator('.student-workout-figma-progress-head')
          assert.equal(await exerciseHeading.count(), 1, 'A prévia deve manter o título do exercício da execução real')
          assert.equal(await progressHead.count(), 1, 'A execução deve manter o timer compacto e o progresso de séries')
          assert.equal(await preview.evaluate((root) => {
            const heading = root.querySelector('.mobile-workout-current-heading-v5')
            const progress = root.querySelector('.student-workout-figma-progress-head')
            return Boolean(progress && heading && progress.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING)
          }), true, 'O tempo e o progresso devem preceder o título do exercício no layout atual')
          assert.equal(await progressHead.evaluate((element) => {
            const text = element.querySelector('span')
            const bounds = element.getBoundingClientRect()
            return Boolean(text && /\d{2}:\d{2}:\d{2} de treino/.test(text.innerText) && element.scrollWidth <= element.clientWidth + 1 && text.getBoundingClientRect().right <= bounds.right + 1)
          }), true, 'O cronômetro compacto deve permanecer visível e contido no progresso')
          assert.equal(await preview.locator('.student-workout-figma-media').count(), 1, 'A prévia deve mostrar a ficha real de execução do exercício')
          assert.ok(await preview.locator('.student-workout-figma-media').locator('details, a, .student-workout-figma-technique-preview').count() > 0, 'A mídia ou técnica deve permanecer acessível ao aluno')
          assert.equal(await preview.getByRole('button', { name: 'Concluir série', exact: true }).first().evaluate((element) => getComputedStyle(element).backgroundColor), 'rgb(8, 125, 108)', 'Ação principal deve usar o verde do branding')
          const endAction = preview.locator('.student-workout-end-subtle')
          assert.equal(await endAction.count(), 1, 'Encerrar treino deve continuar disponível como ação secundária')
          assert.equal(await endAction.evaluate((element) => element.getBoundingClientRect().height >= 40 && getComputedStyle(element).backgroundColor !== 'rgb(8, 125, 108)'), true, 'Encerrar treino deve permanecer tocável e visualmente secundário')
          assert.deepEqual(await preview.locator('.student-workout-figma-execution-topbar > button:first-child').evaluate((element) => {
            const styles = getComputedStyle(element)
            return {
              rounded: Number.parseFloat(styles.borderRadius) >= 20,
              touchHeight: element.getBoundingClientRect().height >= 44,
            }
          }), { rounded: true, touchHeight: true }, 'Voltar deve ser arredondado e confortável para toque')
          const clipping = await preview.evaluate(root => [root, ...root.querySelectorAll('*')].filter(el => /^(hidden|clip)$/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 2).map(el => el.className))
          assert.deepEqual(clipping, [], 'A prévia não pode esconder séries ou conclusão')
          assert.equal(await preview.getByRole('button', { name: 'Concluir treino', exact: true }).count(), 0, 'A conclusão do treino não deve aparecer antes das séries')
          for (let exerciseIndex = 0; exerciseIndex < expectedExerciseCount; exerciseIndex++) {
            let setSteps = 0
            while (!(await preview.locator('.student-workout-figma-exercise-complete').count())) {
              assert.ok(setSteps < 20, `O exercício ${exerciseIndex + 1} deve chegar à tela de conclusão após registrar as séries`)
              setSteps += 1
              await preview.getByLabel('Carga (kg)', { exact: true }).fill('20')
              await preview.getByLabel('Repetições realizadas', { exact: true }).fill('10')
              await preview.getByRole('button', { name: 'Concluir série', exact: true }).click()
              if (await preview.locator('.student-workout-figma-rest').count()) {
                await preview.getByRole('button', { name: 'Pular descanso', exact: true }).click()
              }
            }
            const exerciseAction = preview.locator('.student-workout-figma-bottom-actions button')
            if (exerciseIndex < expectedExerciseCount - 1) {
              assert.match(await exerciseAction.innerText(), /^Ir para /, 'A conclusão do exercício deve apontar para o próximo movimento real do plano')
              await exerciseAction.click()
              await preview.locator('[data-preview-screen="execution"]').waitFor()
            } else {
              assert.equal(await preview.getByRole('button', { name: 'Concluir treino', exact: true }).count(), 1, `A conclusão final só aparece após todas as séries; ação atual: ${(await exerciseAction.innerText()).trim()}; tela: ${(await preview.locator('.student-workout-figma-exercise-complete').innerText()).slice(0, 500)}`)
              await preview.getByRole('button', { name: 'Concluir treino', exact: true }).click()
            }
          }
          await preview.getByText(/Simulação concluída/).waitFor()
          assert.equal(await preview.locator('.student-workout-rating-panel[data-preview-rating="true"]').count(), 1, 'O resumo deve mostrar a avaliação apenas como prévia')
          assert.equal(await preview.locator('.student-workout-rating-submit').isDisabled(), true, 'A prévia não deve enviar a avaliação')
          assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('fitcoach-ai-pro-v2')).workoutLogs.length), 0, 'Simulação não grava XP')
          await page.screenshot({ path: resolve(output, `builder-${viewport.width}.png`), fullPage: true })
          await preview.getByRole('button', { name: 'Fechar', exact: true }).click()
          await page.getByRole('button', { name: 'Revisar treino', exact: true }).click()
          await page.locator('.mobile-workout-manager').getByRole('button', { name: 'Publicar treino', exact: true }).click()
          const publishConfirmation = page.getByRole('dialog', { name: 'Confirmar publicação do treino', exact: true })
          await publishConfirmation.waitFor({ state: 'visible' })
          assert.equal(await publishConfirmation.getByText(student.name, { exact: true }).count(), 1, 'A confirmação deve identificar o aluno destinatário')
          assert.equal(await publishConfirmation.getByRole('button', { name: 'Voltar à revisão', exact: true }).count(), 1, 'A confirmação deve permitir voltar sem gravar')
          await publishConfirmation.getByRole('button', { name: 'Publicar treino', exact: true }).click()
          await page.getByText('Treino publicado e atribuído ao aluno.', { exact: true }).waitFor()
          await page.reload()
          const saved = await page.evaluate(title => JSON.parse(localStorage.getItem('fitcoach-ai-pro-v2')).workouts.find(item => item.title === title), `Rotina QA ${viewport.width}`)
          assert.equal(saved.studentId, student.id)
          assert.ok(saved.exercises.length >= expectedExerciseCount, `O treino publicado deve preservar os exercícios mostrados na prévia; salvo=${saved.exercises.length}, prévia do dia=${expectedExerciseCount}`)
          const publishedRow = page.locator('.trainer-workout-plan-row').filter({ hasText: `Rotina QA ${viewport.width}` }).first()
          await publishedRow.waitFor()
          await publishedRow.locator('.trainer-workout-plan-row-main').click()
          const planActions = page.locator('.mobile-workout-action-bar.trainer-workout-detail-actions')
          await planActions.getByRole('button', { name: 'Visão do aluno', exact: true }).click()
          const modal = page.getByRole('dialog', { name: 'Visão do aluno', exact: true })
          await modal.getByRole('tab', { name: 'Execução', exact: true }).click()
          assert.equal(
            await modal.getByRole('button', { name: 'Concluir treino', exact: true }).count(),
            0,
            'A visão do aluno não deve oferecer conclusão antes de registrar as séries',
          )
          assert.ok(await modal.getByRole('button', { name: 'Concluir série', exact: true }).count() > 0, 'A visão do aluno deve manter a ação real de concluir série')
          const modalOverflow = await modal.evaluate((element) => ({ scrollWidth: element.scrollWidth, clientWidth: element.clientWidth }))
          assert.ok(modalOverflow.scrollWidth <= modalOverflow.clientWidth + 1, `Modal deve caber sem corte horizontal: ${JSON.stringify(modalOverflow)}`)
          await page.screenshot({ path: resolve(output, `expanded-${viewport.width}.png`) })
          await modal.locator('.student-workout-figma-progress-head').scrollIntoViewIfNeeded()
          await page.screenshot({ path: resolve(output, `timer-${viewport.width}.png`) })
          await modal.locator('.student-workout-figma-media').scrollIntoViewIfNeeded()
          await page.screenshot({ path: resolve(output, `exercise-technique-${viewport.width}.png`) })
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
