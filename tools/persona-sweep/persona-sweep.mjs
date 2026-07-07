/**
 * SIARA persona sweep.
 *
 * Drives a real browser across every meaningful user persona (role × language)
 * and every key route, capturing a screenshot per screen and collecting UX
 * friction signals: uncaught errors, console errors, failed network requests,
 * caught error-boundaries, blank screens, and suspected untranslated strings.
 *
 * It authenticates each role through the public one-click demo-login endpoint
 * (POST /api/auth/demo-login), so no seeded passwords are needed — just the
 * running stack with ALLOW_DEMO_LOGIN enabled (the default in dev).
 *
 * Usage (from tools/persona-sweep/):
 *   npm install
 *   npm run sweep                 # desktop, all languages
 *   BASE_URL=http://localhost:5173 API_URL=http://localhost:5000/api npm run sweep
 *   LANGS=en DEVICE=mobile HEADED=1 npm run sweep
 *
 * Output: ./output/screenshots/<lang>/<persona>/<route>.png and
 *         ./output/report.md + ./output/report.json
 */

import { chromium, devices } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Config (all overridable via env) ────────────────────────────────────────
const BASE_URL = (process.env.BASE_URL || 'http://localhost:5173').replace(/\/+$/, '')
const API_URL = (process.env.API_URL || 'http://localhost:5000/api').replace(/\/+$/, '')
const LANGUAGE_STORAGE_KEY = 'siara_language'
const LANGS = (process.env.LANGS || 'en,fr,ar').split(',').map((s) => s.trim()).filter(Boolean)
const HEADED = process.env.HEADED === '1'
const IS_MOBILE = (process.env.DEVICE || 'desktop').toLowerCase() === 'mobile'
const SETTLE_MS = Number(process.env.SETTLE_MS || 2500) // socket.io/polling never go network-idle
const OUTPUT_DIR = path.join(__dirname, 'output')

// ── Persona → routes map. `role` feeds the demo-login endpoint (null = guest). ─
const PERSONAS = [
  {
    key: 'guest',
    role: null,
    routes: ['/home', '/about', '/description', '/news', '/contact', '/login', '/register', '/forgot-password'],
  },
  {
    key: 'citizen',
    role: 'citizen',
    routes: [
      '/map', '/report', '/report/create', '/predictions', '/dashboard',
      '/notifications', '/profile', '/settings', '/alerts', '/alerts/subscriptions', '/zone-profile',
    ],
  },
  {
    key: 'police',
    role: 'police',
    routes: [
      '/police', '/police/nearby', '/police/verification', '/police/priority-queue',
      '/police/my-incidents', '/police/assigned-incidents', '/police/field-reports',
      '/police/insights', '/police/history', '/police/alerts',
    ],
  },
  {
    key: 'supervisor',
    role: 'supervisor',
    routes: [
      '/police/supervisor', '/police/supervisor/coordination', '/police/supervisor/officers',
      '/police/supervisor/alerts', '/police/supervisor/analytics', '/police/supervisor/interventions',
      '/police/supervisor/map',
    ],
  },
  {
    key: 'admin',
    role: 'admin',
    routes: [
      '/admin/overview', '/admin/incidents', '/admin/users', '/admin/zones',
      '/admin/analytics', '/admin/system', '/admin/inbox', '/admin/ai', '/admin/alerts',
    ],
  },
]

// Error-boundary fallback headings (all 3 languages) — presence means a screen crashed.
const ERROR_BOUNDARY_MARKERS = [
  'ran into a problem', 'crashed in the ui',
  'rencontré un problème', "erreur s'est produite dans l'interface",
  'حدثت مشكلة', 'خطأ في واجهة المستخدم',
]

// Looks like an untranslated i18next key leaking into the UI (>= 2 dots, no spaces).
const MISSING_I18N_RE = /\b[a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9]+){2,}\b/g

function safeName(route) {
  return route.replace(/^\//, '').replace(/[^a-zA-Z0-9]+/g, '_') || 'root'
}

async function authenticate(context, role) {
  // Shares the cookie jar with the browser context, so the session cookie the
  // API sets is used by subsequent page navigations.
  const response = await context.request.post(`${API_URL}/auth/demo-login`, {
    data: { role, rememberMe: true },
    failOnStatusCode: false,
  })
  if (!response.ok()) {
    let detail = ''
    try {
      detail = (await response.json())?.error || ''
    } catch {
      // ignore
    }
    throw new Error(`demo-login failed for "${role}" (${response.status()}) ${detail}`)
  }
}

async function sweepRoute(page, url) {
  const friction = {
    pageErrors: [],
    consoleErrors: [],
    failedResponses: [],
    errorBoundary: false,
    blank: false,
    suspectedMissingI18n: [],
  }

  const onPageError = (err) => friction.pageErrors.push(String(err?.message || err))
  const onConsole = (msg) => {
    if (msg.type() === 'error') friction.consoleErrors.push(msg.text().slice(0, 300))
  }
  const onResponse = (res) => {
    const status = res.status()
    if (status >= 400) {
      friction.failedResponses.push({ status, url: res.url() })
    }
  }

  page.on('pageerror', onPageError)
  page.on('console', onConsole)
  page.on('response', onResponse)

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(SETTLE_MS)

    const bodyText = (await page.evaluate(() => document.body?.innerText || '')).trim()
    const lower = bodyText.toLowerCase()
    friction.errorBoundary = ERROR_BOUNDARY_MARKERS.some((m) => lower.includes(m))
    friction.blank = bodyText.length < 40
    const matches = bodyText.match(MISSING_I18N_RE) || []
    // De-dupe and drop obvious non-keys (urls/emails handled by the no-space rule).
    friction.suspectedMissingI18n = [...new Set(matches)].slice(0, 5)
  } catch (error) {
    friction.pageErrors.push(`navigation: ${String(error?.message || error)}`)
  } finally {
    page.off('pageerror', onPageError)
    page.off('console', onConsole)
    page.off('response', onResponse)
  }

  return friction
}

