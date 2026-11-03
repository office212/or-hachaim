/* Or Hachaim: calendar module -> screen hooks (stage v4, 2026-11-03).
   Load after src/calendar/or-calendar.min.js and screen-calendar.js, before
   screen/content-board.js and screen/screen.js, on /screen/ and /tv/.
   It loads the calendar once (same daily zmanim JSON files, nothing is
   computed here) and adds the two hooks the screen already calls:
     OH_CALENDAR.isRestTime(date)   true from candle lighting until the end
                                    of Shabbat / Yom Tov (sacred.active).
                                    The Display Engine ORs it with its own
                                    check, the safe side.
     OH_CALENDAR.boards(date, rest) the calendar's rule-based panels (plan
                                    7.9: Yom Tov times, fasts, Chanukah,
                                    Omer, Rosh Chodesh, Kiddush Levana,
                                    Eruv Tavshilin...) plus the prayer
                                    insertions line, as centre boards.
   Also: OH_CALENDAR.ready(), OH_CALENDAR.state(date).
   Until the calendar has loaded (or if a file fails), both hooks answer
   "nothing" and the screen works exactly as without the module.
   All text comes from the calendar engine and is escaped. */
(function () {
  "use strict";
  var C = window.OH_CALENDAR, UI = window.OH_CALENDAR_UI;
  if (!C || typeof C.load !== "function") return;
  var cal = null, tries = 0, cacheKey = "", cacheState = null;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function start() {
    C.load({ base: "../src/" }).then(function (c) {
      cal = c;
      try { if (typeof window.renderShabbatBlock === "function") window.renderShabbatBlock(); } catch (e) {}
    }).catch(function () { if (++tries < 5) setTimeout(start, 60000); });
  }
  start();
  /* One state per minute is plenty (the screen ticks every second). */
  function state(date) {
    if (!cal) return null;
    var d = date || new Date(), key = Math.floor(d.getTime() / 60000);
    if (key === cacheKey && cacheState) return cacheState;
    try { cacheState = cal.screenState(d); cacheKey = key; return cacheState; } catch (e) { return null; }
  }
  C.ready = function () { return !!cal; };
  C.state = state;
  C.isRestTime = function (date) { var s = state(date); return !!(s && s.sacred && s.sacred.active); };
  /* v5 (Hanoch, 2026-11-03): prayer insertions (Omer count, יעלה ויבוא,
     על הניסים, עננו, ברך עלינו / ברכנו, משיב הרוח / מוריד הטל) are NOT
     boards: they are a fixed bold line at the top of the centre column
     (C.insertions below). The Yom Tov times are not a board either: they
     are in the right column from erev Yom Tov until it ends (C.yomTov).
     So those panels are left out of the rotation here. */
  var NOT_A_BOARD = { "omer": 1, "rosh-chodesh": 1, "barech-starts": 1, "rain-change": 1, "yomtov-times": 1 };
  C.boards = function (date) {
    var s = state(date); if (!s || !UI) return [];
    return (s.panels || []).filter(function (p) { return !NOT_A_BOARD[p.id] && p.kind !== "insertion" && p.kind !== "omer" && p.kind !== "yomtov"; }).map(function (p) {
      var inner = UI.panelHtml(p).replace(/^<div[^>]*>/, "").replace(/<\/div>$/, "").replace(/<h3>[\s\S]*?<\/h3>/, "");
      return { he: p.titleHe || "", en: "", html: '<div class="cal-rows">' + inner + "</div>", cls: "is-cal" };
    });
  };
  /* The insertions said in the prayer right now, as plain strings, in
     display order. Text only from the calendar engine (and hebcal's
     Omer wording, which the engine marks for the rabbi's approval). */
  C.insertions = function (date) {
    var s = state(date); if (!s) return [];
    var d = s.day || {}, ins = d.insertions || {}, now = s.insertionsNow || {}, after = !!s.hebrewDateSwitchedAtSunset, out = [];
    if (d.omer) { var o = after ? d.omer.tonight : d.omer.today; if (o && (o.nusachHe || o.day)) out.push(o.nusachHe || (o.day + " לעומר")); }
    if (now.yaalehVeyavo) out.push("יעלה ויבוא");
    if (now.alHanisim) out.push("על הניסים");
    if (ins.anenu && !after) out.push("עננו");
    if (ins.barech && ins.barech.startsTonight && !s.sacred.active) out.push("מתחילים הערב לומר ברך עלינו");
    else if (now.barechHe) out.push(now.barechHe);
    if (ins.rain && ins.rain.changesToday && !after) out.push("ממוסף: " + ins.rain.fromMusafHe);
    else if (now.rainHe) out.push(now.rainHe);
    return out;
  };
  /* The Yom Tov stretch times for the right column: from erev Yom Tov
     (the whole day) until the stretch ends (its last time + 5 minutes).
     Returns { titleHe, lines:[{date, weekdayHe, he, time, missing}] } or null. */
  C.yomTov = function (date) {
    var s = state(date); if (!s) return null;
    var p = null; (s.day && s.day.panels || []).forEach(function (x) { if (x.id === "yomtov-times") p = x; });
    if (!p || !p.lines || !p.lines.length) return null;
    var today = s.now.iso, first = p.lines[0].date, lastDate = first, lastMin = -1;
    p.lines.forEach(function (l) { if (l.date < first) first = l.date; if (l.date > lastDate) lastDate = l.date; });
    if (today < first) return null; /* before erev Yom Tov: not yet */
    p.lines.forEach(function (l) { if (l.date === lastDate && l.time) { var m = +l.time.split(":")[0] * 60 + +l.time.split(":")[1]; if (m > lastMin) lastMin = m; } });
    if (today > lastDate || (today === lastDate && lastMin >= 0 && s.now.minutes > lastMin + 5)) return null;
    return { titleHe: p.titleHe, first: first, last: lastDate, lines: p.lines };
  };
  /* v5: the weekly Shabbat data itself (not HTML), for the Shabbat
     section in the right "זמני היום" column. date: any moment; the week is
     the one of that day in New York (Sunday to Shabbat). Read only. */
  function nyIso(d) {
    try {
      var o = {}; new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d).forEach(function (x) { o[x.type] = x.value; });
      return o.year + "-" + o.month + "-" + o.day;
    } catch (e) { return null; }
  }
  C.shabbatInfo = function (date) {
    if (!cal || typeof cal.shabbatBlock !== "function") return null;
    var iso = nyIso(date || new Date()); if (!iso) return null;
    try { return cal.shabbatBlock(iso); } catch (e) { return null; }
  };
  /* The weekly block. When the special-Shabbat line already says
     "שבת מברכים ...", the mevarchim paragraph keeps only the molad line,
     so the same words are not printed twice in the narrow column. */
  C.shabbatBlockHtml = function (date) {
    var s = state(date); if (!s || !UI || !s.shabbatBlock) return null;
    var sb = Object.assign({}, s.shabbatBlock);
    if (sb.mevarchim && sb.special && sb.special.length) {
      var same = sb.special.some(function (x) { return x && x.he === sb.mevarchim.he; });
      if (same) {
        var html = UI.shabbatBlockHtml(Object.assign({}, sb, { mevarchim: null }));
        return html + '<p class="oh-cal-mevarchim">' + esc(sb.mevarchim.molad && sb.mevarchim.molad.textHe || "") + "</p>";
      }
    }
    return UI.shabbatBlockHtml(sb);
  };
})();
