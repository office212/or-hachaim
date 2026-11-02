# Validation report: Roy zmanim code + our own Shabbat-ends calculation

**Scope: test data only. Nothing here is live, nothing was pushed, no
Firebase project exists, no real congregant/gabbai lists were used.**
The Roy clone at `~/workspace/or-hachaim-site/royzmanim-code` was **not
modified**; all harness scripts live in `validation/` and the new module
in `src/zmanim/` (replacing the placeholder that was already there).

**Target repo (recorded 2026-11-01, no push made):**
`office212/or-hachaim` — https://github.com/office212/or-hachaim —
owner `office212`, Public, README only, no code pushed yet, no Firebase
project created yet. Hanoch pre-approved (2026-11-01 22:54) pushing the
**validated code only** (test data only) to this repo when it is ready,
without asking again for the push itself. That pre-approval does **not**
cover go-live, real lists, or a paid Firebase project. Pushing still
goes through the browser's signed-in GitHub session, **not** the GitHub
connector (which returned 401 before). No push was made in this task.

**Place:** Or Hachaim Congregation, 321 Harold St, Staten Island, NY
10314. Latitude 40.60155, longitude -74.13206, timezone
America/New_York. All times below are local (EST, UTC-5, in Nov/Dec).

## 0. Decisions 2026-11-01 23:06, binding, superseding open questions 3 and 4

Recorded here and in code comments in
`src/zmanim/decisions-2026-11-01.js`, with Toldot anchors.

1. Candle lighting = 18 minutes before sunset, everywhere, NOT
   Roy default 20. Toldot anchor: Friday Nov 13, 2026, sunset
   4:40 PM, minus 18 minutes = candles 4:22 PM, an exact match.
   The earlier 18-minute note in section 2 was a hypothesis; it
   is now a decision. The Roy harness in `run-roy.mjs` still
   records Roy default 20 for comparison, because that is what
   Roy's code does; the production value is 18.
2. Sof Zman Shema, Magen Avraham = equal minutes (shavot), NOT
   Roy seasonal. Toldot anchor: Saturday Nov 14, 2026, 8:35 AM.
   Roy seasonal gave 8:38 AM and is rejected for this value.
   Alot Hashachar is also equal minutes, as before. The
   production times engine must implement the equal-minutes
   method for Shema Magen Avraham and be validated against the
   8:35 anchor. No new equal-minutes formula is invented in
   this report; the decision records the method and the anchor.
3. Shabbat ends is unchanged: our own 8.5-degree angle
   calculation, NOT Roy, NOT fixed minutes.

## 1. How Roy was run headlessly (first headless run of this code)

- Node v24.22.1 has no global `Temporal`, so the harness loads the
  site's own polyfill first
  (`assets/libraries/temporal-polyfill/global.min.js`, temporal-polyfill
  1.0.5), then imports the **unmodified** `assets/js/ROYZmanim.js`
  (`ZemanFunctions`) directly. `zmanimCore.js` / `zmanimSettings.js`
  were read to derive the configuration; the harness replicates
  `buildZemanimConfig` for a place outside Israel instead of importing
  the DOM-dependent calendar wrapper.
