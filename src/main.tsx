import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Install the service worker so the app works offline / as an installed
// PWA on phones. Skipped in dev (Vite serves from memory) and in Electron
// (file:// has no SW support; the desktop build bundles assets locally
// anyway).
if (
  import.meta.env.PROD &&
  'serviceWorker' in navigator &&
  window.location.protocol.startsWith('http')
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Offline support is a progressive enhancement — never block the app.
    })
  })
}
