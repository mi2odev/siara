import { publicRequest, userRequest } from '../requestMethodes'

function mapAuthResponse(data = {}) {
  return {
    ok: Boolean(data.ok ?? true),
    authenticated: Boolean(data.authenticated ?? data.user),
    requiresEmailVerification: Boolean(data.requiresEmailVerification),
    user: data.user || null,
    token: data.accessToken || null,
    email: data.email || data.user?.email || null,
    resendAvailableAt: data.resendAvailableAt || null,
    message: data.message || '',
  }
}

export async function registerAccount(payload) {
  const response = await publicRequest.post('/auth/register', payload)
  return mapAuthResponse(response.data)
}

export async function sendVerificationCode(email) {
  const response = await publicRequest.post('/auth/verify-email/send', { email })
  return mapAuthResponse(response.data)
}

export async function confirmVerificationCode(payload) {
  const response = await publicRequest.post('/auth/verify-email/confirm', payload)
  return mapAuthResponse(response.data)
}

export async function login(payload) {
  const response = await publicRequest.post('/auth/login', payload)
  return mapAuthResponse(response.data)
}

export async function loginWithGoogle(payload) {
  const response = await publicRequest.post('/auth/google', {
    idToken: payload.idToken || payload.credential,
    rememberMe: payload.rememberMe === true,
  })
  return mapAuthResponse(response.data)
}

export async function requestPasswordReset(email) {
  const response = await publicRequest.post('/auth/password/forgot', { email })
  return mapAuthResponse(response.data)
}

export async function verifyPasswordResetCode(payload) {
  const response = await publicRequest.post('/auth/password/verify-code', payload)
  return {
    ok: Boolean(response.data?.ok),
    resetToken: response.data?.resetToken || null,
    expiresAt: response.data?.expiresAt || null,
  }
}

export async function resetPassword(payload) {
  const response = await publicRequest.post('/auth/password/reset', payload)
  return {
    ok: Boolean(response.data?.ok),
  }
}

export async function getSession() {
  const response = await publicRequest.get('/auth/session')
  return mapAuthResponse(response.data)
}

export async function getCurrentUser() {
  const response = await userRequest.get('/auth/me')
  return response.data?.user || null
}

export async function logout() {
  await publicRequest.post('/auth/logout')
}

export async function fetchEmailPreferences() {
  const response = await userRequest.get('/auth/email-preferences')
  return response.data?.preferences || null
}

export async function updateEmailPreferences(payload) {
  const response = await userRequest.patch('/auth/email-preferences', payload)
  return response.data?.preferences || null
}
