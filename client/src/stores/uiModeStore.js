import { create } from 'zustand'

// Tracks which "shell" the user is currently operating in so pages that are
// shared across modes (e.g. the notifications page) can keep the right chrome.
//   - 'normal'     -> the citizen / dashboard layout
//   - 'officer'    -> police officer mode (PoliceShell)
//   - 'supervisor' -> police supervisor mode (PoliceShell)
const STORAGE_KEY = 'siara:uiMode'
const VALID_MODES = new Set(['normal', 'officer', 'supervisor'])

function readInitialMode() {
  if (typeof window === 'undefined') {
    return 'normal'
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return VALID_MODES.has(stored) ? stored : 'normal'
  } catch {
    return 'normal'
  }
}

export const useUiModeStore = create((set) => ({
  mode: readInitialMode(),
  setMode: (mode) => {
    const next = VALID_MODES.has(mode) ? mode : 'normal'
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, next)
      }
    } catch {
      // localStorage may be unavailable (private mode) — keep in-memory state.
    }
    set({ mode: next })
  },
}))
