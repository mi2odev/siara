import React, { useEffect, useMemo, useRef, useState } from 'react'
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded'
import { useTranslation } from 'react-i18next'
import TimeField from './TimeField'
import './DateTimePicker.css'

/**
 * DateTimePicker — a styled "YYYY-MM-DDTHH:MM" date + time picker that replaces
 * the browser's native <input type="datetime-local"> with a custom calendar
 * popover (plus the SIARA TimeField) so it matches the app's design.
 *
 * Props:
 *   - value    : "YYYY-MM-DDTHH:MM" local string ('' = nothing chosen yet)
 *   - max      : optional same-format upper bound (future dates are disabled)
 *   - onChange : (next "YYYY-MM-DDTHH:MM" string) => void
 */

function pad(value) {
  return String(value).padStart(2, '0')
}

function toValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function parseValue(value) {
  const date = value ? new Date(value) : new Date()
  return Number.isNaN(date.getTime()) ? new Date() : date
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** Build the 6-row (Mon-first) grid of days surrounding `viewDate`'s month. */
function buildCalendar(viewDate) {
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const offset = (firstOfMonth.getDay() + 6) % 7 // 0 = Monday
  const gridStart = new Date(year, month, 1 - offset)

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index)
    return { day, inMonth: day.getMonth() === month }
  })
}

export default function DateTimePicker({ value, max, onChange }) {
  const { t } = useTranslation(['pages', 'common'])
  const [open, setOpen] = useState(false)
  const selected = useMemo(() => parseValue(value), [value])
  const [viewDate, setViewDate] = useState(() => startOfDay(selected))
  const rootRef = useRef(null)

  const maxDate = max ? parseValue(max) : null

  const WEEKDAYS = [
    t('dateTimePicker.weekdays.mo'),
    t('dateTimePicker.weekdays.tu'),
    t('dateTimePicker.weekdays.we'),
    t('dateTimePicker.weekdays.th'),
    t('dateTimePicker.weekdays.fr'),
    t('dateTimePicker.weekdays.sa'),
    t('dateTimePicker.weekdays.su'),
  ]

  const MONTHS = [
    t('dateTimePicker.months.january'),
    t('dateTimePicker.months.february'),
    t('dateTimePicker.months.march'),
    t('dateTimePicker.months.april'),
    t('dateTimePicker.months.may'),
    t('dateTimePicker.months.june'),
    t('dateTimePicker.months.july'),
    t('dateTimePicker.months.august'),
    t('dateTimePicker.months.september'),
    t('dateTimePicker.months.october'),
    t('dateTimePicker.months.november'),
    t('dateTimePicker.months.december'),
  ]

  useEffect(() => {
    if (open) setViewDate(startOfDay(parseValue(value)))
  }, [open, value])

  useEffect(() => {
    if (!open) return undefined
    function onDocClick(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    function onKey(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const cells = useMemo(() => buildCalendar(viewDate), [viewDate])

  function isFuture(day) {
    return maxDate ? startOfDay(day) > startOfDay(maxDate) : false
  }

  function pickDay(day) {
    const next = new Date(
      day.getFullYear(), day.getMonth(), day.getDate(),
      selected.getHours(), selected.getMinutes(),
    )
    if (maxDate && next > maxDate) {
      onChange(toValue(maxDate))
      return
    }
    onChange(toValue(next))
  }

  function setTime(timeStr) {
    const [h, m] = String(timeStr).split(':').map(Number)
    const next = new Date(
      selected.getFullYear(), selected.getMonth(), selected.getDate(),
      h || 0, m || 0,
    )
    onChange(toValue(maxDate && next > maxDate ? maxDate : next))
  }

  function jumpMonth(delta) {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))
  }

  function goToday() {
    const now = new Date()
    setViewDate(startOfDay(now))
    onChange(toValue(maxDate && now > maxDate ? maxDate : now))
  }

  const triggerLabel = value
    ? selected.toLocaleString('en', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : t('dateTimePicker.selectDateTime')

  const today = startOfDay(new Date())

  return (
    <div className="dt-picker" ref={rootRef}>
      <button
        type="button"
        className={`dt-trigger ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <CalendarMonthRoundedIcon fontSize="inherit" className="dt-trigger-icon" />
        <span className="dt-trigger-label">{triggerLabel}</span>
      </button>

      {open && (
        <div className="dt-popover" role="dialog">
          <div className="dt-cal-header">
            <button type="button" className="dt-nav" onClick={() => jumpMonth(-1)} aria-label={t('dateTimePicker.prevMonth')}>
              <ChevronLeftRoundedIcon fontSize="inherit" />
            </button>
            <span className="dt-cal-title">
              {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
            </span>
            <button type="button" className="dt-nav" onClick={() => jumpMonth(1)} aria-label={t('dateTimePicker.nextMonth')}>
              <ChevronRightRoundedIcon fontSize="inherit" />
            </button>
          </div>

          <div className="dt-weekdays">
            {WEEKDAYS.map((wd) => (
              <span key={wd} className="dt-weekday">{wd}</span>
            ))}
          </div>

          <div className="dt-grid">
            {cells.map(({ day, inMonth }) => {
              const isSelected = startOfDay(day).getTime() === startOfDay(selected).getTime()
              const isToday = startOfDay(day).getTime() === today.getTime()
              const disabled = isFuture(day)
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  className={[
                    'dt-day',
                    inMonth ? '' : 'is-muted',
                    isSelected ? 'is-selected' : '',
                    isToday ? 'is-today' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => pickDay(day)}
                  disabled={disabled}
                >
                  {day.getDate()}
                </button>
              )
            })}
          </div>

          <div className="dt-time-row">
            <span className="dt-time-label">{t('dateTimePicker.timeLabel')}</span>
            <TimeField
              value={`${pad(selected.getHours())}:${pad(selected.getMinutes())}`}
              onChange={setTime}
            />
          </div>

          <div className="dt-footer">
            <button type="button" className="dt-footer-btn" onClick={goToday}>{t('dateTimePicker.now')}</button>
            <button type="button" className="dt-footer-btn dt-footer-btn--primary" onClick={() => setOpen(false)}>
              {t('dateTimePicker.done')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
