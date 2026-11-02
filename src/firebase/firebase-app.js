/* Or Hachaim Firebase wiring layer, TEST phase.
   - Auth: Google only, via Firebase Auth. No other provider is used.
   - Firestore: reads/writes only when a complete config is present AND
     the user is signed in. Otherwise every page keeps the existing
     TEST / SAMPLE data, unchanged.
   - Append-only: ledger writes go through saveLedgerEntry, which first
     claims a unique operationId (see src/engines/idempotency.js). The
     Firestore rules themselves deny ledger update/delete for everyone,
     including the super admin, so a UI bug cannot edit history.
   - Shabbat safety, burn-in, theme, and Hebrew/English rules are NOT
     changed here: this file never touches src/theme.css, never hides
     or shows weekday-only items, and never moves screen content.
   - Storage is NOT used: Storage is unavailable (Blaze upgrade not
     approved). Images stay local preview only, as in the admin page.
   - If the Firebase CDN fails to load, or the config is incomplete,
     this file degrades silently to test-only mode and the pages keep
     working on TEST data. It never throws on page load.
   - TEST DATA ONLY labels stay in place until real data arrives. */
(function () {
  var cfg = window.FIREBASE_CONFIG || {};
  var complete = !!(cfg.apiKey && cfg.appId && cfg.projectId);
  var state = {
    mode: complete ? "firebase-pending" : "test-only",
    reason: complete ? "config present, SDK loading" : "firebase-config-incomplete",
    user: null,
    db: null,
  storage: null,
    auth: null,
    ready: false
  };

  function statusText() {
    if (!complete) return "Firebase: not configured, TEST DATA ONLY";
    if (!state.user) return "Firebase: signed out, showing TEST DATA";
    return "Firebase: signed in as " + (state.user.email || state.user.uid);
  }
  function renderStatus() {
    var el = document.getElementById("ohFirebaseStatus");
    if (el) el.textContent = statusText();
  }
  function injectStatus() {
    if (document.getElementById("ohFirebaseStatus")) { renderStatus(); return; }
    var bar = document.createElement("div");
    bar.id = "ohFirebaseStatusBar";
    bar.style.cssText = "padding:8px 12px;border:1px solid #e5dcc9;background:#fdf8f0;color:#1b365d;font-size:14px";
    var span = document.createElement("span");
    span.id = "ohFirebaseStatus";
    span.textContent = statusText();
    bar.appendChild(span);
    if (complete) {
      var btn = document.createElement("button");
      btn.textContent = "Sign in with Google";
      btn.style.cssText = "margin-left:12px;padding:6px 14px;border-radius:999px;border:1px solid #1b365d;background:#fff;color:#1b365d;cursor:pointer";
      btn.onclick = function () {
        if (state.user) { window.OH_FIREBASE.signOut(); return; }
        var r = window.OH_FIREBASE.signIn();
        if (r && r.catch) r.catch(function (e) {
          var el = document.getElementById("ohFirebaseStatus");
          if (el) el.textContent = "Firebase sign-in failed: " + (e && e.message ? e.message : e) + " (code: " + (e && e.code ? e.code : "unknown") + ")";
        });
      };
      bar.appendChild(btn);
      state._btn = btn;
    }
    var host = document.querySelector(".page") || document.body;
    if (host) host.insertBefore(bar, host.firstChild);
  }

  window.OH_FIREBASE = {
    mode: state.mode,
    reason: state.reason,
    get user() { return state.user; },
    get ready() { return state.ready; },
    statusText: statusText,
    signIn: function () {
      if (!state.auth || !window.firebase || !window.firebase.auth) return Promise.reject(new Error("Firebase not ready"));
      var provider = new window.firebase.auth.GoogleAuthProvider();
      return state.auth.signInWithPopup(provider);
    },
    signOut: function () {
      if (!state.auth) return Promise.resolve();
      return state.auth.signOut();
    },
    /* Return Firestore congregants mapped to the TEST_DATA shape, or
       null when Firestore is unavailable/empty, so callers fall back
       to TEST_DATA. Never throws. */
    loadCongregants: async function () {
      if (!state.ready || !state.db) return null;
      try {
        var snap = await state.db.collection("congregants").get();
        if (snap.empty) return null;
        var out = [];
        snap.forEach(function (doc) {
          var d = doc.data() || {};
          out.push({ id: doc.id, name: d.name || doc.id, phone: d.phone || "", email: d.email || "", ledger: [] });
        });
        var led = await state.db.collection("ledgerEntries").get();
        led.forEach(function (doc) {
          var d = doc.data() || {};
          var c = out.find(function (x) { return x.id === d.congregantId; });
          if (c) c.ledger.push({ date: d.date || "", operationId: d.operationId || doc.id, type: d.type || "charge", amount: d.amount || 0, description: d.description || "", enteredBy: d.enteredBy || "" });
        });
        return out;
      } catch (e) { return null; }
    },
    loadScreenData: async function () {
      if (!state.ready || !state.db) return null;
      try {
        var pt = await state.db.collection("prayerTimes").get();
        if (pt.empty) return null;
        var prayerTimes = [];
        pt.forEach(function (doc) {
          var d = doc.data() || {};
          prayerTimes.push({ nameHe: d.nameHe || d.nameEn || doc.id, nameEn: d.nameEn || doc.id, time: d.time || "" });
        });
        return { prayerTimes: prayerTimes };
      } catch (e) { return null; }
    },
    /* Append-only ledger write. Returns {saved:true} on success,
       {saved:false, reason} otherwise. A duplicate operationId is
       rejected here AND by the Firestore rules. Update/delete are
       never attempted, by design. */
    saveLedgerEntry: async function (entry) {
      if (!state.ready || !state.db || !entry || !entry.operationId) {
        return { saved: false, reason: "test-only" };
      }
      try {
        var opRef = state.db.collection("operationIds").doc(entry.operationId);
        var op = await opRef.get();
        if (op.exists) return { saved: false, reason: "duplicate-operationId" };
        await opRef.set({ createdAt: new Date().toISOString(), congregantId: entry.congregantId || "" });
        await state.db.collection("ledgerEntries").add({
          congregantId: entry.congregantId || "",
          date: entry.date || new Date().toISOString().slice(0, 10),
          type: entry.type || "charge",
          amount: entry.amount || 0,
          description: entry.description || "",
          enteredBy: (state.user && state.user.email) || "",
          operationId: entry.operationId,
          source: entry.source || "manual"
        });
        return { saved: true };
      } catch (e) {
        return { saved: false, reason: String(e && e.message ? e.message : e) };
      }
    },
    uploadScreenImage: async function (file, name) {
      if (!state.ready || !state.storage || !file) return { saved: false, reason: 'test-only' };
      try {
        var path = 'screen/' + (name || ('test-' + Date.now() + '-' + file.name));
        var ref = state.storage.ref(path);
        await ref.put(file);
        var url = await ref.getDownloadURL();
        return { saved: true, path: path, url: url };
      } catch (e) { return { saved: false, reason: String(e && e.message ? e.message : e) }; }
    },
    getScreenImageUrl: async function (path) {
      if (!state.ready || !state.storage || !path) return { ok: false, reason: 'test-only' };
      try { var url = await state.storage.ref(path).getDownloadURL(); return { ok: true, url: url }; }
      catch (e) { return { ok: false, reason: String(e && e.message ? e.message : e) }; }
    },
    savePrayerTime: async function (item) {
      if (!state.ready || !state.db) return { saved: false, reason: "test-only" };
      try {
        await state.db.collection("prayerTimes").add({
          nameEn: item.nameEn || "", nameHe: item.nameHe || item.nameEn || "",
          time: item.time || "", updatedBy: (state.user && state.user.email) || "",
          updatedAt: new Date().toISOString()
        });
        return { saved: true };
      } catch (e) { return { saved: false, reason: String(e && e.message ? e.message : e) }; }
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectStatus);
  } else {
    injectStatus();
  }

  if (!complete) { return; }

  /* Complete config only: load the Firebase compat SDKs, then init.
     Compat builds keep the no-build-step static site working. */
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  var base = "https://www.gstatic.com/firebasejs/10.12.2/";
  loadScript(base + "firebase-app-compat.js")
    .then(function () { return loadScript(base + "firebase-auth-compat.js"); })
    .then(function () { return loadScript(base + "firebase-firestore-compat.js"); })
    .then(function () { return loadScript(base + "firebase-storage-compat.js"); })
    .then(function () {
      window.firebase.initializeApp(cfg);
      state.auth = window.firebase.auth();
      state.db = window.firebase.firestore();
      state.storage = window.firebase.storage();
      state.ready = true;
      state.mode = "firebase";
      state.auth.onAuthStateChanged(function (u) {
        state.user = u;
        renderStatus();
        if (state._btn) state._btn.textContent = u ? "Sign out" : "Sign in with Google";
      });
      renderStatus();
    })
    .catch(function () {
      state.mode = "test-only";
      state.reason = "firebase-sdk-load-failed";
      renderStatus();
    });
})();
