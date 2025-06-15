
// Service Worker for background notifications and mobile support with IndexedDB
self.addEventListener('install', (event) => {
  console.log('Service Worker installing');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating');
  event.waitUntil(self.clients.claim());
});

// Handle background sync for signal monitoring
self.addEventListener('sync', (event) => {
  if (event.tag === 'signal-check') {
    event.waitUntil(checkSignals());
  }
});

// IndexedDB helper functions for better background storage
async function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('SignalTrackerDB', 1);
    
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('signals')) {
        db.createObjectStore('signals', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getFromDB(storeName, key) {
  try {
    const db = await openDB();
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error getting from IndexedDB:', error);
    return null;
  }
}

async function putToDB(storeName, key, value) {
  try {
    const db = await openDB();
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put({ id: key, value: value });
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error putting to IndexedDB:', error);
  }
}

async function checkSignals() {
  try {
    console.log('Checking signals in service worker with IndexedDB');
    
    // Get signals from IndexedDB with localStorage fallback
    let signals = await getFromDB('signals', 'binary_signals');
    let antidelaySeconds = await getFromDB('settings', 'antidelay_seconds');
    
    // Fallback to localStorage if IndexedDB fails
    if (!signals && typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('binary_signals');
      signals = stored ? JSON.parse(stored) : [];
    }
    
    if (!antidelaySeconds && typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('antidelay_seconds');
      antidelaySeconds = stored ? parseInt(stored, 10) : 15;
    }
    
    if (!signals || signals.length === 0) {
      console.log('No signals found in storage');
      return;
    }
    
    const now = new Date();
    
    for (const signal of signals) {
      if (shouldTriggerSignal(signal, antidelaySeconds || 15, now)) {
        await showNotification(signal);
        // Mark signal as triggered
        signal.triggered = true;
        await putToDB('signals', 'binary_signals', signals);
      }
    }
  } catch (error) {
    console.error('Error checking signals in service worker:', error);
  }
}

function shouldTriggerSignal(signal, antidelaySeconds, now) {
  if (signal.triggered) return false;
  
  const [signalHours, signalMinutes] = signal.timestamp.split(':').map(Number);
  const signalDate = new Date();
  signalDate.setHours(signalHours, signalMinutes, 0, 0);
  
  // Subtract antidelay seconds
  const targetTime = new Date(signalDate.getTime() - (antidelaySeconds * 1000));
  
  // Check if current time matches target time (within 1 second tolerance)
  const timeDiff = Math.abs(now.getTime() - targetTime.getTime());
  return timeDiff < 1000;
}

async function showNotification(signal) {
  const options = {
    body: `${signal.asset || 'Asset'} - ${signal.direction || 'Direction'} at ${signal.timestamp}`,
    icon: '/placeholder.svg',
    badge: '/placeholder.svg',
    vibrate: [200, 100, 200, 100, 200, 100, 200],
    tag: 'signal-notification-' + signal.timestamp,
    requireInteraction: true,
    silent: false,
    data: {
      signal: signal,
      timestamp: Date.now()
    },
    actions: [
      {
        action: 'view',
        title: 'View Signal'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };

  return self.registration.showNotification('🚨 Binary Options Signal Alert!', options);
}

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'view' || !event.action) {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        if (clients.length > 0) {
          return clients[0].focus();
        }
        return self.clients.openWindow('/');
      })
    );
  }
});

// Handle push notifications for mobile
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  
  const options = {
    body: data.body || 'Signal notification',
    icon: '/placeholder.svg',
    badge: '/placeholder.svg',
    vibrate: [200, 100, 200, 100, 200],
    tag: 'signal-notification',
    requireInteraction: true,
    silent: false,
    data: data
  };

  event.waitUntil(
    self.registration.showNotification(data.title || '🚨 Signal Tracker Alert!', options)
  );
});

// Set up periodic background sync and sync with IndexedDB
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'REGISTER_BACKGROUND_SYNC') {
    console.log('Registering background sync with IndexedDB support');
    
    // Register for background sync
    self.registration.sync.register('signal-check').then(() => {
      console.log('Background sync registered');
    }).catch((err) => {
      console.log('Background sync registration failed:', err);
    });
    
    // Sync localStorage data to IndexedDB
    if (event.data.signals) {
      putToDB('signals', 'binary_signals', event.data.signals);
    }
    if (event.data.antidelaySeconds) {
      putToDB('settings', 'antidelay_seconds', event.data.antidelaySeconds);
    }
  }
});
