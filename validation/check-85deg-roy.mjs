// Cross-check ONLY: Roy's precise solar position for the sun at 8.5 deg
// below the horizon (getSunsetOffsetByDegrees(98.5)), for comparison with
// our NOAA module. This is NOT Roy's Shabbat ends (Roy uses 7.165 deg /
// 30 min for Tzet Melakha); it is only a solar-position reference to
// measure our module's error.
import "../../or-hachaim-site/royzmanim-code/assets/libraries/temporal-polyfill/global.min.js";
import * as KosherZmanim from "../../or-hachaim-site/royzmanim-code/assets/libraries/kosherZmanim/kosher-zmanim.js";
import { computeShabbatEndsOrHachaim } from "../src/zmanim/shabbat-ends.js";

const pad = (n) => String(n).padStart(2, "0");
for (const d of ["2026-11-14", "2027-06-12", "2027-03-13", "2026-09-26"]) {
  const geo = new KosherZmanim.GeoLocation("Or Hachaim", 40.60155, -74.13206, 0, "America/New_York");
  const cal = new KosherZmanim.AstronomicalCalendar(geo);
  cal.setDate(Temporal.PlainDate.from(d));
  const seaSunset = cal.getSeaLevelSunset();
  const deg85 = cal.getSunsetOffsetByDegrees(98.5);
  const ours = computeShabbatEndsOrHachaim(d);
  const fmt = (z) => `${pad(z.hour)}:${pad(z.minute)}:${pad(z.second)}`;
  console.log(`${d} Roy sea-level sunset ${fmt(seaSunset)} | Roy 8.5deg ${fmt(deg85)} | ours sunset ${ours.sunsetRaw} ends ${ours.shabbatEndsRaw} gap ${ours.minutesAfterSunset.toFixed(1)}`);
  console.log(`   Roy 8.5deg minus Roy sunset = ${(deg85.epochMilliseconds - seaSunset.epochMilliseconds) / 60000} min; ours ends minus Roy 8.5deg = ${(ours.shabbatEndsMs - deg85.epochMilliseconds) / 60000} min`);
}
