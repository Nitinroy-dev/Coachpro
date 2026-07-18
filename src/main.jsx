import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
      
      console.log('SW registered:', reg.scope)
      
      // Check for updates every 60 minutes
      setInterval(() => {
        reg.update()
      }, 60 * 60 * 1000)

      // When new version available:
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // Show update notification to user
            showUpdateBanner()
          }
        })
      })
    } catch (err) {
      console.error('SW registration failed:', err)
    }
  })

  // Auto-reload page when new service worker takes control
  let refreshing = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true
      window.location.reload()
    }
  })
}

function showUpdateBanner() {
  const banner = document.createElement('div')
  banner.innerHTML = `
    <div style="
      position:fixed; top:0; left:0; right:0;
      background:#F97316; color:white;
      padding:12px; text-align:center;
      z-index:9999; font-family:sans-serif;
      font-size:14px; font-weight:500;
      box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
      🎉 New version available! 
      <button onclick="window.location.reload()" 
        style="background:white; color:#F97316;
        border:none; padding:6px 16px; 
        border-radius:8px; margin-left:12px;
        cursor:pointer; font-weight:bold;
        font-size:12px; transition:opacity 0.2s ease;">
        Update Now
      </button>
    </div>
  `
  document.body.prepend(banner)
}

// Proactively force portrait orientation lock on mobile/PWA instances
function lockScreenOrientation() {
  try {
    if (screen.orientation && typeof screen.orientation.lock === 'function') {
      screen.orientation.lock('portrait-primary').catch(() => {
        // Safe fallback if browser rejects orientation locking outside fullscreen
      })
    }
  } catch (e) {
    // Unsupported browser
  }
}

lockScreenOrientation()
window.addEventListener('resize', lockScreenOrientation)
window.addEventListener('orientationchange', lockScreenOrientation)
window.addEventListener('load', lockScreenOrientation)
