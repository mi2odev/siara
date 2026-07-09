import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/global.css'
import './styles/iconSystem.css'
import './styles/responsive.css'
import { i18nReady } from './i18n'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext'
import { DirectionProvider } from './i18n/DirectionProvider'

function renderApp() {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <DirectionProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </DirectionProvider>
    </StrictMode>,
  )
}

// Wait for the active language's translations (instant for English, a quick
// chunk fetch for French/Arabic) so the first paint is already localized — but
// never block longer than 1.5s if that fetch is slow, so the app always shows.
Promise.race([
  i18nReady,
  new Promise((resolve) => setTimeout(resolve, 1500)),
]).finally(renderApp)
