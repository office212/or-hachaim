// Headless Roy (Zemaneh Yosef) validation harness.
// Loads the site's own Temporal polyfill first (Node 24 has no global Temporal),
// then imports the UNMODIFIED cloned ROYZmanim.js directly.
// Does NOT use refraction/haze/horizon data (all null = site default when no
// forecast data is loaded), so Netz = sea-level sunrise, as documented in ROYZmanim.js.
import "../../or-hachaim-site/royzmanim-code/assets/libraries/temporal-polyfill/global.min.js";
import * as KosherZmanim from "../../or-hachaim-site/royzmanim-code/assets/libraries/kosherZmanim/kosher-zmanim.js";
import { ZemanFunctions, zDTFromFunc } from "../../or-hachaim-site/royzmanim-code/assets/js/ROYZmanim.js";

const LAT = 40.60155, LON = -74.13206, TZ = "America/New_York";

// Site display rounding (WebsiteCalendar.js roundsUp):
// rounds up to next minute if second > 40, or second > 20 when round == 'later'.
function siteRounded(zdt, round) {
  if (!zdt) return null;
  const up = zdt.second > 40 || (zdt.second > 20 && round === "later");
  const t = zdt.with({ second: 0, millisecond: 0, microsecond: 0, nanosecond: 0 });
  return up ? t.add({ minutes: 1 }) : t;
}
const pad = (n) => String(n).padStart(2, "0");
function rawStr(zdt) {
  if (!zdt) return "null";
  return `${pad(zdt.hour)}:${pad(zdt.minute)}:${pad(zdt.second)}`;
}
function minStr(zdt) {
  if (!zdt) return "null";
  return `${pad(zdt.hour)}:${pad(zdt.minute)}`;
}
function unwrap(v) { try { return zDTFromFunc(v); } catch { return v; } }

function day(config, isoDate) {
  const geo = new KosherZmanim.GeoLocation("Or Hachaim", LAT, LON, config.elev, TZ);
  const calc = new ZemanFunctions(geo, config);
  calc.setDate(Temporal.PlainDate.from(isoDate));
  const get = (name, round) => {
    const v = unwrap(calc[name]());
    return { raw: rawStr(v), site: minStr(siteRounded(v, round)), zdt: v };
  };
  const melakha = calc.getTzetMelakha();
  const melakhaTime = unwrap(melakha);
  return {
    alot: get("getAlotHashahar", "earlier"),
    talis: get("getMisheyakir", "later"),
    netz: get("getNetz", "later"),
    shemaMGA: get("getSofZemanShemaMGA", "earlier"),
    shemaGRA: get("getSofZemanShemaGRA", "earlier"),
    tefillah: get("getSofZemanBerakhothShema", "earlier"),
    chatzot: get("getHatzoth", "earlier"),
    minchaGedola: get("getMinhaGedolah", "later"),
    minchaKetana: get("getMinchaKetana", "later"),
    plagHB: get("getPlagHaminhaHalachaBrurah", "later"),
    plagYY: get("getPlagHaminhaYalkutYosef", "later"),
    candle: get("getCandleLighting", null),
    shkiah: get("getShkiya", "earlier"),
    tzeit: get("getTzet", "later"),
    tzeitHumra: get("getTzetHumra", "later"),
    shabbatEndsRoy: { raw: rawStr(melakhaTime), site: minStr(siteRounded(melakhaTime, null)), detail: melakha },
    rt: get("getTzetRT", "earlier"),
    rtKulah: config.rtKulah,
  };
}

const BASE = { elevation: false, fixedMil: false, rtKulah: true, melakha: { minutes: 30, degree: 7.165 }, candleLighting: 20, elev: 0 };
const ELEV = { ...BASE, elevation: true, elev: 23.67 };
const FIXEDMIL = { ...BASE, fixedMil: true };
const RTSTRICT = { ...BASE, rtKulah: false };

const dates = ["2026-11-02", "2026-11-03", "2026-11-13", "2026-11-14", "2026-12-20"];
for (const d of dates) {
  for (const [label, cfg] of [["BASE(no-elev,degrees,rtKulah,candle20)", BASE], ["ELEV23.67", ELEV]]) {
    const r = day(cfg, d);
    console.log(`\n== ${d} ${label} ==`);
    for (const k of ["alot","talis","netz","shemaMGA","shemaGRA","tefillah","chatzot","minchaGedola","minchaKetana","plagHB","plagYY","candle","shkiah","tzeit","tzeitHumra","shabbatEndsRoy","rt"]) {
      console.log(`  ${k}: raw=${r[k].raw} site=${r[k].site}`);
    }
    if (d === "2026-11-14" || d === "2026-12-20") {
      console.log(`  shabbatEndsRoy detail: ${JSON.stringify(r.shabbatEndsRoy.detail, (k,v)=> typeof v === "bigint" ? v.toString() : v)}`);
    }
  }
  // extra variants only for the two anchor days
  if (d === "2026-11-14" || d === "2026-12-20") {
    for (const [label, cfg] of [["FIXEDMIL", FIXEDMIL], ["RTSTRICT", RTSTRICT]]) {
      const r = day(cfg, d);
      console.log(`\n== ${d} ${label} ==`);
      for (const k of ["alot","talis","netz","shemaMGA","shemaGRA","tefillah","chatzot","minchaGedola","plagHB","plagYY","candle","shkiah","tzeit","tzeitHumra","shabbatEndsRoy","rt"]) {
        console.log(`  ${k}: raw=${r[k].raw} site=${r[k].site}`);
      }
    }
  }
}
