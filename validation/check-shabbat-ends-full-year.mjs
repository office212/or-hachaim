// Shabbat-ends angle verification vs MyZmanim Nightfall 3 stars,
// all 55 Saturdays of 5787, test data only.
// MyZmanim values are parsed from the supplied PDF text at
// /tmp/myzmanim-full.txt (pdftotext -layout of the supplied PDF).
// The PDF itself is NOT copied into the packet; only aggregate
// statistics and a Saturday table of minute differences are used.
// Angle at MyZmanim nightfall is computed with the same NOAA
// formulae as src/zmanim/shabbat-ends.js, inverted: given a local
// time, compute solar declination and hour angle, then zenith.
import { computeShabbatEndsOrHachaim } from "../src/zmanim/shabbat-ends.js";
import { readFileSync } from "node:fs";

const DEG = Math.PI / 180;
const LAT = 40.60155, LON = -74.13206, TZ = "America/New_York";

// --- NOAA solar position (same formulae as shabbat-ends.js) ---
function julianDayFromUnixMs(ms) { return ms / 86400000 + 2440587.5; }
function solarDeclinationAndEqTime(jd) {
  const T = (jd - 2451545) / 36525;
  const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;
  const M = 357.52911 + T * (35999.05029 - T * 0.0001537);
  const e = 0.016708634 - T * (0.000042037 + T * 0.0000001267);
  const Mr = M * DEG;
  const C = Math.sin(Mr) * (1.914602 - T * (0.004817 + T * 0.000014))
    + Math.sin(2 * Mr) * (0.019993 - T * 0.000101) + Math.sin(3 * Mr) * 0.000289;
  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * T;
  const lambdaApp = trueLong - 0.00569 - 0.00478 * Math.sin(omega * DEG);
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813)))) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * DEG);
  const epsR = eps * DEG;
  const decl = Math.asin(Math.sin(epsR) * Math.sin(lambdaApp * DEG)) / DEG;
  const y = Math.tan(epsR / 2) ** 2;
  const L0R = L0 * DEG;
  const eqTime = 4 / DEG * (y * Math.sin(2 * L0R) - 2 * e * Math.sin(Mr)
    + 4 * e * y * Math.sin(Mr) * Math.cos(2 * L0R) - 0.5 * y * y * Math.sin(4 * L0R)
    - 1.25 * e * e * Math.sin(2 * Mr));
  return { declinationDeg: decl, equationOfTimeMin: eqTime };
}
function timezoneOffsetMinutes(instantMs, timeZone) {
  const dtf = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  const p = Object.fromEntries(dtf.formatToParts(new Date(instantMs)).map((x) => [x.type, x.value]));
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUTC - instantMs) / 60000);
}
// Sun centre depression (degrees below horizon, positive = below)
// at a local clock time on a date, in America/New_York.
function depressionAt(dateStr, localHour, localMinute) {
  const [y, m, d] = dateStr.split("-").map(Number);
  // local time -> UTC ms, using offset at local noon as first guess, then refine once
  let guess = Date.UTC(y, m - 1, d, localHour, localMinute, 0) - timezoneOffsetMinutes(Date.UTC(y, m - 1, d, 12, 0, 0), TZ) * 60000;
  guess = Date.UTC(y, m - 1, d, localHour, localMinute, 0) - timezoneOffsetMinutes(guess, TZ) * 60000;
  const { declinationDeg, equationOfTimeMin } = solarDeclinationAndEqTime(julianDayFromUnixMs(guess));
  const tzOff = timezoneOffsetMinutes(guess, TZ);
  const localMidnightUtcMs = Date.UTC(y, m - 1, d, 0, 0, 0) - tzOff * 60000;
  const solarNoonMs = localMidnightUtcMs + (720 - 4 * LON - equationOfTimeMin + tzOff) * 60000;
  const hourAngleDeg = (guess - solarNoonMs) / 60000 / 4;
  const cosZen = Math.sin(LAT * DEG) * Math.sin(declinationDeg * DEG)
    + Math.cos(LAT * DEG) * Math.cos(declinationDeg * DEG) * Math.cos(hourAngleDeg * DEG);
  const zenith = Math.acos(Math.min(1, Math.max(-1, cosZen))) / DEG;
  return zenith - 90;
}

