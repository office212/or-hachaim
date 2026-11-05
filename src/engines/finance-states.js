/* Financial Engine states, foundation requirement, 2026-11-01.
   Four states must never be conflated in code or in reports:
   - pledge: a commitment, promised, not yet a charge, not a payment.
   - charge: an amount recorded against a congregant.
   - payment: money actually received, with a payment method.
   - openBalance: charges minus payments, plus signed corrections.
     Pledges that have not become charges do NOT reduce or raise
     the open balance, and unpaid pledges are reported separately.
   A neder fast entry first creates a pledge. Only when a gabbai
   converts it does it become a charge. Only a payment entry
   records money received. */
(function (global) {
  /* Hardening (2026-11-05): every sum is done in whole cents, the same
     cents() as src/ui/oh-ui.js, so 0.1 + 0.2 is exactly 0.30. Amounts stay
     dollars with 2 decimals in the data and in what these functions return. */
  function cents(n) { var x = Number(n); return isFinite(x) ? Math.round(x * 100) : 0; }
  function totals(congregant, pledges) {
    var charges = 0, payments = 0, corrections = 0;
    var byMethod = {};
    (congregant.ledger || []).forEach(function (e) {
      if (e.type === "charge") charges += cents(e.amount);
      if (e.type === "payment") {
        payments += cents(e.amount);
        var m = e.method || "unspecified";
        byMethod[m] = (byMethod[m] || 0) + cents(e.amount);
      }
      if (e.type === "correction") corrections += cents(e.amount);
    });
    Object.keys(byMethod).forEach(function (k) { byMethod[k] = byMethod[k] / 100; });
    var unpaid = (pledges || []).filter(function (p) {
      return p.congregantId === congregant.id && p.status === "unpaid";
    });
    var unpaidTotal = unpaid.reduce(function (s, p) { return s + cents(p.amount); }, 0) / 100;
    return {
      charges: charges / 100,
      payments: payments / 100,
      corrections: corrections / 100,
      openBalance: (charges - payments + corrections) / 100,
      unpaidPledges: unpaid,
      unpaidPledgesTotal: unpaidTotal,
      paymentsByMethod: byMethod
    };
  }
  function annualReport(congregants, pledges, year) {
    var income = 0, charges = 0, byMethod = {}, open = 0, unpaid = 0;
    congregants.forEach(function (c) {
      var t = totals(c, pledges);
      open += cents(t.openBalance);
      unpaid += cents(t.unpaidPledgesTotal);
      (c.ledger || []).forEach(function (e) {
        if (String(e.date).indexOf(String(year)) !== 0) return;
        if (e.type === "payment") {
          income += cents(e.amount);
          var m = e.method || "unspecified";
          byMethod[m] = (byMethod[m] || 0) + cents(e.amount);
        }
        if (e.type === "charge") charges += cents(e.amount);
      });
    });
    Object.keys(byMethod).forEach(function (k) { byMethod[k] = byMethod[k] / 100; });
    return {
      year: year,
      totalIncome: income / 100,
      totalCharges: charges / 100,
      openBalances: open / 100,
      paymentsByMethod: byMethod,
      unpaidCommitments: unpaid / 100
    };
  }
  var api = { totals: totals, annualReport: annualReport };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.FinanceStates = api;
})(typeof window !== "undefined" ? window : globalThis);
