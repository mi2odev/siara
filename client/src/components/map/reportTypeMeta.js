const TYPE_ALIASES = {
  accident: 'accident',
  crash: 'accident',
  collision: 'accident',
  traffic: 'traffic',
  jam: 'traffic',
  congestion: 'traffic',
  danger: 'danger',
  hazard: 'danger',
  obstacle: 'danger',
  weather: 'weather',
  rain: 'weather',
  fog: 'weather',
  storm: 'weather',
  roadwork: 'roadworks',
  roadworks: 'roadworks',
  construction: 'roadworks',
  works: 'roadworks',
  other: 'other',
}

export function normalizeReportType(value) {
  const normalizedType = String(value || 'other').trim().toLowerCase()
  return TYPE_ALIASES[normalizedType] || 'other'
}
