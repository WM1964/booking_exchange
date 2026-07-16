// ===================================================================
//  Diridari Erfassung – Service Worker
//  Etappe C2
// ===================================================================

const CACHE_VERSION = "diridari-v38";

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
  const url = event.request.url;

  // Lokale Netzwerk-Requests (Direktsenden an den PC per WLAN) NICHT abfangen.
  // Der Service Worker wuerde sonst den fetch neu absetzen und dabei die
  // Option targetAddressSpace verlieren -> Request scheitert. Solche Requests
  // muessen unveraendert ans Netzwerk gehen.
  if (url.startsWith("http://")) {
    return;  // Standard-Netzwerkverhalten, ohne Service-Worker-Eingriff
  }

  // Nur GET-Anfragen an die eigenen App-Dateien werden aus dem Cache bedient.
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((treffer) => treffer || fetch(event.request))
  );
});
