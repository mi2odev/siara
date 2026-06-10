import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './SiaraDatePicker.css'

/**
 * SiaraDatePicker — a fully custom date / datetime / time picker that renders
 * its own calendar popup in JSX (instead of the un-styleable native OS picker)
 * so it can match the SIARA look on every page (user / admin / police /
 * supervisor). Same controlled contract as the native inputs it replaces, but
 * onChange receives the value string directly (like FancySelect):
 *
 *   <SiaraDatePicker type="datetime-local" value={x} onChange={(v) => setX(v)} />
 *
 * Value formats (identical to the matching <input>):
 *   - type="date"            → "YYYY-MM-DD"
 *   - type="datetime-local"  → "YYYY-MM-DDTHH:mm"
 *   - type="time"            → "HH:mm"
 *
 * Props:
 *   - type        : "date" (default) | "datetime-local" | "time"
 *   - value       : controlled value string
 *   - onChange    : (value: string) => void
 *   - min / max   : optional bound strings (same format) — out-of-range days disabled
 *   - placeholder : trigger text when empty
 *   - disabled    : boolean
 *   - className    : extra class on the root
 *   - id          : forwarded to the trigger button (for <label htmlFor>)
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] // Monday-first

const pad = (n) => String(n).padStart(2, '0')
const range = (n) => Array.from({ length: n }, (_, i) => i)

function parseValue(value, type) {
  if (!value) return { date: null, hours: null, minutes: null }
  if (type === 'time') {
    const [h, m] = String(value).split(':')
    return { date: null, hours: Number(h) || 0, minutes: Number(m) || 0 }
  }
  const [datePart, timePart] = String(value).split('T')
  const [y, mo, d] = datePart.split('-').map(Number)
  let hours = null
  let minutes = null
  if (timePart) {
    const [h, m] = timePart.split(':')
    hours = Number(h) || 0
    minutes = Number(m) || 0
  }
  if (!y || !mo || !d) return { date: null, hours, minutes }
  return { date: new Date(y, mo - 1, d), hours, minutes }
}

function formatValue(date, hours, minutes, type) {
  if (type === 'time') return `${pad(hours)}:${pad(minutes)}`
  const datePart = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  if (type === 'datetime-local') return `${datePart}T${pad(hours)}:${pad(minutes)}`
  return datePart
}

/** Trigger label shown in the control. */
function displayLabel(value, type, placeholder) {
  const { date, hours, minutes } = parseValue(value, type)
  if (type === 'time') {
    if (hours == null) return placeholder
    return `${pad(hours)}:${pad(minutes)}`
  }
  if (!date) return placeholder
  const datePart = `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`
  if (type === 'datetime-local') {
    const h = hours == null ? 0 : hours
    const m = minutes == null ? 0 : minutes
    return `${datePart} · ${pad(h)}:${pad(m)}`
  }
  return datePart
}

/** Midnight Date from a bound string (date granularity). */
function boundDay(value) {
  if (!value) return null
  const datePart = String(value).split('T')[0]
  const [y, mo, d] = datePart.split('-').map(Number)
  if (!y || !mo || !d) return null
  return new Date(y, mo - 1, d)
}

const CalendarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3" y="4.5" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
    <path d="M3 9h18M8 2.5v4M16 2.5v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
)
const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
    <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const Chevron = ({ dir }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d={dir === 'left' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

export default function SiaraDatePicker({
  type = 'date',
  value = '',
  onChange,
  min,
  max,
  placeholder,
  disabled = false,
  className = '',
  id,
}) {
  const isTime = type === 'time'
  const hasTime = type === 'datetime-local' || type === 'time'
  const hasDate = type === 'date' || type === 'datetime-local'

  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState(null)
  const rootRef = useRef(null)
  const popRef = useRef(null)

  const parsed = useMemo(() => parseValue(value, type), [value, type])

  // Visible month in the grid.
  const [view, setView] = useState(() => {
    const base = parsed.date || new Date()
    return { year: base.getFullYear(), month: base.getMonth() }
  })
  // Working time-of-day (so a datetime can be timed before a day is picked).
  const [time, setTime] = useState(() => {
    const now = new Date()
    return {
      h: parsed.hours == null ? (isTime ? now.getHours() : 9) : parsed.hours,
      m: parsed.minutes == null ? 0 : parsed.minutes,
    }
  })

  // Re-sync internal state when the picker (re)opens.
  useEffect(() => {
    if (!open) return
    const base = parsed.date || new Date()
    setView({ year: base.getFullYear(), month: base.getMonth() })
    const now = new Date()
    setTime({
      h: parsed.hours == null ? (isTime ? now.getHours() : 9) : parsed.hours,
      m: parsed.minutes == null ? 0 : parsed.minutes,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Close on outside click / Escape. Popover lives in a portal, so check both.
  useEffect(() => {
    if (!open) return undefined
    function onDocClick(e) {
      if (rootRef.current?.contains(e.target)) return
      if (popRef.current?.contains(e.target)) return
      setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Position the portalled popover next to the trigger, clamped to the viewport.
  useLayoutEffect(() => {
    if (!open) return undefined
    function place() {
      const trigger = rootRef.current?.querySelector('.siara-dp-trigger')
      if (!trigger) return
      const rect = trigger.getBoundingClientRect()
      const popH = popRef.current?.offsetHeight || 360
      const popW = popRef.current?.offsetWidth || 300
      const margin = 8
      const flip = rect.bottom + popH + margin > window.innerHeight && rect.top > popH + margin
      const top = flip ? rect.top - popH - margin : rect.bottom + margin
      let left = rect.left
      left = Math.min(left, window.innerWidth - popW - margin)
      left = Math.max(margin, left)
      setCoords({ top, left, width: Math.max(rect.width, popW), flip })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, view, type])

  // Scroll the selected hour/minute into view when opening.
  useEffect(() => {
    if (!open || !hasTime) return
    requestAnimationFrame(() => {
      popRef.current?.querySelectorAll('.siara-dp-time-item.is-selected').forEach((el) => {
        el.scrollIntoView({ block: 'center' })
      })
    })
  }, [open, hasTime])

  const minDay = useMemo(() => boundDay(min), [min])
  const maxDay = useMemo(() => boundDay(max), [max])

  function isDisabledDay(d) {
    if (minDay && d < minDay) return true
    if (maxDay && d > maxDay) return true
    return false
  }

  function commit(date, h, m, close) {
    if (!onChange) return
    if (isTime) {
      onChange(formatValue(null, h, m, type))
    } else {
      if (!date) return
      onChange(formatValue(date, h, m, type))
    }
    if (close) setOpen(false)
  }

  function selectDay(day) {
    const d = new Date(view.year, view.month, day)
    if (isDisabledDay(d)) return
    commit(d, time.h, time.m, type === 'date')
  }

  function selectTime(part, val) {
    const next = { ...time, [part]: val }
    setTime(next)
    if (isTime) {
      commit(null, next.h, next.m, false)
    } else if (parsed.date) {
      commit(parsed.date, next.h, next.m, false)
    }
  }

  function goMonth(delta) {
    setView((v) => {
      const m = v.month + delta
      const year = v.year + Math.floor(m / 12)
      const month = ((m % 12) + 12) % 12
      return { year, month }
    })
  }
  function goYear(delta) {
    setView((v) => ({ ...v, year: v.year + delta }))
  }

  function setToday() {
    const now = new Date()
    if (isTime) {
      const t = { h: now.getHours(), m: now.getMinutes() }
      setTime(t)
      commit(null, t.h, t.m, true)
      return
    }
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    if (isDisabledDay(d)) return
    setView({ year: now.getFullYear(), month: now.getMonth() })
    const h = type === 'datetime-local' ? now.getHours() : 0
    const m = type === 'datetime-local' ? now.getMinutes() : 0
    setTime({ h, m })
    commit(d, h, m, type === 'date')
  }

  function clear() {
    if (onChange) onChange('')
    setOpen(false)
  }

  // Build the month grid (Monday-first).
  const cells = useMemo(() => {
    const first = new Date(view.year, view.month, 1)
    const startOffset = (first.getDay() + 6) % 7 // Monday = 0
    const daysInMonth = new Date(view.year, view.month + 1, 0).getDate()
    const out = []
    for (let i = 0; i < startOffset; i += 1) out.push(null)
    for (let d = 1; d <= daysInMonth; d += 1) out.push(d)
    return out
  }, [view])

  const today = new Date()
  const isToday = (day) =>
    day &&
    today.getFullYear() === view.year &&
    today.getMonth() === view.month &&
    today.getDate() === day
  const isSelected = (day) =>
    day &&
    parsed.date &&
    parsed.date.getFullYear() === view.year &&
    parsed.date.getMonth() === view.month &&
    parsed.date.getDate() === day

  const rootClass = [
    'siara-dp',
    open ? 'is-open' : '',
    disabled ? 'is-disabled' : '',
    className,
  ].filter(Boolean).join(' ')

  const label = displayLabel(value, type, placeholder || (isTime ? 'Select time' : 'Select date'))
  const isEmpty = isTime ? parsed.hours == null : !parsed.date

  return (
    <div className={rootClass} ref={rootRef}>
      <button
        id={id}
        type="button"
        className="siara-dp-trigger"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="siara-dp-trigger-icon">{isTime ? <ClockIcon /> : <CalendarIcon />}</span>
        <span className={`siara-dp-trigger-text${isEmpty ? ' is-placeholder' : ''}`}>{label}</span>
      </button>

      {open ? createPortal(
        <div
          ref={popRef}
          className={`siara-dp-popover${coords?.flip ? ' is-flipped' : ''}`}
          role="dialog"
          aria-label={isTime ? 'Choose time' : 'Choose date'}
          style={{
            top: coords ? `${coords.top}px` : '-9999px',
            left: coords ? `${coords.left}px` : '-9999px',
            visibility: coords ? 'visible' : 'hidden',
          }}
        >
          {hasDate ? (
            <div className="siara-dp-cal">
              <div className="siara-dp-head">
                <div className="siara-dp-nav">
                  <button type="button" className="siara-dp-nav-btn" onClick={() => goYear(-1)} aria-label="Previous year">«</button>
                  <button type="button" className="siara-dp-nav-btn" onClick={() => goMonth(-1)} aria-label="Previous month"><Chevron dir="left" /></button>
                </div>
                <div className="siara-dp-title">
                  {MONTHS[view.month]} <span>{view.year}</span>
                </div>
                <div className="siara-dp-nav">
                  <button type="button" className="siara-dp-nav-btn" onClick={() => goMonth(1)} aria-label="Next month"><Chevron dir="right" /></button>
                  <button type="button" className="siara-dp-nav-btn" onClick={() => goYear(1)} aria-label="Next year">»</button>
                </div>
              </div>

              <div className="siara-dp-weekdays">
                {WEEKDAYS.map((w) => (
                  <span key={w} className="siara-dp-weekday">{w}</span>
                ))}
              </div>

              <div className="siara-dp-grid">
                {cells.map((day, i) => {
                  if (day == null) return <span key={`e${i}`} className="siara-dp-cell is-empty" />
                  const d = new Date(view.year, view.month, day)
                  const off = isDisabledDay(d)
                  const cls = [
                    'siara-dp-cell',
                    isSelected(day) ? 'is-selected' : '',
                    isToday(day) ? 'is-today' : '',
                    off ? 'is-disabled' : '',
                  ].filter(Boolean).join(' ')
                  return (
                    <button
                      key={day}
                      type="button"
                      className={cls}
                      onClick={() => selectDay(day)}
                      disabled={off}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          {hasTime ? (
            <div className={`siara-dp-time${hasDate ? ' has-divider' : ''}`}>
              <div className="siara-dp-time-label">
                <ClockIcon />
                <span>{pad(time.h)}:{pad(time.m)}</span>
              </div>
              <div className="siara-dp-time-cols">
                <div className="siara-dp-time-col" role="listbox" aria-label="Hour">
                  {range(24).map((h) => (
                    <button
                      key={h}
                      type="button"
                      className={`siara-dp-time-item${time.h === h ? ' is-selected' : ''}`}
                      onClick={() => selectTime('h', h)}
                    >
                      {pad(h)}
                    </button>
                  ))}
                </div>
                <span className="siara-dp-time-sep">:</span>
                <div className="siara-dp-time-col" role="listbox" aria-label="Minute">
                  {range(60).map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`siara-dp-time-item${time.m === m ? ' is-selected' : ''}`}
                      onClick={() => selectTime('m', m)}
                    >
                      {pad(m)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <div className="siara-dp-footer">
            <button type="button" className="siara-dp-foot-btn" onClick={clear}>Clear</button>
            <button type="button" className="siara-dp-foot-btn" onClick={setToday}>
              {isTime ? 'Now' : 'Today'}
            </button>
            {!isTime && type === 'datetime-local' ? (
              <button type="button" className="siara-dp-foot-btn is-primary" onClick={() => setOpen(false)}>
                Done
              </button>
            ) : null}
            {isTime ? (
              <button type="button" className="siara-dp-foot-btn is-primary" onClick={() => setOpen(false)}>
                Done
              </button>
            ) : null}
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  )
}
