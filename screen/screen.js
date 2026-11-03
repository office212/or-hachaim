/* Role gate: daily times, Shabbat block and rotating boards are rendered
   only when the page is ungated by a role check in screen/index.html.
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
   Centre boards below are PLACEHOLDER sections: titles are present
   and rotate, bodies are placeholder text only, no real content
   is invented. Announcements, dedications, flyers, yahrzeit and
   images are not yet wired to Firestore, so their boards stay
   placeholder until a gabbai enters real content through a live
   Firestore path. Do not treat a placeholder board as live data. */
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
   Yom Tov still needs a holiday list (open item). */
function isShabbatDay() {
  if (document.body.classList.contains("shabbat")) return true;
  var wd = nyWeekday(), now = nowMinsNY();
  if (wd === 5) return now >= (ROY_DAY && ROY_DAY.candle18 ? mins(ROY_DAY.candle18) : 16 * 60);
  if (wd === 6) {
    var ends = ROY_DAY && (ROY_DAY.shabbatEndsMyZmanim || ROY_DAY.shabbatEndsAngle85);
    return ends ? now < mins(ends) : true;
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
function royZmanimList() {
  if (!ROY_DAY) return null;
  var map = [
    ["alot", "עלות השחר (שוות)", "Alot (equal minutes)"],
    ["talis", "זמן טלית ותפילין", "Talis and Tefillin"],
    ["netz", "נץ החמה", "Netz"],
    ["shemaMagen", "סוף זמן קריאת שמע מגן אברהם (שוות)", "Shema, Magen Avraham (equal minutes)"],
    ["shemaGra", "סוף זמן קריאת שמע גרא", "Shema, Gra"],
    ["tefillah", "סוף זמן תפילה", "Sof Zman Tefillah"],
    ["chatzot", "חצות יום", "Chatzot"],
    ["minchaGedola", "מנחה גדולה", "Mincha Gedola"],
    ["plag", "פלג המנחה", "Plag HaMincha"],
    ["shkiah", "שקיעה", "Shkiah"],
    ["tzeit", "צאת הכוכבים", "Tzeit HaKochavim"]
  ];
  return map.map(function (m) { return { key: m[0], he: m[1], en: m[2], time: ROY_DAY[m[0]] }; }).concat(
    ROY_DAY.shabbatEndsMyZmanim ? [{ key: "shabbatEnds", he: "צאת שבת", en: "Shabbat ends", time: ROY_DAY.shabbatEndsMyZmanim }] : [],
    ROY_DAY.rabbeinuTamMyZmanim ? [{ key: "rabbeinuTam", he: "רבינו תם (המוקדם)", en: "Rabbeinu Tam (early)", time: ROY_DAY.rabbeinuTamMyZmanim }] : []
  );
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
try {
  fetch("../src/zmanim/roy-daily-5787.json").then(function (r) { return r.json(); }).then(function (j) {
    ROY_JSON = j;
    ensureToday();
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
  if (m <= 0) return "עכשיו · Now";
  if (m < 60) return "בעוד " + m + " דקות · in " + m + " min";
  var h = Math.floor(m / 60), r = m % 60;
  return "בעוד " + h + ":" + (r < 10 ? "0" : "") + r + " שעות · in " + h + "h " + r + "m";
}
function nextZman(list, now) {
  for (var i = 0; i < list.length; i++) { if (mins(list[i].time) >= now) return list[i]; }
  return null;
}
function renderShabbatBlock() {
  if (isScreenGated()) return;
  var el = document.getElementById("shabbatBlock"); if (!el || !ROY_JSON) return;
  var wd = nyWeekday(), fri, sat;
  if (wd === 5) { fri = ROY_JSON.days[dateKeyOffset(0)]; sat = ROY_JSON.days[dateKeyOffset(1)]; }
  else if (wd === 6) { fri = ROY_JSON.days[dateKeyOffset(-1)]; sat = ROY_JSON.days[dateKeyOffset(0)]; }
  else {
    var off = (5 - wd + 7) % 7; if (off === 0) off = 7;
    fri = ROY_JSON.days[dateKeyOffset(off)]; sat = ROY_JSON.days[dateKeyOffset(off + 1)];
  }
  if (!fri && !sat) return;
  var candle = fri && fri.candle18 ? displayTime(fri.candle18) : "PLACEHOLDER";
  var ends = sat && sat.shabbatEndsMyZmanim ? displayTime(sat.shabbatEndsMyZmanim) : "PLACEHOLDER";
  var rt = sat && sat.rabbeinuTamMyZmanim ? displayTime(sat.rabbeinuTamMyZmanim) : "PLACEHOLDER";
  el.innerHTML = zRow("הדלקת נרות", "Candle lighting", candle, false) +
    zRow("צאת שבת", "Shabbat ends", ends, false) +
    zRow("רבינו תם (המוקדם)", "Rabbeinu Tam (early)", rt, false);
}
/* One row: Hebrew name large, English small under it, time on the
   far side. Same markup for zmanim, prayers and the Shabbat block. */
function zRow(he, en, time, isNext) {
  return '<div class="zman-row' + (isNext ? " next" : "") + '"><span class="zn"><span class="he">' + he + '</span><span class="en">' + en + '</span></span><span class="zt" dir="ltr">' + time + "</span></div>";
}
function renderZmanim() {
  if (isScreenGated()) return;
  var now = nowMinsNY(), next = null, html = "";
  var list = royZmanimList() || [];
  list.forEach(function (z) {
    var t = mins(z.time);
    if (now > t + 5) return; /* hide-after: gone 5 minutes after it passes, for that day */
    if (next === null && t >= now) next = z.key;
    html += zRow(z.he, z.en, displayTime(z.time), next === z.key);
  });
  var zl = document.getElementById("zmanList");
  if (zl) {
    zl.innerHTML = html || "<p>אין זמני יום טעונים כרגע / No daily times loaded yet.</p>";
    try { localStorage.setItem("orHachaimLastZman", zl.innerHTML); } catch (e) {}
  }
  /* Next-zman hero, with countdown in minutes. Never a past time. */
  var heroName = document.getElementById("nextHeroName"), heroTime = document.getElementById("nextHeroTime"), heroCd = document.getElementById("nextHeroCountdown"), heroLine = document.getElementById("nextHeroLine");
  var nz = nextZman(list, now), label = "", tText = "", cd = "";
  if (nz) { label = nz.he + " / " + nz.en; tText = displayTime(nz.time); cd = countdownText(mins(nz.time) - now); }
  else if (ROY_JSON) {
    var tom = ROY_JSON.days[dateKeyOffset(1)];
    if (tom && tom.alot) { label = "עלות השחר מחר / Alot tomorrow"; tText = displayTime(tom.alot); cd = countdownText(1440 - now + mins(tom.alot)); }
    else { label = "אין זמנים נוספים היום / No more times today"; tText = ""; cd = ""; }
  }
  /* Hebrew name large, English small under it (label is "Hebrew / English"). */
  if (heroName) {
    var lp = label.split(" / ");
    heroName.innerHTML = '<span class="he">' + lp[0] + "</span>" + (lp[1] ? '<span class="en">' + lp[1] + "</span>" : "");
  }
  if (heroTime) heroTime.textContent = tText;
  if (heroCd) heroCd.textContent = cd;
  if (heroLine) heroLine.textContent = label && tText ? ("הזמן הבא: " + label + " " + tText) : "";
  var box = document.getElementById("netzBox");
  if (box) {
    if (!ROY_DAY) { box.style.display = "none"; return; }
    var netz = mins(ROY_DAY.netz);
    if (now >= netz - 5 && now < netz) {
      box.style.display = "block";
      var left = netz - now;
      box.textContent = "הנץ בעוד " + left + (left === 1 ? " דקה" : " דקות") + " · Netz in " + left + " min";
    } else { box.style.display = "none"; }
  }
}
/* Rotating centre boards. Every board is PLACEHOLDER unless a live
   Firestore path fills it later. No real names, dates or times are
   invented here. Campaign is weekday-only and is skipped on Shabbat. */
var BOARDS = [
  { he: "ברוכים הבאים", en: "Welcome", body: "PLACEHOLDER / פליסהולדר: welcome text to be entered by a gabbai." },
  { he: "פרשה והפטרה", en: "Parsha and Haftarah", body: "PLACEHOLDER / פליסהולדר: parsha and haftarah to be entered by a gabbai." },
  { he: "שבתות מיוחדות", en: "Special Shabbatot", body: "PLACEHOLDER / פליסהולדר: special Shabbat to be entered by a gabbai." },
  { he: "ראש חודש / מברכים / מולד", en: "Rosh Chodesh / Mevarchim / Molad", body: "PLACEHOLDER / פליסהולדר: Rosh Chodesh, Mevarchim and Molad to be entered by a gabbai." },
  { he: "ספירת העומר", en: "Omer", body: "PLACEHOLDER / פליסהולדר: Omer count, shown in season only, to be entered by a gabbai." },
  { he: "חנוכה", en: "Hanukkah", body: "PLACEHOLDER / פליסהולדר: Hanukkah candle times and animated Hanukkiah, shown in season only, to be entered by a gabbai." },
  { he: "קידוש לבנה", en: "Kiddush Levana", body: "PLACEHOLDER / פליסהולדר: Kiddush Levana window to be entered by a gabbai." },
  { he: "עירוב תבשילין", en: "Eruv Tavshilin", body: "PLACEHOLDER / פליסהולדר: Eruv Tavshilin reminder, shown when a Yom Tov precedes Shabbat, to be entered by a gabbai." },
  { he: "לוח שיעורים", en: "Shiur Schedule", body: "PLACEHOLDER / פליסהולדר: shiur schedule to be entered by a gabbai." },
  { he: "היום יום", en: "Hayom Yom", body: "PLACEHOLDER / פליסהולדר: Hayom Yom entry to be entered by a gabbai." },
  { he: "הלכה יומית", en: "Daily Halacha", body: "PLACEHOLDER / פליסהולדר: daily halacha, 365 cycle, to be entered by a gabbai." },
  { he: "מזל טוב", en: "Mazal Tov", body: "PLACEHOLDER / פליסהולדר: Mazal Tov notice to be entered by a gabbai." },
  { he: "הזכרות", en: "Hazkarot", body: "PLACEHOLDER / פליסהולדר: hazkarot and condolences to be entered by a gabbai." },
  { he: "נותני חסות: קידוש וסעודה שלישית", en: "Kiddush and Seudah Shlishit Sponsors", body: "PLACEHOLDER / פליסהולדר: Kiddush and Seudah Shlishit sponsors to be entered by a gabbai." },
  { he: "פרנס היום", en: "Parnas Hayom", body: "PLACEHOLDER / פליסהולדר: Parnas Hayom and Ner LaMaor to be entered by a gabbai." },
  { he: "ברכת הרב", en: "Rabbi Message", body: "PLACEHOLDER / פליסהולדר: rabbi message and Shabbat blessing to be entered by a gabbai." },
  { he: "פליירים", en: "Flyers", body: "PLACEHOLDER / פליסהולדר: date-windowed flyers, shown only inside their start and end dates, to be entered by a gabbai. Not yet saved to Firestore." },
  { he: "נותני חסות לפי תאריך", en: "Date-Windowed Sponsorships", body: "PLACEHOLDER / פליסהולדר: date-windowed sponsorships, shown only inside their start and end dates, to be entered by a gabbai. Not yet saved to Firestore." },
  { he: "הקדשות קבועות", en: "Permanent Dedications", body: "PLACEHOLDER / פליסהולדר: permanent dedications to be entered by a gabbai. Not yet saved to Firestore." },
  { he: "מגבית", en: "Campaign Board", body: "PLACEHOLDER / פליסהולדר: campaign board to be entered by a gabbai. Weekday only, hidden on Shabbat.", weekdayOnly: true },
  { he: "צומות וימים מיוחדים", en: "Fasts and Special Days", body: "PLACEHOLDER / פליסהולדר: fast entry and exit times and related details to be entered by a gabbai." },
  { he: "יורצייט", en: "Yahrzeit", body: "PLACEHOLDER / פליסהולדר: yahrzeit added once, recurs yearly in its week, to be entered by a gabbai. Not yet saved to Firestore." }
];
var zi = 0;
function visibleBoards() {
  if (!isShabbatDay()) return BOARDS;
  return BOARDS.filter(function (b) { return !b.weekdayOnly; });
}
function renderZone() {
  if (isScreenGated()) return;
  var el = document.getElementById("centerZone"); if (!el) return;
  var boards = visibleBoards();
  if (!boards.length) boards = BOARDS.slice(0, 1);
  var z = boards[zi % boards.length];
  el.innerHTML = "<h3>" + z.he + '<span class="en">' + z.en + "</span></h3><p class=\"board-body\">" + z.body + "</p>";
  var idx = document.getElementById("boardIndex");
  if (idx) idx.textContent = ((zi % boards.length) + 1) + " / " + boards.length;
  try { localStorage.setItem("orHachaimLastZone", el.innerHTML); } catch (e) {}
  zi++;
}
/* The status line is visible only when the TV is offline. When online
   there is nothing to say, so nothing is shown. */
var lastOnlineStamp = "";
function updateOfflineNote() {
  var el = document.getElementById("offlineNote"); if (!el) return;
  var stamp = new Date().toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  if (navigator.onLine) { lastOnlineStamp = stamp; el.textContent = ""; el.classList.remove("is-offline"); }
  else {
    el.textContent = "אין חיבור, מוצג המידע האחרון · Offline" + (lastOnlineStamp ? ", " + lastOnlineStamp : "");
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
function tick() {
  var clock = document.getElementById("clock"); if (clock) clock.textContent = fmtClock();
  var dl = document.getElementById("dateLine");
  if (dl) dl.textContent = new Date().toLocaleDateString("en-US", { timeZone: "America/New_York", weekday: "long", year: "numeric", month: "long", day: "numeric" });
  var hd = document.getElementById("hebrewDateLine");
  if (hd) {
    try { hd.textContent = hebrewDateText(new Date(), true); }
    catch (e) { hd.textContent = ""; }
  }
  ensureToday();
  applyWeekdayHiding();
  applyNightDim();
  renderZmanim();
  updateOfflineNote();
}
/* Night dim, against burn-in: from NIGHT_DIM_FROM until 60 minutes
   before Alot the whole screen dims. Automatic, also on Shabbat, so
   nobody touches anything. Set NIGHT_DIM to false to turn it off. */
var NIGHT_DIM = true, NIGHT_DIM_FROM = "23:30";
function applyNightDim() {
  if (!NIGHT_DIM) return;
  var now = nowMinsNY(), from = mins(NIGHT_DIM_FROM);
  var wake = ROY_DAY && ROY_DAY.alot ? mins(ROY_DAY.alot) - 60 : 4 * 60;
  document.body.classList.toggle("night", now >= from || now < wake);
}
var burnStep = 0;
function applyBurnShift() {
  var main = document.querySelector(".tv"); /* the whole screen moves, header and footer too */
  if (!main) return;
  main.classList.remove("burn-shift-1", "burn-shift-2", "burn-shift-3", "burn-shift-4");
  if (isShabbatDay()) return; /* No movement on Shabbat. Holiday detection is not yet wired: holidays require a holiday list, see report. */
  burnStep = (burnStep % 4) + 1;
  main.classList.add("burn-shift-" + burnStep);
}
/* The Shabbat preview button is for gabbaim, not for the TV: it shows
   only when the page is opened with ?preview in the address. */
if (/[?&]preview\b/.test(location.search)) document.body.classList.add("preview");
var shabToggle = document.getElementById("shabbatToggle");
if (shabToggle) shabToggle.addEventListener("click", function () {
  document.body.classList.toggle("shabbat");
  this.textContent = document.body.classList.contains("shabbat") ? "צא מתצוגת שבת / Exit Shabbat preview" : "תצוגת שבת / Shabbat preview";
  applyBurnShift(); applyWeekdayHiding(); renderZone();
});
tick(); renderZone(); applyBurnShift(); updateOfflineNote();
setInterval(tick, 1000);
setInterval(renderZone, 12000);
setInterval(applyBurnShift, 300000);
/* Pick up an updated daily file without anyone touching the TV. */
setInterval(function () {
  if (!navigator.onLine) return;
  fetch("../src/zmanim/roy-daily-5787.json", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) {
    if (j && j.days) { ROY_JSON = j; ROY_DAY_KEY = null; ensureToday(); }
  }).catch(function () {});
}, 6 * 60 * 60 * 1000);
