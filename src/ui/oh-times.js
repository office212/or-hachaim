/* Or Hachaim | 2040 phase 1 | זמנים, כללים ושקיעה (src/ui/oh-times.js)
   Pure helpers, no network, no page access: used by the command bar, the
   Shabbat package, the alerts strip and the prayer times manager, and by
   the Node unit tests (module.exports).
   The shared prayer time rule (the TV reads the same field):
     rule = { kind: "fixed" | "sunset", offsetMin: int (negative = before),
              days: "all" | "weekday" | "fri" | "shabbat" | "sun-thu",
              from: "YYYY-MM-DD"?, until: "YYYY-MM-DD"? }
     days: all = every day | weekday = Sunday to Friday | sun-thu = Sunday to
     Thursday | fri = Friday | shabbat = Saturday. from / until are New York
     dates, both included.
   Sunset = "shkiah" of the Zemaneh Yosef year file (validation/roy-full-year-5787.jsonl,
   with seconds, the same source the TV uses): offset 0 or before sunset rounds EARLIER
   to the whole minute, after sunset rounds LATER. Dates with no sunset data: a sunset
   rule is not shown on the TV, and the checks here say so. */
(function (root) {
  "use strict";
  var DAYS = ["all", "weekday", "fri", "shabbat", "sun-thu"];
  /* Yom Tov: "weekday", "sun-thu" and "fri" are never on a Yom Tov day (Chol HaMoed
     counts as a weekday); "all" includes Shabbat and Yom Tov. Same reading as the TV. */
  var DAY_HE = { "all": "כל יום", "weekday": "ראשון עד שישי, לא ביום טוב", "sun-thu": "ראשון עד חמישי, לא ביום טוב", "fri": "יום שישי, לא ביום טוב", "shabbat": "שבת" };
  var WD_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
  var WD_SHORT = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function isIso(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")); }
  /* "6:30 PM" -> 1110, -1 when not this format */
  function min12(t) {
    var m = String(t || "").trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/); if (!m) return -1;
    var h = +m[1], mi = +m[2]; if (h < 1 || h > 12 || mi > 59) return -1;
    h = h % 12; if (/p/i.test(m[3])) h += 12; return h * 60 + mi;
  }
  /* "18:30" -> 1110 */
  function min24(t) { var m = String(t || "").match(/^(\d{1,2}):(\d{2})/); if (!m) return -1; var h = +m[1], mi = +m[2]; if (h > 23 || mi > 59) return -1; return h * 60 + mi; }
  function fmt12(min) { min = ((min % 1440) + 1440) % 1440; var h = Math.floor(min / 60), mi = min % 60, ap = h < 12 ? "AM" : "PM", h12 = h % 12 || 12; return h12 + ":" + pad(mi) + " " + ap; }
  function short12(min) { return fmt12(min).replace(/\s*[AP]M$/, ""); }

  /* New York calendar date of a moment */
  function nyIso(d) {
    d = d || new Date();
    try {
      var o = {}; new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d).forEach(function (x) { o[x.type] = x.value; });
      return o.year + "-" + o.month + "-" + o.day;
    } catch (e) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  }
  function nyMinutes(d) {
    d = d || new Date();
    try {
      var o = {}; new Intl.DateTimeFormat("en-GB", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d).forEach(function (x) { o[x.type] = x.value; });
      return (+o.hour % 24) * 60 + +o.minute;
    } catch (e) { return d.getHours() * 60 + d.getMinutes(); }
  }
  function utc(iso) { var p = iso.split("-"); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
  function addDays(iso, n) { var d = new Date(utc(iso) + n * 864e5); return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate()); }
  function dow(iso) { return new Date(utc(iso)).getUTCDay(); }
  function diffDays(a, b) { return Math.round((utc(b) - utc(a)) / 864e5); }
  /* the coming Shabbat (today when today is Shabbat) */
  function comingShabbat(iso) { var w = dow(iso); return addDays(iso, (6 - w + 7) % 7); }
  function nextDow(iso, wd) { return addDays(iso, (wd - dow(iso) + 7) % 7); }
  /* "יום ד׳ 21.4.2027" */
  function dateHe(iso, withYear) {
    if (!isIso(iso)) return "";
    var p = iso.split("-");
    return "יום " + WD_SHORT[dow(iso)] + " " + (+p[2]) + "." + (+p[1]) + (withYear === false ? "" : "." + p[0]);
  }
  function dateShort(iso) { var p = iso.split("-"); return (+p[2]) + "." + (+p[1]); }

  function daysMatch(days, wd) {
    switch (days || "all") {
      case "all": return true;
      case "weekday": return wd !== 6;
      case "sun-thu": return wd <= 4;
      case "fri": return wd === 5;
      case "shabbat": return wd === 6;
      default: return false;
    }
  }
  /* isYT: optional function(iso) -> true on a Yom Tov day */
  function ruleApplies(rule, iso, isYT) {
    if (!rule) return true;
    if (rule.from && iso < rule.from) return false;
    if (rule.until && iso > rule.until) return false;
    if (!daysMatch(rule.days, dow(iso))) return false;
    if ((rule.days === "weekday" || rule.days === "sun-thu" || rule.days === "fri") && isYT && isYT(iso)) return false;
    return true;
  }
  /* zman: function(iso) -> the day's record of the daily file, or null */
  function sunsetMin(zman, iso) { var z = zman && zman(iso); return z && z.shkiah ? min24(z.shkiah) : -1; }
  /* seconds after midnight of sunset, -1 when unknown */
  function sunsetSec(zman, iso) {
    var z = zman && zman(iso); if (!z) return -1;
    if (typeof z.shkiahSec === "number") return z.shkiahSec;
    return z.shkiah ? min24(z.shkiah) * 60 : -1;
  }
  /* a sunset rule's minute on a day: before (or at) sunset rounds earlier, after rounds later */
  function sunsetRuleMin(zman, iso, offsetMin) {
    var s = sunsetSec(zman, iso); if (s < 0) return -2;
    var off = Math.round(+offsetMin || 0), sec = s + off * 60;
    return off <= 0 ? Math.floor(sec / 60) : Math.ceil(sec / 60);
  }
  /* Minutes after midnight of a prayer time doc on a date: -1 when it does
     not apply that day, -2 when it needs sunset data the file does not have. */
  function timeOn(doc, iso, zman, isYT) {
    var r = doc && doc.rule;
    if (!r) { var m = min12(doc && doc.time); return m >= 0 ? m : (typeof (doc && doc.order) === "number" ? doc.order : -1); }
    if (!ruleApplies(r, iso, isYT)) return -1;
    if (r.kind === "sunset") return sunsetRuleMin(zman, iso, r.offsetMin);
    var f = min12(doc.time); return f >= 0 ? f : (typeof doc.order === "number" ? doc.order : -1);
  }
  /* The first day from `fromIso` (up to `limit` days) the rule applies on. */
  function firstDay(rule, fromIso, limit, isYT) {
    var iso = fromIso;
    if (rule && rule.from && rule.from > iso) iso = rule.from;
    for (var i = 0; i < (limit || 400); i++) {
      if (rule && rule.until && iso > rule.until) return null;
      if (ruleApplies(rule, iso, isYT)) return iso;
      iso = addDays(iso, 1);
    }
    return null;
  }
  /* Count the days in [fromIso, untilIso] the rule applies on, and those whose
     time (fixed `fixedMin`, or the rule's own) is at or after sunset. */
  function sunsetCheck(rule, fixedMin, fromIso, untilIso, zman, isYT) {
    var out = { total: 0, after: 0, noData: 0, firstAfter: null, lastAfter: null, minSunset: null, maxSunset: null, from: fromIso, until: untilIso };
    var n = diffDays(fromIso, untilIso);
    for (var i = 0; i <= n && i < 800; i++) {
      var iso = addDays(fromIso, i);
      if (!ruleApplies(rule, iso, isYT)) continue;
      out.total++;
      var s = sunsetMin(zman, iso), ss = sunsetSec(zman, iso);
      if (s < 0 || ss < 0) { out.noData++; if (!out.firstNoData) out.firstNoData = iso; continue; }
      if (out.minSunset === null || s < out.minSunset.min) out.minSunset = { min: s, iso: iso };
      if (out.maxSunset === null || s > out.maxSunset.min) out.maxSunset = { min: s, iso: iso };
      var t = rule && rule.kind === "sunset" ? sunsetRuleMin(zman, iso, rule.offsetMin) : fixedMin;
      if (t * 60 >= ss) { out.after++; if (!out.firstAfter) out.firstAfter = iso; out.lastAfter = iso; }
    }
    return out;
  }
  function offsetHe(off) {
    off = Math.round(+off || 0);
    if (off === 0) return "בשקיעה";
    var a = Math.abs(off);
    return a + " דק׳ " + (off < 0 ? "לפני" : "אחרי") + " השקיעה";
  }
  /* One Hebrew line for a rule, for lists and preview cards. */
  function describeRule(rule, time) {
    if (!rule) return "";
    var parts = [];
    parts.push(rule.kind === "sunset" ? offsetHe(rule.offsetMin) : (time ? short12(min12(time) >= 0 ? min12(time) : 0) : ""));
    if (rule.from && rule.until && rule.from === rule.until) parts.push("רק ב" + dateHe(rule.from, false).replace(/^יום /, "יום "));
    else {
      if (rule.days && rule.days !== "all") parts.push(DAY_HE[rule.days]);
      if (rule.from) parts.push("מ-" + dateShort(rule.from));
      if (rule.until) parts.push("עד " + dateShort(rule.until));
    }
    return parts.filter(Boolean).join(" | ");
  }

  /* English (the "EN" button): the same words for lists and alerts. The
     command bar still reads Hebrew sentences, so the parser keeps the Hebrew. */
  function isEn() { return typeof window !== "undefined" && window.OH_LANG === "en"; }
  function term(k, d) { var t = typeof window !== "undefined" && window.OH_TERMS_EN; return (t && t[k]) || d; }
  var WD_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  function dayEn(days) {
    return { "all": "Every day", "weekday": "Sunday to Friday, not on Yom Tov", "sun-thu": "Sunday to Thursday, not on Yom Tov", "fri": "Friday, not on Yom Tov", "shabbat": term("shabbat", "Shabbat") }[days || "all"] || "";
  }
  function dayLoc(days) { return isEn() ? dayEn(days) : DAY_HE[days || "all"]; }
  function dateLoc(iso, withYear) {
    if (!isEn()) return dateHe(iso, withYear);
    if (!isIso(iso)) return "";
    var p = iso.split("-");
    return WD_EN[dow(iso)] + " " + (+p[1]) + "/" + (+p[2]) + (withYear === false ? "" : "/" + p[0]);
  }
  function dateShortLoc(iso) { if (!isEn()) return dateShort(iso); var p = iso.split("-"); return (+p[1]) + "/" + (+p[2]); }
  function offsetLoc(off) {
    if (!isEn()) return offsetHe(off);
    off = Math.round(+off || 0); var sk = term("shkiah", "Shkiah");
    if (off === 0) return "at " + sk;
    return Math.abs(off) + " min " + (off < 0 ? "before " : "after ") + sk;
  }
  function describeRuleLoc(rule, time) {
    if (!isEn()) return describeRule(rule, time);
    if (!rule) return "";
    var parts = [];
    parts.push(rule.kind === "sunset" ? offsetLoc(rule.offsetMin) : (time ? short12(min12(time) >= 0 ? min12(time) : 0) : ""));
    if (rule.from && rule.until && rule.from === rule.until) parts.push("only on " + dateLoc(rule.from, false));
    else {
      if (rule.days && rule.days !== "all") parts.push(dayEn(rule.days));
      if (rule.from) parts.push("from " + dateShortLoc(rule.from));
      if (rule.until) parts.push("until " + dateShortLoc(rule.until));
    }
    return parts.filter(Boolean).join(" | ");
  }

  var api = {
    DAYS: DAYS, DAY_HE: DAY_HE, WD_HE: WD_HE, WD_SHORT: WD_SHORT,
    min12: min12, min24: min24, fmt12: fmt12, short12: short12,
    nyIso: nyIso, nyMinutes: nyMinutes, addDays: addDays, dow: dow, diffDays: diffDays, isIso: isIso,
    comingShabbat: comingShabbat, nextDow: nextDow, dateHe: dateHe, dateShort: dateShort,
    daysMatch: daysMatch, ruleApplies: ruleApplies, sunsetMin: sunsetMin, sunsetSec: sunsetSec, sunsetRuleMin: sunsetRuleMin, timeOn: timeOn, firstDay: firstDay,
    sunsetCheck: sunsetCheck, offsetHe: offsetHe, describeRule: describeRule,
    isEn: isEn, dayLoc: dayLoc, dateLoc: dateLoc, dateShortLoc: dateShortLoc, offsetLoc: offsetLoc, describeRuleLoc: describeRuleLoc
  };
  /* the zmanim year, loaded once (browser): the Zemaneh Yosef year file with
     seconds (validation/roy-full-year-5787.jsonl); if it cannot load, the daily
     file the site already uses (src/zmanim/roy-daily-5787.json, whole minutes). */
  var zfile = null, zpromise = null;
  function hms(s) { var m = String(s || "").match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/); return m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+(m[3] || 0)) : -1; }
  function parseYear(text) {
    var out = {};
    String(text || "").split(/\n/).forEach(function (line) {
      line = line.trim(); if (!line) return;
      try {
        var j = JSON.parse(line); if (!j || !j.date) return;
        var g = function (k) { return j[k] && (j[k].site || j[k].raw) ? String(j[k].site || j[k].raw).slice(0, 5) : null; };
        var rec = { shkiah: g("shkiah"), minchaGedola: g("minchaGedola") };
        if (j.shkiah && j.shkiah.raw) rec.shkiahSec = hms(j.shkiah.raw);
        out[j.date] = rec;
      } catch (e) {}
    });
    return out;
  }
  api.parseYear = parseYear;
  /* root: the site root as seen from the page, e.g. "../" */
  api.loadZmanim = function (root) {
    if (zfile) return Promise.resolve(zfile);
    if (zpromise) return zpromise;
    root = root || "../";
    zpromise = fetch(root + "validation/roy-full-year-5787.jsonl").then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (t) { var y = parseYear(t); if (!Object.keys(y).length) throw new Error("empty"); zfile = y; return zfile; })
      .catch(function () {
        return fetch(root + "src/zmanim/roy-daily-5787.json").then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
          .then(function (j) { zfile = (j && j.days) || {}; return zfile; });
      }).catch(function () { zpromise = null; return null; });
    return zpromise;
  };
  api.zman = function (iso) { return zfile ? (zfile[iso] || null) : null; };
  api.lastZmanDay = function () { if (!zfile) return null; var k = Object.keys(zfile).sort(); return k[k.length - 1] || null; };
  api._setZmanim = function (days) { zfile = days || {}; };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.OH_TIMES = api;
})(typeof window !== "undefined" ? window : this);
