import { userRequest } from '../requestMethodes'

export async function getMyPreferences() {
  const response = await userRequest.get('/users/me/preferences')
  return response.data || null
}

export async function updateLanguagePreference(language) {
  const response = await userRequest.patch('/users/me/preferences/language', { language })
  return response.data || null
}
