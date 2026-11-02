// Published-minute gap conventions applied to OUR module's raw values,
// over the 55 Saturdays of 5787 (2026-09-12 to 2027-10-02 exclusive).
// Shows why a published-minute range (41-52) differs from the raw range.
import { computeShabbatEndsOrHachaim } from "../src/zmanim/shabbat-ends.js";
function addDays(ds, n) { const [y, m, d] = ds.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n, 12)).toISOString().slice(0, 10); }
const trunc = (ms) => Math.floor(ms / 60000);
const ceil = (ms) => Math.ceil(ms / 60000);
const nearest = (ms) => Math.round(ms / 60000);
const stats = { ct: [1e9, -1e9], cn: [1e9, -1e9], tt: [1e9, -1e9] };
let n = 0;
for (let ds = "2026-09-12"; ds < "2027-10-02"; ds = addDays(ds, 1)) {
  const [y, m, d] = ds.split("-").map(Number);
  if (new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay() !== 6) continue;
  n++;
  const r = computeShabbatEndsOrHachaim(ds);
  const vals = { ct: ceil(r.shabbatEndsMs) - trunc(r.sunsetMs), cn: ceil(r.shabbatEndsMs) - nearest(r.sunsetMs), tt: trunc(r.shabbatEndsMs) - trunc(r.sunsetMs) };
  for (const k of Object.keys(vals)) { stats[k][0] = Math.min(stats[k][0], vals[k]); stats[k][1] = Math.max(stats[k][1], vals[k]); }
}
console.log(`Saturdays: ${n}`);
console.log(`ceil(ends)-trunc(sunset): ${stats.ct[0]} to ${stats.ct[1]}`);
console.log(`ceil(ends)-nearest(sunset): ${stats.cn[0]} to ${stats.cn[1]}`);
console.log(`trunc(ends)-trunc(sunset): ${stats.tt[0]} to ${stats.tt[1]}`);
