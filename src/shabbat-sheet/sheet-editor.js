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
    tAuto: "אוטומטי", tPt: "מזמני תפילה", tRegular: "קבוע כל שבוע", tExtra: "נוסף לשבת הזאת", tChanged: "שונה", tEmpty: "להזין", tDefault: "ברירת מחדל", tSugShk: "מוצע לפי השקיעה", tSugMin: "מוצע לפי המנחה", sizeTitle: "גודל טקסט", sizeAuto: "מותאם לדף", sizeFit: "התאם אוטומטית", sizeDown: "הקטן טקסט", sizeUp: "הגדל טקסט", posLabel: "מקום בדף", posTime: "לפי השעה", posFirst: "ראשונה בחלק הזה", posAfter: "אחרי: ", mvUp: "הזז למעלה", mvDown: "הזז למטה", orderReset: "סדר לפי השעה", makeEvery: "קבוע כל שבוע", removedTitle: "הוסרו מהדף (בכל שבוע):", restore: "החזר",
    shown: "מוצג", hidden: "מוסתר", starOn: "מודגש", starOff: "הדגשה", addRow: "+ שורה", remove: "הסר",
    addHe: "שם בעברית", addEn: "שם באנגלית", addTime: "שעה", addEvery: "קבוע כל שבוע", addOk: "הוסף", addCancel: "ביטול",
    resetWeek: "חזרה לדף הרגיל", mevRow: "שורת שבת מברכין",
    preview: "תצוגה", exportTitle: "ייצוא", fPdf: "PDF", fJpg: "תמונה", lHe: "עברית", lEn: "English", lBoth: "שתיהן",
    lookBg: "עם רקע", lookClean: "נקי להדפסה", dlPdf: "הורד PDF", dlJpg: "הורד תמונה", share: "שיתוף", download: "הורדה",
    making: "מכין קובץ...", done: "הקובץ מוכן ✓", ptLink: "קבוע לכל שבוע: זמני תפילה",
    help1: "↑ ↓ משנים סדר. שעה באפור היא הצעה. בשבוע הבא הכל חוזר לרגיל.",
    help2: "הזמנים באים מהמערכת, כמו במסך. שתיהן = PDF אחד עם 2 עמודים.",
    emptyHelp: "אין זמן בזמני תפילה לשורה הזאת. מזינים כאן לשבת הזאת, או קובעים בזמני תפילה",
    tvOffT: "להציג בזמני התפילות במסך", tvOffD: "הזמנים מהדף הזה יוצגו במסך בשישי ובשבת האלה, במקום זמני התפילה הקבועים.", tvOn: "הצג במסך",
    tvOnT: "מוצג בזמני התפילות במסך ✓", tvOnD: "כל שינוי כאן מתעדכן במסך לבד. אחרי השבת המסך חוזר לזמנים הקבועים.", tvOff: "הפסק להציג במסך",
    tvSaving: "מעדכן את המסך...", tvFailed: "המסך לא עודכן. נסו שוב", tvNone: "אין בדף זמני תפילה להציג"
  };
  var EN = {
    edTitle: "Shabbat sheet", edNote: "Changes here apply to this Shabbat only", edSaved: "Saved ✓", edSaving: "Saving...",
    edFailed: "The save did not go through, nothing changed. Try again", edBadTime: "Not a valid time, e.g. 8:30",
    gErev: "Erev Shabbat", gMorning: "Shabbat morning", gAfternoon: "Shabbat afternoon",
    tAuto: "Automatic", tPt: "From Davening Times", tRegular: "Every week", tExtra: "Added this Shabbat", tChanged: "Changed", tEmpty: "Enter", tDefault: "Default", tSugShk: "Suggested from Shkiah", tSugMin: "Suggested from Mincha", sizeTitle: "Text size", sizeAuto: "Fits the page", sizeFit: "Fit automatically", sizeDown: "Smaller text", sizeUp: "Bigger text", posLabel: "Place on the sheet", posTime: "By time", posFirst: "First in this part", posAfter: "After: ", mvUp: "Move up", mvDown: "Move down", orderReset: "Order by time", makeEvery: "Every week", removedTitle: "Removed from the sheet (every week):", restore: "Bring back",
    shown: "Shown", hidden: "Hidden", starOn: "Highlighted", starOff: "Highlight", addRow: "+ Row", remove: "Remove",
    addHe: "Hebrew name", addEn: "English name", addTime: "Time", addEvery: "Every week", addOk: "Add", addCancel: "Cancel",
    resetWeek: "Back to the regular sheet", mevRow: "Shabbat Mevarchin line",
    preview: "Preview", exportTitle: "Export", fPdf: "PDF", fJpg: "Image", lHe: "עברית", lEn: "English", lBoth: "Both",
    lookBg: "With background", lookClean: "Clean for printing", dlPdf: "Download PDF", dlJpg: "Download image", share: "Share", download: "Download",
    making: "Making the file...", done: "File ready ✓", ptLink: "Every week: Davening Times",
    help1: "↑ ↓ change the order. A grey time is a suggestion. Next week resets.",
    help2: "Times come from the system, as on the screen. Both = one 2-page PDF.",
    emptyHelp: "No time in Davening Times for this row. Enter it here for this Shabbat, or set it in Davening Times",
    tvOffT: "Show in the TV's davening times", tvOffD: "The times on this sheet show on the TV this Friday and Shabbat, instead of the regular davening times.", tvOn: "Show on the TV",
    tvOnT: "Shown in the TV's davening times ✓", tvOnD: "Every change here updates the TV by itself. After Shabbat the TV goes back to the regular times.", tvOff: "Stop showing on the TV",
    tvSaving: "Updating the TV...", tvFailed: "The TV was not updated. Try again", tvNone: "No davening times on this sheet to show"
  };
  function isEn() { return window.OH_LANG === "en"; }
  function L(k) { var d = isEn() ? EN : HE, o = window.OH_LABELS || {}; var key = "sheet_" + k; return (o[key] !== undefined && o[key] !== null && o[key] !== "") ? o[key] : d[k]; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var SV = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.6l2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.6l-5.1 2.7 1-5.7-4.1-4 5.7-.8z" fill="currentColor"/></svg>';
  var C = function () { return window.OH_SHEET; }, D = function () { return window.OH_SHEET_DRAW; };
  var st = { el: null, inp: null, settings: {}, screen: {}, tvBusy: false, tvMsg: "", model: null, addOpen: "", busy: false, msg: "", msgKind: "", fmt: "pdf", lang: "he", look: "bg", pvLang: "", pvTimer: 0 };

  function rebuild() { var i = st.inp; st.model = C().build({ shabbat: i.shabbat, sb: i.sb, days: i.days, docs: i.docs, timeOf: i.timeOf, settings: st.settings, rt: window.OH_RABBEINU_TAM }); }
  function tag(r) {
    var out = [];
    if (r.src === "auto") out.push(["auto", L("tAuto")]);
    if (r.src === "pt") out.push(["pt", L("tPt")]);
    if (r.suggest && !r.changed) out.push(["sug", L(r.suggest === "minchaSat" ? "tSugMin" : "tSugShk")]);
    else {
      if (r.src === "regular") out.push(["reg", L("tRegular")]);
      if (r.src === "default") out.push(["def", L("tDefault")]);
    }
    if (r.src === "extra") out.push(["extra", L("tExtra")]);
    if (r.changed) out.push(["chg", L("tChanged")]);
    return out.map(function (t) { return '<span class="se-tag se-' + t[0] + '">' + esc(t[1]) + "</span>"; }).join("");
  }
  function timeField(key, val, base, group, label, empty, sug) {
    return '<input class="se-time' + (empty ? " is-empty" : "") + (sug ? " is-sug" : "") + '" type="text" inputmode="decimal" autocomplete="off" dir="ltr" data-se-time="' + esc(key) + '" data-se-group="' + group + '" data-se-base="' + esc(base || "") + '" value="' + esc(val || "") + '" placeholder="' + esc(empty ? L("tEmpty") : base || "") + '" aria-label="' + esc(label) + '" maxlength="8">';
  }
  function groupIds(g) { return st.model.rows.filter(function (r) { return r.group === g; }).map(function (r) { return r.id; }); }
  function rowName(r) {
    var en = isEn();
    if (r.kind === "line") return r.name ? (en ? r.name.en : r.name.he) : r.parts.map(function (p) { return en ? p.en : p.he; }).join(" | ");
    return en ? (r.en || r.he) : (r.he || r.en);
  }
  function rowHtml(r, first, last) {
    var en = isEn(), name = en ? (r.en || r.he) : (r.he || r.en), h = "";
    if (r.kind === "line") name = r.name ? (en ? r.name.en : r.name.he) : r.parts.map(function (p) { return en ? p.en : p.he; }).join(" | ");
    h += '<div class="se-row' + (r.hidden ? " is-off" : "") + (r.star ? " is-star" : "") + (r.empty && r.kind === "davening" ? " is-need" : "") + '" data-se-row="' + esc(r.id) + '">';
    h += '<div class="se-name"><b data-no-i18n>' + esc(name) + "</b>" + (r.ptName && r.kind === "davening" && r.src === "pt" && r.ptName !== r.he ? '<small data-no-i18n>' + esc(r.ptName) + "</small>" : "") + '<span class="se-tags">' + tag(r) + "</span>";
    if (r.empty && r.kind === "davening" && r.src === "none") h += '<p class="se-need"><a href="' + esc(st.inp.ptHref || "../../admin/") + '">' + esc(L("ptLink")) + '</a></p><p class="se-need oh-help">' + esc(L("emptyHelp")) + "</p>";
    h += "</div>";
    h += '<div class="se-times">';
    if (r.parts) r.parts.forEach(function (p) { h += '<label class="se-part"><span>' + esc(en ? p.en : p.he) + "</span>" + timeField(p.key, p.time, p.base, r.group, (en ? p.en : p.he), !p.time) + "</label>"; });
    else h += timeField(r.id, r.time, r.base, r.group, name, r.empty, !!(r.suggest && !r.changed));
    h += "</div>";
    h += '<div class="se-acts">';
    /* v3 (Hanoch 3:21 PM): move the row up / down inside its part of the sheet */
    h += '<span class="se-mv"><button type="button" class="se-mvb" data-se-up="' + esc(r.id) + '" aria-label="' + esc(name + ": " + L("mvUp")) + '" title="' + esc(L("mvUp")) + '"' + (first ? " disabled" : "") + '>↑</button>' +
      '<button type="button" class="se-mvb" data-se-down="' + esc(r.id) + '" aria-label="' + esc(name + ": " + L("mvDown")) + '" title="' + esc(L("mvDown")) + '"' + (last ? " disabled" : "") + ">↓</button></span>";
    h += '<button type="button" class="se-sw" role="switch" aria-checked="' + (!r.hidden) + '" data-se-hide="' + esc(r.id) + '" aria-label="' + esc(name + ": " + (r.hidden ? L("hidden") : L("shown"))) + '"><span class="se-knob"></span><span class="se-swl">' + esc(r.hidden ? L("hidden") : L("shown")) + "</span></button>";
    h += '<button type="button" class="se-star" aria-pressed="' + (!!r.star) + '" data-se-star="' + esc(r.id) + '" aria-label="' + esc(name + ": " + (r.star ? L("starOn") : L("starOff"))) + '" title="' + esc(r.star ? L("starOn") : L("starOff")) + '">' + SV + "</button>";
    /* a time changed this week on a regular/default row can be kept for every week */
    if (r.changed && !r.parts && (r.removable || r.src === "regular")) h += '<button type="button" class="x-btn ghost se-every" data-se-every="' + esc(r.id) + '">' + esc(L("makeEvery")) + "</button>";
    if (r.src === "extra" || r.src === "regular" || r.removable) h += '<button type="button" class="x-btn ghost se-rm" data-se-rm="' + esc(r.id) + '">' + esc(L("remove")) + "</button>";
    h += "</div></div>";
    return h;
  }
  function addForm(g) {
    return '<div class="se-add" data-se-addform="' + g + '"><label><span>' + esc(L("addHe")) + '</span><input type="text" maxlength="60" data-se-add="he" dir="rtl"></label>' +
      '<label><span>' + esc(L("addEn")) + '</span><input type="text" maxlength="60" data-se-add="en" dir="ltr"></label>' +
      '<label class="se-add-t"><span>' + esc(L("addTime")) + '</span><input type="text" inputmode="decimal" maxlength="8" data-se-add="time" dir="ltr" placeholder="7:45"></label>' +
      '<label class="se-chk"><input type="checkbox" data-se-add="every"><span>' + esc(L("addEvery")) + "</span></label>" +
      '<label class="se-add-p"><span>' + esc(L("posLabel")) + '</span><select data-se-add="pos"><option value="">' + esc(L("posTime")) + '</option><option value="^">' + esc(L("posFirst")) + "</option>" +
        st.model.rows.filter(function (r) { return r.group === g; }).map(function (r) { return '<option value="' + esc(r.id) + '">' + esc(L("posAfter") + rowName(r)) + "</option>"; }).join("") + "</select></label>" +
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
      '<p class="oh-help se-help">' + esc(L("help1")) + "</p></div>" + tvBox();
    h += '<div class="se-cols"><div class="se-rows">';
    if (m.mev) h += '<div class="se-row se-mev' + (m.mev.hidden ? " is-off" : "") + '" data-se-row="mev"><div class="se-name"><b data-no-i18n>' + esc(en ? m.mev.en : m.mev.he) + '</b><span class="se-tags"><span class="se-tag se-auto">' + esc(L("tAuto")) + '</span></span></div><div class="se-times"></div><div class="se-acts"><button type="button" class="se-sw" role="switch" aria-checked="' + (!m.mev.hidden) + '" data-se-hide="mev" aria-label="' + esc(L("mevRow") + ": " + (m.mev.hidden ? L("hidden") : L("shown"))) + '"><span class="se-knob"></span><span class="se-swl">' + esc(m.mev.hidden ? L("hidden") : L("shown")) + "</span></button></div></div>";
    [["erev", "gErev"], ["morning", "gMorning"], ["afternoon", "gAfternoon"]].forEach(function (g) {
      h += '<div class="se-group" data-se-group-box="' + g[0] + '"><h3>' + esc(L(g[1])) + "</h3>";
      var inG = m.rows.filter(function (r) { return r.group === g[0]; });
      inG.forEach(function (r, i) { h += rowHtml(r, i === 0, i === inG.length - 1); });
      h += st.addOpen === g[0] ? addForm(g[0]) : '<button type="button" class="x-btn ghost se-addbtn" data-se-addopen="' + g[0] + '">' + esc(L("addRow")) + "</button>";
      h += "</div>";
    });
    if (m.removed && m.removed.length) {
      h += '<div class="se-removed" id="ohSheetRemoved"><span>' + esc(L("removedTitle")) + "</span> ";
      m.removed.forEach(function (x) { h += '<button type="button" class="x-btn ghost se-restore" data-se-restore="' + esc(x.id) + '"><span data-no-i18n>' + esc(en ? (x.en || x.he) : (x.he || x.en)) + "</span> ↺ " + esc(L("restore")) + "</button> "; });
      h += "</div>";
    }
    if (weekEdited) h += '<button type="button" class="x-btn ghost se-reset" id="ohSheetReset">' + esc(L("resetWeek")) + "</button>";
    if (m.orderFrom) h += '<button type="button" class="x-btn ghost se-reset" id="ohSheetOrderReset">' + esc(L("orderReset")) + "</button>";
    h += '</div><div class="se-side"><div class="se-pv"><div class="se-pv-h"><b>' + esc(L("preview")) + "</b>" + seg("pv", [["he", "עברית", 'lang="he"'], ["en", "English", 'lang="en"']], st.pvLang || st.lang === "en" && "en" || "he") + "</div>" + sizeHtml() + '<div class="se-pv-box" id="ohSheetPv" data-no-i18n></div></div>';
    h += '<div class="se-exp"><h3>' + esc(L("exportTitle")) + "</h3>" + seg("fmt", [["pdf", L("fPdf")], ["jpg", L("fJpg")]], st.fmt) + seg("lang", [["he", "עברית", 'lang="he"'], ["en", "English", 'lang="en"'], ["both", L("lBoth")]], st.lang) + seg("look", [["bg", L("lookBg")], ["clean", L("lookClean")]], st.look) +
      '<p class="oh-help se-help">' + esc(L("help2")) + "</p>";
    var share = canShare();
    var dl = st.fmt === "pdf" ? L("dlPdf") : L("dlJpg");
    h += '<div class="se-exp-b">' + (share ? '<button type="button" class="x-btn primary" id="ohSheetShare">' + esc(L("share")) + '</button><button type="button" class="x-btn" id="ohSheetDl">' + esc(L("download")) + "</button>" : '<button type="button" class="x-btn primary" id="ohSheetDl">' + esc(dl) + "</button>") + "</div>";
    h += '<p class="se-exp-msg" id="ohSheetExpMsg" role="status" aria-live="polite"></p></div></div></div></section>';
    return h;
  }
  /* v3 (Hanoch 3:19 PM): the text fits the page by itself; − / + make it smaller or
     bigger for this Shabbat (weeks[shabbat].size, whole steps), never past the page */
  function sizeRange() {
    var r = { minStep: C().SIZE_MIN, maxStep: C().SIZE_MAX };
    try {
      ["he", "en"].forEach(function (l) { var x = D().sizeRange(st.model, l, st.look); r.minStep = Math.max(r.minStep, x.minStep); r.maxStep = Math.min(r.maxStep, x.maxStep); });
    } catch (e) {}
    if (r.minStep > 0) r.minStep = 0; if (r.maxStep < 0) r.maxStep = 0;
    return r;
  }
  function sizeNow(rg) { var s = (st.model.week && st.model.week.size) || 0; rg = rg || sizeRange(); return Math.max(rg.minStep, Math.min(rg.maxStep, s)); }
  function sizeLabel(s) { return s ? (s > 0 ? "+" + s : "-" + (-s)) : L("sizeAuto"); }
  function sizeHtml() {
    var rg = sizeRange(), s = sizeNow(rg);
    return '<div class="se-size" role="group" aria-label="' + esc(L("sizeTitle")) + '" id="ohSheetSize"><span class="se-size-l">' + esc(L("sizeTitle")) + "</span>" +
      '<button type="button" class="se-size-b" data-se-size="-1" aria-label="' + esc(L("sizeDown")) + '" title="' + esc(L("sizeDown")) + '"' + (s <= rg.minStep ? " disabled" : "") + ">−</button>" +
      '<output class="se-size-v" id="ohSheetSizeV" aria-live="polite"' + (s ? ' dir="ltr"' : "") + ">" + esc(sizeLabel(s)) + "</output>" +
      '<button type="button" class="se-size-b" data-se-size="1" aria-label="' + esc(L("sizeUp")) + '" title="' + esc(L("sizeUp")) + '"' + (s >= rg.maxStep ? " disabled" : "") + ">+</button>" +
      '<button type="button" class="x-btn ghost se-size-fit" data-se-size="fit"' + (s ? "" : " hidden") + ">" + esc(L("sizeFit")) + "</button></div>";
  }
  /* after the font has loaded the range is exact: refresh the buttons */
  function sizeUi() {
    var box = document.getElementById("ohSheetSize"); if (!box) return;
    var ae = document.activeElement, keep = ae && box.contains(ae) ? ae.getAttribute("data-se-size") : null;
    var tmp = document.createElement("div"); tmp.innerHTML = sizeHtml(); box.parentNode.replaceChild(tmp.firstChild, box);
    if (keep) { var nb = document.querySelector('#ohSheetSize [data-se-size="' + keep + '"]'); if (nb && !nb.disabled && !nb.hidden) nb.focus(); else { nb = document.querySelector("#ohSheetSize .se-size-b:not([disabled])"); if (nb) nb.focus(); } }
  }
  function paint() {
    if (!st.el) return;
    var focus = document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute("data-se-time");
    st.el.innerHTML = html();
    if (focus) { var f = st.el.querySelector('[data-se-time="' + focus + '"]'); if (f) { /* keep the place */ } }
    if (st.focusAfter) { var mv = st.el.querySelector("[" + st.focusAfter + "]"); st.focusAfter = ""; if (mv) { if (mv.disabled) mv = mv.parentNode.querySelector("button:not([disabled])"); if (mv) mv.focus(); } }
    preview();
  }
  function preview() {
    clearTimeout(st.pvTimer);
    st.pvTimer = setTimeout(function () {
      var box = document.getElementById("ohSheetPv"); if (!box) return;
      D().load().then(function (a) {
        var lang = st.pvLang || (st.lang === "en" ? "en" : "he");
        var out = {}, cv = D().render(st.model, lang, { look: st.look, out: out }, a);
        cv.className = "se-canvas"; cv.setAttribute("role", "img"); cv.setAttribute("aria-label", (lang === "en" ? st.model.title.en : st.model.title.he) || "");
        box.innerHTML = ""; box.appendChild(cv);
        sizeUi();
        if (out.layout) document.body.setAttribute("data-sheet-fit", (out.layout.step || 0) + ":" + out.layout.fs.toFixed(2) + ":" + (out.layout.overflow ? "overflow" : "fits"));
        document.body.setAttribute("data-sheet-ready", st.model.shabbat + ":" + lang + ":" + st.look);
      }).catch(function () { box.textContent = ""; document.body.setAttribute("data-sheet-ready", "error"); });
    }, 60);
  }
  function setMsg(t, kind) { st.msg = t || ""; st.msgKind = kind || ""; var e = document.getElementById("ohSheetSaved"); if (e) { e.textContent = st.msg; e.className = "se-saved " + (kind || ""); } }
  /* ---------- Hanoch Nov 7: this sheet's davening times on the TV ----------
     settings/shabbatScreen.weeks[<shabbat>] = { friday, rows } (OH_SHEET.screenRows),
     read by the TV (tv-live.js) and shown there INSTEAD of the regular times on that
     Friday afternoon and Shabbat. Once on, every saved change here updates it. */
  function tvOn() { return !!(st.screen && st.screen.weeks && st.screen.weeks[st.model.shabbat]); }
  function tvBox() {
    var on = tvOn();
    return '<div class="se-tv' + (on ? " is-on" : "") + '" id="ohSheetTv"><div class="se-tv-t"><b>' + esc(L(on ? "tvOnT" : "tvOffT")) + "</b><span>" + esc(L(on ? "tvOnD" : "tvOffD")) + "</span>" +
      (st.tvMsg ? '<span class="se-tv-msg" role="status">' + esc(st.tvMsg) + "</span>" : "") + "</div>" +
      '<button type="button" class="x-btn' + (on ? " ghost" : " primary") + '" id="ohSheetTvBtn" data-se-tv="' + (on ? "off" : "on") + '"' + (st.tvBusy ? " disabled" : "") + ">" + esc(L(st.tvBusy ? "tvSaving" : (on ? "tvOff" : "tvOn"))) + "</button></div>";
  }
  function sameRows(a, b) { return JSON.stringify(a || null) === JSON.stringify(b || null); }
  function publishTv(on, quiet) {
    var fb = window.OH_FIREBASE, db = fb && fb._db && fb._db();
    var sh = st.model.shabbat, data = C().screenRows(st.model);
    var entry = { friday: data.friday, rows: data.rows };
    if (on && !data.rows.length) { st.tvMsg = L("tvNone"); paint(); return Promise.resolve(false); }
    if (on && quiet && tvOn() && sameRows(st.screen.weeks[sh].rows, entry.rows) && st.screen.weeks[sh].friday === entry.friday) return Promise.resolve(true);
    if (!db || !fb.user) { st.tvMsg = L("tvFailed"); paint(); return Promise.resolve(false); }
    var ref = db.collection("settings").doc("shabbatScreen"), email = (fb.user && fb.user.email) || "";
    var today = window.OH_UI && window.OH_UI.nyDate ? window.OH_UI.nyDate() : new Date().toISOString().slice(0, 10);
    st.tvBusy = true; if (!quiet) { st.tvMsg = ""; paint(); }
    return db.runTransaction(function (tx) {
      return tx.get(ref).then(function (snap) {
        var cur = snap.exists ? (snap.data() || {}) : {}, weeks = {};
        /* keep only Shabbatot that are today or later (old ones are of no use to the TV), at most 12 */
        Object.keys(cur.weeks || {}).sort().forEach(function (k) { if (k >= today && k !== sh) weeks[k] = cur.weeks[k]; });
        if (on) weeks[sh] = entry;
        var keys = Object.keys(weeks).sort(); while (keys.length > 12) { delete weeks[keys.pop()]; }
        tx.set(ref, { weeks: weeks, updatedBy: email, updatedAt: window.firebase.firestore.FieldValue.serverTimestamp() });
        return weeks;
      });
    }).then(function (weeks) {
      st.tvBusy = false; st.screen = { weeks: weeks }; st.tvMsg = ""; paint();
      if (!quiet) { try { if (fb.logActivity) fb.logActivity(on ? "זמני דף השבת הוצגו במסך (" + sh + ")" : "זמני דף השבת הוסרו מהמסך (" + sh + ")", "", { area: "shabbat", code: on ? "shabbatScreen.on" : "shabbatScreen.off", collection: "settings", itemId: "shabbatScreen" }); } catch (e) {} }
      return true;
    }).catch(function () { st.tvBusy = false; st.tvMsg = L("tvFailed"); paint(); return false; });
  }

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
      if (tvOn()) publishTv(true, true); /* the TV follows the sheet */
      try { if (fb.logActivity) fb.logActivity("עודכן דף השבת (" + sh + ")", op.type + (op.id ? " " + op.id : op.key ? " " + op.key : ""), { area: "shabbat", code: "shabbatSheet." + op.type, collection: "settings", itemId: "shabbatSheet" }); } catch (e) {} /* Nov 5: Hebrew sentence, area "shabbat" */
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
    if ((a = b.getAttribute("data-se-up") || b.getAttribute("data-se-down"))) {
      var mr = rowById(a); if (!mr) return;
      var gi = groupIds(mr.group), k = gi.indexOf(a), to = k + (b.hasAttribute("data-se-up") ? -1 : 1);
      if (k < 0 || to < 0 || to >= gi.length) return;
      gi.splice(k, 1); gi.splice(to, 0, a);
      st.focusAfter = (b.hasAttribute("data-se-up") ? "data-se-up" : "data-se-down") + '="' + a + '"';
      save({ type: "move", ids: gi, every: !/^x:/.test(a) }); return;
    }
    if (b.id === "ohSheetOrderReset") { save({ type: "order-reset" }); return; }
    if ((a = b.getAttribute("data-se-size"))) {
      var rg = sizeRange(), cur = sizeNow(rg), nx = a === "fit" ? 0 : Math.max(rg.minStep, Math.min(rg.maxStep, cur + (+a || 0)));
      if (nx === ((st.model.week && st.model.week.size) || 0)) return;
      save({ type: "size", value: nx }); return;
    }
    if ((a = b.getAttribute("data-se-rm"))) { save({ type: "remove", id: a }); return; }
    if ((a = b.getAttribute("data-se-restore"))) { save({ type: "restore", id: a }); return; }
    if ((a = b.getAttribute("data-se-every"))) { var re = rowById(a); if (re) save({ type: "every", id: a, value: re.time, group: re.group }); return; }
    if ((a = b.getAttribute("data-se-addopen"))) { st.addOpen = a; paint(); var f = st.el.querySelector('[data-se-addform="' + a + '"] [data-se-add="he"]'); if (f) f.focus(); return; }
    if (b.hasAttribute("data-se-addcancel")) { st.addOpen = ""; paint(); return; }
    if ((a = b.getAttribute("data-se-addok"))) {
      var box = st.el.querySelector('[data-se-addform="' + a + '"]'), val = function (k) { var x = box.querySelector('[data-se-add="' + k + '"]'); return x.type === "checkbox" ? x.checked : x.value; };
      if (!val("he").trim() && !val("en").trim()) { box.querySelector('[data-se-add="he"]').focus(); return; }
      if (val("time").trim() && !C().normTyped(val("time"), a)) { setMsg(L("edBadTime"), "warn"); return; }
      var every = !!val("every"), pos = val("pos") || "", nid = "a" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), op = { type: "add", id: nid, he: val("he"), en: val("en"), time: val("time"), group: a, every: every };
      if (pos) {
        var ids = groupIds(a), at = pos === "^" ? 0 : ids.indexOf(pos) + 1;
        ids.splice(at > 0 || pos === "^" ? at : ids.length, 0, (every ? "r:" : "x:") + nid); op.order = ids;
      }
      st.addOpen = ""; save(op); return;
    }
    if (b.id === "ohSheetReset") { save({ type: "reset" }); return; }
    if ((a = b.getAttribute("data-se-tv"))) { publishTv(a === "on", false); return; }
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

  /* inp: { shabbat, sb, days, docs, timeOf, settings, screen, ptHref } */
  function mount(el, inp) {
    st.el = el; st.inp = inp; st.settings = { weeks: (inp.settings && inp.settings.weeks) || {}, regular: (inp.settings && inp.settings.regular) || [] };
    st.screen = { weeks: (inp.screen && inp.screen.weeks) || {} }; st.tvMsg = ""; st.tvBusy = false;
    st.lang = isEn() ? "en" : "he"; st.pvLang = ""; st.msg = ""; rebuild(); paint();
  }
  window.OH_SHEET_EDITOR = { mount: mount, _state: st, exportNow: exportNow };
})();
