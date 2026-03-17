import { userRequest } from '../requestMethodes'

const DASHBOARD_ENDPOINT = '/dashboard'

export async function fetchDashboard(options = {}) {
  const response = await userRequest.get(DASHBOARD_ENDPOINT, {
    params: {
      refresh: options.refresh ? 'true' : undefined,
    },
  })

  return response.data || null
}
