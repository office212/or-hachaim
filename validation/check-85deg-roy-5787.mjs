// Roy SPA 8.5-degree raw gaps over all 55 Saturdays of 5787, for
// cross-checking our NOAA module's raw range. Saturdays enumerated by
// Gregorian weekday between 2026-09-12 (1 Tishrei 5787) and 2027-10-02
// (1 Tishrei 5788), exclusive of the latter.
import "../../or-hachaim-site/royzmanim-code/assets/libraries/temporal-polyfill/global.min.js";
import * as KosherZmanim from "../../or-hachaim-site/royzmanim-code/assets/libraries/kosherZmanim/kosher-zmanim.js";

function addDays(ds, n) { const [y, m, d] = ds.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n, 12)).toISOString().slice(0, 10); }
const geo = new KosherZmanim.GeoLocation("Or Hachaim", 40.60155, -74.13206, 0, "America/New_York");
const cal = new KosherZmanim.AstronomicalCalendar(geo);
let min = 1e9, max = -1e9, minD = "", maxD = "", count = 0;
for (let ds = "2026-09-12"; ds < "2027-10-02"; ds = addDays(ds, 1)) {
  const [y, m, d] = ds.split("-").map(Number);
  if (new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay() !== 6) continue;
  cal.setDate(Temporal.PlainDate.from(ds));
  const gap = (cal.getSunsetOffsetByDegrees(98.5).epochMilliseconds - cal.getSeaLevelSunset().epochMilliseconds) / 60000;
  count++;
  if (gap < min) { min = gap; minD = ds; }
  if (gap > max) { max = gap; maxD = ds; }
}
console.log(`Roy SPA 8.5deg raw gaps, ${count} Saturdays in 5787: min ${min.toFixed(2)} on ${minD}, max ${max.toFixed(2)} on ${maxD}`);
