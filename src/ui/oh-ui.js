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
   - balanceInfo: owed / credit ("זכות") / zero ("אין חוב ✓") wording.
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
  /* US date format (2026-11-05, Hanoch: "dates must be month first, it's America"):
     a "YYYY-MM-DD" value shown as "M/D/YYYY" everywhere in the gabbai system.
     The stored value never changes, only how it reads on screen. */
  function usDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso == null ? "" : iso));
    if (!m) return iso == null ? "" : String(iso);
    return (+m[2]) + "/" + (+m[3]) + "/" + m[1];
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
  /* Hardening (2026-11-05, Hanoch): how a balance reads, decided in whole
     cents. Owed (> 0): "יתרה לתשלום" and the amount, as before. Credit (< 0):
     "זכות:" and the amount without a minus, shown in green. Zero: "אין חוב ✓".
     Only the active language. */
  function balanceInfo(n) {
    var c = cents(n), en = global.OH_LANG === "en";
    if (c < 0) return { kind: "credit", label: en ? "Credit:" : "זכות:", amount: money(-c / 100) };
    if (c === 0) return { kind: "zero", label: en ? "No balance due ✓" : "אין חוב ✓", amount: "" };
    return { kind: "owed", label: en ? "Balance owed" : "יתרה לתשלום", amount: money(n) };
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
    if (global.OH_LANG === "en") return; /* 2040 phase 1: in English oh-i18n.js shows the English half instead */
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
  /* ask / tell (Hanoch Nov 6): the site's own question box in place of the
     browser's confirm() / alert(). ask(text, { ok, cancel }) resolves true
     or false, tell(text) resolves when closed. Each line of text is its own
     paragraph, so oh-i18n.js switches it to English like any other page text.
     A browser without <dialog> keeps the old confirm() / alert(). */
  function dialogWords() {
    var en = global.OH_LANG === "en" || (typeof document !== "undefined" && document.documentElement.classList.contains("oh-en"));
    return en ? { ok: "OK", cancel: "Cancel" } : { ok: "אישור", cancel: "ביטול" };
  }
  function dialogCss() {
    if (document.getElementById("ohDlgCss")) return;
    var s = document.createElement("style"); s.id = "ohDlgCss";
    s.textContent = ".oh-dlg{border:1px solid var(--gold,#b48e56);border-radius:18px;padding:22px 22px 18px;max-width:min(460px,calc(100vw - 32px));width:100%;background:#fffdf9;color:var(--navy,#0e2c4c);box-shadow:0 24px 60px -20px rgba(8,27,48,.55);font:inherit;font-size:17px;line-height:1.55}" +
      ".oh-dlg::backdrop{background:rgba(8,27,48,.45)}.oh-dlg p{margin:0 0 6px}.oh-dlg p:first-child{font-weight:700;font-size:18px}" +
      ".oh-dlg-acts{display:flex;gap:10px;justify-content:flex-start;flex-wrap:wrap;margin-top:18px}" +
      ".oh-dlg-acts button{font:inherit;font-weight:700;font-size:16px;min-height:46px;padding:0 22px;border-radius:12px;cursor:pointer;border:1px solid var(--gold,#b48e56);background:#fff;color:var(--navy,#0e2c4c)}" +
      ".oh-dlg-acts button.ok{background:var(--navy,#0e2c4c);color:#f6ecd6;border-color:transparent}" +
      ".oh-dlg-acts button:focus-visible{outline:3px solid rgba(180,142,86,.6);outline-offset:2px}";
    document.head.appendChild(s);
  }
  function openDialog(text, opts, withCancel) {
    var native = withCancel ? global.confirm : global.alert;
    if (typeof document === "undefined" || typeof global.HTMLDialogElement !== "function") return Promise.resolve(native.call(global, text) !== false);
    dialogCss();
    var w = dialogWords(); opts = opts || {};
    var d = document.createElement("dialog"); d.className = "oh-dlg";
    d.setAttribute("dir", document.documentElement.getAttribute("dir") || "rtl");
    String(text == null ? "" : text).split("\n").forEach(function (line) { if (!line.trim()) return; var p = document.createElement("p"); p.textContent = line; d.appendChild(p); });
    var acts = document.createElement("div"); acts.className = "oh-dlg-acts";
    var ok = document.createElement("button"); ok.type = "button"; ok.className = "ok"; ok.textContent = opts.ok || w.ok; acts.appendChild(ok);
    if (withCancel) { var no = document.createElement("button"); no.type = "button"; no.textContent = opts.cancel || w.cancel; acts.appendChild(no); }
    d.appendChild(acts); document.body.appendChild(d);
    return new Promise(function (resolve) {
      var done = false;
      function close(v) { if (done) return; done = true; try { d.close(); } catch (e) {} d.remove(); resolve(v); }
      ok.addEventListener("click", function () { close(true); });
      if (no) no.addEventListener("click", function () { close(false); });
      d.addEventListener("cancel", function (e) { e.preventDefault(); close(!withCancel); });
      try { d.showModal(); } catch (e) { d.remove(); resolve(native.call(global, text) !== false); return; }
      (withCancel ? no : ok).focus(); /* the safe choice has the focus, as with confirm() */
    });
  }
  function ask(text, opts) { return openDialog(text, opts, true); }
  function tell(text, opts) { return openDialog(text, opts, false).then(function () {}); }
  var api = { isolateBilingual: isolateBilingual, esc: esc, jsArg: jsArg, cents: cents, money: money, nyDate: nyDate, usDate: usDate, ledgerTotals: ledgerTotals, balanceInfo: balanceInfo, addMonths: addMonths, ask: ask, tell: tell };
  global.OH_UI = api;
  if (typeof global.ledgerTotals !== "function") global.ledgerTotals = ledgerTotals;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
