const CACHE_NAME = "lanca-pwa-v6-4-1-secure";
const APP_SHELL = [
  "./","./index.html","./app.js","./manifest.webmanifest",
  "./icons/icon-36.png","./icons/icon-64.png","./icons/icon-192.png","./icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
});

self.addEventListener("fetch", event => {
  if(event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if(url.origin !== self.location.origin){
    event.respondWith(Response.error());
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if(cached) return cached;
      if(event.request.mode === "navigate"){
        return fetch(event.request).catch(() => caches.match("./index.html"));
      }
      return fetch(event.request);
    })
  );
});
