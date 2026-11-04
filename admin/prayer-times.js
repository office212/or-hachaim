/* Or Hachaim | prayer times manager on admin/ (stage B1).
   A simple list sorted by time, add / edit / delete, and the real /tv/ page as
   a live preview that reloads after every save.
   Data: collection prayerTimes, the same fields as before:
     nameHe, nameEn, time ("6:30 AM"), order (minutes after midnight), updatedBy, updatedAt.
   Who may do what is decided by the Firestore rules (hasScreen() for create,
   update and delete). This page only shows the section to accounts that may
   edit content, and shows a Hebrew message if the database refuses.
   All words come from src/ui/labels.js (keys pt...). Times are typed in by the
   gabbaim: nothing here computes or changes zmanim. */
(function () {
  "use strict";
  var DEF = {
    ptTitle: "זמני תפילה", ptTitleEn: "Davening Times", ptLead: "הזמנים שמופיעים במסך. מסודרים לפי השעה.",
    ptAdd: "הוספת זמן", ptEdit: "ערוך", ptDelete: "מחק",
    ptEmpty: "עוד אין זמני תפילה. לחץ על «הוספת זמן» כדי להוסיף את הראשון.",
    ptFormAddTitle: "זמן תפילה חדש", ptFormEditTitle: "עריכת זמן תפילה",
    ptNameHe: "שם התפילה", ptNameHePlaceholder: "למשל: שחרית", ptNameEn: "שם באנגלית (לא חובה)", ptNameEnPlaceholder: "English name",
    ptTime: "שעה", ptQuick: "בחירה מהירה:",
    ptQuickNames: [{ he: "שחרית", en: "Shacharit" }, { he: "מנחה", en: "Mincha" }, { he: "ערבית", en: "Arvit" }, { he: "קבלת שבת", en: "Kabbalat Shabbat" }],
    ptSave: "שמור", ptSaveEdit: "שמור שינויים", ptCancel: "ביטול",
    ptConfirmDelete: "למחוק את {name} {time}?", ptConfirmYes: "כן, למחוק", ptConfirmNo: "לא",
    ptSaving: "שומר...", ptDeleting: "מוחק...",
    ptSaved: "נשמר ✓ מופיע עכשיו על המסך", ptDeleted: "נמחק ✓ כבר לא מופיע על המסך", ptSavedSlow: "נשמר ✓ המסך יתעדכן תוך דקה",
    ptNeedName: "כתוב את שם התפילה", ptNeedTime: "בחר שעה",
    ptErrDenied: "אין הרשאה לפעולה הזו.",
    ptErrSave: "השמירה לא הצליחה. בדוק את החיבור לאינטרנט ונסה שוב.",
    ptErrDelete: "המחיקה לא הצליחה. בדוק את החיבור לאינטרנט ונסה שוב.",
    ptErrLoad: "לא הצלחנו לטעון את זמני התפילה. רענן את הדף.",
    ptPreviewTitle: "כך זה נראה עכשיו על המסך", ptPreviewOpen: "פתח את המסך בחלון חדש", ptPreviewNote: "התצוגה מתעדכנת אחרי כל שמירה.",
    /* 2040 phase 1 (Hanoch 5:41 AM: a clear place for Shabbat times) */
    ptGrpWeekday: "חול", ptGrpFri: "שישי", ptGrpShabbat: "שבת", ptGrpAll: "כל יום",
    ptDays: "יום", ptDayAll: "כל יום", ptDayWeekday: "חול", ptDayFri: "שישי", ptDayShabbat: "שבת", ptMore: "אפשרויות נוספות",
    ptKind: "סוג הזמן", ptKindFixed: "שעה קבועה", ptKindSunset: "ביחס לשקיעה",
    ptOffMin: "דקות", ptBefore: "לפני השקיעה", ptAfter: "אחרי השקיעה", ptAtSunset: "בשקיעה",
    ptDates: "תאריכים (לא חובה)", ptFrom: "מתאריך", ptUntil: "עד תאריך (כולל)",
    ptNeedOffset: "כתוב כמה דקות (0 עד 180)", ptBadRange: "תאריך הסיום לפני תאריך ההתחלה", ptNoSunset: "אין נתוני שקיעה לתאריכים האלה",
    ptNeverApplies: "בימים ובתאריכים האלה אין אף יום מתאים",
    ptSavedLater: "נשמר ✓ יופיע על המסך {when}", ptWhenShabbat: "בשבת", ptWhenFri: "ביום שישי", ptWhenDate: "ב{date}",
    ptTodayAt: "היום: {time}",
    ptQuickNamesShabbat: [{ he: "קבלת שבת", en: "Kabbalat Shabbat" }, { he: "שחרית שבת", en: "Shacharit Shabbat" }, { he: "מוסף", en: "Musaf" }, { he: "מנחה גדולה", en: "Mincha Gedola" },
      { he: "מנחה שבת", en: "Mincha Shabbat" }, { he: "ערבית מוצאי שבת", en: "Arvit Motzei Shabbat" }, { he: "שיעור", en: "Shiur" }]
  };
  function L(k) { var o = window.OH_LABELS || {}; return (o[k] !== undefined && o[k] !== null && o[k] !== "") ? o[k] : DEF[k]; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function $(id) { return document.getElementById(id); }

  /* "6:30 AM" <-> minutes after midnight <-> "06:30" (the phone time picker). */
  function minutesOf12(t) { var m = String(t || "").trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/); if (!m) return -1; var h = +m[1], mi = +m[2]; if (h < 1 || h > 12 || mi > 59) return -1; h = h % 12; if (/p/i.test(m[3])) h += 12; return h * 60 + mi; }
  function minutesOf24(v) { var m = String(v || "").match(/^(\d{1,2}):(\d{2})/); if (!m) return -1; var h = +m[1], mi = +m[2]; if (h > 23 || mi > 59) return -1; return h * 60 + mi; }
  function to12(min) { var h = Math.floor(min / 60), mi = min % 60, ap = h < 12 ? "AM" : "PM", h12 = h % 12 || 12; return h12 + ":" + (mi < 10 ? "0" : "") + mi + " " + ap; }
  function to24(min) { var h = Math.floor(min / 60), mi = min % 60; return (h < 10 ? "0" : "") + h + ":" + (mi < 10 ? "0" : "") + mi; }
  function itemMinutes(p) { var m = minutesOf12(p.time); return m >= 0 ? m : (typeof p.order === "number" ? p.order : 0); }
  function shortTime(t) { return String(t || "").replace(/\s*[AaPp][Mm]\s*$/, ""); }

  var S = { role: null, items: [], editId: null, confirmId: null, justId: null, frame: null, busy: false, built: false, msgTimer: null, tab: "all", days: "all", kind: "fixed", sign: -1 };
  var GROUPS = [["weekday", "ptGrpWeekday"], ["fri", "ptGrpFri"], ["shabbat", "ptGrpShabbat"], ["all", "ptGrpAll"]];
  /* Hanoch 5:47 AM: simple. Four big day buttons; "חול" is Sunday to Thursday. */
  var DAYOPTS = [["sun-thu", "ptDayWeekday"], ["fri", "ptDayFri"], ["shabbat", "ptDayShabbat"], ["all", "ptDayAll"]];
  function T() { return window.OH_TIMES; }
  function groupOf(p) { var d = p.rule && p.rule.days; return d === "sun-thu" || d === "weekday" ? "weekday" : d === "fri" ? "fri" : d === "shabbat" ? "shabbat" : "all"; }
  function todayIso() { return T() ? T().nyIso(new Date()) : new Date().toISOString().slice(0, 10); }

  function build() {
    if (S.built) return; S.built = true;
    var sec = $("ptSection");
    var quick = (L("ptQuickNames") || []).map(function (q, i) { return '<button type="button" class="ohpt-chip" data-q="' + i + '" aria-pressed="false">' + esc(q.he) + '</button>'; }).join("");
    sec.innerHTML =
      '<div class="ohpt-head"><div><h2 id="ptHeading">' + esc(L("ptTitle")) + '<small dir="ltr">' + esc(L("ptTitleEn")) + '</small></h2><p class="ohpt-lead">' + esc(L("ptLead")) + '</p></div>' +
      '<button type="button" class="ohpt-btn primary" id="ptAddBtn"><span class="plus" aria-hidden="true">+</span>' + esc(L("ptAdd")) + '</button></div>' +
      '<div class="ohpt-grid"><div class="ohpt-card ohpt-main">' +
      '<form id="ptForm" class="ohpt-form" hidden novalidate><h3 id="ptFormTitle"></h3>' +
      '<label for="ptNameHe">' + esc(L("ptNameHe")) + '</label><input type="text" id="ptNameHe" autocomplete="off" placeholder="' + esc(L("ptNameHePlaceholder")) + '">' +
      '<div class="ohpt-chips" id="ptChips" role="group" aria-label="' + esc(L("ptQuick")) + '"></div>' +
      '<div id="ptFixedBox"><label for="ptTimeIn">' + esc(L("ptTime")) + '</label><input type="time" id="ptTimeIn" dir="ltr" step="60"></div>' +
      '<p class="ohpt-hint" id="ptSunsetToday"></p>' +
      '<fieldset class="ohpt-fs"><legend>' + esc(L("ptDays")) + '</legend><div class="ohpt-seg ohpt-days" id="ptDays" role="radiogroup" aria-label="' + esc(L("ptDays")) + '">' +
        DAYOPTS.map(function (d) { return '<button type="button" role="radio" class="ohpt-sbtn" data-days="' + d[0] + '" aria-checked="false">' + esc(L(d[1])) + "</button>"; }).join("") + "</div></fieldset>" +
      '<details class="ohpt-more" id="ptMoreBox"><summary>' + esc(L("ptMore")) + "</summary>" +
        '<label for="ptNameEn">' + esc(L("ptNameEn")) + '</label><input type="text" id="ptNameEn" dir="ltr" autocomplete="off" placeholder="' + esc(L("ptNameEnPlaceholder")) + '">' +
        '<fieldset class="ohpt-fs"><legend>' + esc(L("ptKind")) + '</legend><div class="ohpt-seg" id="ptKind" role="radiogroup" aria-label="' + esc(L("ptKind")) + '">' +
          '<button type="button" role="radio" class="ohpt-sbtn" data-kind="fixed" aria-checked="true">' + esc(L("ptKindFixed")) + '</button>' +
          '<button type="button" role="radio" class="ohpt-sbtn" data-kind="sunset" aria-checked="false">' + esc(L("ptKindSunset")) + "</button></div></fieldset>" +
        '<div id="ptSunsetBox" hidden><div class="ohpt-off"><input type="number" id="ptOffMin" min="0" max="180" step="1" inputmode="numeric" dir="ltr" aria-label="' + esc(L("ptOffMin")) + '"><span>' + esc(L("ptOffMin")) + '</span>' +
          '<div class="ohpt-seg small" id="ptSign" role="radiogroup"><button type="button" role="radio" class="ohpt-sbtn" data-sign="-1" aria-checked="true">' + esc(L("ptBefore")) + '</button><button type="button" role="radio" class="ohpt-sbtn" data-sign="1" aria-checked="false">' + esc(L("ptAfter")) + "</button></div></div></div>" +
        '<div class="ohpt-dgrid"><label>' + esc(L("ptFrom")) + '<input type="date" id="ptFrom" dir="ltr"></label><label>' + esc(L("ptUntil")) + '<input type="date" id="ptUntil" dir="ltr"></label></div>' +
      "</details>" +
      '<p class="err" id="ptFormErr" role="alert"></p>' +
      '<div class="row"><button type="submit" class="ohpt-btn primary" id="ptSaveBtn"></button><button type="button" class="ohpt-btn quiet" id="ptCancelBtn">' + esc(L("ptCancel")) + '</button></div></form>' +
      '<p id="ptMsg" class="ohpt-msg" role="status" aria-live="polite"></p>' +
      '<ul id="ptList" class="ohpt-list" aria-labelledby="ptHeading"></ul></div>' +
      '<aside class="ohpt-card ohpt-pv" aria-label="' + esc(L("ptPreviewTitle")) + '"><h3><i aria-hidden="true"></i>' + esc(L("ptPreviewTitle")) + '</h3>' +
      '<div class="ohpt-tv" id="ptTv"></div><p>' + esc(L("ptPreviewNote")) + '</p>' +
      '<a class="ohpt-btn outline" href="../tv/" target="_blank" rel="noopener">' + esc(L("ptPreviewOpen")) + '</a></aside></div>';
    $("ptAddBtn").addEventListener("click", function () { openForm(null); });
    $("ptCancelBtn").addEventListener("click", closeForm);
    $("ptForm").addEventListener("submit", function (e) { e.preventDefault(); save(); });
    $("ptNameHe").addEventListener("input", syncChips);
    $("ptChips").addEventListener("click", function (e) {
      var b = e.target.closest(".ohpt-chip"); if (!b) return;
      var q = quickList()[+b.getAttribute("data-q")]; if (!q) return;
      $("ptNameHe").value = q.he; $("ptNameEn").value = q.en || ""; syncChips(); (S.kind === "sunset" ? $("ptOffMin") : $("ptTimeIn")).focus();
    });
    $("ptDays").addEventListener("click", function (e) { var b = e.target.closest("[data-days]"); if (!b) return; var v = b.getAttribute("data-days"); if (!(v === "sun-thu" && S.days === "weekday")) S.days = v; syncForm(); });
    $("ptKind").addEventListener("click", function (e) { var b = e.target.closest("[data-kind]"); if (b) { S.kind = b.getAttribute("data-kind"); syncForm(); } });
    $("ptSign").addEventListener("click", function (e) { var b = e.target.closest("[data-sign]"); if (b) { S.sign = +b.getAttribute("data-sign"); syncForm(); } });
    ["ptOffMin", "ptFrom", "ptUntil"].forEach(function (id) { $(id).addEventListener("input", sunsetHint); });
    $("ptList").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-act]"); if (!b || S.busy) return;
      var id = b.getAttribute("data-id"), act = b.getAttribute("data-act");
      if (act === "edit") openForm(id);
      else if (act === "del") { S.confirmId = id; render(); var y = $("ptList").querySelector('button[data-act="yes"]'); if (y) y.focus(); }
      else if (act === "no") { S.confirmId = null; render(); }
      else if (act === "yes") remove(id);
    });
  }
  function quickList() {
    var base = L("ptQuickNames") || [], sh = L("ptQuickNamesShabbat") || [];
    return S.days === "shabbat" || S.days === "fri" ? sh.concat(base.filter(function (q) { return !sh.some(function (x) { return x.he === q.he; }); })) : base;
  }
  function syncChips() {
    var v = $("ptNameHe").value.trim(), box = $("ptChips"), list = quickList();
    var html = '<span>' + esc(L("ptQuick")) + "</span>" + list.map(function (q, i) { return '<button type="button" class="ohpt-chip" data-q="' + i + '" aria-pressed="' + (q.he === v ? "true" : "false") + '">' + esc(window.OH_LANG === "en" && q.en ? q.en : q.he) + "</button>"; }).join("");
    if (box.innerHTML !== html) box.innerHTML = html;
  }
  function seg(id, attr, val) { document.querySelectorAll("#" + id + " [" + attr + "]").forEach(function (b) { b.setAttribute("aria-checked", String(b.getAttribute(attr) === String(val))); }); }
  function syncForm() {
    seg("ptDays", "data-days", S.days === "weekday" ? "sun-thu" : S.days); /* a Sunday-to-Friday time (from the command bar) shows under חול and keeps its days */ seg("ptKind", "data-kind", S.kind); seg("ptSign", "data-sign", S.sign);
    $("ptFixedBox").hidden = S.kind !== "fixed"; $("ptSunsetBox").hidden = S.kind !== "sunset";
    syncChips(); sunsetHint();
  }
  function formRule() {
    var from = $("ptFrom").value || "", until = $("ptUntil").value || "";
    if (S.kind === "fixed" && S.days === "all" && !from && !until) return null;
    var off = S.kind === "sunset" ? S.sign * Math.abs(Math.round(+$("ptOffMin").value || 0)) : 0;
    var r = { kind: S.kind, offsetMin: off, days: S.days };
    if (from) r.from = from; if (until) r.until = until;
    return r;
  }
  function sunsetHint() {
    var el = $("ptSunsetToday"); if (!el) return;
    if (S.kind !== "sunset" || !T() || !T().zman) { el.textContent = ""; return; }
    var r = formRule(); if (!r) { el.textContent = ""; return; }
    var d = T().firstDay(r, todayIso(), 400), m = d ? T().sunsetRuleMin(T().zman, d, r.offsetMin) : -1;
    el.textContent = m >= 0 ? (d === todayIso() ? L("ptTodayAt").replace("{time}", to12(m)) : T().dateLoc(d, false) + ": " + to12(m)) : "";
  }
  function whenText(rule) {
    if (!rule || !T()) return "";
    var today = todayIso();
    if (T().ruleApplies(rule, today)) return "";
    var d = T().firstDay(rule, today, 400);
    if (!d) return null;
    if (rule.days === "shabbat" && T().diffDays(today, d) <= 7) return L("ptWhenShabbat");
    if (rule.days === "fri" && T().diffDays(today, d) <= 7) return L("ptWhenFri");
    return L("ptWhenDate").replace("{date}", T().dateLoc(d, false));
  }
  function startPreview() {
    if (S.frame) return;
    var box = $("ptTv"); if (!box) return;
    var f = document.createElement("iframe");
    f.title = L("ptPreviewTitle"); f.setAttribute("tabindex", "-1"); f.setAttribute("aria-hidden", "true");
    f.src = "../tv/";
    box.appendChild(f); S.frame = f;
    var fit = function () { var w = box.clientWidth; if (w) f.style.transform = "scale(" + (w / 1920) + ")"; };
    fit(); if (window.ResizeObserver) new ResizeObserver(fit).observe(box); else window.addEventListener("resize", fit);
  }
  /* Reload the real /tv/ page, then look inside it (same site) until the
     prayer list shows the change. Resolves true when seen, false after ~12 s. */
  function reloadPreview(check) {
    return new Promise(function (resolve) {
      var f = S.frame; if (!f) { resolve(false); return; }
      var done = false, started = Date.now();
      function finish(v) { if (!done) { done = true; resolve(v); } }
      function poll() {
        if (done) return;
        var txt = null;
        try { var el = f.contentDocument && f.contentDocument.getElementById("prayerList"); txt = el ? el.textContent : null; } catch (e) { txt = null; }
        if (txt !== null && check(txt)) { finish(true); return; }
        if (Date.now() - started > 12000) { finish(false); return; }
        setTimeout(poll, 300);
      }
      f.addEventListener("load", function onl() { f.removeEventListener("load", onl); setTimeout(poll, 300); });
      f.src = "../tv/?t=" + Date.now();
    });
  }

  /* The TV list is "up to date" when every saved time is on it (or, with no
     times, its empty line is). A page still loading shows neither. */
  /* 2040 phase 1: the living TV publishes what it shows as window.OH_TV.rows
     ([{id, time, min}], computed times for rule docs); read that when present,
     the older TV is checked by its text as before. */
  function tvRows() { try { var w = S.frame && S.frame.contentWindow; return w && w.OH_TV && Array.isArray(w.OH_TV.rows) ? w.OH_TV.rows : null; } catch (e) { return null; } }
  function tvHasRow(txt, p) {
    var rows = tvRows();
    if (rows) return rows.some(function (r) { return r && r.id === p.id && (p.rule || typeof r.min !== "number" || r.min === itemMinutes(p)); });
    return txt.indexOf(p.time) >= 0 && txt.indexOf(p.nameHe || p.nameEn || "") >= 0;
  }
  /* 2040 phase 1: a doc with a rule (days, dates, sunset) is on the TV only on
     its days, at that day's time; the check looks only at what the TV shows today. */
  function todayItems() {
    var TT = window.OH_TIMES; if (!TT) return S.items;
    var today = TT.nyIso(new Date());
    return S.items.filter(function (p) { return !p.rule || TT.ruleApplies(p.rule, today); });
  }
  function tvShowsList(txt) {
    var items = todayItems();
    if (!items.length) return S.items.length ? true : /אין זמני תפילה|No prayer times/.test(txt);
    if (tvRows()) return items.every(function (p) { return tvHasRow(txt, p); });
    return items.every(function (p) { return p.rule ? txt.indexOf(p.nameHe || p.nameEn || "") >= 0 : tvHasRow(txt, p); });
  }
  function ruleLine(p) { var TT = T(); return p.rule && TT ? (TT.describeRuleLoc || TT.describeRule)(p.rule, p.time) : ""; }
  function shownTime(p) {
    if (!p.rule || p.rule.kind !== "sunset" || !T() || !T().zman) return p.time;
    var m = T().timeOn(p, todayIso(), T().zman); return m >= 0 ? to12(m) : p.time;
  }
  function rowHtml(p) {
    var id = esc(p.id), name = (window.OH_LANG === "en" && p.nameEn) ? p.nameEn : (p.nameHe || p.nameEn || "");
    if (S.confirmId === p.id) {
      var q = String(L("ptConfirmDelete")).replace("{name}", name).replace("{time}", shortTime(p.time));
      return '<li class="ohpt-row confirm" data-id="' + id + '"><span class="q">' + esc(q) + '</span><span class="acts">' +
        '<button type="button" class="ohpt-btn primary" data-act="yes" data-id="' + id + '">' + esc(L("ptConfirmYes")) + '</button>' +
        '<button type="button" class="ohpt-btn outline" data-act="no" data-id="' + id + '">' + esc(L("ptConfirmNo")) + '</button></span></li>';
    }
    var sub = window.OH_LANG === "en" ? (p.nameHe && p.nameHe !== name ? p.nameHe : "") : (p.nameEn && p.nameEn !== name ? p.nameEn : "");
    return '<li class="ohpt-row' + (S.justId === p.id ? ' just' : '') + '" data-id="' + id + '" data-group="' + groupOf(p) + '">' +
      '<span class="t" dir="ltr">' + esc(shownTime(p)) + '</span>' +
      '<span class="n"><b>' + esc(name) + '</b>' + (sub ? '<span' + (window.OH_LANG === "en" ? ' dir="rtl"' : ' dir="ltr"') + '>' + esc(sub) + '</span>' : '') + (p.rule ? '<span class="rl">' + esc(ruleLine(p)) + '</span>' : '') + '</span>' +
      '<span class="acts"><button type="button" class="ohpt-btn outline" data-act="edit" data-id="' + id + '" aria-label="' + esc(L("ptEdit") + " " + name) + '">' + esc(L("ptEdit")) + '</button>' +
      '<button type="button" class="ohpt-btn outline" data-act="del" data-id="' + id + '" aria-label="' + esc(L("ptDelete") + " " + name) + '">' + esc(L("ptDelete")) + '</button></span></li>';
  }
  /* ONE list, grouped by day with simple headers (Hanoch 5:47 AM) */
  function render() {
    var list = $("ptList"); if (!list) return;
    var items = S.items.slice().sort(function (a, b) { return itemMinutes(a) - itemMinutes(b); });
    if (!items.length) { list.innerHTML = '<li class="ohpt-empty" id="ptEmpty">' + esc(L("ptEmpty")) + '</li>'; return; }
    var h = "";
    GROUPS.forEach(function (g) {
      var rows = items.filter(function (p) { return groupOf(p) === g[0]; });
      if (!rows.length) return;
      h += '<li class="ohpt-grp" data-grp="' + g[0] + '" role="presentation"><h3>' + esc(L(g[1])) + "</h3></li>" + rows.map(rowHtml).join("");
    });
    list.innerHTML = h;
  }
  function msg(kind, text) {
    var m = $("ptMsg"); if (!m) return;
    clearTimeout(S.msgTimer);
    m.className = "ohpt-msg" + (kind ? " " + kind : ""); m.textContent = text || "";
    if (kind === "ok") S.msgTimer = setTimeout(function () { if (m.textContent === text) { m.textContent = ""; m.className = "ohpt-msg"; } }, 9000);
  }
  function errText(r, fallbackKey) {
    var c = (r && (r.code || r.reason)) || "";
    return /permission|denied|insufficient/i.test(c) ? L("ptErrDenied") : L(fallbackKey);
  }

  async function load() {
    var fb = window.OH_FIREBASE;
    var r = fb && fb.loadPrayerTimes ? await fb.loadPrayerTimes() : { ok: false };
    if (!r.ok) { msg("err", L("ptErrLoad")); return false; }
    S.items = r.items; render(); return true;
  }

  function openForm(id, days) {
    var p = id ? S.items.filter(function (x) { return x.id === id; })[0] : null;
    S.editId = p ? p.id : null; S.confirmId = null; render();
    var r = p && p.rule;
    S.days = r ? (r.days || "all") : (days || "all");
    S.kind = r && r.kind === "sunset" ? "sunset" : "fixed";
    S.sign = r && r.kind === "sunset" && r.offsetMin > 0 ? 1 : -1;
    $("ptFormTitle").textContent = p ? L("ptFormEditTitle") : L("ptFormAddTitle");
    $("ptSaveBtn").textContent = p ? L("ptSaveEdit") : L("ptSave");
    $("ptNameHe").value = p ? (p.nameHe || "") : "";
    $("ptNameEn").value = p ? (p.nameEn || "") : "";
    $("ptTimeIn").value = p ? to24(itemMinutes(p)) : "";
    $("ptOffMin").value = r && r.kind === "sunset" ? Math.abs(r.offsetMin || 0) : "";
    $("ptFrom").value = (r && r.from) || ""; $("ptUntil").value = (r && r.until) || "";
    $("ptMoreBox").open = !!(p && (p.nameEn || (r && (r.kind === "sunset" || r.from || r.until))));
    $("ptFormErr").textContent = "";
    syncForm();
    var f = $("ptForm"); f.hidden = false;
    msg("", "");
    try { f.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (e) {}
    $("ptNameHe").focus();
  }
  function closeForm() { $("ptForm").hidden = true; S.editId = null; $("ptFormErr").textContent = ""; }

  async function save() {
    if (S.busy) return;
    var he = $("ptNameHe").value.trim(), en = $("ptNameEn").value.trim(), err = $("ptFormErr");
    if (!he) { err.textContent = L("ptNeedName"); $("ptNameHe").focus(); return; }
    var rule = formRule(), min;
    if (rule && rule.from && rule.until && rule.until < rule.from) { err.textContent = L("ptBadRange"); $("ptMoreBox").open = true; $("ptUntil").focus(); return; }
    if (S.kind === "sunset") {
      var ov = $("ptOffMin").value;
      if (ov === "" || !(+ov >= 0 && +ov <= 180)) { err.textContent = L("ptNeedOffset"); $("ptMoreBox").open = true; $("ptOffMin").focus(); return; }
      var TT = T(); if (TT && TT.loadZmanim) { try { await TT.loadZmanim("../"); } catch (e) {} }
      var first = TT ? TT.firstDay(rule, todayIso(), 400) : null;
      if (!first) { err.textContent = L("ptNeverApplies"); return; }
      min = TT.sunsetRuleMin(TT.zman, first, rule.offsetMin);
      if (min < 0) { err.textContent = L("ptNoSunset"); return; }
    } else {
      min = minutesOf24($("ptTimeIn").value);
      if (min < 0) { err.textContent = L("ptNeedTime"); $("ptTimeIn").focus(); return; }
      if (rule && T() && !T().firstDay(rule, todayIso(), 400)) { err.textContent = L("ptNeverApplies"); return; }
    }
    var item = { nameHe: he, nameEn: en, time: to12(min), order: min, rule: rule };
    var fb = window.OH_FIREBASE, editing = S.editId;
    if (!editing && !rule) delete item.rule; /* a plain every-day time is written exactly as before */
    S.busy = true; $("ptSaveBtn").disabled = true; msg("busy", L("ptSaving"));
    var r = editing ? await fb.updatePrayerTime(editing, item) : await fb.savePrayerTime(item);
    S.busy = false; $("ptSaveBtn").disabled = false;
    if (!r || !r.saved) { msg("err", errText(r, "ptErrSave")); return; }
    closeForm(); S.justId = r.id || editing || null;
    await load();
    var later = whenText(rule);
    if (later) { reloadPreview(function (txt) { return tvShowsList(txt); }); msg("ok", L("ptSavedLater").replace("{when}", later)); return; }
    var seen = await reloadPreview(function (txt) { return tvShowsList(txt); });
    msg("ok", seen ? L("ptSaved") : L("ptSavedSlow"));
  }
  async function remove(id) {
    if (S.busy) return;
    var p = S.items.filter(function (x) { return x.id === id; })[0]; if (!p) return;
    var fb = window.OH_FIREBASE;
    S.busy = true; msg("busy", L("ptDeleting"));
    var r = await fb.deletePrayerTime(id);
    S.busy = false; S.confirmId = null;
    if (!r || !r.saved) { render(); msg("err", errText(r, "ptErrDelete")); return; }
    if (S.editId === id) closeForm();
    S.justId = null;
    await load();
    var same = S.items.some(function (x) { return x.nameHe === p.nameHe && x.time === p.time; });
    var seen = await reloadPreview(function (txt) {
      return tvShowsList(txt) && (same || !tvHasRow(txt, p));
    });
    msg("ok", seen ? L("ptDeleted") : L("ptSavedSlow"));
  }

  /* 2040 phase 1: the command bar changed a prayer time: show it here too */
  window.addEventListener("oh-prayertimes-changed", function () { if (S.role) { load().then(function () { try { reloadPreview(function (txt) { return tvShowsList(txt); }); } catch (e) {} }); } });
  window.OH_PT = {
    show: function (role) {
      build();
      var sec = $("ptSection"); sec.hidden = false;
      if (S.role && role && S.role.email === role.email) return;
      S.role = role || {}; S.items = []; S.editId = null; S.confirmId = null;
      startPreview(); load();
      if (T() && T().loadZmanim) T().loadZmanim("../").then(function () { render(); sunsetHint(); }, function () {});
    },
    hide: function () { var sec = $("ptSection"); if (sec) sec.hidden = true; S.role = null; },
    _minutesOf12: minutesOf12, _to12: to12, _to24: to24
  };
})();
