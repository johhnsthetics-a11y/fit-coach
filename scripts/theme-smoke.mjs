import { readFileSync } from 'node:fs'

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
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
  ['Service worker cache was bumped', sw.includes('coach-fit-pro-pwa-20260831-theme-light')],
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
  ['Theme toggle uses clean moon and sun icons', app.includes('theme-toggle-moon') && app.includes('theme-toggle-sun') && !app.includes('theme-toggle-orb')],
  ['Logged app page header has theme shortcut', app.includes('coach-page-theme-toggle')],
  ['Authenticated app dark residues are normalized', css.includes('.app-theme-light [class*="bg-zinc-950"]')],
]

const failed = checks.filter(([, passed]) => !passed)

if (failed.length) {
  console.error('Theme smoke check failed:')
  for (const [name] of failed) console.error(`- ${name}`)
  process.exit(1)
}

console.log('Theme smoke check passed')





