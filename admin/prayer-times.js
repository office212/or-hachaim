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
      { he: "מנחה שבת", en: "Mincha Shabbat" }, { he: "ערבית מוצאי שבת", en: "Arvit Motzei Shabbat" }, { he: "שיעור", en: "Shiur" }],
    /* 2040 phase 2 (Hanoch 2026-11-04 9:09 to 9:10 AM): two clear parts. A weekday time is
       Sunday to Thursday only: Friday Mincha is Erev Shabbat Mincha with Kabbalat Shabbat and
       Friday Arvit is Arvit of Leil Shabbat, so Friday lives with Shabbat. */
    ptSecWeekday: "ימי חול (א׳-ה׳)", ptSecWeekdaySub: "ראשון עד חמישי. לא ביום שישי.",
    ptSecShabbat: "שישי ושבת", ptSecShabbatSub: "ערב שבת, שבת ומוצאי שבת",
    ptAddWeekday: "הוספת זמן לחול", ptAddShabbat: "הוספת זמן לשישי ושבת",
    ptFormAddWeekday: "זמן חדש לימי חול (א׳-ה׳)", ptFormAddShabbat: "זמן חדש לשישי ושבת",
    ptSecEmpty: "עוד אין זמנים כאן.",
    ptDayFriErev: "שישי (ערב שבת)", ptSubFri: "שישי (ערב שבת)", ptSubShabbat: "שבת",
    ptSortTitle: "לסדר", ptSortSub: "הזמנים האלה מופיעים עכשיו כל יום. לחיצה אחת שמה כל זמן במקום שלו.",
    ptSortTo: "לשים ב:", ptSortWeekday: "חול", ptSortFri: "שישי", ptSortShabbat: "שבת",
    ptSortDone: "סודר ✓ {name} עכשיו ב{where}"
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

  var S = { role: null, items: [], editId: null, confirmId: null, justId: null, frame: null, busy: false, built: false, msgTimer: null, sec: "wk", days: "sun-thu", kind: "fixed", sign: -1 };
  /* 2040 phase 2: two parts. In "שישי ושבת" the gabbai picks שישי (ערב שבת) or שבת;
     in "ימי חול" the days are always Sunday to Thursday (rule.days "sun-thu").
     The "כל יום" choice is gone from the form; old documents are still read. */
  var DAYOPTS = [["fri", "ptDayFriErev"], ["shabbat", "ptDayShabbat"]];
  function T() { return window.OH_TIMES; }
  function dowOf(iso) { var m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay() : -1; }
  /* "wk" | "fri" | "shabbat" | "sort". "sort" = shown every day today (no rule, "כל יום",
     or Sunday to Friday): the gabbai puts it in its place with one tap. A one-off from the
     command bar (every day, from = until, or a few days) goes where its dates are. */
  function groupOf(p) {
    var r = p.rule, d = r && r.days;
    if (d === "sun-thu") return "wk";
    if (d === "fri") return "fri";
    if (d === "shabbat") return "shabbat";
    if (r && (d === "all" || !d) && r.from && r.until && T() && T().diffDays && T().diffDays(r.from, r.until) >= 0 && T().diffDays(r.from, r.until) <= 6) {
      var ws = []; for (var i = 0, x = r.from; i <= 6 && x <= r.until; i++, x = T().addDays(x, 1)) ws.push(dowOf(x));
      if (ws.length && ws.every(function (w) { return w >= 0 && w <= 4; })) return "wk";
      if (ws.length && ws.every(function (w) { return w === 5; })) return "fri";
      if (ws.length && ws.every(function (w) { return w === 6; })) return "shabbat";
    }
    return "sort";
  }
  function todayIso() { return T() ? T().nyIso(new Date()) : new Date().toISOString().slice(0, 10); }

  function build() {
    if (S.built) return; S.built = true;
    var sec = $("ptSection");
    var quick = (L("ptQuickNames") || []).map(function (q, i) { return '<button type="button" class="ohpt-chip" data-q="' + i + '" aria-pressed="false">' + esc(q.he) + '</button>'; }).join("");
    sec.innerHTML =
      '<div class="ohpt-head"><div><h2 id="ptHeading">' + esc(L("ptTitle")) + '<small dir="ltr">' + esc(L("ptTitleEn")) + '</small></h2><p class="ohpt-lead oh-help">' + esc(L("ptLead")) + '</p></div></div>' +
      '<div class="ohpt-grid"><div class="ohpt-card ohpt-main">' +
      '<form id="ptForm" class="ohpt-form" hidden novalidate><h3 id="ptFormTitle"></h3>' +
      '<fieldset class="ohpt-fs" id="ptDaysFs"><legend>' + esc(L("ptDays")) + '</legend><div class="ohpt-seg ohpt-days" id="ptDays" role="radiogroup" aria-label="' + esc(L("ptDays")) + '">' +
        DAYOPTS.map(function (d) { return '<button type="button" role="radio" class="ohpt-sbtn" data-days="' + d[0] + '" aria-checked="false">' + esc(L(d[1])) + "</button>"; }).join("") + "</div></fieldset>" +
      '<label for="ptNameHe">' + esc(L("ptNameHe")) + '</label><input type="text" id="ptNameHe" autocomplete="off" placeholder="' + esc(L("ptNameHePlaceholder")) + '">' +
      '<div class="ohpt-chips" id="ptChips" role="group" aria-label="' + esc(L("ptQuick")) + '"></div>' +
      '<div id="ptFixedBox"><label for="ptTimeIn">' + esc(L("ptTime")) + '</label><input type="time" id="ptTimeIn" dir="ltr" step="60"></div>' +
      '<p class="ohpt-hint" id="ptSunsetToday"></p>' +
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
      '<div id="ptList">' +
        '<section class="ohpt-sort" id="ptSort" hidden aria-labelledby="ptSortH"><h3 id="ptSortH">' + esc(L("ptSortTitle")) + '</h3><p class="oh-help">' + esc(L("ptSortSub")) + '</p><ul class="ohpt-list" id="ptListSort"></ul></section>' +
        '<section class="ohpt-sec" id="ptSecWk" data-sec="wk" aria-labelledby="ptSecWkH"><div class="ohpt-sec-head"><div><h3 id="ptSecWkH">' + esc(L("ptSecWeekday")) + '</h3><p class="oh-help">' + esc(L("ptSecWeekdaySub")) + '</p></div>' +
          '<button type="button" class="ohpt-btn primary ohpt-add" id="ptAddWk" data-add="wk"><span class="plus" aria-hidden="true">+</span>' + esc(L("ptAddWeekday")) + '</button></div><ul class="ohpt-list" id="ptListWk"></ul></section>' +
        '<section class="ohpt-sec" id="ptSecSh" data-sec="sh" aria-labelledby="ptSecShH"><div class="ohpt-sec-head"><div><h3 id="ptSecShH">' + esc(L("ptSecShabbat")) + '</h3><p class="oh-help">' + esc(L("ptSecShabbatSub")) + '</p></div>' +
          '<button type="button" class="ohpt-btn primary ohpt-add" id="ptAddSh" data-add="sh"><span class="plus" aria-hidden="true">+</span>' + esc(L("ptAddShabbat")) + '</button></div><ul class="ohpt-list" id="ptListSh"></ul></section>' +
      '</div></div>' +
      '<aside class="ohpt-card ohpt-pv" aria-label="' + esc(L("ptPreviewTitle")) + '"><h3><i aria-hidden="true"></i>' + esc(L("ptPreviewTitle")) + '</h3>' +
      '<div class="ohpt-tv" id="ptTv"></div><p class="oh-help">' + esc(L("ptPreviewNote")) + '</p>' +
      '<a class="ohpt-btn outline" href="../tv/" target="_blank" rel="noopener">' + esc(L("ptPreviewOpen")) + '</a></aside></div>';
    $("ptList").addEventListener("click", function (e) { var b = e.target.closest("[data-add]"); if (b && !S.busy) openForm(null, b.getAttribute("data-add")); });
    $("ptCancelBtn").addEventListener("click", closeForm);
    $("ptForm").addEventListener("submit", function (e) { e.preventDefault(); save(); });
    $("ptNameHe").addEventListener("input", syncChips);
    $("ptChips").addEventListener("click", function (e) {
      var b = e.target.closest(".ohpt-chip"); if (!b) return;
      var q = quickList()[+b.getAttribute("data-q")]; if (!q) return;
      $("ptNameHe").value = q.he; $("ptNameEn").value = q.en || ""; syncChips(); (S.kind === "sunset" ? $("ptOffMin") : $("ptTimeIn")).focus();
    });
    $("ptDays").addEventListener("click", function (e) { var b = e.target.closest("[data-days]"); if (!b) return; S.days = b.getAttribute("data-days"); syncForm(); });
    $("ptKind").addEventListener("click", function (e) { var b = e.target.closest("[data-kind]"); if (b) { S.kind = b.getAttribute("data-kind"); syncForm(); } });
    $("ptSign").addEventListener("click", function (e) { var b = e.target.closest("[data-sign]"); if (b) { S.sign = +b.getAttribute("data-sign"); syncForm(); } });
    ["ptOffMin", "ptFrom", "ptUntil"].forEach(function (id) { $(id).addEventListener("input", sunsetHint); });
    $("ptList").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-act]"); if (!b || S.busy) return;
      var id = b.getAttribute("data-id"), act = b.getAttribute("data-act");
      if (act === "edit") openForm(id);
      else if (act === "sort") sortTo(id, b.getAttribute("data-to"));
      else if (act === "del") { S.confirmId = id; render(); var y = $("ptList").querySelector('button[data-act="yes"]'); if (y) y.focus(); }
      else if (act === "no") { S.confirmId = null; render(); }
      else if (act === "yes") remove(id);
    });
  }
  function quickList() {
    var base = L("ptQuickNames") || [], sh = L("ptQuickNamesShabbat") || [];
    /* 2040 phase 2: Kabbalat Shabbat belongs to Friday, so the weekday part does not offer it */
    return S.sec === "sh" ? sh.concat(base.filter(function (q) { return !sh.some(function (x) { return x.he === q.he; }); })) : base.filter(function (q) { return !sh.some(function (x) { return x.he === q.he; }); });
  }
  function syncChips() {
    var v = $("ptNameHe").value.trim(), box = $("ptChips"), list = quickList();
    var html = '<span>' + esc(L("ptQuick")) + "</span>" + list.map(function (q, i) { return '<button type="button" class="ohpt-chip" data-q="' + i + '" aria-pressed="' + (q.he === v ? "true" : "false") + '">' + esc(window.OH_LANG === "en" && q.en ? q.en : q.he) + "</button>"; }).join("");
    if (box.innerHTML !== html) box.innerHTML = html;
  }
  function seg(id, attr, val) { document.querySelectorAll("#" + id + " [" + attr + "]").forEach(function (b) { b.setAttribute("aria-checked", String(b.getAttribute(attr) === String(val))); }); }
  function syncForm() {
    seg("ptDays", "data-days", S.days); seg("ptKind", "data-kind", S.kind); seg("ptSign", "data-sign", S.sign);
    $("ptDaysFs").hidden = S.sec !== "sh"; /* in "ימי חול" there is nothing to choose: Sunday to Thursday */
    $("ptFixedBox").hidden = S.kind !== "fixed"; $("ptSunsetBox").hidden = S.kind !== "sunset";
    syncChips(); sunsetHint();
  }
  function formRule() {
    var from = $("ptFrom").value || "", until = $("ptUntil").value || "";
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
  /* 2040 phase 2: a time waiting to be put in its place: three big buttons, one tap each */
  function sortRowHtml(p) {
    var id = esc(p.id), name = (window.OH_LANG === "en" && p.nameEn) ? p.nameEn : (p.nameHe || p.nameEn || "");
    var b = function (to, k) { return '<button type="button" class="ohpt-btn outline" data-act="sort" data-to="' + to + '" data-id="' + id + '" aria-label="' + esc(L("ptSortTo") + " " + L(k) + ": " + name) + '">' + esc(L(k)) + "</button>"; };
    return '<li class="ohpt-row sort" data-id="' + id + '" data-group="sort"><span class="t" dir="ltr">' + esc(shownTime(p)) + '</span>' +
      '<span class="n"><b>' + esc(name) + '</b>' + (p.rule ? '<span class="rl">' + esc(ruleLine(p)) + '</span>' : '') + '</span>' +
      '<span class="acts"><span class="to">' + esc(L("ptSortTo")) + "</span>" + b("sun-thu", "ptSortWeekday") + b("fri", "ptSortFri") + b("shabbat", "ptSortShabbat") +
      /* cmdbar+delete (Nov 4): a quieter 4th button, the same delete as every other row (same confirm, same remove()) */
      '<button type="button" class="ohpt-btn quiet del" data-act="del" data-id="' + id + '" aria-label="' + esc(L("ptDelete") + " " + name) + '">' + esc(L("ptDelete")) + "</button></span></li>";
  }
  /* Two clear parts (Hanoch 9:09 AM): ימי חול (א׳-ה׳) | שישי ושבת (שישי, then שבת) */
  function render() {
    var lw = $("ptListWk"), ls = $("ptListSh"), lo = $("ptListSort"), box = $("ptSort"); if (!lw || !ls) return;
    var items = S.items.slice().sort(function (a, b) { return itemMinutes(a) - itemMinutes(b); });
    var by = { wk: [], fri: [], shabbat: [], sort: [] };
    items.forEach(function (p) { by[groupOf(p)].push(p); });
    var empty = '<li class="ohpt-empty small">' + esc(L("ptSecEmpty")) + "</li>";
    lw.innerHTML = by.wk.length ? by.wk.map(rowHtml).join("") : empty;
    var h = "";
    if (by.fri.length) h += '<li class="ohpt-grp" data-grp="fri" role="presentation"><h4>' + esc(L("ptSubFri")) + "</h4></li>" + by.fri.map(rowHtml).join("");
    if (by.shabbat.length) h += '<li class="ohpt-grp" data-grp="shabbat" role="presentation"><h4>' + esc(L("ptSubShabbat")) + "</h4></li>" + by.shabbat.map(rowHtml).join("");
    ls.innerHTML = h || empty;
    box.hidden = !by.sort.length;
    lo.innerHTML = by.sort.map(function (p) { return S.confirmId === p.id ? rowHtml(p) : sortRowHtml(p); }).join("");
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

  function openForm(id, sec) {
    var p = id ? S.items.filter(function (x) { return x.id === id; })[0] : null;
    S.editId = p ? p.id : null; S.confirmId = null; render();
    var r = p && p.rule, g = p ? groupOf(p) : null;
    S.sec = p ? (g === "fri" || g === "shabbat" ? "sh" : "wk") : (sec === "sh" ? "sh" : "wk");
    /* new: חול = Sunday to Thursday; שישי ושבת starts on שבת. An edit keeps its own days. */
    S.days = r ? (r.days || "all") : (S.sec === "sh" ? "shabbat" : "sun-thu");
    S.kind = r && r.kind === "sunset" ? "sunset" : "fixed";
    S.sign = r && r.kind === "sunset" && r.offsetMin > 0 ? 1 : -1;
    $("ptFormTitle").textContent = p ? L("ptFormEditTitle") : L(S.sec === "sh" ? "ptFormAddShabbat" : "ptFormAddWeekday");
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

  /* Activity log (Nov 5): one Hebrew line after a saved change (super admin reads it on gabbai/activity/) */
  function ptLog(sentence, code, target, id) { try { var f = window.OH_FIREBASE; if (f && f.logActivity) f.logActivity(sentence, "", { area: "times", code: code, target: target, targetId: id, collection: "prayerTimes", itemId: id }); } catch (e) {} }
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
    S.busy = true; $("ptSaveBtn").disabled = true; msg("busy", L("ptSaving"));
    var r = editing ? await fb.updatePrayerTime(editing, item) : await fb.savePrayerTime(item);
    S.busy = false; $("ptSaveBtn").disabled = false;
    if (!r || !r.saved) { msg("err", errText(r, "ptErrSave")); return; }
    ptLog((editing ? "עודכן זמן: " : "נוסף זמן: ") + he + " " + item.time, editing ? "times.update" : "times.add", he, r.id || editing);
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
    ptLog("נמחק זמן: " + (p.nameHe || p.nameEn || "") + " " + (p.time || ""), "times.delete", p.nameHe || p.nameEn || "", id);
    if (S.editId === id) closeForm();
    S.justId = null;
    await load();
    var same = S.items.some(function (x) { return x.nameHe === p.nameHe && x.time === p.time; });
    var seen = await reloadPreview(function (txt) {
      return tvShowsList(txt) && (same || !tvHasRow(txt, p));
    });
    msg("ok", seen ? L("ptDeleted") : L("ptSavedSlow"));
  }

  /* 2040 phase 2: one tap puts a time in its place. Writes only the rule (its days),
     keeping the time, the order, the names and any sunset offset or dates. */
  async function sortTo(id, to) {
    if (S.busy || ["sun-thu", "fri", "shabbat"].indexOf(to) < 0) return;
    var p = S.items.filter(function (x) { return x.id === id; })[0]; if (!p) return;
    var rule = Object.assign({ kind: "fixed", offsetMin: 0 }, p.rule || {}, { days: to });
    var fb = window.OH_FIREBASE;
    S.busy = true; msg("busy", L("ptSaving"));
    var r = await fb.setPrayerTimeRule(id, rule);
    S.busy = false;
    if (!r || !r.saved) { msg("err", errText(r, "ptErrSave")); return; }
    ptLog("הועבר זמן ל" + ({ "sun-thu": "חול", fri: "שישי", shabbat: "שבת" }[to]) + ": " + (p.nameHe || p.nameEn || "") + " " + (p.time || ""), "times.days", p.nameHe || p.nameEn || "", id);
    S.justId = id;
    await load();
    var name = (window.OH_LANG === "en" && p.nameEn) ? p.nameEn : (p.nameHe || p.nameEn || "");
    msg("ok", L("ptSortDone").replace("{name}", name).replace("{where}", L(to === "sun-thu" ? "ptSecWeekday" : to === "fri" ? "ptSubFri" : "ptSubShabbat")));
    reloadPreview(function (txt) { return tvShowsList(txt); });
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
