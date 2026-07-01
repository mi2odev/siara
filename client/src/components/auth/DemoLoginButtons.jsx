import React, { useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { AuthContext } from '../../contexts/AuthContext'
import { getDemoLoginOptions } from '../../services/authService'
import { getAuthenticatedRedirect } from '../../routes/routeAccess'
import './DemoLoginButtons.css'

// Fixed display order + icon per demo role. Only roles the backend advertises
// as available are rendered.
const DEMO_ROLES = [
  { key: 'citizen', icon: '👤' },
  { key: 'police', icon: '🚓' },
  { key: 'supervisor', icon: '🛡️' },
  { key: 'admin', icon: '⚙️' },
]

export default function DemoLoginButtons() {
  const { demoLogin } = useContext(AuthContext)
  const navigate = useNavigate()
  const { t } = useTranslation(['auth', 'common'])

  const [available, setAvailable] = useState([])
  const [pendingRole, setPendingRole] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getDemoLoginOptions()
      .then((options) => {
        if (cancelled) return
        setAvailable(options.enabled ? options.roles : [])
      })
      .catch(() => {
        if (!cancelled) setAvailable([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const roles = DEMO_ROLES.filter((role) => available.includes(role.key))
  if (roles.length === 0) {
    return null
  }

  async function handleDemo(roleKey) {
    setError('')
    setPendingRole(roleKey)
    try {
      const user = await demoLogin(roleKey)
      navigate(getAuthenticatedRedirect(user, Boolean(user?.email_verified ?? true)), { replace: true })
    } catch (demoError) {
      setError(demoError?.response?.data?.message || demoError?.message || t('demoLogin.error'))
    } finally {
      setPendingRole(null)
    }
  }

  return (
    <div className="siara-demo-block">
      <div className="siara-auth-divider">
        <span>{t('demoLogin.divider')}</span>
      </div>
      <p className="siara-demo-hint">{t('demoLogin.hint')}</p>
      {error ? <div className="error-box" role="alert">{error}</div> : null}
      <div className="siara-demo-grid">
        {roles.map((role) => (
          <button
            key={role.key}
            type="button"
            className="siara-demo-btn"
            onClick={() => handleDemo(role.key)}
            disabled={Boolean(pendingRole)}
          >
            <span className="siara-demo-icon" aria-hidden="true">{role.icon}</span>
            <span className="siara-demo-label">
              {pendingRole === role.key
                ? t('demoLogin.enteringRole')
                : t(`demoLogin.roles.${role.key}`)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
