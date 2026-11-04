/* Or Hachaim TV | day-state engine (2040 phase 1).
   A pure function: compute(now, cal, opts) -> what kind of day it is right
   now and what the screen should emphasise. No DOM, no network, no clock
   of its own: the same inputs always give the same answer, so it is
   unit-tested over the whole year 5787 (src/tv/tests/test-day-state.mjs).
   Inputs:
     now   a Date (the real moment; New York time is derived from it)
     cal   the loaded calendar engine (src/calendar/or-calendar.min.js,
           OH_CALENDAR.load()), which already follows the rabbi's rulings
           (Zemaneh Yosef, Sephardi haftarah, Kiddush Levana window,
           candles after a Shabbat not before Shabbat-end nightfall).
     opts.zdays  the daily zmanim map (src/zmanim/roy-daily-5787.json days)
     opts.t      the words: (key, vars) -> text (src/tv/tv-texts.js, with a
                 gabbai's overrides from settings/screenTexts)
   Safe side, everywhere: a state that ends at a time (Shabbat, Yom Tov,
   a fast) ends on the screen one minute AFTER the printed minute; a state
   that starts at nightfall starts one minute after it. A minute late is
   fine, a minute early never. A day with no zmanim data shows no time
   and no countdown at all, never a guess. */
(function (root) {
  "use strict";
  var TZ = "America/New_York";
  var SAFE = 1; /* minutes added after an end time / nightfall */

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function hm(t) { if (!t || typeof t !== "string") return null; var p = t.split(":"); var h = parseInt(p[0], 10), m = parseInt(p[1], 10); return isFinite(h) && isFinite(m) ? h * 60 + m : null; }
  function fmt12(mins) { if (mins == null) return ""; mins = ((mins % 1440) + 1440) % 1440; var h = Math.floor(mins / 60), m = mins % 60, h12 = h % 12; if (h12 === 0) h12 = 12; return h12 + ":" + pad(m); }
  function nyParts(date) {
    var o = {};
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", weekday: "short" })
      .formatToParts(date).forEach(function (x) { o[x.type] = x.value; });
    var wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[o.weekday];
    var h = parseInt(o.hour, 10) % 24, mi = parseInt(o.minute, 10), s = parseInt(o.second, 10);
    return { iso: o.year + "-" + o.month + "-" + o.day, wd: wd, min: h * 60 + mi, sec: s, minExact: h * 60 + mi + s / 60 };
  }
  function addDays(iso, n) {
    var p = iso.split("-"), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n, 12));
    return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
  }
  function wdOf(iso) { var p = iso.split("-"); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], 12)).getUTCDay(); }
  function noYear(t) { return String(t || "").replace(/\s+תש[א-ת״׳"']+$/, ""); }
  function safeDay(cal, iso) { try { return cal.day(iso); } catch (e) { return null; } }
  /* The real moment (ms) of a New York wall time, daylight saving included. */
  function nyToMs(iso, min) {
    var y = +iso.slice(0, 4), mo = +iso.slice(5, 7) - 1, da = +iso.slice(8, 10);
    var want = Date.UTC(y, mo, da, 0, min);
    var guess = want + 5 * 3600000;
    for (var i = 0; i < 3; i++) {
      var q = nyParts(new Date(guess));
      var got = Date.UTC(+q.iso.slice(0, 4), +q.iso.slice(5, 7) - 1, +q.iso.slice(8, 10), 0, q.min) + q.sec * 1000;
      if (got === want) break;
      guess += want - got;
    }
    return guess;
  }
  /* minutes from now to a New York wall time {iso, min}; null when unknown */
  function minutesUntil(now, iso, min) { if (min == null) return null; return (nyToMs(iso, min) - now.getTime()) / 60000; }
  function countdownText(T, m) {
    if (typeof T !== "function") T = defaultT();
    if (m == null) return "";
    if (m <= 0) return T("cdNow");
    var whole = Math.ceil(m); /* never shows less time than is left */
    if (whole === 1) return T("cdOneMinute");
    if (whole < 60) return T("cdMinutes", { n: whole });
    var h = Math.floor(whole / 60), r = whole % 60;
    if (h === 1) return r ? T("cdOneHourMin", { m: r }) : T("cdOneHour");
    return r ? T("cdHoursMin", { h: h, m: r }) : T("cdHours", { h: h });
  }
  function holidayNames(d, kinds) {
    return ((d && d.holidays) || []).filter(function (h) { return !kinds || kinds.indexOf(h.kind) >= 0; }).map(function (h) { return h.he; });
  }
  function hasHoliday(d, key) { return ((d && d.holidays) || []).some(function (h) { return h.key === key; }); }

  /* Is a fast running at p? f = a fast object of the engine */
  function fastActive(f, p) {
    if (!f || !f.startsDate || !f.endsDate) return false;
    var s = hm(f.startsAt), e = hm(f.endsAt);
    if (s == null || e == null) return false;
    var started = f.startsDate < p.iso || (f.startsDate === p.iso && p.min >= s);
    var ended = f.endsDate < p.iso || (f.endsDate === p.iso && p.min >= e + SAFE);
    return started && !ended;
  }

  function defaultT() {
    var X = (root && root.OH_TV_TEXTS) || (typeof require === "function" ? (function () { try { return require("./tv-texts.js"); } catch (e) { return null; } })() : null);
    return X ? X.t : function (k) { return k; };
  }
  function compute(now, cal, opts) {
    opts = opts || {};
    var T = opts.t || defaultT();
    var zdays = opts.zdays || {};
    var p = nyParts(now);
    var iso = p.iso, prevIso = addDays(iso, -1), nextIso = addDays(iso, 1);
    var z = zdays[iso] || null;
    var d = safeDay(cal, iso), dn = safeDay(cal, nextIso), dp = safeDay(cal, prevIso);
    var s = null; try { s = cal.screenState(now); } catch (e) { s = null; }
    var out = {
      iso: iso, min: p.min, wd: p.wd, key: "weekday", keys: [], tone: "normal",
      title: "", sub: [], card: null, chips: [], hidePayments: false,
      missing: !z, hebrewDate: d && d.hebrew ? d.hebrew.text : ""
    };
    if (!d) { out.missing = true; return out; }
    var shk = z ? hm(z.shkiah) : null, tz = z ? hm(z.tzeit) : null, alot = z ? hm(z.alot) : null;
    var afterSunset = shk != null && p.min >= shk;
    var night = (tz != null && p.min >= tz + SAFE);            /* tonight, from nightfall (+1 safe minute) */
    var earlyNight = (alot != null && p.min < alot);             /* after midnight, before dawn: still last night */
    var sacred = s && s.sacred ? s.sacred : { active: false };
    var endMin = d.sacredEnd && d.sacredEnd.time ? hm(d.sacredEnd.time) : null;
    /* Safe side: the engine flips at the printed minute; the screen keeps the
       holy-day look one more minute. */
    var holdSacred = !sacred.active && endMin != null && p.min >= endMin && p.min < endMin + SAFE;
    var sacredKind = sacred.active ? sacred.kind : (holdSacred ? (d.sacredEnd.kind === "shabbat" ? "shabbat" : (d.sacredEnd.kind === "yomkippur" ? "yomkippur" : "yomtov")) : null);
    out.hidePayments = !!(sacred.active || holdSacred);
    var add = function (k) { if (out.keys.indexOf(k) < 0) out.keys.push(k); };
    var parasha = (s && s.shabbatBlock && s.shabbatBlock.parashaHe) || (d.readings && d.readings.parashaHe) || "";
    function monthName(rc) { return rc.monthHe || ""; }
    var sb = s && s.shabbatBlock ? s.shabbatBlock : null;
    var yt = null; ((s && s.panels) || []).forEach(function (x) { if (x.id === "yomtov-times") yt = x; });
    var line = function (he, mins, note) { return { he: he, time: mins == null ? "" : fmt12(mins), note: note || "" }; };

    /* ---------- primary state ---------- */
    if (sacredKind === "shabbat" && (d.isYomTov || (afterSunset && dn && dn.isYomTov))) { sacredKind = "yomtov"; add("shabbat"); }
    if (sacredKind) {
      if (sacredKind === "shabbat") {
        out.key = "shabbat"; out.tone = "shabbat"; out.title = T("titleShabbat");
        if (d.isCholHamoed || (afterSunset && dn && dn.isCholHamoed && p.wd === 5)) out.sub.push(T("subShabbatCholHamoed"));
        if (parasha && !(sb && sb.holidayReadingEn && !sb.parashaHe)) out.sub.push(parasha);
        var card = { kind: "shabbat", title: parasha || T("titleShabbat"), lines: [] };
        if (sb && sb.haftarah && sb.haftarah.displayHe) card.lines.push({ he: T("sbHaftarah", { text: sb.haftarah.displayHe }), time: "" });
        ((sb && sb.special) || []).forEach(function (x) { if (x && x.he) { var nm = x.he; card.lines.push({ he: nm, time: "" }); if (out.sub.indexOf(nm) < 0) out.sub.push(nm); } });
        if (sb && sb.mevarchim && sb.mevarchim.molad && sb.mevarchim.molad.textHe) card.lines.push({ he: sb.mevarchim.molad.textHe, time: "" });
        var endT = sb && sb.end ? hm(sb.end.time) : null;
        if (endT != null && !(sb && sb.continuesIntoYomTov)) {
          card.lines.push(line(T("sbShabbatEnds"), endT));
          if (sb.end.rabbeinuTam) card.lines.push(line(T("sbRabbeinuTam"), hm(sb.end.rabbeinuTam)));
        } else if (sb && sb.continuesIntoYomTov && sb.candleLightingSaturdayNight && sb.candleLightingSaturdayNight.time) {
          card.lines.push(line(T("sbCandlesNotBeforeFlame"), hm(sb.candleLightingSaturdayNight.time)));
        }
        /* the right column already shows the whole Shabbat block (parasha,
           haftarah, candles, end, molad): the centre card is not repeated,
           only the chips (Rosh Chodesh, Chanukah, Omer...) show there. */
        out.detail = card; out.card = null;
      } else if (sacredKind === "yomkippur") {
        out.key = "yomkippur"; out.tone = "fast"; out.title = T("titleYomKippur");
        var ykEnd = d.isYomKippur && d.sacredEnd ? hm(d.sacredEnd.time) : null;
        if (out.sub.indexOf(T("subYomKippur")) < 0) out.sub.push(T("subYomKippur"));
        out.detail = { kind: "yomkippur", title: T("subYomKippur"), lines: ykEnd != null ? [line(T("sbFastEnds"), ykEnd)] : [] }; out.card = null;
      } else {
        out.key = "yomtov"; out.tone = "festive"; out.title = T("titleYomTov");
        var names = holidayNames(afterSunset && dn && dn.isYomTov ? dn : d, ["yomtov"]);
        var ytTitle = names[0] || (yt && yt.titleHe) || "";
        if (ytTitle) out.sub.push(ytTitle);
        if (p.wd === 6 || (p.wd === 5 && afterSunset)) out.sub.push(T("subShabbat"));
        var yl = [];
        ((yt && yt.lines) || []).forEach(function (l) {
          /* only what is still ahead: tonight's candles / the end of the chag */
          if (!l.time || l.missing) return;
          if (l.date < iso) return;
          if (l.date === iso && hm(l.time) + SAFE <= p.min) return;
          if (l.date > nextIso) return;
          yl.push({ he: (l.date === iso ? "" : (l.weekdayHe ? l.weekdayHe + ": " : "")) + l.he, time: fmt12(hm(l.time)), note: "" });
        });
        /* the Yom Tov times are in the right column (calendar hooks) */
        out.detail = { kind: "yomtov", title: ytTitle || T("titleYomTov"), lines: yl.slice(0, 3) }; out.card = null;
      }
    } else {
      var fast = null;
      [d.fast, dn && dn.fast].forEach(function (f) { if (!fast && f && f.key !== "Yom Kippur" && fastActive(f, p)) fast = f; });
      var endToday = endMin != null && p.min >= endMin + SAFE;
      var candle = d.candleLighting && d.candleLighting.time && d.candleLighting.kind === "beforeSunset" ? hm(d.candleLighting.time) : null;
      if (fast) {
        out.key = "fast"; out.tone = "fast"; out.title = fast.he;
        var fe = hm(fast.endsAt), fs = hm(fast.startsAt);
        var fl = [];
        fl.push({ he: (fast.labels && fast.labels.starts) || T("cardFastStarts"), time: fmt12(fs), note: fast.startsDate !== iso ? "" : "" });
        fl.push({ he: (fast.labels && fast.labels.ends) || T("cardFastEnds"), time: fmt12(fe) });
        out.card = { kind: "fast", title: (fast.labels && fast.labels.ends) || T("cardFastEnds"), lines: fl.slice(0, 1), endTime: fmt12(fe) };
        var fm = minutesUntil(now, fast.endsDate, fe);
        if (opts.switches && opts.switches.fastCountdown === false) fm = null;
        if (fast.endsDate !== iso) fm = null; /* the countdown only on the day the fast ends */
        out.card.countdown = { label: (fast.labels && fast.labels.ends) || T("cardFastEnds"), time: fmt12(fe), minutes: fm, text: fm == null ? "" : countdownText(T, fm) };
      } else if (endMin != null && endToday && d.sacredEnd) {
        var wasShabbat = d.sacredEnd.kind === "shabbat";
        out.key = wasShabbat ? "motzei-shabbat" : "motzei-yomtov"; out.tone = "normal";
        out.title = wasShabbat ? T("titleMotzeiShabbat") : T("titleMotzeiYomTov");
        var ml = [];
        if (wasShabbat && d.sacredEnd.rabbeinuTam && p.min < hm(d.sacredEnd.rabbeinuTam) + 5) ml.push(line(T("sbRabbeinuTam"), hm(d.sacredEnd.rabbeinuTam)));
        out.card = { kind: out.key, title: wasShabbat ? T("cardMotzeiWeek") : T("titleMotzeiYomTov"), lines: ml };
      } else if (candle != null && p.min < candle) {
        var forYT = d.candleLighting.for === "yomtov" || !!(dn && dn.isYomTov);
        var ykEve = dn && dn.isYomKippur;
        out.key = ykEve ? "erev-yomkippur" : (forYT ? "erev-yomtov" : "erev-shabbat");
        out.tone = "erev";
        out.title = ykEve ? T("titleErevYomKippur") : (forYT ? (holidayNames(d, ["erev"])[0] || T("titleErevYomTov")) : T("titleErevShabbat"));
        if (forYT && p.wd === 5) out.sub.push(T("titleErevShabbat"));
        if (!forYT && parasha) out.sub.push(parasha);
        var cl = [line(T("cardCandles"), candle)];
        if (ykEve && dn.fast) cl.push(line(T("cardFastStarts"), hm(dn.fast.startsAt)));
        out.card = { kind: out.key, title: T("cardCandles"), lines: cl };
        var cm = minutesUntil(now, iso, candle);
        if (!(opts.switches && opts.switches.candleCountdown === false)) out.card.countdown = { label: T("cardCandles"), time: fmt12(candle), minutes: cm, text: countdownText(T, cm) };
      } else if (hasHoliday(d, "Purim") || (night && hasHoliday(dn, "Purim")) || (earlyNight && hasHoliday(d, "Purim"))) {
        out.key = "purim"; out.tone = "festive"; out.title = T("titlePurim");
        out.card = { kind: "purim", title: T("cardPurim"), lines: [] };
      } else if (chanukahNow()) {
        out.key = "chanukah"; out.tone = "festive"; out.title = T("titleChanukah");
        out.card = chanukahCard();
      } else if (d.isCholHamoed && !(afterSunset && dn && dn.isYomTov)) {
        out.key = "cholhamoed"; out.tone = "festive"; out.title = T("titleCholHamoed");
        var hn = holidayNames(d, null)[0] || "";
        if (hn) out.sub.push(hn);
        out.card = null; /* the header says it; יעלה ויבוא is in the insertions strip */
      } else if (rcNow()) {
        out.key = "roshchodesh"; out.tone = "festive";
        var rc = rcNow();
        out.title = T("titleRoshChodesh", { month: monthName(rc) });
        out.card = rcCard(rc);
      } else {
        out.key = "weekday";
        /* weekday: the header stays as it is today (no title) */
      }
    }
    add(out.key);

    function chanukahInfo() {
      /* the night that is "tonight": from the afternoon until dawn */
      var src = earlyNight ? dp : d;
      return src && src.chanukah ? src.chanukah : null;
    }
    function chanukahNow() {
      var c = chanukahInfo();
      if (!c) return false;
      if (c.dayOfChanukah || c.nightTonight) {
        /* the 8th day: no lighting tonight; still Chanukah until sunset */
        if (!c.nightTonight && afterSunset && !earlyNight) return false;
        return true;
      }
      return false;
    }
    function chanukahCard() {
      var c = chanukahInfo(), lines = [];
      if (c && c.nightTonight) {
        var n = c.candlesTonight || c.nightTonight;
        lines.push({ he: n === 1 ? T("cardChanukahTonight1") : T("cardChanukahTonightN", { n: n }), time: "" });
        if (c.lighting && c.lighting.time && !earlyNight) lines.push({ he: T("cardChanukahLighting") + (c.lighting.noteHe ? " (" + c.lighting.noteHe + ")" : ""), time: fmt12(hm(c.lighting.time)) });
      }
      return { kind: "chanukah", title: c && c.dayOfChanukah && !afterSunset ? T("cardChanukahDay", { n: c.dayOfChanukah }) : T("cardChanukah"), lines: lines, candles: c && c.nightTonight ? (c.candlesTonight || c.nightTonight) : 0 };
    }
    function rcNow() {
      if (afterSunset && !earlyNight) return dn && dn.roshChodesh ? dn.roshChodesh : null;
      return d.roshChodesh || null;
    }
    function rcCard(rc) {
      var lines = [];
      if (rc.ofDays === 2) lines.push({ he: T("cardRoshChodeshDayOf", { day: rc.dayOf === 1 ? "א׳" : "ב׳" }), time: "" });
      /* יעלה ויבוא itself is in the prayer-insertions strip just below */
      return { kind: "roshchodesh", title: T("titleRoshChodesh", { month: monthName(rc) }), lines: lines };
    }

    /* ---------- secondary chips (any state) ---------- */
    if (out.key !== "roshchodesh") {
      var rcx = rcNow();
      if (rcx) { add("roshchodesh"); out.chips.push({ key: "roshchodesh", he: T("titleRoshChodesh", { month: monthName(rcx) }) + (rcx.ofDays === 2 ? " | " + T("cardRoshChodeshDayOf", { day: rcx.dayOf === 1 ? "א׳" : "ב׳" }) : "") }); }
    }
    if (out.key !== "chanukah" && chanukahNow()) {
      var ci = chanukahInfo(); add("chanukah");
      out.chips.push({ key: "chanukah", he: ci && ci.nightTonight ? (ci.nightTonight === 1 ? T("chipChanukahTonight1") : T("chipChanukahTonightN", { n: ci.candlesTonight || ci.nightTonight })) : (ci && ci.dayOfChanukah ? T("cardChanukahDay", { n: ci.dayOfChanukah }) : T("cardChanukah")), time: ci && ci.nightTonight && ci.lighting && ci.lighting.time && !earlyNight && !sacredKind ? fmt12(hm(ci.lighting.time)) : "" });
    }
    /* Sefirat HaOmer: tonight's count, from nightfall (+1) until dawn */
    var om = null;
    if (night && d.omer && d.omer.tonight) om = d.omer.tonight.day;
    else if (earlyNight && dp && dp.omer && dp.omer.tonight) om = dp.omer.tonight.day;
    if (om && !out.missing) { add("omer"); out.omer = om; out.chips.push({ key: "omer", he: T("chipOmer", { n: om }), big: true }); }
    /* Kiddush Levana: inside the engine's window (7 days after the molad,
       until dawn of the 15th / 14th), never while Shabbat / Yom Tov / a fast
       is still on the screen. */
    var kl = d.kiddushLevana && d.kiddushLevana.window ? d.kiddushLevana.window : null;
    var nowMs = now.getTime();
    if (kl && !sacredKind && out.key !== "fast") {
      var from = Math.max(kl.fromMs || 0, kl.startMs || 0, kl.recommendedStartMs || 0);
      if (nowMs >= from && nowMs < kl.endMs) {
        var u = kl.until, ud = safeDay(cal, u.iso);
        var untilTxt = ud ? T("wd" + wdOf(u.iso)) + " " + noYear(ud.hebrew && ud.hebrew.text) : u.iso;
        var tonightFirst = p.iso === (kl.from && kl.from.iso) && !earlyNight;
        var last = d.kiddushLevana.lastNight && !earlyNight;
        add("kiddushlevana");
        out.chips.push({ key: "kiddushlevana", he: T(last ? "chipKiddushLevanaLast" : (tonightFirst ? "chipKiddushLevanaFirst" : "chipKiddushLevana"), { date: untilTxt.trim() }), time: fmt12(u.minutes) });
      }
    }
    /* a fast that starts tomorrow at dawn */
    if (out.key !== "fast" && dn && dn.fast && dn.fast.startsDate === nextIso && dn.fast.key !== "Yom Kippur" && !fastActive(dn.fast, p)) {
      add("erev-fast"); out.chips.push({ key: "erev-fast", he: T("chipFastTomorrow", { name: dn.fast.he }), time: fmt12(hm(dn.fast.startsAt)) });
    }
    /* erev Purim / erev Chanukah, as a small note */
    if (out.key !== "purim" && !afterSunset && hasHoliday(dn, "Purim")) { add("erev-purim"); out.chips.push({ key: "erev-purim", he: T("chipErevPurim") }); }
    if (out.key !== "chanukah" && !chanukahNow() && dn && dn.chanukah && dn.chanukah.dayOfChanukah === 1) { add("erev-chanukah"); }
    /* other days of the calendar (Tu BiShvat, Lag BaOmer, Ta'anit Bechorot, Purim Katan, Shushan Purim...) as a small chip, by day */
    if (!(afterSunset && !earlyNight)) {
      ((d.holidays) || []).forEach(function (h) {
        if (h.kind !== "minor" || h.key === "Purim" || out.key === "fast" && d.fast && h.he === d.fast.he) return;
        if (d.fast && h.he === d.fast.he) return;
        add("minor"); out.chips.push({ key: "minor", he: h.he });
      });
    }
    if (out.missing && out.detail) out.detail = { kind: out.detail.kind, title: out.detail.title, lines: out.detail.lines.filter(function (l) { return !l.time; }) };
    if (out.missing) { out.card = out.card ? { kind: out.card.kind, title: out.card.title, lines: out.card.lines.filter(function (l) { return !l.time; }) } : null; out.chips = out.chips.filter(function (c) { return !c.time; }); }
    return out;
  }

  var api = { compute: compute, nyParts: nyParts, nyToMs: nyToMs, minutesUntil: minutesUntil, addDays: addDays, hm: hm, fmt12: fmt12, countdownText: countdownText, fastActive: fastActive, SAFE_MINUTES: SAFE };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.OH_DAYSTATE = api;
})(typeof window !== "undefined" ? window : null);
