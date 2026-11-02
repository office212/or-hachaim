// Test script for src/zmanim/shabbat-ends.js (test data only).
// Prints: (a) Toldot Sat Nov 14, 2026; (b) every Saturday in Jewish year
// 5787, with sunset, Shabbat ends (sun centre 8.5 deg below horizon),
// and the gap in minutes; (c) min/max/out-of-range summary vs 41-52.
// Jewish-year boundaries are found with the platform Hebrew calendar
// (Intl, 'hebrew'): first Saturday on/after 1 Tishrei 5787 through the
// last Saturday before 1 Tishrei 5788.
import { computeShabbatEndsOrHachaim } from "../src/zmanim/shabbat-ends.js";

const heFmt = new Intl.DateTimeFormat("en-US-u-ca-hebrew", { timeZone: "America/New_York", year: "numeric", month: "numeric", day: "numeric" });
function hebrewParts(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  const p = Object.fromEntries(heFmt.formatToParts(dt).map((x) => [x.type, x.value]));
  // Node/ICU returns the Hebrew month NAME (e.g. "Tishri"), not a number,
  // even with month: "numeric"; compare by name instead.
  return { year: +p.year, month: p.month, day: +p.day };
}
function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n, 12));
  return dt.toISOString().slice(0, 10);
}
function weekdayNY(dateStr) {
  // Saturday check in America/New_York via Intl weekday on local noon.
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" }).format(dt);
}

// (a) Toldot
const toldot = computeShabbatEndsOrHachaim("2026-11-14");
console.log(`Toldot Sat 2026-11-14: sunset ${toldot.sunset} (raw ${toldot.sunsetRaw}), Shabbat ends ${toldot.shabbatEnds} (raw ${toldot.shabbatEndsRaw}), gap ${toldot.minutesAfterSunset.toFixed(1)} min`);
console.log(`  Expected (MyZmanim anchor): sunset 16:39, Shabbat ends 17:23, gap 44 min`);

// (b) Find 1 Tishrei 5787 and 5788 by scanning Sep 2026 / Sep 2027.
function findTishrei(year, from) {
  for (let i = 0; i < 40; i++) {
    const ds = addDays(from, i);
    const h = hebrewParts(ds);
    if (h.year === year && h.month === "Tishri" && h.day === 1) return ds;
  }
  throw new Error(`1 Tishrei ${year} not found from ${from}`);
}
const start5787 = findTishrei(5787, "2026-09-01");
const start5788 = findTishrei(5788, "2027-09-01");
console.log(`1 Tishrei 5787 = ${start5787}, 1 Tishrei 5788 = ${start5788}`);

const rows = [];
for (let ds = start5787; ds < start5788; ds = addDays(ds, 1)) {
  if (weekdayNY(ds) !== "Sat") continue;
  const r = computeShabbatEndsOrHachaim(ds);
  rows.push(r);
}
console.log(`Saturdays in 5787: ${rows.length}`);
let min = Infinity, max = -Infinity, minRow = null, maxRow = null;
const out = [];
for (const r of rows) {
  const gap = r.minutesAfterSunset;
  if (gap < min) { min = gap; minRow = r; }
  if (gap > max) { max = gap; maxRow = r; }
  const roundedGap = Math.round(gap);
  const flag = (roundedGap < 41 || roundedGap > 52) ? " OUT-OF-41-52(rounded)" : "";
  if (flag) out.push(r);
  console.log(`  ${r.date} sunset ${r.sunset} ends ${r.shabbatEnds} gap ${gap.toFixed(1)} min (rounded ${roundedGap})${flag}`);
}
console.log(`Min gap: ${min.toFixed(1)} min on ${minRow.date} (sunset ${minRow.sunset}, ends ${minRow.shabbatEnds})`);
console.log(`Max gap: ${max.toFixed(1)} min on ${maxRow.date} (sunset ${maxRow.sunset}, ends ${maxRow.shabbatEnds})`);
console.log(`Saturdays outside 41-52 by rounded gap: ${out.length}`);
for (const r of out) console.log(`  OUT ${r.date} sunset ${r.sunset} ends ${r.shabbatEnds} gap ${r.minutesAfterSunset.toFixed(1)}`);
// Distribution by rounded gap
const dist = {};
for (const r of rows) { const g = Math.round(r.minutesAfterSunset); dist[g] = (dist[g] || 0) + 1; }
console.log(`Distribution (rounded gap min -> Saturdays): ${JSON.stringify(dist)}`);
