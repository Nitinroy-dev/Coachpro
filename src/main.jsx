import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// VitePWA (injectManifest mode) handles service worker registration via
// the auto-generated registerSW.js. We do NOT manually register here to
// avoid double-registration conflicts.
//
// The compiled service worker (src/sw.js → dist/sw.js) handles:
//   - Workbox precaching & runtime caching
//   - Native OS push notifications (via postMessage → SHOW_NOTIFICATION)
//   - Notification click → navigate to /notifications
//
// When a new SW version is detected, the page auto-reloads via the
// 'controllerchange' event below.

if ('serviceWorker' in navigator) {
  // Auto-reload page when new service worker takes control
  let refreshing = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true
      window.location.reload()
    }
  })
}

// Show a top banner when VitePWA detects a new version (called from registerSW.js)
window.__showUpdateBanner = function showUpdateBanner() {
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
