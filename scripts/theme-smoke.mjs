import { readFileSync } from 'node:fs'

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
const api = readFileSync(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')
const sw = readFileSync(new URL('../public/service-worker.js', import.meta.url), 'utf8')
const version = readFileSync(new URL('../public/version.txt', import.meta.url), 'utf8')

const checks = [
  ['App uses a build marker', app.includes('COACH_FIT_PRO_BUILD_MARKER')],
  ['App defaults to light theme', app.includes("DEFAULT_UI_THEME = 'light'")],
  ['Authenticated app receives theme class', app.includes('app-theme-${uiTheme}')],
  ['Sales page receives theme class', app.includes('sales-theme-${salesTheme}')],
  ['Theme toggle component exists', app.includes('function ThemeToggle')],
  ['Sales header renders theme toggle', app.includes('theme={salesTheme}')],
  ['Login screen uses shared app theme state', app.includes('uiTheme = DEFAULT_UI_THEME, toggleUiTheme = () => {}') && app.includes('const salesTheme = uiTheme') && app.includes('const toggleSalesTheme = toggleUiTheme')],
  ['App light theme CSS exists', css.includes('.app-theme-light')],
  ['Sales light theme CSS exists', css.includes('.sales-theme-light')],
  ['Theme toggle CSS exists', css.includes('.theme-toggle')],
  ['Build marker was bumped for workouts audit', app.includes("COACH_FIT_PRO_BUILD_MARKER = 'nutricao-rls-save-20260909'")],
  ['Service worker cache was bumped', sw.includes('coach-fit-pro-pwa-20260909-nutricao-rls-save-v1')],
  ['Public version file was bumped', version.includes('nutricao-rls-save-v1-20260909')],
  ['Official brand logo constant exists', app.includes('OFFICIAL_BRAND_LOGO = fitCoachLogo')],
  ['BrandLockup does not read stored logoUrl', !/function BrandLockup[\s\S]*?loadLocalAdminSettings\(\)\.logoUrl/.test(app)],
  ['Light theme fixes muted legacy colors', css.includes('.sales-theme-light .sales-rotating-focus')],
  ['Light theme uses sapphire accent', css.includes('--coach-sapphire: #00D2B2')],
  ['Brand primary token exists', css.includes('--brand-primary: #00D2B2')],
  ['Light background token uses requested neutral test base', css.includes('--background: #E0E0E0')],
  ['Light cards stay white', css.includes('--surface-primary: #FFFFFF')],
  ['Light theme removes dark surface residues', css.includes('.sales-theme-light .from-zinc-950')],
  ['Accessible focus ring uses brand color', css.includes('rgba(0, 210, 178, 0.12)')],
  ['Sales landing premium cleanup exists', css.includes('sales-theme-light-premium-cleanup-v4')],
  ['Sales landing sections are white-first', css.includes('--sales-light-section-bg: #FFFFFF')],
  ['Sales landing dark arbitrary backgrounds are normalized', css.includes('[class*="bg-[#030712]"]')],
  ['Sales landing phone mockups keep contrast intentionally', css.includes('--sales-device-frame: #101820')],
  ['Theme toggle is icon-only', app.includes('theme-toggle-symbol') && !app.includes('theme-toggle-copy')],
  ['Authenticated app premium cleanup exists', css.includes('app-theme-light-premium-cleanup-v5')],
  ['Authenticated app uses requested neutral light base token', css.includes('--app-light-bg: #E0E0E0')],
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
  ['Workout quick flow light mode keeps readable contrast', css.includes('workout-light-contrast-polish-v3') && css.includes('.app-theme-light .mobile-workout-stepper button:not(.is-active)') && css.includes('-webkit-text-fill-color: #38514c')],
  ['Workout quick flow day header is solid in light mode', css.includes('workout-light-contrast-polish-v3') && css.includes('.app-theme-light .mobile-workout-day-editor-hero') && css.includes('linear-gradient(135deg, #ffffff 0%, #ecfffb 100%)')],
  ['Workout quick flow actions are touch friendly', css.includes('workout-action-buttons-touch-v3') && css.includes('.mobile-workout-day-open-actions .mobile-workout-primary') && css.includes('min-height: 50px')],
  ['Workout quick flow avoids inline empty-state text collisions', css.includes('workout-empty-state-spacing-v3') && css.includes('.mobile-workout-empty strong,') && css.includes('display: block')],
  ['Workout quick flow guards horizontal overflow', css.includes('workout-no-horizontal-overflow-v3') && css.includes('.mobile-workout-manager *') && css.includes('overflow-x: clip')],
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
  ['Nutrition prescribed and student diet cards are theme-aware', app.includes('nutrition-plan-card-v6') && app.includes('nutrition-plan-meal-card-v6') && app.includes('student-nutrition-current-plan-v1') && css.includes('nutrition-plan-list-theme-v6') && css.includes('.student-mobile-shell.app-theme-light .nutrition-plan-card-v6') && css.includes('.student-mobile-shell.app-theme-light .student-nutrition-current-plan-v1')],
  ['Nutrition productivity controls exist', app.includes('duplicateMeal(') && app.includes('Duplicar refeição') && app.includes('nutrition-meal-toolbar-v2')],
  ['Nutrition icon is refined', app.includes('nutrition: <><path d="M6 3.5') && app.includes('M17.5 5.5')],
  ['Nutrition stepper avoids horizontal clipping', css.includes('nutrition-stepper-no-horizontal-clip-v5') && css.includes('grid-template-columns: repeat(3, minmax(0, 1fr))') && css.includes('overflow: visible !important')],
  ['Nutrition food item grid stays inside card', css.includes('nutrition-food-grid-contained-v5') && css.includes('box-sizing: border-box') && css.includes('grid-template-columns: minmax(0, 1fr)')],
  ['Nutrition prescribed plans empty state is compact', css.includes('nutrition-prescribed-empty-compact-v5') && css.includes('min-height: 0 !important')],
  ['Nutrition assistant stepper uses full-width stacked desktop layout', app.includes('nutrition-assistant-stacked-stepper-v6') && css.includes('nutrition-assistant-stacked-stepper-v6') && css.includes('flex-direction: column !important') && css.includes('repeat(3, minmax(0, 1fr))')],
  ['Notification popover keeps open during internal interactions', app.includes('notificationPanelRef') && app.includes('composedPath') && app.includes('clientX >= rect.left') && app.includes('onWheel={(event) => event.stopPropagation()}')],
  ['Nutrition save upserts existing plan instead of prepending duplicates', app.includes('function upsertNutritionPlans') && app.includes('isUpdatingNutritionPlan') && app.includes('upsertNutritionPlans(current.nutritionPlans ?? [], savedPlan)')],
  ['Student app receives the shared UI theme', app.includes('uiTheme={uiTheme}') && app.includes('toggleUiTheme={toggleUiTheme}') && app.includes('function StudentMobileApp') && app.includes('theme = DEFAULT_UI_THEME')],
  ['Student app shell uses shared app theme classes', app.includes('student-theme-sync-v1') && app.includes('app-theme-') && app.includes('data-theme={theme}')],
  ['Student app exposes a theme shortcut in logged student view', app.includes('student-theme-toggle') && app.includes('ThemeToggle theme={theme}')],
  ['Student app light and dark theme CSS is synchronized', css.includes('student-theme-sync-v1') && css.includes('.student-mobile-shell.app-theme-light') && css.includes('.student-mobile-shell.app-theme-dark')],
  ['Nutrition form guards duplicate concurrent submits', app.includes('savingRef') && app.includes('clientRequestIdRef') && app.includes('if (savingRef.current || saving) return')],
  ['Nutrition meals and foods use stable ids', app.includes('createNutritionMeal(') && app.includes('createNutritionMealItem(') && app.includes('cloneNutritionMeal(') && app.includes('key={meal.id') && app.includes('key={item.id')],
  ['Nutrition duplicate meal copies the selected meal by id', app.includes('function duplicateMeal(mealId)') && app.includes('const sourceMeal = current.find((meal) => sameId(meal.id, mealId))') && app.includes('Cópia de')],
  ['Remote nutrition save updates existing remote plan with PATCH', api.includes('const isUpdatingNutritionPlan = isUuid(plan.id)') && api.includes("method: isUpdatingNutritionPlan ? 'PATCH' : 'POST'") && api.includes('nutrition_plans?id=eq.')],
  ['Remote nutrition save validates authenticated coach before RLS request', api.includes('const safeCoachId = requireCoachId(coachId)') && api.includes('coach_id: safeCoachId')],
  ['Remote nutrition save scopes plan updates by coach id', api.includes('nutrition_plans?id=eq.${encodeURIComponent(plan.id)}&coach_id=eq.${encodeURIComponent(safeCoachId)}')],
  ['Remote nutrition meal writes are protected by parent ownership lookup', api.includes('loadRemoteNutritionMealIdsForCoach') && api.includes('nutrition_plans!inner(coach_id)') && api.includes('nutrition_plans.coach_id=eq.${encodeURIComponent(coachId)}')],
  ['Remote nutrition save requires confirmed database row', api.includes('if (!planRows?.[0])') && api.includes('Não foi possível confirmar o salvamento da dieta')],
  ['Existing nutrition plans with null active remain visible', api.includes('active: row.active !== false')],
  ['Nutrition RLS migration is included but not executed', api.includes('20260909_fix_nutrition_rls_policies.sql') && css.includes('nutrition-rls-professional-polish-v1')],
  ['Light app background tests #E0E0E0 as base only', css.includes('--app-light-bg: #E0E0E0') && css.includes('nutrition-crud-light-base-test-v1')],
  ['Workout quick flow has predefined training level select', app.includes('WORKOUT_TRAINING_LEVEL_OPTIONS') && app.includes('Nível de treinamento') && app.includes('Selecione o nível')],
  ['Workout quick flow has predefined objective select', app.includes('WORKOUT_OBJECTIVE_OPTIONS') && app.includes('Redução de gordura + hipertrofia') && app.includes('Qualidade de vida')],
  ['Workout quick flow info step keeps advanced settings visible', app.includes('mobile-workout-settings-section') && !app.includes('<summary>Mais opções</summary>')],
  ['Workout quick flow stores student PDF permission', app.includes('allowStudentPdfDownload') && app.includes('Permitir que o aluno baixe o treino em PDF') && app.includes('Quando ativado, o aluno poderá baixar este treino em PDF.')],
  ['Workout picker has confirmed add state and duplicate guard', app.includes('addingExerciseKey') && app.includes('isExerciseAlreadyInDraftDay') && app.includes('Adicionando...') && app.includes('✓ Adicionado')],
  ['Workout picker result cards avoid technical movement labels', !app.includes('exercise.mechanic || exercise.composition, exercise.movementType')],
  ['Workout draft is recoverable before publishing', app.includes('WORKOUT_DRAFT_STORAGE_KEY') && app.includes('persistWorkoutDraft') && app.includes('recoverStoredWorkoutDraft')],
  ['Workout student PDF export respects routine setting', app.includes('canStudentDownloadPdf') && app.includes('Baixar treino em PDF')],
  ['Workout quick flow light panels have solid theme polish', css.includes('workout-quick-flow-light-panels-v1') && css.includes('.app-theme-light .mobile-workout-sheet') && css.includes('.app-theme-light .mobile-workout-day-screen')],
  ['Workout edits update the existing routine instead of duplicating it', app.includes('editingWorkoutId') && app.includes('function upsertWorkouts') && app.includes('upsertWorkouts(current.workouts ?? [], savedWorkout)')],
  ['Remote workout save patches existing routines and refreshes exercises', api.includes('const isUpdatingWorkout = isUuid(workout.id)') && api.includes("method: isUpdatingWorkout ? 'PATCH' : 'POST'") && api.includes('workout_exercises?workout_id=eq.')],
  ['Workout student preview opens as a theme-aware portal', app.includes('workout-student-preview-portal-v1') && app.includes('mobile-workout-student-preview-panel') && css.includes('workout-student-preview-portal-v1') && css.includes('.mobile-workout-student-preview-portal.app-theme-light')],
  ['Workout day preview opens in a focused overlay, not buried inline', app.includes('workout-day-preview-portal-v1') && app.includes('mobile-workout-day-preview-panel') && css.includes('workout-day-preview-portal-v1')],
  ['Workout audit polish keeps critical actions and picker scroll accessible', css.includes('workout-audit-responsive-polish-v2') && css.includes('max-height: min(88dvh, 760px)') && css.includes('position: sticky')],
  ['Nutrition supports household measures per food', app.includes('NUTRITION_HOUSEHOLD_MEASURES') && app.includes('getFoodMeasureOptions') && app.includes('calculateFoodServingGrams') && app.includes('customMeasureGrams')],
  ['Nutrition student servings show household measure and grams', app.includes('formatStudentFoodServing') && app.includes('nutrition-serving-controls-v1') && css.includes('nutrition-serving-controls-v1')],
  ['Nutrition metadata persists structured servings without SQL', app.includes('NUTRITION_PLAN_METADATA_PREFIX') && api.includes('NUTRITION_PLAN_METADATA_PREFIX') && api.includes('parseNutritionPlanMetadata')],
  ['Nutrition shows student TMB context while prescribing', app.includes('calculateBasalMetabolicRate') && app.includes('NutritionBmrStrip') && app.includes('Complete os dados do aluno para calcular a TMB')],
  ['Nutrition questionnaires exist for coach and student', app.includes('NutritionQuestionnaires') && app.includes('StudentQuestionnaireCenter') && app.includes('coachfitpro-nutrition-questionnaires')],
  ['Nutrition questionnaires award XP once per assignment', app.includes('QUESTIONNAIRE_XP_REWARD') && app.includes('xpAwarded') && app.includes('Questionário concluído! Você ganhou')],
  ['Nutrition questionnaire schema is documented but not executed', api.includes('saveRemoteNutritionQuestionnaire') && api.includes('Remote nutrition questionnaires require Supabase schema setup')]
]

const failed = checks.filter(([, passed]) => !passed)

if (failed.length) {
  console.error('Theme smoke check failed:')
  for (const [name] of failed) console.error(`- ${name}`)
  process.exit(1)
}

console.log('Theme smoke check passed')

























