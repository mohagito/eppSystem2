// Firebase Cloud Messaging (FCM) Service Worker to handle background push notifications
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Initialize Firebase App in service worker context using EPP configuration
firebase.initializeApp({
  apiKey: "AIzaSyBuEFjTbxG1a_4MgLWBnXZHyetur9_PcVQ",
  authDomain: "gen-lang-client-0551621027.firebaseapp.com",
  projectId: "gen-lang-client-0551621027",
  storageBucket: "gen-lang-client-0551621027.firebasestorage.app",
  messagingSenderId: "4192361386",
  appId: "1:4192361386:web:6b54f9b3523f7949e6e9d3"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Background message received:', payload);

  const title = payload.notification?.title || payload.data?.title || 'EPP Airbag MES Update';
  const body = payload.notification?.body || payload.data?.body || 'New manufacturing event register';
  const tab = payload.data?.tab || 'dashboard';

  // Customize options
  const options = {
    body: body,
    icon: '/logo-192.webp',
    badge: '/logo-192.webp',
    tag: 'epp-mes-notification-' + (payload.data?.id || Date.now()),
    renotify: true,
    data: {
      tab: tab
    }
  };

  return self.registration.showNotification(title, options);
});

// Handle custom notification clicks to route users to correct viewport tabs
self.addEventListener('notificationclick', function(event) {
  console.log('[firebase-messaging-sw.js] Notification click detected:', event);
  
  event.notification.close();

  // Tab routing parameters
  const targetTab = event.notification.data?.tab || 'dashboard';
  const targetUrl = new URL('/?tab=' + targetTab, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      // Find if app tab is already open and focus it
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      
      // If none open, launch a new browser window/tab
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
