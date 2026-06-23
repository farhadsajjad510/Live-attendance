// Live Attendance — Service Worker
// Strategy:
//   - App shell (HTML, JS, CSS chunks): Cache-first with network fallback
//   - Firebase / API calls: Network-only (never cache auth or Firestore)
//   - Offline: serve cached shell; show offline splash if shell not cached yet
//
// This SW does NOT cache any Firebase Auth or Firestore traffic.
// All attendance/QR/auth logic remains 100% network-dependent.

const CACHE_NAME = 'la-shell-v1';

// Resources that make up the app shell (pre-cached on install)
const SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// Never cache these domains — Firebase Auth, Firestore, Functions
const NETWORK_ONLY_ORIGINS = [
  'firebaseapp.com',
  'googleapis.com',
  'firebaseio.com',
  'firebase.com',
  'gstatic.com',
  'fonts.googleapis.com',
];

// ── Install: pre-cache the app shell ─────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // addAll fails silently per-URL — use individual adds so one failure
      // doesn't block the whole install
      return Promise.allSettled(
        SHELL_URLS.map(url => cache.add(url).catch(() => {}))
      );
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: delete old caches ───────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: strategy routing ───────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Only handle GET requests
  if (request.method !== 'GET') return;

  // 2. Network-only for Firebase / external APIs
  if (NETWORK_ONLY_ORIGINS.some(origin => url.hostname.includes(origin))) {
    return; // let browser handle normally
  }

  // 3. Network-only for Vite HMR / dev server websockets
  if (url.pathname.startsWith('/@') || url.pathname.startsWith('/node_modules')) {
    return;
  }

  // 4. For navigation requests (HTML pages): network-first, fall back to cached /index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache the fresh HTML
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          // Offline: return cached index.html (app shell loads, Firebase offline mode handles data)
          caches.match('/index.html').then(cached => cached || offlineSplash())
        )
    );
    return;
  }

  // 5. For static assets (JS, CSS, PNG, SVG, fonts): cache-first
  if (
    url.pathname.match(/\.(js|css|png|svg|ico|woff2?|ttf|webp|jpg|jpeg)$/)
  ) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        }).catch(() => cached || new Response('', { status: 503 }));
      })
    );
    return;
  }

  // 6. Everything else: network-first
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// ── Offline splash (if even index.html is not cached) ────────────────────────
function offlineSplash() {
  return new Response(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="theme-color" content="#030711"/>
  <title>Live Attendance — Offline</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{
      background:#030711;color:#f0f4ff;
      font-family:'DM Sans',system-ui,sans-serif;
      min-height:100vh;display:flex;flex-direction:column;
      align-items:center;justify-content:center;gap:16px;
      text-align:center;padding:24px;
    }
    .logo{
      width:64px;height:64px;background:#2563eb;border-radius:16px;
      display:flex;align-items:center;justify-content:center;
      font-size:22px;font-weight:800;color:#fff;
      box-shadow:0 8px 24px rgba(37,99,235,.4);
      font-family:system-ui,sans-serif;
      margin-bottom:8px;
    }
    h1{font-size:22px;font-weight:700}
    p{font-size:14px;color:rgba(255,255,255,.4);line-height:1.6;max-width:280px}
    button{
      margin-top:16px;padding:12px 28px;
      background:#2563eb;color:#fff;border:none;border-radius:12px;
      font-size:15px;font-weight:600;cursor:pointer;
    }
  </style>
</head>
<body>
  <div class="logo">LA</div>
  <h1>You're Offline</h1>
  <p>Live Attendance needs a connection to load. Please check your internet and try again.</p>
  <button onclick="location.reload()">Retry</button>
</body>
</html>`, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
