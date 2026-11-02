// Shabbat ends (nightfall for melakha) for Or Hachaim, 321 Harold St,
// Staten Island, NY 10314. Our own calculation, independent of Roy and
// of any yearly PDF lookup: the moment the CENTRE of the sun is 8.5
// degrees below the horizon after sunset, on the given local date.
// NOT Roy's Tzet Melakha (7.165 degrees / 30 minutes), NOT a fixed
// number of minutes after sunset. The 41-52 minute gap observed over
// Jewish year 5787 is an OUTCOME of this angle, never an input.
//
// Solar algorithm: the NOAA Solar Calculator formulae (public-domain,
// as published by NOAA/GML), accurate to roughly one minute here:
//   Julian day / Julian century, geometric mean longitude and anomaly
//   of the sun, eccentricity, equation of centre, true and apparent
//   longitude, mean and corrected obliquity, equation of time, solar
//   declination, then hour angle for a given zenith:
//     cos(H) = (cos(zenith) - sin(lat) sin(dec)) / (cos(lat) cos(dec))
// Sunset uses the conventional zenith 90.833 degrees (upper limb on
// the horizon with standard refraction), so the sunset returned is
// comparable with published sunset times. Shabbat ends uses zenith
// 98.5 degrees exactly (90 + 8.5): the geometric centre of the sun
// 8.5 degrees below the horizon, with no extra refraction term on
// top, because the 8.5-degree dip IS the definition.
// Timezone handling uses only the standard Intl API (no dependencies):
// the UTC offset for America/New_York (or any IANA zone) is derived
// from Intl.DateTimeFormat, so DST is handled by the platform tz
// database, not by a fixed offset. The solar position is evaluated
// twice (at local noon, then refined at sunset) to remove the drift
// of evaluating declination / equation-of-time at noon.
//
// Usage (Node / browser module):
//   import { computeShabbatEnds } from "./shabbat-ends.js";
//   computeShabbatEnds({ date: "2026-11-14", latitude: 40.60155,
//     longitude: -74.13206, timeZone: "America/New_York" });
//   // -> { date, sunset: "16:39", shabbatEnds: "17:23", ... }
// Input date is a local calendar date "YYYY-MM-DD" in the given
// timezone. Output times are formatted in that timezone; raw
// millisecond values are also returned so callers can compute the
// exact sunset-to-ends difference.

const DEG = Math.PI / 180;

function julianDayFromUnixMs(ms) {
  return ms / 86400000 + 2440587.5;
}

function solarDeclinationAndEqTime(jd) {
  const T = (jd - 2451545) / 36525;
  const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;
  const M = 357.52911 + T * (35999.05029 - T * 0.0001537);
  const e = 0.016708634 - T * (0.000042037 + T * 0.0000001267);
  const Mr = M * DEG;
  const C = Math.sin(Mr) * (1.914602 - T * (0.004817 + T * 0.000014))
    + Math.sin(2 * Mr) * (0.019993 - T * 0.000101)
    + Math.sin(3 * Mr) * 0.000289;
  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * T;
  const lambdaApp = trueLong - 0.00569 - 0.00478 * Math.sin(omega * DEG);
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813)))) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * DEG);
  const epsR = eps * DEG;
  const decl = Math.asin(Math.sin(epsR) * Math.sin((lambdaApp * DEG))) / DEG;
  const y = Math.tan(epsR / 2) ** 2;
  const L0R = L0 * DEG;
  const eqTime = 4 / DEG * (y * Math.sin(2 * L0R)
    - 2 * e * Math.sin(Mr)
    + 4 * e * y * Math.sin(Mr) * Math.cos(2 * L0R)
    - 0.5 * y * y * Math.sin(4 * L0R)
    - 1.25 * e * e * Math.sin(2 * Mr));
  return { declinationDeg: decl, equationOfTimeMin: eqTime };
}

// UTC offset in whole minutes for a timezone at a given instant, via Intl only.
export function timezoneOffsetMinutes(instantMs, timeZone) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  const p = Object.fromEntries(dtf.formatToParts(new Date(instantMs)).map((x) => [x.type, x.value]));
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUTC - instantMs) / 60000);
}

function formatInZone(ms, timeZone) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).format(new Date(ms));
}

