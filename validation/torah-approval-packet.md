# Torah Approval Packet: Or Hachaim Synagogue Screen, Times and Calendar

**Status: DRAFT FOR REVIEW. NOT APPROVED. No time in this packet is
approved for live display until a Torah authority signs below.**
Until approval, the screen shows sample or demo times only, clearly
labeled, never as a published luach. No unverified time will be
displayed live, and no real congregant or gabbai data is imported
until the gates in this packet pass.

**Place:** Or Hachaim Congregation, 321 Harold St, Staten Island,
NY 10314. Latitude 40.60155, longitude -74.13206, timezone
America/New_York.

**Torah authority (to be filled in by Hanoch, no name is assumed
here):**
- Name: ________________________
- Signature: ________________________
- Date: ________________________
- Conditions or notes: ________________________

## 1. What is being asked to approve

1. The calculation methods in section 2, and the three binding
   decisions in section 3 (candle 18 minutes, Shema Magen Avraham
   equal-minutes, Shabbat ends by an 8.5-degree angle).
2. The full-year validation results in sections 4 and 5, including
   the mismatches and open questions in section 6, which are
   reported, not hidden.
3. The Sephardic and Diaspora calendar behaviour in section 7,
   including which items are still sample-only and need a calendar
   source approved by the authority.

## 1A. Haskama for the Zemaneh Yosef calendar, received 2026-11-02

On 2026-11-02 Hanoch sent an image of a haskama from Rav
Yitzchak Yosef, Rishon Lezion, for the calendar called
"Zemaneh Yosef" for a horizon outside Israel. Source file
as received: `~/workspace/user/files/1001962877_0_rko3.jpg`.
The letter is dated 5 Nisan 5785 in its own heading.

What this haskama is, and what it is not:
- It is source approval for the Zemaneh Yosef calendar
  itself, which is the times source adopted in the final
  source rule of 2026-11-02 (all times from Zemaneh Yosef,
  except Shabbat ends).
- It is NOT approval of this screen implementation, of
  this codebase, of any specific time computed here, or
  of the Shabbat ends angle module. No such claim is made
  in this packet, and the signature field in section 1
  remains blank for the implementation approval gate.
- It does not replace the implementation validation in
  sections 4 to 6, and it does not close any open question
  in section 6, including the candle and Shema rounding
  questions and the Netz residuals.

## 2. Methods used (test data only, nothing live)

### 2.1 Roy code, unmodified

- Source: the Zemaneh Yosef / RoyZmanim website code, cloned at
  `~/workspace/or-hachaim-site/royzmanim-code`, **not modified**.
  All harness scripts live in `validation/`; the production
  decisions live in `src/zmanim/`.
- Headless run: Node loads the site's own Temporal polyfill, then
  imports the unmodified `assets/js/ROYZmanim.js` directly.
  Configuration replicated from the site's `buildZemanimConfig`
  for a place outside Israel (BASE): no elevation, degree-based
  (not fixed mil), Rabbeinu Tam kulah variant, Tzet Melakha
  7.165 degrees / 30 minutes (Roy comparison only, not our
  Shabbat ends), candle 20 minutes recorded for comparison only.
- Limitations, stated plainly:
  - No forecast refraction, visible-sunrise, terrain-horizon, or
    haze data was loaded. Netz is therefore sea-level sunrise.
    A live Roy page with forecast data could move Netz and
    Tzet Melakha by about 1 to 2 minutes. This is the leading,
    unproven hypothesis for the remaining 1 to 2 minute residuals.
  - Synagogue elevation is unknown. The prior Roy ZIP example
    value 23.67 metres was tested only as an alternate; BASE
    (no elevation) matched the Dec 20 example better, so BASE
    is the recommended default until a real elevation is measured.
  - Site display rounding in Roy's code rounds up to the next
    minute if seconds are above 40, or above 20 when the entry
    is marked "later". Raw times are kept alongside site minutes
    in the full-year file so no rounding artefact is hidden.
