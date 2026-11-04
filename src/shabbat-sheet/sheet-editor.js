/* Or Hachaim | the Shabbat sheet | the "לשבת הזאת" screen (src/shabbat-sheet/sheet-editor.js)
   Inside the gabbai page "חבילת שבת" (gabbai/shabbat/, content gabbaim and the
   super admin only; the page sends everyone else home). One screen:
     the rows of the sheet in 3 groups (Erev Shabbat, morning, afternoon):
       time field, shown / hidden, ⭐ highlight (ONE row), "+ שורה" per group
       (Hebrew + English name, time, "קבוע כל שבוע" checkbox);
     the preview (the exact drawing that is exported);
     export: PDF or image (JPG), Hebrew / English / both, with the background or
       clean for printing; on a phone, Share (to WhatsApp) with download fallback.
   Changes are saved at once to settings/shabbatSheet for THIS Shabbat only
   (weeks[date]); rows marked "קבוע כל שבוע" go to regular[] and show every week. */
(function () {
  "use strict";
  var HE = {
    edTitle: "דף זמני שבת", edNote: "שינוי כאן חל רק על השבת הזאת", edSaved: "נשמר ✓", edSaving: "שומר...",
    edFailed: "השמירה נכשלה, שום דבר לא השתנה. נסו שוב", edBadTime: "שעה לא תקינה, למשל 8:30",
    gErev: "ערב שבת", gMorning: "שבת בבוקר", gAfternoon: "שבת אחר הצהריים",
    tAuto: "אוטומטי", tPt: "מזמני תפילה", tRegular: "קבוע כל שבוע", tExtra: "נוסף לשבת הזאת", tChanged: "שונה", tEmpty: "להזין",
    shown: "מוצג", hidden: "מוסתר", starOn: "מודגש", starOff: "הדגשה", addRow: "+ שורה", remove: "הסר",
    addHe: "שם בעברית", addEn: "שם באנגלית", addTime: "שעה", addEvery: "קבוע כל שבוע", addOk: "הוסף", addCancel: "ביטול",
    resetWeek: "חזרה לדף הרגיל", mevRow: "שורת שבת מברכין",
    preview: "תצוגה", exportTitle: "ייצוא", fPdf: "PDF", fJpg: "תמונה", lHe: "עברית", lEn: "English", lBoth: "שתיהן",
    lookBg: "עם רקע", lookClean: "נקי להדפסה", dlPdf: "הורד PDF", dlJpg: "הורד תמונה", share: "שיתוף", download: "הורדה",
    making: "מכין קובץ...", done: "הקובץ מוכן ✓", ptLink: "קבוע לכל שבוע: זמני תפילה",
    help1: "הדגשה: שורה אחת בכל פעם. שורה מוסתרת לא מופיעה בדף. בשבוע הבא הכל חוזר לרגיל, חוץ משורות \"קבוע כל שבוע\".",
    help2: "הזמנים האוטומטיים באים מהמערכת, כמו במסך. תפילות באות מזמני תפילה (שישי / שבת). שתיהן = PDF אחד עם 2 עמודים, או 2 תמונות.",
    emptyHelp: "אין זמן בזמני תפילה לשורה הזאת. מזינים כאן לשבת הזאת, או קובעים בזמני תפילה"
  };
  var EN = {
    edTitle: "Shabbat sheet", edNote: "Changes here apply to this Shabbat only", edSaved: "Saved ✓", edSaving: "Saving...",
    edFailed: "The save did not go through, nothing changed. Try again", edBadTime: "Not a valid time, e.g. 8:30",
    gErev: "Erev Shabbat", gMorning: "Shabbat morning", gAfternoon: "Shabbat afternoon",
    tAuto: "Automatic", tPt: "From Davening Times", tRegular: "Every week", tExtra: "Added this Shabbat", tChanged: "Changed", tEmpty: "Enter",
    shown: "Shown", hidden: "Hidden", starOn: "Highlighted", starOff: "Highlight", addRow: "+ Row", remove: "Remove",
    addHe: "Hebrew name", addEn: "English name", addTime: "Time", addEvery: "Every week", addOk: "Add", addCancel: "Cancel",
    resetWeek: "Back to the regular sheet", mevRow: "Shabbat Mevarchin line",
    preview: "Preview", exportTitle: "Export", fPdf: "PDF", fJpg: "Image", lHe: "עברית", lEn: "English", lBoth: "Both",
    lookBg: "With background", lookClean: "Clean for printing", dlPdf: "Download PDF", dlJpg: "Download image", share: "Share", download: "Download",
    making: "Making the file...", done: "File ready ✓", ptLink: "Every week: Davening Times",
    help1: "Highlight: one row at a time. A hidden row is not on the sheet. Next week everything is back to regular, except \"Every week\" rows.",
    help2: "Automatic times come from the system, as on the TV. Davening comes from Davening Times (Friday / Shabbat). Both = one PDF with 2 pages, or 2 images.",
    emptyHelp: "No time in Davening Times for this row. Enter it here for this Shabbat, or set it in Davening Times"
  };
  function isEn() { return window.OH_LANG === "en"; }
  function L(k) { var d = isEn() ? EN : HE, o = window.OH_LABELS || {}; var key = "sheet_" + k; return (o[key] !== undefined && o[key] !== null && o[key] !== "") ? o[key] : d[k]; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var SV = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.6l2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.6l-5.1 2.7 1-5.7-4.1-4 5.7-.8z" fill="currentColor"/></svg>';
  var C = function () { return window.OH_SHEET; }, D = function () { return window.OH_SHEET_DRAW; };
  var st = { el: null, inp: null, settings: {}, model: null, addOpen: "", busy: false, msg: "", msgKind: "", fmt: "pdf", lang: "he", look: "bg", pvLang: "", pvTimer: 0 };

  function rebuild() { var i = st.inp; st.model = C().build({ shabbat: i.shabbat, sb: i.sb, days: i.days, docs: i.docs, timeOf: i.timeOf, settings: st.settings, rt: window.OH_RABBEINU_TAM }); }
  function tag(r) {
    var out = [];
    if (r.src === "auto") out.push(["auto", L("tAuto")]);
    if (r.src === "pt") out.push(["pt", L("tPt")]);
    if (r.src === "regular") out.push(["reg", L("tRegular")]);
    if (r.src === "extra") out.push(["extra", L("tExtra")]);
    if (r.changed) out.push(["chg", L("tChanged")]);
    return out.map(function (t) { return '<span class="se-tag se-' + t[0] + '">' + esc(t[1]) + "</span>"; }).join("");
  }
  function timeField(key, val, base, group, label, empty) {
    return '<input class="se-time' + (empty ? " is-empty" : "") + '" type="text" inputmode="decimal" autocomplete="off" dir="ltr" data-se-time="' + esc(key) + '" data-se-group="' + group + '" data-se-base="' + esc(base || "") + '" value="' + esc(val || "") + '" placeholder="' + esc(empty ? L("tEmpty") : base || "") + '" aria-label="' + esc(label) + '" maxlength="8">';
  }
  function rowHtml(r) {
    var en = isEn(), name = en ? (r.en || r.he) : (r.he || r.en), h = "";
    if (r.kind === "line") name = r.name ? (en ? r.name.en : r.name.he) : r.parts.map(function (p) { return en ? p.en : p.he; }).join(" | ");
    h += '<div class="se-row' + (r.hidden ? " is-off" : "") + (r.star ? " is-star" : "") + (r.empty && r.kind === "davening" ? " is-need" : "") + '" data-se-row="' + esc(r.id) + '">';
    h += '<div class="se-name"><b data-no-i18n>' + esc(name) + "</b>" + (r.ptName && r.kind === "davening" && r.src === "pt" && r.ptName !== r.he ? '<small data-no-i18n>' + esc(r.ptName) + "</small>" : "") + '<span class="se-tags">' + tag(r) + "</span>";
    if (r.empty && r.kind === "davening" && r.src === "none") h += '<p class="se-need"><a href="' + esc(st.inp.ptHref || "../../admin/") + '">' + esc(L("ptLink")) + '</a></p><p class="se-need oh-help">' + esc(L("emptyHelp")) + "</p>";
    h += "</div>";
    h += '<div class="se-times">';
    if (r.parts) r.parts.forEach(function (p) { h += '<label class="se-part"><span>' + esc(en ? p.en : p.he) + "</span>" + timeField(p.key, p.time, p.base, r.group, (en ? p.en : p.he), !p.time) + "</label>"; });
    else h += timeField(r.id, r.time, r.base, r.group, name, r.empty);
    h += "</div>";
    h += '<div class="se-acts">';
    h += '<button type="button" class="se-sw" role="switch" aria-checked="' + (!r.hidden) + '" data-se-hide="' + esc(r.id) + '" aria-label="' + esc(name + ": " + (r.hidden ? L("hidden") : L("shown"))) + '"><span class="se-knob"></span><span class="se-swl">' + esc(r.hidden ? L("hidden") : L("shown")) + "</span></button>";
    h += '<button type="button" class="se-star" aria-pressed="' + (!!r.star) + '" data-se-star="' + esc(r.id) + '" aria-label="' + esc(name + ": " + (r.star ? L("starOn") : L("starOff"))) + '" title="' + esc(r.star ? L("starOn") : L("starOff")) + '">' + SV + "</button>";
    if (r.src === "extra" || r.src === "regular") h += '<button type="button" class="x-btn ghost se-rm" data-se-rm="' + esc(r.id) + '">' + esc(L("remove")) + "</button>";
    h += "</div></div>";
    return h;
  }
  function addForm(g) {
    return '<div class="se-add" data-se-addform="' + g + '"><label><span>' + esc(L("addHe")) + '</span><input type="text" maxlength="60" data-se-add="he" dir="rtl"></label>' +
      '<label><span>' + esc(L("addEn")) + '</span><input type="text" maxlength="60" data-se-add="en" dir="ltr"></label>' +
      '<label class="se-add-t"><span>' + esc(L("addTime")) + '</span><input type="text" inputmode="decimal" maxlength="8" data-se-add="time" dir="ltr" placeholder="7:45"></label>' +
      '<label class="se-chk"><input type="checkbox" data-se-add="every"><span>' + esc(L("addEvery")) + "</span></label>" +
      '<div class="se-add-b"><button type="button" class="x-btn" data-se-addok="' + g + '">' + esc(L("addOk")) + '</button><button type="button" class="x-btn ghost" data-se-addcancel="1">' + esc(L("addCancel")) + "</button></div></div>";
  }
  function canShare() {
    try { if (!navigator.share || !navigator.canShare || !window.File) return false; var f = new File([new Blob(["x"], { type: "image/jpeg" })], "t.jpg", { type: "image/jpeg" }); return navigator.canShare({ files: [f] }) && (window.matchMedia ? window.matchMedia("(pointer: coarse)").matches : true); } catch (e) { return false; }
  }
  function seg(name, opts, cur) {
    return '<div class="se-seg" role="radiogroup" data-se-seg="' + name + '">' + opts.map(function (o) { return '<button type="button" role="radio" aria-checked="' + (o[0] === cur) + '" data-se-opt="' + name + ":" + o[0] + '"' + (o[2] ? " " + o[2] : "") + ">" + esc(o[1]) + "</button>"; }).join("") + "</div>";
  }
  function html() {
    var m = st.model, en = isEn(), h = "";
    var weekEdited = !!(st.settings.weeks && st.settings.weeks[m.shabbat]);
    h += '<section class="x-card se-card" id="ohSheetCard"><div class="se-head"><h2>' + esc(L("edTitle")) + ' <span class="se-sub" data-no-i18n>' + esc(en ? (m.title.en || m.title.he) : m.title.he) + "</span></h2>" +
      '<p class="se-note"><span>' + esc(L("edNote")) + '</span> <b class="se-saved" id="ohSheetSaved" role="status" aria-live="polite">' + esc(st.msg) + "</b></p>" +
      '<p class="oh-help se-help">' + esc(L("help1")) + "</p></div>";
    h += '<div class="se-cols"><div class="se-rows">';
    if (m.mev) h += '<div class="se-row se-mev' + (m.mev.hidden ? " is-off" : "") + '" data-se-row="mev"><div class="se-name"><b data-no-i18n>' + esc(en ? m.mev.en : m.mev.he) + '</b><span class="se-tags"><span class="se-tag se-auto">' + esc(L("tAuto")) + '</span></span></div><div class="se-times"></div><div class="se-acts"><button type="button" class="se-sw" role="switch" aria-checked="' + (!m.mev.hidden) + '" data-se-hide="mev" aria-label="' + esc(L("mevRow") + ": " + (m.mev.hidden ? L("hidden") : L("shown"))) + '"><span class="se-knob"></span><span class="se-swl">' + esc(m.mev.hidden ? L("hidden") : L("shown")) + "</span></button></div></div>";
    [["erev", "gErev"], ["morning", "gMorning"], ["afternoon", "gAfternoon"]].forEach(function (g) {
      h += '<div class="se-group" data-se-group-box="' + g[0] + '"><h3>' + esc(L(g[1])) + "</h3>";
      m.rows.filter(function (r) { return r.group === g[0]; }).forEach(function (r) { h += rowHtml(r); });
      h += st.addOpen === g[0] ? addForm(g[0]) : '<button type="button" class="x-btn ghost se-addbtn" data-se-addopen="' + g[0] + '">' + esc(L("addRow")) + "</button>";
      h += "</div>";
    });
    if (weekEdited) h += '<button type="button" class="x-btn ghost se-reset" id="ohSheetReset">' + esc(L("resetWeek")) + "</button>";
    h += '</div><div class="se-side"><div class="se-pv"><div class="se-pv-h"><b>' + esc(L("preview")) + "</b>" + seg("pv", [["he", "עברית", 'lang="he"'], ["en", "English", 'lang="en"']], st.pvLang || st.lang === "en" && "en" || "he") + '</div><div class="se-pv-box" id="ohSheetPv" data-no-i18n></div></div>';
    h += '<div class="se-exp"><h3>' + esc(L("exportTitle")) + "</h3>" + seg("fmt", [["pdf", L("fPdf")], ["jpg", L("fJpg")]], st.fmt) + seg("lang", [["he", "עברית", 'lang="he"'], ["en", "English", 'lang="en"'], ["both", L("lBoth")]], st.lang) + seg("look", [["bg", L("lookBg")], ["clean", L("lookClean")]], st.look) +
      '<p class="oh-help se-help">' + esc(L("help2")) + "</p>";
    var share = canShare();
    var dl = st.fmt === "pdf" ? L("dlPdf") : L("dlJpg");
    h += '<div class="se-exp-b">' + (share ? '<button type="button" class="x-btn primary" id="ohSheetShare">' + esc(L("share")) + '</button><button type="button" class="x-btn" id="ohSheetDl">' + esc(L("download")) + "</button>" : '<button type="button" class="x-btn primary" id="ohSheetDl">' + esc(dl) + "</button>") + "</div>";
    h += '<p class="se-exp-msg" id="ohSheetExpMsg" role="status" aria-live="polite"></p></div></div></div></section>';
    return h;
  }
  function paint() {
    if (!st.el) return;
    var focus = document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute("data-se-time");
    st.el.innerHTML = html();
    if (focus) { var f = st.el.querySelector('[data-se-time="' + focus + '"]'); if (f) { /* keep the place */ } }
    preview();
  }
  function preview() {
    clearTimeout(st.pvTimer);
    st.pvTimer = setTimeout(function () {
      var box = document.getElementById("ohSheetPv"); if (!box) return;
      D().load().then(function (a) {
        var lang = st.pvLang || (st.lang === "en" ? "en" : "he");
        var cv = D().render(st.model, lang, { look: st.look }, a);
        cv.className = "se-canvas"; cv.setAttribute("role", "img"); cv.setAttribute("aria-label", (lang === "en" ? st.model.title.en : st.model.title.he) || "");
        box.innerHTML = ""; box.appendChild(cv);
        document.body.setAttribute("data-sheet-ready", st.model.shabbat + ":" + lang + ":" + st.look);
      }).catch(function () { box.textContent = ""; document.body.setAttribute("data-sheet-ready", "error"); });
    }, 60);
  }
  function setMsg(t, kind) { st.msg = t || ""; st.msgKind = kind || ""; var e = document.getElementById("ohSheetSaved"); if (e) { e.textContent = st.msg; e.className = "se-saved " + (kind || ""); } }
  /* one change: saved in one transaction on settings/shabbatSheet (the op is
     re-applied to the newest document, so two gabbaim never erase each other) */
  function save(op) {
    var probe = C().edit(st.settings, st.model.shabbat, op);
    if (!probe) { setMsg(L("edBadTime"), "warn"); return Promise.resolve(false); }
    var prev = st.settings; st.settings = Object.assign({}, st.settings, probe); rebuild(); paint(); setMsg(L("edSaving"), "");
    var fb = window.OH_FIREBASE, db = fb && fb._db && fb._db();
    if (!db || !fb.user) { st.settings = prev; rebuild(); paint(); setMsg(L("edFailed"), "warn"); return Promise.resolve(false); }
    var ref = db.collection("settings").doc("shabbatSheet"), email = (fb.user && fb.user.email) || "", sh = st.model.shabbat;
    return db.runTransaction(function (tx) {
      return tx.get(ref).then(function (snap) {
        var cur = snap.exists ? (snap.data() || {}) : {};
        var next = C().edit({ weeks: cur.weeks || {}, regular: cur.regular || [] }, sh, op);
        if (!next) throw new Error("bad-op");
        tx.set(ref, { weeks: next.weeks, regular: next.regular, updatedBy: email, updatedAt: window.firebase.firestore.FieldValue.serverTimestamp() });
        return next;
      });
    }).then(function (next) {
      st.settings = { weeks: next.weeks, regular: next.regular }; rebuild(); paint(); setMsg(L("edSaved"), "ok");
      try { if (fb.logActivity) fb.logActivity("shabbatSheet." + op.type, sh + (op.id ? " " + op.id : op.key ? " " + op.key : ""), { collection: "settings", itemId: "shabbatSheet" }); } catch (e) {}
      return true;
    }).catch(function () { st.settings = prev; rebuild(); paint(); setMsg(L("edFailed"), "warn"); return false; });
  }
  function rowById(id) { return st.model.rows.filter(function (r) { return r.id === id; })[0] || null; }
  function onTime(inp) {
    var key = inp.getAttribute("data-se-time"), g = inp.getAttribute("data-se-group"), base = inp.getAttribute("data-se-base") || "", v = inp.value.trim();
    var cur = (st.model.week.times[key] || base);
    if (v === "" ) { if (!st.model.week.times[key]) return; return save({ type: "time", key: key, value: "", group: g, base: base }); }
    var n = C().normTyped(v, g); if (!n) { inp.classList.add("is-bad"); setMsg(L("edBadTime"), "warn"); return; }
    if (n === cur) { inp.value = n; return; }
    save({ type: "time", key: key, value: n, group: g, base: base });
  }
  function exportNow(how) {
    var msg = document.getElementById("ohSheetExpMsg"); if (msg) msg.textContent = L("making");
    var langs = st.lang === "both" ? ["he", "en"] : [st.lang];
    return D().exportFiles(st.model, { langs: langs, look: st.look, format: st.fmt }).then(function (files) {
      window.__ohSheetLastExport = files;
      if (how === "share") {
        var fl = files.map(function (f) { return new File([f.blob], f.name, { type: f.type }); });
        if (navigator.canShare && navigator.canShare({ files: fl })) return navigator.share({ files: fl, title: st.model.title.he }).then(function () { if (msg) msg.textContent = L("done"); }).catch(function () { if (msg) msg.textContent = ""; });
      }
      files.forEach(function (f, i) {
        setTimeout(function () {
          var u = URL.createObjectURL(f.blob), a = document.createElement("a"); a.href = u; a.download = f.name; document.body.appendChild(a); a.click();
          setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 4000);
        }, i * 400);
      });
      if (msg) msg.textContent = L("done");
    }).catch(function () { if (msg) msg.textContent = L("edFailed"); });
  }
  document.addEventListener("click", function (e) {
    if (!st.el || !st.el.contains(e.target)) return;
    var b = e.target.closest("button"); if (!b) return;
    var a;
    if ((a = b.getAttribute("data-se-hide"))) { var hid = a === "mev" ? !(st.model.mev && st.model.mev.hidden) : !(rowById(a) || {}).hidden; save({ type: "hide", id: a, hidden: hid }); return; }
    if ((a = b.getAttribute("data-se-star"))) { var r = rowById(a); save({ type: "star", id: a, on: !(r && r.star) }); return; }
    if ((a = b.getAttribute("data-se-rm"))) { save({ type: "remove", id: a }); return; }
    if ((a = b.getAttribute("data-se-addopen"))) { st.addOpen = a; paint(); var f = st.el.querySelector('[data-se-addform="' + a + '"] [data-se-add="he"]'); if (f) f.focus(); return; }
    if (b.hasAttribute("data-se-addcancel")) { st.addOpen = ""; paint(); return; }
    if ((a = b.getAttribute("data-se-addok"))) {
      var box = st.el.querySelector('[data-se-addform="' + a + '"]'), val = function (k) { var x = box.querySelector('[data-se-add="' + k + '"]'); return x.type === "checkbox" ? x.checked : x.value; };
      if (!val("he").trim() && !val("en").trim()) { box.querySelector('[data-se-add="he"]').focus(); return; }
      if (val("time").trim() && !C().normTyped(val("time"), a)) { setMsg(L("edBadTime"), "warn"); return; }
      st.addOpen = ""; save({ type: "add", he: val("he"), en: val("en"), time: val("time"), group: a, every: !!val("every") }); return;
    }
    if (b.id === "ohSheetReset") { save({ type: "reset" }); return; }
    if ((a = b.getAttribute("data-se-opt"))) {
      var p = a.split(":"); if (p[0] === "pv") st.pvLang = p[1]; else st[p[0]] = p[1];
      if (p[0] === "lang") st.pvLang = p[1] === "both" ? st.pvLang : p[1];
      paint(); return;
    }
    if (b.id === "ohSheetDl") { exportNow("download"); return; }
    if (b.id === "ohSheetShare") { exportNow("share"); return; }
  });
  document.addEventListener("change", function (e) { var t = e.target; if (st.el && st.el.contains(t) && t.hasAttribute("data-se-time")) onTime(t); });
  document.addEventListener("keydown", function (e) { var t = e.target; if (e.key === "Enter" && st.el && st.el.contains(t) && t.hasAttribute && t.hasAttribute("data-se-time")) { e.preventDefault(); t.blur(); } });

  /* inp: { shabbat, sb, days, docs, timeOf, settings, ptHref } */
  function mount(el, inp) {
    st.el = el; st.inp = inp; st.settings = { weeks: (inp.settings && inp.settings.weeks) || {}, regular: (inp.settings && inp.settings.regular) || [] };
    st.lang = isEn() ? "en" : "he"; st.pvLang = ""; st.msg = ""; rebuild(); paint();
  }
  window.OH_SHEET_EDITOR = { mount: mount, _state: st, exportNow: exportNow };
})();
