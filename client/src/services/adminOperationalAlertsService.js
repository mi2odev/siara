import { userRequest } from '../requestMethodes'

const DEFAULT_TAB = 'all'
const ALLOWED_TABS = new Set(['all', 'active', 'scheduled', 'expired', 'emergency', 'templates'])

function normalizeApiError(error, fallbackMessage) {
  return new Error(
    error?.response?.data?.message
      || error?.response?.data?.error
      || error?.message
      || fallbackMessage,
  )
}

function ensureNumber(value, fallback = 0) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function ensureNullableNumber(value, digits = null) {
  if (value == null || value === '') {
    return null
  }

  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return null
  }

  if (digits == null) {
    return numeric
  }

  return Number(numeric.toFixed(digits))
}

function ensureBoolean(value, fallback = false) {
  return typeof value === 'boolean' ? value : fallback
}

function normalizeEvent(item) {
  return {
    id: ensureNumber(item?.id, 0),
    eventType: item?.eventType || '',
    fromStatus: item?.fromStatus || null,
    toStatus: item?.toStatus || null,
    note: item?.note || '',
    metadata: item?.metadata && typeof item.metadata === 'object' ? item.metadata : {},
    createdAt: item?.createdAt || null,
    actor: item?.actor || 'Admin',
  }
}

function normalizeAlertItem(item) {
  return {
    id: item?.id || '',
    displayId: item?.displayId || 'ALR-UNKNOWN',
    title: item?.title || '',
    description: item?.description || '',
    zone: item?.zone || 'Unknown zone',
    zoneLabel: item?.zoneLabel || item?.zone || 'Unknown zone',
    severity: ['low', 'medium', 'high', 'critical'].includes(item?.severity) ? item.severity : 'low',
    type: item?.type || 'advisory',
    trigger: ['auto', 'manual', 'scheduled'].includes(item?.trigger) ? item.trigger : 'manual',
    duration: item?.duration || '\u2014',
    audience: ensureNullableNumber(item?.audience),
    status: ['active', 'scheduled', 'expired', 'cancelled', 'draft'].includes(item?.status) ? item.status : 'draft',
    startsAt: item?.startsAt || null,
    endsAt: item?.endsAt || null,
    publishedAt: item?.publishedAt || null,
    cancelledAt: item?.cancelledAt || null,
    createdAt: item?.createdAt || null,
    updatedAt: item?.updatedAt || null,
    createdBy: item?.createdBy || 'Admin',
    updatedBy: item?.updatedBy || null,
    cancelledBy: item?.cancelledBy || null,
    createdById: item?.createdById || null,
    adminAreaId: ensureNullableNumber(item?.adminAreaId),
    adminArea: item?.adminArea && typeof item.adminArea === 'object'
      ? {
        id: ensureNullableNumber(item.adminArea.id),
        name: item.adminArea.name || 'Unknown zone',
        level: item.adminArea.level || null,
        parentId: ensureNullableNumber(item.adminArea.parentId),
        wilayaId: ensureNullableNumber(item.adminArea.wilayaId),
        wilayaName: item.adminArea.wilayaName || null,
      }
      : null,
    templateId: item?.templateId || null,
    templateName: item?.templateName || null,
    sourceType: item?.sourceType || 'manual',
    sourceReportId: item?.sourceReportId || null,
    zoneType: item?.zoneType || 'admin_area',
    audienceScope: item?.audienceScope || 'users_in_zone',
    notifyOnStart: ensureBoolean(item?.notifyOnStart, true),
    notifyOnExpire: ensureBoolean(item?.notifyOnExpire, false),
    sendPush: ensureBoolean(item?.sendPush, true),
    sendEmail: ensureBoolean(item?.sendEmail, false),
    sendSms: ensureBoolean(item?.sendSms, false),
    metadata: item?.metadata && typeof item.metadata === 'object' ? item.metadata : {},
    events: Array.isArray(item?.events) ? item.events.map(normalizeEvent) : [],
  }
}