- Full-year run: every day 2026-09-12 to 2027-10-01, 385 days,
  0 failures. File: `validation/roy-full-year-5787.jsonl`.
  Jewish year 5787 runs 2026-09-12 (1 Tishrei) to 2027-10-01
  (the day before 1 Tishrei 5788); it is a leap year, hence
  55 Saturdays.

### 2.2 MyZmanim cross-check, not the source

- Hanoch supplied a MyZmanim annual PDF for 5787, Staten Island
  10314. It was used **only as a cross-check** for this validation.
  It is **not** the source for the screen, and its full table is
  **not** reproduced in this packet. Only aggregate differences
  (counts, means, ranges) and the two anchors already recorded in
  the prior validation report are quoted, because the PDF itself
  states that republishing its times as part of another
  publication requires written permission.
- MyZmanim column mapping used for the cross-check, verified
  against the Toldot row (Nov 14, 2026): Rabbeinu Tam equal-minutes,
  Rabbeinu Tam 16.1 degrees, Nightfall 3 stars, Sunset, Candle
  Lighting (on Fridays and Erev Yom Tov only, 59 rows in the year),
  Plag, Mincha Ketana, Mincha Gedola, Chatzot, Tefillah Gra,
  Shema Gra, Shema Magen Avraham equal-minutes, Shema Magen
  Avraham degrees, Netz, Talis, Dawn 72 minutes, Dawn 16.1 degrees.
- Note on the candle column: a candle time appears in the PDF
  on Fridays and on Erev Yom Tov days (for example Sep 20, 2026,
  Erev Yom Kippur, and Jun 10, 2027, Erev Shavuot), not on every day.
  The production candle time in section 3 applies only on those
  evenings, not on every day.

## 3. Binding decisions (Hanoch, 2026-11-01) and final source rule (2026-11-02)

Final source rule, Hanoch 2026-11-02: Zemaneh Yosef for
all times, except Shabbat ends, which stays only per
MyZmanim with our own 8.5 degree angle calculation.
The two decisions below are kept as decided, in one
configurable place (`src/zmanim/source-rule.js`), until
Hanoch confirms whether the final rule overrides them.
They are NOT silently switched to Roy defaults.

### 3.1 Candle lighting: 18 minutes before sunset

- Production value: sunset minus 18 minutes, everywhere it
  applies (Erev Shabbat and Erev Yom Tov). Not Roy's default 20.
- Cross-check: in the MyZmanim PDF, candle minus sunset is
  exactly 18 minutes on all 59 candle rows. Against Roy's own
  sunset (site-rounded), our production candle (Roy sunset
  minus 18) matches the MyZmanim candle exactly on 48 of 59
  rows and is 1 minute later on 11 rows, never earlier, never
  more than 1 minute off. The 11 rows are explained by Roy's
  sunset rounding being 1 minute later than MyZmanim's on
  those days, not by a different candle rule.
- Toldot anchor: Friday Nov 13, 2026, Roy sunset 16:40 (site),
  minus 18 = 16:22, the congregation anchor exactly.

### 3.2 Shema Magen Avraham: equal-minutes, not Roy seasonal

- Production method: equal-minutes (shavot). Roy's seasonal
  Shema Magen is rejected for this value.
- Formula, derived and validated against the PDF, not invented
  from one day: let Alot72 = Netz minus 72 minutes, and
  Tzet72 = Sunset plus 72 minutes. Then a seasonal hour is
  (Tzet72 minus Alot72) divided by 12, and Shema Magen Avraham
  (equal-minutes) = Alot72 plus 3 seasonal hours, which is
  (3 times Alot72 plus Tzet72) divided by 4.
- Validation of the formula itself against the PDF equal-minutes
  column, all 385 days, using the PDF's own Dawn 72 column and
  Sunset: mean difference +0.03 minutes, range -0.75 to
  +0.75 minutes, 348 days exact to the minute, 37 days within
  1 minute, zero outliers. This confirms the formula, not just
  the Toldot anchor.
