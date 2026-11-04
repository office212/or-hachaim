/* Or Hachaim TV | offline cache (2040 phase 1). Scope: /tv/ only.
   Keeps the screen alive when the internet drops: the page, its code,
   fonts, logo, the year's zmanim and calendar files, and the Firebase
   SDK are kept in the browser's cache. Code and data: the network first
   (a new upload is picked up as soon as the TV is online), the cache only
   when the network fails or is too slow. Fonts, images, the SDK: the cache
   first. Firestore itself (the live listener) is never touched here; the
   screen keeps its own copy of the last prayer times and board items.
   Nothing private is cached: /tv/ reads only public data. */
var VERSION = "oh-tv-2040-p1-v2";
var CORE = [
  "./",
  "../screen/screen.css", "../screen/content.css", "../screen/screen.js", "../screen/content-board.js",
  "../src/theme.css", "../src/tv/tv-2040.css",
  "../src/firebase/firebase-config.js", "../src/firebase/firebase-app.js", "../src/firebase/screen-content.js",
  "../src/engines/shabbat-safe.js", "../src/engines/display-engine.js", "../src/ui/oh-ui.js",
  "../src/calendar/or-calendar.min.js", "../src/calendar/screen-calendar.js", "../src/calendar/oh-hooks.js",
  "../src/tv/tv-texts.js", "../src/tv/day-state.js", "../src/tv/prayer-rules.js", "../src/tv/tv-live.js", "../src/tv/sunset-5787.json",
  "../src/zmanim/roy-daily-5787.json",
  "../src/assets/logo-4k-transparent.png", "../src/assets/textures/jerusalem-stone-wall.webp",
  "../src/assets/fonts/assistant-var.woff2", "../src/assets/fonts/frank-ruhl-libre-var.woff2"
];
var SDK = "https://www.gstatic.com/firebasejs/";
var NET_TIMEOUT_MS = 4000;

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) {
    /* one by one: a single missing file never blocks the rest */
    return Promise.all(CORE.map(function (u) {
      return fetch(new Request(u, { cache: "reload" })).then(function (r) { if (r && r.ok) return c.put(u, r); }).catch(function () {});
    }));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf("oh-tv-") === 0 && k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function isCacheFirst(url) {
  return url.indexOf(SDK) === 0 || /^https:\/\/firebasestorage\.googleapis\.com\//.test(url) || /\.(woff2|png|webp|jpg|jpeg|svg)(\?|$)/.test(url);
}
function handled(req) {
  if (req.method !== "GET") return false;
  var u = req.url;
  if (u.indexOf(self.location.origin + "/") === 0) return true;
  return u.indexOf(SDK) === 0 || /^https:\/\/firebasestorage\.googleapis\.com\//.test(u);
}
function keyFor(req) {
  /* the page itself is one entry whatever the query (?t=...) */
  if (req.mode === "navigate") return new URL("./", self.location).href;
  return req.url;
}
function put(key, res) {
  if (!res || !(res.ok || res.type === "opaque")) return;
  var copy = res.clone();
  caches.open(VERSION).then(function (c) { c.put(key, copy); }).catch(function () {});
}
function fromCache(key) { return caches.open(VERSION).then(function (c) { return c.match(key, { ignoreSearch: false }).then(function (m) { return m || c.match(key, { ignoreSearch: true }); }); }); }

/* the page hands over every file it has used (performance entries): the Firebase SDK
   from the CDN and the calendar's data files, which the page loaded before this
   worker was running. Kept now, so a start with no network has them all. */
self.addEventListener("message", function (e) {
  var d = e.data || {};
  if (d.type !== "warm" || !Array.isArray(d.urls)) return;
  e.waitUntil(caches.open(VERSION).then(function (c) {
    return Promise.all(d.urls.slice(0, 200).map(function (u) {
      try { u = String(u); } catch (x) { return null; }
      var same = u.indexOf(self.location.origin + "/") === 0;
      if (!same && u.indexOf(SDK) !== 0) return null;
      if (same && new URL(u).pathname === new URL("./", self.location).pathname) return null; /* the page: kept by the fetch handler */
      return c.match(u).then(function (hit) {
        if (hit) return null;
        return fetch(same ? new Request(u) : new Request(u, { mode: "no-cors" })).then(function (r) { if (r && (r.ok || r.type === "opaque")) return c.put(u, r); }).catch(function () {});
      });
    }));
  }));
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (!handled(req)) return;
  var key = keyFor(req);
  if (isCacheFirst(req.url)) {
    e.respondWith(fromCache(key).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) { put(key, res); return res; });
    }));
    return;
  }
  /* network first, with a timeout, then the cache */
  e.respondWith(new Promise(function (resolve) {
    var done = false;
    var timer = setTimeout(function () {
      fromCache(key).then(function (hit) { if (hit && !done) { done = true; resolve(hit); } });
    }, NET_TIMEOUT_MS);
    fetch(req).then(function (res) {
      if (res && res.ok) put(key, res);
      if (!done) { done = true; clearTimeout(timer); resolve(res); }
    }).catch(function () {
      fromCache(key).then(function (hit) {
        if (done) return; done = true; clearTimeout(timer);
        resolve(hit || Response.error());
      });
    });
  }));
});
