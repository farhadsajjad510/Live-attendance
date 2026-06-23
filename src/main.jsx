import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// ─── Global Error Boundary ────────────────────────────────────────────────────
// Catches any unhandled React render errors and shows a friendly screen
// instead of a blank page. Critical for production stability.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log to console in dev only (console is stripped in production build)
    if (import.meta.env.DEV) {
      console.error('App Error:', error, info);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          background: '#030711',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: 'system-ui, sans-serif',
          color: '#f0f4ff',
          textAlign: 'center',
        }}>
          <div style={{
            width: 64, height: 64,
            background: 'rgba(239,68,68,0.15)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 20, fontSize: 28,
          }}>⚠️</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            Something went wrong
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 24, maxWidth: 320 }}>
            The app encountered an unexpected error. Please refresh the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '10px 24px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Refresh Page
          </button>
          <p style={{ color: 'rgba(255,255,255,0.15)', fontSize: 11, marginTop: 32 }}>
            Powered by FarhadAIStudio
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}


// ── PWA: Service Worker Registration ─────────────────────────────────────────
// Registers sw.js which handles offline splash + static asset caching.
// Firebase Auth / Firestore are intentionally excluded from SW cache.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .catch(() => {}); // fail silently — app works without SW
  });
}

// ── PWA: Capture install prompt for deferred install button ──────────────────
// Store the event so we can show a native install button inside the app.
// Components read window.__pwaInstallPrompt to trigger installation.
window.__pwaInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // prevent the mini-infobar on Android Chrome
  window.__pwaInstallPrompt = e;
  // Dispatch a custom event so React components can react
  window.dispatchEvent(new CustomEvent('pwaInstallReady'));
});
window.addEventListener('appinstalled', () => {
  window.__pwaInstallPrompt = null;
  window.dispatchEvent(new CustomEvent('pwaInstalled'));
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
