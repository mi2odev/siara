import RouteExplanationCard from '../../components/map/RouteExplanationCard'

const SAMPLE_REASONS = [
  {
    id: 'r1',
    type: 'cluster',
    label: 'Avoids 2 high-risk accident clusters',
    detail: 'Bab Ezzouar junction & RN24 km 12 (18 reports last 30 days)',
    impact: 'positive',
    impactLabel: '−24% risk',
  },
  {
    id: 'r2',
    type: 'segment',
    label: '1 high-risk road segment skipped',
    detail: 'Steep curve on RN5 with 4 severe reports',
    impact: 'positive',
    impactLabel: '−8% risk',
  },
  {
    id: 'r3',
    type: 'reports',
    label: '3 recent reports near route',
    detail: '2 verified by police, 1 pending review',
    impact: 'neutral',
    impactLabel: 'monitor',
  },
  {
    id: 'r4',
    type: 'time',
    label: 'Evening rush hour ahead',
    detail: 'Departure at 17:42 — peak risk window 17:00–20:00',
    impact: 'negative',
    impactLabel: '+5% risk',
  },
  {
    id: 'r5',
    type: 'tradeoff',
    label: 'Adds 4 minutes vs. fastest route',
    detail: 'Recommended for 32% lower predicted risk',
    impact: 'neutral',
    impactLabel: '+4 min',
  },
]

const wrapStyle = {
  minHeight: '100vh',
  background: '#EEF6FF',
  padding: '40px 20px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '24px',
}

const headingStyle = {
  fontSize: '20px',
  fontWeight: 700,
  color: '#0F172A',
  margin: 0,
}

const sectionStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  alignItems: 'center',
}

const labelStyle = {
  fontSize: '12px',
  fontWeight: 600,
  color: '#64748B',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

export default function RouteExplanationPreviewPage() {
  return (
    <div style={wrapStyle}>
      <h1 style={headingStyle}>RouteExplanationCard — design preview</h1>

      <div style={sectionStyle}>
        <span style={labelStyle}>Default state (balanced route, moderate risk)</span>
        <RouteExplanationCard
          summary="SIARA recommends this route because it avoids 2 high-risk accident clusters and has 32% lower predicted risk than the fastest route. It adds 4 minutes but skips a high-severity area near the destination."
          reasons={SAMPLE_REASONS}
          comparison={{
            fastestRisk: 62,
            balancedRisk: 39,
            safestRisk: 28,
            safestExtraMinutes: 6,
          }}
          recommendedRouteType="balanced"
          recommendedRiskLevel="moderate"
          recommendedRiskPercent={39}
          details={
            'Risk model: SIARA v2 (gradient-boosted)\n' +
            'Sampled 12 points along route\n' +
            'Heatmap clusters within 200m: 2\n' +
            'Reports within 500m last 7d: 3 (2 police-verified)\n' +
            'Weather: clear, visibility good\n' +
            'Time-of-day adjustment: +5% (evening rush)'
          }
        />
      </div>

      <div style={sectionStyle}>
        <span style={labelStyle}>High-risk warning state (fastest route, high risk)</span>
        <RouteExplanationCard
          summary="The fastest route crosses 3 high-risk accident clusters. Consider the safer alternative — it adds 6 minutes but cuts predicted risk by more than half."
          reasons={[
            {
              id: 'h1',
              type: 'cluster',
              label: '3 high-risk clusters on route',
              detail: 'Bab Ezzouar, El Harrach, RN5 km 18',
              impact: 'negative',
              impactLabel: '+34% risk',
            },
            {
              id: 'h2',
              type: 'reports',
              label: '5 recent severe reports',
              detail: '4 within last 24h, 2 police-verified',
              impact: 'negative',
              impactLabel: 'high',
            },
            {
              id: 'h3',
              type: 'segment',
              label: '2 dangerous segments traversed',
              detail: 'Both flagged as high-severity in last 30 days',
              impact: 'negative',
              impactLabel: '+12% risk',
            },
          ]}
          comparison={{
            fastestRisk: 78,
            balancedRisk: 52,
            safestRisk: 31,
            safestExtraMinutes: 6,
          }}
          recommendedRouteType="fastest"
          recommendedRiskLevel="high"
          recommendedRiskPercent={78}
        />
      </div>

      <div style={sectionStyle}>
        <span style={labelStyle}>Loading state</span>
        <RouteExplanationCard loading />
      </div>

      <div style={sectionStyle}>
        <span style={labelStyle}>Error state</span>
        <RouteExplanationCard
          error="Could not generate an explanation. Showing risk numbers only."
          onRetry={() => undefined}
        />
      </div>

      <div style={sectionStyle}>
        <span style={labelStyle}>Empty state</span>
        <RouteExplanationCard />
      </div>
    </div>
  )
}
