/* Or Hachaim | 2040 phase 2 | "דף הנחיתה": every word on the public landing page,
   Hebrew and English, editable by the super admin only (admin/home-texts-editor.js).
   Hanoch, 2026-11-04 7:19 AM ("edit the landing page at any moment, super admin only,
   Hebrew and English") and 9:08 AM (design and technical texts: super admin only).
   The same simple editor as the screen wording: search, a list in groups, tap a line,
   edit Hebrew and English, save, "back to the default" per line, live preview.
   Defaults: window.OH_HOME_TEXTS (src/home/home-texts.js, owned by the landing page).
   Its shape (the landing page's file, 2040 phase 2):
     { he: {key: "..."}, en: {key: "..."}, info: {key: {desc, group, shared}}, groups: [{id, he, en}] }
   The editable lines are the keys of info, grouped in the groups order. A shared line
   (phone, email, address) has ONE language-neutral value, saved in texts only.
   Older shapes still work: no info = every he/en key; or { key: { he, en, desc, group } }.
   Saved to the public document settings/homeTexts = { texts, textsEn, updatedBy, updatedAt }
   (the shared contract): the landing page lays every non-empty value over its default.
   Preview without saving: postMessage({type:"oh-home-texts-preview", texts, textsEn})
   to the same-origin frame of the landing page. Plain text only, up to 300 characters. */
