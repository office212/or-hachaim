/* Or Hachaim | 2040 phase 1 | "טקסטים במסך": every word on the TV, editable,
   in Hebrew and English (the TV shows both), and the order of the blocks
   (admin/tv-texts-editor.js). Hanoch, 2026-11-04 5:29 to 5:33 AM.
   Reads the TV's own list (src/tv/tv-texts.js, owned by the TV, a classic script:
   window.OH_TV_TEXTS = { TV_TEXTS: {key: {he, en}}, TV_TEXT_INFO: {key: {he, group}},
   TV_BLOCKS: [{id, he, en}] }) and the public document settings/screenTexts
   { texts, textsEn, layout, updatedBy, updatedAt } (no TV language: Hanoch 5:51 AM). Content gabbaim and the
   super admin only. Each save reloads the live /tv/ preview. Plain text only,
   up to 300 characters, {placeholders} kept (or a warning, then a second click). */
(function () {
  "use strict";
  var DEF = {
    ttTitle: "טקסטים במסך", ttSub: "כל מילה שמופיעה על המסך, בעברית ובאנגלית. משנים, שומרים ורואים מיד על המסך.",
    ttSearch: "חיפוש מילה או תיאור", ttSave: "שמור", ttReset: "חזרה לברירת מחדל", ttChanged: "שונה",
    ttDefault: "ברירת מחדל:", ttSaving: "שומר...", ttSaved: "נשמר ✓ מופיע עכשיו על המסך",
    ttSavedHidden: "נשמר ✓ יופיע על המסך כשהמסך יציג את החלק הזה", ttResetDone: "חזר לברירת המחדל ✓",
    ttTooLong: "עד 300 תווים", ttNoHtml: "רק טקסט רגיל, בלי הסימנים < >", ttEmpty: "שני השדות ריקים. כדי לחזור לברירת המחדל לוחצים על חזרה לברירת מחדל",
    ttPlaceholder: "חסר {x} מהטקסט. במקום הזה המסך שם מספר, שעה או שם. לשמור בכל זאת? לוחצים שוב על שמור",
    ttFailed: "השמירה נכשלה, שום דבר לא השתנה. נסו שוב", ttDenied: "אין הרשאה לשנות את המסך",
    ttNoList: "רשימת המילים של המסך עוד לא עלתה לאתר", ttNoResults: "לא נמצא",
    ttPreview: "כך זה נראה עכשיו על המסך", ttOpen: "פתח את המסך בחלון חדש", ttOther: "כללי",
    ttHe: "עברית", ttEn: "English",
    ttLayoutTitle: "סידור המסך", ttLayoutSub: "הסדר של החלקים על המסך ומה מוצג",
    ttUp: "למעלה", ttDown: "למטה", ttShown: "מוצג", ttHidden: "מוסתר",
    ttLayoutReset: "חזרה לסידור המקורי", ttLayoutSaved: "הסידור נשמר ✓", ttLayoutResetDone: "חזר לסידור המקורי ✓", ttNoBlocks: "רשימת החלקים של המסך עוד לא עלתה לאתר"
  };
  function L(k) { var o = window.OH_LABELS || {}; return (o[k] !== undefined && o[k] !== null && o[k] !== "") ? o[k] : DEF[k]; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function $(id) { return document.getElementById(id); }
  var S = { open: null, role: null, texts: {}, textsEn: {}, layout: {}, q: "", msg: {}, confirmPh: {}, draft: {}, busy: false, built: false, lmsg: null };

  function pack() { return window.OH_TV_TEXTS || {}; }
  function info() { return pack().TV_TEXT_INFO || {}; }
  function def(k, lang, depth) {
    var v = (pack().TV_TEXTS || {})[k];
    if (v == null) return "";
    if (typeof v === "string") v = lang === "en" ? "" : v; else v = v[lang] == null ? "" : String(v[lang]);
    /* a default that points at another line ({{termShabbat}}) shows that line's words,
       exactly as the TV does, so a gabbai never sees the {{...}} */
    if ((depth || 0) < 3) v = v.replace(/\{\{(\w+)\}\}/g, function (m, r) { var t = (pack().TV_TEXTS || {})[r]; if (!t) return m; var o = lang === "en" ? S.textsEn : S.texts; return has(o, r) ? o[r] : def(r, lang, (depth || 0) + 1); });
    return v;
  }
  /* the line's description: Hebrew from the TV's list; in English, the TV's English
     description when it has one (a string), else the line's own English words */
  function desc(k) {
    var i = info()[k] || {};
    if (window.OH_LANG === "en") { if (typeof i.enDesc === "string" && i.enDesc) return i.enDesc; if (typeof i.en === "string" && i.en) return i.en; return def(k, "en") || i.he || k; }
    return i.he || k;
  }
  /* the TV marks the lines it shows only in Hebrew with en:false: no English field for them */
  function showEn(k) { var i = info()[k]; return !(i && i.en === false); }
  function blocks() { var b = pack().TV_BLOCKS; return Array.isArray(b) ? b : []; }
  function keys() {
    var all = {}; Object.keys(pack().TV_TEXTS || {}).forEach(function (k) { all[k] = 1; }); Object.keys(info()).forEach(function (k) { all[k] = 1; });
    return Object.keys(all);
  }
  function has(map, k) { return map[k] != null && map[k] !== ""; }
  function cur(k, lang) { var dr = S.draft[k]; if (dr && typeof dr[lang] === "string") return dr[lang]; /* what the gabbai typed survives a warning or a failed save */ var m = lang === "en" ? S.textsEn : S.texts; return has(m, k) ? m[k] : def(k, lang); }
  function placeholders(s) { return (String(s || "").match(/\{[A-Za-z0-9_]+\}/g) || []); }
  /* one field: {err} blocks the save, {warn} needs a second click */
  function check(key, val, lang) {
    var v = String(val == null ? "" : val);
    if (v.length > 300) return { err: L("ttTooLong") };
    if (/[<>]/.test(v)) return { err: L("ttNoHtml") };
    if (!v.trim()) return {};
    var miss = placeholders(def(key, lang || "he")).filter(function (p) { return v.indexOf(p) < 0; });
    if (miss.length) return { warn: L("ttPlaceholder").replace("{x}", miss.join(" ")) };
    return {};
  }

  function build() {
    var sec = $("ttSection"); if (!sec || S.built) return;
    S.built = true;
    sec.classList.add("ohx", "tt");
    sec.innerHTML = '<div class="x-card"><div class="cb-head"><h2 id="ttHeading">' + esc(L("ttTitle")) + "</h2><span>" + esc(L("ttSub")) + "</span></div>" +
      '<div class="tt-grid"><div class="tt-main">' +
      '<details class="tt-layout" id="ttLayoutBox"><summary><b>' + esc(L("ttLayoutTitle")) + "</b> <span>" + esc(L("ttLayoutSub")) + '</span></summary><div id="ttLayout"></div></details>' +
      '<input class="tt-search" id="ttSearch" type="search" placeholder="' + esc(L("ttSearch")) + '" aria-label="' + esc(L("ttSearch")) + '">' +
      '<div id="ttList" class="tt-list"></div></div>' +
      '<div class="tt-side"><div class="tt-pv-head"><b>' + esc(L("ttPreview")) + '</b><a href="../tv/" target="_blank" rel="noopener">' + esc(L("ttOpen")) + '</a></div><div class="tt-pv" id="ttPv"><iframe id="ttFrame" title="' + esc(L("ttPreview")) + '" src="about:blank"></iframe></div></div></div></div>';
    $("ttSearch").addEventListener("input", function () { S.q = this.value.trim(); renderList(); });
    sec.addEventListener("click", onClick); sec.addEventListener("input", function (e) { var i = e.target.closest && e.target.closest("[data-tt-in]"); if (!i) return; var dk = i.getAttribute("data-tt-in"); (S.draft[dk] = S.draft[dk] || {})[i.getAttribute("data-lang")] = i.value; preview(dk); }); var tf = $("ttFrame"); if (tf) tf.addEventListener("load", function () { preview(); });
    fit(); window.addEventListener("resize", fit);
  }
  function fit() { var pv = $("ttPv"), f = $("ttFrame"); if (!pv || !f) return; var w = pv.clientWidth; if (w) { f.style.transform = "scale(" + (w / 1920) + ")"; pv.style.height = Math.round(w * 1080 / 1920) + "px"; } }
  function msgHtml(m, attr) { return m ? '<div class="cb-msg ' + m.kind + '"' + (attr || "") + '><div class="grow"><b>' + esc(m.text) + "</b></div></div>" : ""; }
  function layoutNow() {
    var ids = blocks().map(function (b) { return b.id; }), lo = S.layout || {};
    var order = (Array.isArray(lo.order) ? lo.order : []).filter(function (id) { return ids.indexOf(id) >= 0; });
    ids.forEach(function (id) { if (order.indexOf(id) < 0) order.push(id); });
    return { order: order, hidden: Array.isArray(lo.hidden) ? lo.hidden.filter(function (id) { return ids.indexOf(id) >= 0; }) : [] };
  }
  function renderLayout() {
    var box = $("ttLayout"); if (!box) return;
    var bl = blocks(); if (!bl.length) { box.innerHTML = '<p class="tt-none">' + esc(L("ttNoBlocks")) + "</p>"; return; }
    var lo = layoutNow(), byId = {}; bl.forEach(function (b) { byId[b.id] = b; });
    box.innerHTML = '<ol class="tt-blocks" id="ttBlocks">' + lo.order.map(function (id, i) {
      var b = byId[id], hid = lo.hidden.indexOf(id) >= 0, bn = (window.OH_LANG === "en" && b.en) || b.he || id;
      return '<li class="tt-block' + (hid ? " off" : "") + '" data-block="' + esc(id) + '"><span class="tt-bn">' + (i + 1) + '</span><b class="tt-bname">' + esc(bn) + "</b>" +
        '<span class="tt-bacts"><button type="button" class="x-btn small ghost" data-lo="up" data-id="' + esc(id) + '" aria-label="' + esc(L("ttUp") + " " + bn) + '"' + (i === 0 ? " disabled" : "") + ">↑</button>" +
        '<button type="button" class="x-btn small ghost" data-lo="down" data-id="' + esc(id) + '" aria-label="' + esc(L("ttDown") + " " + bn) + '"' + (i === lo.order.length - 1 ? " disabled" : "") + ">↓</button>" +
        '<button type="button" class="x-btn small' + (hid ? " ghost" : "") + '" data-lo="toggle" data-id="' + esc(id) + '" aria-pressed="' + !hid + '">' + esc(hid ? L("ttHidden") : L("ttShown")) + "</button>" + "</span></li>";
    }).join("") + "</ol>" +
      '<div class="tt-acts"><button type="button" class="x-btn ghost small" data-lo="reset" id="ttLayoutReset">' + esc(L("ttLayoutReset")) + "</button></div>" + msgHtml(S.lmsg, ' id="ttLayoutMsg"');
  }
  function groupsOf(list) {
    var g = {}, order = [];
    list.forEach(function (k) { var gr = (info()[k] && ((window.OH_LANG === "en" && info()[k].groupEn) || info()[k].group)) || L("ttOther"); if (!g[gr]) { g[gr] = []; order.push(gr); } g[gr].push(k); });
    return order.map(function (n) { return { name: n, keys: g[n] }; });
  }
  function field(k, lang) {
    var ov = has(lang === "en" ? S.textsEn : S.texts, k), d = def(k, lang);
    return '<label class="tt-f" dir="' + (lang === "en" ? "ltr" : "rtl") + '"><span class="tt-fl">' + esc(L(lang === "en" ? "ttEn" : "ttHe")) + (ov ? ' <i class="tt-badge">' + esc(L("ttChanged")) + "</i>" : "") + "</span>" +
      '<input class="tt-in" type="text" maxlength="300" data-tt-in="' + esc(k) + '" data-lang="' + lang + '" value="' + esc(cur(k, lang)) + '" lang="' + lang + '" dir="' + (lang === "en" ? "ltr" : "rtl") + '">' +
      (ov ? '<span class="tt-def">' + esc(L("ttDefault")) + " " + esc(d) + "</span>" : "") + "</label>";
  }
  /* Hanoch 5:47 AM: search + list, tap a text, edit, save */
  function renderList() {
    var box = $("ttList"); if (!box) return;
    var ks = keys();
    if (!ks.length) { box.innerHTML = '<p class="tt-none" id="ttNoList">' + esc(L("ttNoList")) + "</p>"; return; }
    var q = S.q.toLowerCase();
    var shown = ks.filter(function (k) {
      if (!q) return true;
      return [k, (info()[k] || {}).he, cur(k, "he"), cur(k, "en"), def(k, "he"), def(k, "en")].some(function (x) { return String(x || "").toLowerCase().indexOf(q) >= 0; });
    });
    if (!shown.length) { box.innerHTML = '<p class="tt-none">' + esc(L("ttNoResults")) + "</p>"; return; }
    var ae = document.activeElement, fk = ae && ae.getAttribute && ae.getAttribute("data-tt-in"), fl = fk && ae.getAttribute("data-lang");
    box.innerHTML = groupsOf(shown).map(function (g) {
      return '<section class="tt-group"><h3>' + esc(g.name) + "</h3>" + g.keys.map(function (k) {
        var ov = has(S.texts, k) || has(S.textsEn, k), open = S.open === k;
        var head = '<button type="button" class="tt-tap" data-tt-open="' + esc(k) + '" aria-expanded="' + open + '"><span class="tt-desc"><b>' + esc(desc(k)) + "</b>" + (ov ? '<i class="tt-badge">' + esc(L("ttChanged")) + "</i>" : "") + "</span>" +
          '<span class="tt-cur">' + esc(cur(k, "he")) + '</span><span class="tt-cur en" dir="ltr">' + esc(cur(k, "en")) + "</span></button>";
        var body = open ? '<div class="tt-fields">' + field(k, "he") + (showEn(k) ? field(k, "en") : "") + "</div>" +
          '<div class="tt-acts"><button type="button" class="x-btn primary small" data-tt-save="' + esc(k) + '">' + esc(L("ttSave")) + "</button>" + (ov ? '<button type="button" class="x-btn ghost small" data-tt-reset="' + esc(k) + '">' + esc(L("ttReset")) + "</button>" : "") + "</div>" : "";
        return '<div class="tt-row' + (ov ? " changed" : "") + (open ? " open" : "") + '" data-key="' + esc(k) + '">' + head + body + msgHtml(S.msg[k], ' data-tt-msg="' + esc(k) + '"') + "</div>";
      }).join("") + "</section>";
    }).join("");
    if (fk) { var el = box.querySelector('[data-tt-in="' + fk + '"][data-lang="' + fl + '"]'); if (el) el.focus(); }
  }
  function render() { renderLayout(); renderList(); }
  function frameText() { try { var d = $("ttFrame").contentDocument; return d && d.body ? d.body.innerText : ""; } catch (e) { return ""; } }
  /* reload the real /tv/ and wait until it shows "want" (or ~9 s) */
  function reloadPreview(want) {
    return new Promise(function (res) {
      var f = $("ttFrame"); if (!f) return res(false);
      var t0 = Date.now();
      f.onload = function () {
        f.onload = null;
        var iv = setInterval(function () {
          var txt = frameText();
          if (want && txt.indexOf(want) >= 0) { clearInterval(iv); res(true); }
          else if (Date.now() - t0 > 9000) { clearInterval(iv); res(!want); }
        }, 400);
      };
      f.src = "../tv/?ohpv=" + Date.now();
    });
  }
  function apply(r) { if (r && r.saved) { S.texts = r.texts || {}; S.textsEn = r.textsEn || {}; S.layout = r.layout || {}; preview(); } }
  /* Live preview without saving (the TV's contract): the /tv/ frame takes
  {type: "oh-tv-settings-preview", settings: {texts, textsEn, layout}} from this origin. */
  function preview(k) {
    var f = $("ttFrame"); if (!f || !f.contentWindow) return;
    var t = Object.assign({}, S.texts), te = Object.assign({}, S.textsEn);
    if (k) {
      var he = document.querySelector("[data-tt-in='" + k + "'][data-lang='he']"), en = document.querySelector("[data-tt-in='" + k + "'][data-lang='en']");
      if (he && he.value.trim() && !/[<>]/.test(he.value)) t[k] = he.value.trim();
      if (en && en.value.trim() && !/[<>]/.test(en.value)) te[k] = en.value.trim();
    }
    try { f.contentWindow.postMessage({ type: "oh-tv-settings-preview", settings: { texts: t, textsEn: te, layout: S.layout || {} } }, location.origin); } catch (e) {}
  }
  function failText(r) { return /permission|denied/i.test(String(r && (r.code || r.reason))) ? L("ttDenied") : L("ttFailed"); }
  function log(action, detail) { try { var fb = window.OH_FIREBASE; if (fb.logActivity) fb.logActivity(action, detail, { collection: "settings", itemId: "screenTexts" }); } catch (e) {} }
  async function onClick(e) {
    var b = e.target.closest("button"); if (!b || S.busy || b.disabled) return;
    var ok = b.getAttribute("data-tt-open");
    if (ok) { S.open = S.open === ok ? null : ok; renderList(); if (S.open) { var f = document.querySelector('[data-tt-in="' + ok + '"][data-lang="he"]'); if (f) f.focus(); } return; }
    var k = b.getAttribute("data-tt-save"), rk = b.getAttribute("data-tt-reset"), lo = b.getAttribute("data-lo");
    if (k) {
      var vals = {}, warn = null, err = null;
      ["he", "en"].forEach(function (lang) {
        var inp = document.querySelector('[data-tt-in="' + k.replace(/"/g, "") + '"][data-lang="' + lang + '"]'), v = inp ? inp.value : "";
        if (!inp) { vals[lang] = undefined; return; } /* a line the TV shows only in Hebrew: its English stays as is */
        var c = check(k, v, lang); if (c.err) err = err || c.err; if (c.warn) warn = warn || c.warn;
        vals[lang] = (!v.trim() || v === def(k, lang)) ? null : v;
      });
      if (err) { S.msg[k] = { kind: "warn", text: err }; renderList(); return; }
      var sig = JSON.stringify(vals);
      if (warn && S.confirmPh[k] !== sig) { S.confirmPh[k] = sig; S.msg[k] = { kind: "warn", text: warn }; renderList(); return; }
      await saveText(k, vals.he, vals.en, false);
    } else if (rk) await saveText(rk, null, null, true);
    else if (lo) await saveLayout(lo, b.getAttribute("data-id"));
  }
  async function saveText(k, he, en, reset) {
    var fb = window.OH_FIREBASE; S.busy = true; S.msg[k] = { kind: "info", text: L("ttSaving") }; renderList();
    var r = await fb.saveScreenText(k, he, en);
    S.busy = false; delete S.confirmPh[k];
    if (!r || !r.saved) { S.msg[k] = { kind: "warn", text: failText(r) }; renderList(); return; }
    delete S.draft[k]; apply(r); log("screenTexts." + (reset ? "reset" : "update"), k + (reset ? "" : ": " + [he, en].filter(function (x) { return x; }).join(" | ")));
    renderList();
    var want = cur(k, "he");
    want = String(want || "").replace(/\{[A-Za-z0-9_]+\}/g, "|").split("|").map(function (x) { return x.trim(); }).filter(function (x) { return x.length > 1; })[0] || "";
    var seen = await reloadPreview(want);
    S.msg[k] = { kind: "ok", text: reset ? L("ttResetDone") : (seen && want ? L("ttSaved") : L("ttSavedHidden")) };
    renderList();
  }
  async function saveLayout(act, id) {
    var fb = window.OH_FIREBASE, lo = layoutNow(), i = lo.order.indexOf(id);
    if (act === "up" && i > 0) { lo.order.splice(i, 1); lo.order.splice(i - 1, 0, id); }
    else if (act === "down" && i >= 0 && i < lo.order.length - 1) { lo.order.splice(i, 1); lo.order.splice(i + 1, 0, id); }
    else if (act === "toggle") { var h = lo.hidden.indexOf(id); if (h >= 0) lo.hidden.splice(h, 1); else lo.hidden.push(id); }
    S.busy = true;
    var r = await fb.saveScreenSettings(function (c) { c.layout = act === "reset" ? {} : { order: lo.order, hidden: lo.hidden }; });
    S.busy = false;
    if (!r || !r.saved) { S.lmsg = { kind: "warn", text: failText(r) }; renderLayout(); return; }
    apply(r); log("screenTexts.layout", act + (id ? " " + id : ""));
    S.lmsg = { kind: "ok", text: act === "reset" ? L("ttLayoutResetDone") : L("ttLayoutSaved") }; renderLayout();
    reloadPreview("");
  }
  async function load() {
    var r = await window.OH_FIREBASE.loadScreenTexts();
    if (r && r.ok) { S.texts = r.texts; S.textsEn = r.textsEn; S.layout = r.layout; }
    render();
    var f = $("ttFrame"); if (f && (!f.getAttribute("src") || f.getAttribute("src") === "about:blank")) f.src = "../tv/";
    if (/#ttSection$/.test(location.hash)) { try { $("ttSection").scrollIntoView({ block: "start" }); } catch (e) {} }
  }
  async function tick() {
    var sec = $("ttSection"), fb = window.OH_FIREBASE;
    if (!sec) return;
    if (!fb || !fb.ready || !fb.user) { sec.hidden = true; S.role = null; return; }
    var role; try { role = await fb.resolveRole(); } catch (e) { role = null; }
    var can = !!(role && (role.isSuperAdmin || role.canScreen));
    if (!can) { sec.hidden = true; S.role = null; return; }
    if (S.role === fb.user.uid) return;
    S.role = fb.user.uid; S.msg = {}; build(); sec.hidden = false; fit(); load();
  }
  window.OH_TT = { check: check, def: def, _state: S };
  setInterval(tick, 1000); tick();
})();
