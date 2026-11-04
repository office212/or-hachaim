/* Or Hachaim | 2040 phase 1 | שורת הפקודה החכמה: הממשק (src/ui/oh-cmdbar.js)
   Mounts itself into any element with id "ohCmdMount" (gabbai home, admin)
   once the signed-in person may edit content (super admin or content gabbai).
   Flow, always: sentence -> preview card of exactly what will change ->
   "אשר" -> write -> "בטל" (undo) stays available afterwards.
   Writes only through the existing helpers: OH_FIREBASE (prayerTimes,
   activityLog) and OH_SCREEN_CONTENT (announcements, sponsors: same fields,
   same draft / published flow, same history line). No AI, no outside service.
   Ctrl+K (or Cmd+K) focuses the bar. */
(function () {
  "use strict";
  var DEF = {
    cmdTitle: "שורת פקודה", cmdTitleEn: "כתבו משפט, המערכת מכינה את השינוי",
    cmdPlaceholder: "מה לעשות? למשל: מנחה 6:30 כל יום חול עד פסח",
    cmdGo: "הצג", cmdPreview: "תצוגה מקדימה | מה ישתנה", cmdPreviewNote: "שום דבר לא נשמר עד שלוחצים אשר",
    cmdConfirm: "אשר", cmdClose: "סגור", cmdUndo: "בטל", cmdUndone: "בוטל ✓ הכל חזר כמו שהיה",
    cmdSaved: "נשמר ✓ מופיע עכשיו על המסך", cmdSavedDraft: "נשמר כטיוטה ✓ לא על המסך עד שמפרסמים", cmdDeleted: "נמחק ✓ כבר לא מופיע על המסך",
    cmdSaving: "שומר...", cmdFailed: "השמירה נכשלה, שום דבר לא השתנה. נסו שוב", cmdDenied: "אין הרשאה לשינוי הזה",
    cmdLogged: "נרשם ביומן הפעולות", cmdNotLogged: "לא נרשם ביומן הפעולות (אין הרשאה לכתוב בו)",
    cmdUseAlt: "השתמש ב", cmdAddAnother: "להוסיף כזמן נוסף", cmdInsteadOf: "במקום", cmdSameNameQ: "כבר יש",
    cmdPublishNow: "לפרסם עכשיו על המסך", cmdSaveDraft: "לשמור כטיוטה", cmdEndDate: "עד תאריך",
    cmdLoading: "טוען את הלוח...", cmdNavGo: "פותח", cmdHelp: "אפשר לכתוב למשל:", cmdTry: "נסו:", cmdNoUndo: "אין שינוי לבטל"
  };
  function L(k) { var o = window.OH_LABELS || {}; return (o[k] !== undefined && o[k] !== null && o[k] !== "") ? o[k] : DEF[k]; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  /* escaped, with every "6:30 PM" kept left-to-right inside the Hebrew line */
  function escT(s) { return esc(s).replace(/\b(\d{1,2}:\d{2}(?:\s?[AP]M)?)/g, '<bdi dir="ltr">$1</bdi>'); }
  var P = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  var I = {
    spark: P + '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/></svg>',
    check: P + '<path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    info: P + '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/></svg>',
    sun: P + '<path d="M3 18h18M6 18a6 6 0 0 1 12 0M12 6v2M5.6 9.6l1.4 1.4M18.4 9.6L17 11"/></svg>',
    undo: P + '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>'
  };
  function T() { return window.OH_TIMES; }
  function C() { return window.OH_COMMAND; }
  function fb() { return window.OH_FIREBASE; }
  function rootPath() { var s = document.querySelector('script[src*="oh-cmdbar.js"]'); var src = s ? s.getAttribute("src") : "../src/ui/oh-cmdbar.js"; return src.replace(/src\/ui\/oh-cmdbar\.js.*$/, ""); }
  function now() { return window.OH_TEST_NOW ? new Date(window.OH_TEST_NOW) : new Date(); }

  var st = { el: null, role: null, docs: [], cal: null, holiday: null, plan: null, choice: null, undo: [], busy: false, uid: null };
  try { st.undo = JSON.parse(sessionStorage.getItem("ohCmdUndo") || "[]") || []; } catch (e) { st.undo = []; }
  function saveUndo() { try { sessionStorage.setItem("ohCmdUndo", JSON.stringify(st.undo.slice(-10))); } catch (e) {} }

  /* ---------- data ---------- */
  async function loadDocs() {
    var f = fb(); if (!f || !f.loadPrayerTimes) return;
    var r = await f.loadPrayerTimes(); if (r && r.ok) st.docs = r.items;
  }
  function loadCalendar() {
    if (st.cal || !window.OH_CALENDAR || !window.OH_CALENDAR.load) return Promise.resolve(st.cal);
    if (st.calP) return st.calP;
    /* only the 5787 daily file: 5788 is not on the site yet */
    st.calP = window.OH_CALENDAR.load({ base: rootPath() + "src/", files: { zmanim: ["zmanim/roy-daily-5787.json"] } }).then(function (c) {
      st.cal = c; var t = T(); try { st.holiday = C().holidayFinder(c, t.nyIso(now()), 400); } catch (e) {} return c;
    }).catch(function () { st.calP = null; return null; });
    return st.calP;
  }
  function ctx() {
    var t = T();
    return { today: t.nyIso(now()), docs: st.docs, zman: t.zman, lastZmanDay: t.lastZmanDay(), holiday: st.holiday, role: st.role,
      isYomTov: st.cal && st.cal.isYomTov ? function (iso) { try { return !!st.cal.isYomTov(iso); } catch (e) { return false; } } : null };
  }

  /* ---------- render ---------- */
  function shell() {
    var ex = C().examples(st.role).slice(0, 4);
    st.el.innerHTML = '<section class="x-card" aria-labelledby="ohCmdTitle">' +
      '<div class="cb-head"><h2 id="ohCmdTitle">' + esc(L("cmdTitle")) + '</h2><span>' + esc(L("cmdTitleEn")) + '</span></div>' +
      '<form class="cb-row" id="ohCmdForm" autocomplete="off">' + I.spark +
      '<input class="cb-input" id="ohCmdInput" dir="rtl" lang="he" type="text" enterkeyhint="go" aria-label="' + esc(L("cmdTitle")) + '" placeholder="' + esc(L("cmdPlaceholder")) + '">' +
      '<span class="cb-kbd">Ctrl K</span><button class="x-btn primary" type="submit" id="ohCmdGo">' + esc(L("cmdGo")) + '</button></form>' +
      '<div class="cb-ex" id="ohCmdEx">' + ex.map(function (x) { return '<button type="button" class="x-chip" data-cmd="' + esc(x) + '">' + esc(x) + "</button>"; }).join("") + "</div>" +
      '<div class="cb-out" id="ohCmdOut" aria-live="polite"></div></section>';
    st.el.querySelector("#ohCmdForm").addEventListener("submit", function (e) { e.preventDefault(); run(st.el.querySelector("#ohCmdInput").value); });
    st.el.addEventListener("click", onClick);
  }
  function out(html) { var o = st.el && st.el.querySelector("#ohCmdOut"); if (o) o.innerHTML = html; }
  function msg(kind, text, extra) {
    var ic = kind === "ok" ? I.check : (kind === "warn" ? I.info : I.info);
    return '<div class="cb-msg ' + kind + '" data-msg="' + kind + '">' + ic + '<div class="grow">' + text + (extra || "") + "</div></div>";
  }
  function chips(list, attr) { return list && list.length ? '<div class="cb-sug">' + list.map(function (x) { return '<button type="button" class="x-chip" data-' + (attr || "cmd") + '="' + esc(x) + '">' + esc(x) + "</button>"; }).join("") + "</div>" : ""; }

  function previewHtml() {
    var p = st.plan, t = T(), h = "";
    var rows = p.rows.slice();
    if (st.choice && st.choice.alt) {
      var it = st.choice.alt;
      var c0 = ctx(), fd0 = t.firstDay(it.rule, c0.today, 400, c0.isYomTov); rows = rows.map(function (r) { return r.k === "שעה" ? { k: "שעה", v: t.offsetHe(it.rule.offsetMin) + " | מתעדכן כל יום (" + (fd0 === c0.today ? "היום" : t.dateHe(fd0, false)) + ": " + t.short12(it.order) + ")" } : r; });
    }
    if (st.choice && st.choice.instead) rows = rows.map(function (r) { return r.k === "פעולה" ? { k: "פעולה", v: "שינוי זמן תפילה (במקום " + st.choice.insteadLabel + ")" } : r; });
    h += '<div class="pv" id="ohCmdPreview" data-action="' + esc(p.action) + '"><div class="pv-top"><b>' + esc(L("cmdPreview")) + "</b><span>" + esc(L("cmdPreviewNote")) + "</span></div>";
    h += '<div class="pv-rows">' + rows.map(function (r) { return '<div class="pv-row"><span class="k">' + esc(r.k) + '</span><span class="v">' + escT(r.v) + "</span></div>"; }).join("") + "</div>";
    (p.warnings || []).forEach(function (w, i) {
      if (st.choice && st.choice.alt && w.kind === "after-sunset") return;
      h += '<div class="pv-warn" data-warn="' + esc(w.kind) + '">' + escT(w.text) +
        (w.alt ? '<div class="alt"><button type="button" class="x-btn gold" data-alt="' + i + '">' + I.sun + esc(L("cmdUseAlt")) + ": " + esc(w.alt.label) + "</button></div>" : "") + "</div>";
    });
    if ((p.action === "add") && p.others && p.others.length) {
      h += '<div class="pv-choice"><p>' + esc(L("cmdSameNameQ")) + " " + esc(p.nameHe) + ": " + p.others.map(function (d) { return escT(docLabel(d)); }).join(", ") + '</p><div class="row">' +
        '<button type="button" class="x-chip' + (!st.choice.instead ? " sel" : "") + '" data-instead="">' + esc(L("cmdAddAnother")) + "</button>" +
        p.others.map(function (d) { return '<button type="button" class="x-chip' + (st.choice.instead === d.id ? " sel" : "") + '" data-instead="' + esc(d.id) + '"><span>' + esc(L("cmdInsteadOf")) + " " + escT(docLabel(d)) + "</span></button>"; }).join("") + "</div></div>";
    }
    if (p.action === "announce" || p.action === "sponsor") {
      h += '<div class="pv-choice"><div class="row"><button type="button" class="x-chip' + (st.choice.publish ? " sel" : "") + '" data-pub="1">' + esc(L("cmdPublishNow")) + '</button><button type="button" class="x-chip' + (!st.choice.publish ? " sel" : "") + '" data-pub="0">' + esc(L("cmdSaveDraft")) + "</button></div></div>";
      if (p.action === "announce") h += '<div class="pv-field"><label for="ohCmdEnd">' + esc(L("cmdEndDate")) + '</label><input type="date" id="ohCmdEnd" value="' + esc(p.item.endDate) + '" min="' + esc(p.item.startDate) + '"></div>';
    }
    h += '<div class="pv-acts"><button type="button" class="x-btn primary" id="ohCmdConfirm">' + I.check + esc(L("cmdConfirm")) + '</button><button type="button" class="x-btn ghost" id="ohCmdCancel">' + esc(L("cmdClose")) + "</button></div></div>";
    return h;
  }
  function docLabel(d) { var t = T(); return (d.nameHe || "") + " " + (d.rule && d.rule.kind === "sunset" ? t.offsetHe(d.rule.offsetMin) : (t.min12(d.time) >= 0 ? d.time : t.fmt12(d.order))); }

  /* ---------- run a sentence ---------- */
  async function run(text) {
    if (!st.el) return;
    var inp = st.el.querySelector("#ohCmdInput"); if (inp && inp.value !== text) inp.value = text;
    if (!st.cal) { out(msg("info", esc(L("cmdLoading")))); await loadCalendar(); }
    await Promise.all([T().loadZmanim(rootPath()), loadDocs()]);
    var r = C().parse(text, ctx());
    st.plan = null; st.choice = null;
    if (r.type === "error") { out(msg("warn", "<b>" + escT(r.message) + "</b>", r.suggestions && r.suggestions.length ? '<div style="margin-top:6px">' + esc(L("cmdTry")) + "</div>" + chips(r.suggestions) : "")); return r; }
    if (r.type === "help") { out(msg("info", esc(L("cmdHelp")), chips(r.suggestions))); return r; }
    if (r.type === "undo") { await undoLast(); return r; }
    if (r.type === "nav") { out(msg("info", esc(L("cmdNavGo")) + " " + esc(r.label) + "...")); var href = rootPath() + r.href; if (r.href === "tv/") window.open(href, "_blank", "noopener"); else location.href = href; return r; }
    st.plan = r.plan; st.choice = { alt: null, instead: "", publish: r.plan.publish !== false };
    out(previewHtml());
    return r;
  }

  async function onClick(e) {
    var b = e.target.closest("button"); if (!b || !st.el.contains(b)) return;
    if (b.hasAttribute("data-cmd")) { run(b.getAttribute("data-cmd")); return; }
    if (b.hasAttribute("data-alt")) { var w = st.plan.warnings[+b.getAttribute("data-alt")]; if (w && w.alt) { st.choice.alt = w.alt.item; out(previewHtml()); } return; }
    if (b.hasAttribute("data-instead")) { var id = b.getAttribute("data-instead"); st.choice.instead = id; var d = (st.plan.others || []).filter(function (x) { return x.id === id; })[0]; st.choice.insteadLabel = d ? docLabel(d) : ""; st.choice.insteadDoc = d || null; out(previewHtml()); return; }
    if (b.hasAttribute("data-pub")) { st.choice.publish = b.getAttribute("data-pub") === "1"; var end = st.el.querySelector("#ohCmdEnd"); var v = end && end.value; out(previewHtml()); if (v) { var e2 = st.el.querySelector("#ohCmdEnd"); if (e2) e2.value = v; } return; }
    if (b.id === "ohCmdCancel") { st.plan = null; out(""); return; }
    if (b.id === "ohCmdConfirm") { await confirmPlan(); return; }
    if (b.id === "ohCmdUndoBtn") { await undoLast(); return; }
  }

  function denied(r) { return r && /permission|PERMISSION_DENIED|no-screen-permission/i.test(String(r.code || "") + " " + String(r.reason || "")); }
  async function log(action, detail, extra) {
    var f = fb(); if (!f || !f.logActivity) return false;
    var r = await f.logActivity(action, detail, extra); return !!(r && r.saved);
  }

  async function confirmPlan() {
    if (st.busy || !st.plan) return;
    st.busy = true;
    var btn = st.el.querySelector("#ohCmdConfirm"); if (btn) { btn.disabled = true; btn.textContent = L("cmdSaving"); }
    var p = st.plan, f = fb(), SC = window.OH_SCREEN_CONTENT, text = (st.el.querySelector("#ohCmdInput") || {}).value || "";
    var res = null, undo = null, label = "", okText = L("cmdSaved"), logged = null;
    try {
      if (p.action === "add" || p.action === "update") {
        var item = Object.assign({}, st.choice.alt || p.item);
        var target = p.action === "update" ? p.target : (st.choice.insteadDoc || null);
        if (target) {
          var before = { nameHe: target.nameHe, nameEn: target.nameEn, time: target.time, order: target.order, rule: target.rule || null };
          item.nameEn = item.nameEn || target.nameEn;
          res = await f.updatePrayerTime(target.id, Object.assign({}, item, { rule: item.rule || null }));
          if (res && res.saved) undo = { kind: "pt-update", id: target.id, before: before };
          label = "שינוי: " + docLabel(target) + " ל" + docLabel(item);
        } else {
          res = await f.savePrayerTime(item);
          if (res && res.saved) undo = { kind: "pt-delete", id: res.id };
          label = "הוספה: " + docLabel(item);
        }
        if (res && res.saved) logged = await log("commandBar." + (target ? "update" : "add"), label + (item.rule ? " | " + T().describeRule(item.rule, item.time) : ""), { collection: "prayerTimes", itemId: target ? target.id : res.id, command: text });
      } else if (p.action === "delete") {
        var tg = p.target, bf = { nameHe: tg.nameHe, nameEn: tg.nameEn, time: tg.time, order: tg.order, rule: tg.rule || null };
        res = await f.deletePrayerTime(tg.id);
        if (res && res.saved) { undo = { kind: "pt-restore", id: tg.id, before: bf }; okText = L("cmdDeleted"); }
        label = "מחיקה: " + docLabel(tg);
        if (res && res.saved) logged = await log("commandBar.delete", label, { collection: "prayerTimes", itemId: tg.id, command: text });
      } else if (p.action === "announce" || p.action === "sponsor") {
        var it2 = Object.assign({}, p.item, { status: st.choice.publish ? "published" : "draft" });
        var endEl = st.el.querySelector("#ohCmdEnd"); if (endEl && endEl.value) it2.endDate = endEl.value;
        res = await SC.save(it2, "create");
        if (res && res.saved) { undo = { kind: "sc-archive", id: res.id, col: res.col, item: it2 }; if (!st.choice.publish) okText = L("cmdSavedDraft"); logged = true; /* screen-content writes its own history line */ }
        label = (p.action === "sponsor" ? "חסות: " : "הכרזה: ") + it2.titleHe;
      }
    } catch (e) { res = { saved: false, reason: String(e) }; }
    st.busy = false;
    if (!res || !res.saved) {
      out(previewHtml());
      var o = st.el.querySelector("#ohCmdOut"); o.insertAdjacentHTML("afterbegin", msg("warn", "<b>" + esc(denied(res) ? L("cmdDenied") : L("cmdFailed")) + "</b>"));
      return;
    }
    undo.label = label; undo.at = Date.now(); undo.uid = st.uid;
    st.undo.push(undo); saveUndo();
    st.plan = null;
    out(msg("ok", "<b>" + esc(okText) + "</b><div>" + escT(label) + '</div><div style="font-size:14px;opacity:.85">' + esc(logged ? L("cmdLogged") : L("cmdNotLogged")) + "</div>",
      '<div class="cb-sug"><button type="button" class="x-btn" id="ohCmdUndoBtn">' + I.undo + esc(L("cmdUndo")) + "</button></div>"));
    changed();
  }
  function changed() {
    loadDocs();
    try { window.dispatchEvent(new CustomEvent("oh-prayertimes-changed")); } catch (e) {}
  }
  async function undoLast() {
    var u = null;
    for (var i = st.undo.length - 1; i >= 0; i--) { if (!st.undo[i].uid || st.undo[i].uid === st.uid) { u = st.undo[i]; st.undo.splice(i, 1); break; } }
    if (!u) { out(msg("info", esc(L("cmdNoUndo")))); return; }
    var f = fb(), r = null;
    try {
      if (u.kind === "pt-delete") r = await f.deletePrayerTime(u.id);
      else if (u.kind === "pt-update") r = await f.updatePrayerTime(u.id, Object.assign({}, u.before, { rule: u.before.rule || null }));
      else if (u.kind === "pt-restore") r = await f.restorePrayerTime(u.id, u.before);
      else if (u.kind === "sc-archive") r = await window.OH_SCREEN_CONTENT.setStatus(Object.assign({}, u.item, { id: u.id, col: u.col }), "archived");
    } catch (e) { r = { saved: false, reason: String(e) }; }
    if (!r || !r.saved) { st.undo.push(u); saveUndo(); out(msg("warn", "<b>" + esc(denied(r) ? L("cmdDenied") : L("cmdFailed")) + "</b>")); return; }
    saveUndo();
    var logged = u.kind === "sc-archive" ? true : await log("commandBar.undo", "ביטול: " + u.label, { collection: "prayerTimes", itemId: u.id });
    out(msg("ok", "<b>" + esc(L("cmdUndone")) + "</b><div>" + escT(u.label) + '</div><div style="font-size:14px;opacity:.85">' + esc(logged ? L("cmdLogged") : L("cmdNotLogged")) + "</div>"));
    changed();
  }

  /* ---------- mount ---------- */
  async function tick() {
    var el = document.getElementById("ohCmdMount");
    var f = fb();
    if (!el || !f || !f.ready || !f.user) { if (el && !f) el.hidden = true; if (st.el && (!f || !f.user)) { st.el.hidden = true; st.el.removeAttribute("data-mounted"); st.el = null; } return; }
    var role; try { role = await f.resolveRole(); } catch (e) { role = null; }
    var can = !!(role && (role.isSuperAdmin || role.canScreen));
    if (!can) { el.hidden = true; el.innerHTML = ""; el.removeAttribute("data-mounted"); if (st.el === el) st.el = null; return; }
    if (el.getAttribute("data-mounted") === f.user.uid) return;
    el.setAttribute("data-mounted", f.user.uid);
    el.classList.add("ohx", "cb"); el.hidden = false;
    st.el = el; st.role = role; st.uid = f.user.uid;
    shell();
    T().loadZmanim(rootPath()); loadDocs(); loadCalendar();
    if (/#cmd/.test(location.hash)) setTimeout(function () { var i = el.querySelector("#ohCmdInput"); if (i) i.focus(); }, 50);
    var q = (location.hash.match(/#cmd=(.+)$/) || [])[1];
    if (q) { try { run(decodeURIComponent(q)); } catch (e) {} }
  }
  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K" || e.key === "ל")) {
      var i = document.getElementById("ohCmdInput");
      if (i) { e.preventDefault(); i.focus(); i.select(); }
    }
  });
  window.OH_CMDBAR = { run: run, fill: function (text, go) { var i = document.getElementById("ohCmdInput"); if (!i) return false; i.value = text; i.focus(); try { i.scrollIntoView({ block: "center" }); } catch (e) {} if (go) run(text); return true; }, _state: st };
  setInterval(tick, 1000); tick();
})();
