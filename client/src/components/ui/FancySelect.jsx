import React, { useEffect, useRef, useState } from 'react'
import './FancySelect.css'

/**
 * FancySelect — a single-select dropdown that LOOKS native but renders its
 * open menu in JSX so we can style it. Same input contract as a controlled
 * <select>: `value` + `onChange(newValue)`.
 *
 * Props:
 *   - value      : currently selected value
 *   - onChange   : (newValue) => void
 *   - options    : Array<{ value, label }>
 *   - label      : optional uppercase prefix shown inside the trigger
 *   - icon       : optional JSX (small SVG) shown next to the label
 *   - placeholder: shown when value doesn't match any option (rare)
 *   - menuAlign  : "right" (default) | "left" — which edge to anchor the popup
 *   - size       : "md" (default) | "sm" — sm = 28px tall instead of 32px
 *
 * Keyboard a11y:
 *   - ↑ / ↓ moves focus, Enter / Space picks, Esc closes.
 *   - Click outside closes.
 */
export default function FancySelect({
  value,
  onChange,
  options = [],
  label,
  icon = null,
  placeholder = 'Select…',
  menuAlign = 'right',
  size = 'md',
  className = '',
  disabled = false,
}) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(0, options.findIndex((o) => o.value === value)),
  )
  const rootRef = useRef(null)

  const current = options.find((o) => o.value === value)
  const currentLabel = current?.label ?? placeholder

  useEffect(() => {
    if (!open) return undefined
    function onDocClick(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    function onKey(event) {
      if (event.key === 'Escape') {
        setOpen(false)
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIndex((i) => Math.min(options.length - 1, i + 1))
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex((i) => Math.max(0, i - 1))
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        const next = options[activeIndex]
        if (next) {
          onChange(next.value)
          setOpen(false)
        }
      }
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, activeIndex, options, onChange])

  useEffect(() => {
    if (open) setActiveIndex(Math.max(0, options.findIndex((o) => o.value === value)))
  }, [open, value, options])

  const sizeClass = size === 'sm' ? ' admin-fancy-select--sm' : ''
  const alignClass = menuAlign === 'left' ? ' admin-fancy-select--align-left' : ''
  const rootClass = `admin-fancy-select${sizeClass}${alignClass}${className ? ` ${className}` : ''}`

  return (
    <div className={rootClass} ref={rootRef} aria-disabled={disabled || undefined}>
      {(label || icon) ? (
        <span className="admin-fancy-select-label" aria-hidden="true">
          {icon}
          {label}
        </span>
      ) : null}
      <button
        type="button"
        className="admin-fancy-select-control"
        onClick={() => !disabled && setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label ? `${label}: ${currentLabel}` : currentLabel}
        disabled={disabled}
      >
        <span className="admin-fancy-select-current">{currentLabel}</span>
      </button>
      <span
        className={`admin-fancy-select-chevron${open ? ' is-open' : ''}`}
        aria-hidden="true"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {open ? (
        <div
          className="admin-fancy-select-menu"
          role="listbox"
          aria-label={label || 'Options'}
        >
          {options.map((option, index) => {
            const isActive = option.value === value
            const isFocus = index === activeIndex
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isActive}
                className={[
                  'admin-fancy-select-option',
                  isActive ? 'is-active' : '',
                  isFocus ? 'is-focus' : '',
                ].filter(Boolean).join(' ')}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
              >
                <span className="admin-fancy-select-option-label">{option.label}</span>
                {isActive ? (
                  <svg
                    className="admin-fancy-select-option-check"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path
                      d="M5 12l5 5L20 7"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
