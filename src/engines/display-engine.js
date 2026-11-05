/* Display Engine, screen content rules (stage v4, 2026-11-03).
   Pure logic, no Firebase, no DOM: the same file runs in the browser
   (window.OH_DISPLAY) and in Node tests (module.exports).

   What it decides:
   1. Rest time (Shabbat and Yom Tov, chutz laaretz), so weekday items,
      payment text, Zelle and donation QR are hidden by the SYSTEM, not
      by the gabbai's memory. Shabbat window: Friday candle lighting
      (candle18 in the daily JSON) until Shabbat ends (MyZmanim value).
      Yom Tov days are found with the browser's own Hebrew calendar
      (Intl, ca-hebrew), diaspora list: 1-2 Tishrei, 10 Tishrei,
      15-16 Tishrei, 22-23 Tishrei, 15-16 Nisan, 21-22 Nisan, 6-7 Sivan.
      A Yom Tov next to Shabbat is one continuous rest stretch.
      This is used ONLY to hide items and stop the burn-in drift; it
      never prints a holiday time. If the calendar module
      (src/calendar/, separate work) is loaded and exposes
      window.OH_CALENDAR.isRestTime(date), its answer is added: an item
      is hidden when EITHER says rest (safe side).
   2. Date window: an item shows only from startDate to endDate
      (New York dates, inclusive).
   3. Weekday only: by the gabbai's flag, and FORCED for donation and
      campaign items and for any text that looks like payment (Zelle,
      QR, donate, $ ...), even if the flag was not set.
   4. Yahrzeit: entered once (Hebrew day and month, optional year of
      death), shown every year in the week of the yahrzeit. Edge cases
      (see yahrzeitDate): Adar in a leap year, Adar I / Adar II,
      30 Cheshvan and 30 Kislev in a year that has no 30th.
   Nothing here invents text: it only selects and orders what a gabbai
   entered. */
