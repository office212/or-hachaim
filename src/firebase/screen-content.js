/* Screen content data layer (Display Engine side), stage 2 2026-11-03.
   The editor writes to the EXISTING live content collections, as agreed
   with Hanoch and Muse (no new collection):
     announcements/{id}  announcement, rabbi message, mazal tov, hazkara,
                         campaign, donation
     dedications/{id}    dedication, parnas hayom / ner lamaor
     sponsors/{id}       kiddush / seudah sponsor
     flyers/{id}         flyer
     yahrzeits/{id}      yahrzeit
   Each document keeps its own "type", so the board shows it the same way.
   History and restore (Nov 5, the activity log is now super admin only):
   each item keeps its last 10 earlier versions inside its own document
   (versions: content fields, version, action, savedAt; no email, no uid,
   since a published item is public). The activity log gets one separate
   line per save, written after the save; it is not read here.
   The public /tv/ reads only status "published" (the stage 2 rules allow
   the public nothing else). Drafts and archived items stay private.
   Images go to Storage under screen/{type}/{itemId}/..., JPEG, PNG or
   WebP, resized in the browser to at most 1920 px, max 5 MB (the
   Storage rules repeat the limits).
   Uses window.OH_FIREBASE (firebase-app.js) for the db, the user and
   the role. Never touches finance collections. */
