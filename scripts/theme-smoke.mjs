import { readFileSync } from 'node:fs'

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
const api = readFileSync(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')
const sw = readFileSync(new URL('../public/service-worker.js', import.meta.url), 'utf8')

const checks = [
  ['App uses a build marker', app.includes('COACH_FIT_PRO_BUILD_MARKER')],
  ['App defaults to light theme', app.includes("DEFAULT_UI_THEME = 'light'")],
  ['Authenticated app receives theme class', app.includes('app-theme-${uiTheme}')],
  ['Sales page receives theme class', app.includes('sales-theme-${salesTheme}')],
  ['Theme toggle component exists', app.includes('function ThemeToggle')],
  ['Sales header renders theme toggle', app.includes('theme={salesTheme}')],
  ['App light theme CSS exists', css.includes('.app-theme-light')],
  ['Sales light theme CSS exists', css.includes('.sales-theme-light')],
  ['Theme toggle CSS exists', css.includes('.theme-toggle')],
  ['Service worker cache was bumped', sw.includes('coach-fit-pro-pwa-20260901-nutrition-preview-light-v2')],
  ['Official brand logo constant exists', app.includes('OFFICIAL_BRAND_LOGO = fitCoachLogo')],
  ['BrandLockup does not read stored logoUrl', !/function BrandLockup[\s\S]*?loadLocalAdminSettings\(\)\.logoUrl/.test(app)],
  ['Light theme fixes muted legacy colors', css.includes('.sales-theme-light .sales-rotating-focus')],
  ['Light theme uses sapphire accent', css.includes('--coach-sapphire: #00D2B2')],
  ['Brand primary token exists', css.includes('--brand-primary: #00D2B2')],
  ['White background token exists', css.includes('--background: #FFFFFF')],
  ['Light cards stay white', css.includes('--surface-primary: #FFFFFF')],
  ['Light theme removes dark surface residues', css.includes('.sales-theme-light .from-zinc-950')],
  ['Accessible focus ring uses brand color', css.includes('rgba(0, 210, 178, 0.12)')],
  ['Sales landing premium cleanup exists', css.includes('sales-theme-light-premium-cleanup-v4')],
  ['Sales landing sections are white-first', css.includes('--sales-light-section-bg: #FFFFFF')],
  ['Sales landing dark arbitrary backgrounds are normalized', css.includes('[class*="bg-[#030712]"]')],
  ['Sales landing phone mockups keep contrast intentionally', css.includes('--sales-device-frame: #101820')],
  ['Theme toggle is icon-only', app.includes('theme-toggle-symbol') && !app.includes('theme-toggle-copy')],
  ['Authenticated app premium cleanup exists', css.includes('app-theme-light-premium-cleanup-v5')],
  ['Authenticated app uses white-first token', css.includes('--app-light-bg: #FFFFFF')],
  ['Theme toggle uses natural outline lamp icon', app.includes('theme-toggle-lamp') && app.includes('NavIcon name="lightbulb"') && !app.includes('theme-toggle-bulb')],
  ['Theme toggle lamp has natural CSS polish', css.includes('theme-toggle-lamp-natural-v2') && css.includes('.theme-toggle-lamp.is-on') && css.includes('.theme-toggle-lamp.is-off')],
  ['Only one authenticated theme shortcut per viewport', !app.includes('mt-3 hidden w-full lg:flex')],
  ['Logged app theme shortcut is desktop-only by CSS', /\.coach-page-theme-toggle\s*\{\s*display: none !important;[\s\S]*?@media \(min-width: 1024px\) \{[\s\S]*?\.coach-page-theme-toggle\s*\{\s*display: inline-flex !important;/.test(css)],
  ['Logged app page header has theme shortcut', app.includes('coach-page-theme-toggle')],
  ['Authenticated app dark residues are normalized', css.includes('.app-theme-light [class*="bg-zinc-950"]')],
  ['Light app progress rails keep readable contrast', css.includes('.app-theme-light .h-1\\.5[class*="bg-black"]') && css.includes('rgba(15, 23, 42, 0.08)')],
  ['Nutrition actions are mobile-first', app.includes('nutrition-actions grid gap-3 sm:flex sm:flex-wrap') && app.includes('inline-flex w-full') && app.includes('justify-center') && app.includes('sm:w-auto')],
  ['Quick actions render only on overview', app.includes("{activeView === 'visao' ? (") && app.includes('coach-mobile-quick-actions')],
  ['Dashboard metrics render only on overview', app.includes('coach-dashboard-metrics') && app.includes("activeView === 'visao' ?")],
  ['Notification shortcut appears in app header', app.includes('coach-notification-shortcut') && app.includes("setActiveView('notificacoes')") && app.includes('totalAlertCount')],
  ['Workout add exercise CTA has responsive safe guard', app.includes('mobile-workout-add-exercise-cta') && css.includes('workout-add-cta-responsive-guard')],
  ['Workout add exercise CTA releases desktop grid span', css.includes('.mobile-workout-day-editor-screen .mobile-workout-add-exercise-cta') && css.includes('grid-column: auto;')],
  ['Workout day save button is polished', app.includes('mobile-workout-save-day-action') && css.includes('workout-nutrition-action-polish-v1') && css.includes('.mobile-workout-save-day-action')],
  ['Workout exercise save button is prominent', app.includes('mobile-workout-exercise-save-action') && css.includes('.mobile-workout-exercise-save-action')],
  ['Nutrition primary and secondary actions are polished', app.includes('nutrition-primary-action') && app.includes('nutrition-secondary-action') && css.includes('nutrition-actions-polish-v1')],
  ['Nutrition meal controls are touch friendly', app.includes('nutrition-inline-add-action') && app.includes('nutrition-danger-action') && css.includes('.nutrition-inline-add-action')],
  ['Ranking medals keep visible icons in light theme', app.includes('rank-medal-icon') && css.includes('rank-light-theme-polish-v1') && css.includes('.app-theme-light .rank-medal .rank-medal-icon')],
  ['Ranking panels have dedicated light theme polish', app.includes('student-ranking-panel') && app.includes('student-reward-ranking-card') && css.includes('.app-theme-light .student-ranking-panel')],
  ['Light mode menu icons have dedicated polish', app.includes('coach-menu-icon-shell') && app.includes('coach-nav-item') && css.includes('menu-icon-light-polish-v1') && css.includes('.app-theme-light .coach-nav-item .coach-menu-icon-shell')],
  ['Notification shortcut opens an overlay instead of navigating immediately', app.includes('coach-notification-popover') && app.includes('notificationPopoverOpen') && app.includes('Ver todas as notificações') && app.includes('onOpenAll')],
['Notification overlay supports close controls', app.includes('handleNotificationKeyDown') && app.includes('coach-notification-popover-backdrop') && app.includes('Fechar notificações')],
  ['Sales simulator has refined light theme polish', app.includes('sales-simulator-panel') && app.includes('sales-revenue-note') && css.includes('sales-light-simulator-polish-v1') && css.includes('.sales-theme-light .sales-simulator-panel')],
  ['Sales revenue cards expose horizontal scroll hint', app.includes('sales-revenue-scroll-cards') && app.includes('Arraste para ver mais') && css.includes('.sales-revenue-scroll-cards::after')],
  ['Sales objection copy is clearer', app.includes('Você também pode cadastrar seus próprios exercícios e alimentos, sem ficar preso à biblioteca.')],
  ['First month offer has dedicated highlight', app.includes('sales-first-month-highlight') && css.includes('.sales-theme-light .sales-first-month-highlight')],
  ['Sales plan cards do not show secondary highlight button', !app.includes('Destacar este plano')],
  ['Revenue simulator uses clearer price increase label', app.includes('Aumento na mensalidade por aluno') && !app.includes('Valorização por aluno')],
  ['Workouts light mode has dedicated page polish', css.includes('app-workouts-light-polish-v1') && css.includes('.app-theme-light .workout-exercise-picker') && css.includes('.app-theme-light .mobile-workout-manager')],
  ['Notification shortcut keeps fixed size on desktop', css.includes('notification-shortcut-responsive-v2') && css.includes('.coach-page-notification-shortcut') && css.includes('flex: 0 0 44px')],
  ['Student save uses authenticated coach id', app.includes('const activeCoachId = data.session?.user?.id || data.user?.id') && app.includes('saveRemoteStudent(student, activeCoachId)') && app.includes('createRemoteStudentInvite(savedStudent.id, activeCoachId)')],
  ['Student rows reject missing coach id before hitting RLS', api.includes('function requireCoachId') && api.includes('coach_id: requireCoachId(coachId)')],
  ['Nutrition has professional food expansion', app.includes('nutrition-professional-food-expansion-v1') && app.includes('foodSource:')],
  ['Nutrition suggestions search aliases and preparation tags', app.includes('getFoodSearchTerms') && app.includes('preparation') && app.includes('servings')],
  ['Nutrition assistant has responsive step classes', app.includes('nutrition-assistant-card') && app.includes('nutrition-assistant-steps') && css.includes('nutrition-assistant-responsive-v2')],
  ['Nutrition food item editor has professional layout classes', app.includes('nutrition-food-item-card') && app.includes('nutrition-food-suggestions') && css.includes('nutrition-food-item-responsive-v2')],
  ['Notification badge handles multiple digit counts', css.includes('notification-badge-readable-v3') && css.includes('min-width: 1.35rem') && css.includes('max-width: 2.5rem')],
  ['Nutrition has isolated professional controls', app.includes('nutrition-pro-controls-v1') && app.includes('favoriteFoodNames') && app.includes('recentFoodNames')],
  ['Nutrition offers meal templates without changing database schema', app.includes('nutritionMealTemplates') && app.includes('applyNutritionTemplate')],
  ['Nutrition has student preview mode', app.includes('nutrition-student-preview-v1') && app.includes('Visão do aluno')],
  ['Nutrition professional polish CSS exists', css.includes('nutrition-professional-controls-v1') && css.includes('nutrition-student-preview-responsive-v1')],
  ['Nutrition favorites rail is fast and persistent', app.includes('nutrition-favorites-rail-v2') && app.includes('is-favorite') && app.includes('coachfitpro-favorite-foods') && css.includes('.nutrition-favorite-action.is-favorite svg')],
  ['Nutrition student preview opens through a top-level portal', app.includes('createPortal(') && app.includes('nutrition-student-preview-v2')],
  ['Notification popover has readable responsive desktop sizing', css.includes('notification-popover-desktop-readable-v3') && css.includes('inline-size: clamp(360px, 32vw, 460px)')],
  ['Notification popover has robust internal scroll', css.includes('notification-popover-scroll-v4') && css.includes('overscroll-behavior: contain') && css.includes('scrollbar-gutter: stable') && app.includes('const recentNotifications = notifications || []') && app.includes("numericCount > 99 ? '99+'")],
  ['App persists active view across refresh', app.includes('COACH_ACTIVE_VIEW_STORAGE_KEY') && app.includes('getInitialCoachView') && app.includes('window.history.replaceState')],
  ['Loading screen respects saved theme', app.includes('getStoredUiTheme') && app.includes('app-loading-shell') && css.includes('loading-theme-sync-v1')],
  ['Nutrition assistant uses professional stepper', app.includes('nutrition-stepper-professional-v3') && css.includes('nutrition-stepper-professional-v3') && css.includes('nutrition-step-connector') && css.includes('nutrition-stepper-fluid-v4')],
  ['Nutrition removes artificial food count from UI', !app.includes('foodDatabase.length') && !app.includes('+ alimentos')],
  ['Nutrition layout removes diet title whitespace', app.includes('nutrition-plan-meta-grid-v2') && css.includes('nutrition-layout-density-v3')],
  ['Nutrition preview has theme-aware colors', app.includes('theme={uiTheme}') && app.includes('app-theme-${theme}') && css.includes('nutrition-preview-theme-v3') && css.includes('nutrition-student-preview-portal-theme-v4') && css.includes('.nutrition-student-preview-v2.app-theme-light')],
  ['Nutrition productivity controls exist', app.includes('duplicateMeal(') && app.includes('Duplicar refeição') && app.includes('nutrition-meal-toolbar-v2')],
  ['Nutrition icon is refined', app.includes('nutrition: <><path d="M6 3.5') && app.includes('M17.5 5.5')]
]

const failed = checks.filter(([, passed]) => !passed)

if (failed.length) {
  console.error('Theme smoke check failed:')
  for (const [name] of failed) console.error(`- ${name}`)
  process.exit(1)
}

console.log('Theme smoke check passed')



















