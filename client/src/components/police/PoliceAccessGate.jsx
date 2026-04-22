import React from 'react'
import { Navigate, Outlet, useLocation, useOutletContext } from 'react-router-dom'

import { getPoliceMe } from '../../services/policeService'

export function usePoliceAccess() {
  const context = useOutletContext()
  if (!context) {
    throw new Error('usePoliceAccess must be used inside PoliceAccessGate')
  }

  return context
}

export default function PoliceAccessGate() {
  const location = useLocation()
  const [state, setState] = React.useState({
    loading: true,
    error: '',
    policeMe: null,
  })

  const refreshPoliceMe = React.useCallback(async () => {
    setState((previous) => ({
      ...previous,
      loading: true,
      error: '',
    }))

    try {
      const policeMe = await getPoliceMe()
      setState({
        loading: false,
        error: '',
        policeMe,
      })

      return policeMe
    } catch (error) {
      setState({
        loading: false,
        error: error.message || 'Failed to load police access',
        policeMe: null,
      })

      throw error
    }
  }, [])

  React.useEffect(() => {
    refreshPoliceMe().catch(() => {})
  }, [refreshPoliceMe])

  if (state.loading) {
    return null
  }

  if (state.error || !state.policeMe) {
    return <Navigate to="/dashboard" replace />
  }

  const isSetupRoute = location.pathname === '/police/setup-zone'
  if (state.policeMe.requiresZoneSelection && !isSetupRoute) {
    return <Navigate to="/police/setup-zone" replace />
  }

  if (!state.policeMe.requiresZoneSelection && isSetupRoute) {
    return <Navigate to="/police" replace />
  }

  return (
    <Outlet
      context={{
        policeMe: state.policeMe,
        refreshPoliceMe,
      }}
    />
  )
}
