import React, { createContext, useState, useEffect } from 'react'
import { login as mockLogin } from '../services/authService'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('siara_user') || sessionStorage.getItem('siara_user')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    // keep storage in sync when user changes
    if (user && user._persist === 'local') {
      localStorage.setItem('siara_user', JSON.stringify(user))
      sessionStorage.removeItem('siara_user')
    } else if (user && user._persist === 'session') {
      sessionStorage.setItem('siara_user', JSON.stringify(user))
      localStorage.removeItem('siara_user')
    } else {
      localStorage.removeItem('siara_user')
      sessionStorage.removeItem('siara_user')
    }
  }, [user])

  async function login(identifier, password, remember) {
    const res = await mockLogin(identifier, password)
    if (res && res.user) {
      const storedUser = { ...res.user, token: res.token, _persist: remember ? 'local' : 'session' }
      setUser(storedUser)
      return storedUser
    }
    throw new Error('Authentication failed')
  }

  function logout() {
    setUser(null)
    localStorage.removeItem('siara_user')
    sessionStorage.removeItem('siara_user')
  }

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
