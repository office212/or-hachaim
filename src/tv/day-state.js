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


  /* ---------- 2040 phase 2 (Hanoch, Nov 4 2026, 7:34 AM, the Rav's answers) ---------- */

  /* 1. Erev Pesach: "סוף זמן אכילת חמץ" and "סוף זמן ביעור חמץ" per Zemaneh
     Yosef. The site's daily file has no such field, so these are the
     outputs of the Zemaneh Yosef engine itself (royzmanim, ROYZmanim.js
     getSofZemanAhilathHametz / getSofZemanBiurHametz: dawn + 4 / 5 seasonal
     hours of the Magen Avraham day, dawn to nightfall), at the shul
     (40.60155, -74.13206, no elevation, the same BASE settings as
     validation/run-roy-full-year.mjs, whose dawn / Shema times for 5787 they
     match to the second), each rounded EARLIER to the whole minute (a
     deadline is never shown a minute late). Key = 14 Nisan.
     [achila, biur] or, when 14 Nisan is Shabbat, [achila, biur, Friday 13
     Nisan, biur on that Friday] (the chametz is burnt on Friday; on Shabbat
     it may be eaten until the 4th hour and is nullified by the 5th).
     Shown only on a date the daily zmanim file covers (never a time on a
     day without the file). */
  var CHAMETZ = {
    "2027-04-21": ["10:09", "11:32"],
    "2028-04-10": ["10:17", "11:37"],
    "2029-03-30": ["10:26", "11:44"],
    "2030-04-17": ["10:12", "11:34"],
    "2031-04-07": ["10:20", "11:39"],
    "2032-03-26": ["10:30", "11:46"],
    "2033-04-13": ["10:15", "11:36"],
    "2034-04-03": ["10:23", "11:41"],
    "2035-04-23": ["10:08", "11:31"],
    "2036-04-11": ["10:16", "11:37"],
    "2037-03-30": ["10:26", "11:44"],
    "2038-04-19": ["10:11", "11:33"],
    "2039-04-08": ["10:19", "11:39"],
    "2040-03-28": ["10:28", "11:45"],
    "2041-04-15": ["10:13", "11:35"],
    "2042-04-04": ["10:22", "11:41"],
    "2043-04-24": ["10:07", "11:31"],
    "2044-04-11": ["10:16", "11:37"],
    "2045-04-01": ["10:25", "11:42", "2045-03-31", "11:43"],
    "2046-04-20": ["10:10", "11:33"],
    "2047-04-10": ["10:18", "11:38"],
    "2048-03-28": ["10:28", "11:45", "2048-03-27", "11:45"],
    "2049-04-16": ["10:13", "11:34"],
    "2050-04-06": ["10:21", "11:40"]
  };
  /* The same two times on the GRA day (sunrise to sunset, the basis of the
     site's Sof Zman Tefillah: achila = Sof Zman Tefillah), same engine, same
     rounding. NOT shown. Kept only so that, if the Rav prefers the GRA day,
     the change is one word: CHAMETZ_BASIS = "gra". */
  var CHAMETZ_GRA = {
    "2027-04-21": ["10:40", "11:47"],
    "2028-04-10": ["10:46", "11:52"],
    "2029-03-30": ["10:55", "11:58"],
    "2030-04-17": ["10:42", "11:49"],
    "2031-04-07": ["10:49", "11:54"],
    "2032-03-26": ["10:57", "12:00"],
    "2033-04-13": ["10:45", "11:51"],
    "2034-04-03": ["10:52", "11:56"],
    "2035-04-23": ["10:38", "11:47"],
    "2036-04-11": ["10:46", "11:51"],
    "2037-03-30": ["10:55", "11:58"],
    "2038-04-19": ["10:41", "11:48"],
    "2039-04-08": ["10:48", "11:53"],
    "2040-03-28": ["10:56", "11:59"],
    "2041-04-15": ["10:43", "11:50"],
    "2042-04-04": ["10:51", "11:55"],
    "2043-04-24": ["10:38", "11:46"],
    "2044-04-11": ["10:46", "11:51"],
    "2045-04-01": ["10:53", "11:57", "2045-03-31", "11:57"],
    "2046-04-20": ["10:40", "11:48"],
    "2047-04-10": ["10:47", "11:52"],
    "2048-03-28": ["10:56", "11:58", "2048-03-27", "11:59"],
    "2049-04-16": ["10:42", "11:49"],
    "2050-04-06": ["10:49", "11:54"]
  };
  var CHAMETZ_BASIS = "mga"; /* "mga" = Zemaneh Yosef's own chametz times (shown) | "gra" */
  /* rows for the daily zmanim list of iso: [{ key, textKey, he, time "HH:MM" }] */
  function chametzRows(iso, zdays, basis) {
    if (!iso || !zdays || !zdays[iso]) return [];
    var TBL = (basis || CHAMETZ_BASIS) === "gra" ? CHAMETZ_GRA : CHAMETZ;
    var e = TBL[iso];
    if (e) {
      if (wdOf(iso) === 6) return [{ key: "achilatChametz", textKey: "zAchilatChametz", he: "סוף זמן אכילת חמץ", time: e[0] }, { key: "bitulChametz", textKey: "zBitulChametz", he: "סוף זמן ביטול חמץ", time: e[1] }];
      return [{ key: "achilatChametz", textKey: "zAchilatChametz", he: "סוף זמן אכילת חמץ", time: e[0] }, { key: "biurChametz", textKey: "zBiurChametz", he: "סוף זמן ביעור חמץ", time: e[1] }];
    }
    var nx = TBL[addDays(iso, 1)];
    if (nx && nx[2] === iso && nx[3]) return [{ key: "biurChametzFri", textKey: "zBiurChametzFri", he: "סוף זמן ביעור חמץ (ערב שבת)", time: nx[3] }];
    return [];
  }

  /* 2. Nachem on Tisha B'Av: a note for the whole day in the insertions
     line, switching at sunset exactly like Al HaNissim (from sunset of the
     eve, when the fast starts, until sunset of the fast day). A Tisha B'Av
     pushed to Sunday (nidcheh) follows the engine's fast day. */
  function isTishaBavDay(d) { return !!(d && d.fast && /^Tish'a B'Av/.test(String(d.fast.key || ""))); }
  function nachemNow(cal, iso, afterSunset) { return isTishaBavDay(safeDay(cal, afterSunset ? addDays(iso, 1) : iso)); }

  /* 3. Candles for the second night of Yom Tov (lit on day 1, after dark).
     Day 1 NOT Shabbat: regular Tzet Hakochavim of day 1 (the daily file's
     minute, + 1 safe minute, like the Omer count), instead of the engine's
     later chag-end time. Day 1 IS Shabbat: unchanged, only after Shabbat
     ends (the engine's Motzei Shabbat time). Never earlier than nightfall;
     with no daily file for the day the engine's (later) time stays. */
  function secondNightCandle(cal, iso, zdays) {
    var d = safeDay(cal, iso);
    if (!d || !d.isYomTov || d.isYomKippur || wdOf(iso) === 6) return null;
    var cl = d.candleLighting;
    if (!cl || cl.kind !== "notBefore" || !cl.time) return null;
    var dn = safeDay(cal, addDays(iso, 1));
    if (!dn || !dn.isYomTov) return null;
    var z = zdays && zdays[iso], tz = z ? hm(z.tzeit) : null;
    if (tz == null) return null;
    var t = tz + SAFE, eng = hm(cl.time);
    if (eng == null || t >= eng) return null;
    return { time: pad(Math.floor(t / 60)) + ":" + pad(t % 60), engineTime: cl.time };
  }
  /* The calendar as the TV uses it: the same engine, with rule 3 applied to
     every day object and Yom Tov line it hands out (day, range,
     screenState). Nothing else changes. getZdays: () -> daily zmanim map. */
  function wrapCalendar(cal, getZdays) {
    if (!cal || cal.__ohP2) return cal;
    var w = Object.create(cal);
    w.__ohP2 = true;
    function zd() { try { return typeof getZdays === "function" ? getZdays() : (getZdays || null); } catch (e) { return null; } }
    function fixLines(lines) {
      if (!lines || !lines.length) return lines;
      var z = zd(), changed = false;
      var out = lines.map(function (l) {
        if (!l || !l.date || !l.time) return l;
        var f = secondNightCandle(cal, l.date, z);
        if (!f || l.time !== f.engineTime) return l;
        changed = true;
        return Object.assign({}, l, { time: f.time, source: "tzeit", engineTime: l.time });
      });
      return changed ? out : lines;
    }
    function fixPanels(panels) {
      if (!panels || !panels.length) return panels;
      return panels.map(function (p) { return p && p.id === "yomtov-times" && p.lines ? Object.assign({}, p, { lines: fixLines(p.lines) }) : p; });
    }
    function fixDay(d) {
      if (!d || !d.date) return d;
      var f = secondNightCandle(cal, d.date, zd());
      var o = Object.assign({}, d);
      if (f && d.candleLighting) o.candleLighting = Object.assign({}, d.candleLighting, { time: f.time, source: "tzeit", engineTime: d.candleLighting.time });
      o.panels = fixPanels(d.panels);
      return o;
    }
    w.day = function (iso) { return fixDay(cal.day(iso)); };
    if (typeof cal.range === "function") w.range = function (iso, n) { return (cal.range(iso, n) || []).map(fixDay); };
    w.screenState = function (now) {
      var s = cal.screenState(now);
      if (!s) return s;
      var o = Object.assign({}, s);
      o.day = fixDay(s.day);
      o.panels = fixPanels(s.panels);
      return o;
    };
    return w;
  }

  var api = { compute: compute, nyParts: nyParts, nyToMs: nyToMs, minutesUntil: minutesUntil, addDays: addDays, hm: hm, fmt12: fmt12, countdownText: countdownText, fastActive: fastActive, SAFE_MINUTES: SAFE,
    chametzRows: chametzRows, CHAMETZ: CHAMETZ, CHAMETZ_GRA: CHAMETZ_GRA, CHAMETZ_BASIS: CHAMETZ_BASIS, nachemNow: nachemNow, isTishaBavDay: isTishaBavDay, secondNightCandle: secondNightCandle, wrapCalendar: wrapCalendar };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.OH_DAYSTATE = api;
})(typeof window !== "undefined" ? window : null);
