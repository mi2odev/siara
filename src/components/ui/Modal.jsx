import React from 'react'

export default function Modal({ children, open = false, onClose }) {
  if (!open) return null
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center">
      <div onClick={onClose} style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.5)'}} />
      <div style={{position:'relative',zIndex:10}} className="bg-white p-4 rounded-md">
        {children}
      </div>
    </div>
  )
}
