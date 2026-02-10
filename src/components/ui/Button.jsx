import React from 'react'

export default function Button({ children, variant = 'primary', className = '', ...props }) {
  const base = 'px-4 py-2 rounded-md font-semibold inline-flex items-center justify-center'
  const styles = {
    primary: `bg-siara-primary text-white ${base}`,
    ghost: `bg-transparent border border-white/8 text-siara-accent ${base}`,
  }
  return (
    <button className={`${styles[variant] || base} ${className}`} {...props}>
      {children}
    </button>
  )
}
