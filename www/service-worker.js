// service-worker.js — ZenScreen PWA Service Worker (Root-level)
// Full offline support, background sync, push notifications, and caching strategies

const CACHE_VERSION = 'zenscreen-v9';
const STATIC_CACHE = CACHE_VERSION + '-static';
const DYNAMIC_CACHE = CACHE_VERSION + '-dynamic';
const API_CACHE = CACHE_VERSION + '-api';

// App shell — files needed for offline functionality
const APP_SHELL = [
  '/',
  '/app.html',
  '/app.js',
  '/manifest.json',
  '/icon-512.png'
];

// External resources to cache
const EXTERNAL_RESOURCES = [
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display:ital@0;1&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// ============= INSTALL EVENT =============
self.addEventListener('install', (event) => {
  console.log('[SW] Installing v2...');

  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      console.log('[SW] Caching app shell');
      // Cache app shell files individually (tolerate missing files)
      for (const url of APP_SHELL) {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn('[SW] Could not cache:', url, err.message);
        }
      }
      // Cache external resources
      for (const url of EXTERNAL_RESOURCES) {
        try {
          const response = await fetch(url, { mode: 'cors' });
          if (response.ok) {
            await cache.put(url, response);
          }
        } catch (err) {
          console.warn('[SW] Could not cache external:', url);
        }
      }
    })
  );

  // Activate immediately — don't wait for old SW to stop
  self.skipWaiting();
});

// ============= ACTIVATE EVENT =============
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating v2...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          // Delete all caches that don't match current version
          if (!name.startsWith(CACHE_VERSION)) {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          }
        })
      );
    })
  );

  // Take control of all clients immediately
  self.clients.claim();
});

// ============= FETCH EVENT =============
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (POST, PUT, DELETE)
  if (request.method !== 'GET') return;

  // Strategy selection based on request type
  if (url.pathname.startsWith('/api/')) {
    // API requests: Network-first with cache fallback
    event.respondWith(networkFirstStrategy(request));
  } else if (
    url.origin === self.location.origin ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com' ||
    url.hostname === 'cdn.jsdelivr.net'
  ) {
    // Static assets: Cache-first with network fallback
    event.respondWith(cacheFirstStrategy(request));
  }
});

// Cache-first: check cache, fallback to network, update cache
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    // Return cached, but update in background (stale-while-revalidate)
    fetchAndUpdate(request).catch(() => {});
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    // If both cache and network fail, return offline page
    return caches.match('/app.html') || new Response(offlineHTML(), {
      headers: { 'Content-Type': 'text/html' },
      status: 503
    });
  }
}

// Network-first: try network, fallback to cache
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    // Return a JSON error for API requests
    return new Response(JSON.stringify({
      error: 'You are offline. This data will update when you reconnect.',
      offline: true
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 503
    });
  }
}

// Background update for stale-while-revalidate
async function fetchAndUpdate(request) {
  const networkResponse = await fetch(request);
  if (networkResponse.ok) {
    const cache = await caches.open(STATIC_CACHE);
    await cache.put(request, networkResponse);
  }
}

