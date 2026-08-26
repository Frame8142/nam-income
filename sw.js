/* ==================================================
   SERVICE WORKER — รายได้ของน้ำ
   Cache static files for offline support
================================================== */

const CACHE_NAME = 'nam-income-v6';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Mitr:wght@400;500;600;700&family=Sarabun:wght@400;500;600;700&display=swap'
];


/* =========================
   INSTALL — cache static assets
========================= */

self.addEventListener('install', function (event) {

  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );

  // activate immediately
  self.skipWaiting();

});


/* =========================
   ACTIVATE — clean old caches
========================= */

self.addEventListener('activate', function (event) {

  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) {
            return key !== CACHE_NAME;
          })
          .map(function (key) {
            return caches.delete(key);
          })
      );
    })
  );

  // claim all clients immediately
  self.clients.claim();

});


/* =========================
   FETCH — Cache First, Network Fallback
   (API calls always go to network)
========================= */

self.addEventListener('fetch', function (event) {

  const url = new URL(event.request.url);

  // API calls (Google Apps Script) — always network
  if (url.hostname === 'script.google.com' ||
    url.hostname === 'script.googleusercontent.com') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function (cached) {

      if (cached) {
        // return cache but also update in background
        fetch(event.request).then(function (response) {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(event.request, response);
            });
          }
        }).catch(function () { });

        return cached;
      }

      // not in cache — try network
      return fetch(event.request).then(function (response) {

        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, responseClone);
          });
        }

        return response;

      }).catch(function () {
        // offline and not cached — nothing we can do
      });

    })
  );

});
