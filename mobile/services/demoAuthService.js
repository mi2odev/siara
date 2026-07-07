// Thin axios wrapper for the SIARA one-click demo login endpoints.
//
// `apiClient` is a pre-configured axios instance pointing at the SIARA API
// (baseURL like https://<host>/api). Demo login is PUBLIC — no JWT is required
// to call it — and the POST returns { user, accessToken }. Store the returned
// accessToken as the session token (Bearer) exactly like a normal login.
//
// Backend contract — see api/contollers/auth.js:
//   GET  /api/auth/demo-login  -> { enabled, roles: ["citizen","police","supervisor","admin"] }
//   POST /api/auth/demo-login  body: { role, rememberMe }
//        -> { ok, user, accessToken, demo, role, requiresEmailVerification:false }
//
// Note: the ADMIN demo is read-only. The backend blocks its writes (except
// changing the status of the demo accounts). The returned `user.readOnly` flag
// lets the app show a read-only notice — enforcement is server-side regardless.

export async function getDemoLoginOptions(apiClient) {
  if (!apiClient) throw new Error('apiClient is required');
  try {
    const response = await apiClient.get('/auth/demo-login');
    const data = response?.data || {};
    return {
      enabled: Boolean(data.enabled),
      roles: Array.isArray(data.roles) ? data.roles : [],
    };
  } catch (_error) {
    // Treat any failure as "demo login unavailable" so the UI just hides it.
    return { enabled: false, roles: [] };
  }
}

export async function demoLogin(apiClient, role, rememberMe = false) {
  if (!apiClient) throw new Error('apiClient is required');
  if (!role) throw new Error('role is required');

  const response = await apiClient.post('/auth/demo-login', { role, rememberMe });
  const data = response?.data || {};
  return {
    ok: Boolean(data.ok ?? data.user),
    user: data.user || null,
    accessToken: data.accessToken || null,
    role: data.role || role,
    demo: Boolean(data.demo),
    readOnly: Boolean(data.user?.readOnly),
  };
}
