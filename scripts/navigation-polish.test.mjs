import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const cssSource = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
const importDialogSource = readFileSync(new URL('../src/StudentImportDialog.jsx', import.meta.url), 'utf8')
const chatCssSource = readFileSync(new URL('../src/chat/chat.css', import.meta.url), 'utf8')
const xpCssSource = readFileSync(new URL('../src/student-workout-xp-celebration-build35.css', import.meta.url), 'utf8')
const build46CssSource = readFileSync(new URL('../src/build46-ux-polish.css', import.meta.url), 'utf8')
const mainSource = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8')

test('mobile navigation exposes module tones and rounded menu hooks', () => {
  assert.match(appSource, /coach-mobile-menu-panel/)
  assert.match(appSource, /coach-mobile-bottom-button tone-\$\{item\.tone\}/)
  assert.match(appSource, /student-mobile-menu-panel/)
  assert.match(appSource, /student-mobile-nav-button tone-\$\{item\.tone\}/)
  assert.match(appSource, /student-mobile-nav-button tone-emerald/)
})

test('navigation polish styles cover floating shells and module colors', () => {
  assert.match(cssSource, /\.coach-mobile-menu-panel/)
  assert.match(cssSource, /\.student-mobile-menu-panel/)
  assert.match(cssSource, /\.student-bottom-nav\s*\{[^}]*border-radius:/s)
  assert.match(cssSource, /\.tone-lime\s*\{\s*--nav-tone:/)
  assert.match(cssSource, /\.tone-orange\s*\{\s*--nav-tone:/)
  assert.match(cssSource, /\.student-mobile-nav-button\.is-active/)
  assert.match(cssSource, /\.coach-mobile-bottom-button\.is-active/)
})

test('menu profissional fechado fica totalmente fora da viewport mobile', () => {
  assert.match(appSource, /mobileMenuOpen \? 'is-open translate-x-0' : 'is-closed -translate-x-full'/)
  assert.match(cssSource, /\.coach-mobile-menu-panel\.is-closed\s*\{[^}]*translateX\(calc\(-100% - max\(0\.55rem, env\(safe-area-inset-left, 0px\)\)\)\)[^}]*visibility:\s*hidden[^}]*pointer-events:\s*none/s)
  assert.match(cssSource, /\.coach-mobile-menu-panel\.is-open\s*\{[^}]*visibility:\s*visible[^}]*pointer-events:\s*auto/s)
})

test('menu inferior do aluno usa safe area sem criar espaco interno duplicado', () => {
  assert.match(cssSource, /\.student-mobile-shell \.student-bottom-nav\s*\{[^}]*padding-bottom:\s*0\.5rem\s*!important;/s)
})

test('navegacao do treinador permanece fixa e legivel em tablets', () => {
  const tabletStart = cssSource.indexOf('@media (min-width: 768px) and (max-width: 1023px)')
  const tabletRules = cssSource.slice(tabletStart, cssSource.indexOf('@media (min-width: 1024px)', tabletStart))
  assert.match(tabletRules, /\.coach-mobile-bottom-nav\s*\{[^}]*position:\s*fixed[^}]*grid-template-columns:\s*repeat\(5,/s)
  assert.match(tabletRules, /\.coach-auth-shell \.coach-auth-main\s*\{[^}]*padding-bottom:/s)
})

test('menu lateral escuro do treinador usa superfícies e contraste próprios', () => {
  assert.match(cssSource, /coach-dark-sidebar-contrast-v1/)
  assert.match(cssSource, /\.app-theme-dark \.coach-mobile-menu-panel \.coach-nav-item\s*\{[^}]*background:\s*rgba\(255, 255, 255, 0\.035\)/s)
  assert.match(cssSource, /\.app-theme-dark \.coach-mobile-menu-panel \.coach-nav-item:is\(\.is-active, \[aria-current="page"\]\)/)
  assert.match(cssSource, /\.app-theme-dark \.coach-mobile-menu-panel \.coach-nav-item \.coach-menu-icon-shell/)
})

test('hidratacao possui controles semanticos para o tema claro', () => {
  assert.match(appSource, /student-water-action--250/)
  assert.match(appSource, /student-water-action--500/)
  assert.match(appSource, /student-water-action--reset/)
  assert.match(cssSource, /\.app-theme-light \.student-water-action--250/)
  assert.match(cssSource, /\.app-theme-light \.student-water-action--500/)
  assert.match(cssSource, /\.app-theme-light \.student-water-action--reset/)
})

test('menus móveis e importação CSV anunciam estado e mantêm o foco dentro do diálogo', () => {
  assert.match(appSource, /aria-expanded=\{mobileMenuOpen\}/)
  assert.match(appSource, /aria-controls="coach-mobile-menu-panel"/)
  assert.match(appSource, /studentMenuFocusTrapRef/)
  assert.match(appSource, /anamnesisDialogRef = useModalFocusTrap/)
  assert.match(appSource, /credentialsDialogRef = useModalFocusTrap/)
  assert.match(appSource, /if \(event\.key !== 'Tab'\) return/)
  assert.match(importDialogSource, /aria-modal="true"/)
  assert.match(importDialogSource, /event\.key === 'Escape'/)
  assert.match(importDialogSource, /event\.key !== 'Tab'/)
  assert.match(importDialogSource, /previousFocus\?\.isConnected/)
})

test('celebração XP respeita a preferência por movimento reduzido', () => {
  assert.match(xpCssSource, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.student-workout-xp-celebration[\s\S]*?animation:\s*none\s*!important;[\s\S]*?transition-duration:\s*\.01ms\s*!important;/)
})

test('seletor da semana usa botões nativos e áudio possui foco visível nos temas', () => {
  assert.match(appSource, /weekDays\.map\(\(day, dayIndex\) => <button type="button"/)
  assert.doesNotMatch(appSource, /weekDays\.map\(\(day, dayIndex\) => <span[^\n]*role="button"/)
  assert.match(cssSource, /\.student-diet-week-strip-v1 > button:focus-visible/)
  assert.match(cssSource, /font-family: "Plus Jakarta Sans"/)
  assert.match(chatCssSource, /\.chat-audio-play:focus-visible/)
  assert.match(chatCssSource, /\.chat-audio-wave-range:focus-visible/)
})

test('polimento BUILD46 mantém tema, alvos táteis e movimento reduzido', () => {
  assert.ok(mainSource.indexOf("import './build46-ux-polish.css'") > mainSource.indexOf("import './build46-sales-showcase-v0.css'"))
  assert.match(importDialogSource, /data-theme=\{uiTheme\}/)
  assert.match(appSource, /aria-label=\{patientMode \? 'Navegação do paciente' : 'Navegação do aluno'\}/)
  assert.doesNotMatch(appSource, /student-theme-toggle shrink-0 lg:hidden/)
  assert.match(build46CssSource, /\.student-workout-end-subtle[\s\S]*?min-height: 44px/)
  assert.match(build46CssSource, /\.chat-report-message \{ min-height: 44px/)
  assert.match(build46CssSource, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.chat-recording-dot[\s\S]*?\.student-hydration-water::before \{ animation: none !important; \}/)
})
