/* Or Hachaim | member yahrzeits (src/ui/oh-yahrzeit.js), Hanoch Nov 7 2026.
   A member adds a family yahrzeit on their own page (congregant/); a content
   gabbai (or the super admin) approves it on gabbai/tv/content/, and only then
   it is a public yahrzeit item on the TV, in its week, every year, exactly
   like one a gabbai adds by hand (yahrzeits/{id}, OH_SCREEN_CONTENT.save).
   Data: yahrzeitRequests/{id} = { congregantId, memberName, uid, email, nameHe,
   relation, hDay, hMonth, hYear?, status: pending | approved | declined,
   createdAt, decidedBy, decidedAt, itemId } (firestore.rules,
   match /yahrzeitRequests). The approved item's id is "yzreq-<request id>",
   so approving twice (a retry after a network drop) updates the same item.
     OH_YZ.member(el, congregant)   the member's list + form
     OH_YZ.gabbai(el)               the pending requests, approve / decline
     OH_YZ.pendingCount()           for the alerts strip */
(function () {
  "use strict";
  function E() { return window.OH_DISPLAY; }
  function U() { return window.OH_UI; }
  function fb() { return window.OH_FIREBASE; }
  function db() { var f = fb(); return f && f._db ? f._db() : null; }
  function ts() { return window.firebase.firestore.FieldValue.serverTimestamp(); }
  function esc(s) { return U().esc(s); }
  function T(he, en) { return window.OH_LANG === "en" ? en : he; }
  function dateLabel(r) { var e = E(); return e ? e.hebrewDayMonthLabel(+r.hDay, r.hMonth) : r.hDay + " " + r.hMonth; }
  var MONTHS = ["tishrei", "cheshvan", "kislev", "tevet", "shevat", "adar", "adar1", "adar2", "nisan", "iyar", "sivan", "tamuz", "av", "elul"];
  var CSS = ".ohyz{margin-top:18px}.ohyz h2{margin:0 0 4px}.ohyz .yz-help{color:#7a6f61;font-size:15px;margin:0 0 12px}" +
    ".ohyz .yz-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;padding:10px 0;border-top:1px solid rgba(180,142,86,.3)}.ohyz .yz-row:first-child{border-top:0}" +
    ".ohyz .yz-row .grow{flex:1 1 200px;min-width:0}.ohyz .yz-row b{font-size:17px}.ohyz .yz-d{color:#7a6f61;font-size:14px}" +
    ".ohyz .yz-pill{font-size:13px;font-weight:700;padding:3px 10px;border-radius:999px;background:#f4ead8;color:#6b4f22;white-space:nowrap}.ohyz .yz-pill.ok{background:#e3f1ea;color:#1d5a40}.ohyz .yz-pill.no{background:#eee;color:#555}" +
    ".ohyz .yz-form{margin-top:12px;padding:14px;border:1px solid rgba(180,142,86,.42);border-radius:14px;background:rgba(255,253,249,.9)}" +
    ".ohyz .yz-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.ohyz .yz-grid label{margin-top:8px}@media (max-width:520px){.ohyz .yz-grid{grid-template-columns:1fr 1fr}}" +
    ".ohyz .yz-btns{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}.ohyz .yz-btns .btn{width:auto;margin:0}.ohyz .yz-msg{margin:10px 0 0;font-weight:600;color:#0e2c4c}.ohyz .yz-msg.warn{color:#6b4f22}" +
    ".ohyz details{margin-top:10px}.ohyz summary{cursor:pointer;color:#7a5c32;font-weight:600}";
  function css() { if (document.getElementById("ohYzCss")) return; var s = document.createElement("style"); s.id = "ohYzCss"; s.textContent = CSS; document.head.appendChild(s); }
  function monthOptions(sel) { var e = E(); return MONTHS.map(function (m) { return '<option value="' + m + '"' + (m === sel ? " selected" : "") + ">" + esc((e ? e.MONTH_HE[m] : m) + (m === "adar" ? T(" (שנה רגילה)", " (regular year)") : "")) + "</option>"; }).join(""); }
  function dayOptions() { var e = E(); var h = '<option value="">' + T("יום", "Day") + "</option>"; for (var i = 1; i <= 30; i++) h += '<option value="' + i + '">' + esc(e ? e.hebrewNumeral(i) : i) + "</option>"; return h; }
  function statusPill(s) { return s === "approved" ? '<span class="yz-pill ok">' + T("מוצג במסך בשבוע היארצייט", "On the TV in its week") + "</span>" : s === "declined" ? '<span class="yz-pill no">' + T("לא אושר", "Not approved") + "</span>" : '<span class="yz-pill">' + T("ממתין לאישור הגבאי", "Waiting for the gabbai") + "</span>"; }

  /* ================= the member ================= */
  var M = { el: null, c: null, list: [], open: false, busy: false, msg: "", kind: "" };
  async function loadMine() {
    var f = fb(), d = db(); if (!f || !d || !f.user) return;
    try {
      var snap = await d.collection("yahrzeitRequests").where("uid", "==", f.user.uid).get();
      var out = []; snap.forEach(function (x) { var o = x.data() || {}; o.id = x.id; out.push(o); });
      out.sort(function (a, b) { return String(a.nameHe).localeCompare(String(b.nameHe), "he"); });
      M.list = out;
    } catch (e) { M.msg = T("לא הצלחנו לטעון את היארצייטים.", "Couldn't load the yahrzeits."); M.kind = "warn"; }
    paintMember();
  }
  function paintMember() {
    if (!M.el) return;
    var h = '<section class="gold-frame ohyz" id="ohYzMember"><h2>' + T("יארצייטים של המשפחה", "Family yahrzeits") + '</h2><p class="yz-help">' +
      T("מה שתוסיפו כאן יוצג על המסך בבית הכנסת בשבוע של היארצייט, כל שנה, אחרי שהגבאי מאשר.", "What you add here shows on the screen in the shul in the yahrzeit's week, every year, once the gabbai approves.") + "</p>";
    h += M.list.length ? M.list.map(function (r) {
      return '<div class="yz-row"><div class="grow"><b>' + esc(r.nameHe) + '</b><div class="yz-d">' + (r.relation ? esc(r.relation) + " · " : "") + esc(dateLabel(r)) + (r.hYear ? " " + esc(r.hYear) : "") + "</div></div>" + statusPill(r.status) +
        (r.status === "pending" ? ' <button type="button" class="btn secondary" style="width:auto;min-height:44px;margin:0" data-yz-cancel="' + esc(r.id) + '">' + T("בטל בקשה", "Cancel request") + "</button>" : "") + "</div>";
    }).join("") : '<p class="yz-d">' + T("עדיין לא הוספתם יארצייט.", "No yahrzeit added yet.") + "</p>";
    if (!M.open) h += '<div class="yz-btns"><button type="button" class="btn" data-yz-open="1">+ ' + T("הוספת יארצייט", "Add a yahrzeit") + "</button></div>";
    else {
      h += '<div class="yz-form" id="ohYzForm"><label for="yzName">' + T("שם הנפטר/ת", "Name of the departed") + '</label><input id="yzName" maxlength="80" placeholder="' + T("למשל: אברהם בן שרה ז״ל", "e.g. Avraham ben Sarah z\"l") + '">' +
        '<label for="yzRel">' + T("קרבה (לא חובה)", "Relation (optional)") + '</label><input id="yzRel" maxlength="40" placeholder="' + T("למשל: אבא, סבתא", "e.g. father, grandmother") + '">' +
        '<div class="yz-grid"><div><label for="yzDay">' + T("יום", "Day") + '</label><select id="yzDay">' + dayOptions() + '</select></div><div><label for="yzMonth">' + T("חודש עברי", "Hebrew month") + '</label><select id="yzMonth">' + monthOptions("tishrei") + '</select></div><div><label for="yzYear">' + T("שנה (לא חובה)", "Year (optional)") + '</label><input id="yzYear" inputmode="numeric" dir="ltr" maxlength="4" placeholder="5770"></div></div>' +
        "<details><summary>" + T("יש רק תאריך לועזי? חישוב התאריך העברי", "Only a regular date? Work out the Hebrew date") + '</summary><label for="yzGreg">' + T("תאריך הפטירה הלועזי", "Date of passing") + '</label><input type="date" id="yzGreg" lang="en-US">' +
        '<label style="display:flex;gap:8px;align-items:center;font-weight:600"><input type="checkbox" id="yzAfter"> ' + T("נפטר/ה אחרי השקיעה", "Passed away after sunset") + '</label><button type="button" class="btn secondary" style="width:auto;margin-top:8px" data-yz-calc="1">' + T("חשב", "Work it out") + "</button></details>" +
        '<div class="yz-btns"><button type="button" class="btn" data-yz-send="1"' + (M.busy ? " disabled" : "") + ">" + (M.busy ? T("שולח...", "Sending...") : T("שלח לגבאי לאישור", "Send to the gabbai")) + '</button><button type="button" class="btn secondary" data-yz-close="1">' + T("ביטול", "Cancel") + "</button></div></div>";
    }
    if (M.msg) h += '<p class="yz-msg' + (M.kind === "warn" ? " warn" : "") + '" role="status">' + esc(M.msg) + "</p>";
    h += "</section>";
    M.el.innerHTML = h;
  }
  async function sendMine() {
    var f = fb(), d = db(), $ = function (id) { return document.getElementById(id); };
    var name = $("yzName").value.trim(), rel = $("yzRel").value.trim(), day = parseInt($("yzDay").value, 10), month = $("yzMonth").value, yr = $("yzYear").value.trim();
    if (name.length < 2) { M.msg = T("כתבו את שם הנפטר/ת.", "Write the name."); M.kind = "warn"; return keepForm(); }
    if (!(day >= 1 && day <= 30) || MONTHS.indexOf(month) < 0) { M.msg = T("בחרו יום וחודש עברי.", "Choose the Hebrew day and month."); M.kind = "warn"; return keepForm(); }
    if (yr && !/^5[5-9]\d\d$/.test(yr)) { M.msg = T("השנה העברית בארבע ספרות, למשל 5770.", "The Hebrew year has four digits, e.g. 5770."); M.kind = "warn"; return keepForm(); }
    if (!f || !d || !f.user || !M.c) { M.msg = T("צריך להתחבר קודם.", "Sign in first."); M.kind = "warn"; return keepForm(); }
    var doc = { congregantId: M.c.id, memberName: String(M.c.name || "").slice(0, 80), uid: f.user.uid, email: f.user.email, nameHe: name.slice(0, 80), hDay: day, hMonth: month, status: "pending", createdAt: ts() };
    if (rel) doc.relation = rel.slice(0, 40);
    if (yr) doc.hYear = parseInt(yr, 10);
    M.busy = true; keepForm();
    try {
      await d.collection("yahrzeitRequests").add(doc);
      M.busy = false; M.open = false; M.msg = T("נשלח ✓ הגבאי יאשר, ואז זה יוצג במסך בשבוע היארצייט.", "Sent ✓ Once the gabbai approves, it shows on the TV in its week."); M.kind = "";
      await loadMine();
    } catch (e) {
      M.busy = false; M.msg = T("לא נשלח. נסו שוב.", "Not sent. Try again."); M.kind = "warn"; keepForm();
    }
  }
  /* repaint without losing what the member typed */
  function keepForm() {
    var ids = ["yzName", "yzRel", "yzDay", "yzMonth", "yzYear"], v = {};
    ids.forEach(function (id) { var x = document.getElementById(id); if (x) v[id] = x.value; });
    paintMember();
    ids.forEach(function (id) { var x = document.getElementById(id); if (x && v[id] != null) x.value = v[id]; });
  }

  /* ================= the gabbai ================= */
  var G = { el: null, list: [], busy: false, msg: "", kind: "" };
  async function loadPending() {
    var d = db(); if (!d) return [];
    var snap = await d.collection("yahrzeitRequests").where("status", "==", "pending").get();
    var out = []; snap.forEach(function (x) { var o = x.data() || {}; o.id = x.id; out.push(o); });
    return out;
  }
  async function refreshGabbai() { try { G.list = await loadPending(); } catch (e) { G.list = []; } paintGabbai(); }
  function paintGabbai() {
    if (!G.el) return;
    if (!G.list.length && !G.msg) { G.el.hidden = true; G.el.innerHTML = ""; return; }
    G.el.hidden = false;
    var h = '<div class="gold-frame ohyz" id="yz"><h2>' + T("בקשות יארצייט ממתפללים", "Yahrzeit requests from members") + " (" + G.list.length + ')</h2><p class="yz-help">' + T("״אשר״ מוסיף את היארצייט למסך, בשבוע שלו, כל שנה.", "Approve adds the yahrzeit to the TV, in its week, every year.") + "</p>";
    h += G.list.map(function (r) {
      return '<div class="yz-row"><div class="grow"><b>' + esc(r.nameHe) + '</b><div class="yz-d">' + esc(dateLabel(r)) + (r.hYear ? " " + esc(r.hYear) : "") + (r.relation ? " · " + esc(r.relation) : "") + " · " + T("ביקש/ה: ", "From: ") + esc(r.memberName || r.email) + "</div></div>" +
        '<button type="button" class="btn" style="width:auto;min-height:44px;margin:0" data-yz-approve="' + esc(r.id) + '"' + (G.busy ? " disabled" : "") + ">" + T("אשר והצג במסך", "Approve") + '</button><button type="button" class="btn secondary" style="width:auto;min-height:44px;margin:0" data-yz-decline="' + esc(r.id) + '"' + (G.busy ? " disabled" : "") + ">" + T("לא לאשר", "Decline") + "</button></div>";
    }).join("");
    if (G.msg) h += '<p class="yz-msg' + (G.kind === "warn" ? " warn" : "") + '" role="status">' + esc(G.msg) + "</p>";
    G.el.innerHTML = h + "</div>";
  }
  async function decide(id, ok) {
    var f = fb(), d = db(), SC = window.OH_SCREEN_CONTENT, r = G.list.filter(function (x) { return x.id === id; })[0];
    if (!r || !f || !d || G.busy) return;
    if (!(await U().ask(ok ? T("להציג במסך את היארצייט של ", "Show on the TV the yahrzeit of ") + r.nameHe + " (" + dateLabel(r) + ")?" : T("לא לאשר את היארצייט של ", "Decline the yahrzeit of ") + r.nameHe + "?", { ok: ok ? T("אשר", "Approve") : T("לא לאשר", "Decline"), cancel: T("ביטול", "Cancel") }))) return;
    G.busy = true; G.msg = ""; paintGabbai();
    try {
      var upd = { status: ok ? "approved" : "declined", decidedBy: f.user.email, decidedAt: ts() };
      if (ok) {
        var yz = { nameHe: r.nameHe, hDay: +r.hDay, hMonth: r.hMonth }; if (r.hYear) yz.hYear = +r.hYear;
        var s = await SC.save({ id: "yzreq-" + r.id, type: "yahrzeit", status: "published", yahrzeit: yz, startDate: "", endDate: "" }, "publish");
        if (!s || !s.saved) throw new Error((s && (s.reason || (s.errors || []).join(", "))) || "save-failed");
        upd.itemId = s.id;
      }
      await d.collection("yahrzeitRequests").doc(r.id).update(upd);
      try { if (f.logActivity) f.logActivity((ok ? "אושר יארצייט ממתפלל: " : "לא אושר יארצייט ממתפלל: ") + r.nameHe + " (" + dateLabel(r) + ", " + (r.memberName || r.email) + ")", "", { area: "screen", code: ok ? "yahrzeit.approve" : "yahrzeit.decline" }); } catch (e) {}
      G.msg = ok ? T("אושר ✓ מוצג במסך בשבוע היארצייט.", "Approved ✓ on the TV in its week.") : T("לא אושר.", "Declined."); G.kind = "";
    } catch (e) {
      G.msg = T("לא נשמר: ", "Not saved: ") + (e && e.message ? e.message : e) + T(". נסו שוב.", ". Try again."); G.kind = "warn";
    }
    G.busy = false; await refreshGabbai();
    if (window.OH_CONTENT_EDITOR_RELOAD) try { window.OH_CONTENT_EDITOR_RELOAD(); } catch (e) {}
  }

  /* ---------- events ---------- */
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest("button"); if (!b || !b.closest(".ohyz")) return;
    var a;
    if (b.hasAttribute("data-yz-open")) { M.open = true; M.msg = ""; paintMember(); var n = document.getElementById("yzName"); if (n) n.focus(); return; }
    if (b.hasAttribute("data-yz-close")) { M.open = false; M.msg = ""; paintMember(); return; }
    if (b.hasAttribute("data-yz-send")) { sendMine(); return; }
    if (b.hasAttribute("data-yz-calc")) {
      var e = E(), g = document.getElementById("yzGreg").value;
      if (!e || !e.isDateKey(g)) { M.msg = T("בחרו תאריך.", "Choose a date."); M.kind = "warn"; return keepForm(); }
      var h = e.hebParts(document.getElementById("yzAfter").checked ? e.addDays(g, 1) : g);
      M.msg = T("התאריך העברי: ", "Hebrew date: ") + e.hebrewDayMonthLabel(h.day, h.month) + " " + h.year; M.kind = "";
      keepForm(); /* repaints with the message, keeps the name and relation */
      document.getElementById("yzDay").value = h.day; document.getElementById("yzMonth").value = h.month; document.getElementById("yzYear").value = h.year;
      return;
    }
    if ((a = b.getAttribute("data-yz-cancel"))) {
      U().ask(T("לבטל את הבקשה?", "Cancel this request?"), { ok: T("כן, לבטל", "Yes, cancel"), cancel: T("לא", "No") }).then(function (yes) {
        if (!yes) return; db().collection("yahrzeitRequests").doc(a).delete().then(function () { M.msg = T("הבקשה בוטלה.", "Request cancelled."); M.kind = ""; loadMine(); }, function () { M.msg = T("לא בוטל. נסו שוב.", "Not cancelled. Try again."); M.kind = "warn"; paintMember(); });
      });
      return;
    }
    if ((a = b.getAttribute("data-yz-approve"))) { decide(a, true); return; }
    if ((a = b.getAttribute("data-yz-decline"))) { decide(a, false); return; }
  });

  window.OH_YZ = {
    member: function (el, congregant) { if (!el) return; css(); M.el = el; M.c = congregant || null; if (!congregant) { el.innerHTML = ""; return; } paintMember(); loadMine(); },
    gabbai: function (el) { if (!el) return; css(); G.el = el; refreshGabbai(); },
    pendingCount: async function () { try { return (await loadPending()).length; } catch (e) { return 0; } }
  };
})();