function hasFriction(f) {
  return (
    f.pageErrors.length > 0 ||
    f.consoleErrors.length > 0 ||
    f.failedResponses.length > 0 ||
    f.errorBoundary ||
    f.blank
  )
}

async function main() {
  console.log(`[persona-sweep] base=${BASE_URL} api=${API_URL} langs=${LANGS.join(',')} device=${IS_MOBILE ? 'mobile' : 'desktop'}`)
  const browser = await chromium.launch({ headless: !HEADED })
  const rows = []

  for (const lang of LANGS) {
    for (const persona of PERSONAS) {
      const context = await browser.newContext({
        ...(IS_MOBILE ? devices['Pixel 7'] : { viewport: { width: 1366, height: 900 } }),
        locale: lang === 'ar' ? 'ar-DZ' : lang === 'fr' ? 'fr-FR' : 'en-US',
      })
      // Force the app language before any page script runs.
      await context.addInitScript(
        ([key, value]) => window.localStorage.setItem(key, value),
        [LANGUAGE_STORAGE_KEY, lang],
      )

      const label = `${lang}/${persona.key}`
      try {
        if (persona.role) {
          await authenticate(context, persona.role)
        }
      } catch (error) {
        console.warn(`[persona-sweep] ${label}: ${error.message} — skipping authed routes`)
        rows.push({ lang, persona: persona.key, route: '(login)', friction: { pageErrors: [error.message], consoleErrors: [], failedResponses: [], errorBoundary: false, blank: false, suspectedMissingI18n: [] } })
        await context.close()
        continue
      }

      const page = await context.newPage()
      for (const route of persona.routes) {
        const friction = await sweepRoute(page, `${BASE_URL}${route}`)
        const dir = path.join(OUTPUT_DIR, 'screenshots', lang, persona.key)
        await mkdir(dir, { recursive: true })
        try {
          await page.screenshot({ path: path.join(dir, `${safeName(route)}.png`), fullPage: true })
        } catch {
          // Screenshot can fail on a mid-navigation page; keep going.
        }
        rows.push({ lang, persona: persona.key, route, friction })
        const flag = hasFriction(friction) ? '⚠' : '·'
        console.log(`[persona-sweep] ${flag} ${label} ${route}`)
      }
      await context.close()
    }
  }

  await browser.close()
  await writeReports(rows)
}

async function writeReports(rows) {
  await mkdir(OUTPUT_DIR, { recursive: true })
  await writeFile(path.join(OUTPUT_DIR, 'report.json'), JSON.stringify(rows, null, 2), 'utf8')

  const flagged = rows.filter((r) => hasFriction(r.friction))
  const lines = []
  lines.push('# SIARA persona sweep report', '')
  lines.push(`- Generated: ${new Date().toISOString()}`)
  lines.push(`- Screens visited: **${rows.length}**`)
  lines.push(`- Screens with friction: **${flagged.length}**`, '')

  if (flagged.length === 0) {
    lines.push('No friction detected across the swept personas and routes. 🎉', '')
  } else {
    lines.push('## Friction by screen', '')
    lines.push('| Lang | Persona | Route | Signals |')
    lines.push('| --- | --- | --- | --- |')
    for (const r of flagged) {
      const f = r.friction
      const signals = []
      if (f.errorBoundary) signals.push('error-boundary')
      if (f.blank) signals.push('blank')
      if (f.pageErrors.length) signals.push(`${f.pageErrors.length} page-error`)
      if (f.consoleErrors.length) signals.push(`${f.consoleErrors.length} console-error`)
      if (f.failedResponses.length) {
        const statuses = [...new Set(f.failedResponses.map((x) => x.status))].join(',')
        signals.push(`${f.failedResponses.length} req-fail (${statuses})`)
      }
      if (f.suspectedMissingI18n.length) signals.push(`i18n? ${f.suspectedMissingI18n.join(', ')}`)
      lines.push(`| ${r.lang} | ${r.persona} | ${r.route} | ${signals.join('; ')} |`)
    }
    lines.push('')
  }

  await writeFile(path.join(OUTPUT_DIR, 'report.md'), lines.join('\n'), 'utf8')
  console.log(`\n[persona-sweep] done — ${flagged.length}/${rows.length} screens flagged.`)
  console.log(`[persona-sweep] report: ${path.join(OUTPUT_DIR, 'report.md')}`)
}

main().catch((error) => {
  console.error('[persona-sweep] fatal', error)
  process.exit(1)
})