function normalizeTemplate(item) {
  return {
    id: item?.id || '',
    name: item?.name || 'Template',
    description: item?.description || '',
    alertType: item?.alertType || 'advisory',
    defaultSeverity: ['low', 'medium', 'high', 'critical'].includes(item?.defaultSeverity)
      ? item.defaultSeverity
      : 'medium',
    defaultTitle: item?.defaultTitle || '',
    defaultMessage: item?.defaultMessage || '',
    defaultDurationMinutes: ensureNumber(item?.defaultDurationMinutes, 0),
    defaultDuration: item?.defaultDuration || '\u2014',
    sendPush: ensureBoolean(item?.sendPush, true),
    sendEmail: ensureBoolean(item?.sendEmail, false),
    sendSms: ensureBoolean(item?.sendSms, false),
  }
}

export function normalizeOperationalAlertTab(tab) {
  const normalized = String(tab || '').trim().toLowerCase()
  return ALLOWED_TABS.has(normalized) ? normalized : DEFAULT_TAB
}

export async function fetchAdminOperationalAlerts(params = {}, options = {}) {
  try {
    const response = await userRequest.get('/admin/operational-alerts', {
      params: {
        tab: normalizeOperationalAlertTab(params.tab),
        search: params.search || '',
        page: Number.isInteger(params.page) ? params.page : 1,
        pageSize: Number.isInteger(params.pageSize) ? params.pageSize : 20,
      },
      signal: options.signal,
    })

    return {
      items: Array.isArray(response.data?.items) ? response.data.items.map(normalizeAlertItem) : [],
      counts: {
        all: ensureNumber(response.data?.counts?.all, 0),
        active: ensureNumber(response.data?.counts?.active, 0),
        scheduled: ensureNumber(response.data?.counts?.scheduled, 0),
        expired: ensureNumber(response.data?.counts?.expired, 0),
        emergency: ensureNumber(response.data?.counts?.emergency, 0),
        templates: ensureNumber(response.data?.counts?.templates, 0),
      },
      pagination: {
        page: ensureNumber(response.data?.pagination?.page, 1),
        pageSize: ensureNumber(response.data?.pagination?.pageSize, 20),
        total: ensureNumber(response.data?.pagination?.total, 0),
        totalPages: ensureNumber(response.data?.pagination?.totalPages, 1),
        returned: ensureNumber(response.data?.pagination?.returned, 0),
      },
    }
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load operational alerts')
  }
}

export async function fetchAdminOperationalAlert(id, options = {}) {
  try {
    const response = await userRequest.get(`/admin/operational-alerts/${id}`, {
      signal: options.signal,
    })

    return normalizeAlertItem(response.data?.item)
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load operational alert')
  }
}

export async function createAdminOperationalAlert(payload) {
  try {
    const response = await userRequest.post('/admin/operational-alerts', payload)
    return normalizeAlertItem(response.data?.item)
  } catch (error) {
    throw normalizeApiError(error, 'Failed to create operational alert')
  }
}

export async function updateAdminOperationalAlert(id, payload) {
  try {
    const response = await userRequest.put(`/admin/operational-alerts/${id}`, payload)
    return normalizeAlertItem(response.data?.item)
  } catch (error) {
    throw normalizeApiError(error, 'Failed to update operational alert')
  }
}

export async function cancelAdminOperationalAlert(id, note = null) {
  try {
    const response = await userRequest.post(`/admin/operational-alerts/${id}/cancel`, {
      note,
    })
    return normalizeAlertItem(response.data?.item)
  } catch (error) {
    throw normalizeApiError(error, 'Failed to cancel operational alert')
  }
}

export async function fetchOperationalAlertTemplates(options = {}) {
  try {
    const response = await userRequest.get('/admin/operational-alert-templates', {
      signal: options.signal,
    })

    return Array.isArray(response.data?.items) ? response.data.items.map(normalizeTemplate) : []
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load operational alert templates')
  }
}

export async function createAdminOperationalAlertFromTemplate(payload) {
  try {
    const response = await userRequest.post('/admin/operational-alerts/from-template', payload)
    return normalizeAlertItem(response.data?.item)
  } catch (error) {
    throw normalizeApiError(error, 'Failed to create alert from template')
  }
}

export async function fetchAdminOperationalAlertCounts(options = {}) {
  const payload = await fetchAdminOperationalAlerts({ pageSize: 1 }, options)
  return payload.counts
}
