import { useMemo, useState } from 'react'

/**
 * Shared sorting helpers for the police-facing list pages.
 *
 * Every list page exposes the same "Sort by" control (Date / Severity /
 * Reporter / Name / ID, plus Distance on the nearby page). The accessor maps
 * below describe how to pull a comparable value out of each item shape, and
 * `usePoliceSort` wires the key + direction state into a memoized sorted array.
 */

export const SEVERITY_RANK = { low: 1, medium: 2, high: 3, critical: 4 }

/** Comparable timestamp (ms) or null when missing/invalid. */
export function dateValue(value) {
  if (!value) return null
  const t = new Date(value).getTime()
  return Number.isFinite(t) ? t : null
}

/** Severity → numeric rank so low < medium < high < critical. */
export function severityValue(value) {
  return SEVERITY_RANK[String(value || '').toLowerCase()] || 0
}

/** Numeric id when possible, else null (so it sorts to the end). */
export function numericId(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Null-safe comparator: numbers numerically, everything else as text. */
function compareForSort(a, b) {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

/** Pure sort — returns a new array; leaves input untouched when key is empty. */
export function sortItems(items, key, dir, accessors) {
  const get = accessors?.[key]
  if (!Array.isArray(items) || !key || typeof get !== 'function') return items
  const mult = dir === 'asc' ? 1 : -1
  return [...items].sort((x, y) => compareForSort(get(x), get(y)) * mult)
}

/* ── Accessor maps per item shape ───────────────────────────────────────── */

/** Incidents / field reports / verification queue / my incidents. */
export const INCIDENT_SORT_ACCESSORS = {
  date: (i) => dateValue(i.occurredAt || i.createdAt),
  severity: (i) => severityValue(i.severity),
  user: (i) => (i.reportedBy?.name || i.assignedOfficer?.name || '').toLowerCase(),
  name: (i) => (i.title || '').toLowerCase(),
  id: (i) => numericId(i.id),
}

/** Priority queue (uses reportId, no reporter exposed). */
export const QUEUE_SORT_ACCESSORS = {
  date: (i) => dateValue(i.createdAt),
  severity: (i) => severityValue(i.severity),
  name: (i) => (i.title || '').toLowerCase(),
  id: (i) => numericId(i.reportId),
}

/** Supervisor / targeted alerts. */
export const ALERT_SORT_ACCESSORS = {
  date: (i) => dateValue(i.createdAt),
  severity: (i) => severityValue(i.severity),
  name: (i) => (i.title || '').toLowerCase(),
  id: (i) => numericId(i.id),
}

/** Operation history timeline. */
export const HISTORY_SORT_ACCESSORS = {
  date: (i) => dateValue(i.createdAt),
  severity: (i) => severityValue(i.severity),
  user: (i) => (i.officer?.name || '').toLowerCase(),
  name: (i) => (i.title || i.actionType || '').toLowerCase(),
  id: (i) => numericId(i.id),
}

/** Nearby incidents (keeps distance as the default order). */
export const NEARBY_SORT_ACCESSORS = {
  distance: (i) => (i.distanceMeters == null ? null : Number(i.distanceMeters)),
  date: (i) => dateValue(i.occurredAt || i.createdAt),
  severity: (i) => severityValue(i.severity),
  user: (i) => (i.reportedBy?.name || i.assignedOfficer?.name || '').toLowerCase(),
  name: (i) => (i.title || '').toLowerCase(),
  id: (i) => numericId(i.id),
}

/* ── Option lists for the dropdown ──────────────────────────────────────── */

export const INCIDENT_SORT_OPTIONS = [
  { value: 'date', label: 'Date' },
  { value: 'severity', label: 'Severity' },
  { value: 'user', label: 'Reporter' },
  { value: 'name', label: 'Name' },
  { value: 'id', label: 'ID' },
]

export const QUEUE_SORT_OPTIONS = [
  { value: 'date', label: 'Date' },
  { value: 'severity', label: 'Severity' },
  { value: 'name', label: 'Name' },
  { value: 'id', label: 'ID' },
]

export const ALERT_SORT_OPTIONS = QUEUE_SORT_OPTIONS

export const HISTORY_SORT_OPTIONS = [
  { value: 'date', label: 'Date' },
  { value: 'severity', label: 'Severity' },
  { value: 'user', label: 'Officer' },
  { value: 'name', label: 'Action' },
  { value: 'id', label: 'ID' },
]

export const NEARBY_SORT_OPTIONS = [
  { value: 'distance', label: 'Distance' },
  { value: 'date', label: 'Date' },
  { value: 'severity', label: 'Severity' },
  { value: 'user', label: 'Reporter' },
  { value: 'name', label: 'Name' },
  { value: 'id', label: 'ID' },
]

/**
 * Hook that owns sort key + direction and returns the sorted array.
 * `accessors` must be a stable reference (use the module-level maps above).
 */
export function usePoliceSort(items, accessors, defaultKey = 'date', defaultDir = 'desc') {
  const [sortKey, setSortKey] = useState(defaultKey)
  const [sortDir, setSortDir] = useState(defaultDir)
  const sorted = useMemo(
    () => sortItems(items, sortKey, sortDir, accessors),
    [items, sortKey, sortDir, accessors],
  )
  return {
    sorted,
    sortKey,
    setSortKey,
    sortDir,
    toggleDir: () => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')),
  }
}
