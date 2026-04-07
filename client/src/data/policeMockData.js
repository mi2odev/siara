export const POLICE_INCIDENTS = [
  {
    id: 'INC-24031',
    type: 'Multi-vehicle collision',
    location: 'RN5, Constantine Center',
    wilaya: 'Constantine',
    commune: 'Constantine',
    city: 'Constantine',
    region: 'Central District',
    zone: 'Zone A',
    severity: 'high',
    status: 'reported',
    timeAgo: '2 min ago',
    occurredAt: '2026-03-26T16:21:00Z',
    reporter: 'Karim B.',
    assignedOfficer: 'Karim',
    reliability: 91,
    description: 'Three vehicles involved with partial lane blockage. Emergency access lane remains open.',
    image: 'https://images.unsplash.com/photo-1486006920555-c77dcf18193c?auto=format&fit=crop&w=800&q=80',
    lat: 36.365,
    lng: 6.614,
    responseMinutes: 7,
  },
  {
    id: 'INC-24032',
    type: 'Road blocked',
    location: 'El Amiria roundabout',
    wilaya: 'Constantine',
    commune: 'El Khroub',
    city: 'El Khroub',
    region: 'East District',
    zone: 'Zone B',
    severity: 'high',
    status: 'verified',
    timeAgo: '9 min ago',
    occurredAt: '2026-03-26T16:14:00Z',
    reporter: 'Nadia M.',
    assignedOfficer: 'Karim',
    reliability: 88,
    description: 'Heavy truck stalled in middle lane causing complete congestion in outbound direction.',
    image: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=800&q=80',
    lat: 36.356,
    lng: 6.622,
    responseMinutes: 11,
  },
  {
    id: 'INC-24033',
    type: 'Dangerous obstacle',
    location: 'A1 access ramp',
    wilaya: 'Constantine',
    commune: 'Didouche Mourad',
    city: 'Didouche Mourad',
    region: 'South District',
    zone: 'Zone C',
    severity: 'medium',
    status: 'reported',
    timeAgo: '14 min ago',
    occurredAt: '2026-03-26T16:09:00Z',
    reporter: 'Samir H.',
    assignedOfficer: 'Lina',
    reliability: 73,
    description: 'Debris reported in the right lane. Visibility reduced due to low evening light.',
    image: '',
    lat: 36.349,
    lng: 6.631,
    responseMinutes: 16,
  },
  {
    id: 'INC-24034',
    type: 'Minor accident',
    location: 'Boulevard Zaamouche',
    wilaya: 'Constantine',
    commune: 'Constantine',
    city: 'Constantine',
    region: 'Central District',
    zone: 'Zone A',
    severity: 'low',
    status: 'resolved',
    timeAgo: '31 min ago',
    occurredAt: '2026-03-26T15:52:00Z',
    reporter: 'Rami F.',
    assignedOfficer: 'Karim',
    reliability: 95,
    description: 'Two cars touched bumpers at low speed. Situation cleared by patrol unit.',
    image: '',
    lat: 36.371,
    lng: 6.602,
    responseMinutes: 9,
  },
  {
    id: 'INC-24035',
    type: 'Suspicious traffic behavior',
    location: 'University corridor',
    wilaya: 'Constantine',
    commune: 'Ali Mendjeli',
    city: 'Ali Mendjeli',
    region: 'West District',
    zone: 'Zone D',
    severity: 'medium',
    status: 'reported',
    timeAgo: '44 min ago',
    occurredAt: '2026-03-26T15:39:00Z',
    reporter: 'Lina A.',
    assignedOfficer: 'Lina',
    reliability: 64,
    description: 'Repeated dangerous overtaking near pedestrian crossing area.',
    image: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=800&q=80',
    lat: 36.341,
    lng: 6.642,
    responseMinutes: 18,
  },
]

export const POLICE_ACTIVE_ALERTS = [
  'Major accident - Zone A',
  'Blocked road - City center',
  'Congestion surge - RN5 corridor',
]

export const POLICE_FIELD_REPORTS = [
  {
    id: 'REP-9001',
    content: 'Traffic redirected to secondary lane while tow unit cleared the blocked truck. Flow recovered gradually.',
    officerName: 'Karim Bouzid',
    timestamp: '2026-03-26T16:28:00Z',
    incidentId: 'INC-24032',
  },
  {
    id: 'REP-9002',
    content: 'Debris removed from right lane. Reflective markers placed to secure shoulder until cleanup team arrived.',
    officerName: 'Lina Ait Salah',
    timestamp: '2026-03-26T16:18:00Z',
    incidentId: 'INC-24033',
  },
  {
    id: 'REP-9003',
    content: 'Witness statements collected from two drivers. No injuries reported. Vehicles moved out of primary lane.',
    officerName: 'Karim Bouzid',
    timestamp: '2026-03-26T16:12:00Z',
    incidentId: 'INC-24031',
  },
  {
    id: 'REP-9004',
    content: 'Patrol observed repeated overtaking near crossing area. Temporary patrol point established for deterrence.',
    officerName: 'Lina Ait Salah',
    timestamp: '2026-03-26T15:47:00Z',
    incidentId: 'INC-24035',
  },
  {
    id: 'REP-9005',
    content: 'Follow-up check confirmed scene cleared and no residual congestion in the central corridor.',
    officerName: 'Karim Bouzid',
    timestamp: '2026-03-26T15:59:00Z',
    incidentId: 'INC-24034',
  },
]

