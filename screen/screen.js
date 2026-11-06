/* Role gate: daily times, Shabbat block and rotating boards are rendered
   only when the page is ungated by a role check in the /screen/ page (screen/index.html).
   An unauthorized signed-in account stays gated, so even though the
   daily JSON is public, no TV content is rendered for it, and no
   offline fallback is restored for it. */
function isScreenGated() { return document.body.classList.contains("gated"); }
/* Screen logic, luxurious demo 2026-11-02.
   Live: daily times from the local daily JSON (11 times, plus Shabbat
   ends and Rabbeinu Tam early on Saturdays only, candle 18 minutes,
   Shema Magen equal minutes, Plag Halacha Brurah). No source names
   are rendered to the user. Internal field names in the JSON are
   not user-facing text.
   Clock, dates and DST use America/New_York via Intl only, so
   standard/daylight switching is automatic. No manual offset.
   v4 (2026-11-03): announcements, dedications, flyers, yahrzeit,
   sponsors, parnas hayom, mazal tov, hazkarot, rabbi message, campaign
   and donation come LIVE from Firestore (screenItems) through
   screen/content-board.js, each inside its date window, with weekday
   items hidden by the system on Shabbat and Yom Tov. The PLACEHOLDER
   boards below show only while there is no live content at all, and
   no real content is invented in them. */
/* Hebrew date with Hebrew letters (כ״ג בחשוון תשפ״ז), the way a
   synagogue writes it. Intl gives the Hebrew calendar but Arabic digits. */
function hebrewNumeral(n) {
  var ones = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"], tens = ["", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ"];
  var hund = ["", "ק", "ר", "ש", "ת", "תק", "תר", "תש", "תת", "תתק"];
  var s = hund[Math.floor(n / 100)]; n = n % 100;
  if (n === 15) s += "טו"; else if (n === 16) s += "טז"; else s += tens[Math.floor(n / 10)] + ones[n % 10];
  return s.length > 1 ? s.slice(0, -1) + "\u05F4" + s.slice(-1) : s + "\u05F3";
}
function hebrewDateText(date, withWeekday) {
  var opts = { timeZone: "America/New_York", day: "numeric", month: "long", year: "numeric" };
  if (withWeekday) opts.weekday = "long";
  return new Intl.DateTimeFormat("he-IL-u-ca-hebrew", opts).formatToParts(date).map(function (p) {
    if (p.type === "day") return hebrewNumeral(parseInt(p.value, 10));
    if (p.type === "year") return hebrewNumeral(parseInt(p.value, 10) % 1000);
    return p.value;
  }).join("");
}
function mins(t) {
  var p = String(t).split(":"); return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
}
function nowMinsNY() {
  try {
    var parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(new Date());
    var o = {}; parts.forEach(function (x) { o[x.type] = x.value; });
    return (parseInt(o.hour, 10) % 24) * 60 + parseInt(o.minute, 10); /* % 24: some engines print midnight as 24 */
  } catch (e) { var d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
}
function nyWeekday() {
  try {
    var wd = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" }).format(new Date());
    return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[wd];
  } catch (e) { return new Date().getDay(); }
}
/* Shabbat runs from Friday candle lighting until Shabbat ends on
   Saturday, not by calendar day. Before the daily file loads, Friday
   counts from 4:00 PM and Saturday stays Shabbat all day, the safe side.
   v4: Yom Tov is detected too, see below. */
function isShabbatDay() {
  if (document.body.classList.contains("shabbat")) return true;
  if (document.body.classList.contains("force-weekday")) return false; /* editor preview of a weekday */
  /* v4: Shabbat AND Yom Tov (chutz laaretz), from the Display Engine
     (src/engines/display-engine.js), which reads candle lighting and
     Shabbat ends from the same daily JSON. Used to hide weekday items
     and stop the drift, never to print a holiday time. */
  if (window.OH_DISPLAY && window.OH_DISPLAY.isRestTime) {
    return window.OH_DISPLAY.isRestTime(new Date(), function (k) { return ROY_JSON && ROY_JSON.days ? (ROY_JSON.days[k] || null) : null; });
  }
  var wd = nyWeekday(), now = nowMinsNY();
  if (wd === 5) return now >= (ROY_DAY && ROY_DAY.candle18 ? mins(ROY_DAY.candle18) : 16 * 60);
  if (wd === 6) {
    var ends = ROY_DAY && ROY_DAY.shabbatEndsMyZmanim;
    var endsM = ends ? mins(ends) : (ROY_DAY && ROY_DAY.shabbatEndsAngle85 ? mins(ROY_DAY.shabbatEndsAngle85) + 1 : null); /* hardening: the 8.5 degree fallback + 1 minute */
    return endsM != null ? now < endsM : true;
  }
  return false;
}
function fmtClock() {
  /* 12-hour clock with seconds, like the zmanim beside it (they are 12-hour too). */
  return new Date().toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true }).replace(/\s?[AP]M$/, "");
}
var ROY_DAY = null, ROY_JSON = null, ROY_DAY_KEY = null;
function displayTime(t24) {
  if (!t24) return "";
  var parts = String(t24).split(":"); var h = parseInt(parts[0], 10), m = parts[1];
  var h12 = h % 12; if (h12 === 0) h12 = 12;
  return h12 + ":" + m;
}
/* 2040 (Hanoch, Nov 4): every word on the TV comes from src/tv/tv-texts.js and
   can be changed by a gabbai (settings/screenTexts). Without that file the
   literal fallback below is shown, exactly as before. */
