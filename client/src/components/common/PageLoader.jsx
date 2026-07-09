import { useTranslation } from 'react-i18next'
import './PageLoader.css'

/**
 * Suspense fallback for lazily-loaded route chunks. Intentionally minimal so it
 * appears instantly while a page bundle downloads.
 */
export default function PageLoader() {
  const { t } = useTranslation(['common'])
  return (
    <div className="siara-page-loader" role="status" aria-live="polite">
      <span className="siara-page-loader__spinner" aria-hidden="true" />
      <span className="siara-page-loader__label">
        {t('actions.loading', { defaultValue: 'Loading…' })}
      </span>
    </div>
  )
}
