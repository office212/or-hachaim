/* Or Hachaim shared UI helpers (proposal 2026-11-03).
   One small file used by finance, congregant, admin and the screen:
   - esc / jsArg: every value that came from Firestore is escaped before
     it goes into innerHTML or an onclick, so a name like
     <img src=x onerror=...> shows as text and never runs as code.
   - money: amounts are summed in whole cents and shown as $1,234.50,
     so 0.1 + 0.2 never becomes 0.30000000000000004.
   - nyDate: today's date in New York, not in UTC. A payment entered
     at 9 PM on Motzei Shabbat is dated that day, not tomorrow, and a
     December 31 evening donation stays in the right tax year.
   - ledgerTotals: the totals finance and congregant pages call. It
     used to live only in test-data.js, which those pages do not load,
     so the first real congregant made both pages fail silently. */
(function (global) {
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  /* A safe JavaScript string literal inside an HTML attribute:
     onclick="showCard(' + jsArg(id) + ')" */
  function jsArg(v) { return esc(JSON.stringify(String(v == null ? "" : v))); }
  function cents(n) { var x = Number(n); return isFinite(x) ? Math.round(x * 100) : 0; }
  var usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  function money(n) { return usd.format(cents(n) / 100); }
  function nyDate(d) {
    var p = {};
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(d || new Date()).forEach(function (x) { p[x.type] = x.value; });
    return p.year + "-" + p.month + "-" + p.day;
  }
  function ledgerTotals(c) {
    var charges = 0, payments = 0, corrections = 0;
    ((c && c.ledger) || []).forEach(function (e) {
      if (e.type === "charge") charges += cents(e.amount);
      if (e.type === "payment") payments += cents(e.amount);
      if (e.type === "correction") corrections += cents(e.amount);
    });
    return { charges: charges / 100, payments: payments / 100, corrections: corrections / 100, balance: (charges - payments + corrections) / 100 };
  }
  /* Add months to a YYYY-MM-DD date, clamped to the month's last day. */
  function addMonths(ymd, n) {
    var a = String(ymd).split("-"), y = +a[0], m = +a[1] - 1 + n, d = +a[2];
    var last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    var out = new Date(Date.UTC(y, m, Math.min(d, last)));
    return out.toISOString().slice(0, 10);
  }
  /* Bilingual text "עברית / English": each side is wrapped in <bdi>, so
     the English sentence keeps its full stop on its own side inside a
     right-to-left page (no more ".history" at the start of a line).
     Runs on load and on every later change to the page. */
  var HEB = /[\u0590-\u05FF]/, LAT = /[A-Za-z]/;
  function isolateNode(node) {
    var t = node.nodeValue;
    if (!t || t.indexOf(" / ") < 0 || !HEB.test(t) || !LAT.test(t)) return;
    var first = t.split(" / ")[0];
    if (!HEB.test(first) || LAT.test(first)) return; /* only the "עברית / English" pattern */
    var p = node.parentNode;
    if (!p || /^(SCRIPT|STYLE|TEXTAREA|OPTION|BDI|TITLE)$/.test(p.nodeName)) return;
    var frag = document.createDocumentFragment();
    /* The first side stays plain, so it still decides the direction of
       the line; every later side is isolated in its own <bdi>. */
    t.split(" / ").forEach(function (part, i) {
      if (!i) { frag.appendChild(document.createTextNode(part)); return; }
      frag.appendChild(document.createTextNode(" / "));
      var b = document.createElement("bdi"); b.textContent = part; frag.appendChild(b);
    });
    p.replaceChild(frag, node);
  }
  function isolateBilingual(root) {
    if (!root || typeof document === "undefined") return;
    if (root.nodeType === 3) { isolateNode(root); return; }
    var w = document.createTreeWalker(root, 4 /* text */), list = [], n;
    while ((n = w.nextNode())) list.push(n);
    list.forEach(isolateNode);
  }
  if (typeof document !== "undefined" && typeof MutationObserver !== "undefined") {
    var start = function () {
      isolateBilingual(document.body);
      new MutationObserver(function (muts) {
        muts.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, isolateBilingual); if (m.type === "characterData") isolateNode(m.target); });
      }).observe(document.body, { childList: true, subtree: true, characterData: true });
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  }
  var api = { isolateBilingual: isolateBilingual, esc: esc, jsArg: jsArg, cents: cents, money: money, nyDate: nyDate, ledgerTotals: ledgerTotals, addMonths: addMonths };
  global.OH_UI = api;
  if (typeof global.ledgerTotals !== "function") global.ledgerTotals = ledgerTotals;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