/**
 * @param {object} opts
 * @param {string} opts.date local date "YYYY-MM-DD" in opts.timeZone
 * @param {number} opts.latitude degrees, north positive
 * @param {number} opts.longitude degrees, east positive (west negative)
 * @param {string} [opts.timeZone] default "America/New_York"
 * @param {number} [opts.degreesBelowHorizon] default 8.5
 * @returns {{ date: string, timeZone: string, sunsetMs: number, sunset: string,
 *   sunsetRaw: string, shabbatEndsMs: number, shabbatEnds: string,
 *   shabbatEndsRaw: string, minutesAfterSunset: number }}
 */
export function computeShabbatEnds({ date, latitude, longitude, timeZone = "America/New_York", degreesBelowHorizon = 8.5 }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`date must be YYYY-MM-DD, got ${date}`);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new Error(`bad latitude ${latitude}`);
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error(`bad longitude ${longitude}`);
  const [y, m, d] = date.split("-").map(Number);

  // Start at local noon that day (offset refined each pass).
  let anchorMs = Date.UTC(y, m - 1, d, 12, 0, 0) - timezoneOffsetMinutes(Date.UTC(y, m - 1, d, 12, 0, 0), timeZone) * 60000;
  let sunsetMs = null;
  let endsMs = null;
  for (let pass = 0; pass < 2; pass++) {
    const { declinationDeg, equationOfTimeMin } = solarDeclinationAndEqTime(julianDayFromUnixMs(anchorMs));
    const tzOffMin = timezoneOffsetMinutes(anchorMs, timeZone);
    // NOAA's solar-noon formula gives LOCAL clock minutes from local
    // midnight: 720 - 4*lon - eqTime + tzOffset (tzOffset negative west
    // of UTC, e.g. -300 for EST). Local midnight in UTC ms is therefore
    // Date.UTC(midnight) - tzOffset minutes, NOT the UTC midnight of
    // the anchor day (that was the bug in the first draft, which put
    // sunset 5 hours early, at 11:39 instead of 16:39).
    const localMidnightUtcMs = Date.UTC(y, m - 1, d, 0, 0, 0) - tzOffMin * 60000;
    const solarNoonMs = localMidnightUtcMs + (720 - 4 * longitude - equationOfTimeMin + tzOffMin) * 60000;
    const hourAngleMin = (zenithDeg) => {
      const cosH = (Math.cos(zenithDeg * DEG) - Math.sin(latitude * DEG) * Math.sin(declinationDeg * DEG))
        / (Math.cos(latitude * DEG) * Math.cos(declinationDeg * DEG));
      if (cosH > 1 || cosH < -1) return null;
      return Math.acos(cosH) / DEG * 4; // degrees of hour angle -> minutes of time
    };
    const sunsetHA = hourAngleMin(90.833);
    const endsHA = hourAngleMin(90 + degreesBelowHorizon);
    if (sunsetHA === null || endsHA === null) {
      throw new Error(`sun does not reach ${degreesBelowHorizon} degrees below horizon on ${date} at latitude ${latitude}`);
    }
    sunsetMs = solarNoonMs + sunsetHA * 60000;
    endsMs = solarNoonMs + endsHA * 60000;
    anchorMs = sunsetMs; // refine solar position at sunset on the next pass
  }
  return {
    date,
    timeZone,
    sunsetMs,
    sunset: formatInZone(sunsetMs, timeZone).slice(0, 5),
    sunsetRaw: formatInZone(sunsetMs, timeZone),
    shabbatEndsMs: endsMs,
    shabbatEnds: formatInZone(endsMs, timeZone).slice(0, 5),
    shabbatEndsRaw: formatInZone(endsMs, timeZone),
    minutesAfterSunset: (endsMs - sunsetMs) / 60000,
  };
}

// Or Hachaim defaults (321 Harold St, Staten Island, NY 10314).
export function computeShabbatEndsOrHachaim(date) {
  return computeShabbatEnds({ date, latitude: 40.60155, longitude: -74.13206, timeZone: "America/New_York", degreesBelowHorizon: 8.5 });
}

// Browser-script fallback: also expose on globalThis when loaded outside a module graph.
if (typeof globalThis !== "undefined") {
  globalThis.OrHachaimShabbatEnds = { computeShabbatEnds, computeShabbatEndsOrHachaim, timezoneOffsetMinutes };
}
