# SIARA persona sweep

Browser-driven UX sweep. It logs in as each **role** (citizen, police, supervisor,
admin — plus a logged-out guest), in each **language** (Arabic RTL, French,
English), walks every key route, screenshots each screen, and writes a friction
report. This is the closest thing to "test the app as many different users."

It is intentionally standalone (its own `package.json`) so it never touches the
client build.

## Prerequisites

The full stack must be running and reachable:

- Client (Vite) — default `http://localhost:5173`
- API (Express) — default `http://localhost:5000` → so API base `http://localhost:5000/api`
- Flask ML service + PostgreSQL/PostGIS (for the pages that call them)

Role login uses the **public one-click demo-login** endpoint, so no seeded
passwords are needed — just make sure demo login is enabled on the API
(`ALLOW_DEMO_LOGIN` is on by default in development).

## Run

```bash
cd tools/persona-sweep
npm install            # also downloads the Chromium browser
npm run sweep
```

### Options (env vars)

| Var | Default | Purpose |
| --- | --- | --- |
| `BASE_URL` | `http://localhost:5173` | Client origin |
| `API_URL` | `http://localhost:5000/api` | API base (for demo-login) |
| `LANGS` | `en,fr,ar` | Languages to sweep |
| `DEVICE` | `desktop` | `mobile` emulates a Pixel 7 viewport |
| `HEADED` | – | `HEADED=1` shows the browser |
| `SETTLE_MS` | `2500` | Wait after load (the app uses sockets/polling, so it never goes network-idle) |

```bash
LANGS=ar DEVICE=mobile HEADED=1 npm run sweep
```

## Output

- `output/screenshots/<lang>/<persona>/<route>.png` — one shot per screen
- `output/report.md` — human-readable friction table
- `output/report.json` — raw results for tooling

### Friction signals captured per screen

- **error-boundary** — a screen crashed and hit the app/route error boundary
- **blank** — near-empty body (likely a broken route)
- **page-error / console-error** — uncaught JS / console errors
- **req-fail** — HTTP responses ≥ 400 (with status codes)
- **i18n?** — text that looks like an untranslated i18next key leaked into the UI

## Notes

- Police/supervisor demo accounts may land on `/police/setup-zone` if no work
  zone is set yet — that is expected and still captured. Set a zone once in the
  UI (or seed it) to sweep the deeper police pages.
- The admin demo account is server-side read-only; the sweep only navigates and
  screenshots, so it never mutates real data.
