// Cleanup service worker that immediately unregisters itself and does NOT intercept fetches
self.addEventListener('install', function() {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    self.registration.unregister()
  );
});
