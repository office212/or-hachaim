/* Screen logic: clock with seconds, next-time highlight, hide-after rule,
   Netz window, rotating center, Shabbat preview toggle.
   Clock sync note: this demo uses the device clock. In the live phase the
   screen will note its sync source honestly (client clock sync); no
   atomic-clock claim is made from this demo code. */
var D = window.TEST_DATA;
function mins(t) {
  var p = t.split(":"); return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
}
function nowMins() { var d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
function fmtClock() {
  return new Date().toLocaleTimeString("en-US", { timeZone: "America/New_York", hour12: false });
}
function renderZmanim() {
  var now = nowMins(), next = null, html = "";
  D.sampleDay.zmanim.forEach(function (z) {
    var t = mins(z.time);
    if (now > t + 5) return; /* hide-after rule: gone 5 minutes after it passes, for that day */
    if (next === null && t >= now) next = z.key;
    html += '<div class="zman-row' + (next === z.key ? " next" : "") + '"><span><span class="he">' + z.he + "</span> / " + z.en + '</span><span>' + z.time + ' <span class="src">' + z.source + "</span></span></div>";
  });
  document.getElementById("zmanList").innerHTML = html || "<p>All sample zmanim for today have passed (hide-after rule).</p>";
  var netz = mins("6:43"), box = document.getElementById("netzBox");
  if (now >= netz - 5 && now < netz) {
    box.style.display = "block";
    var left = netz - now;
    box.textContent = "Netz in " + left + " minute" + (left === 1 ? "" : "s") + " (small window, in addition to Netz time; disappears after Netz)";
  } else { box.style.display = "none"; }
}
var zones = [
  { t: "Announcements / הודעות", b: D.announcements[0].textEn + " / " + D.announcements[0].textHe },
  { t: "Parsha and Haftarah / פרשה והפטרה", b: D.boards.parsha + " " + D.boards.specialShabbatot + " " + D.boards.roshChodesh },
  { t: "Shiur Schedule / לוח שיעורים", b: D.boards.shiurim },
  { t: "Hayom Yom and Daily Halacha / היום יום והלכה יומית", b: D.boards.hayomYom + " " + D.boards.dailyHalacha },
  { t: "Seasonal Insertions / תוספות עונתיות", b: D.seasonal.prayerInsertions + " " + D.seasonal.eruvTavshilin + " " + D.seasonal.yomTovNote },
  { t: "Fast Detail / פירוט צום", b: D.seasonal.fastDetail },
  { t: "Hanukkah / חנוכה", b: D.seasonal.hanukkah + " " + D.boards.hanukkiah + '<div class="hanukkiah"><span class="lit">🕯🕯🕯</span>🕯🕯🕯🕯🕯</div><div>' + D.seasonal.kiddushLevana + "</div>" },
  { t: "Holiday Customs / לוח מנהגי החג", b: D.boards.holidayCustoms + " " + D.boards.omer },
  { t: "Sponsors and Dedications / נותני חסות והקדשות", b: D.boards.sponsors + " " + D.boards.parnasHayom + " " + D.boards.seudahShlishitDonor },
  { t: "Community / קהילה", b: D.boards.mazalTov + " " + D.boards.hazkarot + " " + D.boards.rabbiMessage },
  { t: "Flyers and Campaign / פליירים ומגבית", b: D.flyers[0].title + " (" + D.flyers[0].from + " to " + D.flyers[0].to + "). " + D.campaign.title + ": " + D.campaign.text },
  { t: "Yahrzeit / יורצייט", b: D.yahrzeits[0].name + ", " + D.yahrzeits[0].hebrewDate + ". " + D.yahrzeits[0].note }
];
var zi = 0;
function renderZone() {
  var z = zones[zi % zones.length];
  document.getElementById("centerZone").innerHTML = "<h3>" + z.t + "</h3><p>" + z.b + "</p><p><small>Zone " + ((zi % zones.length) + 1) + " of " + zones.length + ", rotating, one zone at a time.</small></p>";
  try { localStorage.setItem("orHachaimLastZone", document.getElementById("centerZone").innerHTML); } catch (e) {}
  zi++;
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
    ? "Last updated (demo): " + stamp + ". Online."
    : "Offline: showing last info, never a blank screen. Last updated (demo): " + stamp + ".";
  if (!navigator.onLine) {
    try {
      var last = localStorage.getItem("orHachaimLastZone");
      if (last) document.getElementById("centerZone").innerHTML = last;
    } catch (e) {}
  }
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
   toggle in this demo; date logic in the Firebase phase). A
   holiday is detected from the sample-day holiday flag (false
   in this demo; date logic in the Firebase phase). When either
   is true, any shift is removed immediately and none is applied. */
var burnStep = 0;
function isNoMoveDay() {
  return document.body.classList.contains("shabbat") || !!D.sampleDay.isHoliday;
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
  this.textContent = document.body.classList.contains("shabbat") ? "Exit Shabbat preview" : "Shabbat preview (demo)";
  applyBurnShift(); /* entering Shabbat removes the shift at once */
});
tick(); renderZone(); applyBurnShift(); updateOfflineNote();
setInterval(tick, 1000);
setInterval(renderZone, 12000);
setInterval(applyBurnShift, 300000);
