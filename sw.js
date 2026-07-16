// ===================================================================
//  Diridari Erfassung – Service Worker
//  Etappe C2
// ===================================================================

const CACHE_VERSION = "diridari-v40";

const DATEIEN = [
  "./",
  "./index.html",
  "./manifest.json",
  "./lang.js",
  "./speicher.js",
  "./foto.js",
  "./krypto.js",
  "./app.js",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(DATEIEN)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((namen) =>
      Promise.all(namen.filter((n) => n !== CACHE_VERSION).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Nur eigene App-Dateien (https, gleiche Herkunft) aus dem Cache bedienen.
  // Lokale HTTP-Adressen (WLAN-Upload-Seite des PCs) NIEMALS abfangen –
  // sonst liefert der Service Worker dafuer eine leere Seite.
  const url = event.request.url;
  if (!url.startsWith("https://") || new URL(url).origin !== self.location.origin) {
    return;  // ans Netzwerk durchreichen, ohne Eingriff
  }

  event.respondWith(
    caches.match(event.request).then((treffer) => treffer || fetch(event.request))
  );
});
