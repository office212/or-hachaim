/* Or Hachaim | 2040 phase 1 | חבילת שבת בלחיצה אחת (src/ui/oh-shabbat.js)
   For the coming Shabbat (or ?date=YYYY-MM-DD), gathers from what the system
   already has:
     calendar engine (src/calendar): parasha, Sephardi haftarah, special Shabbat,
       mevarchim + Rosh Chodesh days + molad, candle lighting and Shabbat end
       exactly as the TV shows them (shabbatBlock), the Hebrew date;
     the daily Zemaneh Yosef file: the Shabbat day zmanim, same list as the TV;
     prayerTimes (incl. the optional rule: days, dates, relative to sunset);
     published sponsors / dedications / parnas, published announcements,
     published yahrzeits of that week (the public screen's own selection).
   Builds (a) the printable "עלון שבת" (A4 or Letter, the browser's print / Save
   as PDF) and (b) a TV announcement saved as a DRAFT through the existing
   screen-content flow. Nothing is published until the gabbai presses the
   publish button. No AI, no outside service.
   Shabbat sheet (2026-11-04, Hanoch 1:02 to 1:25 PM): on top of the page, the
   shul's own weekly sheet "דף זמני שבת" with the "לשבת הזאת" screen (change a
   time, hide, add a row, ⭐ one row, PDF / image, Hebrew / English / both, with
   background or clean for printing): src/shabbat-sheet/ (sheet-core.js,
   sheet-draw.js, sheet-editor.js). The bulletin above moved under one button. */
