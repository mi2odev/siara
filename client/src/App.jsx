import React, { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'

import { NotificationProvider } from './contexts/NotificationContext'
import AppRouter from './routes/AppRouter'
import { registerPushServiceWorker } from './services/pushService'
import './App.css'

export default function App() {
  useEffect(() => {
    registerPushServiceWorker().catch((error) => {
      console.warn('[push] service_worker_registration_failed', error)
    })
  }, [])

  return (
    <BrowserRouter>
      <NotificationProvider>
        <AppRouter />
      </NotificationProvider>
    </BrowserRouter>
  )
}
