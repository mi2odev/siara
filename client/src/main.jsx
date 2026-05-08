import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/global.css'
import './styles/iconSystem.css'
import './styles/responsive.css'
import './i18n'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext'
import { DirectionProvider } from './i18n/DirectionProvider'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DirectionProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </DirectionProvider>
  </StrictMode>,
)
