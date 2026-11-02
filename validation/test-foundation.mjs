/* Foundation tests, test data only. Run: node validation/test-foundation.mjs */
import { createRequire } from "node:module";
import assert from "node:assert";
const require = createRequire(import.meta.url);
const Idem = require("../src/engines/idempotency.js");
const Fin = require("../src/engines/finance-states.js");
const Safe = require("../src/engines/shabbat-safe.js");

/* Idempotency: same operationId claimed twice records once only. */
const store = new Idem.IdempotencyStore();
assert.equal(store.tryClaim("op-test-1"), true);
assert.equal(store.tryClaim("op-test-1"), false);
assert.equal(store.has("op-test-1"), true);
assert.equal(Idem.makeOperationId("neder").indexOf("neder-"), 0);

/* Finance states: pledge is not a charge and not a payment. */
const cong = {
  id: "test-1",
  ledger: [
    { type: "charge", amount: 180, date: "2026-10-05", method: "seat" },
    { type: "charge", amount: 120, date: "2026-10-20", method: "seat" },
    { type: "payment", amount: 100, date: "2026-11-01", method: "cash" },
    { type: "payment", amount: 50, date: "2026-11-01", method: "check" }
  ]
};
const pledges = [
  { congregantId: "test-1", amount: 54, status: "unpaid" },
  { congregantId: "test-1", amount: 36, status: "paid" }
];
const t = Fin.totals(cong, pledges);
assert.equal(t.charges, 300);
assert.equal(t.payments, 150);
assert.equal(t.openBalance, 150);
assert.equal(t.unpaidPledgesTotal, 54);
assert.equal(t.paymentsByMethod.cash, 100);
assert.equal(t.paymentsByMethod.check, 50);
const annual = Fin.annualReport([cong], pledges, 2026);
assert.equal(annual.totalIncome, 150);
assert.equal(annual.totalCharges, 300);
assert.equal(annual.openBalances, 150);
assert.equal(annual.unpaidCommitments, 54);

/* Shabbat-safe: payment and QR are hidden on Shabbat, times are not. */
const items = [
  { kind: "time", title: "Netz", shabbatSafe: true },
  { kind: "announcement", title: "Donation QR code", weekdayOnly: true },
  { kind: "announcement", title: "Pay with Zelle", weekdayOnly: true },
  { kind: "dedication", title: "Leilui Nishmat", shabbatSafe: true }
];
assert.equal(Safe.filterForShabbat(items, true).length, 2);
assert.equal(Safe.filterForShabbat(items, false).length, 4);
assert.equal(Safe.isShabbatSafe({ title: "Pay with Zelle" }), false);

console.log("Foundation test passed: idempotency rejects duplicates, pledge 54 is separate from open balance 150, annual income 150, Shabbat filter keeps 2 of 4 items.");