function TXT(key, vars, fb) { var X = window.OH_TV_TEXTS; return X ? X.t(key, vars) : (fb || ""); }
function TXP(key, fbHe, fbEn) { var X = window.OH_TV_TEXTS; return X ? X.pair(key) : { p: fbHe || "", s: fbEn || "" }; }
function TXJ(key, sep, fbHe, fbEn) { var q = TXP(key, fbHe, fbEn); return q.s ? q.p + sep + q.s : q.p; }
/* an engine label (Hebrew, e.g. "הדלקת נרות") with a gabbai's Hebrew override */
function TXL(he) { var X = window.OH_TV_TEXTS; return X && he ? X.fromHe(he) : he; }
function royZmanimList(day, withShabbat, iso) {
  if (arguments.length === 0) { day = ROY_DAY; withShabbat = true; }
  if (!day) return null;
  if (!iso && day === ROY_DAY) iso = ROY_DAY_KEY;
  var map = [
    ["alot", "zAlot", "עלות השחר (שוות)", "Alot (equal minutes)"],
    ["talis", "zTalis", "זמן טלית ותפילין", "Talis and Tefillin"],
    ["netz", "zNetz", "נץ החמה", "Netz"],
    ["shemaMagen", "zShemaMagen", "סוף זמן קריאת שמע מגן אברהם (שוות)", "Shema, Magen Avraham (equal minutes)"],
    ["shemaGra", "zShemaGra", "סוף זמן קריאת שמע גרא", "Shema, Gra"],
    ["tefillah", "zTefillah", "סוף זמן תפילה", "Sof Zman Tefillah"],
    ["chatzot", "zChatzot", "חצות יום", "Chatzot"],
    ["minchaGedola", "zMinchaGedola", "מנחה גדולה", "Mincha Gedola"],
    ["plag", "zPlag", "פלג המנחה", "Plag HaMincha"],
    ["shkiah", "zShkiah", "שקיעה", "Shkiah"],
    ["tzeit", "zTzeit", "צאת הכוכבים", "Tzeit HaKochavim"]
  ];
  function lbl(key, k, fbHe, fbEn, time) { var q = TXP(k, fbHe, fbEn); return { key: key, he: q.p, en: q.s, time: time }; }
  var list = map.filter(function (m) { return !!day[m[0]]; }).map(function (m) { return lbl(m[0], m[1], m[2], m[3], day[m[0]]); });
  /* 2040 phase 2 (the Rav, via Hanoch, Nov 4): on Erev Pesach the two chametz
     deadlines per Zemaneh Yosef join the list in time order (src/tv/day-state.js
     chametzRows; Friday too when Erev Pesach is Shabbat). Only on a day the
     daily file covers. */
  var DSx = window.OH_DAYSTATE;
  if (iso && DSx && DSx.chametzRows && ROY_JSON && ROY_JSON.days) {
    DSx.chametzRows(iso, ROY_JSON.days).forEach(function (c) {
      var row = lbl(c.key, c.textKey, c.he, "", c.time), at = list.length;
      for (var i = 0; i < list.length; i++) { if (mins(list[i].time) > mins(c.time)) { at = i; break; } }
      list.splice(at, 0, row);
    });
  }
  if (!withShabbat) return list;
  /* v5: Shabbat ends and Rabbeinu Tam stay in the "next zman" list (the
     hero card), but they are SHOWN only once, in the Shabbat section of
     the right column (renderShabbatBlock), never twice. */
  return list.concat(
    day.shabbatEndsMyZmanim ? [lbl("shabbatEnds", "sbShabbatEnds", "צאת שבת", "Shabbat ends", day.shabbatEndsMyZmanim)] : [],
    /* v5.1: 5788 Yom Tov weekdays carry the MyZmanim-rule end (yomTovEndsMyZmanim);
       on a weekday only Yom Kippur also carries Rabbeinu Tam, so that day is "צאת הצום". */
    day.yomTovEndsMyZmanim && yomTovEndsTonight() ? [day.rabbeinuTamMyZmanim ? lbl("yomTovEnds", "sbFastEnds", "צאת הצום", "Fast ends", day.yomTovEndsMyZmanim) : lbl("yomTovEnds", "sbYomTovEnds", "צאת החג", "Yom Tov ends", day.yomTovEndsMyZmanim)] : [],
    rtOf(day) ? [lbl("rabbeinuTam", "sbRabbeinuTam", "רבינו תם (המוקדם)", "Rabbeinu Tam (early)", rtOf(day))] : []
  );
}
/* v5.1: today's Yom Tov ends tonight only when tomorrow is not a rest day
   (day 1 of a two-day Yom Tov carries the value only for "candles not before"). */
