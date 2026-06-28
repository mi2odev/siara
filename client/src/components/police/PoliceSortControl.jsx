import React from 'react'
import { useTranslation } from 'react-i18next'
import FancySelect from '../ui/FancySelect'
import './PoliceSortControl.css'

/**
 * Sort control shared across the police list pages: a styled "Sort" dropdown
 * (FancySelect) plus a direction toggle. Pairs with `usePoliceSort` from
 * utils/policeSort.js.
 *
 * Props:
 *   - options    : Array<{ value, label }> (e.g. INCIDENT_SORT_OPTIONS)
 *   - value      : current sort key
 *   - direction  : 'asc' | 'desc'
 *   - onChange   : (key) => void
 *   - onToggleDirection : () => void
 *   - menuAlign  : passed through to FancySelect ('left' default)
 *   - className  : extra class on the wrapper
 */
export default function PoliceSortControl({
  options,
  value,
  direction = 'desc',
  onChange,
  onToggleDirection,
  menuAlign = 'left',
  label,
  className = '',
}) {
  const { t } = useTranslation(['police', 'common'])

  const resolvedLabel = label !== undefined ? label : t('policeSortControl.sort')

  return (
    <div className={`police-sort-control${className ? ` ${className}` : ''}`}>
      <FancySelect
        label={resolvedLabel}
        value={value}
        onChange={onChange}
        options={options}
        menuAlign={menuAlign}
        size="sm"
      />
      <button
        type="button"
        className="police-sort-dir"
        onClick={onToggleDirection}
        aria-label={direction === 'asc' ? t('policeSortControl.ariaAscending') : t('policeSortControl.ariaDescending')}
        title={direction === 'asc' ? t('policeSortControl.titleAscending') : t('policeSortControl.titleDescending')}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          className={`police-sort-arrow${direction === 'desc' ? ' is-desc' : ''}`}
          aria-hidden="true"
        >
          <path d="M12 5v14M6 11l6-6 6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  )
}
