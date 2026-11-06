/* Or Hachaim TV | prayer times with rules (2040 phase 1).
   Pure functions, no DOM. A prayerTimes document may carry an optional
   field rule = { kind: "fixed" | "sunset", offsetMin: int (negative =
   before), days: "all" | "weekday" | "fri" | "shabbat" | "sun-thu",
   from: "YYYY-MM-DD"?, until: "YYYY-MM-DD"? }. Its "time" stays filled
   for older screens. Documents WITHOUT rule behave exactly as before:
   shown every day with their own "time" text.
   Meaning of the words (shared with the gabbai command bar):
     all      every day, Shabbat and Yom Tov included
     weekday  Sunday to Friday, not Shabbat, not a Yom Tov day
              (Chol HaMoed counts as a weekday)
     sun-thu  Sunday to Thursday, not a Yom Tov day
     fri      Friday, not a Yom Tov day
     shabbat  Saturday
     from / until  inclusive, New York dates
   kind "fixed": the time is the document's own "time".
   kind "sunset": the real sunset of that date WITH SECONDS (src/tv/
   sunset-5787.json, from the Zemaneh Yosef full-year run) plus offsetMin.
   Before / at sunset (offset <= 0) rounds EARLIER to the whole minute,
   after sunset (offset > 0) rounds LATER, and the result is also never
   later (before) / earlier (after) than the same offset from the sunset
   minute printed on the screen. A minute late is fine, a minute early
   never. A date with no sunset data hides the row: never a guess. */
