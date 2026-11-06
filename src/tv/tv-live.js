/* Or Hachaim TV | the living screen (2040 phase 1).
   Loaded by tv/index.html right after or-calendar.min.js (before the
   calendar hooks), so the calendar is loaded ONCE and shared.
   What it adds to the existing screen, without changing any existing
   block: every word from src/tv/tv-texts.js with a gabbai's overrides and the
   block layout (order + show/hide), both from Firestore
   settings/screenTexts LIVE; the day state (src/tv/day-state.js) in the header and a state
   card in the centre, prayer times with rules (src/tv/prayer-rules.js)
   from a LIVE listener (onSnapshot, no reload), the next minyan with a
   countdown, an offline badge, the offline cache (tv/sw.js + local
   storage) and a soft reload once a day at a quiet hour (never on
   Shabbat or Yom Tov). Reads only public data: prayerTimes (public read)
   and the published screen items (screen-content.js, already live).
   All text from the database is escaped. */
(function () {
  "use strict";
  var W = window, C = W.OH_CALENDAR;
  var X = W.OH_TV_TEXTS;
  var SW_ = (X && X.SWITCHES) || {};
  function T(k, v) { return X ? X.t(k, v) : ""; }
  var DS = W.OH_DAYSTATE, PR = W.OH_PRAYER_RULES;
  var params = new URLSearchParams(location.search);
  var EMBED = params.get("embed") === "preview";
  var IN_FRAME = (function () { try { return W.self !== W.top; } catch (e) { return true; } })();
  var PT_CACHE = "orHachaimTvPrayerDocs", SUN_CACHE = "orHachaimTvSunset", RELOAD_KEY = "orHachaimTvReloadedOn", TX_CACHE = "orHachaimTvScreenTexts", SDK_RETRY_KEY = "orHachaimTvSdkRetryAt", DISP_CACHE = "orHachaimTvDisplay", SHEET_CACHE = "orHachaimTvShabbatScreen";
  var st = { cal: null, docs: null, docsFrom: "none", sunset: null, live: false, fromCache: true, lastServerAt: 0, unsub: null, lastSig: "", ds: null, reg: null, offlineSince: 0,
    settings: null, settingsFrom: "none", setUnsub: null, setDeniedAt: 0, settingsError: null, layout: null, textSig: "",
    tvDisplay: { nightDim: false }, tvDispUnsub: null, tvDispDeniedAt: 0,
    sheetWeeks: null, sheetUnsub: null, sheetDeniedAt: 0 };
  W.OH_TV = st; /* read-only view for diagnostics and tests */
  W.OH_TV_DISPLAY = st.tvDisplay; /* screen.js reads this: night dim is on only when nightDim is true */

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function $(id) { return document.getElementById(id); }
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  /* ---------- one shared calendar load ---------- */
  if (C && typeof C.load === "function" && !C.__ohShared) {
    var origLoad = C.load, shared = null;
    C.load = function (o) {
      /* 2040 phase 2: the calendar every part of the screen shares is the engine
         with the Rav's second-night candle ruling applied (day-state.js wrapCalendar). */
      if (!shared) shared = origLoad.call(C, o).then(function (c) { var w = c; try { if (DS && DS.wrapCalendar) w = DS.wrapCalendar(c, zdays); } catch (e) { w = c; } st.cal = w; return w; }, function (e) { shared = null; throw e; });
      return shared;
    };
    C.__ohShared = true;
  }
  function ensureCal() { if (!st.cal && C && C.load) C.load({ base: "../src/" }).catch(function () {}); }

  /* ---------- data: zmanim days, sunset seconds, prayer docs ---------- */
  function zdays() { return W.ROY_JSON && W.ROY_JSON.days ? W.ROY_JSON.days : null; }
  st.sunset = lsGet(SUN_CACHE);
  function loadSunset() {
    fetch("../src/tv/sunset-5787.json").then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (j && j.days) { st.sunset = j.days; lsSet(SUN_CACHE, j.days); paint(true); }
    }).catch(function () {});
  }
  var cachedDocs = lsGet(PT_CACHE);
  /* the admin's live preview (an iframe) waits for the real answer, never shows an old list */
  if (cachedDocs && cachedDocs.docs && !IN_FRAME && !EMBED) { st.docs = cachedDocs.docs; st.docsFrom = "cache"; }
  function cleanDoc(id, d) {
    var o = { id: id, nameHe: d.nameHe || d.nameEn || "", nameEn: d.nameEn || "", time: d.time || "", order: typeof d.order === "number" ? d.order : null };
    if (d.rule && typeof d.rule === "object") {
      o.rule = { kind: d.rule.kind, offsetMin: typeof d.rule.offsetMin === "number" ? d.rule.offsetMin : parseInt(d.rule.offsetMin, 10) || 0, days: d.rule.days || "all" };
      if (typeof d.rule.from === "string") o.rule.from = d.rule.from;
      if (typeof d.rule.until === "string") o.rule.until = d.rule.until;
    }
    return o;
  }
  function startLive() {
    if (st.unsub || EMBED) return;
    var fb = W.OH_FIREBASE; if (!fb || !fb.ready || !fb._db) return;
    var db = fb._db(); if (!db) return;
    try {
      st.unsub = db.collection("prayerTimes").onSnapshot({ includeMetadataChanges: true }, function (snap) {
        var docs = []; snap.forEach(function (doc) { docs.push(cleanDoc(doc.id, doc.data() || {})); });
        st.fromCache = !!(snap.metadata && snap.metadata.fromCache);
        if (!st.fromCache) { st.lastServerAt = Date.now(); st.live = true; }
        /* an empty answer from the local cache only (no server yet) never wipes the last good list */
        if (st.fromCache && !docs.length && st.docs && st.docs.length) { paint(true); return; }
        st.docs = docs; st.docsFrom = st.fromCache ? "sdk-cache" : "server";
        if (!st.fromCache) lsSet(PT_CACHE, { at: new Date().toISOString(), docs: docs });
        paint(true);
      }, function () { st.unsub = null; st.live = false; paint(true); setTimeout(startLive, 15000); });
    } catch (e) { st.unsub = null; }
  }


  /* ---------- words and layout: settings/screenTexts (LIVE) ----------
     { texts: {key: "..."}, textsEn: {key: "..."}, layout: { order: [ids], hidden: [ids] } }
     The TV has one look (Hebrew with small English lines): no language switch.
     Missing doc, a read the rules do not allow yet, or no network: the
     defaults (or the last copy kept on this TV), silently. */
  function objOf(v) { return v && typeof v === "object" && !Array.isArray(v) ? v : {}; }
  function cleanSettings(d) {
    d = objOf(d);
    return { texts: objOf(d.texts), textsEn: objOf(d.textsEn), layout: d.layout && typeof d.layout === "object" ? d.layout : null };
  }
  function applySettings(s) {
    s = cleanSettings(s);
    if (X) { X.setOverrides(s.texts, s.textsEn); document.title = T("pageTitle"); }
    if (document.body) { applyStatic(); applyLayout(s.layout); }
    var sig = X ? X.sig + JSON.stringify(s.layout || null) : "";
    var changed = sig !== st.textSig; st.textSig = sig;
    if (changed && document.body) repaintAll();
  }
  function startSettings() {
    if (st.setUnsub) return;
    if (st.setDeniedAt && Date.now() - st.setDeniedAt < 120000) return; /* not allowed yet: ask again in 2 minutes */
    var fb = W.OH_FIREBASE; if (!fb || !fb.ready || !fb._db) return;
    var db = fb._db(); if (!db) return;
    try {
      st.setUnsub = db.doc("settings/screenTexts").onSnapshot({ includeMetadataChanges: false }, function (snap) {
        var fromCache = !!(snap.metadata && snap.metadata.fromCache);
        var d = snap.exists ? snap.data() : null;
        if (!d && fromCache) return; /* nothing known yet: keep the defaults or the kept copy */
        var s = cleanSettings(d);
        st.settings = s; st.settingsFrom = fromCache ? "sdk-cache" : "server"; st.settingsError = null;
        if (!fromCache) lsSet(TX_CACHE, s);
        applySettings(s);
      }, function (err) {
        /* permission-denied until the public read rule is deployed: defaults, no noise */
        st.setUnsub = null; st.setDeniedAt = Date.now(); st.settingsError = (err && err.code) || "error";
      });
    } catch (e) { st.setUnsub = null; st.setDeniedAt = Date.now(); }
  }
  /* ---------- the Shabbat package's times: settings/shabbatScreen (LIVE) ----------
     Hanoch Nov 7: { weeks: { "<shabbat iso>": { friday, rows: [{ he, en, time, min, day }] } } },
     written by gabbai/shabbat/ ("הצג בזמני התפילות במסך"). On that Friday afternoon
     and Shabbat the TV shows these rows INSTEAD of the regular davening times
     (prayer-rules.js ctx.sheet). Public read; kept on this TV for an offline start. */
  st.sheetWeeks = lsGet(SHEET_CACHE);
  function startSheet() {
    if (st.sheetUnsub) return;
    if (st.sheetDeniedAt && Date.now() - st.sheetDeniedAt < 120000) return;
    var fb = W.OH_FIREBASE; if (!fb || !fb.ready || !fb._db) return;
    var db = fb._db(); if (!db) return;
    try {
      st.sheetUnsub = db.doc("settings/shabbatScreen").onSnapshot({ includeMetadataChanges: false }, function (snap) {
        var fromCache = !!(snap.metadata && snap.metadata.fromCache);
        var d = snap.exists ? snap.data() : null;
        if (!d && fromCache) return;
        st.sheetWeeks = d && d.weeks && typeof d.weeks === "object" ? d.weeks : {};
        if (!fromCache) lsSet(SHEET_CACHE, st.sheetWeeks);
        paint(true);
      }, function () { st.sheetUnsub = null; st.sheetDeniedAt = Date.now(); });
    } catch (e) { st.sheetUnsub = null; st.sheetDeniedAt = Date.now(); }
  }
  /* this Shabbat's package times, if the gabbai put them on the screen: iso is today (New York) */
  function sheetFor(iso) {
    var w = st.sheetWeeks; if (!w) return null;
    for (var k in w) {
      var e = w[k]; if (!e || !Array.isArray(e.rows) || typeof e.friday !== "string") continue;
      if (iso >= e.friday && iso <= k) return { friday: e.friday, shabbat: k, rows: e.rows };
    }
    return null;
  }
  /* ---------- night dim: settings/tvDisplay (LIVE) ----------
     { nightDim: true/false, updatedBy, updatedAt }, super admin only.
     Off by default (Hanoch Nov 6 2026): a missing document, a missing
     field, or no answer yet all mean lit, never dimmed. screen.js reads
     W.OH_TV_DISPLAY.nightDim on every tick, so a change lands within a
     second with no reload. Same shape as startSettings above. */
  function startTvDisplay() {
    if (st.tvDispUnsub) return;
    if (st.tvDispDeniedAt && Date.now() - st.tvDispDeniedAt < 120000) return; /* not allowed yet: ask again in 2 minutes */
    var fb = W.OH_FIREBASE; if (!fb || !fb.ready || !fb._db) return;
    var db = fb._db(); if (!db) return;
    var cached = lsGet(DISP_CACHE);
    if (cached && cached.nightDim === true) { st.tvDisplay.nightDim = true; W.OH_TV_DISPLAY = st.tvDisplay; }
    try {
      st.tvDispUnsub = db.doc("settings/tvDisplay").onSnapshot({ includeMetadataChanges: false }, function (snap) {
        var fromCache = !!(snap.metadata && snap.metadata.fromCache);
        var d = snap.exists ? snap.data() : null;
        if (!d && fromCache) return; /* nothing known yet: keep the last known value, off by default */
        st.tvDisplay.nightDim = !!(d && d.nightDim === true);
        W.OH_TV_DISPLAY = st.tvDisplay;
        if (!fromCache) lsSet(DISP_CACHE, { nightDim: st.tvDisplay.nightDim });
      }, function (err) {
        /* permission-denied until the public read rule is deployed: lit, no noise */
        st.tvDispUnsub = null; st.tvDispDeniedAt = Date.now();
      });
    } catch (e) { st.tvDispUnsub = null; st.tvDispDeniedAt = Date.now(); }
  }
  /* the gabbai editor's preview (same site) can show a draft before saving */
  W.addEventListener("message", function (e) {
    if (e.origin !== location.origin || !e.data || e.data.type !== "oh-tv-settings-preview") return;
    st.settingsFrom = "preview-message"; applySettings(e.data.settings || {});
  });
  /* static words of tv/index.html: data-tt="key", data-tp="p" (main line) | "s" (second line) | "j" (both, " / ") */
  function applyStatic() {
    if (!X) return;
    var els = document.querySelectorAll("[data-tt]");
    for (var i = 0; i < els.length; i++) {
      var el = els[i], q = X.pair(el.getAttribute("data-tt")), tp = el.getAttribute("data-tp") || "p";
      var v = tp === "s" ? q.s : (tp === "j" ? (q.s ? q.p + " / " + q.s : q.p) : q.p);
      if (el.getAttribute("data-tt-once") === "1" && el.getAttribute("data-tt-done") === "0") continue; /* replaced by the screen already */
      if (el.textContent !== v) el.textContent = v;
    }
  }
  function repaintAll() {
    try { paint(true); } catch (e) {}
    try { if (typeof W.renderZmanim === "function") W.renderZmanim(); } catch (e) {}
    try { if (typeof W.renderZone === "function") W.renderZone(); } catch (e) {}
    try { if (typeof W.updateOfflineNote === "function") W.updateOfflineNote(); } catch (e) {}
    try { var tg = $("shabbatToggle"); if (tg) { var tq = X.pair(document.body.classList.contains("shabbat") ? "shabbatPreviewExitBtn" : "shabbatPreviewBtn"); tg.textContent = tq.s ? tq.p + " / " + tq.s : tq.p; } } catch (e) {}
  }
  /* ---------- layout: order, hidden, sizes of the blocks ---------- */
  var BLOCK_EL = { header: [".tv > header"], zmanim: [".col-zmanim"], center: [".col-center"], prayers: [".col-prayers"], shabbat: ["#shabbatBlock"],
    stateCard: ["#dsCard"], insertions: ["#insStrip"], nextZman: ["#nextHero"], board: [".col-center > .board-title", "#centerZone", "#boardIndex"],
    nextMinyan: ["#nextMinyan"], ticker: ["#ticker", ".tv footer .ornament"] };
  var COL_FR = { zmanim: 1, center: 1.14, prayers: 1 }, SIZE_MULT = { s: 0.8, m: 1, l: 1.3 }, ZOOM = { s: 0.86, m: 1, l: 1.16 };
  function applyLayout(lay) {
    if (!X) return;
    lay = lay && typeof lay === "object" ? lay : {};
    var known = {}, def = X.TV_BLOCKS.map(function (b) { known[b.id] = b; return b.id; });
    var order = [];
    (Array.isArray(lay.order) ? lay.order : []).forEach(function (id) { if (known[id] && order.indexOf(id) < 0) order.push(id); });
    def.forEach(function (id) { if (order.indexOf(id) < 0) order.push(id); }); /* unknown ids ignored, missing ones appended */
    var hidden = {}; (Array.isArray(lay.hidden) ? lay.hidden : []).forEach(function (id) { if (known[id]) hidden[id] = true; });
    var sizes = {}; /* sizes are not offered (Hanoch, 5:47: order and show/hide only); the field is ignored */
    var rank = {}; order.forEach(function (id, i) { rank[id] = i; });
    var areaPos = {};
    ["columns", "center", "zmanim", "prayers", "header", "footer"].forEach(function (area) {
      order.filter(function (id) { return known[id].area === area; }).forEach(function (id, i) { areaPos[id] = i; });
    });
    Object.keys(BLOCK_EL).forEach(function (id) {
      BLOCK_EL[id].forEach(function (sel, sub) {
        var el = document.querySelector(sel); if (!el) return;
        el.classList.toggle("oh-hide", !!hidden[id]);
        var a = known[id] && known[id].area;
        if (a === "center" || a === "columns") el.style.order = String(areaPos[id] * 10 + sub);
        else el.style.order = "";
        if (a !== "columns") el.style.zoom = sizes[id] && sizes[id] !== "m" ? String(ZOOM[sizes[id]]) : "";
      });
    });
    /* inside a column: a block listed BEFORE its column's id goes on top of that column, after it at the bottom
       (when not both listed: today's place, the Shabbat block under the zmanim, the next minyan above the davening times) */
    var zl = $("zmanList"), sbk = $("shabbatBlock"), pb = $("prayerBody"), nm = $("nextMinyan");
    /* only when the gabbai listed both ids; otherwise today's place */
    var listed = Array.isArray(lay.order) ? lay.order : [];
    function firstIn(sub, col, dflt) { var i = listed.indexOf(sub), j = listed.indexOf(col); return i >= 0 && j >= 0 ? i < j : dflt; }
    if (zl && sbk) { var sbFirst = firstIn("shabbat", "zmanim", false); zl.style.order = sbFirst ? "2" : "1"; sbk.style.order = sbFirst ? "1" : "2"; }
    if (pb && nm) { var nmFirst = firstIn("nextMinyan", "prayers", true); nm.style.order = nmFirst ? "1" : "3"; pb.style.order = "2"; }
    /* the three panels: visible ones in order, widths by size */
    var main = document.querySelector(".tv main");
    if (main) {
      var cols = order.filter(function (id) { return known[id].area === "columns" && !hidden[id]; });
      var fr = cols.map(function (id) { return (COL_FR[id] * SIZE_MULT[sizes[id] || "m"]).toFixed(2) + "fr"; });
      var isDefault = !Object.keys(hidden).length && !Object.keys(sizes).length && order.join() === def.join();
      main.style.setProperty("--oh-cols", fr.join(" ") || "1fr");
      main.classList.toggle("oh-layout", !isDefault);
    }
    var h = []; Object.keys(hidden).forEach(function (k) { h.push(k); });
    st.layout = { order: order, hidden: h, sizes: sizes };
    document.body.dataset.layout = isDefault ? "default" : "custom";
  }
  /* the old copy kept on this TV, before anything is painted (the screen's scripts run after this file) */
  st.settings = lsGet(TX_CACHE); st.settingsFrom = st.settings ? "cache" : "none";
  applySettings(st.settings || {});

  /* ---------- painting ---------- */
  function isYomTovIso(iso) { try { var d = st.cal && st.cal.day(iso); return !!(d && (d.isYomTov || d.isYomKippur)); } catch (e) { return false; } }
  /* the gabbai's own name of a prayer, in the screen language */
  function nameMain(r) { return r.nameHe || r.nameEn || ""; }
  function rowHtml(r, isNext) {
    return '<div class="zman-row' + (isNext ? " next" : "") + (r.rule ? " has-rule" : "") + '" data-id="' + esc(r.id) + '"><span class="zn"><span class="he">' + esc(r.nameHe) + '</span><span class="en">' + esc(r.nameEn) + '</span></span><span class="zt" dir="ltr">' + esc(String(r.time || "").replace(/\s*[AaPp]\.?[Mm]\.?$/, "")) + "</span></div>"; /* Hanoch Nov 7: no AM/PM, like every other time on the screen */
  }
  function paintPrayers(now, ds) {
    var el = $("prayerList"); if (!el) return;
    if (!st.docs) return; /* nothing yet: keep what is there */
    var docs = st.docs;
    var ctx = { zdays: zdays() || {}, sunsetRaw: st.sunset || {}, isYomTov: isYomTovIso };
    var p = DS.nyParts(now);
    var shabbatStarted = !!(ds && ds.key === "shabbat" && p.wd === 5);
    var nextIso = DS.addDays(p.iso, 1);
    ctx.shabbatStarted = shabbatStarted; ctx.nextIso = nextIso;
    ctx.sheet = sheetFor(p.iso) || sheetFor(nextIso);
    var rows = PR.resolve(docs, p.iso, ctx);
    var tomorrowRows = PR.resolve(docs, nextIso, { zdays: ctx.zdays, sunsetRaw: ctx.sunsetRaw, isYomTov: isYomTovIso, sheet: ctx.sheet });
    var nx = PR.nextMinyan(rows, p.iso, p.minExact, shabbatStarted ? null : tomorrowRows);
    if (nx && nx.row && nx.row.min != null) nx.minutes = Math.max(0, DS.minutesUntil(now, nx.tomorrow && !nx.row.iso ? nextIso : (nx.row.iso || p.iso), nx.row.min));
    var html;
    if (!rows.length) html = "<p>" + esc(T("noPrayerTimes")) + "</p>";
    else {
      var lastGroup = null, parts = [];
      rows.forEach(function (r) {
        if (shabbatStarted && r.group !== lastGroup) { parts.push('<div class="pt-group">' + esc(T(r.group === "shabbat" ? "groupShabbat" : "groupFridayNight")) + "</div>"); lastGroup = r.group; }
        parts.push(rowHtml(r, !!(nx && !nx.tomorrow && nx.row === r) || !!(nx && shabbatStarted && nx.row === r)));
      });
      html = parts.join("");
    }
    if (el.innerHTML !== html) el.innerHTML = html;
    var nm = $("nextMinyan");
    if (nm) {
      var show = !!(nx && SW_.nextMinyanCountdown !== false);
      var t = show ? '<span class="nm-label">' + esc(T("nextMinyan")) + '</span><span class="nm-name">' + esc(nameMain(nx.row)) + (nx.tomorrow && !shabbatStarted ? " " + esc(T("nextMinyanTomorrow")) : "") + '</span><span class="nm-time" dir="ltr">' + esc(nx.row.time.replace(/\s?[AP]M$/, "")) + '</span><span class="nm-cd">' + esc(DS.countdownText(T, nx.minutes)) + "</span>" : "";
      if (nm.innerHTML !== t) nm.innerHTML = t;
      nm.hidden = !show;
    }
    st.rows = rows; st.next = nx;
  }
  function cardHtml(ds) {
    var c = ds.card, chips = ds.chips || [];
    /* the insertions strip already prints the Omer count in full: no second copy */
    var ins = $("insStrip");
    if (ins && !ins.hidden && ins.querySelector(".ins-omer")) chips = chips.filter(function (x) { return x.key !== "omer"; });
    if (!c && !chips.length) return "";
    var h = "";
    if (c) {
      h += '<div class="ds-card-head"><span class="ds-card-title">' + esc(c.title) + "</span>";
      if (c.countdown) h += '<span class="ds-card-time" dir="ltr">' + esc(c.countdown.time) + "</span>";
      h += "</div>";
      if (c.countdown && c.countdown.text) h += '<div class="ds-card-cd">' + esc(c.countdown.text) + "</div>";
      if (c.candles) { var cs = ""; for (var i = 0; i < Math.min(8, c.candles); i++) cs += '<span class="cnd"></span>'; h += '<div class="ds-candles" aria-hidden="true">' + cs + '<span class="cnd shamash"></span></div>'; }
      var lines = (c.lines || []).filter(function (l) { return !(c.countdown && l.he === c.countdown.label); });
      if (lines.length) h += '<ul class="ds-lines">' + lines.map(function (l) { return "<li><span>" + esc(l.he) + "</span>" + (l.time ? '<b dir="ltr">' + esc(l.time) + "</b>" : "") + "</li>"; }).join("") + "</ul>";
    }
    if (chips.length) h += '<div class="ds-chips">' + chips.map(function (x) { return '<span class="ds-chip k-' + esc(x.key) + (x.big ? " big" : "") + '">' + esc(x.he) + (x.time ? ' <b dir="ltr">' + esc(x.time) + "</b>" : "") + "</span>"; }).join("") + "</div>";
    return h;
  }
  var lastKey = "";
  function paint(force) {
    if (document.body.classList.contains("gated")) return;
    var now = new Date();
    var ds = null;
    if (st.cal && DS) {
      try { ds = DS.compute(now, st.cal, { zdays: zdays() || {}, t: T, switches: SW_ }); } catch (e) { ds = null; }
    }
    st.ds = ds;
    if (ds) {
      var cls = "ds-" + ds.key + " tone-" + ds.tone;
      if (lastKey !== cls) {
        document.body.className = document.body.className.replace(/\b(ds|tone)-[a-z-]+\b/g, "").trim();
        cls.split(" ").forEach(function (c) { document.body.classList.add(c); });
        lastKey = cls;
      }
      document.body.dataset.dayState = ds.key;
      document.body.dataset.dayKeys = (ds.keys || []).join(" ");
      var tEl = $("dsTitle");
      if (tEl) {
        var title = ds.title ? esc(ds.title) + (ds.sub && ds.sub.length ? '<span class="ds-sub">' + esc(ds.sub.join(" | ")) + "</span>" : "") : "";
        if (tEl.innerHTML !== title) tEl.innerHTML = title;
        tEl.hidden = !title;
        document.body.classList.toggle("has-ds-title", !!title);
      }
      var card = $("dsCard");
      if (card) {
        var ch = cardHtml(ds);
        if (card.innerHTML !== ch) card.innerHTML = ch;
        card.hidden = !ch;
        card.className = "ds-card" + (ds.card ? " k-" + ds.card.kind : " only-chips");
      }
    }
    paintPrayers(now, ds);
    paintFocus(ds);
    paintOffline();
  }
  /* one highlighted thing at a time: the countdown card, else the next minyan within the hour, else the next zman */
  function paintFocus(ds) {
    var nx = st.next, f = "zman";
    if (ds && ds.card && ds.card.countdown && ds.card.countdown.text) f = "card";
    else if (nx && !nx.tomorrow && nx.minutes != null && nx.minutes <= 60 && SW_.nextMinyanCountdown !== false) f = "minyan";
    if (st.focus !== f) {
      ["card", "minyan", "zman"].forEach(function (k) { document.body.classList.toggle("focus-" + k, k === f); });
      st.focus = f;
    }
  }

  /* ---------- offline badge ---------- */
  function isOffline() {
    if (navigator.onLine === false) return true;
    /* the listener answers only from the local cache for a while: treat as offline */
    if (st.unsub && st.fromCache && st.lastServerAt && Date.now() - st.lastServerAt > 30000) return true;
    return false;
  }
  function paintOffline() {
    var b = $("ohOffline"); if (!b) return;
    var off = isOffline();
    if (b.hidden === off) { b.hidden = !off; }
    if (off && b.textContent !== T("offlineBadge")) b.textContent = T("offlineBadge");
    document.body.classList.toggle("tv-offline", off);
  }
  W.addEventListener("online", function () { paint(true); if (!st.unsub) startLive(); try { if (st.reg) st.reg.update(); } catch (e) {} });
  W.addEventListener("offline", function () { paint(true); });

  /* ---------- service worker (offline cache), only for the real TV page ---------- */
  function registerSW() {
    if (EMBED || IN_FRAME || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("sw.js", { scope: "./" }).then(function (reg) { st.reg = reg; }).catch(function () {});
    /* once the worker runs: hand it every file this page has used (the Firebase SDK from
       the CDN, calendar data), so the next start with no network has all of them */
    navigator.serviceWorker.ready.then(function (reg) {
      setTimeout(function () {
        try {
          var urls = (performance.getEntriesByType("resource") || []).map(function (e) { return e.name; }).filter(function (u) {
            return /^https:\/\/www\.gstatic\.com\/firebasejs\//.test(u) || (u.indexOf(location.origin + "/") === 0 && !/google\.firestore|\/__\/|[?&]VER=/.test(u));
          });
          urls.push(location.href.split("#")[0]);
          if (reg.active) reg.active.postMessage({ type: "warm", urls: urls });
        } catch (e) {}
      }, 4000);
    }).catch(function () {});
  }
  /* the TV started with no network and the Firebase SDK could not load: once the network
     is back, reload ONCE (at most every 10 minutes) so the live data comes back by itself */
  function sdkWatch() {
    if (EMBED || IN_FRAME || !navigator.onLine) return;
    if (W.firebase && W.firebase.firestore) return;
    if (performance.now() < 20000) return;
    var last = Number(lsGet(SDK_RETRY_KEY) || 0);
    if (Date.now() - last < 600000) return;
    lsSet(SDK_RETRY_KEY, String(Date.now()));
    try { location.reload(); } catch (e) {}
  }

  /* ---------- soft reload once a day at a quiet hour ---------- */
  function maybeDailyReload() {
    if (EMBED || IN_FRAME || SW_.dailyReload === false) return;
    if (!navigator.onLine) return;
    var p = DS.nyParts(new Date()), at = DS.hm(SW_.dailyReloadAt || "03:30");
    if (p.min < at || p.min > at + 20) return;
    var ds = st.ds;
    if (!ds || ds.hidePayments || /^(shabbat|yomtov|yomkippur)$/.test(ds.key)) return; /* never on Shabbat or Yom Tov */
    try { if (C && C.isRestTime && C.isRestTime(new Date())) return; } catch (e) { return; }
    if (lsGet(RELOAD_KEY) === p.iso) return;
    lsSet(RELOAD_KEY, p.iso);
    var go = function () { try { location.reload(); } catch (e) {} };
    try { if (st.reg) { st.reg.update().then(function () { setTimeout(go, 1500); }, go); return; } } catch (e) {}
    go();
  }

  /* ---------- start ---------- */
  function boot() {
    ensureCal(); loadSunset(); registerSW();
    applySettings(st.settings || {}); /* the static words and the layout, now that the page is there */
    paint(true);
    setInterval(function () { ensureCal(); startLive(); startSettings(); startTvDisplay(); startSheet(); paint(false); }, 1000);
    setInterval(function () { maybeDailyReload(); sdkWatch(); }, 30000);
    W.addEventListener("online", function () { setTimeout(sdkWatch, 3000); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
