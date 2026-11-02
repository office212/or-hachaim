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
  function totals(congregant, pledges) {
    var charges = 0, payments = 0, corrections = 0;
    var byMethod = {};
    (congregant.ledger || []).forEach(function (e) {
      if (e.type === "charge") charges += e.amount;
      if (e.type === "payment") {
        payments += e.amount;
        var m = e.method || "unspecified";
        byMethod[m] = (byMethod[m] || 0) + e.amount;
      }
      if (e.type === "correction") corrections += e.amount;
    });
    var unpaid = (pledges || []).filter(function (p) {
      return p.congregantId === congregant.id && p.status === "unpaid";
    });
    var unpaidTotal = unpaid.reduce(function (s, p) { return s + p.amount; }, 0);
    return {
      charges: charges,
      payments: payments,
      corrections: corrections,
      openBalance: charges - payments + corrections,
      unpaidPledges: unpaid,
      unpaidPledgesTotal: unpaidTotal,
      paymentsByMethod: byMethod
    };
  }
  function annualReport(congregants, pledges, year) {
    var income = 0, charges = 0, byMethod = {}, open = 0, unpaid = 0;
    congregants.forEach(function (c) {
      var t = totals(c, pledges);
      open += t.openBalance;
      unpaid += t.unpaidPledgesTotal;
      (c.ledger || []).forEach(function (e) {
        if (String(e.date).indexOf(String(year)) !== 0) return;
        if (e.type === "payment") {
          income += e.amount;
          var m = e.method || "unspecified";
          byMethod[m] = (byMethod[m] || 0) + e.amount;
        }
        if (e.type === "charge") charges += e.amount;
      });
    });
    return {
      year: year,
      totalIncome: income,
      totalCharges: charges,
      openBalances: open,
      paymentsByMethod: byMethod,
      unpaidCommitments: unpaid
    };
  }
  var api = { totals: totals, annualReport: annualReport };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.FinanceStates = api;
})(typeof window !== "undefined" ? window : globalThis);
