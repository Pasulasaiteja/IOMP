// public/service-worker.js — ZenScreen Service Worker
// Handles app shell caching, offline support, and background tasks

const CACHE_NAME = 'zenscreen-v1';
const STATIC_ASSETS = [
  '/',
  '/app.html',
  '/app.js',
  '/index.html'
];

// ============= INSTALL EVENT =============
// Cache app shell on first install
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Caching app shell');
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[ServiceWorker] Cache addAll failed (some assets may not exist):', err);
        // Continue even if some assets don't exist
        return Promise.resolve();
      });
    }).catch(err => {
      console.error('[ServiceWorker] Cache open failed:', err);
    })
  );
  
  // Skip waiting — activate immediately
  self.skipWaiting();
});

// ============= ACTIVATE EVENT =============
// Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // Claim all clients immediately
  self.clients.claim();
});

// ============= FETCH EVENT =============
// Cache-first strategy: serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response; // Serve from cache
      }

      return fetch(event.request).then((response) => {
        // Don't cache non-successful responses
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }

        // Clone the response
        const responseToCache = response.clone();

        // Cache successful responses
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      }).catch((err) => {
        console.warn('[ServiceWorker] Fetch failed for:', event.request.url, err);
        
        // Return cached fallback or offline page
        return caches.match('/app.html').catch(() => {
          return new Response('Offline', { status: 503 });
        });
      });
    })
  );
});

// ============= PERIODIC SYNC EVENT =============
// Handle background periodic sync for data updates
self.addEventListener('sync', (event) => {
  console.log('[ServiceWorker] Sync event:', event.tag);

  if (event.tag === 'sync-tracking') {
    event.waitUntil(syncTracking());
  }
});

async function syncTracking() {
  try {
    console.log('[ServiceWorker] Starting background sync...');
    
    // Open IndexedDB to get pending data
    const db = await openTrackingDB();
    const pendingData = await getPendingTrackingData(db);
    
    if (pendingData.length === 0) {
      console.log('[ServiceWorker] No pending data to sync');
      return;
    }

    // Send to server with retry logic
    const response = await syncWithRetry('/api/data/sync-tracking', pendingData, 3);

    if (response.ok) {
      console.log('[ServiceWorker] Sync successful');
      // Mark as synced
      await markAsSynced(db, pendingData);
    } else {
      console.error('[ServiceWorker] Sync failed:', response.status);
      throw new Error('Sync failed with status ' + response.status);
    }
  } catch (err) {
    console.error('[ServiceWorker] Sync error:', err);
    throw err; // Retry
  }
}

async function syncWithRetry(url, data, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[ServiceWorker] Sync attempt ${attempt}/${maxRetries}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: data })
      });

      if (response.ok || response.status === 401 || response.status === 400) {
        // Success or unrecoverable error
        return response;
      }

      // Retry on 5xx or network errors
      lastError = new Error(`HTTP ${response.status}`);
      console.warn(`[ServiceWorker] Attempt ${attempt} failed:`, lastError);
      
      if (attempt < maxRetries) {
        // Exponential backoff: 2s, 4s, 8s
        const backoff = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, backoff));
      }
    } catch (err) {
      lastError = err;
      console.warn(`[ServiceWorker] Network error on attempt ${attempt}:`, err);
      
      if (attempt < maxRetries) {
        const backoff = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, backoff));
      }
    }
  }

  // All retries exhausted
  throw lastError || new Error('Sync failed after max retries');
}

// ============= NOTIFICATION CLICK HANDLER =============
self.addEventListener('notificationclick', (event) => {
  console.log('[ServiceWorker] Notification clicked:', event.notification.tag);
  
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/app.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if app is already open
      for (let client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If not open, open it
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// ============= SHOW NOTIFICATION =============
// Called from app or background sync to display notifications
async function showNotification(title, options = {}) {
  try {
    if (!self.registration.showNotification) {
      console.warn('[ServiceWorker] showNotification not available');
      return;
    }

    await self.registration.showNotification(title, {
      icon: '/app.html', // Could use a proper icon
      badge: '📱',
      tag: options.tag || 'zenscreen',
      requireInteraction: options.requireInteraction || false,
      ...options
    });

    console.log('[ServiceWorker] Notification shown:', title);
  } catch (err) {
    console.error('[ServiceWorker] Notification error:', err);
  }
}

// Expose showNotification for external calls
self.showNotification = showNotification;

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
        console.log('[ServiceWorker] Created tracking object store');
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

console.log('[ServiceWorker] Service Worker script loaded');