- Production implementation using Roy's site-rounded Netz and
  Sunset (the values the screen will actually use): Shema
  Magen equal-minutes matches the PDF equal column exactly on
  181 days and is 1 minute later on 204 days, never earlier,
  never more than 1 minute off.
- Alternative rounding, reported for the authority to choose:
  using Roy's raw (second-precision) Netz and Sunset and then
  truncating the result matches the PDF minute exactly on
  332 days and is 1 minute earlier on 53 days, never later.
  For a deadline time such as Shema, truncating (never publishing
  later than computed) is the conservative direction; the
  site-rounded method is never early. **Open question for the
  authority: which rounding convention should govern deadline
  times (Shema, Tefillah)?** The packet does not decide this.
- Toldot anchor: Saturday Nov 14, 2026, Shema Magen
  equal-minutes 8:35, matching the congregation anchor exactly.
  Roy seasonal on that day is 8:38 and is rejected.
- Why this matters across the year: Roy seasonal minus
  equal-minutes ranges from -15 to +5 minutes, mean -4.7
  minutes. By month, seasonal is earlier than equal by about
  13 to 15 minutes in May to July, and later by about 4 to
  5 minutes in December to January. Using the wrong method
  would therefore misstate Shema by up to 15 minutes in
  summer. This is the largest method difference in the year
  and the reason the decision is binding.

### 3.3 Shabbat ends: our own 8.5-degree angle, not Roy, not fixed minutes

- Rule: Shabbat ends is the moment the centre of the sun is
  8.5 degrees below the horizon after sunset (zenith 98.5
  degrees). Sunset uses zenith 90.833 degrees. Module:
  `src/zmanim/shabbat-ends.js`, NOAA Solar Calculator formulae,
  about 1 minute accuracy, DST handled by the platform
  timezone database. No fixed-minute input anywhere.
- Publication convention: nightfall is rounded up (ceil) so
  Shabbat is never ended early by rounding; sunset is
  truncated down. The raw values are always kept so the
  caller can apply the convention explicitly. Under this
  convention the published gap is ceil(ends) minus trunc(sunset).
- This rule applies to Saturday nights and, by the same
  function, to Yom Tov nights. Rabbeinu Tam is a separate
  time, shown as its own item, and is **not** Shabbat ends.
  On holidays, Rabbeinu Tam appears only if the holiday falls
  on Shabbat or it is Yom Kippur, per the plan.

## 4. Full-year validation results: Roy vs MyZmanim, 385 days

Diff = Roy site minute minus MyZmanim published minute, except
Shema Magen equal-minutes, where diff = production value
(section 3.2) minus PDF equal column. All differences are in
minutes. No zman differs by more than 1 minute on any day
except the seasonal Shema Magen method, which is rejected
and shown only to prove the method difference.

| Zman | Mean diff | Min | Max | Distribution |
|---|---|---|---|---|
| Netz (sunrise) | -0.59 | -1 | 0 | -1 on 226 days, 0 on 159 days |
| Shema Gra | +0.19 | 0 | +1 | 0 on 311 days, +1 on 74 days |
| Chatzot | +0.25 approx. | -1 | +1 | 0 on 262 days, +1 on 111 days, -1 on 12 days |
| Mincha Gedola | -0.43 | -1 | 0 | 0 on 221 days, -1 on 164 days |
| Plag Hamincha, Halacha Brurah | +0.60 | 0 | +1 | 0 on 153 days, +1 on 232 days |
| Shkiah (sunset) | +0.26 | 0 | +1 | 0 on 283 days, +1 on 102 days |
| Shema Magen, equal-minutes, production | +0.53 | 0 | +1 | 0 on 181 days, +1 on 204 days |
| Shema Magen, seasonal (Roy, rejected) | -4.69 | -15 | +5 | see monthly table in section 4.1 |
| Candle, production (59 Erev rows) | +0.19 | 0 | +1 | 0 on 48 rows, +1 on 11 rows |

### 4.1 Seasonal vs equal-minutes Shema Magen, by month