export const POLICE_CRITICAL_ALERTS = [
  {
    id: 'ALT-3001',
    title: 'Multi-car collision escalating on RN5',
    severity: 'high',
    area: 'RN5, Constantine Center',
    createdAt: '2026-03-26T16:34:00Z',
  },
  {
    id: 'ALT-3002',
    title: 'Blocked roundabout causing full standstill',
    severity: 'high',
    area: 'El Amiria roundabout',
    createdAt: '2026-03-26T16:27:00Z',
  },
  {
    id: 'ALT-3003',
    title: 'Obstacle risk near highway access ramp',
    severity: 'medium',
    area: 'A1 access ramp',
    createdAt: '2026-03-26T16:19:00Z',
  },
  {
    id: 'ALT-3004',
    title: 'Congestion spike near university corridor',
    severity: 'medium',
    area: 'University corridor',
    createdAt: '2026-03-26T16:06:00Z',
  },
  {
    id: 'ALT-3005',
    title: 'Risky overtaking trend detected',
    severity: 'low',
    area: 'Ali Mendjeli crossing sector',
    createdAt: '2026-03-26T15:58:00Z',
  },
]

export const POLICE_OPERATION_HISTORY = [
  {
    id: 'OP-7001',
    actionType: 'verified_incident',
    officerName: 'Karim Bouzid',
    timestamp: '2026-03-26T16:40:00Z',
    incidentId: 'INC-24032',
  },
  {
    id: 'OP-7002',
    actionType: 'requested_backup',
    officerName: 'Karim Bouzid',
    timestamp: '2026-03-26T16:31:00Z',
    incidentId: 'INC-24031',
  },
  {
    id: 'OP-7003',
    actionType: 'rejected_report',
    officerName: 'Lina Ait Salah',
    timestamp: '2026-03-26T16:24:00Z',
    incidentId: 'INC-24033',
  },
  {
    id: 'OP-7004',
    actionType: 'verified_incident',
    officerName: 'Karim Bouzid',
    timestamp: '2026-03-26T16:15:00Z',
    incidentId: 'INC-24034',
  },
  {
    id: 'OP-7005',
    actionType: 'requested_backup',
    officerName: 'Lina Ait Salah',
    timestamp: '2026-03-26T16:02:00Z',
    incidentId: 'INC-24035',
  },
  {
    id: 'OP-7006',
    actionType: 'rejected_report',
    officerName: 'Karim Bouzid',
    timestamp: '2026-03-26T15:54:00Z',
    incidentId: 'INC-24035',
  },
]

const POLICE_INCIDENTS_STORAGE_KEY = 'siara.police.incidents'
const POLICE_INCIDENTS_UPDATED_EVENT = 'siara:police-incidents-updated'

export function getPoliceIncidents() {
  if (typeof window === 'undefined') return [...POLICE_INCIDENTS]

  try {
    const raw = window.localStorage.getItem(POLICE_INCIDENTS_STORAGE_KEY)
    if (!raw) return [...POLICE_INCIDENTS]

    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : [...POLICE_INCIDENTS]
  } catch {
    return [...POLICE_INCIDENTS]
  }
}

export function savePoliceIncidents(items) {
  if (typeof window === 'undefined') return

  const nextItems = Array.isArray(items) ? items : []
  try {
    window.localStorage.setItem(POLICE_INCIDENTS_STORAGE_KEY, JSON.stringify(nextItems))
  } catch {
    // Ignore storage quota/private-mode write failures.
  }

  window.dispatchEvent(new CustomEvent(POLICE_INCIDENTS_UPDATED_EVENT))
}

export function updatePoliceIncidentStatus(incidentId, status) {
  const nextItems = getPoliceIncidents().map((item) => (
    item.id === incidentId ? { ...item, status } : item
  ))
  savePoliceIncidents(nextItems)
  return nextItems
}

export function subscribePoliceIncidents(listener) {
  if (typeof window === 'undefined') return () => {}

  const handler = () => {
    if (typeof listener === 'function') {
      listener(getPoliceIncidents())
    }
  }

  window.addEventListener(POLICE_INCIDENTS_UPDATED_EVENT, handler)
  return () => window.removeEventListener(POLICE_INCIDENTS_UPDATED_EVENT, handler)
}

export function getPoliceFieldReports() {
  return [...POLICE_FIELD_REPORTS]
}

export function getPoliceCriticalAlerts() {
  return [...POLICE_CRITICAL_ALERTS]
}

export function getPoliceOperationHistory() {
  return [...POLICE_OPERATION_HISTORY]
}
