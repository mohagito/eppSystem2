// EPP MES PWA Service Worker for Offline Execution and Deep-Background Notifications
const CACHE_NAME = 'epp-mes-cache-v3';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/manifest.json',
  '/logo-192.svg',
  '/logo-512.svg',
  '/logo-maskable.svg'
];

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Initialize Firebase inside the Service Worker
firebase.initializeApp({
  apiKey: "AIzaSyBuEFjTbxG1a_4MgLWBnXZHyetur9_PcVQ",
  authDomain: "gen-lang-client-0551621027.firebaseapp.com",
  projectId: "gen-lang-client-0551621027",
  storageBucket: "gen-lang-client-0551621027.firebasestorage.app",
  messagingSenderId: "4192361386",
  appId: "1:4192361386:web:6b54f9b3523f7949e6e9d3"
});

const messaging = firebase.messaging();

// Cache installation resources
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Self activation
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Cache dynamic offline router support
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html');
      })
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});

// Deep Lock-Screen Web Push Notifications Support
self.addEventListener('push', (event) => {
  console.log('[sw.js] Native push event detected:', event);
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (err) {
      data = { title: 'EPP MES Update', body: event.data.text() };
    }
  }

  const title = data.title || 'EPP Airbag System Update';
  const options = {
    body: data.body || data.message || 'New manufacturing log registered',
    icon: '/logo-192.svg',
    badge: '/logo-192.svg',
    vibrate: [200, 100, 200, 100, 300],
    tag: 'epp-mes-push-' + (data.id || Date.now()),
    renotify: true,
    data: {
      tab: data.tab || 'dashboard'
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// FCM Background Notification Handler
messaging.onBackgroundMessage((payload) => {
  console.log('[sw.js] FCM background message received:', payload);
  const title = payload.notification?.title || payload.data?.title || 'EPP Airbag MES Update';
  const body = payload.notification?.body || payload.data?.body || 'New manufacturing event register';
  const tab = payload.data?.tab || 'dashboard';

  const options = {
    body: body,
    icon: '/logo-192.svg',
    badge: '/logo-192.svg',
    vibrate: [200, 100, 200, 100, 300],
    tag: 'epp-mes-fcm-' + (payload.data?.id || Date.now()),
    renotify: true,
    data: {
      tab: tab
    }
  };

  return self.registration.showNotification(title, options);
});

// Click listener to redirect correctly and wake screen
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetTab = event.notification.data?.tab || 'dashboard';
  const targetUrl = new URL('/?tab=' + targetTab, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