(function (root) {
  "use strict";
  var TZ = "America/New_York";

  /* ---------- dates (New York) ---------- */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function nyParts(date) {
    var d = date || new Date();
    var parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" }).formatToParts(d);
    var o = {}; parts.forEach(function (p) { o[p.type] = p.value; });
    var wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[o.weekday];
    return { key: o.year + "-" + o.month + "-" + o.day, wd: wd, mins: (parseInt(o.hour, 10) % 24) * 60 + parseInt(o.minute, 10) };
  }
  function keyToUTC(key) { var p = key.split("-"); return Date.UTC(+p[0], +p[1] - 1, +p[2], 12, 0, 0); }
  function addDays(key, n) { var d = new Date(keyToUTC(key) + n * 86400000); return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate()); }
  function weekdayOf(key) { return new Date(keyToUTC(key)).getUTCDay(); }
  function mins(t) { if (!t) return null; var p = String(t).split(":"); return parseInt(p[0], 10) * 60 + parseInt(p[1], 10); }
  function isDateKey(v) { return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v); }

  /* ---------- Hebrew calendar via Intl ---------- */
  var MONTHS = ["tishrei", "cheshvan", "kislev", "tevet", "shevat", "adar1", "adar2", "adar", "nisan", "iyar", "sivan", "tamuz", "av", "elul"];
  var MONTH_HE = { tishrei: "תשרי", cheshvan: "חשוון", kislev: "כסלו", tevet: "טבת", shevat: "שבט", adar: "אדר", adar1: "אדר א׳", adar2: "אדר ב׳", nisan: "ניסן", iyar: "אייר", sivan: "סיוון", tamuz: "תמוז", av: "אב", elul: "אלול" };
  var MONTH_ALIASES = { tishri: "tishrei", tishrei: "tishrei", heshvan: "cheshvan", cheshvan: "cheshvan", marcheshvan: "cheshvan", kislev: "kislev", tevet: "tevet", teves: "tevet", shevat: "shevat", shvat: "shevat", "adar i": "adar1", "adar ii": "adar2", adar: "adar", nisan: "nisan", iyar: "iyar", iyyar: "iyar", sivan: "sivan", tamuz: "tamuz", tammuz: "tamuz", av: "av", elul: "elul" };
  var hebFmt = null, hebCache = {};
  function hebParts(key) {
    if (hebCache[key]) return hebCache[key];
    if (!hebFmt) hebFmt = new Intl.DateTimeFormat("en-u-ca-hebrew", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });
    var o = {}; hebFmt.formatToParts(new Date(keyToUTC(key))).forEach(function (p) { o[p.type] = p.value; });
    var m = MONTH_ALIASES[String(o.month || "").toLowerCase()] || String(o.month || "").toLowerCase();
    var r = { day: parseInt(o.day, 10), month: m, year: parseInt(o.year, 10) };
    hebCache[key] = r; return r;
  }
  function isLeapYear(hy) { return ((7 * hy + 1) % 19) < 7; }
  /* Every day of Hebrew year hy, found by walking the Gregorian days
     around it once and asking Intl. Cached per year. */
  var yearCache = {};
  function hebrewYear(hy) {
    if (yearCache[hy]) return yearCache[hy];
    var g = hy - 3761, key = g + "-08-15", idx = {}, len = {};
    for (var i = 0; i < 420; i++) {
      var h = hebParts(key);
      if (h.year === hy) { idx[h.month + "-" + h.day] = key; len[h.month] = Math.max(len[h.month] || 0, h.day); }
      if (h.year > hy) break;
      key = addDays(key, 1);
    }
    yearCache[hy] = { idx: idx, len: len, leap: isLeapYear(hy) };
    return yearCache[hy];
  }
  function gregorianOf(hy, month, day) { return hebrewYear(hy).idx[month + "-" + day] || null; }
  function monthLength(hy, month) { return hebrewYear(hy).len[month] || 0; }

  function hebrewNumeral(n) {
    var ones = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"], tens = ["", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ"];
    var hund = ["", "ק", "ר", "ש", "ת", "תק", "תר", "תש", "תת", "תתק"];
    var s = hund[Math.floor(n / 100)]; n = n % 100;
    if (n === 15) s += "טו"; else if (n === 16) s += "טז"; else s += tens[Math.floor(n / 10)] + ones[n % 10];
    return s.length > 1 ? s.slice(0, -1) + "\u05F4" + s.slice(-1) : s + "\u05F3";
  }
  function hebrewDayMonthLabel(day, month) { return hebrewNumeral(day) + " " + (MONTH_HE[month] || month); }

  /* ---------- Yom Tov (diaspora) and rest time ---------- */
  var YOMTOV = { "tishrei-1": "ראש השנה", "tishrei-2": "ראש השנה", "tishrei-10": "יום הכיפורים", "tishrei-15": "סוכות", "tishrei-16": "סוכות",
    "tishrei-22": "שמיני עצרת", "tishrei-23": "שמחת תורה", "nisan-15": "פסח", "nisan-16": "פסח", "nisan-21": "שביעי של פסח", "nisan-22": "אחרון של פסח",
    "sivan-6": "שבועות", "sivan-7": "שבועות" };
  function yomTovName(key) { var h = hebParts(key); return YOMTOV[h.month + "-" + h.day] || null; }
  function isRestDay(key) { return weekdayOf(key) === 6 || !!yomTovName(key); }
  /* restState(now, dayLookup): dayLookup(key) returns that day's row of
     the daily zmanim JSON (or null). Returns {rest, reason, label}.
     Start: candle18 on the day before the stretch (16:00 when the row
     is missing, the safe side). End: Shabbat ends (MyZmanim) on a
     Shabbat, otherwise the 8.5 degree nightfall field of that day + 1
     minute (later than plain tzeit, the safe side for hiding); when the row is
     missing, the whole day counts as rest. */
  /* Hardening (2026-11-05, Hanoch): when a day has no MyZmanim end, the 8.5
     degree field is used + 1 minute (never early: it ran 1 minute before
     MyZmanim on 12 of 55 Saturdays). The same rule as the calendar layer. */
  function anglePlus1(t) {
    if (!t) return t;
    var q = String(t).split(":"), h = +q[0], n = +q[1];
    if (q.length < 2 || !isFinite(h) || !isFinite(n)) return t;
    var x = h * 60 + n + 1;
    return String(Math.floor(x / 60) % 24).padStart(2, "0") + ":" + String(x % 60).padStart(2, "0");
  }
  function restState(now, dayLookup) {
    var p = nyParts(now), today = p.key, tomorrow = addDays(today, 1);
    var look = typeof dayLookup === "function" ? dayLookup : function () { return null; };
    var todayRest = isRestDay(today), tomorrowRest = isRestDay(tomorrow);
    var rowT = look(today) || null;
    var label = function (key) { return yomTovName(key) ? "yomtov" : "shabbat"; };
    if (todayRest) {
      if (tomorrowRest) return { rest: true, reason: label(today), label: yomTovName(today) || "שבת" };
      var endT = rowT ? (weekdayOf(today) === 6 ? (rowT.shabbatEndsMyZmanim || anglePlus1(rowT.shabbatEndsAngle85)) : (rowT.yomTovEndsMyZmanim || anglePlus1(rowT.shabbatEndsAngle85) || rowT.tzeit)) : null; /* v5.1: 5788 Yom Tov weekdays carry the MyZmanim-rule end; hardening: the 8.5 degree fallback + 1 minute */
      var end = endT ? mins(endT) : 24 * 60;
      if (p.mins < end) return { rest: true, reason: label(today), label: yomTovName(today) || "שבת" };
      return { rest: false, reason: null, label: "" };
    }
    if (tomorrowRest) {
      var start = rowT && rowT.candle18 ? mins(rowT.candle18) : 16 * 60;
      if (p.mins >= start) return { rest: true, reason: label(tomorrow), label: yomTovName(tomorrow) || "שבת" };
    }
    return { rest: false, reason: null, label: "" };
  }
  function isRestTime(now, dayLookup) {
    var r = restState(now, dayLookup).rest;
    try {
      if (root.OH_CALENDAR && typeof root.OH_CALENDAR.isRestTime === "function" && root.OH_CALENDAR.isRestTime(now || new Date())) r = true;
    } catch (e) {}
    return r;
  }

  /* ---------- yahrzeit ---------- */
  /* yz = { hDay: 1..30, hMonth: one of MONTHS, hYear: optional year of
     death (e.g. 5770) }. Rules, written out so the rabbi can check:
     - Died in Adar of a regular year: in a leap year, by default Adar II
       (Shulchan Aruch 568:7, the Sephardi practice). Setting
       ADAR_RULE can be "adar1" (Rema) or "both" (both weeks).
     - Died in Adar I or Adar II of a leap year: in a leap year the same
       month; in a regular year, Adar. 30 Adar I in a regular year
       (Adar has 29 days) becomes 30 Shevat (Rosh Chodesh Adar).
     - Died 30 Cheshvan: if the first anniversary year had no 30
       Cheshvan, every year it is the last day of Cheshvan; otherwise
       30 Cheshvan, and in a year without it, 1 Kislev. Same for
       30 Kislev with Tevet. Without a year of death the system uses
       30 when it exists, otherwise the 1st of the next month, and marks
       the date "לבדיקה" (to check).
     These follow the common published practice (same as hebcal's
     yahrzeit rule, except the Adar default, chosen Sephardi). */
  var ADAR_RULE = "adar2";
  function yahrzeitDates(yz, hy) {
    if (!yz || !yz.hDay || !yz.hMonth) return [];
    var day = +yz.hDay, month = yz.hMonth, dy = yz.hYear ? +yz.hYear : null, leap = isLeapYear(hy), check = false;
    var out = [];
    function push(m, d) { var k = gregorianOf(hy, m, d); if (k && out.indexOf(k) < 0) out.push(k); }
    if ((month === "cheshvan" || month === "kislev") && day === 30) {
      var next = month === "cheshvan" ? "kislev" : "tevet";
      if (dy) {
        var firstHas30 = monthLength(dy + 1, month) === 30;
        if (!firstHas30) { push(month, monthLength(hy, month)); }
        else if (monthLength(hy, month) === 30) push(month, 30); else push(next, 1);
      } else { check = true; if (monthLength(hy, month) === 30) push(month, 30); else push(next, 1); }
      return out.map(function (k) { return { key: k, check: check }; });
    }
    if (month === "adar") {
      if (!leap) push("adar", day);
      else if (ADAR_RULE === "adar1") push("adar1", day);
      else if (ADAR_RULE === "both") { push("adar1", day); push("adar2", day); }
      else push("adar2", day);
    } else if (month === "adar1") {
      if (leap) push("adar1", day); else if (day === 30) push("shevat", 30); else push("adar", day);
    } else if (month === "adar2") {
      if (leap) push("adar2", day); else push("adar", day);
    } else {
      if (day <= monthLength(hy, month)) push(month, day);
      else { var i = MONTHS.indexOf(month); check = true; push(MONTHS[(i + 1) % MONTHS.length], 1); }
    }
    return out.map(function (k) { return { key: k, check: check }; });
  }
  /* The week of the yahrzeit: the Sunday to Shabbat week that holds
     the date (WEEK_MODE "full", the default), or from that Sunday only
     until the day itself (WEEK_MODE "untilDay"). When it falls on a
     Sunday it also shows on the Shabbat before, so it is announced on
     that Shabbat. */
  var WEEK_MODE = "full";
  function yahrzeitWindowFor(key) {
    var wd = weekdayOf(key), start = addDays(key, -wd), end = WEEK_MODE === "full" ? addDays(start, 6) : key;
    if (wd === 0) start = addDays(key, -1);
    return { start: start, end: end };
  }
  function yahrzeitActive(yz, todayKey) {
    var hy = hebParts(todayKey).year, hits = [];
    [hy - 1, hy, hy + 1].forEach(function (y) {
      yahrzeitDates(yz, y).forEach(function (d) {
        var w = yahrzeitWindowFor(d.key);
        if (todayKey >= w.start && todayKey <= w.end) {
          var h = hebParts(d.key);
          hits.push({ key: d.key, check: d.check, hebLabel: hebrewDayMonthLabel(h.day, h.month), weekday: weekdayOf(d.key) });
        }
      });
    });
    return hits.length ? hits[0] : null;
  }

  /* ---------- items ---------- */
  var TYPES = {
    announcement: { he: "הכרזות", en: "Announcements" },
    dedication: { he: "הקדשות", en: "Dedications" },
    flyer: { he: "פלייר", en: "Flyer" },
    yahrzeit: { he: "יארצייט השבוע", en: "Yahrzeit This Week" },
    sponsor: { he: "נותני חסות", en: "Sponsors" },
    parnas: { he: "פרנס היום ונר למאור", en: "Parnas Hayom and Ner LaMaor" },
    mazaltov: { he: "מזל טוב", en: "Mazal Tov" },
    hazkara: { he: "הזכרות ותנחומים", en: "Hazkarot and Condolences" },
    rabbi: { he: "דבר הרב", en: "From the Rabbi" },
    campaign: { he: "מבצע / מגבית", en: "Campaign" },
    donation: { he: "תרומה", en: "Donation" }
  };
  var SUBTYPES = {
    sponsor: { kiddush: "קידוש", seudah3: "סעודה שלישית" },
    parnas: { parnas: "פרנס היום", nerLamaor: "נר למאור" },
    hazkara: { hazkara: "הזכרה", tanchumim: "תנחומים" },
    rabbi: { message: "הודעת הרב", brachaShabbat: "ברכת שבת" },
    dedication: { leiluyNishmat: "לעילוי נשמת", general: "הקדשה" }
  };
  var FORCED_WEEKDAY_TYPES = { donation: true, campaign: true };
  /* Payment words in Hebrew and English. Deliberately broad: a false
     "weekday only" only hides an item on Shabbat; a miss would show
     payment text on Shabbat. */
  var PAYMENT_RE = /(zelle|venmo|paypal|cash\s?app|\bqr\b|donat|payment|\bpay\b|\$|תשלום|לשלם|תרומ|לתרום|זל[ּ]?ה|קוד\s?QR|ברקוד|העברה בנקאית|צ'ק|צק\b)/i;
  function itemText(it) {
    return [it.titleHe, it.titleEn, it.bodyHe, it.bodyEn, it.linkText].filter(Boolean).join(" ");
  }
  function weekdayOnlyReason(it) {
    if (!it) return null;
    if (FORCED_WEEKDAY_TYPES[it.type]) return "type";
    if (it.hasPayment === true) return "payment-flag";
    if (PAYMENT_RE.test(itemText(it))) return "payment-text";
    if (it.showOn === "weekday" || it.weekdayOnly === true) return "flag";
    return null;
  }
  function inWindow(it, todayKey) {
    if (it.type === "yahrzeit") return true; /* recurring, see yahrzeitActive */
    if (isDateKey(it.startDate) && todayKey < it.startDate) return false;
    if (isDateKey(it.endDate) && todayKey > it.endDate) return false;
    /* No end date: allowed for a permanent dedication and the donation
       block; the editor asks for an end date for everything else. */
    return true;
  }
  /* Why is this item shown or hidden right now? One reason, for the
     editor's warning line and for tests. */
  function visibility(it, ctx) {
    var today = ctx.todayKey, rest = !!ctx.rest;
    if (!it || it.status !== "published" && !ctx.preview) return { show: false, why: "not-published" };
    if (ctx.publicOnly && it.visibility === "screen") return { show: false, why: "screen-only" };
    if (!inWindow(it, today)) return { show: false, why: today < (it.startDate || "") ? "before-start" : "after-end" };
    if (it.type === "yahrzeit") {
      var y = yahrzeitActive(it.yahrzeit || {}, today);
      if (!y) return { show: false, why: "not-yahrzeit-week" };
    }
    var wr = weekdayOnlyReason(it);
    if (rest && wr) return { show: false, why: "rest-" + wr };
    if (!rest && it.showOn === "shabbat") return { show: false, why: "shabbat-only" };
    return { show: true, why: "ok" };
  }
  function activeItems(items, ctx) {
    return (items || []).filter(function (it) { return visibility(it, ctx).show; })
      .sort(function (a, b) { return (a.order || 0) - (b.order || 0) || String(a.titleHe || "").localeCompare(String(b.titleHe || "")); });
  }

  var api = {
    TZ: TZ, MONTHS: MONTHS, MONTH_HE: MONTH_HE, TYPES: TYPES, SUBTYPES: SUBTYPES, PAYMENT_RE: PAYMENT_RE,
    nyParts: nyParts, addDays: addDays, weekdayOf: weekdayOf, isDateKey: isDateKey,
    hebParts: hebParts, isLeapYear: isLeapYear, hebrewYear: hebrewYear, gregorianOf: gregorianOf, monthLength: monthLength,
    hebrewNumeral: hebrewNumeral, hebrewDayMonthLabel: hebrewDayMonthLabel,
    yomTovName: yomTovName, isRestDay: isRestDay, restState: restState, isRestTime: isRestTime,
    yahrzeitDates: yahrzeitDates, yahrzeitWindowFor: yahrzeitWindowFor, yahrzeitActive: yahrzeitActive,
    weekdayOnlyReason: weekdayOnlyReason, inWindow: inWindow, visibility: visibility, activeItems: activeItems,
    setAdarRule: function (r) { if (r === "adar1" || r === "adar2" || r === "both") ADAR_RULE = r; },
    setWeekMode: function (m) { if (m === "full" || m === "untilDay") WEEK_MODE = m; }
  };
  root.OH_DISPLAY = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
