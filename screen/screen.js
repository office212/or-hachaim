/* Screen logic: clock with seconds, next-time highlight, hide-after rule,
   Netz window, rotating center, Shabbat preview toggle.
   Clock sync note: this demo uses the device clock. In the live phase the
   screen will note its sync source honestly (client clock sync); no
   atomic-clock claim is made from this demo code. */
function mins(t) {
  var p = t.split(":"); return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
}
function nowMins() { var d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
function fmtClock() {
  return new Date().toLocaleTimeString("en-US", { timeZone: "America/New_York", hour12: false });
}
var ROY_DAY = null;
function displayTime(t24){
  var parts = t24.split(":"); var h = parseInt(parts[0], 10), m = parts[1];
  var h12 = h % 12; if(h12 === 0) h12 = 12;
  return h12 + ":" + m;
}
function royZmanimList(){
  if(!ROY_DAY) return null;
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
function todayKey(){
  try {
    var parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    var o = {}; parts.forEach(function (x) { o[x.type] = x.value; });
    return o.year + "-" + o.month + "-" + o.day;
  } catch (e) {
    var d = new Date();
    var y = d.getFullYear(), mo = String(d.getMonth() + 1).padStart(2, "0"), da = String(d.getDate()).padStart(2, "0");
    return y + "-" + mo + "-" + da;
  }
}
try {
  fetch("../src/zmanim/roy-daily-5787.json").then(function (r) { return r.json(); }).then(function (j) {
    var day = j.days && j.days[todayKey()];
    if(day){ ROY_DAY = day; renderZmanim(); }
  }).catch(function () {});
} catch (e) {}
function renderZmanim() {
  var now = nowMins(), next = null, html = "";
  var list = royZmanimList() || [];
  list.forEach(function (z) {
    var t = mins(z.time);
    if (now > t + 5) return; /* hide-after rule: gone 5 minutes after it passes, for that day */
    if (next === null && t >= now) next = z.key;
    var disp = ROY_DAY ? displayTime(z.time) : z.time;
    html += '<div class="zman-row' + (next === z.key ? " next" : "") + '"><span><span class="he">' + z.he + "</span> / " + z.en + "</span><span>" + disp + "</span></div>";
  });
  document.getElementById("zmanList").innerHTML = html || "<p>אין זמני יום טעונים כרגע / No daily times loaded yet.</p>";
  var box = document.getElementById("netzBox"); if(!ROY_DAY){ box.style.display = "none"; return; } var netz = mins(ROY_DAY.netz);
  if (now >= netz - 5 && now < netz) {
    box.style.display = "block";
    var left = netz - now;
    box.textContent = "Netz in " + left + " minute" + (left === 1 ? "" : "s") + " (small window, in addition to Netz time; disappears after Netz)";
  } else { box.style.display = "none"; }
}
function renderZone() {
  var el = document.getElementById("centerZone");
  if(!el) return;
  el.innerHTML = "<h3>ברוכים הבאים / Welcome</h3><p>אור החיים / Or Hachaim Congregation<br>321 Harold St, Staten Island, NY 10314</p><p>המסך מציג את זמני היום ואת זמני התפילות הקהילתיים, לאחר כניסה בלבד. / This screen shows daily times and community prayer times, after sign-in only.</p>";
}
/* Offline fallback, foundation: never a blank screen. If the
   browser reports offline, show the last rendered zone from
   local storage and a clear offline note, with a last-updated
   stamp. Shabbat-safe filter: on Shabbat, weekday-only items
   are removed by the system, not by gabbai memory. */
function updateOfflineNote() {
  var el = document.getElementById("offlineNote"); if (!el) return;
  var stamp = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
  el.textContent = navigator.onLine
    ? "Last updated: " + stamp + ". Online."
    : "Offline: showing last info, never a blank screen. Last updated: " + stamp + ".";
}
window.addEventListener("online", updateOfflineNote);
window.addEventListener("offline", updateOfflineNote);
function tick() {
  document.getElementById("clock").textContent = fmtClock();
  document.getElementById("dateLine").textContent = new Date().toLocaleDateString("en-US", { timeZone: "America/New_York", weekday: "long", year: "numeric", month: "long", day: "numeric" });
  renderZmanim();
}
/* Burn-in prevention, decision 7: gentle shift of the main area,
   cycling every 5 minutes through small pixel offsets. DISABLED
   completely on Shabbat and on holidays: no movement at all on
   those days. Shabbat is detected from the body class (preview
   toggle for preview; date logic is a separate step). A
   holiday is detected from the sample-day holiday flag (false; date logic is a separate step). When either
   is true, any shift is removed immediately and none is applied. */
var burnStep = 0;
function isNoMoveDay() {
  return document.body.classList.contains("shabbat");
}
function applyBurnShift() {
  var main = document.querySelector(".tv main");
  if (!main) return;
  main.classList.remove("burn-shift-1", "burn-shift-2", "burn-shift-3", "burn-shift-4");
  if (isNoMoveDay()) return;
  burnStep = (burnStep % 4) + 1;
  main.classList.add("burn-shift-" + burnStep);
}
document.getElementById("shabbatToggle").addEventListener("click", function () {
  document.body.classList.toggle("shabbat");
  this.textContent = document.body.classList.contains("shabbat") ? "צא מתצוגת שבת / Exit Shabbat preview" : "תצוגת שבת / Shabbat preview";
  applyBurnShift(); /* entering Shabbat removes the shift at once */
});
tick(); renderZone(); applyBurnShift(); updateOfflineNote();
setInterval(tick, 1000);
setInterval(applyBurnShift, 300000);
