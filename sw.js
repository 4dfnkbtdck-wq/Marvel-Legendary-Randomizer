// Bump this whenever the app shell (any cached file below, or its
// content) changes — same discipline as the ?v= query strings the HTML
// pages use. A new name here makes install() re-fetch everything fresh
// and activate() drops the old cache instead of leaving it to grow.
const CACHE_VERSION = "v166";
const CACHE_NAME = `legendary-randomizer-${CACHE_VERSION}`;

const APP_SHELL = [
  "index.html",
  "setup.html",
  "stats.html",
  "glossary.html",
  "manifest.webmanifest",
  `css/styles.css?v=166`,
  `js/data.js?v=166`,
  `js/app.js?v=166`,
  `js/stats.js?v=166`,
  `js/glossary.js?v=166`,
  "img/icons/icon-180.png?v=166",
  "img/icons/icon-192.png?v=166",
  "img/icons/icon-512.png?v=166",
  "img/teams/avengers.webp",
  "img/teams/brotherhood.png",
  "img/teams/cabal.webp",
  "img/teams/champions.webp",
  "img/teams/crime-syndicate.png",
  "img/teams/fantastic-four.webp",
  "img/teams/foes-of-asgard.png",
  "img/teams/guardians-of-the-galaxy.webp",
  "img/teams/guardians-of-the-multiverse.png",
  "img/teams/heroes-of-asgard.png",
  "img/teams/heroes-of-wakanda.webp",
  "img/teams/hydra.png",
  "img/teams/illuminati.webp",
  "img/teams/inhumans.png",
  "img/teams/marvel-knights.png",
  "img/teams/mercs-for-money.webp",
  "img/teams/new-warriors.webp",
  "img/teams/shield.webp",
  "img/teams/sinister-six.png",
  "img/teams/spider-friends.webp",
  "img/teams/venomverse.webp",
  "img/teams/warbound.webp",
  "img/teams/x-factor-investigations.webp",
  "img/teams/x-force.webp",
  "img/teams/x-men.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

// Cache-first, falling back to network — and caching whatever the
// network returns so a card added after install (or an asset this list
// missed) is available offline on the next visit too. Only same-origin
// GET requests are worth handling here; everything else just passes
// through to the network untouched.
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
