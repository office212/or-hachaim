/* Zmanim source rule, final, Hanoch 2026-11-02.
   Use Zemaneh Yosef for ALL times, except Shabbat ends.
   Shabbat ends stays only per MyZmanim, with our own
   8.5 degree angle calculation in shabbat-ends.js.
   It is NOT a Roy value and NOT fixed minutes.
   The Zemaneh Yosef calculation code lives, unmodified,
   in royzmanim-code/. This module does not copy, alter,
   or reimplement that code. It only states the rule and
   the one place where the two configurable deviations
   live, so a single future decision can change them.

   OPEN QUESTION, not decided, do not guess:
   Hanoch has NOT yet confirmed whether "all times from
   Zemaneh Yosef" overrides the two earlier binding
   decisions in decisions-2026-11-01.js, candle 18 minutes
   and Shema Magen Avraham equal minutes, or whether
   those two decisions stay in force. Until he confirms,
   this codebase KEEPS the earlier decisions (candle 18,
   Shema equal minutes) and does NOT silently switch to
   Roy defaults (candle 20, Shema seasonal). The equal
   minutes validation in validation/ is kept, not deleted.
   To apply a future confirmation, change only the two
   fields below and record the decision in the plan.
   No other file needs a value change for these two items. */
(function () {
  var SOURCE_RULE = {
    timesSource: "Zemaneh Yosef (royzmanim-code, unmodified)",
    timesSourceScope: "all times",
    exception: "Shabbat ends only",
    shabbatEndsSource: "MyZmanim rule, our own calculation",
    shabbatEndsAngleDegrees: 8.5,
    shabbatEndsModule: "src/zmanim/shabbat-ends.js",
    shabbatEndsIsRoy: false,
    shabbatEndsIsFixedMinutes: false,
    configurableDeviations: {
      candleLightingMinutesBeforeSunset: 18,
      candleLightingRoyDefault: 20,
      shemaMagenAvrahamMethod: "equal-minutes",
      shemaMagenAvrahamRoyDefault: "seasonal",
      openQuestion: "Hanoch has not confirmed whether the final source rule overrides these two deviations. Kept as decided 2026-11-01 until he confirms."
    },
    location: {
      latitude: 40.60155,
      longitude: -74.13206,
      timezone: "America/New_York",
      address: "321 Harold St, Staten Island, NY 10314"
    },
    haskamaNote: "Haskama image received 2026-11-02 for the Zemaneh Yosef calendar itself (see validation/torah-approval-packet.md). It is NOT approval of this screen implementation."
  };
  if (typeof window !== "undefined") window.OR_HACHAIM_SOURCE_RULE = SOURCE_RULE;
  if (typeof module !== "undefined" && module.exports) module.exports = SOURCE_RULE;
})();
