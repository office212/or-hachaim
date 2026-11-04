/* Or Hachaim | Rabbeinu Tam, ONE basis for the whole site (src/zmanim/rabbeinu-tam.js)
   Hanoch 2026-11-04 (1:24 PM "ברבנו תם 72 כמו בדף", 1:25 PM "זהים"): the Shabbat
   sheet, the TV and the landing page all show the SAME Rabbeinu Tam:
     72 ZMANIYOT (proportional) minutes after Shkiah of that day, where one
     zmaniyot minute = (Shkiah - Netz) / 720 of that day, rounded UP to the
     whole minute (never early).
   Netz and Shkiah are the day's own whole-minute values from the daily
   Zemaneh Yosef file (src/zmanim/roy-daily-*.json, the same numbers the TV
   and the sheet print). Checked against the shul's own MyZmanim-based sheets:
     Sat Oct 31 2026 (Vayera): 7:26 -> 5:54, 62.8 min after Shkiah -> 6:57
     Sat Nov 7 2026 (Chayei Sarah): 6:34 -> 4:46, 61.2 min -> 5:48
   Every place on the site gets Rabbeinu Tam from forDay() below: the calendar
   engine (src/calendar/or-calendar.min.js, function I), the TV fallback lines in
   screen/screen.js, the landing page (src/home/home.js) and the Shabbat sheet.
   No outside service, no library. Works in the browser (window.OH_RABBEINU_TAM)
   and in Node (module.exports) for the tests.

   THE SWITCHES (one word each):
     RT_BASIS_SHABBAT     "zmaniyot72"  (Hanoch's decision)
     RT_BASIS_YOM_KIPPUR  "zmaniyot72"  (default; put "myzmanim" to go back to
                                         the old MyZmanim column for Yom Kippur)
   "myzmanim" = the day's rabbeinuTamMyZmanim field exactly as before. */
(function (root) {
  "use strict";
  var RT_BASIS_SHABBAT = "zmaniyot72";
  var RT_BASIS_YOM_KIPPUR = "zmaniyot72";
  var MINUTES = 72;

  function min24(t) { var m = String(t || "").match(/^(\d{1,2}):(\d{2})/); if (!m) return -1; var h = +m[1], mi = +m[2]; if (h > 23 || mi > 59) return -1; return h * 60 + mi; }
  function hhmm(min) { var h = Math.floor(min / 60), m = min % 60; return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m; }

  /* 72 zmaniyot minutes after Shkiah, "HH:MM" (24h), or null when the day has
     no Netz / Shkiah. Exact arithmetic in tenths of a minute: the proportional
     part is (shkiah - netz) * 72 / 720 = (shkiah - netz) / 10 minutes. */
  function zmaniyot72(day) {
    if (!day) return null;
    var n = min24(day.netz), s = min24(day.shkiah);
    if (n < 0 || s < 0 || s <= n) return null;
    var tenths = s * 10 + (s - n) * MINUTES / 72; /* in tenths of a minute */
    var up = Math.ceil(tenths / 10 - 1e-9);       /* round UP, never early */
    return up < 1440 ? hhmm(up) : null;
  }
  /* minutes after Shkiah, unrounded (for the tests and the notes) */
  function zmaniyotOffset(day) {
    var n = min24(day && day.netz), s = min24(day && day.shkiah);
    return n < 0 || s < 0 || s <= n ? null : (s - n) * MINUTES / 720;
  }
  /* kind: "shabbat" (default) or "yomkippur". Returns { time, source } where
     time is "HH:MM" or null; source names the basis. */
  function forDay(day, kind) {
    var basis = kind === "yomkippur" ? api.RT_BASIS_YOM_KIPPUR : api.RT_BASIS_SHABBAT;
    if (basis === "myzmanim") return { time: (day && day.rabbeinuTamMyZmanim) || null, source: "MyZmanim" };
    return { time: zmaniyot72(day), source: "zmaniyot72" };
  }
  /* For pages that read the raw daily record (no calendar): a weekday record
     that carries a Yom Tov end and a Rabbeinu Tam is Yom Kippur (the same
     reading screen/screen.js uses for "צאת הצום"). */
  function kindOf(day) { return day && day.yomTovEndsMyZmanim && !day.shabbatEndsMyZmanim ? "yomkippur" : "shabbat"; }
  function timeFor(day) { return day ? forDay(day, kindOf(day)).time : null; }

  var api = {
    RT_BASIS_SHABBAT: RT_BASIS_SHABBAT,
    RT_BASIS_YOM_KIPPUR: RT_BASIS_YOM_KIPPUR,
    MINUTES: MINUTES,
    zmaniyot72: zmaniyot72,
    zmaniyotOffset: zmaniyotOffset,
    forDay: forDay,
    kindOf: kindOf,
    timeFor: timeFor
  };
  root.OH_RABBEINU_TAM = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
