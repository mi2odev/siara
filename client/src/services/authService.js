import { publicRequest } from '../requestMethodes'

const LOGIN_ENDPOINT = '/auth/login'
const LOGOUT_ENDPOINT = '/auth/logout'
const ME_ENDPOINT = '/auth/me'

export async function login(identifier, password) {
  if (!identifier || !password) {
    throw new Error('Missing credentials')
  }

  const response = await publicRequest.post(LOGIN_ENDPOINT, {
    emailOrPhone: identifier,
    password,
  })

  return {
    user: response.data?.user || null,
    token: response.data?.accessToken || null,
  }
}

export async function logout() {
  try {
    await publicRequest.post(LOGOUT_ENDPOINT)
  } catch (_error) {
    // Clearing local auth state is still sufficient for the client.
  }
}

export async function getCurrentUser() {
  const response = await publicRequest.get(ME_ENDPOINT)
  return response.data?.user || null
}
