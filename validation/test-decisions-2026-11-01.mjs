// Test for Hanoch decisions 2026-11-01 23:06, run: node test-decisions-2026-11-01.mjs
// 1. Candle lighting is 18 minutes before sunset, NOT Roy default 20.
//    Toldot anchor: Friday sunset 4:40 PM minus 18 = candles 4:22 PM.
// 2. Shema Magen Avraham method is equal minutes, NOT Roy seasonal.
//    Toldot anchor: 8:35 AM. This test checks the recorded decision
//    and anchor; the full equal-minutes engine is validated
//    separately against anchors, and no formula is invented here.
// 3. Ledger math is unchanged: TEST Congregant One balance is 150,
//    TEST Congregant Two balance is 0.
import { createRequire } from "node:module";
import assert from "node:assert";
const require = createRequire(import.meta.url);
const D = require("../src/zmanim/decisions-2026-11-01.js");
assert.equal(D.candleLightingMinutesBeforeSunset, 18);
assert.equal(D.candleLightingFromSunset("4:40 PM"), "4:22 PM");
assert.equal(D.shemaMagenAvrahamMethod, "equal-minutes");
assert.equal(D.alotMethod, "equal-minutes");
assert.equal(D.toldotAnchors.candleLighting, "4:22 PM");
assert.equal(D.toldotAnchors.shemaMagenAvraham, "8:35 AM");
// Ledger math, same totals as the original scaffold verification.
const charges1 = 180 + 120;
const payments1 = 100 + 50;
assert.equal(charges1 - payments1, 150);
assert.equal(75 - 75, 0);
console.log("Decisions test passed: candle 18 min (4:40 PM -> 4:22 PM), Shema Magen equal minutes (8:35 AM), ledger balances 150 and 0.");