// --- Parse MyZmanim Saturdays from pdftotext output ---
const txt = readFileSync("/tmp/myzmanim-full.txt", "utf-8");
const lines = txt.split("\n");
const rows = [];
for (const l of lines) {
  const m = l.match(/^\s*(\d{1,2})\s+(Sha|Sun|Mon|Tue|Wed|Thu|Fri)\s+(.*)$/);
  if (!m) continue;
  const times = m[3].match(/\d{1,2}:\d{2}/g);
  if (!times || ![16, 17].includes(times.length)) continue;
  rows.push({ wd: m[2], times });
}
const start = new Date(Date.UTC(2026, 8, 12));
const toMin = (s) => { const [h, mi] = s.split(":").map(Number); return h * 60 + mi; };
const fmtMin = (x) => `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
const out = [];
for (let i = 0; i < rows.length; i++) {
  const d = new Date(start); d.setUTCDate(d.getUTCDate() + i);
  const iso = d.toISOString().slice(0, 10);
  const { wd, times } = rows[i];
  if (wd !== "Sha") continue;
  // Nightfall 3 stars = times[2] (PM), Sunset = times[3] (PM)
  const nightMin = toMin(times[2]) + 720;
  const sunsetMin = toMin(times[3]) + 720;
  const ours = computeShabbatEndsOrHachaim(iso);
  const ourEndsMin = toMin(ours.shabbatEndsRaw.slice(0, 5)) + (ours.shabbatEndsRaw.slice(0, 2) === "00" ? 0 : 0);
  // Our ends raw in minutes from local midnight: use sunsetMs/endsMs via Intl? Simpler: gap raw + sunset raw minutes (PM)
  const sunsetRawMin = (() => { const [h, mi, s] = ours.sunsetRaw.split(":").map(Number); return h * 60 + mi + s / 60; })();
  const endsRawMin = sunsetRawMin + ours.minutesAfterSunset;
  const pubGap = Math.ceil(endsRawMin) - Math.floor(sunsetRawMin);
  // Depression at MyZmanim nightfall: local hour/minute of nightfall.
  // Nightfall published minute is a truncated/rounded minute; evaluate
  // at that minute and at +1 minute to bracket the angle.
  const dep0 = depressionAt(iso, Math.floor(nightMin / 60), nightMin % 60);
  const dep1 = depressionAt(iso, Math.floor((nightMin + 1) / 60), (nightMin + 1) % 60);
  out.push({
    date: iso, mySunset: fmtMin(sunsetMin), myNightfall: fmtMin(nightMin),
    ourSunsetRaw: ours.sunsetRaw, ourEndsRaw: ours.shabbatEndsRaw,
    rawGapMin: +ours.minutesAfterSunset.toFixed(1),
    publishedGapMin: pubGap,
    publishedDiffMin: pubGap - (nightMin - sunsetMin),
    ourEndsMinusMyNightfallMin: +(endsRawMin - nightMin).toFixed(1),
    depressionAtMyNightfallDeg: +dep0.toFixed(2),
    depressionAtMyNightfallPlus1MinDeg: +dep1.toFixed(2),
  });
}
console.log(JSON.stringify(out, null, 2));
const angles = out.map((r) => r.depressionAtMyNightfallDeg);
const diffs = out.map((r) => r.ourEndsMinusMyNightfallMin);
const pubDiffs = out.map((r) => r.publishedDiffMin);
console.error(`Saturdays=${out.length} angleAtMyNightfall min=${Math.min(...angles).toFixed(2)} max=${Math.max(...angles).toFixed(2)} mean=${(angles.reduce((a, b) => a + b, 0) / angles.length).toFixed(2)}`);
console.error(`ourEndsMinusMyNightfall min=${Math.min(...diffs).toFixed(1)} max=${Math.max(...diffs).toFixed(1)}`);
console.error(`publishedGapDiff counts=${JSON.stringify(pubDiffs.reduce((a, v) => { a[v] = (a[v] || 0) + 1; return a; }, {}))}`);
console.error(`publishedGap range=${Math.min(...out.map((r) => r.publishedGapMin))}-${Math.max(...out.map((r) => r.publishedGapMin))} myGap range=${Math.min(...out.map((r) => (toMin(r.myNightfall) - toMin(r.mySunset))))}-${Math.max(...out.map((r) => (toMin(r.myNightfall) - toMin(r.mySunset))))}`);
