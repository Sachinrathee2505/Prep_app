const CACHE_NAME = 'placement-command-center-v5'; 

const APP_SHELL_URLS = [
    './',
    './index.html',
    './script.js',
    './style.css',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
];

const CDN_URLS = [
    'https://cdn.tailwindcss.com',
    'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js',
    'https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.1/anime.min.js',
    'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/dist/confetti.browser.min.js',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

// Caches all the app shell and CDN files
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            console.log('SW: Caching App Shell...');
            // We use fetch for CDN URLs to make sure they are valid
            const cdnRequests = CDN_URLS.map(url => new Request(url, { mode: 'cors' }));
            
            // Cache local files
            await cache.addAll(APP_SHELL_URLS);
            
            // Cache CDN files
            try {
                await cache.addAll(cdnRequests);
            } catch (error) {
                console.warn('SW: Failed to cache some CDN resources. They will be fetched on-demand.', error);
            }
        })
    );
});
// Cleans up old caches
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME]; // Keep the current cache
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log('SW: Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', event => {
    const requestUrl = new URL(event.request.url);

    // We always try to get the newest HTML file
    if (requestUrl.pathname === '/' || requestUrl.pathname === '/index.html') {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // If we get a good response, cache it and return it
                    const clonedResponse = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clonedResponse));
                    return response;
                })
                .catch(() => {
                    // If the network fails (offline), return the cached version
                    console.log('SW: Network failed, serving index.html from cache.');
                    return caches.match(event.request);
                })
        );
        return; 
    }
    // This serves from cache first (for speed), then updates the cache
    // from the network in the background for next time.
    if (APP_SHELL_URLS.includes(requestUrl.pathname) || CDN_URLS.some(cdn => requestUrl.href.startsWith(cdn))) {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                // 1. Fetch a new version from the network
                const fetchPromise = fetch(event.request).then(networkResponse => {
                    // 2. If successful, update the cache
                    const clonedResponse = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clonedResponse));
                    return networkResponse;
                });

                // 3. Return the cached version *immediately* if it exists,
                //    otherwise, wait for the network fetch.
                return cachedResponse || fetchPromise;
            })
        );
        return; 
    }

    // This is for things like Firestore API calls. We don't cache these.
    // Firebase's own offline persistence handles this.
    event.respondWith(fetch(event.request));
});

self.addEventListener('push', event => {
  const data = event.data.json();
  console.log('Push received:', data);

  const options = {
    body: data.body,
    icon: './icon-192.png',
    badge: './icon-192.png'
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});