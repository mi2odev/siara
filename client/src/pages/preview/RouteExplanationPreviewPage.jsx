import { useTranslation } from 'react-i18next'
import RouteExplanationCard from '../../components/map/RouteExplanationCard'

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
  const { t } = useTranslation(['pages', 'common'])

  const SAMPLE_REASONS = [
    {
      id: 'r1',
      type: 'cluster',
      label: t('routeExplanationPreviewPage.reasons.r1.label'),
      detail: t('routeExplanationPreviewPage.reasons.r1.detail'),
      impact: 'positive',
      impactLabel: t('routeExplanationPreviewPage.reasons.r1.impactLabel'),
    },
    {
      id: 'r2',
      type: 'segment',
      label: t('routeExplanationPreviewPage.reasons.r2.label'),
      detail: t('routeExplanationPreviewPage.reasons.r2.detail'),
      impact: 'positive',
      impactLabel: t('routeExplanationPreviewPage.reasons.r2.impactLabel'),
    },
    {
      id: 'r3',
      type: 'reports',
      label: t('routeExplanationPreviewPage.reasons.r3.label'),
      detail: t('routeExplanationPreviewPage.reasons.r3.detail'),
      impact: 'neutral',
      impactLabel: t('routeExplanationPreviewPage.reasons.r3.impactLabel'),
    },
    {
      id: 'r4',
      type: 'time',
      label: t('routeExplanationPreviewPage.reasons.r4.label'),
      detail: t('routeExplanationPreviewPage.reasons.r4.detail'),
      impact: 'negative',
      impactLabel: t('routeExplanationPreviewPage.reasons.r4.impactLabel'),
    },
    {
      id: 'r5',
      type: 'tradeoff',
      label: t('routeExplanationPreviewPage.reasons.r5.label'),
      detail: t('routeExplanationPreviewPage.reasons.r5.detail'),
      impact: 'neutral',
      impactLabel: t('routeExplanationPreviewPage.reasons.r5.impactLabel'),
    },
  ]

  return (
    <div style={wrapStyle}>
      <h1 style={headingStyle}>{t('routeExplanationPreviewPage.heading')}</h1>

      <div style={sectionStyle}>
        <span style={labelStyle}>{t('routeExplanationPreviewPage.sections.default.label')}</span>
        <RouteExplanationCard
          summary={t('routeExplanationPreviewPage.sections.default.summary')}
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
          details={t('routeExplanationPreviewPage.sections.default.details')}
        />
      </div>

      <div style={sectionStyle}>
        <span style={labelStyle}>{t('routeExplanationPreviewPage.sections.highRisk.label')}</span>
        <RouteExplanationCard
          summary={t('routeExplanationPreviewPage.sections.highRisk.summary')}
          reasons={[
            {
              id: 'h1',
              type: 'cluster',
              label: t('routeExplanationPreviewPage.sections.highRisk.reasons.h1.label'),
              detail: t('routeExplanationPreviewPage.sections.highRisk.reasons.h1.detail'),
              impact: 'negative',
              impactLabel: t('routeExplanationPreviewPage.sections.highRisk.reasons.h1.impactLabel'),
            },
            {
              id: 'h2',
              type: 'reports',
              label: t('routeExplanationPreviewPage.sections.highRisk.reasons.h2.label'),
              detail: t('routeExplanationPreviewPage.sections.highRisk.reasons.h2.detail'),
              impact: 'negative',
              impactLabel: t('routeExplanationPreviewPage.sections.highRisk.reasons.h2.impactLabel'),
            },
            {
              id: 'h3',
              type: 'segment',
              label: t('routeExplanationPreviewPage.sections.highRisk.reasons.h3.label'),
              detail: t('routeExplanationPreviewPage.sections.highRisk.reasons.h3.detail'),
              impact: 'negative',
              impactLabel: t('routeExplanationPreviewPage.sections.highRisk.reasons.h3.impactLabel'),
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
        <span style={labelStyle}>{t('routeExplanationPreviewPage.sections.loading.label')}</span>
        <RouteExplanationCard loading />
      </div>

      <div style={sectionStyle}>
        <span style={labelStyle}>{t('routeExplanationPreviewPage.sections.error.label')}</span>
        <RouteExplanationCard
          error={t('routeExplanationPreviewPage.sections.error.errorMessage')}
          onRetry={() => undefined}
        />
      </div>

      <div style={sectionStyle}>
        <span style={labelStyle}>{t('routeExplanationPreviewPage.sections.empty.label')}</span>
        <RouteExplanationCard />
      </div>
    </div>
  )
}
