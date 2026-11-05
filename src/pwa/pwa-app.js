/* Or Hachaim: app install support (2026-11-05, combined package). One shared
   file, loaded by every page except /tv/ (which keeps its own worker,
   unchanged). It does two small, separate jobs:
   1. Registers the root app-shell service worker (/sw-app.js).
   2. Captures the browser's install signal (beforeinstallprompt) and the
      standalone/iOS checks, and exposes them on window.OH_PWA so the shared
      shell (src/ui/oh-shell.js) can decide WHEN and WHERE to show install UI.
   This file draws no UI itself (no popup, no button, no banner): the
   previous package's on-page banner was too prominent on the landing page
   (Hanoch, Nov 5) and is replaced by a small once-only popup and a footer
   link, both owned by oh-shell.js, both signed-in pages only, never on the
   landing page. Keeping the install MECHANICS here and the install UI in
   oh-shell.js means this file does not change shape again if the UI does. */
(function () {
  if (location.pathname.indexOf("/tv/") === 0) return; /* belt and suspenders: never on the TV */

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw-app.js", { scope: "/" }).catch(function () {});
    });
  }

  function isStandalone() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
  }
  function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  }

  var deferredPrompt = null;
  var listeners = [];
  function notify() { listeners.forEach(function (fn) { try { fn(); } catch (e) {} }); }

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
    notify();
  });
  window.addEventListener("appinstalled", function () {
    deferredPrompt = null;
    notify();
  });

  window.OH_PWA = {
    isStandalone: isStandalone,
    isIos: isIos,
    /* true once the browser has actually offered an install (Android Chrome,
       desktop Chrome/Edge); false on iOS and on browsers that never offer one. */
    canPrompt: function () { return !!deferredPrompt; },
    /* Triggers the real native prompt. Resolves to "accepted" / "dismissed" /
       "unavailable" (no prompt captured, e.g. called twice or already installed). */
    prompt: function () {
      if (!deferredPrompt) return Promise.resolve("unavailable");
      var p = deferredPrompt;
      deferredPrompt = null;
      return p.prompt().then(function () {
        return p.userChoice ? p.userChoice.then(function (c) { return c && c.outcome; }) : "accepted";
      }).catch(function () { return "unavailable"; });
    },
    /* Called when the install signal or the installed state changes, so a
       page that already rendered (install not yet offered) can update. */
    onChange: function (fn) { if (typeof fn === "function") listeners.push(fn); }
  };
})();
