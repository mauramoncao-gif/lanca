const CACHE_NAME = "lanca-pwa-v6-4-3-secure";
const APP_SHELL = [
  "./",
  "./index.html",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon-36.png",
  "./icons/icon-64.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
      ),
      self.clients.claim()
    ])
  );
});

self.addEventListener("message", event => {
  if(event.data && event.data.type === "SKIP_WAITING"){
    self.skipWaiting();
  }
});

async function networkFirst(request, fallbackKey){
  try{
    const response = await fetch(request, {cache:"no-store"});
    if(response && response.ok){
      const cache = await caches.open(CACHE_NAME);
      await cache.put(fallbackKey || request, response.clone());
    }
    return response;
  }catch(e){
    return caches.match(fallbackKey || request);
  }
}

self.addEventListener("fetch", event => {
  if(event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if(url.origin !== self.location.origin){
    event.respondWith(Response.error());
    return;
  }

  if(event.request.mode === "navigate"){
    event.respondWith(networkFirst(event.request, "./index.html"));
    return;
  }

  if(url.pathname.endsWith("/app.js")){
    event.respondWith(networkFirst(event.request, "./app.js"));
    return;
  }

  if(url.pathname.endsWith("/manifest.webmanifest")){
    event.respondWith(networkFirst(event.request, "./manifest.webmanifest"));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if(cached) return cached;
      return fetch(event.request).then(response => {
        if(response && response.ok){
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
