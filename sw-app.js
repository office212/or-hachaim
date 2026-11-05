/* Or Hachaim app shell service worker (2026-11-05, combined package).
   Scope "/", the whole site. Two jobs only: installability (an offline
   fallback page for a failed page load) and showing a push notification
   when one arrives. It never touches Firebase, Firestore, auth or
   Google's own domains, so sign in and all live data stay on the network
   exactly as before, and it never caches a page or its data: navigations
   go to the network first, and only when the network fails does the saved
   offline page show, so nobody ever sees a stale page or a stale balance.
   /tv/ keeps its own worker (tv/sw.js, scope /tv/): the browser already
   sends /tv/ requests there since that scope is more specific, and this
   file skips /tv/ on its own as a second guard, so the TV is never
   touched by this file and looks exactly as it did before.

   Push (2026-11-05): a plain Push API listener, not the Firebase
   Messaging SDK, so this file stays small and self-contained. The
   Cloud Function sends each push with a "notification" field
   (title/body), which Firebase Cloud Messaging delivers to the
   browser as a normal Web Push message; this worker shows it with
   self.registration.showNotification the same way any Web Push
   notification is shown, and does not need any Firebase script
   loaded inside the worker. */
var VERSION = "oh-app-shell-v2";
var OFFLINE_URL = "/offline.html";

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(VERSION)
      .then(function (c) { return c.add(OFFLINE_URL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) {
        return k.indexOf("oh-app-shell-") === 0 && k !== VERSION;
      }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function isBypassed(url) {
  /* /tv/: its own worker handles it; this file never does, even as a backup. */
  if (url.indexOf(self.location.origin + "/tv/") === 0) return true;
  /* Firebase, Firestore, auth and Google's own domains: always live, never cached. */
  return /^https:\/\/([^/]*\.)?(googleapis\.com|gstatic\.com|firebaseapp\.com|firebaseio\.com|google\.com)(\/|$)/.test(url);
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  if (isBypassed(req.url)) return;
  if (req.mode !== "navigate") return; /* this worker only answers page loads, nothing else */
  e.respondWith(
    fetch(req).catch(function () {
      return caches.match(OFFLINE_URL).then(function (hit) { return hit || Response.error(); });
    })
  );
});

/* Push (2026-11-05): show a notification, never cache or read app data here.
   Payload shape sent by functions/notifications: { notification: { title, body } }
   (the Admin SDK's own "notification" field; this worker does not need the
   Firebase Messaging client library to receive it, only the standard Push API). */
self.addEventListener("push", function (e) {
  var data = {};
  try { data = e.data ? e.data.json() : {}; } catch (err) { data = {}; }
  var n = data.notification || data || {};
  var title = n.title || "אור החיים";
  var body = n.body || "";
  e.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      dir: "rtl",
      lang: "he"
    })
  );
});

self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if ("focus" in list[i]) return list[i].focus();
      }
      if (clients.openWindow) return clients.openWindow("/");
    })
  );
});
