// Thin axios wrapper for the SIARA pairing endpoints.
//
// `apiClient` is expected to be a pre-configured axios instance with the
// user's JWT attached (the mobile app already has one for the rest of the
// /api routes). If the call returns 401, the screen should redirect to the
// login flow before retrying.

export async function completeMobilePairing(apiClient, payload) {
  if (!apiClient) throw new Error('apiClient is required');
  if (!payload?.code) throw new Error('code is required');
  if (!payload?.token) throw new Error('Expo push token is required');

  // Backend contract — see api/contollers/push.js
  //   POST /api/push/mobile/pairing-sessions/complete
  //   body: { code, token, platform, provider, appVersion, deviceName, meta }
  const response = await apiClient.post('/push/mobile/pairing-sessions/complete', {
    code: payload.code,
    token: payload.token,
    platform: payload.platform,
    provider: payload.provider || 'expo',
    appVersion: payload.appVersion || null,
    deviceName: payload.deviceName || null,
    meta: payload.meta || { source: 'mobile_qr_pairing' },
  });

  return response.data || null;
}