(function (root) {
  "use strict";
  var DAYS = ["all", "weekday", "fri", "shabbat", "sun-thu"];
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function hm(t) { if (!t || typeof t !== "string") return null; var p = t.split(":"); var h = parseInt(p[0], 10), m = parseInt(p[1], 10); return isFinite(h) && isFinite(m) ? h * 60 + m : null; }
  function secs(t) { if (!t) return null; var p = String(t).split(":"); if (p.length < 2) return null; var v = (+p[0]) * 3600 + (+p[1]) * 60 + (+(p[2] || 0)); return isFinite(v) ? v : null; }
  function parseTime12(t) {
    var m = String(t || "").trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp])\.?[Mm]?\.?$/);
    if (m) { var h = parseInt(m[1], 10) % 12, mi = parseInt(m[2], 10); if (/[Pp]/.test(m[3])) h += 12; return h * 60 + mi; }
    var m24 = String(t || "").trim().match(/^(\d{1,2}):(\d{2})$/);
    if (m24) return parseInt(m24[1], 10) * 60 + parseInt(m24[2], 10);
    return null;
  }
  function fmtAmPm(min) { var h = Math.floor(min / 60) % 24, m = min % 60, ap = h >= 12 ? "PM" : "AM", h12 = h % 12; if (h12 === 0) h12 = 12; return h12 + ":" + pad(m) + " " + ap; }
  function wdOf(iso) { var p = iso.split("-"); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], 12)).getUTCDay(); }
  function validRule(r) { return !!(r && typeof r === "object" && (r.kind === "fixed" || r.kind === "sunset")); }
  /* 2040 phase 2: the prayer-times manager now splits "ימי חול (א׳-ה׳)" from
     "שישי ושבת" (rule.days "sun-thu" / "fri" / "shabbat"). A document that
     carries only the days (no kind) is a fixed time on those days, so a
     weekday time can never leak onto Friday or Shabbat. */
  function normRule(r) {
    if (validRule(r)) return r;
    if (r && typeof r === "object" && !r.kind && typeof r.days === "string" && r.days !== "all" && DAYS.indexOf(r.days) >= 0) return Object.assign({}, r, { kind: "fixed" });
    return null;
  }

  /* Does the rule apply on this date? isYomTov(iso) -> bool */
  function dayMatches(rule, iso, isYomTov) {
    if (rule.from && typeof rule.from === "string" && iso < rule.from) return false;
    if (rule.until && typeof rule.until === "string" && iso > rule.until) return false;
    var days = DAYS.indexOf(rule.days) >= 0 ? rule.days : "all";
    var wd = wdOf(iso), yt = !!(isYomTov && isYomTov(iso));
    if (days === "all") return true;
    if (days === "shabbat") return wd === 6;
    if (yt) return false;
    if (days === "weekday") return wd !== 6;
    if (days === "sun-thu") return wd >= 0 && wd <= 4;
    if (days === "fri") return wd === 5;
    return false;
  }

  /* Minutes after midnight for a sunset rule on iso, or null (no data). */
  function sunsetMinutes(offsetMin, iso, ctx) {
    var off = parseInt(offsetMin, 10); if (!isFinite(off)) off = 0;
    var raw = ctx.sunsetRaw ? secs(ctx.sunsetRaw[iso]) : null;
    var z = ctx.zdays ? ctx.zdays[iso] : null;
    var site = z ? hm(z.shkiah) : null;
    if (raw == null && site == null) return null;
    var cand = [];
    if (raw != null) { var t = raw / 60 + off; cand.push(off <= 0 ? Math.floor(t + 1e-9) : Math.ceil(t - 1e-9)); }
    if (site != null) cand.push(site + off + (raw == null ? (off <= 0 ? -1 : 1) : 0));
    return off <= 0 ? Math.min.apply(null, cand) : Math.max.apply(null, cand);
  }

  /* One document on one date -> { min, time } or null (not shown that day) */
  function timeFor(doc, iso, ctx) {
    var r = normRule(doc.rule);
    if (!r) {
      var lm = typeof doc.order === "number" ? doc.order : parseTime12(doc.time);
      return { min: lm, time: doc.time || "", legacy: true };
    }
    if (!dayMatches(r, iso, ctx.isYomTov)) return null;
    if (r.kind === "fixed") {
      var fm = parseTime12(doc.time); if (fm == null && typeof doc.order === "number") fm = doc.order;
      if (fm == null) return null;
      return { min: fm, time: fmtAmPm(fm) };
    }
    var sm = sunsetMinutes(r.offsetMin, iso, ctx);
    if (sm == null) return null;
    return { min: sm, time: fmtAmPm(sm) };
  }

  /* Hanoch Nov 6: the Shabbat package's own times for one Shabbat
     (settings/shabbatScreen, written by gabbai/shabbat/), INSTEAD of the
     regular times: on that Shabbat only its rows; on that Friday the regular
     morning rows (before noon) and then the package's Erev Shabbat rows.
     ctx.sheet: { friday: iso, shabbat: iso, rows: [{ he, en, min, day: "fri" | "sat" }] } */
  function sheetRows(sheet, iso, group, day) {
    return (sheet.rows || []).filter(function (r) { return r && r.day === day && typeof r.min === "number" && r.min >= 0 && r.min < 1440; }).map(function (r, i) {
      return { id: "sheet:" + day + ":" + i, nameHe: r.he || r.en || "", nameEn: r.en || "", time: fmtAmPm(r.min), min: r.min, iso: iso, group: group || "", legacy: false, rule: { kind: "fixed" }, fromSheet: true };
    });
  }
  function rowsFor(docs, iso, ctx, group) {
    var rows = [], sheet = ctx && ctx.sheet;
    if (sheet && iso === sheet.shabbat) return sheetRows(sheet, iso, group, "sat").sort(function (a, b) { return a.min - b.min; });
    if (sheet && iso === sheet.friday) {
      rows = rowsFor(docs, iso, Object.assign({}, ctx, { sheet: null }), group).filter(function (r) { return r.min != null && r.min < 12 * 60; }).concat(sheetRows(sheet, iso, group, "fri"));
      return rows.sort(function (a, b) { return a.min - b.min; });
    }
    (docs || []).forEach(function (doc) {
      var t = timeFor(doc, iso, ctx); if (!t) return;
      rows.push({ id: doc.id, nameHe: doc.nameHe || doc.nameEn || "", nameEn: doc.nameEn || "", time: t.time, min: t.min, iso: iso, group: group || "", legacy: !!t.legacy, rule: normRule(doc.rule) });
    });
    rows.sort(function (a, b) { return (a.min == null ? 9999 : a.min) - (b.min == null ? 9999 : b.min); });
    return rows;
  }

  /* The list the TV shows now. ctx: { zdays, sunsetRaw, isYomTov(iso),
     shabbatStarted: bool (Friday from candle lighting), nextIso } */
  function resolve(docs, iso, ctx) {
    ctx = ctx || {};
    if ((ctx.shabbatStarted || ctx.friday) && ctx.nextIso) {
      /* Friday: today's rows, then tomorrow's (Shabbat), so the whole Shabbat
         schedule is on the screen all Friday (Hanoch Nov 6: people check the
         Shabbat times on Friday, they have no phone on Shabbat). Before Nov 6
         this was from candle lighting only, with Friday's morning rows left out.
         A document without a rule (shown every day, as before) is shown
         once under Shabbat: its morning times there, its evening times tonight. */
      var fri = rowsFor(docs, iso, ctx, "fri").filter(function (r) { return ctx.friday || r.min == null || r.min >= 12 * 60; });
      var sat = rowsFor(docs, ctx.nextIso, ctx, "shabbat").filter(function (r) { return !r.legacy || r.min == null || r.min < 12 * 60; });
      return fri.concat(sat);
    }
    return rowsFor(docs, iso, ctx, "");
  }

  /* The next minyan from now: first row whose minute is now or later today
     (rows of the Shabbat part count as tomorrow). */
  function nextMinyan(rows, nowIso, nowMinExact, tomorrowRows) {
    var best = null;
    (rows || []).forEach(function (r) {
      if (best || r.min == null) return;
      var dayOff = r.iso && r.iso > nowIso ? 1 : 0;
      var left = dayOff * 1440 + r.min - nowMinExact;
      if (left > -1) best = { row: r, minutes: Math.max(0, left), tomorrow: dayOff > 0 };
    });
    if (!best && tomorrowRows && tomorrowRows.length) {
      var r0 = tomorrowRows.filter(function (r) { return r.min != null; })[0];
      if (r0) best = { row: r0, minutes: 1440 + r0.min - nowMinExact, tomorrow: true };
    }
    return best;
  }

  var api = { resolve: resolve, rowsFor: rowsFor, timeFor: timeFor, dayMatches: dayMatches, sunsetMinutes: sunsetMinutes, nextMinyan: nextMinyan, parseTime12: parseTime12, fmtAmPm: fmtAmPm };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.OH_PRAYER_RULES = api;
})(typeof window !== "undefined" ? window : null);
