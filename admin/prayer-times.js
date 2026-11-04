/* Or Hachaim | prayer times manager on admin/ (stage B1).
   A simple list sorted by time, add / edit / delete, and the real /tv/ page as
   a live preview that reloads after every save.
   Data: collection prayerTimes, the same fields as before:
     nameHe, nameEn, time ("6:30 AM"), order (minutes after midnight), updatedBy, updatedAt.
   Who may do what is decided by the Firestore rules (hasScreen() for create,
   update and delete). This page only shows the section to accounts that may
   edit content, and shows a Hebrew message if the database refuses.
   All words come from src/ui/labels.js (keys pt...). Times are typed in by the
   gabbaim: nothing here computes or changes zmanim. */
(function () {
  "use strict";
  var DEF = {
    ptTitle: "זמני תפילה", ptTitleEn: "Prayer times", ptLead: "הזמנים שמופיעים במסך. מסודרים לפי השעה.",
    ptAdd: "הוסף זמן תפילה", ptEdit: "ערוך", ptDelete: "מחק",
    ptEmpty: "עוד אין זמני תפילה. לחץ על «הוסף זמן תפילה» כדי להוסיף את הראשון.",
    ptFormAddTitle: "זמן תפילה חדש", ptFormEditTitle: "עריכת זמן תפילה",
    ptNameHe: "שם התפילה", ptNameHePlaceholder: "למשל: שחרית", ptNameEn: "שם באנגלית (לא חובה)", ptNameEnPlaceholder: "English name",
    ptTime: "שעה", ptQuick: "בחירה מהירה:",
    ptQuickNames: [{ he: "שחרית", en: "Shacharit" }, { he: "מנחה", en: "Mincha" }, { he: "ערבית", en: "Maariv" }, { he: "קבלת שבת", en: "Kabbalat Shabbat" }],
    ptSave: "שמור", ptSaveEdit: "שמור שינויים", ptCancel: "ביטול",
    ptConfirmDelete: "למחוק את {name} {time}?", ptConfirmYes: "כן, למחוק", ptConfirmNo: "לא",
    ptSaving: "שומר...", ptDeleting: "מוחק...",
    ptSaved: "נשמר ✓ מופיע עכשיו על המסך", ptDeleted: "נמחק ✓ כבר לא מופיע על המסך", ptSavedSlow: "נשמר ✓ המסך יתעדכן תוך דקה",
    ptNeedName: "כתוב את שם התפילה", ptNeedTime: "בחר שעה",
    ptErrDenied: "אין לך הרשאה לפעולה הזו. פנה למנהל הראשי.",
    ptErrSave: "השמירה לא הצליחה. בדוק את החיבור לאינטרנט ונסה שוב.",
    ptErrDelete: "המחיקה לא הצליחה. בדוק את החיבור לאינטרנט ונסה שוב.",
    ptErrLoad: "לא הצלחנו לטעון את זמני התפילה. רענן את הדף.",
    ptPreviewTitle: "כך זה נראה עכשיו על המסך", ptPreviewOpen: "פתח את המסך בחלון חדש", ptPreviewNote: "התצוגה מתעדכנת אחרי כל שמירה."
  };
  function L(k) { var o = window.OH_LABELS || {}; return (o[k] !== undefined && o[k] !== null && o[k] !== "") ? o[k] : DEF[k]; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function $(id) { return document.getElementById(id); }

  /* "6:30 AM" <-> minutes after midnight <-> "06:30" (the phone time picker). */
  function minutesOf12(t) { var m = String(t || "").trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/); if (!m) return -1; var h = +m[1], mi = +m[2]; if (h < 1 || h > 12 || mi > 59) return -1; h = h % 12; if (/p/i.test(m[3])) h += 12; return h * 60 + mi; }
  function minutesOf24(v) { var m = String(v || "").match(/^(\d{1,2}):(\d{2})/); if (!m) return -1; var h = +m[1], mi = +m[2]; if (h > 23 || mi > 59) return -1; return h * 60 + mi; }
  function to12(min) { var h = Math.floor(min / 60), mi = min % 60, ap = h < 12 ? "AM" : "PM", h12 = h % 12 || 12; return h12 + ":" + (mi < 10 ? "0" : "") + mi + " " + ap; }
  function to24(min) { var h = Math.floor(min / 60), mi = min % 60; return (h < 10 ? "0" : "") + h + ":" + (mi < 10 ? "0" : "") + mi; }
  function itemMinutes(p) { var m = minutesOf12(p.time); return m >= 0 ? m : (typeof p.order === "number" ? p.order : 0); }
  function shortTime(t) { return String(t || "").replace(/\s*[AaPp][Mm]\s*$/, ""); }

  var S = { role: null, items: [], editId: null, confirmId: null, justId: null, frame: null, busy: false, built: false, msgTimer: null };

  function build() {
    if (S.built) return; S.built = true;
    var sec = $("ptSection");
    var quick = (L("ptQuickNames") || []).map(function (q, i) { return '<button type="button" class="ohpt-chip" data-q="' + i + '" aria-pressed="false">' + esc(q.he) + '</button>'; }).join("");
    sec.innerHTML =
      '<div class="ohpt-head"><div><h2 id="ptHeading">' + esc(L("ptTitle")) + '<small dir="ltr">' + esc(L("ptTitleEn")) + '</small></h2><p class="ohpt-lead">' + esc(L("ptLead")) + '</p></div>' +
      '<button type="button" class="ohpt-btn primary" id="ptAddBtn"><span class="plus" aria-hidden="true">+</span>' + esc(L("ptAdd")) + '</button></div>' +
      '<div class="ohpt-grid"><div class="ohpt-card ohpt-main">' +
      '<form id="ptForm" class="ohpt-form" hidden novalidate><h3 id="ptFormTitle"></h3>' +
      '<label for="ptNameHe">' + esc(L("ptNameHe")) + '</label><input type="text" id="ptNameHe" autocomplete="off" placeholder="' + esc(L("ptNameHePlaceholder")) + '">' +
      (quick ? '<div class="ohpt-chips" role="group" aria-label="' + esc(L("ptQuick")) + '"><span>' + esc(L("ptQuick")) + '</span>' + quick + '</div>' : '') +
      '<label for="ptNameEn">' + esc(L("ptNameEn")) + '</label><input type="text" id="ptNameEn" dir="ltr" autocomplete="off" placeholder="' + esc(L("ptNameEnPlaceholder")) + '">' +
      '<label for="ptTimeIn">' + esc(L("ptTime")) + '</label><input type="time" id="ptTimeIn" dir="ltr" step="60">' +
      '<p class="err" id="ptFormErr" role="alert"></p>' +
      '<div class="row"><button type="submit" class="ohpt-btn primary" id="ptSaveBtn"></button><button type="button" class="ohpt-btn quiet" id="ptCancelBtn">' + esc(L("ptCancel")) + '</button></div></form>' +
      '<p id="ptMsg" class="ohpt-msg" role="status" aria-live="polite"></p>' +
      '<ul id="ptList" class="ohpt-list" aria-labelledby="ptHeading"></ul></div>' +
      '<aside class="ohpt-card ohpt-pv" aria-label="' + esc(L("ptPreviewTitle")) + '"><h3><i aria-hidden="true"></i>' + esc(L("ptPreviewTitle")) + '</h3>' +
      '<div class="ohpt-tv" id="ptTv"></div><p>' + esc(L("ptPreviewNote")) + '</p>' +
      '<a class="ohpt-btn outline" href="../tv/" target="_blank" rel="noopener">' + esc(L("ptPreviewOpen")) + '</a></aside></div>';
    $("ptAddBtn").addEventListener("click", function () { openForm(null); });
    $("ptCancelBtn").addEventListener("click", closeForm);
    $("ptForm").addEventListener("submit", function (e) { e.preventDefault(); save(); });
    $("ptNameHe").addEventListener("input", syncChips);
    sec.querySelectorAll(".ohpt-chip").forEach(function (b) {
      b.addEventListener("click", function () {
        var q = (L("ptQuickNames") || [])[+b.getAttribute("data-q")]; if (!q) return;
        $("ptNameHe").value = q.he; $("ptNameEn").value = q.en || ""; syncChips(); $("ptTimeIn").focus();
      });
    });
    $("ptList").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-act]"); if (!b || S.busy) return;
      var id = b.getAttribute("data-id"), act = b.getAttribute("data-act");
      if (act === "edit") openForm(id);
      else if (act === "del") { S.confirmId = id; render(); var y = $("ptList").querySelector('button[data-act="yes"]'); if (y) y.focus(); }
      else if (act === "no") { S.confirmId = null; render(); }
      else if (act === "yes") remove(id);
    });
  }
  function syncChips() {
    var v = $("ptNameHe").value.trim();
    document.querySelectorAll("#ptSection .ohpt-chip").forEach(function (b) {
      var q = (L("ptQuickNames") || [])[+b.getAttribute("data-q")];
      b.setAttribute("aria-pressed", q && q.he === v ? "true" : "false");
    });
  }

  function startPreview() {
    if (S.frame) return;
    var box = $("ptTv"); if (!box) return;
    var f = document.createElement("iframe");
    f.title = L("ptPreviewTitle"); f.setAttribute("tabindex", "-1"); f.setAttribute("aria-hidden", "true");
    f.src = "../tv/";
    box.appendChild(f); S.frame = f;
    var fit = function () { var w = box.clientWidth; if (w) f.style.transform = "scale(" + (w / 1920) + ")"; };
    fit(); if (window.ResizeObserver) new ResizeObserver(fit).observe(box); else window.addEventListener("resize", fit);
  }
  /* Reload the real /tv/ page, then look inside it (same site) until the
     prayer list shows the change. Resolves true when seen, false after ~12 s. */
  function reloadPreview(check) {
    return new Promise(function (resolve) {
      var f = S.frame; if (!f) { resolve(false); return; }
      var done = false, started = Date.now();
      function finish(v) { if (!done) { done = true; resolve(v); } }
      function poll() {
        if (done) return;
        var txt = null;
        try { var el = f.contentDocument && f.contentDocument.getElementById("prayerList"); txt = el ? el.textContent : null; } catch (e) { txt = null; }
        if (txt !== null && check(txt)) { finish(true); return; }
        if (Date.now() - started > 12000) { finish(false); return; }
        setTimeout(poll, 300);
      }
      f.addEventListener("load", function onl() { f.removeEventListener("load", onl); setTimeout(poll, 300); });
      f.src = "../tv/?t=" + Date.now();
    });
  }

  /* The TV list is "up to date" when every saved time is on it (or, with no
     times, its empty line is). A page still loading shows neither. */
  function tvHasRow(txt, p) { return txt.indexOf(p.time) >= 0 && txt.indexOf(p.nameHe || p.nameEn || "") >= 0; }
  function tvShowsList(txt) {
    if (!S.items.length) return /אין זמני תפילה|No prayer times/.test(txt);
    return S.items.every(function (p) { return tvHasRow(txt, p); });
  }

  function render() {
    var list = $("ptList"); if (!list) return;
    var items = S.items.slice().sort(function (a, b) { return itemMinutes(a) - itemMinutes(b); });
    if (!items.length) { list.innerHTML = '<li class="ohpt-empty" id="ptEmpty">' + esc(L("ptEmpty")) + '</li>'; return; }
    list.innerHTML = items.map(function (p) {
      var id = esc(p.id), name = p.nameHe || p.nameEn || "";
      if (S.confirmId === p.id) {
        var q = String(L("ptConfirmDelete")).replace("{name}", name).replace("{time}", shortTime(p.time));
        return '<li class="ohpt-row confirm" data-id="' + id + '"><span class="q">' + esc(q) + '</span><span class="acts">' +
          '<button type="button" class="ohpt-btn primary" data-act="yes" data-id="' + id + '">' + esc(L("ptConfirmYes")) + '</button>' +
          '<button type="button" class="ohpt-btn outline" data-act="no" data-id="' + id + '">' + esc(L("ptConfirmNo")) + '</button></span></li>';
      }
      return '<li class="ohpt-row' + (S.justId === p.id ? ' just' : '') + '" data-id="' + id + '">' +
        '<span class="t" dir="ltr">' + esc(p.time) + '</span>' +
        '<span class="n"><b>' + esc(name) + '</b>' + (p.nameEn && p.nameEn !== name ? '<span dir="ltr">' + esc(p.nameEn) + '</span>' : '') + '</span>' +
        '<span class="acts"><button type="button" class="ohpt-btn outline" data-act="edit" data-id="' + id + '" aria-label="' + esc(L("ptEdit") + " " + name) + '">' + esc(L("ptEdit")) + '</button>' +
        '<button type="button" class="ohpt-btn outline" data-act="del" data-id="' + id + '" aria-label="' + esc(L("ptDelete") + " " + name) + '">' + esc(L("ptDelete")) + '</button></span></li>';
    }).join("");
  }
  function msg(kind, text) {
    var m = $("ptMsg"); if (!m) return;
    clearTimeout(S.msgTimer);
    m.className = "ohpt-msg" + (kind ? " " + kind : ""); m.textContent = text || "";
    if (kind === "ok") S.msgTimer = setTimeout(function () { if (m.textContent === text) { m.textContent = ""; m.className = "ohpt-msg"; } }, 9000);
  }
  function errText(r, fallbackKey) {
    var c = (r && (r.code || r.reason)) || "";
    return /permission|denied|insufficient/i.test(c) ? L("ptErrDenied") : L(fallbackKey);
  }

  async function load() {
    var fb = window.OH_FIREBASE;
    var r = fb && fb.loadPrayerTimes ? await fb.loadPrayerTimes() : { ok: false };
    if (!r.ok) { msg("err", L("ptErrLoad")); return false; }
    S.items = r.items; render(); return true;
  }

  function openForm(id) {
    var p = id ? S.items.filter(function (x) { return x.id === id; })[0] : null;
    S.editId = p ? p.id : null; S.confirmId = null; render();
    $("ptFormTitle").textContent = p ? L("ptFormEditTitle") : L("ptFormAddTitle");
    $("ptSaveBtn").textContent = p ? L("ptSaveEdit") : L("ptSave");
    $("ptNameHe").value = p ? (p.nameHe || "") : "";
    $("ptNameEn").value = p ? (p.nameEn || "") : "";
    $("ptTimeIn").value = p ? to24(itemMinutes(p)) : "";
    $("ptFormErr").textContent = "";
    syncChips();
    var f = $("ptForm"); f.hidden = false;
    msg("", "");
    try { f.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (e) {}
    $("ptNameHe").focus();
  }
  function closeForm() { $("ptForm").hidden = true; S.editId = null; $("ptFormErr").textContent = ""; }

  async function save() {
    if (S.busy) return;
    var he = $("ptNameHe").value.trim(), en = $("ptNameEn").value.trim(), min = minutesOf24($("ptTimeIn").value);
    if (!he) { $("ptFormErr").textContent = L("ptNeedName"); $("ptNameHe").focus(); return; }
    if (min < 0) { $("ptFormErr").textContent = L("ptNeedTime"); $("ptTimeIn").focus(); return; }
    var item = { nameHe: he, nameEn: en, time: to12(min), order: min };
    var fb = window.OH_FIREBASE, editing = S.editId;
    S.busy = true; $("ptSaveBtn").disabled = true; msg("busy", L("ptSaving"));
    var r = editing ? await fb.updatePrayerTime(editing, item) : await fb.savePrayerTime(item);
    S.busy = false; $("ptSaveBtn").disabled = false;
    if (!r || !r.saved) { msg("err", errText(r, "ptErrSave")); return; }
    closeForm(); S.justId = r.id || editing || null;
    await load();
    var seen = await reloadPreview(function (txt) { return tvShowsList(txt); });
    msg("ok", seen ? L("ptSaved") : L("ptSavedSlow"));
  }
  async function remove(id) {
    if (S.busy) return;
    var p = S.items.filter(function (x) { return x.id === id; })[0]; if (!p) return;
    var fb = window.OH_FIREBASE;
    S.busy = true; msg("busy", L("ptDeleting"));
    var r = await fb.deletePrayerTime(id);
    S.busy = false; S.confirmId = null;
    if (!r || !r.saved) { render(); msg("err", errText(r, "ptErrDelete")); return; }
    if (S.editId === id) closeForm();
    S.justId = null;
    await load();
    var same = S.items.some(function (x) { return x.nameHe === p.nameHe && x.time === p.time; });
    var seen = await reloadPreview(function (txt) {
      return tvShowsList(txt) && (same || !tvHasRow(txt, p));
    });
    msg("ok", seen ? L("ptDeleted") : L("ptSavedSlow"));
  }

  window.OH_PT = {
    show: function (role) {
      build();
      var sec = $("ptSection"); sec.hidden = false;
      if (S.role && role && S.role.email === role.email) return;
      S.role = role || {}; S.items = []; S.editId = null; S.confirmId = null;
      startPreview(); load();
    },
    hide: function () { var sec = $("ptSection"); if (sec) sec.hidden = true; S.role = null; },
    _minutesOf12: minutesOf12, _to12: to12, _to24: to24
  };
})();
