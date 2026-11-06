/* Or Hachaim | finance screens (src/ui/oh-fin.js), Hanoch Nov 6, from the
   approved demo. Draws into #fn on finance/:
     #home (default)  search, three big actions, this month's numbers, recent entries
     #pay / #charge   one screen: member, amount, how paid (or what for), save
     #nedarim         Shabbat nedarim: every aliyah in one table, extra rows with
                      their own name (הגבהה...), and a separate box for
                      commitments that are not aliyot (קידוש, אירוע...); one save
     #owes            who owes, largest first
     #members         every member (roles and inactive for the super admin)
     #m-<id>          member card: balance, + payment / + charge, history, cancel
     #more            the older tools (add member, tax letters, annual report, backup)
   Data: only what the page already loaded (window.cons, from loadCongregants)
   and only the existing write path, OH_FIREBASE.saveLedgerEntry, with one
   operationId per form kept until a confirmed save (a double tap or a retry
   writes ONE entry). The ledger is append-only (no edit, no delete in the
   rules), so "ביטול" writes a correction of the opposite sign whose
   description starts with "ביטול [<operationId>]"; the original stays in the
   history, marked cancelled. No rules change. A payment already reaches the
   member's bell through functions/notifications (onLedgerPayment). */
(function () {
  "use strict";
  var U = window.OH_UI;
  function T(he, en) { return window.OH_LANG === "en" ? en : he; }
  function esc(s) { return U.esc(s); }
  function money(n) { return U.money(n); }
  function fb() { return window.OH_FIREBASE; }
  function C() { return window.cons || []; }
  function M() { return window.OH_MEMBERS; }
  function today() { return U.nyDate(); }
  function usd(iso) { return U.usDate ? U.usDate(iso) : iso; }
  function md(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || "")); return m ? (+m[2]) + "/" + (+m[3]) : ""; }
  function op(prefix) { return window.Idempotency.makeOperationId(prefix); }
  function $(s) { return document.querySelector(s); }
  function isActive(c) { return !M() || M().isActive(c); }
  function isMember(c) { return !M() || M().isMember(c); }
  function listed(c) { return !M() || M().listed(c); }
  function con(id) { return C().filter(function (c) { return c.id === id; })[0]; }

  var METHODS = [["cash", "מזומן", "Cash"], ["check", "צ׳ק", "Check"], ["zelle", "Zelle", "Zelle"], ["card", "אשראי", "Card"], ["transfer", "העברה", "Transfer"]];
  function methodWord(k) { var m = METHODS.filter(function (x) { return x[0] === k; })[0]; return m ? T(m[1], m[2]) : T("לא צוין", "Not specified"); }
  var REASONS = ["נדר", "קידוש", "סעודה שלישית", "דמי חבר", "תרומה"];
  var ALIYOT = ["פתיחת ההיכל", "כהן", "לוי", "שלישי", "רביעי", "חמישי", "שישי", "שביעי", "מפטיר"];
  var EXTRA = ["הגבהה", "גלילה", "הוספה", "מי שברך", "ספר שני"];
  var KINDS = ["קידוש", "סעודה שלישית", "אירוע בבית הכנסת", "הקדשה", "תרומה כללית"];
  var VOID_RE = /^ביטול \[([^\]]+)\]/;

  var P = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  var I = {
    search: P + '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
    pay: P + '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/></svg>',
    ned: P + '<path d="M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4z"/><path d="M9 9h6M9 13h6"/></svg>',
    owe: P + '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>'
  };

  /* ---------- ledger helpers ---------- */
  function voidedIds(c) {
    var s = {};
    (c.ledger || []).forEach(function (e) { if (e.type === "correction") { var m = VOID_RE.exec(e.description || ""); if (m) s[m[1]] = true; } });
    return s;
  }
  function bal(c) { return U.ledgerTotals(c).balance; }
  function balWord(n) {
    var b = U.balanceInfo(n);
    if (b.kind === "credit") return '<span style="color:var(--ok)">' + esc(b.label) + ' <span class="fn-num">' + esc(b.amount) + "</span></span>";
    if (b.kind === "zero") return '<span style="color:var(--ok)">' + esc(b.label) + "</span>";
    return '<span class="fn-num" style="color:var(--owe)">' + money(n) + "</span>";
  }
  function lastShabbat() {
    var d = today(), p = d.split("-").map(Number), dt = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 1) % 7)); /* Saturday on or before today */
    return dt.toISOString().slice(0, 10);
  }
  /* names in the pickers: a name shared by two members carries the phone */
  function labelMap(list) {
    var count = {};
    list.forEach(function (c) { count[c.name] = (count[c.name] || 0) + 1; });
    var map = {};
    list.forEach(function (c) { var l = count[c.name] > 1 ? c.name + " · " + (c.phone || c.id) : c.name; map[l] = c.id; });
    return map;
  }

  /* ---------- state ---------- */
  var st = { view: "home", q: "", mq: "", pay: null, ned: null, member: null, busy: false };
  function viewFromHash() {
    var h = decodeURIComponent((location.hash || "").replace(/^#/, ""));
    if (/^m-/.test(h)) { st.member = h.slice(2); return "member"; }
    if (h === "pay" || h === "charge") { if (!st.pay || st.pay.kind !== (h === "pay" ? "payment" : "charge")) st.pay = newPay(h === "pay" ? "payment" : "charge", st.pay && st.pay.m); return "pay"; }
    if (h === "nedarim" || h === "owes" || h === "members" || h === "more") return h;
    if (h === "reports") return "more";
    return "home";
  }
  function go(hash) { if (("#" + hash) === location.hash) { route(); return; } location.hash = hash; }
  function route() { st.view = viewFromHash(); render(); window.scrollTo(0, 0); if (location.hash === "#reports") { var r = document.getElementById("reports"); if (r) r.scrollIntoView(); } }
  function newPay(kind, m) { return { kind: kind, m: m || null, amount: "", how: "", why: "", note: "", date: today(), showDate: false, q: "", op: op("entry"), err: "" }; }

  /* ---------- views ---------- */
  function tabs() {
    var t = [["home", T("בית", "Home")], ["pay", T("תשלום", "Payment")], ["nedarim", T("נדרים", "Nedarim")], ["owes", T("מי חייב", "Who owes")]];
    var cur = st.view === "member" || st.view === "members" || st.view === "more" ? "home" : st.view;
    return '<nav class="fn-tabs" aria-label="' + T("כספים", "Finance") + '">' + t.map(function (x) { return '<button type="button" data-go="' + x[0] + '"' + (cur === x[0] ? ' aria-current="page"' : "") + ">" + esc(x[1]) + "</button>"; }).join("") + "</nav>";
  }
  function back(to) { return '<button type="button" class="fn-back" data-go="' + (to || "home") + '">→ ' + T("חזרה", "Back") + "</button>"; }

  function home() {
    var all = C().filter(isMember), owing = all.filter(function (c) { return bal(c) > 0.004; });
    var open = owing.reduce(function (a, c) { return a + U.cents(bal(c)); }, 0) / 100;
    var month = today().slice(0, 7), got = 0, recent = [];
    C().forEach(function (c) {
      var v = voidedIds(c);
      (c.ledger || []).forEach(function (e) {
        if (e.type === "payment" && String(e.date).slice(0, 7) === month && !v[e.operationId]) got += U.cents(e.amount);
        recent.push({ c: c, e: e, voided: !!v[e.operationId] });
      });
    });
    recent.sort(function (a, b) { return a.e.date < b.e.date ? 1 : a.e.date > b.e.date ? -1 : (b.e._new || 0) - (a.e._new || 0); });
    var h = '<div class="fn-search">' + I.search + '<input id="fnQ" type="search" autocomplete="off" placeholder="' + T("חיפוש מתפלל, לפי שם או טלפון", "Find a member, by name or phone") + '" value="' + esc(st.q) + '" aria-label="' + T("חיפוש מתפלל", "Find a member") + '"></div>';
    h += '<div id="fnRes">' + results() + "</div>";
    h += '<div class="fn-acts">' +
      '<button type="button" class="fn-act fn-primary" data-go="pay"><span class="fn-ic">' + I.pay + "</span><span><b>" + T("רישום תשלום", "Record a payment") + "</b><span>" + T("שם, סכום, איך שילם", "Name, amount, how paid") + "</span></span></button>" +
      '<button type="button" class="fn-act" data-go="nedarim"><span class="fn-ic">' + I.ned + "</span><span><b>" + T("נדרי שבת", "Shabbat nedarim") + "</b><span>" + T("כל העליות וההתחייבויות, שמירה אחת", "All aliyot and pledges, one save") + "</span></span></button>" +
      '<button type="button" class="fn-act" data-go="owes"><span class="fn-ic">' + I.owe + "</span><span><b>" + T("מי חייב", "Who owes") + "</b><span>" + owing.length + " " + T("מתפללים · מהיתרה הגדולה לקטנה", "members · largest first") + "</span></span></button></div>";
    h += '<div class="fn-stats"><div class="fn-stat"><div class="fn-v fn-num">' + money(got / 100) + '</div><div class="fn-k">' + T("נגבה החודש", "Collected this month") + '</div></div>' +
      '<div class="fn-stat"><div class="fn-v fn-num">' + money(open) + '</div><div class="fn-k">' + T("פתוח לגבייה", "Open to collect") + '</div></div>' +
      '<div class="fn-stat"><div class="fn-v fn-num">' + owing.length + '</div><div class="fn-k">' + T("מתפללים עם יתרה", "Members with a balance") + "</div></div></div>";
    h += "<h2>" + T("רישומים אחרונים", "Recent entries") + '</h2><div class="fn-list">' + (recent.length ? recent.slice(0, 6).map(function (r) { return entryRow(r.c, r.e, r.voided, true); }).join("") : '<div class="fn-empty">' + T("אין עדיין רישומים", "No entries yet") + "</div>") + "</div>";
    h += '<div class="fn-chips" style="margin-top:16px"><button type="button" class="fn-chip" data-go="members">' + T("כל המתפללים", "All members") + " (" + C().filter(listed).length + ')</button><button type="button" class="fn-chip" data-go="more">' + T("עוד: הוספת מתפלל, קבלות מס, דוח שנתי, גיבוי", "More: add member, tax letters, annual report, backup") + "</button></div>";
    return h;
  }
  function results() {
    var q = st.q.trim().toLowerCase(); if (!q) return "";
    var digits = q.replace(/\D/g, "");
    var r = C().filter(listed).filter(function (c) { return String(c.name || "").toLowerCase().indexOf(q) >= 0 || (digits.length >= 3 && String(c.phone || "").replace(/\D/g, "").indexOf(digits) >= 0); }).slice(0, 6);
    if (!r.length) return '<div class="fn-list" style="margin-top:8px"><div class="fn-empty">' + T("לא נמצא מתפלל כזה", "No member found") + "</div></div>";
    return '<div class="fn-list" style="margin-top:8px">' + r.map(memberRow).join("") + "</div>";
  }
  function memberRow(c) {
    var b = bal(c);
    return '<button type="button" class="fn-rowbtn" data-go="m-' + esc(c.id) + '"><div class="fn-row"><div class="fn-grow"><div class="fn-t">' + esc(c.name) + (isActive(c) ? "" : ' <span class="fn-pill">' + T("לא פעיל", "Inactive") + "</span>") + '</div><div class="fn-d fn-num" style="text-align:right">' + esc(c.phone || "") + '</div></div><div class="fn-amt">' + (b > 0.004 ? '<span class="fn-num fn-owe fn-amt">' + money(b) + "</span>" : '<span class="fn-pill fn-ok">' + esc(U.balanceInfo(b).label) + (U.balanceInfo(b).kind === "credit" ? " " + esc(U.balanceInfo(b).amount) : "") + "</span>") + "</div></div></button>";
  }
  function typeWord(e) { return e.type === "payment" ? T("תשלום", "Payment") : e.type === "charge" ? T("חיוב", "Charge") : (VOID_RE.test(e.description || "") ? T("ביטול רישום", "Cancellation") : T("תיקון", "Correction")); }
  function entryDesc(e) {
    if (e.type === "payment") return methodWord(e.method) + (e.description ? " · " + e.description : "");
    if (e.type === "correction" && VOID_RE.test(e.description || "")) return String(e.description).replace(VOID_RE, "").replace(/^:\s*/, "");
    return e.description || "";
  }
  function entryRow(c, e, voided, withName, canVoid) {
    var cls = e.type === "payment" ? "fn-pay" : "";
    var sign = e.type === "payment" ? "−" : (e.type === "correction" ? (e.amount < 0 ? "−" : "+") : "+");
    return '<div class="fn-row' + (voided ? " fn-void" : "") + '"><div class="fn-grow"><div class="fn-t">' + (withName ? esc(c.name) : esc(typeWord(e))) + '</div><div class="fn-d">' + (withName ? esc(typeWord(e)) + " · " : "") + esc(entryDesc(e)) + ' · <span class="fn-num">' + esc(md(e.date)) + "</span>" + (voided ? ' · <span class="fn-pill">' + T("בוטל", "Cancelled") + "</span>" : "") + '</div></div><div class="fn-amt fn-num ' + cls + '">' + sign + money(Math.abs(e.amount)) + "</div>" +
      (canVoid && !voided && e.type !== "correction" ? '<button type="button" class="fn-btn fn-ghost fn-sm" data-void="' + esc(e.operationId) + '" data-cid="' + esc(c.id) + '">' + T("ביטול", "Cancel") + "</button>" : "") + "</div>";
  }

  function pay() {
    var p = st.pay || (st.pay = newPay("payment"));
    var isPay = p.kind === "payment", c = p.m && con(p.m), amt = Number(p.amount) || 0;
    var h = back(c && st.from === "member" ? "m-" + c.id : "home");
    h += "<h1>" + (isPay ? T("רישום תשלום", "Record a payment") : T("רישום חיוב", "Record a charge")) + '</h1><p class="fn-sub">' + (isPay ? T("מתפלל, סכום, ואיך שילם.", "Member, amount, and how they paid.") : T("מתפלל, סכום, ועל מה.", "Member, amount, and what it is for.")) + "</p>";
    h += '<div class="fn-chips" style="margin-top:0"><button type="button" class="fn-chip" data-kind="payment" aria-pressed="' + isPay + '">' + T("תשלום", "Payment") + '</button><button type="button" class="fn-chip" data-kind="charge" aria-pressed="' + !isPay + '">' + T("חיוב", "Charge") + "</button></div>";
    h += '<div class="fn-field"><label for="fnPayQ">' + T("מתפלל", "Member") + "</label>";
    if (c) h += '<div class="fn-picked"><b>' + esc(c.name) + '</b><button type="button" class="fn-btn fn-ghost fn-sm" data-unpick="1">' + T("החלף", "Change") + "</button></div>";
    else {
      var q = p.q.trim().toLowerCase(), r = q ? C().filter(isActive).filter(function (x) { return String(x.name || "").toLowerCase().indexOf(q) >= 0; }).slice(0, 5) : [];
      h += '<input class="fn-input" id="fnPayQ" autocomplete="off" placeholder="' + T("התחילו להקליד שם", "Start typing a name") + '" value="' + esc(p.q) + '">';
      if (r.length) h += '<div class="fn-list" style="margin-top:6px">' + r.map(function (x) { var b = bal(x); return '<button type="button" class="fn-rowbtn" data-pick="' + esc(x.id) + '"><div class="fn-row"><div class="fn-grow fn-t">' + esc(x.name) + (x.phone ? ' <span class="fn-d fn-num">' + esc(x.phone) + "</span>" : "") + '</div><div class="fn-amt fn-num fn-owe">' + (b > 0.004 ? money(b) : "") + "</div></div></button>"; }).join("") + "</div>";
      else if (q) h += '<p class="fn-note">' + T("לא נמצא. מתפלל חדש מוסיפים ב״עוד״.", "Not found. Add a new member under More.") + "</p>";
    }
    h += "</div>";
    h += '<div class="fn-field"><label for="fnAmt">' + T("סכום", "Amount") + '</label><div class="fn-money"><span class="fn-cur">$</span><input class="fn-input fn-num" id="fnAmt" inputmode="decimal" autocomplete="off" placeholder="0" value="' + esc(p.amount) + '"></div>';
    var b0 = c ? bal(c) : 0, quick = isPay ? (b0 > 0.004 ? [Math.round(b0 * 100) / 100] : []).concat([18, 36, 180, 360]) : [18, 36, 72, 180, 360];
    h += '<div class="fn-chips">' + quick.filter(function (v, i, a) { return a.indexOf(v) === i; }).map(function (v, i) { return '<button type="button" class="fn-chip" data-amt="' + v + '">' + (isPay && b0 > 0.004 && i === 0 ? T("כל היתרה · ", "Full balance · ") : "") + '<span class="fn-num">' + money(v) + "</span></button>"; }).join("") + "</div></div>";
    if (isPay) h += '<div class="fn-field"><span class="fn-lab">' + T("איך שילם", "How paid") + '</span><div class="fn-chips">' + METHODS.map(function (m) { return '<button type="button" class="fn-chip" data-how="' + m[0] + '" aria-pressed="' + (p.how === m[0]) + '">' + esc(T(m[1], m[2])) + "</button>"; }).join("") + "</div></div>";
    else h += '<div class="fn-field"><span class="fn-lab">' + T("על מה", "What for") + '</span><div class="fn-chips">' + REASONS.map(function (x) { return '<button type="button" class="fn-chip" data-why="' + esc(x) + '" aria-pressed="' + (p.why === x) + '">' + esc(x) + "</button>"; }).join("") + "</div></div>";
    h += '<div class="fn-field"><label for="fnNote">' + (isPay ? T("הערה (לא חובה)", "Note (optional)") : T("פירוט (לא חובה)", "Details (optional)")) + '</label><input class="fn-input" id="fnNote" autocomplete="off" value="' + esc(p.note) + '" placeholder="' + (isPay ? T("למשל מספר צ׳ק", "e.g. check number") : T("למשל שם האירוע", "e.g. the event")) + '"></div>';
    if (c) {
      var after = isPay ? b0 - amt : b0 + amt;
      h += '<div class="fn-preview"><div><div class="fn-k">' + T("יתרה עכשיו", "Balance now") + '</div><div class="fn-v">' + balWord(b0) + '</div></div><div class="fn-arrow" aria-hidden="true">←</div><div><div class="fn-k">' + T("אחרי השמירה", "After saving") + '</div><div class="fn-v">' + balWord(after) + "</div></div></div>";
    }
    h += '<div class="fn-datebar"><span>' + T("תאריך: ", "Date: ") + (p.date === today() ? T("היום", "today") + ", " : "") + '<span class="fn-num">' + esc(usd(p.date)) + "</span></span>" +
      (p.showDate ? '<input type="date" id="fnDate" lang="en-US" max="' + today() + '" value="' + esc(p.date) + '" aria-label="' + T("תאריך", "Date") + '">' : '<button type="button" class="fn-btn fn-ghost fn-sm" data-showdate="1">' + T("תאריך אחר", "Other date") + "</button>") + "</div>";
    if (isPay && c) h += '<p class="fn-note">' + (c.email ? T("קבלה תגיע לפעמון של המתפלל באתר מיד עם השמירה.", "A receipt reaches the member's bell on the site as soon as it is saved.") : T("למתפלל אין חשבון באתר (אין מייל), אז הקבלה רק להדפסה.", "This member has no site account (no email), so the receipt is for printing only.")) + "</p>";
    var ok = c && amt > 0 && (isPay ? p.how : p.why);
    var why = !c ? T("בחרו מתפלל", "Choose a member") : !(amt > 0) ? T("הקלידו סכום", "Enter an amount") : isPay ? T("בחרו איך שילם", "Choose how paid") : T("בחרו על מה", "Choose what for");
    h += '<div style="margin-top:14px"><button type="button" class="fn-btn fn-primary fn-block" id="fnSave"' + (ok && !st.busy ? "" : " disabled") + ">" + (st.busy ? T("שומר...", "Saving...") : ok ? (isPay ? T("שמור תשלום ", "Save payment ") : T("שמור חיוב ", "Save charge ")) + '<span class="fn-num">' + money(amt) + "</span>" : why) + "</button></div>";
    if (p.err) h += '<div class="fn-msg fn-err" role="alert">' + esc(p.err) + "</div>";
    return h;
  }

  function newNed() {
    return { date: lastShabbat(), rows: ALIYOT.map(function (a) { return { al: a, name: "", amount: "", op: op("neder") }; }), pl: [{ what: "", name: "", amount: "", op: op("pledge") }], step: "edit", err: "" };
  }
  function nedLines(n) {
    return n.rows.map(function (r, i) { return { src: "rows", i: i, kind: "neder", al: (r.al || "").trim(), name: r.name.trim(), amount: r.amount, op: r.op, saved: r.saved }; })
      .concat(n.pl.map(function (r, i) { return { src: "pl", i: i, kind: "pledge", al: (r.what || "").trim(), name: r.name.trim(), amount: r.amount, op: r.op, saved: r.saved }; }));
  }
  function lineReady(l) { return l.name && Number(l.amount) > 0 && l.al; }
  function nedarim() {
    var n = st.ned || (st.ned = newNed());
    var active = C().filter(isActive), map = labelMap(active);
    var lines = nedLines(n), ready = lines.filter(lineReady), total = ready.reduce(function (a, l) { return a + U.cents(Number(l.amount)); }, 0) / 100;
    var h = back("home") + "<h1>" + T("נדרי שבת", "Shabbat nedarim") + '</h1><p class="fn-sub">' + T("שם וסכום ליד כל עלייה, שמירה אחת בסוף.", "A name and amount next to each aliyah, one save at the end.") + "</p>";
    if (n.step === "done") {
      return h + '<div class="fn-preview" style="background:var(--ok-soft)"><div><div class="fn-k">' + T("נשמרו", "Saved") + '</div><div class="fn-v">' + n.saved + " " + T("רישומים", "entries") + ' · <span class="fn-num">' + money(n.savedTotal) + "</span></div></div></div>" +
        '<p class="fn-note">' + T("כל נדר והתחייבות נרשמו כחיוב בכרטיס של המתפלל, עם הפירוט.", "Each neder and pledge is a charge on the member's card, with its details.") + '</p><div class="fn-two"><button type="button" class="fn-btn" data-go="owes">' + T("מי חייב", "Who owes") + '</button><button type="button" class="fn-btn fn-primary" data-nednew="1">' + T("שבת אחרת", "Another Shabbat") + "</button></div>";
    }
    h += '<div class="fn-datebar" style="margin-top:0"><label for="fnNedDate">' + T("תאריך השבת", "Shabbat date") + '</label><input type="date" id="fnNedDate" lang="en-US" max="' + today() + '" value="' + esc(n.date) + '"></div>';
    if (n.step === "confirm") {
      return h + "<h2>" + T("לבדוק לפני שמירה", "Check before saving") + '</h2><div class="fn-list">' + ready.map(function (l) {
        return '<div class="fn-row"><div class="fn-grow"><div class="fn-t">' + esc(l.name) + '</div><div class="fn-d">' + (l.kind === "neder" ? T("נדר", "Neder") : T("התחייבות", "Pledge")) + " · " + esc(l.al) + (l.saved ? ' · <span class="fn-pill fn-ok">' + T("נשמר", "Saved") + "</span>" : "") + '</div></div><div class="fn-amt fn-num">' + money(Number(l.amount)) + "</div></div>"; }).join("") + "</div>" +
        '<div class="fn-total"><span>' + T("סה״כ", "Total") + '</span><span class="fn-v fn-num">' + money(total) + "</span></div>" +
        (n.err ? '<div class="fn-msg fn-err" role="alert">' + esc(n.err) + "</div>" : "") +
        '<div class="fn-two"><button type="button" class="fn-btn" data-nedstep="edit"' + (st.busy ? " disabled" : "") + ">" + T("חזרה לעריכה", "Back to editing") + '</button><button type="button" class="fn-btn fn-primary" id="fnNedSave"' + (st.busy ? " disabled" : "") + ">" + (st.busy ? T("שומר...", "Saving...") : T("אשר ושמור ", "Confirm and save ") + ready.filter(function (l) { return !l.saved; }).length) + "</button></div>";
    }
    h += '<datalist id="fnNames">' + Object.keys(map).map(function (l) { return '<option value="' + esc(l) + '">'; }).join("") + "</datalist>";
    h += '<datalist id="fnExtras">' + EXTRA.map(function (x) { return '<option value="' + esc(x) + '">'; }).join("") + '</datalist><datalist id="fnKinds">' + KINDS.map(function (x) { return '<option value="' + esc(x) + '">'; }).join("") + "</datalist>";
    h += "<h2>" + T("עליות", "Aliyot") + '</h2><div class="fn-list">' + n.rows.map(function (r, i) {
      var f = lineReady(nedLines(n)[i]);
      var lab = r.custom ? '<input class="fn-lab" list="fnExtras" data-ni="' + i + '" data-k="al" placeholder="' + T("על מה?", "What for?") + '" value="' + esc(r.al) + '" aria-label="' + T("שם השורה, למשל הגבהה", "Row name, e.g. hagbaha") + '">' : '<div class="fn-al">' + esc(r.al) + "</div>";
      return '<div class="fn-ned' + (f ? " fn-filled" : "") + (r.saved ? " fn-saved" : "") + '">' + lab + '<input list="fnNames" data-ni="' + i + '" data-k="name" autocomplete="off" placeholder="' + T("שם", "Name") + '" value="' + esc(r.name) + '" aria-label="' + T("שם המתפלל, ", "Member name, ") + esc(r.al || T("שורה נוספת", "extra row")) + '"><input class="fn-a fn-num" inputmode="decimal" autocomplete="off" data-ni="' + i + '" data-k="amount" placeholder="$" value="' + esc(r.amount) + '" aria-label="' + T("סכום, ", "Amount, ") + esc(r.al || T("שורה נוספת", "extra row")) + '"></div>';
    }).join("") + "</div>";
    h += '<button type="button" class="fn-btn fn-ghost fn-sm" data-addrow="1" style="margin-top:6px">+ ' + T("שורה נוספת (הגבהה, גלילה, מי שברך…)", "Another row (hagbaha, gelila, mi sheberach…)") + "</button>";
    h += '<div class="fn-box"><div class="fn-box-h"><b>' + T("התחייבויות ותרומות", "Pledges and donations") + "</b><p>" + T("מה שלא עלייה: קידוש, סעודה שלישית, אירוע בבית הכנסת. נרשם בכרטיס עם הפירוט.", "Not an aliyah: kiddush, seudah shlishit, an event in the shul. Recorded on the card with the details.") + "</p></div>" +
      n.pl.map(function (r, i) {
        var f = lineReady({ name: r.name.trim(), amount: r.amount, al: (r.what || "").trim() });
        return '<div class="fn-pl' + (f ? " fn-filled" : "") + (r.saved ? " fn-saved" : "") + '"><input class="fn-what" list="fnKinds" data-pi="' + i + '" data-k="what" autocomplete="off" placeholder="' + T("פירוט: קידוש, אירוע, הקדשה…", "Details: kiddush, event, dedication…") + '" value="' + esc(r.what) + '" aria-label="' + T("פירוט ההתחייבות", "Pledge details") + '">' +
          ((r.what || "").trim() ? "" : '<div class="fn-kinds">' + KINDS.slice(0, 3).map(function (k) { return '<button type="button" class="fn-chip" data-kindchip="' + esc(k) + '" data-pk="' + i + '">' + esc(k) + "</button>"; }).join("") + "</div>") +
          '<input list="fnNames" data-pi="' + i + '" data-k="name" autocomplete="off" placeholder="' + T("שם המתפלל", "Member name") + '" value="' + esc(r.name) + '" aria-label="' + T("שם המתפלל", "Member name") + '"><input class="fn-a fn-num" inputmode="decimal" autocomplete="off" data-pi="' + i + '" data-k="amount" placeholder="$" value="' + esc(r.amount) + '" aria-label="' + T("סכום", "Amount") + '"></div>';
      }).join("") + '<div style="padding:4px 10px 10px"><button type="button" class="fn-btn fn-ghost fn-sm" data-addpl="1">+ ' + T("התחייבות נוספת", "Another pledge") + "</button></div></div>";
    var unknown = lines.filter(function (l) { return l.name && !map[l.name]; });
    var nolab = lines.filter(function (l) { return l.name && Number(l.amount) > 0 && !l.al; });
    var noamt = lines.filter(function (l) { return l.name && !(Number(l.amount) > 0); });
    if (unknown.length) h += '<p class="fn-note fn-warnline">' + T("לא מכיר את: ", "Not found: ") + unknown.map(function (l) { return esc(l.name); }).join(", ") + T(". בחרו מהרשימה שנפתחת בהקלדה, או הוסיפו מתפלל ב״עוד״.", ". Pick from the list that opens as you type, or add the member under More.") + "</p>";
    if (nolab.length) h += '<p class="fn-note fn-warnline">' + T("חסר פירוט (על מה) ב־", "Missing details in ") + nolab.length + T(" שורות.", " rows.") + "</p>";
    if (noamt.length) h += '<p class="fn-note fn-warnline">' + T("חסר סכום ליד: ", "Missing amount next to: ") + noamt.map(function (l) { return esc(l.name); }).join(", ") + "</p>";
    var bad = unknown.length || nolab.length || noamt.length;
    h += '<div class="fn-total"><span>' + ready.length + " " + T("רישומים", "entries") + '</span><span class="fn-v fn-num">' + money(total) + "</span></div>";
    h += '<div style="margin-top:12px"><button type="button" class="fn-btn fn-primary fn-block" data-nedstep="confirm"' + (ready.length && !bad ? "" : " disabled") + ">" + T("המשך לבדיקה", "Continue to check") + "</button></div>";
    return h;
  }

  function owes() {
    var list = C().filter(isMember).map(function (c) {
      var v = voidedIds(c), last = (c.ledger || []).filter(function (e) { return e.type === "payment" && !v[e.operationId]; }).map(function (e) { return e.date; }).sort().pop();
      return { c: c, b: bal(c), last: last };
    }).filter(function (x) { return x.b > 0.004; }).sort(function (a, b) { return b.b - a.b; });
    var total = list.reduce(function (a, x) { return a + U.cents(x.b); }, 0) / 100;
    return back("home") + "<h1>" + T("מי חייב", "Who owes") + '</h1><p class="fn-sub">' + list.length + " " + T("מתפללים", "members") + ' · <span class="fn-num">' + money(total) + "</span> " + T("פתוח", "open") + "</p>" +
      '<div class="fn-list">' + (list.length ? list.map(function (x) {
        return '<button type="button" class="fn-rowbtn" data-go="m-' + esc(x.c.id) + '"><div class="fn-row"><div class="fn-grow"><div class="fn-t">' + esc(x.c.name) + (isActive(x.c) ? "" : ' <span class="fn-pill">' + T("לא פעיל", "Inactive") + "</span>") + '</div><div class="fn-d">' + (x.c.phone ? '<span class="fn-num">' + esc(x.c.phone) + "</span> · " : "") + (x.last ? T("תשלום אחרון ", "Last payment ") + '<span class="fn-num">' + esc(usd(x.last)) + "</span>" : T("עוד לא שילם", "No payment yet")) + '</div></div><div class="fn-amt fn-num fn-owe">' + money(x.b) + "</div></div></button>";
      }).join("") : '<div class="fn-empty">' + T("אין חובות פתוחים ✓", "No open balances ✓") + "</div>") + "</div>";
  }

  function members() {
    var q = st.mq.trim().toLowerCase();
    var list = C().filter(listed).filter(function (c) { return !q || String(c.name || "").toLowerCase().indexOf(q) >= 0; }).sort(function (a, b) { return String(a.name).localeCompare(String(b.name), "he"); });
    return back("home") + "<h1>" + T("כל המתפללים", "All members") + '</h1><div class="fn-search">' + I.search + '<input id="fnMQ" type="search" autocomplete="off" placeholder="' + T("סינון לפי שם", "Filter by name") + '" value="' + esc(st.mq) + '" aria-label="' + T("סינון לפי שם", "Filter by name") + '"></div><div id="fnInactiveSlot"></div>' +
      '<div class="fn-list" style="margin-top:10px">' + (list.length ? list.map(memberRow).join("") : '<div class="fn-empty">' + T("אין מתפללים", "No members") + "</div>") + "</div>";
  }

  function member() {
    var c = con(st.member);
    if (!c) return back("home") + '<div class="fn-empty">' + (C().length ? T("המתפלל לא נמצא.", "Member not found.") : T("טוען...", "Loading...")) + "</div>";
    var b = bal(c), v = voidedIds(c);
    var rows = (c.ledger || []).filter(function (e) { return !(e.type === "correction" && VOID_RE.test(e.description || "")); })
      .slice().sort(function (a, z) { return a.date < z.date ? 1 : a.date > z.date ? -1 : (z._new || 0) - (a._new || 0); });
    var h = back("home") + "<h1>" + esc(c.name) + '</h1><p class="fn-sub"><span class="fn-num">' + esc(c.phone || "") + "</span>" + (c.email ? ' · <span class="fn-num">' + esc(c.email) + "</span>" : "") + "</p>";
    h += '<div class="fn-balance"><div class="fn-k">' + T("יתרה לתשלום", "Balance owed") + '</div><div class="fn-v">' + balWord(b) + "</div></div>";
    h += '<div class="fn-two"><button type="button" class="fn-btn fn-primary" data-new="payment">+ ' + T("תשלום", "Payment") + '</button><button type="button" class="fn-btn" data-new="charge">+ ' + T("חיוב", "Charge") + "</button></div>";
    if (M()) h += M().cardExtras(c);
    h += "<h2>" + T("היסטוריה", "History") + '</h2><div class="fn-list">' + (rows.length ? rows.map(function (e) { return entryRow(c, e, !!v[e.operationId], false, true); }).join("") : '<div class="fn-empty">' + T("אין עדיין רישומים", "No entries yet") + "</div>") + "</div>";
    h += '<p class="fn-note">' + T("״ביטול״ לא מוחק: נרשם ביטול, והרישום המקורי נשאר בהיסטוריה, מסומן.", "Cancel never deletes: a cancellation is recorded and the original stays in the history, marked.") + "</p>";
    h += '<div class="fn-chips" style="margin-top:12px"><button type="button" class="fn-chip" data-statement="' + esc(c.id) + '">' + T("הדפס דף חשבון", "Print statement") + '</button><button type="button" class="fn-chip" data-csv="' + esc(c.id) + '">' + T("ייצוא ל־CSV", "Export to CSV") + "</button></div>";
    return h;
  }

  /* ---------- render ---------- */
  var VIEWS = { home: home, pay: pay, nedarim: nedarim, owes: owes, members: members, member: member, more: function () { return back("home"); } };
  function render(focusSel) {
    var el = document.getElementById("fn"); if (!el) return;
    if (document.body.classList.contains("gated")) { el.innerHTML = ""; var mo = document.getElementById("fnMore"); if (mo) mo.hidden = true; return; }
    var a = document.activeElement, keep = focusSel || null, pos = null;
    if (!keep && a && el.contains(a)) {
      if (a.id) keep = "#" + a.id;
      else if (a.dataset && a.dataset.ni) keep = '[data-ni="' + a.dataset.ni + '"][data-k="' + a.dataset.k + '"]';
      else if (a.dataset && a.dataset.pi) keep = '[data-pi="' + a.dataset.pi + '"][data-k="' + a.dataset.k + '"]';
      try { pos = a.selectionStart; } catch (e) {}
    }
    el.innerHTML = tabs() + (VIEWS[st.view] || home)();
    var more = document.getElementById("fnMore"); if (more) more.hidden = st.view !== "more";
    /* the inactive toggle and join requests live in the page; they follow the view */
    var tog = document.getElementById("ohInactiveToggle"), slot = document.getElementById("fnInactiveSlot");
    if (tog) { if (slot) slot.appendChild(tog); else { var park = document.getElementById("fnPark"); if (park) park.appendChild(tog); } }
    var jr = document.getElementById("ohJoinReqs"); if (jr) jr.style.display = st.view === "home" ? "" : "none";
    if (keep) { var f = el.querySelector(keep); if (f) { f.focus(); try { if (pos != null && f.setSelectionRange) f.setSelectionRange(pos, pos); } catch (e) {} } }
  }

  /* ---------- toast, receipt ---------- */
  var toastT = null;
  function toast(html, actions) {
    clearTimeout(toastT);
    var old = document.getElementById("fnToast"); if (old) old.remove();
    var d = document.createElement("div"); d.className = "fn-toast"; d.id = "fnToast"; d.setAttribute("role", "status");
    d.innerHTML = '<div class="fn-grow">' + html + "</div>" + (actions || []).map(function (a, i) { return '<button type="button" data-t="' + i + '">' + esc(a.label) + "</button>"; }).join("");
    document.body.appendChild(d);
    d.addEventListener("click", function (ev) { var b = ev.target.closest("[data-t]"); if (!b) return; var a = actions[+b.dataset.t]; d.remove(); a.run(); });
    toastT = setTimeout(function () { d.remove(); }, 9000);
  }
  function receiptHtml(c, e) {
    return '<div class="fn-rcpt"><b>' + T("בית הכנסת אור החיים", "Or Hachaim Congregation") + '</b> · Or Hachaim Congregation<br>321 Harold St, Staten Island, NY 10314<br><br>' +
      "<b>" + T("קבלה על תשלום", "Payment receipt") + "</b><br>" + T("התקבל מאת: ", "Received from: ") + esc(c.name) + "<br>" + T("סכום: ", "Amount: ") + '<span class="fn-num">' + money(e.amount) + "</span><br>" +
      T("אמצעי תשלום: ", "Method: ") + esc(methodWord(e.method)) + "<br>" + T("תאריך: ", "Date: ") + '<span class="fn-num">' + esc(usd(e.date)) + "</span><br>" + T("מספר: ", "No.: ") + '<span class="fn-num">' + esc(e.operationId) + "</span><br>" +
      T("יתרה אחרי התשלום: ", "Balance after: ") + U.balanceInfo(bal(c)).label + (bal(c) > 0.004 ? ' <span class="fn-num">' + money(bal(c)) + "</span>" : "") + "<br><br>" + T("תודה רבה!", "Thank you!") + "</div>";
  }
  function showReceipt(c, e) {
    var d = document.createElement("dialog"); d.className = "fn-sheet";
    d.innerHTML = "<h3>" + T("קבלה", "Receipt") + "</h3>" + receiptHtml(c, e) + '<p class="fn-note" style="font-size:14px;color:#7a6f61">' + (c.email ? T("הקבלה כבר הגיעה לפעמון של המתפלל באתר.", "The receipt already reached the member's bell on the site.") : T("למתפלל אין חשבון באתר, אפשר להדפיס.", "The member has no site account; you can print it.")) + '</p><div class="fn-bar"><button type="button" class="fn-btn fn-primary" data-print="1">' + T("הדפס", "Print") + '</button><button type="button" class="fn-btn fn-ghost" data-close="1">' + T("סגור", "Close") + "</button></div>";
    document.body.appendChild(d);
    d.addEventListener("click", function (ev) {
      if (ev.target.closest("[data-print]")) { var pa = document.getElementById("printArea"); if (pa) { pa.innerHTML = receiptHtml(c, e); window.print(); } }
      if (ev.target.closest("[data-close]") || ev.target === d) { d.close(); d.remove(); }
    });
    d.addEventListener("close", function () { d.remove(); });
    if (d.showModal) d.showModal(); else d.setAttribute("open", "");
  }
  function printStatement(c) {
    var pa = document.getElementById("printArea"); if (!pa) return;
    var t = U.ledgerTotals(c), v = voidedIds(c);
    pa.innerHTML = '<div class="gold-frame"><h2>' + T("כרטיס מתפלל: ", "Member card: ") + esc(c.name) + "</h2><p>" + T("טלפון: ", "Phone: ") + esc(c.phone) + " | " + T("תאריך הדפסה: ", "Print date: ") + esc(usd(today())) + "</p>" +
      "<p>" + T("יתרה: ", "Balance: ") + esc(U.balanceInfo(t.balance).label) + " " + (t.balance > 0.004 ? money(t.balance) : "") + "</p><table><tr><th>" + T("תאריך", "Date") + "</th><th>" + T("סוג", "Type") + "</th><th>" + T("סכום", "Amount") + "</th><th>" + T("פירוט", "Details") + "</th></tr>" +
      (c.ledger || []).map(function (e) { return "<tr><td>" + esc(usd(e.date)) + "</td><td>" + esc(typeWord(e)) + (v[e.operationId] ? " (" + T("בוטל", "cancelled") + ")" : "") + "</td><td>" + money(e.amount) + "</td><td>" + esc(entryDesc(e)) + "</td></tr>"; }).join("") + "</table></div>";
    window.print();
  }

  /* ---------- saving ---------- */
  function reason(r) {
    var w = { "permission-denied": T("אין הרשאה", "No permission"), "unavailable": T("אין חיבור", "No connection"), "not-signed-in": T("לא מחובר", "Not signed in"), "invalid-amount": T("סכום לא תקין", "Invalid amount") }[r && r.reason];
    return w || (r && r.reason) || "?";
  }
  async function saveEntry(c, entry) {
    var f = fb();
    var r = (f && f.saveLedgerEntry) ? await f.saveLedgerEntry(entry) : { saved: false, reason: "test-only" };
    var ok = r.saved || r.reason === "duplicate-operationId" || r.reason === "test-only";
    if (ok && r.reason !== "duplicate-operationId" && !(c.ledger || []).some(function (e) { return e.operationId === entry.operationId; })) {
      (c.ledger = c.ledger || []).push({ date: entry.date, operationId: entry.operationId, type: entry.type, amount: entry.amount, description: entry.description || "", enteredBy: (f && f.user && f.user.email) || "", method: entry.method || "", source: entry.source || "manual", aliyah: entry.aliyah || "", _new: Date.now() });
    }
    return { ok: ok, live: !!r.saved, r: r };
  }
  function log(sentence, extra) { if (typeof window.logLine === "function") window.logLine("finance", sentence, extra); }
  async function savePay() {
    var p = st.pay, c = p && con(p.m); if (!c || st.busy) return;
    var amt = Math.round(Number(p.amount) * 100) / 100; if (!(amt > 0)) return;
    if (p.date > today()) { p.err = T("לא ניתן לבחור תאריך עתידי.", "A future date is not allowed."); render(); return; }
    var isPay = p.kind === "payment";
    var entry = { congregantId: c.id, date: p.date, type: p.kind, amount: amt, description: isPay ? p.note.trim() : (p.why + (p.note.trim() ? " · " + p.note.trim() : "")), operationId: p.op, source: "manual" };
    if (isPay && p.how) entry.method = p.how;
    st.busy = true; p.err = ""; render();
    var s = await saveEntry(c, entry);
    st.busy = false;
    if (!s.ok) { p.err = T("לא נשמר: ", "Not saved: ") + reason(s.r) + T(". לחצו שוב, זה לא יירשם פעמיים.", ". Tap again; it will not be recorded twice."); render(); return; }
    if (s.live) log("נרשם " + (isPay ? "תשלום" : "חיוב") + " של " + money(amt) + (isPay ? " (" + methodWord(p.how) + ")" : " (" + p.why + ")") + " ל" + c.name + (entry.date !== today() ? " (תאריך רטרואקטיבי: " + usd(entry.date) + ")" : ""), { code: "ledger." + p.kind, target: c.name, targetId: c.id, amount: amt });
    var saved = (c.ledger || []).filter(function (e) { return e.operationId === entry.operationId; })[0] || entry;
    var from = st.from; st.pay = null; st.from = null;
    go(from === "member" ? "m-" + c.id : "home");
    toast((isPay ? T("נרשם תשלום ", "Payment recorded ") : T("נרשם חיוב ", "Charge recorded ")) + '<span class="fn-num">' + money(amt) + "</span> · " + esc(c.name) + (!s.live ? " (" + T("תצוגה מקומית, לא נשמר", "local preview, not saved") + ")" : ""),
      [{ label: T("בטל", "Undo"), run: function () { voidEntry(c, saved, true); } }].concat(isPay ? [{ label: T("קבלה", "Receipt"), run: function () { showReceipt(c, saved); } }] : []));
  }
  async function voidEntry(c, e, skipAsk) {
    if (!c || !e || st.busy) return;
    var what = (e.type === "payment" ? T("תשלום", "payment") : T("חיוב", "charge")) + " " + money(e.amount);
    if (!skipAsk && !(await U.ask(T("לבטל את הרישום?\n", "Cancel this entry?\n") + what + " · " + usd(e.date) + (entryDesc(e) ? " · " + entryDesc(e) : "") + T("\nנרשם ביטול, והרישום המקורי נשאר בהיסטוריה מסומן.", "\nA cancellation is recorded; the original stays in the history, marked."), { ok: T("כן, לבטל", "Yes, cancel"), cancel: T("לא", "No") }))) return;
    var opId = "void-" + e.operationId; /* one cancellation per entry, ever */
    var entry = { congregantId: c.id, date: today(), type: "correction", amount: e.type === "payment" ? Math.abs(e.amount) : -Math.abs(e.amount), description: "ביטול [" + e.operationId + "]: " + (e.type === "payment" ? "תשלום" : "חיוב") + " " + money(e.amount) + (e.description ? " · " + e.description : ""), operationId: opId, source: "manual" };
    st.busy = true;
    var s = await saveEntry(c, entry);
    st.busy = false;
    if (!s.ok) { toast(T("הביטול לא נשמר: ", "The cancellation was not saved: ") + esc(reason(s.r)) + T(". נסו שוב.", ". Try again.")); return; }
    if (s.live) log("בוטל רישום: " + (e.type === "payment" ? "תשלום" : "חיוב") + " של " + money(e.amount) + " ל" + c.name, { code: "ledger.void", target: c.name, targetId: c.id, amount: e.amount });
    render(); toast(T("בוטל ✓ היתרה עודכנה", "Cancelled ✓ balance updated"));
  }
  async function saveNedarim() {
    var n = st.ned; if (!n || st.busy) return;
    if (n.date > today()) { n.err = T("תאריך השבת לא יכול להיות בעתיד.", "The Shabbat date cannot be in the future."); render(); return; }
    var map = labelMap(C().filter(isActive)), todo = nedLines(n).filter(function (l) { return lineReady(l) && !l.saved; });
    st.busy = true; n.err = ""; render();
    var failed = [];
    for (var i = 0; i < todo.length; i++) {
      var l = todo[i], c = con(map[l.name]); if (!c) { failed.push(l.name); continue; }
      var amt = Math.round(Number(l.amount) * 100) / 100;
      var entry = l.kind === "neder"
        ? { congregantId: c.id, date: n.date, type: "charge", amount: amt, description: "נדר · " + l.al, operationId: l.op, source: "neder", aliyah: l.al }
        : { congregantId: c.id, date: n.date, type: "charge", amount: amt, description: l.al, operationId: l.op, source: "manual" };
      var s = await saveEntry(c, entry);
      if (s.ok) { (l.src === "rows" ? n.rows : n.pl)[l.i].saved = true; if (s.live) log((l.kind === "neder" ? "נרשם נדר של " : "נרשמה התחייבות של ") + money(amt) + " ל" + c.name + " (" + l.al + ", שבת " + usd(n.date) + ")", { code: l.kind === "neder" ? "ledger.neder" : "ledger.pledge", target: c.name, targetId: c.id, amount: amt }); }
      else failed.push(l.name + " (" + reason(s.r) + ")");
    }
    st.busy = false;
    if (failed.length) { n.err = T("לא נשמרו: ", "Not saved: ") + failed.join(", ") + T(". השאר נשמר. לחצו שוב, מה שנשמר לא יירשם פעמיים.", ". The rest is saved. Tap again; what is saved will not be recorded twice."); render(); return; }
    var all = nedLines(n).filter(function (l) { return lineReady(l); });
    n.step = "done"; n.saved = all.length; n.savedTotal = all.reduce(function (a, l) { return a + U.cents(Number(l.amount)); }, 0) / 100;
    render(); window.scrollTo(0, 0);
  }

  /* ---------- events ---------- */
  document.addEventListener("click", function (ev) {
    var root = document.getElementById("fn"); if (!root) return;
    var t = ev.target.closest("button"); if (!t || !root.contains(t)) return;
    var d = t.dataset;
    if (d.go) { if (d.go === "pay") { st.pay = newPay("payment"); st.from = null; } go(d.go); return; }
    if (d.kind) { st.pay.kind = d.kind; render(); return; }
    if (d.new) { st.pay = newPay(d.new === "payment" ? "payment" : "charge", st.member); st.from = "member"; go(d.new === "payment" ? "pay" : "charge"); return; }
    if (d.pick) { st.pay.m = d.pick; st.pay.q = ""; render("#fnAmt"); return; }
    if (d.unpick) { st.pay.m = null; render("#fnPayQ"); return; }
    if (d.amt) { st.pay.amount = String(d.amt); render(); return; }
    if (d.how) { st.pay.how = d.how; render(); return; }
    if (d.why) { st.pay.why = d.why; render(); return; }
    if (d.showdate) { st.pay.showDate = true; render("#fnDate"); return; }
    if (t.id === "fnSave") { savePay(); return; }
    if (d.void) { var c = con(d.cid), e = c && (c.ledger || []).filter(function (x) { return x.operationId === d.void; })[0]; voidEntry(c, e, false); return; }
    if (d.statement) { var c2 = con(d.statement); if (c2) printStatement(c2); return; }
    if (d.csv) { if (typeof window.exportCSV === "function") window.exportCSV(d.csv); return; }
    if (d.addrow) { st.ned.rows.push({ al: "", name: "", amount: "", custom: true, op: op("neder") }); render('[data-ni="' + (st.ned.rows.length - 1) + '"][data-k="al"]'); return; }
    if (d.addpl) { st.ned.pl.push({ what: "", name: "", amount: "", op: op("pledge") }); render('[data-pi="' + (st.ned.pl.length - 1) + '"][data-k="what"]'); return; }
    if (d.kindchip) { st.ned.pl[+d.pk].what = d.kindchip; render('[data-pi="' + d.pk + '"][data-k="name"]'); return; }
    if (d.nedstep) { st.ned.step = d.nedstep; render(); window.scrollTo(0, 0); return; }
    if (d.nednew) { st.ned = null; render(); return; }
    if (t.id === "fnNedSave") { saveNedarim(); return; }
  });
  document.addEventListener("input", function (ev) {
    var t = ev.target, root = document.getElementById("fn"); if (!root || !root.contains(t)) return;
    if (t.id === "fnQ") { st.q = t.value; var r = document.getElementById("fnRes"); if (r) r.innerHTML = results(); return; }
    if (t.id === "fnMQ") { st.mq = t.value; render(); return; }
    if (t.id === "fnPayQ") { st.pay.q = t.value; render(); return; }
    if (t.id === "fnAmt") { st.pay.amount = t.value.replace(/[^\d.]/g, ""); render(); return; }
    if (t.id === "fnNote") { st.pay.note = t.value; return; }
    if (t.id === "fnDate") { if (/^\d{4}-\d{2}-\d{2}$/.test(t.value)) { st.pay.date = t.value; render(); } return; }
    if (t.id === "fnNedDate") { if (/^\d{4}-\d{2}-\d{2}$/.test(t.value)) { st.ned.date = t.value; } return; }
    if (t.dataset.ni !== undefined) { st.ned.rows[+t.dataset.ni][t.dataset.k] = t.dataset.k === "amount" ? t.value.replace(/[^\d.]/g, "") : t.value; render(); return; }
    if (t.dataset.pi !== undefined) { st.ned.pl[+t.dataset.pi][t.dataset.k] = t.dataset.k === "amount" ? t.value.replace(/[^\d.]/g, "") : t.value; render(); }
  });
  window.addEventListener("hashchange", route);

  window.OH_FIN = { render: function () { render(); }, _state: st, _voidedIds: voidedIds, _lastShabbat: lastShabbat };
  st.view = viewFromHash();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { render(); }); else render();
})();