Seasonal minus equal-minutes, minutes. Negative means seasonal
is earlier than equal.

| Month | Mean | Min | Max |
|---|---|---|---|
| 2026-09 | -5.1 | -7 | -4 |
| 2026-10 | -1.6 | -4 | 0 |
| 2026-11 | +2.4 | 0 | +4 |
| 2026-12 | +4.3 | +4 | +5 |
| 2027-01 | +3.5 | +2 | +5 |
| 2027-02 | 0.0 | -2 | +2 |
| 2027-03 | -4.4 | -7 | -2 |
| 2027-04 | -8.9 | -11 | -7 |
| 2027-05 | -12.8 | -15 | -11 |
| 2027-06 | -14.7 | -15 | -14 |
| 2027-07 | -13.8 | -15 | -13 |
| 2027-08 | -10.5 | -12 | -9 |
| 2027-09 | -6.1 | -9 | -4 |
| 2027-10 | -4.0 | -4 | -4 |

### 4.2 Seasonal extremes and DST

- Netz: earliest 05:25 on 2027-06-11, latest 07:26 on
  2026-10-31 (the last day of daylight saving time).
- Shkiah: earliest 16:29 on 2026-12-04, latest 20:31 on
  2027-06-21 (summer solstice).
- Shema Magen equal-minutes: earliest 08:28 on 2026-11-01,
  latest 09:32 on 2027-03-14.
- Day-to-day movement is smooth all year. The only jumps
  larger than 5 minutes are the two clock changes, exactly
  as expected: Oct 31 to Nov 1, 2026, Netz -59 minutes and
  Shkiah -61 minutes (fall back, plus seasonal drift);
  Mar 13 to Mar 14, 2027, Netz +58 minutes and Shkiah
  +61 minutes (spring forward, plus seasonal drift).
  No other day-to-day jump, failure, or missing day was found
  in 385 days.
- Winter solstice Dec 21, 2026: Netz 07:17, Shema
  equal-minutes 09:00, Shema Gra 09:35, Shkiah 16:33.
  Summer solstice Jun 21, 2027: Netz 05:26, Shema
  equal-minutes 08:36, Shema Gra 09:12, Shkiah 20:31.
  Equinoxes Mar 20, 2027 and Sep 22, 2026 compute cleanly
  with no anomaly.

### 4.3 Anchors already recorded, re-checked in the full-year run

- Toldot, Sat Nov 14, 2026: Roy Netz 06:42 vs anchor 06:43
  (-1), Shema Gra 09:11 exact, Chatzot site 11:41 vs anchor
  11:40 (raw 11:40:59, a rounding artefact), Plag HB 15:37
  exact, Shkiah 16:39 exact, production candle Fri Nov 13
  16:22 exact, production Shema Magen equal-minutes 08:35
  exact. Roy seasonal Shema Magen 08:38 is rejected.
- Fast day, Sun Dec 20, 2026 (10 Tevet): Roy Netz 07:16 vs
  Roy-site example 07:14 (+2), Rabbeinu Tam 17:34 vs 17:35
  (-1), Alot 06:14, Shema Magen seasonal 09:04, Shema Gra
  09:35, Chatzot 11:54, Shkiah 16:32 all exact to the example.
  Fast hours 6:13 to 16:49 are fully explained by Roy's
  fast-banner truncation (Alot raw 06:13:59, Tzet Humra raw
  16:49:28), not a mismatch. Production Shema Magen
  equal-minutes on Dec 20 is 08:59, which is **not** the
  Roy-site example value, because the example is seasonal;
  the congregation value is equal-minutes by decision.

### 4.4 Holidays and fasts, Roy production values (sample table)

Candle18 here is sunset minus 18, shown for reference; it
applies in practice only on Erev Shabbat and Erev Yom Tov.
Tzeit Humra is the fast-end reference on fast days. All
times are Roy site minutes, except ShemaEq which is the
production equal-minutes value.