- **Primary configuration (BASE, = Roy site defaults for a place
  outside Israel, no forecast data):**
  `elevation: false` (site default outside Israel: `useElevation`
  defaults to true only in Israel), `fixedMil: false` (degree-based
  Amudeh Hora'ah, not the fixed Ohr HaChaim mil used in Israel or when
  `forceSunSeasonal` is set), `rtKulah: true` (default, earlier
  Rabbeinu Tam variant), `melakha: { minutes: 30, degree: 7.165 }`
  (Roy's default Tzet Melakha), `candleLighting: 20` minutes (default).
  Refraction atmosphere provider, terrain horizon and haze data are
  all **null**, exactly as the code behaves with no forecast data
  loaded: Netz is therefore sea-level sunrise, and Tzet Melakha gets
  no haze delay. This is a stated limitation, not a hidden one (see
  §5: a live Roy page with forecast/terrain data could shift Netz by
  ~1-2 minutes).
- **Elevation:** the synagogue's true elevation is unknown. The primary
  run uses elevation flag off, so the GeoLocation elevation value is
  irrelevant there. The alternate run ELEV sets flag on with elevation
  **23.67 metres** (GeoLocation elevation is in metres per
  `kosher-zmanim.d.ts`), the value from the prior Roy ZIP example,
  taken as-is. It moves sunrise/sunset by about 1 minute and most
  other times by about 1 minute; it does **not** change Netz
  (sea-level sunrise is used when no horizon is set) and does **not**
  change Roy's Shabbat ends (degree-based, 7.165°).
- **Site display rounding** (from `WebsiteCalendar.js`, applied in the
  tables as "site"): a time shown to the minute rounds up to the next
  minute if seconds > 40, or seconds > 20 when the entry's round is
  `later`; otherwise seconds are dropped. Raw HH:MM:SS is shown
  alongside so no rounding artefact is hidden. Roy's fast-day banner
  is different: it formats raw times directly (no `roundsUp`), i.e.
  it truncates seconds (see §3).
- **No "equal-minutes" toggle exists in Roy's code.** Shema Magen
  Avraham is seasonal: dawn-to-Tzet divided into 12, times 3. The
  only alternative method in the code is `fixedMil` (72 fixed minutes
  in Israel / `forceSunSeasonal`), which was tested as an alternate
  and is worse on every anchor (see §2). The word "שוות" in the task
  is addressed by the arithmetic observation in §2, not by a setting.

## 2. Toldot Shabbat, Nov 13-14, 2026 (BASE = primary Roy run)

Anchors are the verified values supplied with the task (their source
is not Roy's site; see the inconsistency note at the end of this
section). Diff = Roy site minute minus anchor, in minutes.

| Zman (Nov 14 unless noted) | Anchor | Roy BASE raw | Roy BASE site | Diff | Verdict |
|---|---|---|---|---|---|
| Alot Hashachar | — | 05:35:10 | 05:35 | — | reported |
| Talis / Tefillin (Misheyakir) | — | 05:46:18 | 05:46 | — | reported |
| Netz (sunrise, sea level) | 06:43 | 06:41:57 | 06:42 | -1 | MISMATCH, 1 min |
| Shema Magen Avraham | 08:35 | 08:38:00 | 08:38 | +3 | MISMATCH, 3 min |
| Shema Gra | 09:11 | 09:11:22 | 09:11 | 0 | MATCH |
| Sof Zman Tefillah (Gra) | — | 10:01:10 | 10:01 | — | reported |
| Chatzot | 11:40 | 11:40:59 | 11:41 | +1 | MISMATCH, rounding artefact (raw truncates to 11:40) |
| Mincha Gedola | — | 12:10:59 | 12:11 | — | reported |
| Mincha Ketana | — | 14:35:05 | 14:35 | — | reported |
| Plag Hamincha, Halacha Brurah | 15:37 | 15:37:20 | 15:37 | 0 | MATCH (anchor = HB, not YY) |
| Plag Hamincha, Yalkut Yosef | — | 15:49:50 | 15:50 | — | reported |
| Candle lighting, Fri Nov 13 | 16:22 | 16:20:27 | 16:20 | -2 | MISMATCH, 2 min (see candle note) |
| Shkiah (sunset) | 16:39 | 16:39:36 | 16:39 | 0 | MATCH |
| Tzeit Hakochavim (regular) | — | 16:52:05 | 16:52 | — | reported |
| Tzeit, Humra | — | 16:58:06 | 16:58 | — | reported |
| Shabbat ends, **Roy only, comparison only** (7.165°) | — | 17:15:15 | 17:15 | — | NOT our official Shabbat ends |
| Rabbeinu Tam (rtKulah) | — | 17:46:33 | 17:46 | — | reported; strict variant identical here (Tzet < sunset+72) |

**Alternate settings tried once each (Nov 14), none forced to match:**

- ELEV (elevation on, 23.67 m): Netz 06:42 (unchanged), Shema Magen
  08:37 (still +2 vs anchor), Shema Gra 09:11 (match), Chatzot 11:41,
  Plag HB 15:38 (+1, worse), Shkiah 16:40 (+1, worse), Roy Shabbat
  ends 17:15 (unchanged). Candle Fri Nov 13: 16:21 (still -1).
- FIXEDMIL (fixed mil, Israel-style): Alot 05:42, Shema Magen 08:41
  (+6, much worse), Tzeit 16:51, Roy Shabbat ends 17:09 (fixed 30
  min). Rejected as the method for Staten Island.
- RTSTRICT (`rtKulah: false`): Rabbeinu Tam unchanged at 17:46,
  because the code returns Tzet Hakochavim as the first element in
  both branches when it is earlier than sunset+72. No other times
  change.

**Candle-lighting note (open question, not a code change):** with an
18-minute candle offset instead of Roy's default 20, Fri Nov 13 gives
16:22:27, i.e. site 16:22, an exact match to the anchor from Roy's
own sunset (16:40:27). An 18-minute offset is also the common US
custom. This is a hypothesis about the anchor's source, not a
proven Roy default: Roy's default is 20, and no setting was changed
to force the match. Confirm the congregation's candle custom before
publishing a candle time.

**Shema Magen note (hypothesis, exact arithmetic):** Roy's Alot
05:35:10 plus exactly 3 clock hours = 08:35:10, i.e. 08:35. That is
the "equal-hours" (שעות שוות) reading of Shema Magen Avraham. It is
**not** Roy's seasonal calculation (08:38) and it is **not** adopted
here; it is recorded because it reproduces the anchor to the second
and may explain the anchor's source.

**Inconsistency finding (important):** the Toldot anchors and the
Dec 20 Roy-site example (§3) cannot both come from one Roy
configuration. Under the equal-hours reading, Dec 20 Shema Magen
would be Alot 06:13:59 + 3:00 = 09:14, but the Dec 20 example says
09:04, which is exactly Roy's seasonal value. The two anchor sets
therefore come from different methods/sources. Roy's seasonal
calculation is internally consistent with the Dec 20 set (§3) and
differs from the Toldot set mainly on Shema Magen (+3) and Netz (-1).

## 3. Fast day, Sun Dec 20, 2026 (10 Tevet) vs Roy-site example values

| Zman | Roy-site example | Roy BASE raw | Roy BASE site | Diff (site) |
|---|---|---|---|---|
| Alot Hashachar | 06:14 | 06:13:59 | 06:14 | 0 MATCH |
| Talis / Tefillin | — | 06:24:20 | 06:24 | — |
| Netz | 07:14 | 07:16:08 | 07:16 | +2 MISMATCH |
| Shema Magen Avraham | 09:04 | 09:04:07 | 09:04 | 0 MATCH |
| Shema Gra | 09:35 | 09:35:09 | 09:35 | 0 MATCH |
| Sof Zman Tefillah (Gra) | — | 10:21:30 | 10:21 | — |
| Chatzot | 11:54 | 11:54:11 | 11:54 | 0 MATCH |
| Mincha Gedola | — | 12:24:11 | 12:24 | — |
| Plag HB / YY | — | 15:34:19 / 15:45:56 | 15:34 / 15:46 | — |
| Shkiah | 16:32 | 16:32:14 | 16:32 | 0 MATCH |
| Tzeit (regular) | — | 16:43:52 | 16:44 | — |
| Tzeit Humra | — (see fast hours) | 16:49:28 | 16:50 | — |
| Shabbat ends, Roy only | — | 17:09:54 | 17:10 | — |
| Rabbeinu Tam | 17:35 | 17:34:32 | 17:34 | -1 MISMATCH |

ELEV variant for Dec 20: Alot 06:13 (-1, worse), Netz 07:16
(unchanged), Shema Magen 09:03 (-1, worse), Shema Gra 09:34 (-1,
worse), Shkiah 16:33 (+1, worse), Rabbeinu Tam 17:36 (+1). The anchor
(17:35) sits between BASE (17:34) and ELEV (17:36); neither variant
explains it, and Netz (+2) is unexplained by any tested setting.
The most plausible remaining explanations for Netz/RT are the live
site's forecast refraction / visible-sunrise data (not loaded here)
or a slightly different location/coordinate set on the Roy site, but
a longitude shift that fixed Netz by -2 minutes would also move
Shkiah, which already matches exactly, so a pure coordinate shift
does **not** explain it. This is left as an unexplained 1-2 minute
difference, not adjusted away.

**Fast hours 6:13-16:49: fully explained, not a mismatch.** Roy's
fast-day banner formats raw times directly without `roundsUp`:
Alot raw 06:13:59 truncates to 06:13 and Tzet Humra raw 16:49:28
truncates to 16:49. The list-rounded values (06:14 / 16:50) differ
from the banner by design in Roy's own code, and the example's fast
hours match the banner form exactly.

## 4. Ordinary weekdays, Nov 2026 (BASE, site minutes; raw in appendix)

| Zman | Mon Nov 2 (site) | Tue Nov 3 (site) |
|---|---|---|
| Alot | 05:18 | 05:19 |
| Talis / Tefillin | 05:30 | 05:31 |
| Netz | 06:28 | 06:29 |
| Shema Magen | 08:29 | 08:30 |
| Shema Gra | 09:04 | 09:04 |
| Tefillah | 09:56 | 09:56 |
| Chatzot | 11:40 | 11:40 |
| Mincha Gedola | 12:10 | 12:10 |
| Plag HB | 15:47 | 15:46 |
| Plag YY | 16:00 | 15:59 |
| Shkiah | 16:52 | 16:50 |
| Tzeit | 17:05 | 17:04 |
| Roy Shabbat ends (comparison only) | 17:26 | 17:25 |
| Rabbeinu Tam | 18:02 | 18:00 |

Sanity: day-to-day movement is smooth (sunrise ~+1 min, sunset ~-2
min, no jumps or failures). Raw values for all days are in
`validation/roy-raw-output.txt`.

## 5. Our own Shabbat-ends calculation (NOT Roy, NOT fixed minutes)

**Module:** `src/zmanim/shabbat-ends.js` (plain JS, no dependencies
beyond the standard `Intl` API). Function
`computeShabbatEnds({ date, latitude, longitude, timeZone })`
returns sunset and Shabbat ends in the given timezone (default
America/New_York), plus raw millisecond values and
`minutesAfterSunset`. `computeShabbatEndsOrHachaim(date)` bakes in
the synagogue coordinates.

**Rule:** Shabbat ends = the moment the **centre** of the sun is
**8.5 degrees below the horizon** after sunset (zenith 98.5°).
Sunset in the module uses zenith 90.833° (upper limb + standard
refraction), so it is comparable with published sunsets. The
8.5° dip is geometric, with no extra refraction term added, because
the dip itself is the definition. There is no fixed-minute input
anywhere; the 41-52 minute span below is an outcome, not an input.

**Algorithm (documented in the module):** NOAA Solar Calculator
formulae: Julian day/century, geometric mean longitude and anomaly,
eccentricity, equation of centre, true/apparent longitude, mean and
corrected obliquity, equation of time, solar declination, hour angle
for the requested zenith. Solar position is evaluated twice (at
local noon, then refined at sunset). Timezone offset comes from
`Intl.DateTimeFormat`, so DST is handled by the platform tz
database. Known accuracy limit: about 1 minute (NOAA's own stated
accuracy); see the cross-check below.

**Test script:** `validation/test-shabbat-ends.mjs` prints the
Toldot result and the full 5787 Saturday check.
`validation/pub-gaps.mjs` computes published-minute gap
conventions; `validation/check-85deg-roy*.mjs` are the Roy SPA
cross-checks (solar position only, not Roy's Shabbat-ends rule).

### 5a. Toldot, Sat Nov 14, 2026

| | Sunset | Shabbat ends | Gap |
|---|---|---|---|
| MyZmanim anchor (published minutes) | 16:39 | 17:23 | 44 min |
| Our module, raw | 16:38:57 | 17:22:06 | 43.2 min |
| Our module, published to nearest minute | 16:39 | 17:22 | 43 min |
| Our module, nightfall rounded UP (ceil, never early) | — | 17:23 | — |
| Roy SPA solar position, raw (cross-check only) | 16:39:33 | 17:22:37 | 43.1 min |

**Verdict on (a): close, but NOT an exact raw pass, and this is
reported as such.** Our ends time is 31 seconds early vs Roy's
precise SPA 8.5° time (17:22:37) and 54 seconds before the earliest
instant consistent with published 17:23. That is within the NOAA
algorithm's ~1 minute accuracy, and under the "nightfall is never
published early" (ceil) convention our ends publishes as 17:23,
exactly the anchor. The sunset raw value is 36 seconds early vs
Roy SPA, which is why truncation gives 16:38 while nearest-minute
gives the anchor's 16:39. No value was adjusted to force a match;
the module is unchanged from its first (bug-fixed) form. The one
real bug found and fixed during this work was a solar-noon anchor
error in the first draft (it returned 11:39 instead of 16:39);
it is fixed and documented in the module comments.

### 5b. All 55 Saturdays of Jewish year 5787

Boundaries verified with the platform Hebrew calendar:
1 Tishrei 5787 = 2026-09-12, 1 Tishrei 5788 = 2027-10-02; 5787 is a
leap year, hence 55 Saturdays. Saturdays counted are the local
Saturday dates in that interval.

| Measure | Min | Max | Saturdays outside 41-52 |
|---|---|---|---|
| Our module, **raw** gap | 40.4 min (2027-03-13; also 2026-09-26, 2026-10-03) | 50.6 min (2027-06-19) | 5 Saturdays at raw-rounded 40 min (2026-09-26, 2026-10-03, 2027-03-06, 2027-03-13, 2027-09-25); none above 52 |
| Roy SPA 8.5° **raw** gap (cross-check) | 40.38 min (2026-10-03) | 50.46 min (2027-06-19) | same shape; confirms our module to <1 min, not a rule error |
| Our module, **published** gap = ceil(ends) minus trunc(sunset) | 41 min | 52 min | **0** |

**Distribution of raw-rounded gaps (minutes -> Saturdays):**
40: 5, 41: 12, 42: 7, 43: 4, 44: 6, 45: 7, 46: 3, 47: 2, 48: 2,
49: 2, 50: 4, 51: 1. Total 55.

**Why the task's 41-52 range is a published-minute range, not a raw
range:** raw 8.5° gaps physically run 40.4-50.6 minutes at this
latitude (both our NOAA module and Roy's precise SPA agree). The
published range 41-52 is reproduced **exactly** by our module when
published minutes are formed as MyZmanim-style minutes (sunset
truncated down, nightfall rounded up): 41 to 52, zero Saturdays
outside. That convention adds up to ~2 minutes to the raw gap at
the extremes, which is exactly the difference between the raw
range (40.4-50.6) and the published range (41-52).

**One nuance on the max Saturday:** the anchor note names Jun 12,
2027 as the single 52-minute Saturday (sunset 20:27, nightfall
21:19). Our values for Jun 12 are sunset raw 20:28:21 (Roy SPA
20:27:44) and ends raw 21:18:41 (Roy SPA 21:17:58): published
ceil-minus-trunc gives 51, not 52, because our sunset raw is ~37
seconds later than Roy's and truncates to 20:28 instead of 20:27.
Our published 52 falls on Jun 19, 2027 (sunset 20:30:59, ends
21:21:33). The **range** 41-52 is reproduced exactly; the **identity**
of the max Saturday differs by one week, a 1-minute boundary
effect at the truncation edge, not a different rule. If a future
revision swaps the NOAA formulae for a higher-precision solar
position (e.g. full SPA), Jun 12 may return to 52; the rule itself
would not change.

**Verdict on (4):** the year-independent 8.5° calculation is
validated. Raw range 40.4-50.6 (Roy SPA agrees 40.38-50.46);
published-minute range 41-52 with zero Saturdays outside under
the ceil/trunc convention. No Saturday is outside 41-52 in
published minutes, and no Saturday exceeds 52 in any measure.

## 6. Limitations and open questions (for the parent, not Hanoch)

1. No refraction/visible-sunrise/haze data was loaded (offline,
   test-only). A live Roy page with forecast data could move Netz
   and Tzet Melakha by ~1-2 minutes; this is the leading hypothesis
   for the Dec 20 Netz (+2) and RT (-1) residuals, but it is
   unproven here and was not used to adjust any number.
2. Synagogue elevation is unknown; 23.67 m was tested only as the
   prior example value. The BASE (no-elevation) run matches the
   Dec 20 example better than ELEV on 6 of 8 anchors, so BASE is
   the recommended default until a real elevation is measured.
3. Candle offset: RESOLVED by Hanoch decision 2026-11-01 23:06.
   Production value is 18 minutes before sunset (Toldot anchor
   16:22), NOT Roy default 20 (16:20).
4. Shema Magen: RESOLVED by Hanoch decision 2026-11-01 23:06.
   Production method is equal minutes (Toldot anchor 08:35),
   NOT Roy seasonal (08:38). Do not present Roy seasonal Shema
   Magen as the congregation value.
5. Our Shabbat-ends module is ~1 minute accurate (NOAA). For
   publication, use the ceil (round-up) convention for nightfall so
   Shabbat is never ended early by rounding; the module returns raw
   values so the caller can apply that convention explicitly.
6. Shabbat ends in this report is for Saturday nights only. The
   same function works for any date (e.g. Yom Tov nights), but
   candle-lighting-after-Tzeit rules for Yom Tov are a separate
   display question and were not validated here.

## 7. Files delivered

- [validation-report.md](sandbox://workspace/or-hachaim-site/validation/validation-report.md) — this report.
- [shabbat-ends.js](sandbox://workspace/or-hachaim-site/src/zmanim/shabbat-ends.js) — reusable Shabbat-ends module (replaces the placeholder).
- [test-shabbat-ends.mjs](sandbox://workspace/or-hachaim-site/validation/test-shabbat-ends.mjs) — Toldot + 5787 range check (run: `node test-shabbat-ends.mjs` from `validation/`).
- [run-roy.mjs](sandbox://workspace/or-hachaim-site/validation/run-roy.mjs) — headless Roy harness.
- [roy-raw-output.txt](sandbox://workspace/or-hachaim-site/validation/roy-raw-output.txt) — full raw Roy output for all dates/variants.
- [check-85deg-roy.mjs](sandbox://workspace/or-hachaim-site/validation/check-85deg-roy.mjs), [check-85deg-roy-5787.mjs](sandbox://workspace/or-hachaim-site/validation/check-85deg-roy-5787.mjs), [pub-gaps.mjs](sandbox://workspace/or-hachaim-site/validation/pub-gaps.mjs), [pub-max-rows.mjs](sandbox://workspace/or-hachaim-site/validation/pub-max-rows.mjs) — cross-check helpers.

**Not claimed:** the site is not live, nothing is done beyond this
validation, and nothing was pushed to any repo in this task.