function yomTovEndsTonight() {
  try { if (window.OH_DISPLAY && window.OH_DISPLAY.isRestDay) return !window.OH_DISPLAY.isRestDay(dateKeyOffset(1)); } catch (e) {}
  return true;
}
function dateKeyOffset(offset) {
  var d = new Date();
  try {
    var parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
    var o = {}; parts.forEach(function (x) { o[x.type] = x.value; });
    var base = new Date(parseInt(o.year, 10), parseInt(o.month, 10) - 1, parseInt(o.day, 10));
    base.setDate(base.getDate() + offset);
    var y = base.getFullYear(), mo = String(base.getMonth() + 1).padStart(2, "0"), da = String(base.getDate()).padStart(2, "0");
    return y + "-" + mo + "-" + da;
  } catch (e) {
    d.setDate(d.getDate() + offset);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
}
function todayKey() { return dateKeyOffset(0); }
/* v4: the daily file per Hebrew year, merged. 5787 ends 2027-10-01, so
   without 5788 the screen would go blank on 2027-10-02. The 5788 file
   is "pending rabbi review" (no MyZmanim fields yet; Shabbat ends from
   our own 8.5 degree angle). A missing file is skipped, never invented. */
/* Rabbeinu Tam from the ONE site basis (src/zmanim/rabbeinu-tam.js, Hanoch 2026-11-04:
   72 zmaniyot after Shkiah, rounded up), only on the days the daily file gives one. */
function rtOf(day) { var R = window.OH_RABBEINU_TAM; return day && day.rabbeinuTamMyZmanim && R && R.timeFor ? R.timeFor(day) : null; }
var ROY_FILES = ["../src/zmanim/roy-daily-5787.json", "../src/zmanim/roy-daily-5788.json"];
function loadRoyFiles(noStore) {
  return Promise.all(ROY_FILES.map(function (f) {
    return fetch(f, noStore ? { cache: "no-store" } : {}).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  })).then(function (list) {
    var days = {}, n = 0;
    list.forEach(function (j) { if (j && j.days) Object.keys(j.days).forEach(function (k) { days[k] = j.days[k]; n++; }); });
    return n ? { days: days } : null;
  });
}
try {
  loadRoyFiles(false).then(function (j) {
    if (j) { ROY_JSON = j; ensureToday(); }
  }).catch(function () {});
} catch (e) {}
/* Midnight rollover: a TV that runs for weeks must switch to the new
   day by itself. Called on load and on every tick. */
function ensureToday() {
  if (!ROY_JSON || !ROY_JSON.days) return;
  var key = todayKey();
  if (key === ROY_DAY_KEY) return;
  ROY_DAY_KEY = key;
  ROY_DAY = ROY_JSON.days[key] || null;
  renderZmanim(); renderShabbatBlock();
}
function countdownText(m) {
  /* hidden while SHOW_NEXT_COUNTDOWN is false; same words as the rest of the TV */
  if (m <= 0) return TXT("cdNow", null, "עכשיו");
  if (m === 1) return TXT("cdOneMinute", null, "בעוד דקה אחת");
  if (m < 60) return TXT("cdMinutes", { n: m }, "בעוד " + m + " דקות");
  var h = Math.floor(m / 60), r = m % 60;
  if (h === 1) return r ? TXT("cdOneHourMin", { m: r }, "בעוד שעה ו-" + r + " דק׳") : TXT("cdOneHour", null, "בעוד שעה");
  return r ? TXT("cdHoursMin", { h: h, m: r }, "בעוד " + h + " שעות ו-" + r + " דק׳") : TXT("cdHours", { h: h }, "בעוד " + h + " שעות");
}
/* Plan 1.1, 1.2, 1.3 are NO: no countdown to the next time. The only
   countdown on the screen is the netz window below (5 minutes before
   netz). Set to true only by Hanoch's explicit decision. */
var SHOW_NEXT_COUNTDOWN = false;
function nextZman(list, now) {
  for (var i = 0; i < list.length; i++) { if (mins(list[i].time) >= now) return list[i]; }
  return null;
}
/* v5 (2026-11-03): the Shabbat / Yom Tov section lives in the RIGHT column
   ("זמני היום"), under the daily zmanim. Hanoch: "זמני היום כולל שבת בצד
   ימין, צד שמאל זה זמני תפילות", and (9:17 AM) the Shabbat block shows
   ONLY from Friday until Motzei Shabbat, and Yom Tov times only from
   erev Yom Tov until it ends. On other days the section is not shown.
   It stays until Shabbat ends and Rabbeinu Tam passed (+5 minutes, like
   the zmanim rows). Text and times come only from the calendar module
   and the daily JSON. */
function escS(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function haftarahLine(h) {
  return TXT("sbHaftarah", { text: h.displayHe }, "הפטרה: " + h.displayHe);
}
function moladLine(m) {
  if (!window.OH_TV_TEXTS || m.hour == null) return m.textHe || "";
  return TXT("moladLine", { day: m.dowHe, h: m.hour, mm: (m.minutes < 10 ? "0" : "") + m.minutes, ch: m.chalakim });
}
function sbCell(label, time, key, nextKey) {
  return '<div class="sb-cell' + (key && key === nextKey ? " next" : "") + '"><span class="sb-l">' + escS(TXL(label)) + '</span><span class="sb-t" dir="ltr">' + (time ? escS(displayTime(time)) : "--") + "</span></div>";
}
function sbRow(label, time, isNext, missing) {
  return '<div class="zman-row sb-row' + (isNext ? " next" : "") + '"><span class="zn"><span class="he">' + escS(label) + '</span></span><span class="zt" dir="ltr">' + (time ? escS(displayTime(time)) : (missing ? "--" : "")) + "</span></div>";
}
var _sbSig = "";
/* v5.2: shown under a Shabbat / Yom Tov time that was computed by MyZmanim's
   rules (5788, field myZmanimSource "model"), never under a MyZmanim file value */
var MODEL_NOTE_HTML = function () { return '<p class="sb-model">' + escS(TXT("sbModelNote", null, "חישוב לפי כללי MyZmanim")) + "</p>"; };
function calReady() { return !!(window.OH_CALENDAR && window.OH_CALENDAR.ready && window.OH_CALENDAR.ready()); }
/* Is this Shabbat's block on now? Friday (all day) and Saturday until the
   end of Shabbat and Rabbeinu Tam (+5 min). */
function shabbatWindowOpen(endTime, rtTime) {
  var wd = nyWeekday();
  if (wd === 5) return true;
  if (wd !== 6) return false;
  if (isShabbatDay()) return true;
  var last = rtTime || endTime;
  return !last || nowMinsNY() <= mins(last) + 5;
}
function renderShabbatBlock(nextKey, nextMin) {
  if (isScreenGated()) return;
  var el = document.getElementById("shabbatBlock"); if (!el) return;
  var html = "", today = dateKeyOffset(0), now = nowMinsNY();
  var yt = calReady() && window.OH_CALENDAR.yomTov ? window.OH_CALENDAR.yomTov(new Date()) : null;
  var sb = calReady() && window.OH_CALENDAR.shabbatInfo ? window.OH_CALENDAR.shabbatInfo(new Date()) : null;
  if (yt) {
    /* Yom Tov stretch (it may include Shabbat): one list, past days and
       passed times dropped, so nothing is shown twice. */
    var rows = "", nextDone = false, shown = [];
    yt.lines.forEach(function (l) {
      if (l.date < today) return;
      if (l.date === today && l.time && now > mins(l.time) + 5) return;
      if (l.date === today && !l.time && !l.missing && ROY_DAY && ROY_DAY.shkiah && now > mins(ROY_DAY.shkiah)) return; /* e.g. eruv tavshilin, once the day is over */
      shown.push(l);
    });
    /* v5.2: when every row left is of one day, and that day is the one
       in progress (today, or tomorrow once today's sunset passed), the day
       name is not printed on each row (Yom Kippur: "צאת הצום" and "רבינו
       תם" without "יום שני" twice). A list over several days keeps them. */
    var oneDay = shown.length > 0 && shown.every(function (l) { return l.date === shown[0].date; });
    var afterSunset = !!(ROY_DAY && ROY_DAY.shkiah && now >= mins(ROY_DAY.shkiah));
    var dropDay = oneDay && (shown[0].date === today || (afterSunset && shown[0].date === dateKeyOffset(1)));
    var model = false;
    shown.forEach(function (l) {
      var isNext = false;
      /* highlighted only when it is really the next time on the screen (the same one as the next-zman line) */
      if (!nextDone && l.time && (l.date > today || mins(l.time) >= now)) { isNext = l.date === today && (nextMin == null || mins(l.time) <= nextMin); nextDone = true; }
      if (l.time && l.source === "MyZmanim-rules") model = true;
      rows += sbRow((l.weekdayHe && !dropDay ? TXL(l.weekdayHe) + ", " : "") + TXL(l.he), l.time, isNext, l.missing);
    });
    var inStretchShabbat = sb && sb.shabbat >= yt.first && sb.shabbat <= yt.last;
    /* v5.3 (rabbi's ruling, Nov 3: everything per Zemaneh Yosef, Sephardi haftarah only):
       a Shabbat inside the Yom Tov run (e.g. Shabbat Chol HaMoed Pesach 24.4.2027) shows
       its haftarah here too, the same line as the Shabbat block (sb.haftarah.displayHe).
       Only while that Shabbat is the day in progress (Friday after sunset until Saturday
       sunset), so it is not read as the haftarah of another day of the run. */
    var shabbatNow = inStretchShabbat && ((sb.shabbat === today && !afterSunset) || (afterSunset && sb.shabbat === dateKeyOffset(1)));
    html = '<div class="sb-head"><span class="sb-parasha">' + escS(yt.titleHe) + "</span>" +
      (inStretchShabbat && sb.parashaHe ? '<span class="sb-kicker">' + escS(sb.parashaHe) + "</span>" : "") + "</div>" +
      (shabbatNow && sb.haftarah && sb.haftarah.displayHe ? '<p class="sb-haftarah">' + escS(haftarahLine(sb.haftarah)) + "</p>" : "") +
      '<div class="sb-list">' + rows + "</div>" + (model ? MODEL_NOTE_HTML() : "");
  } else if (sb && shabbatWindowOpen(sb.end && sb.end.time, sb.end && sb.end.rabbeinuTam)) {
    var special = (sb.special || []).map(function (x) { return x && x.he; }).filter(Boolean);
    var cells = "";
    if (sb.candleLighting) cells += sbCell(sb.candleLighting.label || "הדלקת נרות", sb.candleLighting.time, "candle", nextKey);
    if (sb.end) {
      cells += sbCell(sb.end.label || "צאת שבת", sb.end.time, "shabbatEnds", nextKey);
      if (sb.end.rabbeinuTam || sb.end.rabbeinuTamMissing) cells += sbCell(TXT("sbRabbeinuTam", null, "רבינו תם (המוקדם)"), sb.end.rabbeinuTam, "rabbeinuTam", nextKey);
    } else if (sb.candleLightingSaturdayNight) {
      cells += sbCell(sb.candleLightingSaturdayNight.label || "הדלקת נרות", sb.candleLightingSaturdayNight.time, "candleSat", nextKey);
    }
    html = '<div class="sb-head"><span class="sb-kicker">' + escS(TXT("sbShabbatKodesh", null, "שבת קודש")) + "</span>" + (sb.parashaHe ? '<span class="sb-parasha">' + escS(sb.parashaHe) + "</span>" : "") + "</div>";
    if (special.length) html += '<p class="sb-special">' + special.map(escS).join(" | ") + "</p>";
    if (sb.haftarah && sb.haftarah.displayHe) html += '<p class="sb-haftarah">' + escS(haftarahLine(sb.haftarah)) + "</p>";
    html += '<div class="sb-times">' + cells + "</div>";
    if (sb.mevarchim && sb.mevarchim.molad && sb.mevarchim.molad.textHe) {
      var mevSaid = special.indexOf(sb.mevarchim.he) >= 0;
      html += '<p class="sb-molad">' + (mevSaid ? "" : escS(sb.mevarchim.he) + " | ") + escS(moladLine(sb.mevarchim.molad)) + "</p>";
    }
    /* v5.2: a 5788 end / Rabbeinu Tam computed by MyZmanim's rules (no MyZmanim file yet) says so, small */
    var sbModel = (sb.end && ((sb.end.time && sb.end.source === "MyZmanim-rules") || (sb.end.rabbeinuTam && sb.end.rabbeinuTamSource === "MyZmanim-rules"))) ||
      (!sb.end && sb.candleLightingSaturdayNight && sb.candleLightingSaturdayNight.time && sb.candleLightingSaturdayNight.source === "MyZmanim-rules");
    if (sbModel) html += MODEL_NOTE_HTML();
  } else if (!calReady() && ROY_JSON) {
    /* calendar module not loaded: the three times from the daily JSON, Friday and Shabbat only */
    var wd = nyWeekday(), fri = null, sat = null;
    if (wd === 5) { fri = ROY_JSON.days[dateKeyOffset(0)]; sat = ROY_JSON.days[dateKeyOffset(1)]; }
    else if (wd === 6) { fri = ROY_JSON.days[dateKeyOffset(-1)]; sat = ROY_JSON.days[dateKeyOffset(0)]; }
    if ((fri || sat) && shabbatWindowOpen(sat && sat.shabbatEndsMyZmanim, rtOf(sat))) html = '<div class="sb-head"><span class="sb-kicker">' + escS(TXT("sbShabbatKodesh", null, "שבת קודש")) + '</span></div><div class="sb-times">' +
      sbCell("הדלקת נרות", fri && fri.candle18, "candle", nextKey) + sbCell("צאת שבת", sat && sat.shabbatEndsMyZmanim, "shabbatEnds", nextKey) +
      sbCell("רבינו תם (המוקדם)", rtOf(sat), "rabbeinuTam", nextKey) + "</div>";
  }
  var sig = (yt ? "Y" : "S") + html;
  /* 2040: the layout editor can hide this block; the zmanim column then ignores it */
  if (sig === _sbSig) return;
  _sbSig = sig;
  el.innerHTML = html;
  el.classList.toggle("is-full", !!html);
  el.classList.toggle("is-yomtov", !!yt);
  el.hidden = !html;
}
/* v5 (Hanoch, 9:15 to 9:19 AM): the prayer insertions are a fixed BOLD
   line at the very top of the centre column, no heading, several joined
   with " | "; hidden on a day with none. Not a board. */
var _insSig = null;
/* 2040: the insertions with a gabbai's words for the fixed ones.
   The Omer line: tonight's count only from tzeit + 1 minute (never before
   nightfall, so no one counts early from the screen); between sunset and
   that minute the day's count stays. */
function insertionWords(list) {
  var st = null, d = null;
  try { st = window.OH_CALENDAR.state ? window.OH_CALENDAR.state(new Date()) : null; d = st && st.day; } catch (e) {}
  var after = !!(st && st.hebrewDateSwitchedAtSunset);
  var beforeTzeit = after && ROY_DAY && ROY_DAY.tzeit && nowMinsNY() < mins(ROY_DAY.tzeit) + 1;
  var out = [];
  list.forEach(function (x) {
    x = String(x);
    if (/לעומר/.test(x) && d && d.omer) {
      var o = beforeTzeit ? d.omer.today : (after ? d.omer.tonight : d.omer.today);
      if (!o || !(o.nusachHe || o.day)) return;
      out.push({ omer: true, text: o.nusachHe || (o.day + " לעומר") }); /* the nusach is the calendar's (marked for the rabbi), not an editable word */
      return;
    }
    var m = /^ממוסף: (.*)$/.exec(x);
    if (m) { out.push({ text: TXT("insFromMusaf", { text: TXL(m[1]) }, x) }); return; }
    out.push({ text: TXL(x) });
  });
  return out;
}
function renderInsertions() {
  if (isScreenGated()) return;
  var el = document.getElementById("insStrip"); if (!el) return;
  var list = calReady() && window.OH_CALENDAR.insertions ? (window.OH_CALENDAR.insertions(new Date()) || []) : [];
  list = insertionWords(list);
  /* 2040 phase 2 (the Rav, via Hanoch, Nov 4): נחם on Tisha B'Av, a note for the
     whole day like על הניסים (switches at sunset), placed before עננו. */
  try {
    var DSn = window.OH_DAYSTATE, stn = window.OH_CALENDAR.state ? window.OH_CALENDAR.state(new Date()) : null;
    var calN = window.OH_TV && window.OH_TV.cal;
    if (DSn && DSn.nachemNow && calN && stn && stn.now && DSn.nachemNow(calN, stn.now.iso, !!stn.hebrewDateSwitchedAtSunset)) {
      var nItem = { text: TXL("נחם") }, at = list.length;
      for (var ni = 0; ni < list.length; ni++) { if (list[ni].text === TXL("עננו")) { at = ni; break; } }
      list.splice(at, 0, nItem);
    }
  } catch (e) {}
  /* a short insertion never breaks inside, and its " | " stays with it */
  var html = list.map(function (x, i) { return '<span class="ins-item' + (x.omer ? " ins-omer" : "") + (String(x.text).length <= 26 ? " nw" : "") + '">' + (i ? '<span class="ins-sep">| </span>' : "") + escS(x.text) + "</span>"; }).join(" ");
  if (html === _insSig) { insSeps(el, false); return; }
  _insSig = html;
  el.innerHTML = html;
  el.hidden = !html;
  insSeps(el, true);
}
if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { _insSig = null; });
/* the insertions line: one line when it fits; a " | " never opens a line.
   Re-checked every tick, so a late web font cannot leave one behind. */
function insOneLine(items) { for (var k = 1; k < items.length; k++) if (items[k].offsetTop > items[0].offsetTop + 2) return false; return true; }
function insSeps(el, fresh) {
  var items = el.querySelectorAll(".ins-item"); if (!items.length) return;
  if (fresh) {
    /* short insertions: one line if it fits at a slightly smaller size; otherwise the normal size on two lines */
    var sizes = ["", "2.5vh", "2.25vh"], pick = "";
    for (var i = 0; i < sizes.length; i++) { el.style.fontSize = sizes[i]; if (insOneLine(items)) { pick = sizes[i]; break; } }
    el.style.fontSize = pick;
  }
  /* a " | " that would open a line is made invisible (it keeps its width, so nothing moves) */
  for (var k = 1; k < items.length; k++) {
    var sep = items[k].querySelector(".ins-sep"); if (!sep) continue;
    var vis = items[k].offsetTop > items[k - 1].offsetTop + 2 ? "hidden" : "";
    if (sep.style.visibility !== vis) sep.style.visibility = vis;
  }
}
/* One row: Hebrew name large, English small under it, time on the
   far side. Same markup for zmanim, prayers and the Shabbat block. */
function zRow(he, en, time, isNext) {
  return '<div class="zman-row' + (isNext ? " next" : "") + '"><span class="zn"><span class="he">' + escS(he) + '</span>' + (en ? '<span class="en">' + escS(en) + '</span>' : "") + '</span><span class="zt" dir="ltr">' + time + "</span></div>";
}
function renderZmanim() {
  if (isScreenGated()) return;
  var now = nowMinsNY(), next = null, html = "";
  var list = royZmanimList(ROY_DAY, true) || [];      /* for the "next zman" card */
  var daily = royZmanimList(ROY_DAY, false) || [];    /* rows shown in the right column */
  var nz = nextZman(list, now);
  /* v5: after tzeit (the day's last zman, +5 minutes like every row) the
     column shows TOMORROW's zmanim with a small "זמני מחר" label, instead
     of an empty column. Friday night this is Shabbat's day. */
  var shown = daily.filter(function (z) { return !(now > mins(z.time) + 5); }); /* hide-after: gone 5 minutes after it passes */
  var tomorrow = false;
  if (!shown.length && ROY_JSON && ROY_JSON.days) {
    var tom = ROY_JSON.days[dateKeyOffset(1)];
    var tl = royZmanimList(tom, false, dateKeyOffset(1)) || [];
    if (tl.length) { shown = tl; tomorrow = true; }
  }
  shown.forEach(function (z) {
    var isNext = false;
    if (tomorrow) isNext = !nz && next === null; /* tomorrow's first row is the next zman when nothing is left today */
    else isNext = next === null && mins(z.time) >= now && nz && nz.key === z.key;
    if (isNext) next = z.key;
    html += zRow(z.he, z.en, displayTime(z.time), isNext);
  });
  var zl = document.getElementById("zmanList");
  if (zl) {
    var out = html || "<p>" + escS(TXJ("zNoneLoaded", " / ", "אין זמני יום טעונים כרגע", "No daily times loaded yet.")) + "</p>";
    if (zl.innerHTML !== out) { zl.innerHTML = out; try { localStorage.setItem("orHachaimLastZman", out); } catch (e) {} }
  }
  var lab = document.getElementById("zmanDayLabel");
  if (lab) {
    lab.hidden = !tomorrow;
    var tq = TXP("zTomorrow", "זמני מחר", "Tomorrow");
    var lt = tomorrow ? '<span class="he">' + escS(tq.p) + "</span>" + (tq.s ? '<span class="en">' + escS(tq.s) + "</span>" : "") : "";
    if (lab.innerHTML !== lt) lab.innerHTML = lt;
  }
  var colZ = document.querySelector(".col-zmanim"); if (colZ) colZ.classList.toggle("is-tomorrow", tomorrow);
  renderShabbatBlock(nz ? nz.key : null, nz ? mins(nz.time) : null);
  renderInsertions();
  var heroName = document.getElementById("nextHeroName"), heroTime = document.getElementById("nextHeroTime"), heroCd = document.getElementById("nextHeroCountdown"), heroLine = document.getElementById("nextHeroLine");
  var label = "", tText = "", cd = "";
  if (nz) { label = nz.en ? nz.he + " / " + nz.en : nz.he; tText = displayTime(nz.time); cd = countdownText(mins(nz.time) - now); }
  else if (ROY_JSON) {
    var tom = ROY_JSON.days[dateKeyOffset(1)];
    if (tom && tom.alot) { label = TXJ("zAlotTomorrow", " / ", "עלות השחר מחר", "Alot tomorrow"); tText = displayTime(tom.alot); cd = countdownText(1440 - now + mins(tom.alot)); }
    else { label = TXJ("zNoMore", " / ", "אין זמנים נוספים היום", "No more times today"); tText = ""; cd = ""; }
  }
  /* Hebrew name large, English small under it (label is "Hebrew / English"). */
  if (heroName) {
    var lp = label.split(" / ");
    var hn = '<span class="he">' + escS(lp[0]) + "</span>" + (lp[1] ? '<span class="en">' + escS(lp[1]) + "</span>" : "");
    if (heroName.innerHTML !== hn) heroName.innerHTML = hn;
  }
  if (heroTime) heroTime.textContent = tText;
  if (heroCd) heroCd.textContent = SHOW_NEXT_COUNTDOWN ? cd : ""; /* plan 1.1-1.3: no countdowns, only the netz one */
  if (heroLine) heroLine.textContent = label && tText ? (TXT("nextZmanLabel", null, "הזמן הבא") + ": " + label + " " + tText) : "";
  var box = document.getElementById("netzBox");
  if (box) {
    if (!ROY_DAY) { box.style.display = "none"; return; } /* v5: inside the slim next-zman line (centre, top) */
    var netz = mins(ROY_DAY.netz);
    if (now >= netz - 5 && now < netz) {
      box.style.display = "inline-block";
      var left = netz - now;
      box.textContent = TXJ(left === 1 ? "zNetzCountdownOne" : "zNetzCountdown", " · ", "הנץ בעוד " + left + (left === 1 ? " דקה" : " דקות"), "Netz in " + left + " min").replace(/\{n\}/g, left);
    } else { box.style.display = "none"; }
  }
}
/* Rotating centre boards. Every board is PLACEHOLDER unless a live
   Firestore path fills it later. No real names, dates or times are
   invented here. Campaign is weekday-only and is skipped on Shabbat. */
/* v5: the placeholders for what the calendar module computes by itself
   (parasha, special Shabbatot, Rosh Chodesh / molad, Omer, Chanukah,
   Kiddush Levana, Eruv Tavshilin, fasts) are gone: those come from the
   calendar (right column, the insertions line, or calendar boards). */
var BOARDS = [
  { k: "phWelcome", he: "ברוכים הבאים", en: "Welcome", body: "PLACEHOLDER / פליסהולדר: welcome text to be entered by a gabbai." },
  { k: "phShiurim", he: "לוח שיעורים", en: "Shiur Schedule", body: "PLACEHOLDER / פליסהולדר: shiur schedule to be entered by a gabbai." },
  { k: "phHayomYom", he: "היום יום", en: "Hayom Yom", body: "PLACEHOLDER / פליסהולדר: Hayom Yom entry to be entered by a gabbai." },
  { k: "phHalacha", he: "הלכה יומית", en: "Daily Halacha", body: "PLACEHOLDER / פליסהולדר: daily halacha, 365 cycle, to be entered by a gabbai." },
  { k: "phMazalTov", he: "מזל טוב", en: "Mazal Tov", body: "PLACEHOLDER / פליסהולדר: Mazal Tov notice to be entered by a gabbai." },
  { k: "phHazkarot", he: "הזכרות", en: "Hazkarot", body: "PLACEHOLDER / פליסהולדר: hazkarot and condolences to be entered by a gabbai." },
  { k: "phSponsors", he: "נתרם על ידי: לדוגמה קידוש או סעודה שלישית", en: "Donated By: for example Kiddush or Seudah Shlishit", body: "PLACEHOLDER / פליסהולדר: donations for Kiddush, Seudah Shlishit or any other occasion, in free text, to be entered by a gabbai." },
  { k: "phParnas", he: "פרנס היום", en: "Parnas Hayom", body: "PLACEHOLDER / פליסהולדר: Parnas Hayom and Ner LaMaor to be entered by a gabbai." },
  { k: "phRabbi", he: "ברכת הרב", en: "Message from the Rav", body: "PLACEHOLDER / פליסהולדר: rabbi message and Shabbat blessing to be entered by a gabbai." },
  { k: "phFlyers", he: "פליירים", en: "Flyers", body: "PLACEHOLDER / פליסהולדר: date-windowed flyers, shown only inside their start and end dates, to be entered by a gabbai. Not yet saved to Firestore." },
  { k: "phDated", he: "נתרם על ידי, לפי תאריך", en: "Donations by Date", body: "PLACEHOLDER / פליסהולדר: date-windowed donations, shown only inside their start and end dates, to be entered by a gabbai. Not yet saved to Firestore." },
  { k: "phDedications", he: "הקדשות קבועות", en: "Permanent Dedications", body: "PLACEHOLDER / פליסהולדר: permanent dedications to be entered by a gabbai. Not yet saved to Firestore." },
  { k: "phCampaign", he: "מגבית", en: "Campaign", body: "PLACEHOLDER / פליסהולדר: campaign board to be entered by a gabbai. Weekday only, hidden on Shabbat.", weekdayOnly: true },
  { k: "phYahrzeit", he: "יורצייט", en: "Yahrzeit", body: "PLACEHOLDER / פליסהולדר: yahrzeit added once, recurs yearly in its week, to be entered by a gabbai. Not yet saved to Firestore." }
];
/* 2040: a placeholder board's words come from tv-texts (k, k + "Body") */
function boardWords(b) {
  if (!b.k || !window.OH_TV_TEXTS) return b;
  var q = TXP(b.k, b.he, b.en), body = TXT(b.k + "Body", null, b.body);
  return { he: q.p, en: q.s, body: body, weekdayOnly: b.weekdayOnly };
}
var zi = 0, zoneTimer = null;
function visibleBoards() {
  if (!isShabbatDay()) return BOARDS;
  return BOARDS.filter(function (b) { return !b.weekdayOnly; });
}
function escBoard(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
/* v4: live boards first (the gabbai's published items, from
   screen/content-board.js), then boards from the calendar module when
   it is loaded (window.OH_CALENDAR.boards(date, isRest) returning
   [{he, en, body}] or [{he, en, html}]). The PLACEHOLDER boards above
   show only while there is no live content at all, as before. */
function currentBoards() {
  var shab = isShabbatDay(), live = [], cal = [];
  try { if (window.OH_BOARDS) live = window.OH_BOARDS.boards(shab) || []; } catch (e) { live = []; }
  try { if (window.OH_CALENDAR && typeof window.OH_CALENDAR.boards === "function") cal = window.OH_CALENDAR.boards(new Date(), shab) || []; } catch (e) { cal = []; }
  cal = cal.map(function (b) { return { he: b.he || "", en: b.en || "", html: b.html || ('<p class="board-body">' + escBoard(b.body || "") + "</p>"), cls: b.cls || "" }; });
  var all = live.concat(cal);
  if (all.length) return all;
  if (window.OH_BOARDS && window.OH_BOARDS.isPreview()) return [];
  return visibleBoards().map(boardWords).map(function (b) { return { he: b.he, en: b.en, html: '<p class="board-body">' + escBoard(b.body) + "</p>", cls: "" }; });
}
function renderZone() {
  if (isScreenGated()) return;
  clearTimeout(zoneTimer);
  var el = document.getElementById("centerZone"); if (!el) return;
  var boards = currentBoards();
  var idx = document.getElementById("boardIndex");
  if (!boards.length) { el.innerHTML = ""; el.className = ""; var cc = el.closest ? el.closest(".col-center") : null; if (cc) cc.classList.remove("has-flyer"); if (idx) idx.textContent = ""; zoneTimer = setTimeout(renderZone, 12000); return; }
  var z = boards[zi % boards.length];
  el.className = z.cls || "";
  var colC = el.closest ? el.closest(".col-center") : null;
  if (colC) colC.classList.toggle("has-flyer", /\bis-flyer\b/.test(z.cls || ""));
  el.innerHTML = '<div class="cb-inner"><h3>' + escBoard(z.cls === "is-cal" ? TXL(z.he) : z.he) + (z.en ? '<span class="en">' + escBoard(z.en) + "</span>" : "") + "</h3>" + z.html + "</div>";
  if (idx) idx.textContent = boards.length > 1 ? ((zi % boards.length) + 1) + " / " + boards.length : "";
  try { localStorage.setItem("orHachaimLastZone", el.innerHTML); } catch (e) {}
  zi++;
  /* A long board scrolls slowly, pauses at the end, then the next one comes. */
  var extra = window.OH_BOARDS ? window.OH_BOARDS.fit(el) : 0;
  zoneTimer = setTimeout(renderZone, Math.max(12000, extra));
}
/* The status line is visible only when the TV is offline. When online
   there is nothing to say, so nothing is shown. */
var lastOnlineStamp = "";
function updateOfflineNote() {
  var el = document.getElementById("offlineNote"); if (!el) return;
  var stamp = new Date().toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  if (navigator.onLine) { lastOnlineStamp = stamp; el.textContent = ""; el.classList.remove("is-offline"); }
  else {
    el.textContent = TXJ("offlineOld", " · ", "אין חיבור, מוצג המידע האחרון", "Offline") + (lastOnlineStamp ? ", " + lastOnlineStamp : "");
    el.classList.add("is-offline");
  }
  if (!navigator.onLine && !isScreenGated()) {
    try {
      var last = localStorage.getItem("orHachaimLastZone");
      if (last) document.getElementById("centerZone").innerHTML = last;
      var lastZ = localStorage.getItem("orHachaimLastZman");
      if (lastZ) document.getElementById("zmanList").innerHTML = lastZ;
    } catch (e) {}
  }
}
window.addEventListener("online", updateOfflineNote);
window.addEventListener("offline", updateOfflineNote);
function applyWeekdayHiding() {
  var shab = isShabbatDay();
  document.body.classList.toggle("shabbat-time", shab); /* warmer Shabbat palette, automatic */
  document.querySelectorAll(".weekday-only").forEach(function (el) { el.style.display = shab ? "none" : ""; });
}
/* v5: the right and left columns must never spill at 1920x1080.
   First tighten (fit-1: smaller gaps, fit-2: no English sub-lines,
   fit-3: smaller type),
   and only if it still does not fit, scroll slowly with a pause at the
   top and at the bottom, like the long boards. Re-measured only when the
   column content or the screen size changes. */
var _colFit = {};
function fitColumn(col) {
  var body = col.querySelector(".col-body"), track = body && body.querySelector(".col-track");
  if (!body || !track) return;
  var key = col.classList.contains("col-zmanim") ? "z" : "p";
  var sig = track.innerHTML + "|" + window.innerWidth + "x" + window.innerHeight + "|" + document.body.className;
  var st = _colFit[key] || (_colFit[key] = {});
  if (st.sig === sig) return;
  st.sig = sig;
  var prevLevel = st.level, prevOver = st.over;
  col.classList.remove("fit-1", "fit-2", "fit-3", "is-scroll");
  var level = 0, over = track.scrollHeight - body.clientHeight;
  while (over > 1 && level < 3) { level++; col.classList.add("fit-" + level); over = track.scrollHeight - body.clientHeight; }
  st.level = level;
  if (over > 1) {
    col.classList.add("is-scroll");
    over = track.scrollHeight - body.clientHeight;
    if (st.anim && prevLevel === level && Math.abs((prevOver || 0) - over) < 2) { st.over = over; return; }
    if (st.anim) { try { st.anim.cancel(); } catch (e) {} }
    var pxs = Math.max(20, window.innerHeight * 0.022), move = over / pxs * 1000, hold = 7000, total = 2 * (hold + move);
    st.anim = track.animate ? track.animate([
      { transform: "translateY(0)" }, { transform: "translateY(0)", offset: hold / total },
      { transform: "translateY(" + -over + "px)", offset: (hold + move) / total }, { transform: "translateY(" + -over + "px)", offset: (2 * hold + move) / total },
      { transform: "translateY(0)" }
    ], { duration: total, iterations: Infinity, easing: "linear" }) : null;
    st.over = over;
  } else {
    if (st.anim) { try { st.anim.cancel(); } catch (e) {} st.anim = null; }
    st.over = 0;
  }
}
function fitColumns() {
  if (isScreenGated()) return;
  document.querySelectorAll(".tv .col-zmanim, .tv .col-prayers").forEach(fitColumn);
}
window.fitColumns = fitColumns;
function tick() {
  var clock = document.getElementById("clock"); if (clock) clock.textContent = fmtClock();
  var dl = document.getElementById("dateLine");
  if (dl) dl.textContent = new Date().toLocaleDateString("en-US", { timeZone: "America/New_York", weekday: "long", year: "numeric", month: "long", day: "numeric" });
  var hd = document.getElementById("hebrewDateLine");
  if (hd) {
    /* datefix (Nov 5, Hanoch): the Hebrew date turns at shkiah, the same rule
       and the same shkiah (daily file) as the landing page; after shkiah it is
       tomorrow's Hebrew date, without the weekday. */
    try {
      var zd = ROY_JSON && ROY_JSON.days && ROY_JSON.days[todayKey()];
      var afterShkiah = !!(zd && zd.shkiah && nowMinsNY() >= mins(zd.shkiah));
      hd.textContent = afterShkiah ? hebrewDateText(new Date(dateKeyOffset(1) + "T16:00:00Z"), false) : hebrewDateText(new Date(), true);
    }
    catch (e) { hd.textContent = ""; }
  }
  ensureToday();
  applyWeekdayHiding();
  if (window.OH_BOARDS) { try { window.OH_BOARDS.paintStatic(false); } catch (e) {} }
  applyNightDim();
  renderZmanim();
  fitColumns();
  updateOfflineNote();
}
/* Night dim, against burn-in: from NIGHT_DIM_FROM until 60 minutes
   before Alot the whole screen dims, but ONLY when the super admin
   turned it on (settings/tvDisplay { nightDim: true }). Off by default
   (Hanoch Nov 6 2026): a missing document, a missing field, or no
   answer yet all mean lit, never dimmed. The value arrives from
   tv-live.js (onSnapshot, no reload); turning it off removes the
   class on the next tick, within a second. */
var NIGHT_DIM_FROM = "23:30";
function dimEnabled() {
  var s = window.OH_TV_DISPLAY;
  return !!(s && s.nightDim === true);
}
function applyNightDim() {
  if (!dimEnabled()) { document.body.classList.remove("night"); return; }
  var now = nowMinsNY(), from = mins(NIGHT_DIM_FROM);
  var wake = ROY_DAY && ROY_DAY.alot ? mins(ROY_DAY.alot) - 60 : 4 * 60;
  document.body.classList.toggle("night", now >= from || now < wake);
}
var burnStep = 0;
function applyBurnShift() {
  var main = document.querySelector(".tv"); /* the whole screen moves, header and footer too */
  if (!main) return;
  main.classList.remove("burn-shift-1", "burn-shift-2", "burn-shift-3", "burn-shift-4");
  if (isShabbatDay()) return; /* No movement on Shabbat and Yom Tov (v4: Yom Tov detected by the Display Engine). */
  burnStep = (burnStep % 4) + 1;
  main.classList.add("burn-shift-" + burnStep);
}
/* The Shabbat preview button is for gabbaim, not for the TV: it shows
   only when the page is opened with ?preview in the address. */
if (/[?&]preview\b/.test(location.search)) document.body.classList.add("preview");
var shabToggle = document.getElementById("shabbatToggle");
if (shabToggle) shabToggle.addEventListener("click", function () {
  document.body.classList.toggle("shabbat");
  this.textContent = document.body.classList.contains("shabbat") ? TXJ("shabbatPreviewExitBtn", " / ", "צא מתצוגת שבת", "Exit Shabbat preview") : TXJ("shabbatPreviewBtn", " / ", "תצוגת שבת", "Shabbat preview");
  applyBurnShift(); applyWeekdayHiding(); renderZone();
});
tick(); renderZone(); applyBurnShift(); updateOfflineNote();
setInterval(tick, 1000);
/* v5: the weekly Shabbat section is refreshed by renderZmanim on every tick (it moves to next week by itself). */
/* renderZone schedules itself: 12 seconds per board, longer for a long board that scrolls. */
setInterval(applyBurnShift, 300000);
/* Pick up an updated daily file without anyone touching the TV. */
setInterval(function () {
  if (!navigator.onLine) return;
  loadRoyFiles(true).then(function (j) {
    if (j && j.days) { ROY_JSON = j; ROY_DAY_KEY = null; ensureToday(); }
  }).catch(function () {});
}, 6 * 60 * 60 * 1000);
