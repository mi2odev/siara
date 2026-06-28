import React from 'react'
import { useTranslation } from 'react-i18next'

export default function MarkersLayer({ points = [] }) {
  const { t } = useTranslation(['map', 'common'])
  return (
    <div style={{padding:12,color:'var(--siara-accent)'}}>{t('markersLayer.markersCount', { count: points.length })}</div>
  )
}
