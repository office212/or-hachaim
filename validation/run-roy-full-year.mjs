// Full-year Roy validation, Jewish year 5787, test data only.
// Runs the UNMODIFIED Roy code headlessly for every day
// 2026-09-12 to 2027-10-01 (1 Tishrei 5787 to the day before
// 1 Tishrei 5788), BASE config only (no elevation, degree-based,
// rtKulah, candle 20 recorded for comparison; production candle is
// 18, applied separately). Output: JSON lines, one per day, plus a
// summary on stderr. No forecast/haze/horizon data, as before.
import "../../or-hachaim-site/royzmanim-code/assets/libraries/temporal-polyfill/global.min.js";
import * as KosherZmanim from "../../or-hachaim-site/royzmanim-code/assets/libraries/kosherZmanim/kosher-zmanim.js";
import { ZemanFunctions, zDTFromFunc } from "../../or-hachaim-site/royzmanim-code/assets/js/ROYZmanim.js";

const LAT = 40.60155, LON = -74.13206, TZ = "America/New_York";
const pad = (n) => String(n).padStart(2, "0");
function rawStr(zdt) { if (!zdt) return null; return `${pad(zdt.hour)}:${pad(zdt.minute)}:${pad(zdt.second)}`; }
function siteRounded(zdt, round) {
  if (!zdt) return null;
  const up = zdt.second > 40 || (zdt.second > 20 && round === "later");
  const t = zdt.with({ second: 0, millisecond: 0, microsecond: 0, nanosecond: 0 });
  return up ? t.add({ minutes: 1 }) : t;
}
function minStr(zdt) { if (!zdt) return null; return `${pad(zdt.hour)}:${pad(zdt.minute)}`; }
function unwrap(v) { try { return zDTFromFunc(v); } catch { return v; } }
function toMin(site) { if (!site) return null; const [h, m] = site.split(":").map(Number); return h * 60 + m; }

const BASE = { elevation: false, fixedMil: false, rtKulah: true, melakha: { minutes: 30, degree: 7.165 }, candleLighting: 20, elev: 0 };

function day(isoDate) {
  const geo = new KosherZmanim.GeoLocation("Or Hachaim", LAT, LON, 0, TZ);
  const calc = new ZemanFunctions(geo, BASE);
  calc.setDate(Temporal.PlainDate.from(isoDate));
  const get = (name, round) => {
    const v = unwrap(calc[name]());
    return { raw: rawStr(v), site: minStr(siteRounded(v, round)) };
  };
  const mel = unwrap(calc.getTzetMelakha());
  return {
    date: isoDate,
    alot: get("getAlotHashahar", "earlier"),
    talis: get("getMisheyakir", "later"),
    netz: get("getNetz", "later"),
    shemaMGA_seasonal: get("getSofZemanShemaMGA", "earlier"),
    shemaGRA: get("getSofZemanShemaGRA", "earlier"),
    tefillah: get("getSofZemanBerakhothShema", "earlier"),
    chatzot: get("getHatzoth", "earlier"),
    minchaGedola: get("getMinhaGedolah", "later"),
    minchaKetana: get("getMinchaKetana", "later"),
    plagHB: get("getPlagHaminhaHalachaBrurah", "later"),
    plagYY: get("getPlagHaminhaYalkutYosef", "later"),
    candle20: get("getCandleLighting", null),
    shkiah: get("getShkiya", "earlier"),
    tzeit: get("getTzet", "later"),
    tzeitHumra: get("getTzetHumra", "later"),
    shabbatEndsRoy: { raw: rawStr(mel), site: minStr(siteRounded(mel, null)) },
    rt: get("getTzetRT", "earlier"),
  };
}

const start = new Date(Date.UTC(2026, 8, 12));
const end = new Date(Date.UTC(2027, 9, 1));
let n = 0, fails = [];
for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
  const iso = d.toISOString().slice(0, 10);
  try {
    const r = day(iso);
    // Production values derived from Roy sunrise/sunset, decisions 2026-11-01:
    // candle = shkiah site - 18; equal-minutes Shema Magen =
    // alot72 + 3*((shkiah+72 - alot72)/12), alot72 = netz site - 72.
    const netzMin = toMin(r.netz.site);
    const shkMin = toMin(r.shkiah.site);
    let candle18 = null, shemaEq = null;
    if (netzMin !== null && shkMin !== null) {
      const alot72 = netzMin - 72;
      const tzet72 = shkMin + 72;
      shemaEq = Math.round(alot72 + 3 * (tzet72 - alot72) / 12);
      candle18 = shkMin - 18;
    }
    const fmt = (m) => m === null ? null : `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    console.log(JSON.stringify({ ...r, candle18: fmt(candle18), shemaMGA_equalMin: fmt(shemaEq) }));
    n++;
  } catch (e) {
    fails.push(`${iso}: ${e.message}`);
  }
}
console.error(`DONE days=${n} fails=${fails.length}`);
for (const f of fails) console.error(`FAIL ${f}`);
