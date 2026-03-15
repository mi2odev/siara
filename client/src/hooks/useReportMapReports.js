import { useEffect, useMemo, useState } from 'react'

import { listReports } from '../services/reportsService'

function toFiniteNumber(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function normalizeReportForMap(report) {
  if (!report || typeof report !== 'object') {
    return null
  }

  const nestedLocation = report.location && typeof report.location === 'object'
    ? report.location
    : null
  const lat = toFiniteNumber(nestedLocation?.lat ?? report.lat)
  const lng = toFiniteNumber(nestedLocation?.lng ?? report.lng)

  return {
    ...report,
    incidentType: report.incidentType || report.type || 'other',
    locationLabel: report.locationLabel || nestedLocation?.label || '',
    media: Array.isArray(report.media) ? report.media : [],
    lat,
    lng,
    location: {
      ...(nestedLocation || {}),
      lat,
      lng,
    },
  }
}

export default function useReportMapReports({
  limit = 100,
  feed = 'latest',
  sort = 'recent',
} = {}) {
  const [reports, setReports] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const loadReports = async () => {
      setIsLoading(true)
      setError('')

      try {
        const response = await listReports({ limit, offset: 0, feed, sort })
        if (cancelled) {
          return
        }

        setReports(
          (Array.isArray(response?.reports) ? response.reports : [])
            .map(normalizeReportForMap)
            .filter(Boolean),
        )
      } catch (loadError) {
        if (cancelled) {
          return
        }

        setReports([])
        setError(loadError?.message || 'Failed to load reports')
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadReports()

    return () => {
      cancelled = true
    }
  }, [feed, limit, sort])

  const mapReadyReports = useMemo(
    () => reports.filter((report) => report.lat != null && report.lng != null),
    [reports],
  )

  return {
    reports,
    mapReadyReports,
    isLoading,
    error,
  }
}
