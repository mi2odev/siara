import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import { useTranslation } from 'react-i18next'

function formatCoordinate(value) {
  const num = Number(value)
  return Number.isFinite(num) ? num.toFixed(4) : "—"
}

export default function MapDestinationConfirmCard({
  open,
  destination,
  destinationName,
  loading,
  error,
  onConfirm,
  onCancel,
  starting = false,
  startError = "",
}) {
  const { t } = useTranslation(['map', 'common'])

  if (!open || !destination) return null

  const lat = Number(destination.lat)
  const lng = Number(destination.lng)
  const fallbackLabel = t('mapDestinationConfirmCard.fallbackLabel', { lat: formatCoordinate(lat), lng: formatCoordinate(lng) })
  const showName = !loading && destinationName && destinationName.length > 0
  const label = showName ? destinationName : fallbackLabel

  return (
    <div
      className="siara-map-destination-card"
      role="dialog"
      aria-modal="false"
      aria-label={t('mapDestinationConfirmCard.ariaLabel')}
    >
      <div className="siara-map-destination-card__header">
        <span className="siara-map-destination-card__pin" aria-hidden="true">
          <LocationOnOutlinedIcon fontSize="inherit" />
        </span>
        <h4 className="siara-map-destination-card__title">{t('mapDestinationConfirmCard.title')}</h4>
      </div>
      <p className="siara-map-destination-card__label" title={label}>
        {loading ? t('mapDestinationConfirmCard.lookingUpPlace') : label}
      </p>
      {starting ? (
        <p className="siara-map-destination-card__hint">
          {t('mapDestinationConfirmCard.calculatingRouteRisk')}
        </p>
      ) : !loading && !showName ? (
        <p className="siara-map-destination-card__hint">
          {error
            ? t('mapDestinationConfirmCard.hintNameError')
            : t('mapDestinationConfirmCard.hintNoName')}
        </p>
      ) : (
        <p className="siara-map-destination-card__hint">
          {t('mapDestinationConfirmCard.hintDefault')}
        </p>
      )}
      {!starting && startError ? (
        <p className="siara-map-destination-card__error" role="alert">{startError}</p>
      ) : null}
      <div className="siara-map-destination-card__actions">
        <button
          type="button"
          className="siara-map-destination-card__btn siara-map-destination-card__btn--secondary"
          onClick={onCancel}
        >
          {t('common:actions.cancel')}
        </button>
        <button
          type="button"
          className="siara-map-destination-card__btn siara-map-destination-card__btn--primary"
          onClick={onConfirm}
          disabled={starting}
        >
          {starting ? (
            <>
              <span
                className="siara-map-destination-card__spinner"
                aria-hidden="true"
              />
              {t('mapDestinationConfirmCard.calculatingRoute')}
            </>
          ) : (
            t('mapDestinationConfirmCard.startTravel')
          )}
        </button>
      </div>
    </div>
  )
}