(function () {
  "use strict";
  var FIELDS = ["type", "subtype", "titleHe", "titleEn", "bodyHe", "bodyEn", "startDate", "endDate", "showOn", "hasPayment",
    "visibility", "status", "permanent", "order", "image", "yahrzeit", "campaign"];
  var TYPES = ["announcement", "dedication", "flyer", "yahrzeit", "sponsor", "parnas", "mazaltov", "hazkara", "rabbi", "campaign", "donation"];
  var MAX_IMAGE_BYTES = 5 * 1024 * 1024, MAX_EDGE = 1920;
  var CACHE_KEY = "orHachaimScreenItems";
  var MAX_VERSIONS = 10; /* the rules allow at most 10 (versionsOk) */
  var ACT_HE = { create: "נוסף פריט במסך", update: "עודכן פריט במסך", publish: "פורסם במסך", unpublish: "הורד מהמסך",
    archive: "הועבר לארכיון", restore: "שוחזרה גרסה קודמת של פריט במסך" };
  var COLLECTION_OF = { announcement: "announcements", rabbi: "announcements", mazaltov: "announcements", hazkara: "announcements",
    campaign: "announcements", donation: "announcements", dedication: "dedications", parnas: "dedications",
    sponsor: "sponsors", flyer: "flyers", yahrzeit: "yahrzeits" };
  var COLLECTIONS = ["announcements", "dedications", "sponsors", "flyers", "yahrzeits"];
  function collectionOf(type) { return COLLECTION_OF[type] || "announcements"; }

  function fb() { return window.OH_FIREBASE || null; }
  function db() { var f = fb(); return f && f._db ? f._db() : null; }
  function fs() { return window.firebase && window.firebase.firestore; }
  function perms(role) { return (role && role.permissions) || []; }
  function canEdit(role) {
    if (!role) return false;
    if (role.isSuperAdmin) return true;
    var p = perms(role);
    return p.indexOf("screen") >= 0 || p.indexOf("times") >= 0 || p.indexOf("both") >= 0;
  }
  function canUpload(role) { return !!role && (role.isSuperAdmin || role.imageUpload === true); }

  /* Keep only known fields, trimmed, with safe types. */
  function clean(item) {
    var o = {};
    FIELDS.forEach(function (k) { if (item[k] !== undefined && item[k] !== null) o[k] = item[k]; });
    ["titleHe", "titleEn", "bodyHe", "bodyEn"].forEach(function (k) { if (typeof o[k] === "string") o[k] = o[k].trim(); else if (k in o) o[k] = String(o[k]); });
    o.type = TYPES.indexOf(o.type) >= 0 ? o.type : "announcement";
    o.showOn = ["all", "weekday", "shabbat"].indexOf(o.showOn) >= 0 ? o.showOn : "all";
    o.visibility = o.visibility === "screen" ? "screen" : "public";
    o.status = ["draft", "published", "archived"].indexOf(o.status) >= 0 ? o.status : "draft";
    o.order = typeof o.order === "number" && isFinite(o.order) ? Math.round(o.order) : 100;
    o.hasPayment = o.hasPayment === true;
    o.permanent = o.permanent === true;
    o.startDate = typeof o.startDate === "string" ? o.startDate : "";
    o.endDate = typeof o.endDate === "string" ? o.endDate : "";
    if (o.image && !(o.image.url && o.image.path)) delete o.image;
    return o;
  }
  /* Problems the gabbai must fix before saving. */
  function validate(item) {
    var e = [], ymd = /^\d{4}-\d{2}-\d{2}$/;
    if (item.type === "yahrzeit") {
      var y = item.yahrzeit || {};
      if (!y.nameHe) e.push("שם הנפטר חסר");
      if (!(y.hDay >= 1 && y.hDay <= 30) || !y.hMonth) e.push("תאריך עברי חסר");
    } else if (item.type === "flyer") {
      if (!item.image && !item.titleHe) e.push("לפלייר צריך תמונה או כותרת");
    } else if (!item.titleHe && !item.bodyHe) e.push("צריך כותרת או טקסט בעברית");
    if (item.startDate && !ymd.test(item.startDate)) e.push("תאריך התחלה לא תקין");
    if (item.endDate && !ymd.test(item.endDate)) e.push("תאריך סיום לא תקין");
    if (item.startDate && item.endDate && item.endDate < item.startDate) e.push("תאריך הסיום לפני תאריך ההתחלה");
    var noEndOk = item.type === "yahrzeit" || item.type === "donation" || (item.type === "dedication" && item.permanent);
    if (!noEndOk && !item.endDate) e.push("חסר תאריך סיום (רק הקדשה קבועה ותרומה בלי סיום)");
    if (!item.startDate && item.type !== "yahrzeit") e.push("חסר תאריך התחלה");
    if ((item.titleHe || "").length > 200 || (item.titleEn || "").length > 200) e.push("כותרת ארוכה מדי (עד 200 תווים)");
    if ((item.bodyHe || "").length > 2000 || (item.bodyEn || "").length > 2000) e.push("טקסט ארוך מדי (עד 2000 תווים)");
    return e;
  }

  function toItem(doc, col) {
    var d = doc.data() || {}, o = { id: doc.id };
    if (col) o.col = col;
    Object.keys(d).forEach(function (k) {
      var v = d[k];
      if (v && typeof v.toDate === "function") v = v.toDate().toISOString();
      o[k] = v;
    });
    delete o.versions; /* earlier versions are read only by history() */
    return o;
  }
  function cache(items) { try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: new Date().toISOString(), items: items })); } catch (e) {} }
  function cached() { try { var c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); return c && c.items ? c : null; } catch (e) { return null; } }

  /* Live subscription over the 5 content collections, merged into one
     list. mode: "public" (the /tv/ page and the congregant page, no
     special permission: status "published" only, which is exactly what
     the rules allow the public), "editor" (admin: everything). The
     callback runs once every collection has answered, then on every
     change. cb(items, error). */
  function subscribe(mode, cb) {
    var d = db(); if (!d) { cb(null, "not-ready"); return function () {}; }
    var parts = {}, failed = null, unsubs = [];
    function emit() {
      if (failed) return;
      if (COLLECTIONS.some(function (c) { return !parts[c]; })) return;
      var items = [];
      COLLECTIONS.forEach(function (c) { items = items.concat(parts[c]); });
      if (mode !== "editor") cache(items);
      cb(items, null);
    }
    COLLECTIONS.forEach(function (c) {
      var q = d.collection(c);
      if (mode !== "editor") q = q.where("status", "==", "published");
      unsubs.push(q.onSnapshot(function (snap) {
        var items = []; snap.forEach(function (doc) { items.push(toItem(doc, c)); });
        parts[c] = items; emit();
      }, function (err) { if (!failed) { failed = (err && err.code) || String(err); cb(null, failed); } }));
    });
    return function () { unsubs.forEach(function (u) { try { u(); } catch (e) {} }); };
  }

  async function save(item, action, extra) {
    var f = fb(), d = db();
    if (!f || !d || !f.user) return { saved: false, reason: "not-signed-in" };
    var role = await f.resolveRole();
    if (!canEdit(role)) return { saved: false, reason: "no-screen-permission" };
    var data = clean(item), errs = validate(data);
    if (errs.length) return { saved: false, reason: "invalid", errors: errs };
    var col = collectionOf(data.type);
    /* A saved item stays in its collection: a type that belongs to another
       collection would need a delete, which only the super admin has. */
    if (item.id && item.col && item.col !== col) return { saved: false, reason: "type-moves-collection" };
    var ref = item.id ? d.collection(col).doc(item.id) : d.collection(col).doc();
    var ts = fs().FieldValue.serverTimestamp(), email = f.user.email, uid = f.user.uid;
    try {
      var prev = item.id ? await ref.get() : null;
      var version = prev && prev.exists ? ((prev.data().version || 0) + 1) : 1;
      data.version = version;
      data.updatedAt = ts; data.updatedBy = email; data.updatedByUid = uid;
      if (version === 1) { data.createdAt = ts; data.createdBy = email; data.createdByUid = uid; }
      else { var pd = prev.data(); data.createdAt = pd.createdAt || ts; data.createdBy = pd.createdBy || email; data.createdByUid = pd.createdByUid || uid; }
      if (extra && typeof extra.restoredFromVersion === "number") data.restoredFrom = extra.restoredFromVersion;
      var act = action || (version === 1 ? "create" : "update");
      data.savedAction = act;
      /* the version being replaced goes to the front of versions (last 10 kept) */
      if (version > 1) {
        var pv = prev.data() || {}, pAt = pv.updatedAt;
        var old = { version: pv.version || version - 1, action: pv.savedAction || (pv.version > 1 ? "update" : "create"), snapshot: clean(pv),
          savedAt: pAt && typeof pAt.toDate === "function" ? pAt.toDate().toISOString() : String(pAt || "") };
        if (typeof pv.restoredFrom === "number") old.restoredFromVersion = pv.restoredFrom;
        data.versions = [old].concat(Array.isArray(pv.versions) ? pv.versions : []).slice(0, MAX_VERSIONS);
      }
      await ref.set(data);
      /* one activity log line, after the save; its failure never undoes the save */
      var logged = false;
      if (f.logActivity) {
        var title = data.titleHe || (data.yahrzeit && data.yahrzeit.nameHe) || data.titleEn || "";
        var lr = await f.logActivity((ACT_HE[act] || "עודכן פריט במסך") + (title ? ": " + title : ""), "", { area: "screen", code: "screenItem." + act,
          target: title, targetId: ref.id, collection: col, itemId: ref.id, version: version });
        logged = !!(lr && lr.saved);
      }
      return { saved: true, id: ref.id, version: version, col: col, logged: logged };
    } catch (e) { return { saved: false, reason: (e && e.code) || String(e && e.message ? e.message : e) }; }
  }
  async function setStatus(item, status) {
    var copy = Object.assign({}, item, { status: status });
    return save(copy, status === "published" ? "publish" : (status === "archived" ? "archive" : "unpublish"));
  }
  /* Versions of one item, newest first: the item itself (the current
     version) and the earlier ones kept in its versions list. The activity
     log is not read (only the super admin may read it). */
  async function history(itemId, col) {
    var d = db(); if (!d) return { ok: false, reason: "not-ready" };
    try {
      var cols = col ? [col] : COLLECTIONS, doc = null;
      for (var i = 0; i < cols.length && !doc; i++) { var g = await d.collection(cols[i]).doc(itemId).get(); if (g.exists) doc = g; }
      if (!doc) return { ok: true, versions: [] };
      var x = doc.data() || {}, at = x.updatedAt;
      var out = [{ itemId: itemId, version: x.version || 1, action: x.savedAction || ((x.version || 1) > 1 ? "update" : "create"), snapshot: clean(x),
        savedAt: at && typeof at.toDate === "function" ? at.toDate().toISOString() : (at || ""), savedBy: x.updatedBy || "",
        restoredFromVersion: typeof x.restoredFrom === "number" ? x.restoredFrom : undefined }];
      (Array.isArray(x.versions) ? x.versions : []).forEach(function (v) {
        if (!v || typeof v.version !== "number" || !v.snapshot) return;
        out.push({ itemId: itemId, version: v.version, action: v.action || "update", snapshot: v.snapshot, savedAt: v.savedAt || "", savedBy: "", restoredFromVersion: v.restoredFromVersion });
      });
      out.sort(function (a, b) { return b.version - a.version; });
      return { ok: true, versions: out };
    } catch (e) { return { ok: false, reason: (e && e.code) || String(e) }; }
  }
  /* Restore = a NEW version whose content is the old snapshot. Nothing
     is overwritten or deleted, so a restore can itself be undone. */
  async function restore(itemId, versionDoc, col) {
    var snap = Object.assign({}, versionDoc.snapshot || {}, { id: itemId, col: col || collectionOf((versionDoc.snapshot || {}).type) });
    return save(snap, "restore", { restoredFromVersion: versionDoc.version });
  }

  /* Image: checked, resized in the browser (max 1920 px), uploaded under
     screen/{type}/{itemId}/. Returns {url, path, w, h}. */
  function resize(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight, s = Math.min(1, MAX_EDGE / Math.max(w, h));
        var cw = Math.round(w * s), ch = Math.round(h * s), c = document.createElement("canvas");
        c.width = cw; c.height = ch; c.getContext("2d").drawImage(img, 0, 0, cw, ch);
        URL.revokeObjectURL(url);
        var type = file.type === "image/png" ? "image/png" : "image/jpeg";
        c.toBlob(function (blob) { blob ? resolve({ blob: blob, w: cw, h: ch, type: type }) : reject(new Error("resize-failed")); }, type, 0.88);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("not-an-image")); };
      img.src = url;
    });
  }
  async function uploadImage(file, type, itemId) {
    var f = fb(); if (!f || !f.user || !window.firebase || !window.firebase.storage) return { ok: false, reason: "not-ready" };
    var role = await f.resolveRole();
    if (!canUpload(role)) return { ok: false, reason: "no-image-permission" };
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return { ok: false, reason: "type" };
    if (file.size > 25 * 1024 * 1024) return { ok: false, reason: "too-big" };
    try {
      var r = await resize(file);
      if (r.blob.size > MAX_IMAGE_BYTES) return { ok: false, reason: "too-big" };
      var ext = r.type === "image/png" ? "png" : "jpg";
      var path = "screen/" + (TYPES.indexOf(type) >= 0 ? type : "flyer") + "/" + (itemId || "new") + "/" + Date.now() + "." + ext;
      var ref = window.firebase.storage().ref(path);
      await ref.put(r.blob, { contentType: r.type, cacheControl: "public, max-age=86400" });
      var url = await ref.getDownloadURL();
      return { ok: true, image: { url: url, path: path, w: r.w, h: r.h } };
    } catch (e) { return { ok: false, reason: (e && e.code) || String(e && e.message ? e.message : e) }; }
  }

  window.OH_SCREEN_CONTENT = {
    TYPES: TYPES, FIELDS: FIELDS, canEdit: canEdit, canUpload: canUpload, clean: clean, validate: validate,
    COLLECTIONS: COLLECTIONS, collectionOf: collectionOf,
    newId: function () { var d = db(); return d ? d.collection("announcements").doc().id : null; },
    subscribe: subscribe, save: save, setStatus: setStatus, history: history, restore: restore, uploadImage: uploadImage,
    cached: cached
  };
})();
