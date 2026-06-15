import React from 'react'
import FancySelect from './FancySelect'
import './TimeField.css'

/**
 * TimeField — a styled "HH:MM" time picker that replaces the native
 * <input type="time"> with two FancySelect dropdowns (hours + minutes) so it
 * matches the SIARA design system instead of the browser's native picker.
 *
 * Props:
 *   - value    : "HH:MM" string (defaults to "00:00" when empty/invalid)
 *   - onChange : (next "HH:MM" string) => void
 *   - minuteStep : spacing between minute options (default 5)
 */
function pad(value) {
  return String(value).padStart(2, '0')
}

function parseValue(value) {
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(String(value || '').trim())
  if (!match) return { hour: 0, minute: 0 }

  const hour = Math.min(23, Math.max(0, Number(match[1])))
  const minute = Math.min(59, Math.max(0, Number(match[2])))
  return { hour, minute }
}

export default function TimeField({ value, onChange, minuteStep = 5 }) {
  const { hour, minute } = parseValue(value)

  const hourOptions = Array.from({ length: 24 }, (_, index) => ({
    value: pad(index),
    label: pad(index),
  }))

  const minuteValues = new Set()
  for (let m = 0; m < 60; m += minuteStep) minuteValues.add(m)
  minuteValues.add(minute) // keep the current value selectable (e.g. legacy 23:59)
  const minuteOptions = Array.from(minuteValues)
    .sort((a, b) => a - b)
    .map((m) => ({ value: pad(m), label: pad(m) }))

  function emit(nextHour, nextMinute) {
    onChange(`${pad(nextHour)}:${pad(nextMinute)}`)
  }

  return (
    <div className="time-field">
      <FancySelect
        className="time-field-select"
        value={pad(hour)}
        onChange={(next) => emit(Number(next), minute)}
        menuAlign="left"
        options={hourOptions}
      />
      <span className="time-field-colon" aria-hidden="true">:</span>
      <FancySelect
        className="time-field-select"
        value={pad(minute)}
        onChange={(next) => emit(hour, Number(next))}
        menuAlign="left"
        options={minuteOptions}
      />
    </div>
  )
}
