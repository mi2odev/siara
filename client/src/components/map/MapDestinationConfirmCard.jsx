import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'

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
  if (!open || !destination) return null

  const lat = Number(destination.lat)
  const lng = Number(destination.lng)
  const fallbackLabel = `Selected point: ${formatCoordinate(lat)}, ${formatCoordinate(lng)}`
  const showName = !loading && destinationName && destinationName.length > 0
  const label = showName ? destinationName : fallbackLabel

  return (
    <div
      className="siara-map-destination-card"
      role="dialog"
      aria-modal="false"
      aria-label="Confirm destination"
    >
      <div className="siara-map-destination-card__header">
        <span className="siara-map-destination-card__pin" aria-hidden="true">
          <LocationOnOutlinedIcon fontSize="inherit" />
        </span>
        <h4 className="siara-map-destination-card__title">Start your travel with SIARA?</h4>
      </div>
      <p className="siara-map-destination-card__label" title={label}>
        {loading ? "Looking up place name…" : label}
      </p>
      {starting ? (
        <p className="siara-map-destination-card__hint">
          Calculating SIARA route risk…
        </p>
      ) : !loading && !showName ? (
        <p className="siara-map-destination-card__hint">
          {error
            ? "Could not look up a place name, but you can still travel using the coordinates."
            : "No street name found for this point — coordinates will be used."}
        </p>
      ) : (
        <p className="siara-map-destination-card__hint">
          SIARA will calculate road risk and guide you using the safest route.
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
          Cancel
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
              Calculating route…
            </>
          ) : (
            "Start travel"
          )}
        </button>
      </div>
    </div>
  )
}
