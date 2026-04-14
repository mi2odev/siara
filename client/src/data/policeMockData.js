export const POLICE_INCIDENTS = [
  {
    id: 'INC-24031',
    type: 'Multi-vehicle collision',
    location: 'RN5, Constantine Center',
    zone: 'Zone A',
    severity: 'high',
    status: 'reported',
    timeAgo: '2 min ago',
    occurredAt: '2026-03-26T16:21:00Z',
    reporter: 'Karim B.',
    reliability: 91,
    description: 'Three vehicles involved with partial lane blockage. Emergency access lane remains open.',
    image: 'https://images.unsplash.com/photo-1486006920555-c77dcf18193c?auto=format&fit=crop&w=800&q=80',
    lat: 36.365,
    lng: 6.614,
    responseMinutes: 7,
    assignedOfficer: 'Karim',
  },
  {
    id: 'INC-24032',
    type: 'Road blocked',
    location: 'El Amiria roundabout',
    zone: 'Zone B',
    severity: 'high',
    status: 'verified',
    timeAgo: '9 min ago',
    occurredAt: '2026-03-26T16:14:00Z',
    reporter: 'Nadia M.',
    reliability: 88,
    description: 'Heavy truck stalled in middle lane causing complete congestion in outbound direction.',
    image: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=800&q=80',
    lat: 36.356,
    lng: 6.622,
    responseMinutes: 11,
    assignedOfficer: 'Lina',
  },
  {
    id: 'INC-24033',
    type: 'Dangerous obstacle',
    location: 'A1 access ramp',
    zone: 'Zone C',
    severity: 'medium',
    status: 'reported',
    timeAgo: '14 min ago',
    occurredAt: '2026-03-26T16:09:00Z',
    reporter: 'Samir H.',
    reliability: 73,
    description: 'Debris reported in the right lane. Visibility reduced due to low evening light.',
    image: '',
    lat: 36.349,
    lng: 6.631,
    responseMinutes: 16,
    assignedOfficer: 'Karim',
  },
  {
    id: 'INC-24034',
    type: 'Minor accident',
    location: 'Boulevard Zaamouche',
    zone: 'Zone A',
    severity: 'low',
    status: 'resolved',
    timeAgo: '31 min ago',
    occurredAt: '2026-03-26T15:52:00Z',
    reporter: 'Rami F.',
    reliability: 95,
    description: 'Two cars touched bumpers at low speed. Situation cleared by patrol unit.',
    image: '',
    lat: 36.371,
    lng: 6.602,
    responseMinutes: 9,
    assignedOfficer: 'Lina',
  },
  {
    id: 'INC-24035',
    type: 'Suspicious traffic behavior',
    location: 'University corridor',
    zone: 'Zone D',
    severity: 'medium',
    status: 'reported',
    timeAgo: '44 min ago',
    occurredAt: '2026-03-26T15:39:00Z',
    reporter: 'Lina A.',
    reliability: 64,
    description: 'Repeated dangerous overtaking near pedestrian crossing area.',
    image: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=800&q=80',
    lat: 36.341,
    lng: 6.642,
    responseMinutes: 18,
    assignedOfficer: 'Karim',
  },
]

export const POLICE_ACTIVE_ALERTS = [
  'Major accident - Zone A',
  'Blocked road - City center',
  'Congestion surge - RN5 corridor',
]

const CRITICAL_ALERTS = [
  {
    id: 'ALT-901',
    title: 'Multi-vehicle crash pressure increasing',
    severity: 'high',
    area: 'Constantine Center',
    createdAt: '2026-03-26T16:30:00Z',
  },
  {
    id: 'ALT-902',
    title: 'Traffic blockage persists near El Amiria',
    severity: 'medium',
    area: 'El Amiria roundabout',
    createdAt: '2026-03-26T16:25:00Z',
  },
  {
    id: 'ALT-903',
    title: 'Debris risk flagged on A1 access ramp',
    severity: 'medium',
    area: 'A1 access ramp',
    createdAt: '2026-03-26T16:16:00Z',
  },
  {
    id: 'ALT-904',
    title: 'Unsafe overtaking reports near university corridor',
    severity: 'low',
    area: 'University corridor',
    createdAt: '2026-03-26T15:55:00Z',
  },
]

const FIELD_REPORTS = [
  {
    id: 'FR-001',
    incidentId: 'INC-24031',
    officerName: 'Karim',
    content: 'Two lanes partially blocked; patrol placed temporary cones.',
    timestamp: '2026-03-26T16:24:00Z',
  },
  {
    id: 'FR-002',
    incidentId: 'INC-24032',
    officerName: 'Lina',
    content: 'Tow truck requested; traffic redirected through side lane.',
    timestamp: '2026-03-26T16:18:00Z',
  },
  {
    id: 'FR-003',
    incidentId: 'INC-24035',
    officerName: 'Karim',
    content: 'Observed repeated dangerous overtakes during peak traffic.',
    timestamp: '2026-03-26T15:47:00Z',
  },
]

const OPERATION_HISTORY = [
  {
    id: 'OP-001',
    incidentId: 'INC-24032',
    officerName: 'Lina',
    actionType: 'verified_incident',
    timestamp: '2026-03-26T16:19:00Z',
  },
  {
    id: 'OP-002',
    incidentId: 'INC-24031',
    officerName: 'Karim',
    actionType: 'requested_backup',
    timestamp: '2026-03-26T16:26:00Z',
  },
  {
    id: 'OP-003',
    incidentId: 'INC-24035',
    officerName: 'Karim',
    actionType: 'rejected_report',
    timestamp: '2026-03-26T15:58:00Z',
  },
]

let policeIncidentsState = POLICE_INCIDENTS.map((item) => ({ ...item }))
const policeIncidentListeners = new Set()

function notifyPoliceIncidentListeners() {
  const snapshot = policeIncidentsState.map((item) => ({ ...item }))
  policeIncidentListeners.forEach((listener) => {
    try {
      listener(snapshot)
    } catch {
      // Ignore listener failures in mock mode.
    }
  })
}

export function getPoliceIncidents() {
  return policeIncidentsState.map((item) => ({ ...item }))
}

export function savePoliceIncidents(nextItems) {
  if (!Array.isArray(nextItems)) return
  policeIncidentsState = nextItems.map((item) => ({ ...item }))
  notifyPoliceIncidentListeners()
}

export function subscribePoliceIncidents(listener) {
  if (typeof listener !== 'function') {
    return () => {}
  }

  policeIncidentListeners.add(listener)
  listener(getPoliceIncidents())
  return () => {
    policeIncidentListeners.delete(listener)
  }
}

export function updatePoliceIncidentStatus(incidentId, nextStatus) {
  if (!incidentId || !nextStatus) return
  let didUpdate = false

  policeIncidentsState = policeIncidentsState.map((item) => {
    if (item.id !== incidentId) return item
    didUpdate = true
    return { ...item, status: nextStatus }
  })

  if (didUpdate) {
    notifyPoliceIncidentListeners()
  }
}

export function getPoliceCriticalAlerts() {
  return CRITICAL_ALERTS.map((item) => ({ ...item }))
}

export function getPoliceFieldReports() {
  return FIELD_REPORTS.map((item) => ({ ...item }))
}

export function getPoliceOperationHistory() {
  return OPERATION_HISTORY.map((item) => ({ ...item }))
}
