import { publicRequest, userRequest } from '../requestMethodes'

function normalizeError(error, fallback) {
  return new Error(
    error?.response?.data?.message
      || error?.response?.data?.error
      || error?.message
      || fallback,
  )
}

/** Public — submit a contact form message. */
export async function submitSupportMessage(payload) {
  try {
    const response = await publicRequest.post('/support/messages', {
      name: payload?.name,
      email: payload?.email,
      subject: payload?.subject,
      message: payload?.message,
    })
    return response.data
  } catch (error) {
    throw normalizeError(error, 'Failed to send message')
  }
}

/** Admin — list contact-form messages. */
export async function fetchAdminSupportMessages(params = {}) {
  try {
    const response = await userRequest.get('/admin/support-messages', {
      params: {
        limit: params.limit,
        offset: params.offset,
        status: params.status,
      },
    })
    return response.data
  } catch (error) {
    throw normalizeError(error, 'Failed to load support messages')
  }
}

/** Admin — unified inbox: contact messages + reporter info-request replies. */
export async function fetchAdminInbox(params = {}) {
  try {
    const response = await userRequest.get('/admin/support-messages/inbox', {
      params: { limit: params.limit },
    })
    return response.data
  } catch (error) {
    throw normalizeError(error, 'Failed to load admin inbox')
  }
}

/** Admin — patch status / admin note on a message. */
export async function updateAdminSupportMessage(id, patch) {
  try {
    const response = await userRequest.patch(`/admin/support-messages/${id}`, {
      status: patch?.status,
      adminNote: patch?.adminNote,
    })
    return response.data
  } catch (error) {
    throw normalizeError(error, 'Failed to update message')
  }
}

/** Admin — send an in-app reply (also notifies the user if signed up). */
export async function replyToAdminSupportMessage(id, reply) {
  try {
    const response = await userRequest.post(`/admin/support-messages/${id}/reply`, { reply })
    return response.data
  } catch (error) {
    throw normalizeError(error, 'Failed to send reply')
  }
}

/** Admin — archive (soft-delete) a message. */
export async function deleteAdminSupportMessage(id) {
  try {
    const response = await userRequest.delete(`/admin/support-messages/${id}`)
    return response.data
  } catch (error) {
    throw normalizeError(error, 'Failed to archive message')
  }
}

/**
 * Admin — update triage status on an info-request reply.
 * `status` is one of: 'new' | 'read' | 'archived'.
 * Archived rows disappear from the default inbox view.
 */
export async function updateAdminInfoReplyStatus(reportId, status) {
  try {
    const response = await userRequest.patch(
      `/admin/support-messages/info-replies/${reportId}`,
      { status },
    )
    return response.data
  } catch (error) {
    throw normalizeError(error, 'Failed to update info-reply status')
  }
}