| Holiday / fast | Date | Netz | ShemaEq | ShemaGra | Chatzot | Shkiah | TzeitHumra | RT |
|---|---|---|---|---|---|---|---|---|
| Rosh Hashana 1 | 2026-09-12 | 06:35 | 09:08 | 09:43 | 12:53 | 19:10 | 19:34 | 20:22 |
| Rosh Hashana 2 | 2026-09-13 | 06:35 | 09:08 | 09:44 | 12:52 | 19:09 | 19:32 | 20:21 |
| Tzom Gedalia (fast) | 2026-09-14 | 06:36 | 09:08 | 09:44 | 12:52 | 19:07 | 19:30 | 20:19 |
| Yom Kippur (fast) | 2026-09-21 | 06:43 | 09:10 | 09:46 | 12:49 | 18:55 | 19:18 | 20:07 |
| Sukkot 1 | 2026-09-26 | 06:48 | 09:12 | 09:48 | 12:48 | 18:47 | 19:09 | 19:59 |
| Shemini Atzeret | 2026-10-03 | 06:55 | 09:14 | 09:50 | 12:45 | 18:35 | 18:57 | 19:47 |
| Simchat Torah (Diaspora) | 2026-10-04 | 06:56 | 09:14 | 09:50 | 12:45 | 18:33 | 18:55 | 19:45 |
| Hanukkah 1 | 2026-12-05 | 07:05 | 08:50 | 09:26 | 11:47 | 16:29 | 16:47 | 17:33 |
| Hanukkah 8 | 2026-12-12 | 07:11 | 08:55 | 09:30 | 11:50 | 16:30 | 16:47 | 17:32 |
| 10 Tevet (fast) | 2026-12-20 | 07:16 | 08:59 | 09:35 | 11:54 | 16:32 | 16:50 | 17:34 |
| Tu BiShvat | 2027-01-23 | 07:14 | 09:05 | 09:41 | 12:08 | 17:03 | 17:22 | 18:09 |
| Taanit Esther (fast) | 2027-03-22 | 06:57 | 09:24 | 10:00 | 13:03 | 19:10 | 19:33 | 20:22 |
| Purim | 2027-03-23 | 06:55 | 09:23 | 09:59 | 13:03 | 19:11 | 19:35 | 20:23 |
| Pesach 1 | 2027-04-22 | 06:08 | 08:56 | 09:31 | 12:55 | 19:43 | 20:08 | 20:55 |
| Pesach 7 | 2027-04-28 | 06:00 | 08:51 | 09:27 | 12:54 | 19:49 | 20:15 | 21:01 |
| Pesach 8 (Diaspora) | 2027-04-29 | 05:58 | 08:50 | 09:26 | 12:54 | 19:50 | 20:16 | 21:02 |
| Lag BaOmer | 2027-05-25 | 05:32 | 08:37 | 09:13 | 12:53 | 20:15 | 20:43 | 21:27 |
| Shavuot 1 | 2027-06-11 | 05:25 | 08:35 | 09:11 | 12:56 | 20:27 | 20:55 | 21:39 |
| Shavuot 2 (Diaspora) | 2027-06-12 | 05:25 | 08:35 | 09:11 | 12:56 | 20:28 | 20:56 | 21:40 |
| 17 Tammuz (fast) | 2027-07-22 | 05:44 | 08:47 | 09:23 | 13:03 | 20:21 | 20:49 | 21:33 |
| 9 Av (fast) | 2027-08-12 | 06:04 | 08:57 | 09:32 | 13:01 | 19:58 | 20:25 | 21:10 |

No holiday or fast date failed to compute, and no holiday
value jumps out of the seasonal trend. Note: 17 Tammuz
5787 is 2027-07-22 (ICU Hebrew month name "Tamuz", not
"Tammuz"); the same care is needed for any Hebrew-date
lookup in code.

## 5. Shabbat ends: angle verification, all 55 Saturdays of 5787

