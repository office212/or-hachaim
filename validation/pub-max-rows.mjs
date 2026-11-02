// Helper: which Saturdays give the published 52-minute gap (ceil ends - trunc sunset)?
import { computeShabbatEndsOrHachaim } from "../src/zmanim/shabbat-ends.js";
function addDays(ds, n) { const [y, m, d] = ds.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n, 12)).toISOString().slice(0, 10); }
for (let ds = "2026-09-12"; ds < "2027-10-02"; ds = addDays(ds, 1)) {
  const [y, m, d] = ds.split("-").map(Number);
  if (new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay() !== 6) continue;
  const r = computeShabbatEndsOrHachaim(ds);
  const gap = Math.ceil(r.shabbatEndsMs / 60000) - Math.floor(r.sunsetMs / 60000);
  if (gap >= 52 || ds === "2027-06-12") console.log(`${ds} sunsetRaw ${r.sunsetRaw} endsRaw ${r.shabbatEndsRaw} ceil-trunc gap ${gap} raw gap ${r.minutesAfterSunset.toFixed(1)}`);
}
