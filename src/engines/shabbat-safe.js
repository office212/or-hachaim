/* Display Engine, Shabbat-safe mechanism, foundation requirement.
   Weekday-only content must be hidden by the system on Shabbat
   and Yom Tov, never by relying on a gabbai remembering to flag
   it. Rule: an item is Shabbat-safe only when it is explicitly
   marked shabbatSafe, or when it is in the known safe set
   (times, parsha, announcements without payment, dedications).
   Anything with payment, donation, QR, Zelle, or a weekday-only
   flag is NOT Shabbat-safe and is hidden automatically. Preview
   must show the Shabbat view before publishing. */
(function (global) {
  function isShabbatSafe(item) {
    if (!item) return false;
    var text = ((item.text || "") + " " + (item.title || "")).toLowerCase();
    if (item.weekdayOnly) return false;
    if (text.indexOf("payment") >= 0) return false;
    if (text.indexOf("donation qr") >= 0) return false;
    if (text.indexOf("zelle") >= 0) return false;
    if (text.indexOf("qr") >= 0) return false;
    return !!item.shabbatSafe || item.kind === "time" || item.kind === "parsha" || item.kind === "announcement" || item.kind === "dedication";
  }
  function filterForShabbat(items, isShabbatOrYomTov) {
    if (!isShabbatOrYomTov) return items;
    return items.filter(isShabbatSafe);
  }
  var api = { isShabbatSafe: isShabbatSafe, filterForShabbat: filterForShabbat };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.ShabbatSafe = api;
})(typeof window !== "undefined" ? window : globalThis);
