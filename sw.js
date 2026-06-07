// =============================================
// AROVON AI — Service Worker
// Version: 1.0.0
// =============================================

const CACHE_NAME = 'arovon-v1';
const STATIC_CACHE = 'arovon-static-v1';
const DYNAMIC_CACHE = 'arovon-dynamic-v1';

// Files to cache on install
const STATIC_FILES = [
  '/',
  '/index.html',
  '/login.html',
  '/chat.html',
  '/manifest.json',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Yatra+One&family=DM+Sans:wght@300;400;500;600&display=swap'
];

// Files never to cache (always fetch fresh)
const NEVER_CACHE = [
  'firestore.googleapis.com',
  'firebase',
  'googleapis.com',
  'gstatic.com/firebasejs',
  'cloudinary.com'
];

// =============================================
// INSTALL — Cache static files
// =============================================
self.addEventListener('install', (event) => {
  console.log('[Arovon SW] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[Arovon SW] Caching static files');
      return cache.addAll(STATIC_FILES.map(url => {
        return new Request(url, { mode: 'no-cors' });
      })).catch(err => {
        console.log('[Arovon SW] Some files failed to cache:', err);
      });
    })
  );
  self.skipWaiting();
});

// =============================================
// ACTIVATE — Clean old caches
// =============================================
self.addEventListener('activate', (event) => {
  console.log('[Arovon SW] Activating...');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter(key => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map(key => {
            console.log('[Arovon SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      );
    })
  );
  self.clients.claim();
});

// =============================================
// FETCH — Smart caching strategy
// =============================================
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip Firebase / Cloudinary — always live
  if (NEVER_CACHE.some(pattern => url.includes(pattern))) {
    event.respondWith(fetch(event.request).catch(() => offlineFallback(event.request)));
    return;
  }

  // Skip chrome-extension
  if (url.startsWith('chrome-extension')) return;

  // Strategy: Cache First for static, Network First for pages
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(event.request));
  } else {
    event.respondWith(networkFirst(event.request));
  }
});

// =============================================
// STRATEGIES
// =============================================

// Cache First — for fonts, images, icons
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return offlineFallback(request);
  }
}

// Network First — for HTML pages
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return offlineFallback(request);
  }
}

// Offline fallback page
async function offlineFallback(request) {
  const url = request.url;
  if (url.includes('.html') || url.endsWith('/')) {
    const cached = await caches.match('/index.html');
    if (cached) return cached;
  }
  // Return minimal offline response
  return new Response(
    `<!DOCTYPE html>
    <html lang="hi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Arovon — Offline</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box;}
        body{
          font-family:'DM Sans',sans-serif;
          background:#FFFDF7;
          display:flex;align-items:center;justify-content:center;
          min-height:100vh;text-align:center;padding:24px;
        }
        .card{
          background:white;border-radius:24px;
          padding:48px 40px;
          box-shadow:0 8px 32px rgba(0,0,0,0.06);
          max-width:400px;width:100%;
        }
        .icon{
          width:64px;height:64px;border-radius:20px;
          background:linear-gradient(135deg,#FF6B00,#FFB300);
          display:flex;align-items:center;justify-content:center;
          margin:0 auto 24px;font-size:1.8rem;
        }
        h1{font-size:1.6rem;color:#1A1A2E;margin-bottom:10px;font-weight:700;}
        p{color:#888;line-height:1.7;font-size:0.9rem;margin-bottom:24px;}
        button{
          padding:13px 32px;background:#FF6B00;color:white;
          border:none;border-radius:12px;font-size:0.9rem;font-weight:600;
          cursor:pointer;transition:all 0.2s;
        }
        button:hover{background:#e55a00;}
        .bar{height:3px;background:linear-gradient(90deg,#FF9933 33%,white 33%,white 66%,#138808 66%);
          position:fixed;top:0;left:0;right:0;}
      </style>
    </head>
    <body>
      <div class="bar"></div>
      <div class="card">
        <div class="icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
            <line x1="1" y1="1" x2="23" y2="23"/>
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
            <path d="M10.71 5.05A16 16 0 0 1 22.56 9"/>
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
            <line x1="12" y1="20" x2="12.01" y2="20"/>
          </svg>
        </div>
        <h1>No Internet</h1>
        <p>Arovon ke liye internet connection chahiye. Connectivity check karo aur dobara try karo.</p>
        <button onclick="window.location.reload()">Dobara Try Karo</button>
      </div>
    </body>
    </html>`,
    { headers: { 'Content-Type': 'text/html' } }
  );
}

// Helper — is this a static asset?
function isStaticAsset(url) {
  return (
    url.includes('/assets/') ||
    url.includes('fonts.googleapis.com') ||
    url.includes('fonts.gstatic.com') ||
    url.includes('cdn.tailwindcss.com') ||
    url.endsWith('.png') ||
    url.endsWith('.jpg') ||
    url.endsWith('.svg') ||
    url.endsWith('.ico') ||
    url.endsWith('.woff2') ||
    url.endsWith('.woff') ||
    url.endsWith('.css')
  );
}

// =============================================
// PUSH NOTIFICATIONS (future use)
// =============================================
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Arovon AI';
  const options = {
    body: data.body || 'Naya message aaya hai',
    icon: '/assets/icons/icon-192.png',
    badge: '/assets/icons/icon-72.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/chat.html' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/chat.html')
  );
});

console.log('[Arovon SW] Service Worker loaded successfully');
