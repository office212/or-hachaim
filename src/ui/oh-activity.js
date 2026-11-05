/* Or Hachaim | Activity log (gabbai/activity/, src/ui/oh-activity.js)
   Hanoch 2026-11-05 7:28 AM: "separate the log completely, but it still records every
   action with time, date and who did what, and only the super admin has access".
   Newest first, 50 lines at a time ("טען עוד"), date and time in New York, who, what.
   The chips filter by kind of action. The super admin only: anyone else sees "אין הרשאה"
   (and the Firestore rules refuse the read anyway). Lines written before Nov 5 (codes
   such as "screenItem.update") are shown with a Hebrew sentence too. */
(function () {
  "use strict";
  var EN = window.OH_LANG === "en";
  var DEF = EN ? {
    title: "Activity log", sub: "Who did what, and when. Only the super admin sees this page.",
    all: "All", finance: "Finance", members: "Members", permissions: "Permissions", join: "Join requests", screen: "Screen",
    times: "Times", texts: "Texts", shabbat: "Shabbat sheet", backup: "Backup",
    more: "Load more", loading: "Loading...", none: "Nothing here yet.", noneFilter: "Nothing of this kind in the lines loaded.",
    shown: "{n} lines shown", end: "That is the whole log.", failed: "Couldn't load the log.", retry: "Try again",
    noAccess: "No access", noAccessD: "This page is for the super admin only.", home: "Home", signIn: "Sign in"
  } : {
    title: "יומן פעולות", sub: "מי עשה מה, ומתי. רק הסופר אדמין רואה את הדף הזה.",
    all: "הכל", finance: "כספים", members: "מתפללים", permissions: "הרשאות", join: "בקשות הצטרפות", screen: "מסך",
    times: "זמנים", texts: "טקסטים", shabbat: "דף השבת", backup: "גיבוי",
    more: "טען עוד", loading: "טוען...", none: "אין עדיין פעולות ביומן.", noneFilter: "אין פעולות מהסוג הזה בשורות שנטענו.",
    shown: "מוצגות {n} שורות", end: "זה כל היומן.", failed: "לא הצלחנו לטעון את היומן.", retry: "נסה שוב",
    noAccess: "אין הרשאה", noAccessD: "הדף הזה רק לסופר אדמין.", home: "לדף הבית", signIn: "כניסה"
  };
  var AREAS = ["finance", "members", "permissions", "join", "screen", "times", "texts", "shabbat", "backup"];
  var PAGE = 50, ROOT = "../../";
  var st = { items: [], last: null, more: true, busy: false, err: "", filter: "all", key: "" };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function $(id) { return document.getElementById(id); }

  /* the kind of a line: new lines carry it; older lines are sorted by what they touched */
  function areaOf(x) {
    var a = x.area, code = String(x.code || x.action || "");
    if (AREAS.indexOf(a) >= 0 && a !== "screen") return a;
    if (x.itemId === "shabbatSheet" || /^shabbatSheet\./.test(code)) return "shabbat";
    if (x.itemId === "screenTexts" || x.itemId === "homeTexts" || a === "site" || /^(screen|home)Texts\./.test(code)) return "texts";
    if (x.collection === "prayerTimes" || /^commandBar\./.test(code)) return "times";
    if (a === "congregants") return /^members\.(approve|decline)/.test(code) ? "join" : /^members\.role/.test(code) ? "permissions" : "members";
    if (a === "ledger" || a === "tax" || a === "recurring") return "finance";
    return "screen";
  }
  var OLD = { "screenItem.create": "נוסף פריט במסך", "screenItem.update": "עודכן פריט במסך", "screenItem.publish": "פורסם במסך",
    "screenItem.unpublish": "הורד מהמסך", "screenItem.archive": "הועבר לארכיון", "screenItem.restore": "שוחזרה גרסה קודמת של פריט במסך",
    "screenTexts.update": "עודכן טקסט במסך", "screenTexts.reset": "טקסט במסך חזר לברירת המחדל", "screenTexts.layout": "שונה סידור החלקים במסך",
    "homeTexts.update": "עודכן טקסט בדף הבית", "homeTexts.reset": "טקסט בדף הבית חזר לברירת המחדל",
    "commandBar.add": "נוסף זמן", "commandBar.update": "עודכן זמן", "commandBar.delete": "נמחק זמן", "commandBar.undo": "בוטל שינוי בזמנים",
    "members.approve": "אושרה בקשת הצטרפות", "members.decline": "נדחתה בקשת הצטרפות", "members.role": "שונתה הרשאה",
    "members.inactive": "מתפלל סומן לא פעיל", "members.reactivate": "מתפלל חזר לפעיל" };
  /* the sentence and a second, smaller line */
  function textOf(x) {
    var a = String(x.action || ""), d = String(x.detail || "");
    /* internal keys (colPrayers: ..., time shacharit) are not shown; the words are */
    d = d.replace(/^[A-Za-z][A-Za-z0-9_]*: /, "");
    if (!/[\u0590-\u05FF]/.test(d) && /^[A-Za-z0-9_ .:-]*$/.test(d)) d = "";
    if (/[\u0590-\u05FF]/.test(a)) return { what: a, detail: d };
    var t = OLD[a] || (/^shabbatSheet\./.test(a) ? "עודכן דף השבת" : a);
    if (/^screenItem\./.test(a) && x.snapshot && (x.snapshot.titleHe || (x.snapshot.yahrzeit && x.snapshot.yahrzeit.nameHe))) t += ": " + (x.snapshot.titleHe || x.snapshot.yahrzeit.nameHe);
    return { what: t, detail: d };
  }
  function when(iso) {
    var d = new Date(iso); if (!iso || isNaN(d)) return "";
    try {
      return d.toLocaleString(EN ? "en-US" : "he-IL", { timeZone: "America/New_York", weekday: "short", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" });
    } catch (e) { return d.toISOString(); }
  }
  function head() { return '<div class="page-head"><div><h1>' + esc(DEF.title) + '</h1><p class="lead oh-help">' + esc(DEF.sub) + "</p></div></div>"; }
  function chips() {
    return '<div class="act-chips" role="group" aria-label="' + esc(DEF.title) + '">' + ["all"].concat(AREAS).map(function (k) {
      var on = st.filter === k;
      return '<button type="button" class="x-chip' + (on ? " sel" : "") + '" data-area="' + k + '" aria-pressed="' + on + '">' + esc(DEF[k]) + "</button>";
    }).join("") + "</div>";
  }
  function rows() {
    var list = st.items.filter(function (x) { return st.filter === "all" || areaOf(x) === st.filter; });
    if (!list.length) return '<p class="act-empty">' + esc(st.busy ? DEF.loading : (st.items.length ? DEF.noneFilter : DEF.none)) + "</p>";
    return '<ol class="act-list">' + list.map(function (x) {
      var t = textOf(x), ar = areaOf(x);
      return '<li class="act-row" data-area="' + ar + '"><span class="act-when">' + esc(when(x.when)) + '</span><span class="act-what">' + esc(t.what) +
        (st.filter === "all" ? '<span class="act-area">' + esc(DEF[ar]) + "</span>" : "") +
        (t.detail ? '<span class="act-detail">' + esc(t.detail) + "</span>" : "") + '<span class="act-who">' + esc(x.who || "") + "</span></span></li>";
    }).join("") + "</ol>";
  }
  function paint() {
    var el = $("ohActivity"); if (!el) return;
    var foot = "";
    if (st.err) foot = '<div class="act-more" role="alert"><span>' + esc(DEF.failed) + '</span><button type="button" class="x-btn primary" id="actRetry">' + esc(DEF.retry) + "</button></div>";
    else if (st.more) foot = '<div class="act-more"><button type="button" class="x-btn primary" id="actMore"' + (st.busy ? " disabled" : "") + ">" + esc(st.busy ? DEF.loading : DEF.more) + "</button><span class=\"oh-help\">" + esc(DEF.shown.replace("{n}", st.items.length)) + "</span></div>";
    else if (st.items.length) foot = '<p class="oh-help act-more">' + esc(DEF.shown.replace("{n}", st.items.length)) + ". " + esc(DEF.end) + "</p>";
    el.innerHTML = head() + chips() + '<section class="x-card" id="actCard">' + rows() + foot + "</section>";
    document.body.setAttribute("data-act-ready", "1");
  }
  async function loadMore() {
    var fb = window.OH_FIREBASE; if (st.busy || !fb || !fb.loadActivity) return;
    st.busy = true; st.err = ""; paint();
    var r = await fb.loadActivity(PAGE, st.last);
    st.busy = false;
    if (!r || !r.ok) { st.err = (r && r.reason) || "error"; try { console.warn("activity log: load failed: " + st.err); } catch (e) {} paint(); return; }
    st.items = st.items.concat(r.items); st.last = r.last || st.last; st.more = !!r.more;
    paint();
  }
  async function tick() {
    var el = $("ohActivity"), fb = window.OH_FIREBASE; if (!el || !fb || !fb.ready) return;
    if (!fb.user) { if (st.key !== "out") { st.key = "out"; el.innerHTML = head() + '<section class="x-card"><button type="button" class="x-btn primary" id="actSignIn">' + esc(DEF.signIn) + "</button></section>"; } return; }
    var role; try { role = await fb.resolveRole(); } catch (e) { role = null; } if (!role) return;
    var key = fb.user.uid + "|" + !!role.isSuperAdmin;
    if (key === st.key) return; st.key = key;
    if (!role.isSuperAdmin) {
      st.items = []; st.last = null;
      el.innerHTML = '<div class="page-head"><div><h1>' + esc(DEF.title) + '</h1></div></div><section class="x-card" id="actNoAccess" role="alert"><h2>' + esc(DEF.noAccess) + '</h2><p class="oh-help">' + esc(DEF.noAccessD) + '</p><a class="x-btn primary" href="' + ROOT + 'gabbai/">' + esc(DEF.home) + "</a></section>";
      document.body.setAttribute("data-act-ready", "noaccess");
      return;
    }
    st.items = []; st.last = null; st.more = true; st.err = ""; st.filter = "all";
    paint(); loadMore();
  }
  document.addEventListener("click", function (e) {
    var c = e.target.closest(".act-chips [data-area]");
    if (c) { st.filter = c.getAttribute("data-area"); paint(); return; }
    if (e.target.closest("#actMore") || e.target.closest("#actRetry")) { loadMore(); return; }
    if (e.target.closest("#actSignIn")) { var f = window.OH_FIREBASE; if (f && f.signIn) { var r = f.signIn(); if (r && r.catch) r.catch(function () {}); } }
  });
  setInterval(tick, 1000); tick();
})();
