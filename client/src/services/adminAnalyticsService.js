import { userRequest } from '../requestMethodes'

function normalizeError(error, fallback) {
  return new Error(
    error?.response?.data?.message
    || error?.response?.data?.error
    || error?.message
    || fallback,
  )
}

const ALLOWED_PERIODS = new Set(['30d', '90d', '180d', '365d'])

export function normalizeAnalyticsPeriod(value) {
  const key = String(value || '').toLowerCase().trim()
  return ALLOWED_PERIODS.has(key) ? key : '30d'
}

export async function fetchAdminAnalytics(period = '30d') {
  try {
    // Hard cap so a stuck backend can't pin the page on "Loading analytics…".
    // The backend itself caps every spatial query at 8s via statement_timeout,
    // so 25s gives us comfortable headroom for the slowest realistic response.
    const response = await userRequest.get('/admin/analytics', {
      params: { period: normalizeAnalyticsPeriod(period) },
      timeout: 25000,
    })
    return response.data || null
  } catch (error) {
    if (error?.code === 'ECONNABORTED') {
      throw new Error('Analytics request timed out. Check the API logs — the spatial queries are likely missing the GiST indexes from db+.')
    }
    throw normalizeError(error, 'Failed to load analytics')
  }
}
