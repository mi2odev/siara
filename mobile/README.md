# SIARA mobile — device pairing files

This folder holds the **drop-in modules for the SIARA Expo app** that implement
the "Add mobile device by QR" pairing flow. The web/back-end side of the flow
already lives in this repository:

- Migration: [`api/migrations/20260520_mobile_device_pairing_sessions.sql`](../api/migrations/20260520_mobile_device_pairing_sessions.sql)
- Service helpers: [`api/services/pushService.js`](../api/services/pushService.js) — `createMobileDevicePairingSession`, `getMobileDevicePairingSession`, `completeMobileDevicePairingSession`, `cancelMobileDevicePairingSession`
- Routes: [`api/contollers/push.js`](../api/contollers/push.js) — `POST /api/push/mobile/pairing-sessions`, `GET /api/push/mobile/pairing-sessions/:id`, `DELETE /api/push/mobile/pairing-sessions/:id`, `POST /api/push/mobile/pairing-sessions/complete`
- Web modal: [`client/src/components/notifications/AddMobileDeviceModal.jsx`](../client/src/components/notifications/AddMobileDeviceModal.jsx)
- Web settings hook-up: [`client/src/pages/user/SettingsPage.jsx`](../client/src/pages/user/SettingsPage.jsx)

The Expo app itself is not in this monorepo today. The files below are
deliberately small, dependency-light, and TypeScript-free so they paste into
an existing Expo project with minimal friction.

## Expected Expo dependencies

```bash
expo install expo-camera expo-barcode-scanner expo-linking expo-notifications expo-device
npm install axios
```

## Deep link

`siara://pair-device?code=<pairing-code>` (configurable on the backend via
`SIARA_MOBILE_PAIRING_SCHEME`). Register this scheme in the Expo `app.json`:

```json
{
  "expo": {
    "scheme": "siara",
    "android": { "intentFilters": [{ "action": "VIEW", "data": [{ "scheme": "siara", "host": "pair-device" }], "category": ["BROWSABLE", "DEFAULT"] }] },
    "ios": { "associatedDomains": [] }
  }
}
```

## File map

| File                          | Purpose |
| ----------------------------- | ------- |
| `services/pairingService.js`  | thin axios wrapper for `/api/push/mobile/pairing-sessions/complete` |
| `screens/ScanPairDeviceScreen.js` | camera + QR decode + permission + completion flow |
| `lib/pairingDeepLink.js`      | parses `siara://pair-device?code=...` into a `{ code }` payload |
| `lib/pushRegistration.js`     | wraps `expo-notifications` to fetch the Expo push token |
| `services/demoAuthService.js` | thin axios wrapper for `/api/auth/demo-login` (one-click role login) |
| `components/DemoLoginButtons.js` | demo-role buttons for the Login / Register screen |

## Demo login (one-click role access)

Mirrors the web app's demo buttons so testers can enter as a sample **Demo User /
Police / Supervisor / Admin** with no inputs. The backend endpoint is shared and
already deployed:

- `GET /api/auth/demo-login` → `{ enabled, roles }` (self-hides the buttons when
  `ALLOW_DEMO_LOGIN=false`)
- `POST /api/auth/demo-login` body `{ role, rememberMe }` → `{ user, accessToken, … }`

Drop `DemoLoginButtons` under the login form and let the host store the token:

```jsx
import DemoLoginButtons from '../components/DemoLoginButtons';

<DemoLoginButtons
  apiClient={apiClient}
  rememberMe={rememberMe}
  onAuthenticated={(result) => {
    // Store result.accessToken as the Bearer token, set result.user, then
    // navigate to the role's home. result.user.roles tells you the role.
    saveSession(result.accessToken, result.user);
    navigateHomeFor(result.user);
  }}
/>
```

**Read-only admin:** the `admin` demo is read-only — the backend
(`api/contollers/verifytoken.js`) blocks its writes (the only exception is
changing the status of the demo accounts), so it is safe even on production
data. The response's `user.readOnly` flag is `true` for it — show a read-only
banner and, ideally, disable write affordances. If a blocked write is attempted
the API returns `403 { code: "DEMO_READ_ONLY", contact }`. Enforcement is
server-side regardless of the UI.

## Compatibility note

This flow does **not** replace the existing automatic mobile registration via
`POST /api/push/mobile/register`. The QR pairing is an additional, manual UX
for users who want to explicitly link a phone from the web UI. Both paths land
in `app.mobile_push_devices` and are picked up by `sendPushToUser` without any
further changes.
