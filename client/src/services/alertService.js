import { publicRequest, userRequest } from '../requestMethodes'

const ALERTS_ENDPOINT = '/alerts'
const ADMIN_AREAS_ENDPOINT = '/admin-areas'

export async function fetchAlerts(options = {}) {
  const response = await userRequest.get(ALERTS_ENDPOINT, {
    params: {
      includeGeometry: options.includeGeometry ? 'true' : undefined,
    },
  })
  return response.data?.items || []
}

export async function fetchAlertsForUser(userId, options = {}) {
  const response = await userRequest.get(`${ALERTS_ENDPOINT}/user/${userId}`, {
    params: {
      includeGeometry: options.includeGeometry ? 'true' : undefined,
    },
  })
  return response.data?.items || []
}

export async function fetchAlert(id, options = {}) {
  const response = await userRequest.get(`${ALERTS_ENDPOINT}/${id}`, {
    params: {
      includeGeometry: options.includeGeometry ? 'true' : undefined,
    },
  })
  return response.data?.item || null
}

export async function createAlert(payload) {
  const response = await userRequest.post(ALERTS_ENDPOINT, payload)
  return response.data?.item || null
}

export async function updateAlert(id, payload) {
  const response = await userRequest.put(`${ALERTS_ENDPOINT}/${id}`, payload)
  return response.data?.item || null
}

export async function updateAlertStatus(id, status) {
  const response = await userRequest.patch(`${ALERTS_ENDPOINT}/${id}/status`, { status })
  return response.data?.item || null
}

export async function deleteAlert(id) {
  const response = await userRequest.delete(`${ALERTS_ENDPOINT}/${id}`)
  return response.data?.ok === true
}

export async function fetchWilayas() {
  const response = await publicRequest.get(`${ADMIN_AREAS_ENDPOINT}/wilayas`)
  return response.data?.items || []
}

export async function fetchCommunes(wilayaId) {
  const response = await publicRequest.get(`${ADMIN_AREAS_ENDPOINT}/${wilayaId}/communes`)
  return response.data?.items || []
}
