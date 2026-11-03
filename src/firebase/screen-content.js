/* Screen content data layer (Display Engine side), stage v4 2026-11-03.
   Real Firestore paths for everything the gabbai shows on the TV:
     screenItems/{id}                 one item (announcement, dedication,
                                      flyer, yahrzeit, sponsor, parnas,
                                      mazal tov, hazkara, rabbi message,
                                      campaign, donation)
     screenItemHistory/{id}_v{n}      append-only copy of every version
                                      (change history and restore)
     activityLog/{auto}               area "screen", who / when
   Every save is ONE batch: item + history copy + activity line, so a
   version never exists without its history (the rules check this with
   existsAfter / getAfter).
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

  function toItem(doc) {
    var d = doc.data() || {}, o = { id: doc.id };
    Object.keys(d).forEach(function (k) {
      var v = d[k];
      if (v && typeof v.toDate === "function") v = v.toDate().toISOString();
      o[k] = v;
    });
    return o;
  }
  function cache(items) { try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: new Date().toISOString(), items: items })); } catch (e) {} }
  function cached() { try { var c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); return c && c.items ? c : null; } catch (e) { return null; } }

  /* Live subscription. mode: "public" (the /tv/ page, no sign-in:
     published + public only, which is exactly what the rules allow),
     "screen" (signed-in viewer or gabbai on /screen/: all published),
     "editor" (admin: everything, newest first). cb(items, error). */
  function subscribe(mode, cb) {
    var d = db(); if (!d) { cb(null, "not-ready"); return function () {}; }
    var q = d.collection("screenItems");
    if (mode === "public") q = q.where("status", "==", "published").where("visibility", "==", "public");
    else if (mode === "screen") q = q.where("status", "==", "published");
    return q.onSnapshot(function (snap) {
      var items = []; snap.forEach(function (doc) { items.push(toItem(doc)); });
      if (mode !== "editor") cache(items);
      cb(items, null);
    }, function (err) { cb(null, (err && err.code) || String(err)); });
  }

  async function save(item, action, extra) {
    var f = fb(), d = db();
    if (!f || !d || !f.user) return { saved: false, reason: "not-signed-in" };
    var role = await f.resolveRole();
    if (!canEdit(role)) return { saved: false, reason: "no-screen-permission" };
    var data = clean(item), errs = validate(data);
    if (errs.length) return { saved: false, reason: "invalid", errors: errs };
    var ref = item.id ? d.collection("screenItems").doc(item.id) : d.collection("screenItems").doc();
    var ts = fs().FieldValue.serverTimestamp(), email = f.user.email, uid = f.user.uid;
    try {
      var prev = item.id ? await ref.get() : null;
      var version = prev && prev.exists ? ((prev.data().version || 0) + 1) : 1;
      data.version = version;
      data.updatedAt = ts; data.updatedBy = email; data.updatedByUid = uid;
      if (version === 1) { data.createdAt = ts; data.createdBy = email; data.createdByUid = uid; }
      else { var pd = prev.data(); data.createdAt = pd.createdAt; data.createdBy = pd.createdBy; data.createdByUid = pd.createdByUid; }
      if (extra && typeof extra.restoredFromVersion === "number") data.restoredFrom = extra.restoredFromVersion;
      var snapshot = clean(data);
      var hist = { itemId: ref.id, version: version, action: action || (version === 1 ? "create" : "update"), snapshot: snapshot, savedAt: ts, savedBy: email, savedByUid: uid };
      if (extra && typeof extra.restoredFromVersion === "number") hist.restoredFromVersion = extra.restoredFromVersion;
      var b = d.batch();
      b.set(ref, data);
      b.set(d.collection("screenItemHistory").doc(ref.id + "_v" + version), hist);
      b.set(d.collection("activityLog").doc(), { area: "screen", action: "screenItem." + hist.action, itemId: ref.id, itemType: data.type, version: version, who: email, whoUid: uid, when: ts });
      await b.commit();
      return { saved: true, id: ref.id, version: version };
    } catch (e) { return { saved: false, reason: (e && e.code) || String(e && e.message ? e.message : e) }; }
  }
  async function setStatus(item, status) {
    var copy = Object.assign({}, item, { status: status });
    return save(copy, status === "published" ? "publish" : (status === "archived" ? "archive" : "unpublish"));
  }
  async function history(itemId) {
    var d = db(); if (!d) return { ok: false, reason: "not-ready" };
    try {
      var snap = await d.collection("screenItemHistory").where("itemId", "==", itemId).get();
      var out = []; snap.forEach(function (doc) { out.push(toItem(doc)); });
      out.sort(function (a, b) { return b.version - a.version; });
      return { ok: true, versions: out };
    } catch (e) { return { ok: false, reason: (e && e.code) || String(e) }; }
  }
  /* Restore = a NEW version whose content is the old snapshot. Nothing
     is overwritten or deleted, so a restore can itself be undone. */
  async function restore(itemId, versionDoc) {
    var snap = Object.assign({}, versionDoc.snapshot || {}, { id: itemId });
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
    newId: function () { var d = db(); return d ? d.collection("screenItems").doc().id : null; },
    subscribe: subscribe, save: save, setStatus: setStatus, history: history, restore: restore, uploadImage: uploadImage,
    cached: cached
  };
})();