// Offline fallback HTML
function offlineHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ZenScreen — Offline</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0D0F14; color: #F0F2FF; font-family: 'DM Sans', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .offline-card { text-align: center; padding: 40px 24px; }
    .offline-icon { font-size: 64px; margin-bottom: 16px; }
    h1 { font-size: 24px; margin-bottom: 8px; color: #7B68FF; }
    p { color: #8B90B0; font-size: 14px; line-height: 1.5; margin-bottom: 24px; }
    button { background: #7B68FF; border: none; border-radius: 10px; padding: 14px 28px; color: #fff; font-size: 15px; font-weight: 600; cursor: pointer; }
  </style>
</head>
<body>
  <div class="offline-card">
    <div class="offline-icon">📡</div>
    <h1>You're Offline</h1>
    <p>ZenScreen needs an internet connection to sync your data. Your usage is still being tracked locally and will sync when you reconnect.</p>
    <button onclick="location.reload()">Try Again</button>
  </div>
</body>
</html>`;
}

// ============= BACKGROUND SYNC =============
self.addEventListener('sync', (event) => {
  console.log('[SW] Sync event:', event.tag);

  if (event.tag === 'sync-tracking') {
    event.waitUntil(syncTrackingData());
  }

  if (event.tag === 'sync-pending-data') {
    event.waitUntil(syncTrackingData());
  }
});

// ============= PERIODIC BACKGROUND SYNC =============
self.addEventListener('periodicsync', (event) => {
  console.log('[SW] Periodic sync:', event.tag);

  if (event.tag === 'zenscreen-usage-sync') {
    event.waitUntil(syncTrackingData());
  }
});

async function syncTrackingData() {
  try {
    console.log('[SW] Starting background sync...');

    const db = await openTrackingDB();
    const pendingData = await getPendingTrackingData(db);

    if (pendingData.length === 0) {
      console.log('[SW] No pending data');
      return;
    }

    if (!self.authToken) {
      console.log('[SW] No auth token, skipping background sync (app.js will handle it when open)');
      return;
    }

    const response = await fetch('/api/data/sync-tracking', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + self.authToken
      },
      body: JSON.stringify({ records: pendingData })
    });

    if (response.ok) {
      console.log('[SW] Sync successful, marking records');
      await markAsSynced(db, pendingData);

      // Notify user of successful sync
      await self.registration.showNotification('ZenScreen', {
        body: `${pendingData.length} usage records synced successfully`,
        icon: '/icon-512.png',
        badge: '/icon-512.png',
        tag: 'sync-success',
        silent: true
      });
    } else {
      throw new Error('Sync failed: ' + response.status);
    }
  } catch (err) {
    console.error('[SW] Sync error:', err);
    throw err; // Let the browser retry
  }
}

// ============= PUSH NOTIFICATIONS =============
self.addEventListener('push', (event) => {
  console.log('[SW] Push received');

  let data = { title: 'ZenScreen', body: 'Check your screen time' };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/icon-512.png',
    badge: '/icon-512.png',
    tag: data.tag || 'zenscreen-push',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/app.html'
    },
    actions: data.actions || [
      { action: 'open', title: 'View Details' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    requireInteraction: data.requireInteraction || false
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ============= NOTIFICATION CLICK =============
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification.tag);
  event.notification.close();

  if (event.action === 'dismiss') return;

  const urlToOpen = event.notification.data?.url || '/app.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url.includes('/app.html') && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// ============= NOTIFICATION CLOSE =============
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification dismissed:', event.notification.tag);
});

// ============= MESSAGE HANDLER =============
// Receive messages from the main app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    self.registration.showNotification(title, {
      icon: '/icon-512.png',
      badge: '/icon-512.png',
      ...options
    });
  }

  if (event.data && event.data.type === 'CACHE_URLS') {
    const urls = event.data.urls || [];
    caches.open(STATIC_CACHE).then((cache) => {
      urls.forEach((url) => {
        cache.add(url).catch(() => {});
      });
    });
  }

  if (event.data && event.data.type === 'SET_TOKEN') {
    self.authToken = event.data.token;
  }
});

// ============= INDEXEDDB HELPERS =============
function openTrackingDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ZenScreenTracking', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('tracking')) {
        const store = db.createObjectStore('tracking', { keyPath: 'id', autoIncrement: true });
        store.createIndex('synced', 'synced', { unique: false });
      }
    };
  });
}

function getPendingTrackingData(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['tracking'], 'readonly');
    const store = transaction.objectStore('tracking');
    const index = store.index('synced');
    const range = IDBKeyRange.only(false);
    const request = index.getAll(range);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function markAsSynced(db, records) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['tracking'], 'readwrite');
    const store = transaction.objectStore('tracking');
    records.forEach((record) => {
      store.put({ ...record, synced: true });
    });
    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => resolve();
  });
}

console.log('[SW] ZenScreen Service Worker v2 loaded');