(function () {
  "use strict";
  var DEF = {
    htTitle: "דף הנחיתה", htSub: "כל מילה בדף הבית של האתר, בעברית ובאנגלית. משנים, שומרים ורואים מיד.",
    htSearch: "חיפוש מילה או תיאור", htSave: "שמור", htReset: "חזרה לברירת מחדל", htChanged: "שונה",
    htDefault: "ברירת מחדל:", htSaving: "שומר...", htSaved: "נשמר ✓ מופיע עכשיו בדף הנחיתה", htResetDone: "חזר לברירת המחדל ✓",
    htTooLong: "עד 300 תווים", htNoHtml: "רק טקסט רגיל, בלי הסימנים < >",
    htFailed: "השמירה נכשלה, שום דבר לא השתנה. נסו שוב", htDenied: "אין הרשאה לשנות את דף הנחיתה",
    htNoList: "רשימת המילים של דף הנחיתה עוד לא עלתה לאתר", htNoResults: "לא נמצא",
    htPreview: "כך זה נראה בדף הנחיתה", htOpen: "פתח את דף הנחיתה בחלון חדש", htOther: "כללי",
    htHe: "עברית", htEn: "English", htBoth: "עברית ו-English (אותו דבר בשתי השפות)", htEmptyHides: "שדה ריק = השורה לא מוצגת בשפה הזו"
  };
  function L(k) { var o = window.OH_LABELS || {}; return (o[k] !== undefined && o[k] !== null && o[k] !== "") ? o[k] : DEF[k]; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function $(id) { return document.getElementById(id); }
  function isMap(v) { return !!v && typeof v === "object" && !Array.isArray(v); }
  var S = { pvLang: "he", open: null, role: null, texts: {}, textsEn: {}, q: "", msg: {}, draft: {}, busy: false, built: false, model: null };
  var KEY_RE = /^[A-Za-z0-9_.-]{1,80}$/;
  var SKIP = { contact: 1, he: 1, en: 1, info: 1, desc: 1, descriptions: 1, groups: 1, meta: 1, INFO: 1, GROUPS: 1, order: 1 };

  /* -> { keys:[...], he:{k}, en:{k}, desc:{k}, group:{k} } from whatever shape the landing file has */
  function model() {
    var raw = window.OH_HOME_TEXTS, M = { keys: [], he: {}, en: {}, desc: {}, group: {}, groupEn: {}, descEn: {}, shared: {}, gOrder: [], gName: {} };
    if (!isMap(raw)) return M;
    var pack = isMap(raw.HOME_TEXTS) ? raw.HOME_TEXTS : isMap(raw.TEXTS) ? raw.TEXTS : raw;
    var seen = {};
    function add(k) { if (!seen[k] && KEY_RE.test(k)) { seen[k] = 1; M.keys.push(k); } }
    function meta(k, i) {
      if (typeof i === "string") { M.desc[k] = M.desc[k] || i; return; }
      if (!isMap(i)) return;
      var d = i.desc || i.description || i.d || (typeof i.he === "string" ? i.he : "") || "";
      if (d && !M.desc[k]) M.desc[k] = String(d);
      if ((i.descEn || i.enDesc) && !M.descEn[k]) M.descEn[k] = String(i.descEn || i.enDesc);
      var g = i.group || i.g || i.section;
      if (g && !M.group[k]) M.group[k] = String(g);
      if (i.groupEn && !M.groupEn[k]) M.groupEn[k] = String(i.groupEn);
    }
    if (isMap(pack.he) || isMap(pack.en)) {
      /* shape 1 (the landing page's file, 2040 phase 2): two language maps, plus
         info: {key: {desc, group, shared}} (the editable keys) and groups: [{id, he, en}] */
      var he = isMap(pack.he) ? pack.he : {}, en = isMap(pack.en) ? pack.en : {};
      var info = isMap(pack.info) ? pack.info : isMap(raw.info) ? raw.info : null;
      if (info) Object.keys(info).forEach(function (k) { add(k); if (typeof he[k] === "string") M.he[k] = he[k]; if (typeof en[k] === "string") M.en[k] = en[k]; meta(k, info[k]); if (isMap(info[k]) && info[k].shared) M.shared[k] = true; });
      else {
        Object.keys(he).forEach(function (k) { if (typeof he[k] === "string") { add(k); M.he[k] = he[k]; } });
        Object.keys(en).forEach(function (k) { if (typeof en[k] === "string") { add(k); M.en[k] = en[k]; } });
      }
      ["desc", "descriptions", "INFO", "meta"].forEach(function (n) { var o = isMap(pack[n]) ? pack[n] : isMap(raw[n]) ? raw[n] : null; if (o) Object.keys(o).forEach(function (k) { meta(k, o[k]); }); });
      var gs = pack.groups || raw.groups;
      if (Array.isArray(gs)) gs.forEach(function (g) { if (isMap(g) && g.id != null) { M.gOrder.push(String(g.id)); M.gName[String(g.id)] = { he: g.he || String(g.id), en: g.en || g.he || String(g.id) }; } });
      else if (isMap(gs)) Object.keys(gs).forEach(function (g) { var v = gs[g]; if (Array.isArray(v)) v.forEach(function (k) { if (!M.group[k]) M.group[k] = g; }); else if (typeof v === "string" && !M.group[g]) M.group[g] = v; });
    } else {
      /* shape 2: one entry per key */
      Object.keys(pack).forEach(function (k) {
        if (SKIP[k]) return;
        var v = pack[k];
        if (typeof v === "string") { add(k); M.he[k] = v; return; }
        if (!isMap(v) || (typeof v.he !== "string" && typeof v.en !== "string")) return;
        add(k);
        if (typeof v.he === "string") M.he[k] = v.he;
        if (typeof v.en === "string") M.en[k] = v.en;
        var d = v.desc || v.description || v.info || v.d;
        if (d) M.desc[k] = isMap(d) ? String(d.he || "") : String(d);
        if (v.descEn) M.descEn[k] = String(v.descEn);
        if (v.group || v.g) M.group[k] = String(v.group || v.g);
        if (v.groupEn) M.groupEn[k] = String(v.groupEn);
        if (v.shared) M.shared[k] = true;
      });
    }
    return M;
  }
  function Mo() { if (!S.model) S.model = model(); return S.model; }
  function def(k, lang) { var m = Mo()[lang === "en" ? "en" : "he"]; return m[k] == null ? "" : String(m[k]); }
  function desc(k) {
    var M = Mo();
    if (window.OH_LANG === "en") return M.descEn[k] || def(k, "en") || M.desc[k] || k;
    return M.desc[k] || def(k, "he") || k;
  }
  function has(map, k) { return map[k] != null && map[k] !== ""; }
  function shared(k) { return !!Mo().shared[k]; }
  function cur(k, lang) { if (shared(k)) lang = "he"; var dr = S.draft[k]; if (dr && typeof dr[lang] === "string") return dr[lang]; var m = lang === "en" ? S.textsEn : S.texts; return has(m, k) ? m[k] : def(k, lang); }
  function check(val) {
    var v = String(val == null ? "" : val);
    if (v.length > 300) return { err: L("htTooLong") };
    if (/[<>]/.test(v)) return { err: L("htNoHtml") };
    return {};
  }

  function build() {
    var sec = $("htSection"); if (!sec || S.built) return;
    S.built = true;
    sec.classList.add("ohx", "tt", "ht");
    sec.innerHTML = '<div class="x-card"><div class="cb-head"><h2 id="htHeading">' + esc(L("htTitle")) + '</h2><span class="oh-help">' + esc(L("htSub")) + "</span></div>" +
      '<div class="tt-grid"><div class="tt-main">' +
      '<input class="tt-search" id="htSearch" type="search" placeholder="' + esc(L("htSearch")) + '" aria-label="' + esc(L("htSearch")) + '">' +
      '<div id="htList" class="tt-list"></div></div>' +
      '<div class="tt-side"><div class="tt-pv-head"><b>' + esc(L("htPreview")) + '</b><a href="../" target="_blank" rel="noopener">' + esc(L("htOpen")) + '</a></div><div class="tt-pv ht-pv" id="htPv"><iframe id="htFrame" title="' + esc(L("htPreview")) + '" src="about:blank"></iframe></div></div></div></div>';
    $("htSearch").addEventListener("input", function () { S.q = this.value.trim(); renderList(); });
    sec.addEventListener("click", onClick);
    sec.addEventListener("input", function (e) { var i = e.target.closest && e.target.closest("[data-ht-in]"); if (!i) return; var dk = i.getAttribute("data-ht-in"); (S.draft[dk] = S.draft[dk] || {})[i.getAttribute("data-lang")] = i.value; if (!shared(dk)) S.pvLang = i.getAttribute("data-lang"); preview(); });
    sec.addEventListener("focusin", function (e) { var i = e.target.closest && e.target.closest("[data-ht-in]"); if (!i || shared(i.getAttribute("data-ht-in"))) return; var l = i.getAttribute("data-lang"); if (l !== S.pvLang) { S.pvLang = l; preview(); } });
    var hf = $("htFrame"); if (hf) hf.addEventListener("load", function () { preview(); });
    fit(); window.addEventListener("resize", fit);
  }
  var PW = 1280, PH = 1500;
  function fit() { var pv = $("htPv"), f = $("htFrame"); if (!pv || !f) return; var w = pv.clientWidth; if (w) { f.style.transform = "scale(" + (w / PW) + ")"; pv.style.height = Math.round(w * PH / PW) + "px"; } }
  function msgHtml(m, attr) { return m ? '<div class="cb-msg ' + m.kind + '"' + (attr || "") + '><div class="grow"><b>' + esc(m.text) + "</b></div></div>" : ""; }
  function groupsOf(list) {
    var M = Mo(), g = {}, order = [];
    list.forEach(function (k) { var id = M.group[k] || ""; if (!g[id]) { g[id] = []; order.push(id); } g[id].push(k); });
    /* the landing page's own group order first, then any other group as it comes */
    order.sort(function (a, b) { var ia = M.gOrder.indexOf(a), ib = M.gOrder.indexOf(b); return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib); });
    return order.map(function (id) {
      var nm = M.gName[id], en = window.OH_LANG === "en";
      var name = nm ? (en ? nm.en : nm.he) : ((en && M.groupEn[(g[id] || [])[0]]) || id || L("htOther"));
      return { name: name, keys: g[id] };
    });
  }
  function field(k, lang) {
    var ov = has(lang === "en" ? S.textsEn : S.texts, k), d = def(k, lang), long = Math.max(cur(k, lang).length, d.length) > 70;
    var attrs = ' class="tt-in' + (long ? " ht-long" : "") + '" maxlength="300" data-ht-in="' + esc(k) + '" data-lang="' + lang + '" lang="' + lang + '" dir="' + (lang === "en" ? "ltr" : "rtl") + '"';
    var lab = shared(k) ? L("htBoth") : L(lang === "en" ? "htEn" : "htHe");
    return '<label class="tt-f' + (shared(k) ? " ht-shared" : "") + '" dir="' + (lang === "en" ? "ltr" : "rtl") + '"><span class="tt-fl">' + esc(lab) + (ov ? ' <i class="tt-badge">' + esc(L("htChanged")) + "</i>" : "") + "</span>" +
      (long ? "<textarea" + attrs + ' rows="4">' + esc(cur(k, lang)) + "</textarea>" : '<input type="text"' + attrs + ' value="' + esc(cur(k, lang)) + '">') +
      (ov ? '<span class="tt-def">' + esc(L("htDefault")) + " " + esc(d) + "</span>" : "") + "</label>";
  }
  function renderList() {
    var box = $("htList"); if (!box) return;
    var ks = Mo().keys;
    if (!ks.length) { box.innerHTML = '<p class="tt-none" id="htNoList">' + esc(L("htNoList")) + "</p>"; return; }
    var q = S.q.toLowerCase();
    var shown = ks.filter(function (k) {
      if (!q) return true;
      return [k, Mo().desc[k], cur(k, "he"), cur(k, "en"), def(k, "he"), def(k, "en")].some(function (x) { return String(x || "").toLowerCase().indexOf(q) >= 0; });
    });
    if (!shown.length) { box.innerHTML = '<p class="tt-none">' + esc(L("htNoResults")) + "</p>"; return; }
    var ae = document.activeElement, fk = ae && ae.getAttribute && ae.getAttribute("data-ht-in"), fl = fk && ae.getAttribute("data-lang");
    box.innerHTML = groupsOf(shown).map(function (g) {
      return '<section class="tt-group"><h3>' + esc(g.name) + "</h3>" + g.keys.map(function (k) {
        var ov = has(S.texts, k) || has(S.textsEn, k), open = S.open === k;
        var head = '<button type="button" class="tt-tap" data-ht-open="' + esc(k) + '" aria-expanded="' + open + '"><span class="tt-desc"><b>' + esc(desc(k)) + "</b>" + (ov ? '<i class="tt-badge">' + esc(L("htChanged")) + "</i>" : "") + "</span>" +
          '<span class="tt-cur">' + esc(cur(k, "he")) + "</span>" + (shared(k) ? "" : '<span class="tt-cur en" dir="ltr">' + esc(cur(k, "en")) + "</span>") + "</button>";
        var body = open ? '<div class="tt-fields">' + field(k, "he") + (shared(k) ? "" : field(k, "en")) + "</div>" +
          '<div class="tt-acts"><button type="button" class="x-btn primary small" data-ht-save="' + esc(k) + '">' + esc(L("htSave")) + "</button>" + (ov ? '<button type="button" class="x-btn ghost small" data-ht-reset="' + esc(k) + '">' + esc(L("htReset")) + "</button>" : "") + "</div>" : "";
        return '<div class="tt-row' + (ov ? " changed" : "") + (open ? " open" : "") + '" data-key="' + esc(k) + '">' + head + body + msgHtml(S.msg[k], ' data-ht-msg="' + esc(k) + '"') + "</div>";
      }).join("") + "</section>";
    }).join("");
    if (fk) { var el = box.querySelector('[data-ht-in="' + fk + '"][data-lang="' + fl + '"]'); if (el) el.focus(); }
  }
  /* what the landing page would show: saved values + what is typed now (not saved) */
  function draftMaps() {
    var t = Object.assign({}, S.texts), te = Object.assign({}, S.textsEn);
    Object.keys(S.draft).forEach(function (k) {
      var d = S.draft[k] || {};
      if (typeof d.he === "string" && d.he.trim() && !/[<>]/.test(d.he)) t[k] = d.he.trim();
      if (typeof d.en === "string" && d.en.trim() && !/[<>]/.test(d.en)) te[k] = d.en.trim();
    });
    return { texts: t, textsEn: te };
  }
  function preview() {
    var f = $("htFrame"); if (!f || !f.contentWindow) return;
    var m = draftMaps();
    try { f.contentWindow.postMessage({ type: "oh-home-texts-preview", texts: m.texts, textsEn: m.textsEn, lang: S.pvLang === "en" ? "en" : "he" }, location.origin); } catch (e) {}
  }
  function reloadPreview() { var f = $("htFrame"); if (f) f.src = "../?ohpv=" + Date.now(); }
  function failText(r) { return /permission|denied/i.test(String(r && (r.code || r.reason))) ? L("htDenied") : L("htFailed"); }
  function log(action, detail) { try { var fb = window.OH_FIREBASE; if (fb.logActivity) fb.logActivity(action, detail, { collection: "settings", itemId: "homeTexts", area: "site" }); } catch (e) {} }
  async function onClick(e) {
    var b = e.target.closest("button"); if (!b || S.busy || b.disabled) return;
    var ok = b.getAttribute("data-ht-open");
    if (ok) { S.open = S.open === ok ? null : ok; renderList(); if (S.open) { var f = document.querySelector('[data-ht-in="' + ok + '"][data-lang="he"]'); if (f) f.focus(); } return; }
    var k = b.getAttribute("data-ht-save"), rk = b.getAttribute("data-ht-reset");
    if (k) {
      var vals = {}, err = null;
      ["he", "en"].forEach(function (lang) {
        var inp = document.querySelector('[data-ht-in="' + k.replace(/"/g, "") + '"][data-lang="' + lang + '"]'), v = inp ? inp.value : "";
        if (!inp) { vals[lang] = undefined; return; } /* a shared line (phone, email, address): one value, in texts only */
        var c = check(v); if (c.err) err = err || c.err;
        /* the same words as the default (or an empty field) = no change saved */
        vals[lang] = (!v.trim() || v.trim() === def(k, lang)) ? null : v.trim();
      });
      if (err) { S.msg[k] = { kind: "warn", text: err }; renderList(); return; }
      await saveText(k, vals.he, vals.en, false);
    } else if (rk) await saveText(rk, null, null, true);
  }
  async function saveText(k, he, en, reset) {
    var fb = window.OH_FIREBASE; S.busy = true; S.msg[k] = { kind: "info", text: L("htSaving") }; renderList();
    var r = await fb.saveHomeText(k, he, en);
    S.busy = false;
    if (!r || !r.saved) { S.msg[k] = { kind: "warn", text: failText(r) }; renderList(); return; }
    delete S.draft[k]; S.texts = r.texts || {}; S.textsEn = r.textsEn || {};
    log("homeTexts." + (reset ? "reset" : "update"), k + (reset ? "" : ": " + [he, en].filter(function (x) { return x; }).join(" | ")));
    S.msg[k] = { kind: "ok", text: reset ? L("htResetDone") : L("htSaved") };
    renderList(); reloadPreview();
  }
  async function load() {
    var r = await window.OH_FIREBASE.loadHomeTexts();
    if (r && r.ok) { S.texts = r.texts; S.textsEn = r.textsEn; }
    renderList();
    var f = $("htFrame"); if (f && (!f.getAttribute("src") || f.getAttribute("src") === "about:blank")) f.src = "../?ohpv=1";
    if (/#htSection$/.test(location.hash)) { try { $("htSection").scrollIntoView({ block: "start" }); } catch (e) {} }
  }
  async function tick() {
    var sec = $("htSection"), fb = window.OH_FIREBASE;
    if (!sec) return;
    if (!fb || !fb.ready || !fb.user) { sec.hidden = true; S.role = null; return; }
    var role; try { role = await fb.resolveRole(); } catch (e) { role = null; }
    /* super admin only: everyone else simply does not see this section */
    if (!(role && role.isSuperAdmin)) { sec.hidden = true; S.role = null; return; }
    if (S.role === fb.user.uid) return;
    S.role = fb.user.uid; S.msg = {}; S.model = null; build(); sec.hidden = false; fit(); load();
  }
  window.OH_HT = { model: function () { S.model = null; return Mo(); }, check: check, _state: S, draftMaps: draftMaps };
  setInterval(tick, 1000); tick();
})();