Script: `validation/check-shabbat-ends-full-year.mjs`.
Output: `validation/shabbat-ends-full-year.json`.
Method: for each Saturday, take MyZmanim Nightfall 3 stars
(published minute) and Sunset (published minute), compute
our own 8.5-degree ends with the module in section 3.3, and
independently compute the sun's centre depression angle at
the MyZmanim nightfall instant, using the same NOAA formulae
inverted. If MyZmanim's nightfall really is an 8.5-degree
nightfall, that angle should cluster around 8.5 degrees,
allowing for published-minute rounding (about 0.18 degrees
per minute near the horizon) and NOAA's about 1 minute
accuracy. It does.

| Measure | Result |
|---|---|
| Saturdays checked | 55, all Saturdays of 5787 |
| Sun depression angle at MyZmanim Nightfall 3 stars, at the published minute | Min 8.41 degrees, max 8.79 degrees, mean 8.60 degrees |
| Our raw ends minus MyZmanim Nightfall (published minute) | Min -1.7 minutes, max +0.6 minutes |
| Published gap, ours (ceil ends minus trunc sunset) | 41 to 52 minutes, zero Saturdays outside |
| Published gap, MyZmanim (Nightfall minus Sunset, published minutes) | 41 to 52 minutes, zero Saturdays outside |
| Published gap difference, ours minus MyZmanim | 0 on 36 Saturdays, +1 on 11 Saturdays, -1 on 8 Saturdays |
| Raw gap, ours | 40.4 to 50.6 minutes |