(function () {
  "use strict";
  var DEF = {
    spTitle: "חבילת שבת", spSub: "עלון להדפסה וטיוטה למסך, מוכנים מנתוני המערכת",
    spPrint: "הדפסה או שמירה כקובץ", spDraft: "צור טיוטה למסך", spDraftExists: "כבר יש טיוטה לשבת הזאת",
    spDraftSaved: "טיוטה נשמרה ✓ עדיין לא על המסך", spPublish: "פרסם עכשיו על המסך", spPublished: "פורסם ✓ מופיע עכשיו על המסך",
    spArchive: "בטל את הטיוטה", spArchived: "הטיוטה בוטלה ✓", spPrev: "השבת הקודמת", spNext: "השבת הבאה",
    spSignIn: "כניסה", spLoading: "מכין את חבילת השבת...",
    spFailed: "השמירה נכשלה, שום דבר לא השתנה. נסו שוב", spBulletin: "עלון שבת", spShul: "בית הכנסת אור החיים",
    spShabbatTimes: "זמני השבת", spDayTimes: "זמני היום בשבת", spPrayers: "זמני תפילה", spReading: "קריאת התורה",
    spMevarchim: "שבת מברכים", spSponsors: "חסויות והקדשות", spYahrzeit: "יארצייט השבוע", spNotices: "הודעות",
    spFooter: "321 Harold St, Staten Island, NY 10314 | orhachaimsi.org", spPreviewTitle: "כך תיראה ההודעה על המסך",
    spMore: "העלון המורחב", spLess: "סגירת העלון"
  };
  var DEF_EN = { spMore: "Full bulletin", spLess: "Close the bulletin" };
  function L(k) { var o = window.OH_LABELS || {}; return (o[k] !== undefined && o[k] !== null && o[k] !== "") ? o[k] : (window.OH_LANG === "en" && DEF_EN[k]) || DEF[k]; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function escT(s) { return esc(s).replace(/\b(\d{1,2}:\d{2}(?:\s?[AP]M)?)/g, '<bdi dir="ltr">$1</bdi>'); }
  function T() { return window.OH_TIMES; }
  function fb() { return window.OH_FIREBASE; }
  function now() { return window.OH_TEST_NOW ? new Date(window.OH_TEST_NOW) : new Date(); }
  function rootPath() { var s = document.querySelector('script[src*="oh-shabbat.js"]'); var src = s ? s.getAttribute("src") : "../../src/ui/oh-shabbat.js"; return src.replace(/src\/ui\/oh-shabbat\.js.*$/, ""); }
  function t12(hhmm) { if (!hhmm) return ""; var p = String(hhmm).split(":"); var h = +p[0] % 12 || 12; return h + ":" + p[1]; }
  var ZLIST = [["alot", "עלות השחר (שוות)"], ["talis", "זמן טלית ותפילין"], ["netz", "נץ החמה"], ["shemaMagen", "סוף זמן קריאת שמע מגן אברהם (שוות)"], ["shemaGra", "סוף זמן קריאת שמע גרא"], ["tefillah", "סוף זמן תפילה"], ["chatzot", "חצות יום"], ["minchaGedola", "מנחה גדולה"], ["plag", "פלג המנחה"], ["shkiah", "שקיעה"]];

  var st = { el: null, data: null, draft: null, busy: false, msg: "" };

  /* ---------- gather (pure given its inputs; the tests call it too) ---------- */
  function gather(inp) {
    var t = T(), E = window.OH_DISPLAY, sh = inp.shabbat, fri = t.addDays(sh, -1), sb = inp.sb || {}, day = inp.day || {};
    var g = { shabbat: sh, friday: fri, parashaHe: sb.parashaHe || (day.holidays && day.holidays[0] && day.holidays[0].he) || "", hebrewDate: day.hebrew && day.hebrew.text || "",
      special: (sb.special || []).map(function (x) { return x.he; }), haftarah: sb.haftarah ? sb.haftarah.displayHe : "", candle: null, end: null, rt: null, satNightCandle: null,
      roshChodesh: day.roshChodesh ? day.roshChodesh.he : "", mevarchim: null, zmanim: [], prayers: { daily: [], fri: [], sat: [] }, sponsors: [], yahrzeits: [], notices: [] };
    if (sb.candleLighting && sb.candleLighting.time) g.candle = sb.candleLighting.time;
    if (sb.end) { g.end = sb.end.time || null; g.rt = sb.end.rabbeinuTam || null; }
    if (sb.candleLightingSaturdayNight) g.satNightCandle = { label: sb.candleLightingSaturdayNight.label, time: sb.candleLightingSaturdayNight.time };
    if (sb.mevarchim) g.mevarchim = { he: sb.mevarchim.he, days: (sb.mevarchim.roshChodeshDays || []).map(function (d) { return d.weekdayHe + " " + t.dateShort(d.date); }), molad: sb.mevarchim.molad ? sb.mevarchim.molad.textHe : "" };
    var z = inp.daily && inp.daily[sh];
    if (z) ZLIST.forEach(function (m) { if (z[m[0]]) g.zmanim.push({ he: m[1], time: t12(z[m[0]]) }); });
    (inp.docs || []).forEach(function (d) {
      if (!d.rule) { g.prayers.daily.push({ he: d.nameHe, time: t.short12(t.min12(d.time) >= 0 ? t.min12(d.time) : d.order), order: t.min12(d.time) >= 0 ? t.min12(d.time) : d.order }); return; }
      [["fri", fri], ["sat", sh]].forEach(function (x) {
        var m = t.timeOn(d, x[1], inp.zman, inp.isYomTov);
        if (m >= 0) g.prayers[x[0]].push({ he: d.nameHe, time: t.short12(m), order: m, note: d.rule.kind === "sunset" ? t.offsetHe(d.rule.offsetMin) : "" });
      });
    });
    ["daily", "fri", "sat"].forEach(function (k) { g.prayers[k].sort(function (a, b) { return a.order - b.order; }); });
    var items = (inp.items || []).filter(function (x) { return x.status === "published" && x.visibility !== "screen"; });
    if (E) {
      items.forEach(function (it) {
        if (it.type === "yahrzeit") { var y = E.yahrzeitActive(it.yahrzeit || {}, sh); if (y) g.yahrzeits.push({ name: (it.yahrzeit && it.yahrzeit.nameHe) || "", date: E.hebrewDayMonthLabel ? E.hebrewDayMonthLabel(+it.yahrzeit.hDay, it.yahrzeit.hMonth) : "" }); return; }
        var on = (!it.startDate || it.startDate <= sh) && (!it.endDate || it.endDate >= fri);
        if (!on) return;
        if (it.type === "sponsor" || it.type === "dedication" || it.type === "parnas") g.sponsors.push({ text: it.titleHe || it.bodyHe || "", sub: it.subtype || "" });
        else if (it.type === "announcement" || it.type === "rabbi" || it.type === "mazaltov" || it.type === "hazkara") g.notices.push({ text: it.titleHe || it.bodyHe || "" });
      });
    }
    g.sponsors.sort(function (a, b) { var o = { kiddush: 0, seudah3: 1 }; return (o[a.sub] != null ? o[a.sub] : 2) - (o[b.sub] != null ? o[b.sub] : 2); });
    return g;
  }
  /* the TV announcement text (draft), short */
  function draftItem(g) {
    var t = T(), parts = [];
    if (g.candle) parts.push("הדלקת נרות " + t12(g.candle));
    if (g.end) parts.push("צאת השבת " + t12(g.end));
    g.special.forEach(function (s) { parts.push(s); });
    if (g.haftarah) parts.push("הפטרה: " + g.haftarah);
    var kid = g.sponsors.filter(function (s) { return s.sub === "kiddush"; })[0];
    if (kid) parts.push(kid.text);
    var start = t.addDays(g.shabbat, -2), today = t.nyIso(now());
    return { type: "announcement", titleHe: "שבת שלום" + (g.parashaHe ? " | " + g.parashaHe : ""), bodyHe: parts.join(" | "),
      startDate: start < today ? today : start, endDate: g.shabbat, showOn: "all", status: "draft" };
  }

  /* ---------- the bulletin ---------- */
  function rowsHtml(list) { return list.map(function (r) { return '<div class="sh-r"><span>' + esc(r.he) + (r.note ? ' <small>(' + esc(r.note) + ")</small>" : "") + '</span><b dir="ltr">' + esc(r.time) + "</b></div>"; }).join(""); }
  function sheetHtml(g) {
    var t = T(), h = "";
    h += '<article class="sh-sheet" id="ohShSheet" dir="rtl">';
    h += '<header class="sh-head"><img src="' + rootPath() + 'src/assets/logo.svg" alt="אור החיים"><div class="sh-ht"><span class="sh-kicker">' + esc(L("spShul")) + " | " + esc(L("spBulletin")) + '</span><h1>' + esc(g.parashaHe || "שבת קודש") + '</h1><span class="sh-date">' + esc("שבת קודש " + g.hebrewDate) + " | " + esc(t.dateShort(g.shabbat) + "." + g.shabbat.slice(0, 4)) + "</span>" +
      (g.special.length || g.roshChodesh ? '<span class="sh-special">' + esc(g.special.concat(g.roshChodesh && g.special.indexOf("שבת ראש חודש") < 0 ? [g.roshChodesh] : []).join(" | ")) + "</span>" : "") + "</div></header>";
    h += '<div class="sh-band"><div><span>הדלקת נרות</span><b dir="ltr">' + esc(t12(g.candle) || "--") + '</b><small>יום שישי ' + esc(t.dateShort(g.friday)) + '</small></div><div><span>צאת השבת</span><b dir="ltr">' + esc(t12(g.end) || (g.satNightCandle ? "" : "--")) + "</b>" + (g.rt ? '<small>רבינו תם (המוקדם) <bdi dir="ltr">' + esc(t12(g.rt)) + "</bdi></small>" : "") + "</div>" +
      (g.satNightCandle ? '<div><span>' + esc(g.satNightCandle.label) + '</span><b dir="ltr">' + esc(t12(g.satNightCandle.time)) + "</b></div>" : "") + "</div>";
    h += '<div class="sh-cols"><section class="sh-box"><h2>' + esc(L("spPrayers")) + "</h2>";
    var any = false;
    if (g.prayers.fri.length) { any = true; h += '<h3>ערב שבת</h3>' + rowsHtml(g.prayers.fri); }
    if (g.prayers.sat.length) { any = true; h += '<h3>שבת</h3>' + rowsHtml(g.prayers.sat); }
    if (g.prayers.daily.length) { any = true; h += (g.prayers.fri.length || g.prayers.sat.length ? "<h3>כל יום</h3>" : "") + rowsHtml(g.prayers.daily); }
    if (!any) h += '<p class="sh-empty">עוד לא הוזנו זמני תפילה</p>';
    h += '</section><section class="sh-box"><h2>' + esc(L("spDayTimes")) + "</h2>" + (g.zmanim.length ? rowsHtml(g.zmanim) : '<p class="sh-empty">אין נתונים לתאריך הזה</p>') + "</section></div>";
    h += '<div class="sh-cols"><section class="sh-box"><h2>' + esc(L("spReading")) + "</h2>" + (g.parashaHe ? "<p><b>" + esc(g.parashaHe) + "</b></p>" : "") + (g.haftarah ? "<p>הפטרה: " + esc(g.haftarah) + "</p>" : "") + "</section>";
    if (g.mevarchim) h += '<section class="sh-box"><h2>' + esc(g.mevarchim.he) + "</h2><p>ראש חודש: " + esc(g.mevarchim.days.join(" ו")) + "</p>" + (g.mevarchim.molad ? "<p>" + escT(g.mevarchim.molad) + "</p>" : "") + "</section>";
    else if (g.roshChodesh) h += '<section class="sh-box"><h2>ראש חודש</h2><p>' + esc(g.roshChodesh) + "</p><p>יעלה ויבוא</p></section>";
    h += "</div>";
    if (g.sponsors.length || g.yahrzeits.length) {
      h += '<div class="sh-cols">';
      if (g.sponsors.length) h += '<section class="sh-box"><h2>' + esc(L("spSponsors")) + "</h2>" + g.sponsors.map(function (s) { return "<p>" + esc(s.text) + "</p>"; }).join("") + "</section>";
      if (g.yahrzeits.length) h += '<section class="sh-box"><h2>' + esc(L("spYahrzeit")) + "</h2>" + g.yahrzeits.map(function (y) { return "<p>" + esc(y.name) + (y.date ? " <small>(" + esc(y.date) + ")</small>" : "") + "</p>"; }).join("") + "</section>";
      h += "</div>";
    }
    if (g.notices.length) h += '<section class="sh-box sh-wide"><h2>' + esc(L("spNotices")) + "</h2>" + g.notices.slice(0, 5).map(function (n) { return "<p>" + esc(n.text) + "</p>"; }).join("") + "</section>";
    h += '<footer class="sh-foot">' + esc(L("spFooter")) + "</footer></article>";
    return h;
  }

  /* ---------- page ---------- */
  function targetShabbat() {
    var t = T(), q = (location.search.match(/[?&]date=(\d{4}-\d{2}-\d{2})/) || [])[1];
    return t.comingShabbat(q && t.isIso(q) ? q : t.nyIso(now()));
  }
  function nav(sh) {
    var t = T(), base = location.pathname;
    return '<div class="sh-nav no-print"><a class="x-btn" href="' + base + "?date=" + t.addDays(sh, -7) + '">' + esc(L("spPrev")) + '</a><a class="x-btn" href="' + base + "?date=" + t.addDays(sh, 7) + '">' + esc(L("spNext")) + "</a></div>";
  }
  function controls() {
    var d = st.draft, h = '<div class="x-card sh-ctl no-print" id="ohShCtl"><div class="sh-ctl-row">';
    if (!d) h += '<button type="button" class="x-btn" id="ohShDraft">' + esc(L("spDraft")) + "</button>";
    else if (d.status === "draft") h += '<button type="button" class="x-btn primary" id="ohShPublish">' + esc(L("spPublish")) + '</button><button type="button" class="x-btn ghost" id="ohShArchive">' + esc(L("spArchive")) + "</button>";
    h += "</div>";
    if (st.msg) h += '<div class="cb-msg ' + (st.msgKind || "ok") + '" id="ohShMsg" style="margin-top:12px"><div class="grow"><b>' + esc(st.msg) + "</b></div></div>";
    var it = d || draftItem(st.data);
    h += '<div class="sh-tv"><span class="sh-tv-l">' + esc(L("spPreviewTitle")) + (d ? " | " + (d.status === "published" ? "מפורסם" : "טיוטה") : "") + '</span><b>' + esc(it.titleHe) + "</b><p>" + escT(it.bodyHe) + "</p></div></div>";
    return h;
  }
  function render() {
    if (!st.el || !st.data) return;
    /* the sheet screen (#ohSheetEd) is built once per page and keeps its own state */
    if (!document.getElementById("ohShTop")) st.el.innerHTML = '<div id="ohShTop"></div><div id="ohSheetEd" class="no-print"></div><div id="ohShRest"></div>';
    document.getElementById("ohShTop").innerHTML = '<div class="page-head no-print"><div><h1>' + esc(L("spTitle")) + '</h1><p class="lead oh-help">' + esc(L("spSub")) + "</p></div>" + nav(st.data.shabbat) + "</div>";
    var more = '<div class="sh-more no-print"><button type="button" class="x-btn ghost" id="ohShMore" aria-expanded="' + !!st.showBulletin + '">' + esc(L(st.showBulletin ? "spLess" : "spMore")) + "</button>" +
      (st.showBulletin ? ' <button type="button" class="x-btn" id="ohShPrint">' + esc(L("spPrint")) + "</button>" : "") + "</div>";
    document.getElementById("ohShRest").innerHTML = controls() + more + (st.showBulletin ? sheetHtml(st.data) : "");
  }
  async function findDraft(g) {
    var SC = window.OH_SCREEN_CONTENT; if (!SC) return null;
    return new Promise(function (res) {
      var done = false, un = SC.subscribe("editor", function (items) {
        if (done) return; done = true; try { un(); } catch (e) {}
        var want = draftItem(g);
        var hit = (items || []).filter(function (x) { return x.type === "announcement" && x.status !== "archived" && x.titleHe === want.titleHe && x.endDate === g.shabbat; })[0];
        res(hit || null);
      });
      setTimeout(function () { if (!done) { done = true; try { un(); } catch (e) {} res(null); } }, 8000);
    });
  }
  async function load(role) {
    var t = T(), sh = targetShabbat(), root = rootPath();
    st.el.innerHTML = '<p class="lead">' + esc(L("spLoading")) + "</p>";
    var cal = await window.OH_CALENDAR.load({ base: root + "src/", files: { zmanim: ["zmanim/roy-daily-5787.json"] } }).catch(function () { return null; });
    await t.loadZmanim(root);
    var daily = await fetch(root + "src/zmanim/roy-daily-5787.json").then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    var docs = []; var r = await fb().loadPrayerTimes(); if (r && r.ok) docs = r.items;
    var items = await new Promise(function (res) { var done = false, un = window.OH_SCREEN_CONTENT.subscribe("editor", function (it) { if (done) return; done = true; try { un(); } catch (e) {} res(it || []); }); setTimeout(function () { if (!done) { done = true; res([]); } }, 8000); });
    var sb = null, day = null; try { sb = cal ? cal.shabbatBlock(sh) : null; day = cal ? cal.day(sh) : null; } catch (e) {}
    st.data = gather({ shabbat: sh, sb: sb, day: day, daily: daily && daily.days, zman: t.zman, isYomTov: cal && cal.isYomTov ? function (iso) { try { return !!cal.isYomTov(iso); } catch (e) { return false; } } : null, docs: docs, items: items });
    var isYT = cal && cal.isYomTov ? function (iso) { try { return !!cal.isYomTov(iso); } catch (e) { return false; } } : null;
    var sheetSettings = {}; try { var sdb = fb()._db && fb()._db(); if (sdb) { var sd = await sdb.collection("settings").doc("shabbatSheet").get(); if (sd.exists) sheetSettings = sd.data() || {}; } } catch (e) {}
    var want = draftItem(st.data);
    st.draft = (items || []).filter(function (x) { return x.type === "announcement" && x.status !== "archived" && x.titleHe === want.titleHe && x.endDate === sh; })[0] || null;
    if (st.draft) { st.msg = st.draft.status === "published" ? L("spPublished") : L("spDraftExists"); st.msgKind = st.draft.status === "published" ? "ok" : "warn"; }
    render();
    if (window.OH_SHEET_EDITOR) {
      try {
        window.OH_SHEET_EDITOR.mount(document.getElementById("ohSheetEd"), { shabbat: sh, sb: sb, days: (daily && daily.days) || {}, docs: docs, settings: sheetSettings, ptHref: root + "admin/#ptSection",
          timeOf: function (d, iso) { return t.timeOn(d, iso, t.zman, isYT); } });
      } catch (e) {}
    }
    document.body.setAttribute("data-sh-ready", sh);
  }
  async function act(id) {
    if (st.busy) return; st.busy = true;
    var SC = window.OH_SCREEN_CONTENT, r = null;
    try {
      if (id === "ohShPrint") { st.busy = false; window.print(); return; }
      if (id === "ohShDraft") { var it = draftItem(st.data); r = await SC.save(it, "create"); if (r && r.saved) { st.draft = Object.assign({}, it, { id: r.id, col: r.col }); st.msg = L("spDraftSaved"); st.msgKind = "ok"; } }
      if (id === "ohShPublish" && st.draft) { var d = Object.assign({}, st.draft, { col: st.draft.col || "announcements" }); r = await SC.setStatus(d, "published"); if (r && r.saved) { st.draft.status = "published"; st.msg = L("spPublished"); st.msgKind = "ok"; } }
      if (id === "ohShArchive" && st.draft) { var a = Object.assign({}, st.draft, { col: st.draft.col || "announcements" }); r = await SC.setStatus(a, "archived"); if (r && r.saved) { st.draft = null; st.msg = L("spArchived"); st.msgKind = "ok"; } }
      if (r && !r.saved) { st.msg = L("spFailed"); st.msgKind = "warn"; }
    } catch (e) { st.msg = L("spFailed"); st.msgKind = "warn"; }
    st.busy = false; render();
  }
  async function tick() {
    var el = document.getElementById("ohShabbat"), f = fb(); if (!el) return;
    if (!f || !f.ready) return;
    if (!f.user) { if (el.getAttribute("data-state") !== "out") { el.setAttribute("data-state", "out"); el.innerHTML = '<section class="x-card" id="ohShGate"><h2>' + esc(L("spTitle")) + '</h2><button type="button" class="x-btn primary" id="ohShSignIn">' + esc(L("spSignIn")) + "</button></section>"; } return; }
    var role; try { role = await f.resolveRole(); } catch (e) { role = null; } if (!role) return;
    var can = role.isSuperAdmin || role.canScreen;
    var key = f.user.uid + (can ? "|in" : "|no");
    if (el.getAttribute("data-state") === key) return;
    el.setAttribute("data-state", key);
    if (!can) { location.replace("../"); return; } /* not theirs: home, no message (Hanoch 5:46 AM) */
    st.el = el; load(role);
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    if (b.id === "ohShSignIn") { var f = fb(); if (f && f.signIn) { var r = f.signIn(); if (r && r.catch) r.catch(function () {}); } return; }
    if (b.id === "ohShMore") { st.showBulletin = !st.showBulletin; render(); return; }
    if (/^ohSh(Print|Draft|Publish|Archive)$/.test(b.id)) act(b.id);
  });
  window.OH_SHABBAT = { gather: gather, draftItem: draftItem, sheetHtml: sheetHtml, _state: st };
  setInterval(tick, 1000); tick();
})();
