# SIARA — How to Test the Prototype

Thank you for evaluating **SIARA**, a road-safety platform for Algeria that lets
citizens report incidents, uses AI to assess risk and validate reports, and
gives police and supervisors real-time operational tools.

This guide walks you through testing each role. **No account or password is
needed** — the demo sign-in logs you straight in as the role you choose.

---

## 1. Getting started

1. Open the demo site: **`<DEMO_URL>`**  ← _(replace with your deployed URL)_
2. On the login page, use the **one-click demo buttons** to enter as any role:
   **Citizen · Police Officer · Supervisor · Admin**.
3. **Change the language** anytime with the language switcher — the whole
   interface is available in **العربية (Arabic) · Français · English**.

> The demo runs on test data. You can click freely — nothing here affects real
> operations. To switch role, sign out and pick another demo button.

---

## 2. What to test, by role

### 👤 Citizen (driver) — _fully interactive_
The everyday user who reports hazards and checks road risk.
- **Report an incident:** *Report → Create* — go through the 5-step form
  (type, details, location, photo, review) and submit.
- **Live risk map:** *Map* — see incidents, danger zones, and weather-aware risk
  around a location. If GPS is blocked, use the **"search your city"** box to set
  a location manually.
- **Route & predictions:** *Predictions* — check risk along a route and get an
  AI explanation of why.
- **Alerts:** create an alert for an area and see notifications.

### 👮 Police Officer — _fully interactive_
Field tools for verifying and acting on incidents.
- On first entry you'll pick a **work zone** (Wilaya → Commune) — this scopes
  everything you see to your area.
- **Verification queue:** *Police → Verification* — **verify** or **reject**
  reported incidents.
- **Nearby & priority:** review nearby incidents and the AI-ranked priority
  queue; **assign** an incident to yourself, **request backup**, add **field
  notes**.
- **Operation history:** every action is logged for accountability.

### 🛡️ Supervisor — _fully interactive_
Command-level oversight of a zone's officers and incidents.
- **Dashboard & operations map:** *Police → Supervisor* — live view of officers
  and incidents across the zone.
- **Coordination:** assign incidents to officers; issue alerts.
- **Analytics & interventions:** review zone trends and plan safety
  interventions (infrastructure counter-measures).

### 🗂️ Admin — _read-only in the demo_
The internal operator's control panel. You can **browse everything** — overview,
incident review, users, analytics, zones, AI monitoring — but changes to real
data are disabled for the demo. This lets you assess the admin capabilities
without altering anything.

---

## 3. What feedback would help us most

While testing, we'd value your view on:
- **Usefulness** — does each role's screen give you what you'd actually need?
- **Clarity** — is anything confusing, mislabeled, or hard to find?
- **Workflow fit** — does the report → verify → resolve flow match how you work?
- **Language & terminology** — is the Arabic/French wording correct and natural?
- **Trust in the AI** — are the risk scores and report-validation results
  understandable and reasonable?

---

## 4. Good to know

- **No setup, no password** — the demo buttons handle sign-in.
- **Test data only** — the citizen, police, and supervisor demos are writable so
  you can try real actions; the admin demo is browse-only by design.
- **Works on mobile and desktop**, in all three languages.
- Questions or issues during testing: **mouhamedbachir2323@gmail.com**

_Thank you — your feedback directly shapes the prototype._
