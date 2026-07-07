// Durable offline queue for incident reports.
//
// A driver reporting an accident is frequently on a poor or dropped connection —
// exactly when losing the report is worst. This queue persists a failed/offline
// submission (payload + any photos) in IndexedDB and retries it automatically
// when connectivity returns, so the report survives a reload or app close.
//
// IndexedDB (not localStorage) because report photos are File/Blob objects, which
// IndexedDB can store natively via structured clone. This module depends on
// reportsService one-way (reportsService never imports this), so there is no cycle.

import { createReport, uploadReportMedia } from './reportsService'

const DB_NAME = 'siara-offline'
const DB_VERSION = 1
const STORE = 'queued_reports'
const MAX_ATTEMPTS = 8
const RETRY_INTERVAL_MS = 60000

export const OFFLINE_QUEUE_CHANGED_EVENT = 'siara:offline-queue-changed'

const hasIndexedDb = typeof indexedDB !== 'undefined'

let dbPromise = null

function openDb() {
  if (!hasIndexedDb) {
    return Promise.reject(new Error('IndexedDB is unavailable'))
  }
  if (dbPromise) {
    return dbPromise
  }
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return dbPromise
}

function reqToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function writeTx(run) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE, 'readwrite')
        run(transaction.objectStore(STORE))
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
        transaction.onabort = () => reject(transaction.error)
      }),
  )
}

function putRecord(record) {
  return writeTx((store) => store.put(record))
}

function deleteRecord(id) {
  return writeTx((store) => store.delete(id))
}

async function getAllRecords() {
  const db = await openDb()
  return reqToPromise(db.transaction(STORE, 'readonly').objectStore(STORE).getAll())
}

async function countRecords() {
  const db = await openDb()
  return reqToPromise(db.transaction(STORE, 'readonly').objectStore(STORE).count())
}

async function safeCount() {
  try {
    return await countRecords()
  } catch {
    return 0
  }
}

function emitChanged(count) {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_CHANGED_EVENT, { detail: { count } }))
  }
}

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function rehydrateFile(media) {
  const { blob, name, type } = media || {}
  try {
    if (typeof File === 'function') {
      return new File([blob], name || 'photo.jpg', { type: type || blob?.type || 'image/jpeg' })
    }
  } catch {
    // Fall through to the raw blob — the server sanitizes filenames anyway.
  }
  return blob
}

/**
 * Persist a report submission for later delivery. `files` are the raw File
 * objects from the media picker. Returns the queued record id.
 */
export async function enqueueReport({ payload, files = [] }) {
  const media = (files || [])
    .filter(Boolean)
    .map((file) => ({ blob: file, name: file.name || 'photo.jpg', type: file.type || 'image/jpeg' }))

  const record = {
    id: generateId(),
    payload,
    media,
    createdAt: Date.now(),
    attempts: 0,
    lastError: null,
  }

  await putRecord(record)
  emitChanged(await safeCount())
  return record.id
}

export async function getQueueCount() {
  return safeCount()
}

let processing = false

/**
 * Try to deliver every queued report, oldest first. A network failure stops the
 * run and keeps everything intact for the next retry; a server rejection counts
 * as an attempt and drops the record once it is clearly poison (MAX_ATTEMPTS).
 */
export async function processOfflineReportQueue() {
  if (processing) {
    return { processed: 0, remaining: await safeCount() }
  }
  if (!hasIndexedDb) {
    return { processed: 0, remaining: 0 }
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { processed: 0, remaining: await safeCount() }
  }

  processing = true
  let processed = 0

  try {
    const records = (await getAllRecords()).sort((a, b) => a.createdAt - b.createdAt)
    for (const record of records) {
      try {
        const created = await createReport(record.payload)
        if (created?.id && Array.isArray(record.media) && record.media.length > 0) {
          try {
            await uploadReportMedia(created.id, record.media.map(rehydrateFile))
          } catch {
            // Photos are best-effort; the report itself is already delivered.
          }
        }
        await deleteRecord(record.id)
        processed += 1
        emitChanged(await safeCount())
      } catch (error) {
        if (error?.isNetworkError) {
          // Still offline / flaky — stop and retry the whole queue later.
          break
        }
        record.attempts = (record.attempts || 0) + 1
        record.lastError = error?.message || 'submit_failed'
        if (record.attempts >= MAX_ATTEMPTS) {
          await deleteRecord(record.id)
        } else {
          await putRecord(record)
        }
        emitChanged(await safeCount())
      }
    }
  } finally {
    processing = false
  }

  return { processed, remaining: await safeCount() }
}

let initialized = false

/**
 * Wire up automatic delivery: drain on startup, whenever the browser fires
 * `online`, and on a slow poll (covers flaky networks where `online` never
 * fires but connectivity quietly returns). Safe to call more than once.
 */
export function initOfflineReportQueue() {
  if (initialized || typeof window === 'undefined' || !hasIndexedDb) {
    return
  }
  initialized = true

  const kick = () => {
    processOfflineReportQueue().catch(() => {})
  }

  window.addEventListener('online', kick)
  window.setInterval(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return
    }
    getQueueCount()
      .then((count) => {
        if (count > 0) kick()
      })
      .catch(() => {})
  }, RETRY_INTERVAL_MS)

  kick()
}
