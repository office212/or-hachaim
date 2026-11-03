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
function mins(t) {
  var p = String(t).split(":"); return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
}
function nowMinsNY() {
  try {
    var parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(new Date());
    var o = {}; parts.forEach(function (x) { o[x.type] = x.value; });
    return parseInt(o.hour, 10) * 60 + parseInt(o.minute, 10);
  } catch (e) { var d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
}
function nyWeekday() {
  try {
    var wd = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" }).format(new Date());
    return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[wd];
  } catch (e) { return new Date().getDay(); }
}
function isShabbatDay() {
  return document.body.classList.contains("shabbat") || nyWeekday() === 6;
}
function fmtClock() {
  return new Date().toLocaleTimeString("en-US", { timeZone: "America/New_York", hour12: false });
}
var ROY_DAY = null, ROY_JSON = null;
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
    var day = j.days && j.days[todayKey()];
    if (day) { ROY_DAY = day; renderZmanim(); renderShabbatBlock(); }
  }).catch(function () {});
} catch (e) {}
function nextZman(list, now) {
  for (var i = 0; i < list.length; i++) { if (mins(list[i].time) >= now) return list[i]; }
  return null;
}
function renderShabbatBlock() {
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
  el.innerHTML = '<div class="zman-row"><span>הדלקת נרות / Candle lighting</span><span>' + candle + '</span></div>' +
    '<div class="zman-row"><span>צאת שבת / Shabbat ends</span><span>' + ends + '</span></div>' +
    '<div class="zman-row"><span>רבינו תם (המוקדם) / Rabbeinu Tam (early)</span><span>' + rt + '</span></div>';
}
function renderZmanim() {
  var now = nowMinsNY(), next = null, html = "";
  var list = royZmanimList() || [];
  list.forEach(function (z) {
    var t = mins(z.time);
    if (now > t + 5) return; /* hide-after: gone 5 minutes after it passes, for that day */
    if (next === null && t >= now) next = z.key;
    html += '<div class="zman-row' + (next === z.key ? " next" : "") + '"><span><span class="he">' + z.he + "</span> / " + z.en + "</span><span>" + displayTime(z.time) + "</span></div>";
  });
  var zl = document.getElementById("zmanList");
  if (zl) {
    zl.innerHTML = html || "<p>אין זמני יום טעונים כרגע / No daily times loaded yet.</p>";
    try { localStorage.setItem("orHachaimLastZman", zl.innerHTML); } catch (e) {}
  }
  /* Next-zman hero, with countdown in minutes. Never a past time. */
  var heroName = document.getElementById("nextHeroName"), heroTime = document.getElementById("nextHeroTime"), heroCd = document.getElementById("nextHeroCountdown"), heroLine = document.getElementById("nextHeroLine");
  var nz = nextZman(list, now), label = "", tText = "", cd = "";
  if (nz) { label = nz.he + " / " + nz.en; tText = displayTime(nz.time); cd = (mins(nz.time) - now) + " minutes to go / דקות נותרו"; }
  else if (ROY_JSON) {
    var tom = ROY_JSON.days[dateKeyOffset(1)];
    if (tom && tom.alot) { label = "עלות השחר מחר / Alot tomorrow"; tText = displayTime(tom.alot); cd = (1440 - now + mins(tom.alot)) + " minutes to go / דקות נותרו"; }
    else { label = "אין זמנים נוספים היום / No more times today"; tText = ""; cd = ""; }
  }
  if (heroName) heroName.textContent = label;
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
      box.textContent = "Netz in " + left + " minute" + (left === 1 ? "" : "s") + " (small window, in addition to Netz time; disappears after Netz)";
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
  var el = document.getElementById("centerZone"); if (!el) return;
  var boards = visibleBoards();
  if (!boards.length) boards = BOARDS.slice(0, 1);
  var z = boards[zi % boards.length];
  el.innerHTML = "<h3>" + z.he + " / " + z.en + "</h3><p class=\"board-body\">" + z.body + "</p><p><small><span class=\"placeholder\">PLACEHOLDER</span></small></p>";
  var idx = document.getElementById("boardIndex");
  if (idx) idx.textContent = "Board " + ((zi % boards.length) + 1) + " of " + boards.length + ", rotating, one board at a time. / לוח " + ((zi % boards.length) + 1) + " מתוך " + boards.length;
  try { localStorage.setItem("orHachaimLastZone", el.innerHTML); } catch (e) {}
  zi++;
}
function updateOfflineNote() {
  var el = document.getElementById("offlineNote"); if (!el) return;
  var stamp = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
  el.textContent = navigator.onLine
    ? "Last updated: " + stamp + ". Online."
    : "Offline: showing last info, never a blank screen. Last updated: " + stamp + ".";
  if (!navigator.onLine) {
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
  document.querySelectorAll(".weekday-only").forEach(function (el) { el.style.display = shab ? "none" : ""; });
}
function tick() {
  var clock = document.getElementById("clock"); if (clock) clock.textContent = fmtClock();
  var dl = document.getElementById("dateLine");
  if (dl) dl.textContent = new Date().toLocaleDateString("en-US", { timeZone: "America/New_York", weekday: "long", year: "numeric", month: "long", day: "numeric" });
  var hd = document.getElementById("hebrewDateLine");
  if (hd) {
    try { hd.textContent = new Intl.DateTimeFormat("he-IL-u-ca-hebrew", { timeZone: "America/New_York", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date()); }
    catch (e) { hd.textContent = ""; }
  }
  applyWeekdayHiding();
  renderZmanim();
  updateOfflineNote();
}
var burnStep = 0;
function applyBurnShift() {
  var main = document.querySelector(".tv main");
  if (!main) return;
  main.classList.remove("burn-shift-1", "burn-shift-2", "burn-shift-3", "burn-shift-4");
  if (isShabbatDay()) return; /* No movement on Shabbat. Holiday detection is not yet wired: holidays require a holiday list, see report. */
  burnStep = (burnStep % 4) + 1;
  main.classList.add("burn-shift-" + burnStep);
}
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
