import StraightOutlinedIcon from '@mui/icons-material/StraightOutlined'
import {
  formatDistanceMeters,
  NAVIGATION_TURN_ICONS,
} from '../../utils/navigationHelpers'

export default function NavigationBanner({
  open,
  currentStep,
  nextStep,
  distanceToCurrentStepM,
  routeWarning,
}) {
  if (!open) return null

  const Icon =
    currentStep?.icon || NAVIGATION_TURN_ICONS[currentStep?.turnType] || StraightOutlinedIcon
  const instruction = currentStep?.instruction || 'Follow the route'
  const direction = currentStep?.direction
    ? ` (${currentStep.direction})`
    : ''
  const distanceLabel = Number.isFinite(Number(distanceToCurrentStepM))
    ? formatDistanceMeters(distanceToCurrentStepM)
    : null
  const nextLabel = nextStep && nextStep.turnType !== 'arrive'
    ? `Then ${(nextStep.instruction || '').toLowerCase()}`
    : nextStep && nextStep.turnType === 'arrive'
      ? 'Then arrive at destination'
      : null

  return (
    <div className="siara-nav-banner" role="status" aria-live="polite">
      <div className="siara-nav-banner__icon" aria-hidden="true"><Icon fontSize="inherit" /></div>
      <div className="siara-nav-banner__body">
        <div className="siara-nav-banner__primary">
          {distanceLabel ? (
            <span className="siara-nav-banner__distance">In {distanceLabel}</span>
          ) : null}
          <span className="siara-nav-banner__instruction">
            {instruction}
            {direction}
          </span>
        </div>
        {nextLabel ? (
          <div className="siara-nav-banner__next">{nextLabel}</div>
        ) : null}
        {routeWarning ? (
          <div className="siara-nav-banner__warning">{routeWarning}</div>
        ) : null}
      </div>
    </div>
  )
}
