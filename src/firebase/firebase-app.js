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
    ready: false,
    role: null,
    roleUid: null,
    rolePromise: null
  };
  var SUPER_ADMIN_EMAIL = "hanochhason@gmail.com";
  /* 2040 phase 2: the site root (the landing page), from this file's own address
     (".../src/firebase/firebase-app.js"), so it is right on any host or folder. */
  var SITE_ROOT = (function () {
    try {
      var s = document.currentScript && document.currentScript.src;
      if (s) { var u = new URL(s, location.href), i = u.pathname.indexOf("/src/firebase/firebase-app.js"); if (u.origin === location.origin && i >= 0) return u.pathname.slice(0, i + 1); }
    } catch (e) {}
    return "/";
  })();
  var UNAUTH_TEXT = "This account is not authorized for the system.";
  /* 2040 phase 1: the shared prayer time rule (TV reads it):
     {kind:"fixed"|"sunset", offsetMin:int, days:"all"|"weekday"|"fri"|"shabbat"|"sun-thu",
      from:"YYYY-MM-DD"?, until:"YYYY-MM-DD"?}. Only these keys are written. */
  function cleanRule(r) {
    var out = { kind: r.kind === "sunset" ? "sunset" : "fixed", offsetMin: Math.round(+r.offsetMin || 0) };
    var DAYS = ["all", "weekday", "fri", "shabbat", "sun-thu"];
    out.days = DAYS.indexOf(r.days) >= 0 ? r.days : "all";
    if (/^\d{4}-\d{2}-\d{2}$/.test(r.from || "")) out.from = r.from;
    if (/^\d{4}-\d{2}-\d{2}$/.test(r.until || "")) out.until = r.until;
    return out;
  }
  function normalizePerms(v) {
    var out = [];
    var arr = Array.isArray(v) ? v : (v ? [v] : []);
    arr.forEach(function (x) {
      String(x).split(/[,\s]+/).forEach(function (part) {
        var q = part.trim().toLowerCase();
        if (q) out.push(q);
      });
    });
    return out;
  }
  /* Claims precedence (option 2): when a token carries ohRoleVersion,
     the claims define finance/screen/imageUpload, and stale
     users-doc permissions are ignored for those areas. Without
     claims, the old UID-doc + email-doc union is used, so existing
     grants keep working during migration. Congregant status is
     separate and is never set by claims.
     Stage 2 (2026-11-03): the read-only screen account role is
     abolished. Its old claim or users field is ignored here, and only
     the known permissions (finance, screen = content and times, times,
     both) are kept from a users document. */
  var KNOWN_PERMS = ["finance", "screen", "times", "both"];
  function buildRole(user, userDoc, hasCongregant, userDocByEmail, claims) {
    var email = (user.email || "").toLowerCase();
    var role = { email: email, uid: user.uid, isSuperAdmin: email === SUPER_ADMIN_EMAIL,
      permissions: [], isCongregant: !!hasCongregant, source: "none", imageUpload: false };
    var hasClaims = !!(claims && typeof claims.ohRoleVersion === "number");
    var docs = [];
    if (userDoc) docs.push(userDoc);
    if (userDocByEmail) docs.push(userDocByEmail);
    if (hasClaims) {
      role.source = "customClaims";
      if (claims.ohImageUpload === true) role.imageUpload = true;
      if (claims.ohFinance === true) role.permissions.push("finance");
      if (claims.ohScreen === true) role.permissions.push("screen");
      if (claims.ohScreenEdit === true && role.permissions.indexOf("screen") < 0) role.permissions.push("screen");
      if (docs.length) role.source = "customClaims+usersDoc";
    }
    if (docs.length && !hasClaims) {
      role.source = docs.length > 1 ? "usersDoc+emailDoc" : "usersDoc";
      docs.forEach(function (doc) {
        if (doc.imageUpload === true || doc.image_upload === true) role.imageUpload = true;
        normalizePerms(doc.permissions || doc.permission || doc.role).forEach(function (p) {
          if (KNOWN_PERMS.indexOf(p) >= 0 && role.permissions.indexOf(p) < 0) role.permissions.push(p);
        });
      });
    }
    var has = function (tok) { return role.permissions.indexOf(tok) >= 0; };
    role.isScreen = role.isSuperAdmin || has("screen") || has("times") || has("both");
    role.isFinance = role.isSuperAdmin || has("finance") || has("both");
    role.isAdmin = role.isSuperAdmin || has("finance") || has("screen") || has("times") || has("both");
    role.isCongregantAccess = role.isSuperAdmin || role.isCongregant;
    role.canScreen = role.isScreen;
    role.canFinance = role.isFinance;
    role.canAdmin = role.isAdmin;
    role.canCongregant = role.isCongregantAccess;
    role.authorized = role.isSuperAdmin || role.isScreen || role.isFinance || role.isAdmin || role.isCongregant;
    if (role.isSuperAdmin) {
      role.source = "superAdmin";
      role.canScreen = role.canFinance = role.canAdmin = role.canCongregant = true;
      role.authorized = true;
    }
    return role;
  }
  async function resolveRoleInternal() {
    if (!state.ready || !state.db || !state.user) return null;
    if (state.role && state.roleUid === state.user.uid) return state.role;
    if (state.rolePromise && state.roleUid === state.user.uid) return state.rolePromise;
    state.roleUid = state.user.uid;
    state.rolePromise = (async function () {
      try {
        var tokenClaims = null;
        try {
          // Compat auth user: getIdTokenResult without force refresh,
          // so the 1-second page polls do not hammer token refresh.
          // After a new grant, the target user must sign out and
          // sign in again to get a fresh token with the new claims.
          if (state.user && typeof state.user.getIdTokenResult === "function") {
            var tr = await state.user.getIdTokenResult();
            tokenClaims = (tr && tr.claims) || null;
          }
        } catch (e) {}
        var userDoc = null;
        try {
          var d = await state.db.collection("users").doc(state.user.uid).get();
          if (d.exists) userDoc = d.data() || {};
        } catch (e) {}
        /* Email lookup, merged with the UID doc. NOTE: under the
           current live Firestore rules this query is DENIED for a
           non-super-admin (users read is super admin or UID match
           only), so it only succeeds for the super admin until the
           rules are changed. See the report for the exact rule line. */
        var userDocByEmail = null;
        if (state.user.email) {
          try {
            var eq = await state.db.collection("users").where("email", "==", state.user.email.toLowerCase()).limit(1).get();
            if (!eq.empty) userDocByEmail = eq.docs[0].data() || {};
          } catch (e) {}
        }
        var hasCong = false;
        if (state.user.email) {
          try {
            var s = await state.db.collection("congregants").where("email", "==", state.user.email).limit(1).get();
            hasCong = !s.empty;
          } catch (e) {}
        }
        state.role = buildRole(state.user, userDoc, hasCong, userDocByEmail, tokenClaims);
        return state.role;
      } catch (e) {
        state.role = buildRole(state.user, null, false, null, null);
        return state.role;
      }
    })();
    return state.rolePromise;
  }
  function isLandingPage() { return !!document.querySelector(".signin-box"); }

  function statusText() {
    if (!complete) return "Firebase: not configured, sign-in required";
    if (!state.user) return "Firebase: signed out, sign-in required";
    return "Firebase: signed in";
  }
  function renderStatus() {
    var el = document.getElementById("ohFirebaseStatus");
    if (el) el.textContent = statusText();
  }
  function injectStatus() {
    if (isLandingPage()) return; /* Public landing: no status bar, no signed-in email. Only Sign in / Sign out. */
    if (document.getElementById("ohFirebaseStatus")) { renderStatus(); return; }
    var bar = document.createElement("div");
    bar.id = "ohFirebaseStatusBar";
    bar.className = "status-bar"; /* look lives in theme.css */
    var span = document.createElement("span");
    span.id = "ohFirebaseStatus";
    span.textContent = statusText();
    bar.appendChild(span);
    if (complete) {
      var btn = document.createElement("button");
      btn.className = "gsi-btn";
      btn.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34.5 6.1 29.5 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.6 5.1C9.7 39.7 16.3 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg><span>Sign in with Google</span>';
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
    get role() { return state.role; },
    resolveRole: function () { return resolveRoleInternal(); },
    canAccess: function (page) {
      var r = state.role;
      if (!r) return false;
      if (page === "screen") return !!r.canScreen;
      if (page === "finance") return !!r.canFinance;
      if (page === "admin") return !!r.canAdmin;
      if (page === "congregant") return !!r.canCongregant;
      return !!r.authorized;
    },
    unauthMessage: function () { return "החשבון הזה אינו מורשה למערכת הגבאים. / This account isn't authorized for the Gabbai system."; },
    statusText: statusText,
    signIn: function () {
      if (!state.auth || !window.firebase || !window.firebase.auth) return Promise.reject(new Error("Firebase not ready"));
      var provider = new window.firebase.auth.GoogleAuthProvider();
      return state.auth.signInWithPopup(provider);
    },
    /* 2040 phase 2 (Hanoch 2026-11-04 9:21 AM): signing out anywhere in the
       gabbai system goes straight to the landing page (the site root), not to
       the signed-out gabbai page. On the landing page itself nothing moves.
       A caller can stay with signOut({ stay: true }). */
    signOut: function (opts) {
      var p = state.auth ? state.auth.signOut() : Promise.resolve();
      if (opts && opts.stay) return p;
      var go = function () {
        if (SITE_ROOT && location.pathname.replace(/index\.html$/, "") !== SITE_ROOT) location.href = SITE_ROOT;
      };
      return p.then(function (v) { go(); return v; }, function (e) { go(); throw e; });
    },
    get siteRoot() { return SITE_ROOT; },
    /* Return Firestore congregants mapped to the TEST_DATA shape, or
       null when Firestore is unavailable/empty, so callers fall back
       to TEST_DATA. Never throws. */
    _db: function () { return state.db; },
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
    /* Load only the signed-in user's own congregant record, by email,
       plus that congregant's ledger entries. Returns the congregant
       object, or null when signed out, no matching record, or denied.
       Never returns another congregant's data. Never throws. */
    loadOwnCongregant: async function () {
      if (!state.ready || !state.db || !state.user || !state.user.email) return null;
      try {
        var snap = await state.db.collection("congregants").where("email", "==", state.user.email).get();
        if (snap.empty) return null;
        var doc = snap.docs[0];
        var d = doc.data() || {};
        var out = { id: doc.id, name: d.name || doc.id, phone: d.phone || "", email: d.email || "", ledger: [] };
        var led = await state.db.collection("ledgerEntries").where("congregantId", "==", doc.id).get();
        led.forEach(function (e) {
          var ed = e.data() || {};
          out.ledger.push({ date: ed.date || "", operationId: ed.operationId || e.id, type: ed.type || "charge", amount: ed.amount || 0, description: ed.description || "", enteredBy: ed.enteredBy || "" });
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
          /* Stage B1: each item keeps its document id, so the admin can edit or
             delete exactly that document. An empty English name stays empty (before,
             the random document id was shown in its place). */
          var it = { id: doc.id, nameHe: d.nameHe || d.nameEn || "", nameEn: d.nameEn || "", time: d.time || "", order: typeof d.order === "number" ? d.order : 0 };
          /* 2040 phase 1: an optional repeat rule (days, date range, or relative
             to sunset) rides along unchanged; docs without it are as before. */
          if (d.rule && typeof d.rule === "object") it.rule = d.rule;
          prayerTimes.push(it);
        });
        /* Firestore returns documents by id, not by time: sort by the
           order field the admin saves, so Shacharit comes before Mincha. */
        prayerTimes.sort(function (a, b) { return a.order - b.order; });
        return { prayerTimes: prayerTimes };
      } catch (e) { return null; }
    },
    /* Append-only ledger write. Returns {saved:true} on success,
       {saved:false, reason} otherwise. Changed 2026-11-03:
       - ONE atomic batch: the operationIds claim and the ledger entry
         are written together or not at all. Before, a network drop
         between the two writes burned the operationId with no entry.
       - The ledger document id IS the operationId, so a second write
         with the same id is an update, and the rules deny every
         ledger update: a duplicate is rejected by the database itself.
       - enteredBy / enteredByUid / createdAt are set here and checked
         by the rules (createdAt must be the server time).
       - date defaults to today's date in New York, not UTC. */
    saveLedgerEntry: async function (entry) {
      if (!state.ready || !state.db || !entry || !entry.operationId) {
        return { saved: false, reason: "test-only" };
      }
      if (!state.user) return { saved: false, reason: "not-signed-in" };
      var amount = Number(entry.amount);
      if (!isFinite(amount) || amount === 0) return { saved: false, reason: "invalid-amount" };
      try {
        var ledgerRef = state.db.collection("ledgerEntries").doc(entry.operationId);
        var opRef = state.db.collection("operationIds").doc(entry.operationId);
        var ts = window.firebase.firestore.FieldValue.serverTimestamp();
        var data = {
          congregantId: entry.congregantId || "",
          date: entry.date || (window.OH_UI ? window.OH_UI.nyDate() : new Date().toISOString().slice(0, 10)),
          type: entry.type || "charge",
          amount: Math.round(amount * 100) / 100,
          description: entry.description || "",
          enteredBy: state.user.email || "",
          enteredByUid: state.user.uid,
          operationId: entry.operationId,
          source: entry.source || "manual",
          createdAt: ts
        };
        if (entry.method) data.method = String(entry.method);
        if (entry.pledgeId) data.pledgeId = String(entry.pledgeId);
        if (entry.aliyah) data.aliyah = String(entry.aliyah);
        var batch = state.db.batch();
        batch.set(opRef, { createdAt: ts, congregantId: data.congregantId, by: state.user.uid });
        batch.set(ledgerRef, data);
        await batch.commit();
        return { saved: true, id: entry.operationId };
      } catch (e) {
        /* permission-denied on an existing id means it was already saved:
           report it as a duplicate so the caller does not save again. */
        try {
          var again = await state.db.collection("ledgerEntries").doc(entry.operationId).get();
          if (again.exists) return { saved: false, reason: "duplicate-operationId" };
        } catch (e2) {}
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
    /* Super-admin user management. Client-side super-admin check
       only; the Firestore rules are the real enforcement (super
       admin create/update/delete on users). Congregants are NOT
       added here; they are added separately in the finance flow.
       imageUpload is stored as a field only. It does NOT yet
       enforce Storage access; Storage enforcement by custom claim
       is a separate open item. */
    isSuperAdminClient: function () {
      return !!(state.user && state.user.email && state.user.email.toLowerCase() === SUPER_ADMIN_EMAIL);
    },
    saveUserPermission: async function (email, permissions, imageUpload) {
      if (!state.ready || !state.db || !state.user) return { saved: false, reason: "not-signed-in" };
      if (state.user.email.toLowerCase() !== SUPER_ADMIN_EMAIL) return { saved: false, reason: "not-super-admin" };
      var em = String(email || "").trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return { saved: false, reason: "invalid-email" };
      var perm = String(permissions || "").trim().toLowerCase();
      if (["finance", "screen", "both"].indexOf(perm) < 0) return { saved: false, reason: "invalid-permission" };
      try {
        var q = await state.db.collection("users").where("email", "==", em).limit(1).get();
        var data = { email: em, permissions: perm,
          imageUpload: imageUpload === true,
          updatedBy: state.user.email, updatedAt: new Date().toISOString() };
        if (!q.empty) {
          var docId = q.docs[0].id;
          await state.db.collection("users").doc(docId).update(data);
          return { saved: true, id: docId, updated: true };
        }
        data.createdBy = state.user.email;
        data.createdAt = new Date().toISOString();
        var ref = await state.db.collection("users").add(data);
        return { saved: true, id: ref.id, updated: false };
      } catch (e) { return { saved: false, reason: String(e && e.message ? e.message : e) }; }
    },
    saveUserPermissionById: async function (id, permissions, imageUpload) {
      if (!state.ready || !state.db || !state.user) return { saved: false, reason: "not-signed-in" };
      if (state.user.email.toLowerCase() !== SUPER_ADMIN_EMAIL) return { saved: false, reason: "not-super-admin" };
      if (!id) return { saved: false, reason: "missing-id" };
      var perm = String(permissions || "").trim().toLowerCase();
      if (["finance", "screen", "both"].indexOf(perm) < 0) return { saved: false, reason: "invalid-permission" };
      try {
        await state.db.collection("users").doc(id).update({ permissions: perm,
          imageUpload: imageUpload === true,
          updatedBy: state.user.email, updatedAt: new Date().toISOString() });
        return { saved: true, id: id, updated: true };
      } catch (e) { return { saved: false, reason: String(e && e.message ? e.message : e) }; }
    },
    listUsers: async function () {
      if (!state.ready || !state.db || !state.user) return { ok: false, reason: "not-signed-in", users: [] };
      if (state.user.email.toLowerCase() !== SUPER_ADMIN_EMAIL) return { ok: false, reason: "not-super-admin", users: [] };
      try {
        var snap = await state.db.collection("users").get();
        var out = [];
        snap.forEach(function (doc) {
          var d = doc.data() || {};
          out.push({ id: doc.id, email: d.email || "", permissions: d.permissions || d.permission || "", imageUpload: d.imageUpload === true });
        });
        out.sort(function (a, b) { return (a.email || "").localeCompare(b.email || ""); });
        return { ok: true, users: out };
      } catch (e) { return { ok: false, reason: String(e && e.message ? e.message : e), users: [] }; }
    },
    deleteUserPermission: async function (id) {
      if (!state.ready || !state.db || !state.user) return { saved: false, reason: "not-signed-in" };
      if (state.user.email.toLowerCase() !== SUPER_ADMIN_EMAIL) return { saved: false, reason: "not-super-admin" };
      if (!id) return { saved: false, reason: "missing-id" };
      try {
        await state.db.collection("users").doc(id).delete();
        return { saved: true, id: id };
      } catch (e) { return { saved: false, reason: String(e && e.message ? e.message : e) }; }
    },
    /* Custom claims client (option 2, function LIVE since 2026-11-02
       20:51, URL is a public endpoint, the Firebase ID token is the
       access control, so the URL itself is not a secret).
       URL comes from window.OH_CLAIMS_FUNCTION_URL or
       FIREBASE_CONFIG.claimsFunctionUrl, otherwise the deployed
       function URL below. */
    claimsFunctionUrl: function () {
      return window.OH_CLAIMS_FUNCTION_URL || (cfg && cfg.claimsFunctionUrl) || "https://us-east1-or-hachaim.cloudfunctions.net/setUserClaims";
    },
    /* Wire contract of the DEPLOYED setUserClaims function (its code is
       not in this repo): it takes the old read-only screen account
       field in the body, sent here always false, and a permission on
       revoke. Both are kept exactly as the function expects until its
       code is checked; the role itself is abolished and the rules
       ignore that claim. */
    grantUserClaims: async function (email, permission, imageUpload, action) {
      if (!state.ready || !state.user) return { ok: false, reason: "not-signed-in" };
      if (state.user.email.toLowerCase() !== SUPER_ADMIN_EMAIL) return { ok: false, reason: "not-super-admin" };
      var url = (window.OH_FIREBASE && window.OH_FIREBASE.claimsFunctionUrl) ? window.OH_FIREBASE.claimsFunctionUrl() : (this && this.claimsFunctionUrl ? this.claimsFunctionUrl() : "https://us-east1-or-hachaim.cloudfunctions.net/setUserClaims");
      if (!url) return { ok: false, reason: "claims-function-not-configured" };
      try {
        var token = await state.user.getIdToken();
        var resp = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
          body: JSON.stringify({ email: String(email || "").trim().toLowerCase(), permission: permission, screenViewer: false, imageUpload: imageUpload === true, action: action || "grant" }) });
        var data = null;
        try { data = await resp.json(); } catch (e) {}
        if (!resp.ok) return { ok: false, reason: (data && data.error) || ("http-" + resp.status), message: data && data.message ? data.message : "" };
        return { ok: true, data: data };
      } catch (e) { return { ok: false, reason: String(e && e.message ? e.message : e) }; }
    },
    revokeUserClaims: async function (email) {
      return window.OH_FIREBASE.grantUserClaims(email, "viewer", false, "revoke");
    },
    grantUserClaimsAndSave: async function (email, permission, imageUpload) {
      var r = await window.OH_FIREBASE.grantUserClaims(email, permission, imageUpload, "grant");
      if (r && r.ok) return { saved: true, viaClaims: true, pending: false, data: r.data };
      if (r && r.reason === "auth-user-not-found") {
        var s = await window.OH_FIREBASE.saveUserPermission(email, permission, imageUpload);
        if (s && s.saved) return { saved: true, viaClaims: false, pending: true, reason: "auth-user-not-found", message: "Saved as pending only. This email has no Auth record yet: ask the user to sign in once with Google first, then grant again.", id: s.id, updated: s.updated };
        return { saved: false, viaClaims: false, pending: false, reason: (s && s.reason) || "pending-save-failed" };
      }
      return { saved: false, viaClaims: false, pending: false, reason: (r && r.reason) || "claims-grant-failed" };
    },
    savePrayerTime: async function (item) {
      if (!state.ready || !state.db) return { saved: false, reason: "test-only" };
      try {
        var data = {
          nameEn: item.nameEn || "", nameHe: item.nameHe || item.nameEn || "",
          time: item.time || "", order: typeof item.order === "number" ? item.order : Date.now(),
          updatedBy: (state.user && state.user.email) || "",
          updatedAt: new Date().toISOString()
        };
        /* 2040 phase 1: optional rule {kind, offsetMin, days, from?, until?}.
           time and order are always filled too, so older screens keep working. */
        if (item.rule && typeof item.rule === "object") data.rule = cleanRule(item.rule);
        var ref = await state.db.collection("prayerTimes").add(data);
        return { saved: true, id: ref.id };
      } catch (e) { return { saved: false, reason: String(e && e.message ? e.message : e), code: (e && e.code) || "" }; }
    },
    /* Stage B1 (prayer times manager). Same collection, same fields as
       savePrayerTime: nameHe, nameEn, time ("6:30 AM"), order (minutes after
       midnight), updatedBy, updatedAt. No new collection, no new field. */
    loadPrayerTimes: async function () {
      if (!state.ready || !state.db) return { ok: false, reason: "test-only" };
      try {
        var snap = await state.db.collection("prayerTimes").get();
        var items = [];
        snap.forEach(function (doc) {
          var d = doc.data() || {};
          var it = { id: doc.id, nameHe: d.nameHe || d.nameEn || "", nameEn: d.nameEn || "", time: d.time || "", order: typeof d.order === "number" ? d.order : 0 };
          if (d.rule && typeof d.rule === "object") it.rule = d.rule;
          items.push(it);
        });
        items.sort(function (a, b) { return a.order - b.order; });
        return { ok: true, items: items };
      } catch (e) { return { ok: false, reason: String(e && e.message ? e.message : e), code: (e && e.code) || "" }; }
    },
    updatePrayerTime: async function (id, item) {
      if (!state.ready || !state.db) return { saved: false, reason: "test-only" };
      if (!id || !item) return { saved: false, reason: "missing-id" };
      try {
        var data = {
          nameEn: item.nameEn || "", nameHe: item.nameHe || item.nameEn || "",
          time: item.time || "", order: typeof item.order === "number" ? item.order : 0,
          updatedBy: (state.user && state.user.email) || "",
          updatedAt: new Date().toISOString()
        };
        /* rule: an object sets it, null removes it, absent leaves it as is. */
        if (item.rule && typeof item.rule === "object") data.rule = cleanRule(item.rule);
        else if (item.rule === null && window.firebase && window.firebase.firestore) data.rule = window.firebase.firestore.FieldValue.delete();
        await state.db.collection("prayerTimes").doc(id).update(data);
        return { saved: true, id: id };
      } catch (e) { return { saved: false, reason: String(e && e.message ? e.message : e), code: (e && e.code) || "" }; }
    },
    /* 2040 phase 2 (Hanoch 9:09 AM, "לסדר"): put an existing time in its place with
       one tap. Writes ONLY the rule (and who/when): the time, the order and the names
       stay exactly as they are. Allowed by the existing prayerTimes update rule. */
    setPrayerTimeRule: async function (id, rule) {
      if (!state.ready || !state.db) return { saved: false, reason: "test-only" };
      if (!id || !rule || typeof rule !== "object") return { saved: false, reason: "missing-id" };
      try {
        await state.db.collection("prayerTimes").doc(id).update({ rule: cleanRule(rule), updatedBy: (state.user && state.user.email) || "", updatedAt: new Date().toISOString() });
        return { saved: true, id: id };
      } catch (e) { return { saved: false, reason: String(e && e.message ? e.message : e), code: (e && e.code) || "" }; }
    },
    /* The Firestore rules decide who may delete (stage B1: every Content and
       Times gabbai and the super admin). A refusal comes back as saved:false. */
    /* 2040 phase 1 (undo of a delete): put the same document back under the
       same id, with exactly the fields it had. Allowed by the existing create
       rule for prayerTimes (hasScreen). */
    restorePrayerTime: async function (id, item) {
      if (!state.ready || !state.db) return { saved: false, reason: "test-only" };
      if (!id || !item) return { saved: false, reason: "missing-id" };
      try {
        var data = {
          nameEn: item.nameEn || "", nameHe: item.nameHe || item.nameEn || "",
          time: item.time || "", order: typeof item.order === "number" ? item.order : 0,
          updatedBy: (state.user && state.user.email) || "",
          updatedAt: new Date().toISOString()
        };
        if (item.rule && typeof item.rule === "object") data.rule = cleanRule(item.rule);
        await state.db.collection("prayerTimes").doc(id).set(data);
        return { saved: true, id: id };
      } catch (e) { return { saved: false, reason: String(e && e.message ? e.message : e), code: (e && e.code) || "" }; }
    },
    /* 2040 phase 1: one line in the existing activityLog (area "screen"),
       the same shape screen-content.js writes. The rules allow create for
       the super admin, finance and screen gabbaim; a refusal is returned,
       never thrown, so the change itself is never blocked by its log line. */
    logActivity: async function (action, detail, extra) {
      if (!state.ready || !state.db || !state.user) return { saved: false, reason: "not-signed-in" };
      try {
        var ts = window.firebase && window.firebase.firestore ? window.firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString();
        var log = { area: (extra && extra.area) || "screen", action: String(action || ""), detail: String(detail || "").slice(0, 500),
          who: state.user.email || "", whoUid: state.user.uid || "", when: ts };
        if (extra && extra.itemId) log.itemId = String(extra.itemId);
        if (extra && extra.collection) log.collection = String(extra.collection);
        if (extra && extra.command) log.command = String(extra.command).slice(0, 300);
        await state.db.collection("activityLog").add(log);
        return { saved: true };
      } catch (e) { return { saved: false, reason: String(e && e.message ? e.message : e), code: (e && e.code) || "" }; }
    },
    /* 2040 phase 1 (Hanoch 2026-11-04, 5:29 to 5:33 AM): every word on the screen
       easy to edit, in Hebrew and English, the screen language, and the order of
       the blocks. ONE public document settings/screenTexts =
       { texts:{key:"he"}, textsEn:{key:"en"}, layout:{order:[ids], hidden:[ids]}, updatedBy, updatedAt }.
       (Hanoch 5:51 AM: the TV has no language mode; it always shows its Hebrew + English look.)
       Only public screen wording and arrangement, no private data. Rules: public
       read; create/update by content gabbaim and the super admin, exactly these
       keys (RULES_DELTA.md). */
    loadScreenTexts: async function () {
      if (!state.ready || !state.db) return { ok: false, reason: "test-only" };
      try {
        var d = await state.db.collection("settings").doc("screenTexts").get();
        var data = d.exists ? (d.data() || {}) : {};
        var obj = function (v) { return (v && typeof v === "object" && !Array.isArray(v)) ? v : {}; };
        return { ok: true, texts: obj(data.texts), textsEn: obj(data.textsEn), layout: obj(data.layout), updatedBy: data.updatedBy || "" };
      } catch (e) { return { ok: false, reason: String(e && e.message ? e.message : e), code: (e && e.code) || "" }; }
    },
    /* change(cur) edits a copy of {texts, textsEn, layout}; one transaction,
       so two gabbaim editing different words never erase each other. */
    saveScreenSettings: async function (change) {
      if (!state.ready || !state.db || !state.user) return { saved: false, reason: "not-signed-in" };
      var ref = state.db.collection("settings").doc("screenTexts"), email = state.user.email || "";
      try {
        var out = await state.db.runTransaction(async function (tx) {
          var snap = await tx.get(ref), d = snap.exists ? (snap.data() || {}) : {};
          var obj = function (v) { return (v && typeof v === "object" && !Array.isArray(v)) ? JSON.parse(JSON.stringify(v)) : {}; };
          var cur = { texts: obj(d.texts), textsEn: obj(d.textsEn), layout: obj(d.layout) };
          change(cur);
          var data = { texts: cur.texts, textsEn: cur.textsEn, layout: cur.layout,
            updatedBy: email, updatedAt: window.firebase.firestore.FieldValue.serverTimestamp() };
          tx.set(ref, data);
          return cur;
        });
        return { saved: true, texts: out.texts, textsEn: out.textsEn, layout: out.layout };
      } catch (e) { return { saved: false, reason: String(e && e.message ? e.message : e), code: (e && e.code) || "" }; }
    },
    /* one word: he / en: a string sets it, null removes it (back to the default) */
    saveScreenText: async function (key, he, en) {
      if (!/^[A-Za-z0-9_.-]{1,80}$/.test(String(key || ""))) return { saved: false, reason: "bad-key" };
      return this.saveScreenSettings(function (c) {
        if (he === null) delete c.texts[key]; else if (typeof he === "string") c.texts[key] = he;
        if (en === null) delete c.textsEn[key]; else if (typeof en === "string") c.textsEn[key] = en;
      });
    },
    /* 2040 phase 2 (Hanoch 2026-11-04 7:19 AM): the landing page wording, super
       admin only. ONE public document settings/homeTexts =
       { texts:{key:"he"}, textsEn:{key:"en"}, updatedBy, updatedAt } (the shared
       contract with the landing page: it overlays non-empty values on the
       defaults in src/home/home-texts.js). Rules: public read; create/update by
       the super admin only, exactly these keys (RULES_DELTA.md). */
    loadHomeTexts: async function () {
      if (!state.ready || !state.db) return { ok: false, reason: "test-only" };
      try {
        var d = await state.db.collection("settings").doc("homeTexts").get();
        var data = d.exists ? (d.data() || {}) : {};
        var obj = function (v) { return (v && typeof v === "object" && !Array.isArray(v)) ? v : {}; };
        return { ok: true, texts: obj(data.texts), textsEn: obj(data.textsEn), updatedBy: data.updatedBy || "" };
      } catch (e) { return { ok: false, reason: String(e && e.message ? e.message : e), code: (e && e.code) || "" }; }
    },
    /* one line: he / en: a string sets it, null removes it (back to the default),
       undefined leaves it. One transaction, so two edits never erase each other. */
    saveHomeText: async function (key, he, en) {
      if (!state.ready || !state.db || !state.user) return { saved: false, reason: "not-signed-in" };
      if (!/^[A-Za-z0-9_.-]{1,80}$/.test(String(key || ""))) return { saved: false, reason: "bad-key" };
      var ref = state.db.collection("settings").doc("homeTexts"), email = state.user.email || "";
      try {
        var out = await state.db.runTransaction(async function (tx) {
          var snap = await tx.get(ref), d = snap.exists ? (snap.data() || {}) : {};
          var obj = function (v) { return (v && typeof v === "object" && !Array.isArray(v)) ? JSON.parse(JSON.stringify(v)) : {}; };
          var cur = { texts: obj(d.texts), textsEn: obj(d.textsEn) };
          if (he === null) delete cur.texts[key]; else if (typeof he === "string") cur.texts[key] = he;
          if (en === null) delete cur.textsEn[key]; else if (typeof en === "string") cur.textsEn[key] = en;
          tx.set(ref, { texts: cur.texts, textsEn: cur.textsEn, updatedBy: email, updatedAt: window.firebase.firestore.FieldValue.serverTimestamp() });
          return cur;
        });
        return { saved: true, texts: out.texts, textsEn: out.textsEn };
      } catch (e) { return { saved: false, reason: String(e && e.message ? e.message : e), code: (e && e.code) || "" }; }
    },
    deletePrayerTime: async function (id) {
      if (!state.ready || !state.db) return { saved: false, reason: "test-only" };
      if (!id) return { saved: false, reason: "missing-id" };
      try {
        await state.db.collection("prayerTimes").doc(id).delete();
        return { saved: true, id: id };
      } catch (e) { return { saved: false, reason: String(e && e.message ? e.message : e), code: (e && e.code) || "" }; }
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
  /* app-compat first (the others attach to it), then the rest in
     parallel instead of one after another: faster first paint. */
  loadScript(base + "firebase-app-compat.js")
    .then(function () {
      return Promise.all([
        loadScript(base + "firebase-auth-compat.js"),
        loadScript(base + "firebase-firestore-compat.js"),
        loadScript(base + "firebase-storage-compat.js")
      ]);
    })
    .then(function () {
      window.firebase.initializeApp(cfg);
      state.auth = window.firebase.auth();
      state.db = window.firebase.firestore();
      state.storage = window.firebase.storage();
      state.ready = true;
      state.mode = "firebase";
      state.auth.onAuthStateChanged(function (u) {
        state.user = u;
        state.role = null; state.roleUid = null; state.rolePromise = null;
        if (u) { resolveRoleInternal().catch(function () {}); }
        renderStatus();
        if (state._btn) { var _sp = state._btn.querySelector("span"); if (_sp) _sp.textContent = u ? "Sign out" : "Sign in with Google"; else state._btn.textContent = u ? "Sign out" : "Sign in with Google"; }
      });
      renderStatus();
    })
    .catch(function () {
      state.mode = "test-only";
      state.reason = "firebase-sdk-load-failed";
      renderStatus();
    });
})();
