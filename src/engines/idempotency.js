/* Idempotency, foundation requirement, 2026-11-01.
   Every financial action carries a unique operationId. A second
   submission with the same operationId must record one entry
   only, whether it is a double click on "payment received" or a
   retry after a network disconnect. This is critical for fast
   neder entry on Motzei Shabbat, where fast clicks are expected.
   The browser helper below is the mock-side check. The database
   enforcement is in src/firebase/firestore.rules: the
   operationIds collection allows create only when the id does
   not already exist, and never allows update or delete. */
(function (global) {
  function makeOperationId(prefix) {
    var stamp = Date.now().toString(36);
    var rand = Math.random().toString(36).slice(2, 10);
    return (prefix || "op") + "-" + stamp + "-" + rand;
  }
  function IdempotencyStore() {
    this.seen = {};
  }
  IdempotencyStore.prototype.tryClaim = function (operationId) {
    if (!operationId) return false;
    if (this.seen[operationId]) return false;
    this.seen[operationId] = true;
    return true;
  };
  IdempotencyStore.prototype.has = function (operationId) {
    return !!this.seen[operationId];
  };
  var api = { makeOperationId: makeOperationId, IdempotencyStore: IdempotencyStore };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.Idempotency = api;
})(typeof window !== "undefined" ? window : globalThis);
