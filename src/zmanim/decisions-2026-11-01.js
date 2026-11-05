/* Decisions by Hanoch, 2026-11-01 23:06, binding for this codebase.
   These override the open questions in validation-report.md sections 3
   and 4. Do not change these values back to Roy defaults without a
   new decision from Hanoch, recorded in the plan.
   Final source rule, Hanoch 2026-11-02: Zemaneh Yosef for all
   times, except Shabbat ends (see source-rule.js). DECIDED (owner,
   binding, README "Binding decisions"): these two deviations stay
   in force over that rule. They are configurable in one place in
   source-rule.js, and the equal-minutes validation is kept.

   1. Candle lighting = 18 minutes before sunset, everywhere.
      NOT Roy default 20 minutes.
      Toldot anchor: Friday Nov 13, 2026, sunset 4:40 PM, minus 18
      minutes = candles 4:22 PM. That matches the congregation anchor
      exactly. Roy with 20 minutes gave 4:20, which is rejected.

   2. Sof Zman Shema, Magen Avraham = equal minutes (shavot),
      NOT Roy seasonal calculation.
      Toldot anchor: Saturday Nov 14, 2026, Shema Magen Avraham
      8:35 AM. Roy seasonal gave 8:38 AM, which is rejected.
      Alot Hashachar is also equal minutes, as before.
      The production times engine must implement the equal-minutes
      method for Shema Magen Avraham and be validated against the
      8:35 anchor. This file records the decision and the anchor; it
      does not invent a new equal-minutes formula, because the full
      engine calculation is validated separately against anchors.

   3. Shabbat ends is unchanged by these decisions: our own angle
      calculation, sun centre 8.5 degrees below the horizon, in
      src/zmanim/shabbat-ends.js. NOT Roy, NOT fixed minutes. */
(function () {
  var DECISIONS = {
    candleLightingMinutesBeforeSunset: 18,
    shemaMagenAvrahamMethod: "equal-minutes",
    alotMethod: "equal-minutes",
    toldotAnchors: {
      fridaySunset: "4:40 PM",
      candleLighting: "4:22 PM",
      shemaMagenAvraham: "8:35 AM"
    }
  };
  function toMinutes(timeStr) {
    var m = timeStr.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
    if (!m) throw new Error("Expected time like 4:40 PM, got: " + timeStr);
    var h = parseInt(m[1], 10);
    var min = parseInt(m[2], 10);
    if (m[3].toUpperCase() === "PM" && h !== 12) h += 12;
    if (m[3].toUpperCase() === "AM" && h === 12) h = 0;
    return h * 60 + min;
  }
  function fromMinutes(total) {
    var h = Math.floor(total / 60);
    var min = total % 60;
    var ap = h >= 12 ? "PM" : "AM";
    var h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return h12 + ":" + (min < 10 ? "0" : "") + min + " " + ap;
  }
  /* Candle lighting from a sunset time string, e.g. 4:40 PM -> 4:22 PM. */
  DECISIONS.candleLightingFromSunset = function (sunsetStr) {
    return fromMinutes(toMinutes(sunsetStr) - DECISIONS.candleLightingMinutesBeforeSunset);
  };
  if (typeof window !== "undefined") window.OR_HACHAIM_DECISIONS = DECISIONS;
  if (typeof module !== "undefined" && module.exports) module.exports = DECISIONS;
})();
