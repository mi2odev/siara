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

## Compatibility note

This flow does **not** replace the existing automatic mobile registration via
`POST /api/push/mobile/register`. The QR pairing is an additional, manual UX
for users who want to explicitly link a phone from the web UI. Both paths land
in `app.mobile_push_devices` and are picked up by `sendPushToUser` without any
further changes.