- The angle result is the key finding: it verifies the
  **angle itself**, not only minute gaps. A fixed-minute
  rule would not produce a depression angle clustered
  around 8.5 degrees across winter and summer; a
  different angle (for example 7.083 degrees for 3 medium
  stars, or 7.165 degrees for Roy's Tzet Melakha) would
  show up as a systematic offset, and it does not.
- Largest negative raw difference: Dec 12, 2026, our ends
  1.7 minutes before MyZmanim's published minute, with
  depression 8.79 degrees at that minute. That is within
  NOAA's about 1 minute accuracy plus published-minute
  rounding, and the published gap on that Saturday still
  matches (47 minutes in both).
- Largest positive raw difference: +0.6 minutes, on
  Jun 19, Jun 26, and Jul 3, 2027.
- The Jun 12 / Jun 19 boundary note from the prior report
  stands: MyZmanim's published 52-minute Saturday is
  Jun 12, 2027 (sunset 20:27, nightfall 21:19), while our
  published 52 falls on Jun 19, 2027 (sunset raw 20:30:59,
  ends raw 21:21:33, published gap 52). On Jun 12 our raw
  sunset is 20:28:21 (37 seconds later than Roy's precise
  SPA value) and our raw ends is 21:18:41, giving a
  published gap of 51, not 52. The **range** 41 to 52 is
  reproduced exactly; the identity of the maximum Saturday
  differs by one week, a 1-minute truncation-boundary
  effect, not a different rule. If a future revision swaps
  NOAA for a higher-precision solar position, Jun 12 may
  return to 52; the rule itself would not change.
- Toldot re-check: Sat Nov 14, 2026, our raw sunset
  16:38:57, raw ends 17:22:06, raw gap 43.2 minutes;
  published (ceil) ends 17:23, matching the anchor
  ends time, although our published gap (ceil ends
  minus trunc sunset, 17:23 minus 16:38 = 45) is
  1 minute larger than MyZmanim's published gap
  (17:23 minus 16:39 = 44), because our raw sunset
  is 3 seconds before 16:39 and truncates to 16:38.
  Depression at MyZmanim's published 17:23 is 8.67
  degrees, and our raw ends is 0.9 minutes before
  that published minute.

## 6. Mismatches and open questions (not hidden)

1. **Netz, systematic -1 minute.** Roy Netz is 1 minute
   earlier than MyZmanim on 226 of 385 days, equal on
   159 days, never later. This is consistent with a
   sea-level sunrise without horizon or forecast data, or
   with a 1-minute rounding difference, but it is not
   proven. It is the same direction all year, so it is
   not a random error, and it must be disclosed to the
   authority. Question: should Netz be published as Roy
   computes it, or adjusted by the horizon/forecast data
   when that data is available?
2. **Dec 20 Netz (+2) and Rabbeinu Tam (-1) remain
   unexplained by any tested setting.** In the full-year
   run Netz is never +2 vs MyZmanim, so Dec 20 is an
   exception against the Roy-site example, not the
   MyZmanim PDF. The leading hypothesis remains live
   forecast or visible-sunrise data on the Roy site,
   which was not loaded here, or a slightly different
   site location. A pure longitude shift does not explain
   it, because Shkiah already matches exactly. This is
   left as an unexplained 1 to 2 minute difference, not
   adjusted away.
3. **Elevation unknown.** BASE (no elevation) is
   recommended until the synagogue elevation is measured.
   The 23.67 metre ZIP value made Dec 20 worse on several
   zmanim in the prior report and is not adopted.
4. **Deadline rounding convention.** See section 3.2:
   site-rounded production Shema is never early and
   +1 on 204 days; raw-truncated Shema is never late
   and -1 on 53 days. The authority should choose the
   convention for deadline times.
5. **Haftarah and Omer calendar source.** Roy code
   provides zmanim only. The Haftarah list per Edot
   HaMizrach, the Omer count, and the holiday-customs
   board are specified in the plan as required content,
   but their computed calendar source has not been
   validated in this task. They are sample text in the
   scaffold today. **Gate: the authority must approve
   the calendar source or list before go-live.**
6. **Fast start and end detail.** Fast hours in this
   validation are Alot to Tzet Humra, with the 10 Tevet
   banner-truncation note in section 4.3. The full
   fast-detail content (entry, exit, and related fast
   details on screen) is a display requirement, not yet
   validated against a fast-day luach beyond 10 Tevet.
7. **No live forecast data.** If the production system
   later loads forecast or horizon data, Netz, Tzet, and
   possibly Shabbat ends must be re-validated, because
   the numbers in this packet are for the no-forecast
   configuration.

## 7. Sephardic and Diaspora calendar behaviour

This section states what the system **must** do, and what
is **already validated** versus **still sample-only**.
Nothing in the sample-only column may be presented as
approved until the authority approves it.

| Custom / item | Diaspora and Edot HaMizrach behaviour required | Status in this validation |
|---|---|---|
| Yaaleh Veyavo | On Rosh Chodesh and Chol HaMoed, in Amidah and Birkat Hamazon, as applicable | Specified in plan; sample text in scaffold; calendar dates (Rosh Chodesh day 1 list in section 7.1) are validated as dates, insertion text itself needs authority approval |
| Barech Aleinu / Varechenu | Barech Aleinu in winter per chutz laaretz custom (Diaspora start, not 7 Cheshvan as in Israel); Varechenu in summer | Specified; season switch date itself is a gate item, see open question 5 |
| Mashiv HaRuach / Morid HaGeshem / Morid HaTal | Mashiv HaRuach and Morid HaGeshem in winter season; Morid HaTal in summer season | Specified; season switch dates are a gate item, see open question 5 |
| Sefirat HaOmer | Count 1 to 49, nightly, from the second night of Pesach to Shavuot eve; shown in season only | Specified; count table is sample in scaffold, needs approved calendar source |
| Haftarot per Edot HaMizrach | Haftarah for each Shabbat and holiday per Edot HaMizrach, not Ashkenaz | Specified; haftarah list is sample in scaffold, needs approved list |
| Special Shabbatot | Shabbatot with special readings and customs, shown as such | Specified; list needs approved calendar source |
| Rosh Chodesh, Shabbat Mevarchim, Molad | Rosh Chodesh dates, Shabbat Mevarchim, and Molad shown when relevant | Rosh Chodesh day-1 dates validated as dates (section 7.1); Molad calculation itself is not validated in this task and is a gate item |
| Holidays, Diaspora | Two days of Yom Tov in Diaspora (Pesach 8, Shavuot 2, Sukkot/Shemini/Simchat Torah as in section 4.4); Rabbeinu Tam on holiday nights only if the holiday falls on Shabbat or it is Yom Kippur | Holiday dates validated in section 4.4; Yom Tov night behaviour is a display rule, not a calculation, and must be checked in the Shabbat/Yom Tov screen mode |
| Fasts | Tzom Gedalia, 10 Tevet, Taanit Esther, 17 Tammuz, 9 Av, Yom Kippur, with fast entry and exit times and related fast details | Fast dates validated in section 4.4; fast entry/exit display (Alot to Tzet Humra) is specified, full fast-detail content needs authority approval |
| Hanukkah candle lighting | Time plus number of candles per day, with animated Hanukkiah in season | Specified; candle time is sunset minus 18 on Erev Shabbat/Yom Tov only, Hanukkah lighting time itself follows the same sunset rule and needs authority confirmation that no separate Hanukkah rule applies |
| Kiddush Levana, Eruv Tavshilin | Kiddush Levana window per Edot HaMizrach custom; Eruv Tavshilin reminder when applicable | Specified; windows and reminders are display items, need approved calendar rules |

### 7.1 Rosh Chodesh day-1 dates in 5787 (validated as dates)

2026-10-12 (Heshvan 1), 2026-11-11 (Kislev 1),
2026-12-11 (Tevet 1), 2027-01-09 (Shevat 1),
2027-02-08 (Adar I 1), 2027-03-10 (Adar II 1),
2027-04-08 (Nisan 1), 2027-05-08 (Iyar 1),
2027-06-06 (Sivan 1), 2027-07-06 (Tamuz 1),
2027-08-04 (Av 1), 2027-09-03 (Elul 1).
(1 Tishrei itself is 2026-09-12, Rosh Hashana.)

## 8. Gates that must pass before go-live

- [ ] Torah authority signs this packet, including the
  rounding convention in section 3.2 and the calendar
  source in section 6, item 5.
- [ ] Elevation measured or BASE explicitly approved.
- [ ] Netz question in section 6, item 1 resolved or
  explicitly accepted as a 1-minute systematic difference.
- [ ] Dec 20 residuals in section 6, item 2 explicitly
  accepted or explained with forecast data and re-validated.
- [ ] Haftarah list, Omer count, seasonal-insertion switch
  dates, Molad, and holiday-customs board approved.
- [ ] Shabbat/Yom Tov screen mode checked: weekday-only
  items (donation QR, Zelle/payment text, weather when
  added) hidden by the system from Shabbat/Yom Tov entry
  to exit, and Rabbeinu Tam shown only where the plan
  requires it.
- [ ] No unverified time displayed live at any point
  before these gates pass. Sample/demo labeling remains
  until the authority signs.

## 9. Files delivered with this packet

- `validation/torah-approval-packet.md` — this packet.
- `validation/roy-full-year-5787.jsonl` — Roy BASE values
  for all 385 days, with production candle18 and
  production Shema Magen equal-minutes per day.
- `validation/run-roy-full-year.mjs` — full-year harness.
- `validation/shabbat-ends-full-year.json` — all 55
  Saturdays: MyZmanim Sunset and Nightfall (published
  minutes, cross-check only), our raw Sunset and Ends,
  raw and published gaps, and depression angle at
  MyZmanim nightfall.
- `validation/check-shabbat-ends-full-year.mjs` — angle
  verification script.
- `validation/validation-report.md` — prior report
  (Toldot, Dec 20, weekdays Nov 2026, Shabbat-ends module
  description), which this packet extends, not replaces.
- `src/zmanim/shabbat-ends.js` — Shabbat-ends module.
- `src/zmanim/decisions-2026-11-01.js` — binding decisions.

**Not claimed:** this packet is not an approval. Validation
is not complete until a Torah authority actually approves
it, and the site is not live, not pushed, and not done
until Hanoch confirms it on his device.
