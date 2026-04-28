import { userRequest } from '../requestMethodes'

function normalizeError(error, fallback) {
  return new Error(
    error?.response?.data?.message
      || error?.response?.data?.error
      || error?.message
      || fallback,
  )
}

export async function startDriverQuiz(payload = {}) {
  try {
    const response = await userRequest.post('/driver-quiz/start', payload)
    return response.data
  } catch (error) {
    throw normalizeError(error, 'Failed to start driver quiz')
  }
}

export async function saveDriverQuizResponse(attemptId, payload) {
  try {
    const response = await userRequest.post(
      `/driver-quiz/${attemptId}/response`,
      payload,
    )
    return response.data
  } catch (error) {
    throw normalizeError(error, 'Failed to save quiz response')
  }
}

export async function completeDriverQuiz(attemptId) {
  try {
    const response = await userRequest.post(`/driver-quiz/${attemptId}/complete`)
    return response.data
  } catch (error) {
    throw normalizeError(error, 'Failed to complete driver quiz')
  }
}

export async function getMyDriverQuizProfile() {
  try {
    const response = await userRequest.get('/driver-quiz/me/profile')
    return response.data?.profile || null
  } catch (error) {
    throw normalizeError(error, 'Failed to load driver quiz profile')
  }
}

export async function getMyDriverQuizHistory(params = {}) {
  try {
    const response = await userRequest.get('/driver-quiz/me/history', {
      params: { limit: params.limit, offset: params.offset },
    })
    return response.data || { attempts: [], pagination: {} }
  } catch (error) {
    throw normalizeError(error, 'Failed to load driver quiz history')
  }
}

export async function getUserDriverQuizForAdmin(userId) {
  try {
    const response = await userRequest.get(`/admin/users/${userId}/driver-quiz`)
    return response.data
  } catch (error) {
    throw normalizeError(error, 'Failed to load user quiz profile')
  }
}

export async function getUserDriverQuizForPolice(userId) {
  try {
    const response = await userRequest.get(`/police/users/${userId}/driver-quiz`)
    return response.data
  } catch (error) {
    throw normalizeError(error, 'Failed to load user quiz profile')
  }
}
