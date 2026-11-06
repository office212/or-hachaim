/* Or Hachaim calendar layer, screen helpers (classic script, optional).
   Load AFTER or-calendar.min.js. It only builds HTML strings and fills elements
   that the page asks it to fill; it never runs by itself, never changes the
   zmanim list, and never touches #zmanList or the countdown.
   Markup uses the same classes as screen.js (zman-row / zn / zt), so the v3
   design (stone + gold + logo navy) applies with no new CSS required.
   All text from the calendar engine is escaped before insertion. */
(function (global) {
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function t12(t) { if (!t) return ""; var p = String(t).split(":"); var h = +p[0] % 12; if (h === 0) h = 12; return h + ":" + p[1]; }
  function row(he, time, extraClass) {
    return '<div class="zman-row' + (extraClass ? " " + extraClass : "") + '"><span class="zn"><span class="he">' + esc(he) + '</span></span><span class="zt" dir="ltr">' + esc(time ? t12(time) : "") + "</span></div>";
  }
  function missingRow(he) { return '<div class="zman-row oh-cal-missing"><span class="zn"><span class="he">' + esc(he) + '</span></span><span class="zt">--</span></div>'; }

  /* Weekly Shabbat block: candles, end, Rabbeinu Tam, parasha, haftarah, special Shabbat, mevarchim. */
  function shabbatBlockHtml(sb) {
    var h = "";
    if (sb.parashaHe) h += '<p class="oh-cal-parasha">' + esc(sb.parashaHe) + "</p>";
    if (sb.special && sb.special.length) h += '<p class="oh-cal-special">' + sb.special.map(function (s) { return esc(s.he); }).join(" | ") + "</p>";
    if (sb.haftarah) h += '<p class="oh-cal-haftarah">הפטרה: ' + esc(sb.haftarah.displayHe) + "</p>";
    if (sb.candleLighting) h += sb.candleLighting.time ? row(sb.candleLighting.label, sb.candleLighting.time) : missingRow(sb.candleLighting.label);
    if (sb.end) {
      h += sb.end.time ? row(sb.end.label, sb.end.time) : missingRow(sb.end.label);
      if (sb.end.rabbeinuTam) h += row("רבינו תם", sb.end.rabbeinuTam);
    } else if (sb.candleLightingSaturdayNight) {
      h += row(sb.candleLightingSaturdayNight.label, sb.candleLightingSaturdayNight.time);
    }
    if (sb.mevarchim) h += '<p class="oh-cal-mevarchim">' + esc(sb.mevarchim.he) + "<br>" + esc(sb.mevarchim.molad.textHe) + "</p>";
    return h;
  }
  /* Rule-based panels (plan 7.9): fast, Yom Tov times, Chanukah, Omer, Kiddush Levana, Eruv Tavshilin, Rosh Chodesh... */
  function panelHtml(p) {
    var h = '<div class="oh-cal-panel oh-cal-' + esc(p.kind) + '" data-panel="' + esc(p.id) + '"><h3>' + esc(p.titleHe) + "</h3>";
    (p.lines || []).forEach(function (l) {
      var label = (l.weekdayHe ? l.weekdayHe + ", " : "") + l.he + (l.note ? " (" + l.note + ")" : "");
      h += l.missing ? missingRow(label) : row(label, l.time);
    });
    return h + "</div>";
  }
  function panelsHtml(state, max) { return state.panels.slice(0, max || 3).map(panelHtml).join(""); }
  /* Seasonal insertions line, e.g. "יעלה ויבוא | ברך עלינו | משיב הרוח ומוריד הגשם" */
  function insertionsHtml(state) {
    var i = state.insertionsNow, parts = [];
    if (i.yaalehVeyavo) parts.push("יעלה ויבוא");
    if (i.alHanisim) parts.push("על הניסים");
    if (i.barechHe) parts.push(i.barechHe);
    if (i.rainHe) parts.push(i.rainHe);
    return '<p class="oh-cal-insertions">' + parts.map(esc).join(" | ") + "</p>";
  }
  /* Fill elements by id, only those that exist on the page. */
  function mount(cal, ids, now) {
    var s = cal.screenState(now || new Date());
    var set = function (id, html) { var el = id && document.getElementById(id); if (el) el.innerHTML = html; };
    if (ids.hebrewDate) set(ids.hebrewDate, esc(s.hebrewDateText));
    if (ids.holiday) set(ids.holiday, s.day.holidays.map(function (x) { return esc(x.he); }).join(" | "));
    if (ids.shabbatBlock) set(ids.shabbatBlock, shabbatBlockHtml(s.shabbatBlock));
    if (ids.panels) set(ids.panels, panelsHtml(s, ids.maxPanels));
    if (ids.insertions) set(ids.insertions, insertionsHtml(s));
    if (global.document && document.body) {
      document.body.classList.toggle("oh-sacred", s.sacred.active);
      document.body.classList.toggle("oh-festive-shabbat", s.festive === "shabbat");
      document.body.classList.toggle("oh-festive-yomtov", s.festive === "yomtov");
      document.body.classList.toggle("oh-tone-fast", s.tone === "fast" || s.tone === "yomkippur");
    }
    return s;
  }
  global.OH_CALENDAR_UI = { shabbatBlockHtml: shabbatBlockHtml, panelsHtml: panelsHtml, panelHtml: panelHtml, insertionsHtml: insertionsHtml, mount: mount, t12: t12 };
})(typeof window !== "undefined" ? window : globalThis);
