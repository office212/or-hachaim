/* Or Hachaim | 2040 phase 1 | Settings (gabbai/settings/, src/ui/oh-settings.js)
   Hanoch 2026-11-04 5:49 AM: "all management simple, with a main Settings button".
   One big card per setup thing, one action each. A card is there only for the
   people who may use it (no lock messages):
     interface language   every gabbai
     prayer times         content gabbaim and the super admin  -> admin/#ptSection
     screen texts and layout   content gabbaim and the super admin -> admin/#ttSection
     landing page wording      super admin (2040 phase 2)       -> admin/#htSection
     gabbaim and permissions   super admin                      -> admin/#userMgmtSection
     backup and restore        super admin                      -> backup/ */
(function () {
  "use strict";
  var DEF = {
    setTitle: "הגדרות", setSub: "כל מה שמגדירים פעם אחת, במקום אחד",
    setLangT: "שפת הממשק", setLangD: "עברית או English. נשמר במכשיר הזה.",
    setTimesT: "זמני תפילה", setTimesD: "חול (א׳-ה׳), שישי ושבת", setTimesGo: "לזמני התפילה",
    setTextsT: "המסך", setTextsD: "כל מילה על המסך וסידור החלקים", setTextsGo: "לטקסטים במסך",
    setHomeT: "דף הנחיתה", setHomeD: "כל מילה בדף הבית של האתר, בעברית ובאנגלית", setHomeGo: "לטקסטים בדף הנחיתה",
    setUsersT: "גבאים והרשאות", setUsersD: "מי יכול לעשות מה", setUsersGo: "לגבאים",
    setBackupT: "גיבוי ושחזור", setBackupD: "הגיבוי רץ כל לילה לבד", setBackupGo: "לגיבוי",
    setSignIn: "כניסה"
  };
  function L(k) { var o = window.OH_LABELS || {}; return (o[k] !== undefined && o[k] !== null && o[k] !== "") ? o[k] : DEF[k]; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var ROOT = "../../";
  var P = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  var IC = {
    lang: P + '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/></svg>',
    clock: P + '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/></svg>',
    tv: P + '<rect x="2.5" y="4.5" width="19" height="13" rx="2"/><path d="M8 21h8M12 17.5V21"/></svg>',
    shield: P + '<path d="M12 3l7 3v5c0 5-3.4 8.4-7 10-3.6-1.6-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/></svg>',
    home: P + '<path d="M3.5 11L12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5.5h4V20"/></svg>',
    cloud: P + '<path d="M7 18.5a4 4 0 0 1-.6-8A6 6 0 0 1 17.8 9.3a4.6 4.6 0 0 1-.3 9.2z"/><path d="M12 11.5v6M9.5 14L12 11.5 14.5 14"/></svg>'
  };
  function card(id, icon, t, d, body) {
    return '<section class="x-card set-card" id="' + id + '"><span class="set-ic">' + icon + '</span><div class="set-tx"><h2>' + esc(t) + '</h2><p class="oh-help">' + esc(d) + '</p></div><div class="set-act">' + body + "</div></section>";
  }
  function go(href, label) { return '<a class="x-btn primary" href="' + ROOT + href + '">' + esc(label) + "</a>"; }
  var last = "";
  async function tick() {
    var el = document.getElementById("ohSettings"), fb = window.OH_FIREBASE; if (!el || !fb || !fb.ready) return;
    if (!fb.user) { if (last !== "out") { last = "out"; el.innerHTML = '<div class="page-head"><div><h1>' + esc(L("setTitle")) + '</h1></div></div><section class="x-card"><button type="button" class="x-btn primary" id="setSignIn">' + esc(L("setSignIn")) + "</button></section>"; } return; }
    var role; try { role = await fb.resolveRole(); } catch (e) { role = null; } if (!role) return;
    var gabbai = role.isSuperAdmin || role.canScreen || role.canFinance;
    if (!gabbai) { location.replace(ROOT + "gabbai/"); return; }
    var key = fb.user.uid + "|" + role.isSuperAdmin + role.canScreen + role.canFinance;
    if (key === last) return; last = key;
    var SH = window.OH_SHELL, h = '<div class="page-head"><div><h1>' + esc(L("setTitle")) + '</h1><p class="lead oh-help">' + esc(L("setSub")) + "</p></div></div><div class=\"set-grid\">";
    var seg = SH && SH.segHtml ? SH.segHtml("setLangSeg", [{ v: "he", label: "עברית", flags: ["il"], lang: "he" }, { v: "en", label: "English", flags: ["us"], lang: "en" }], window.OH_LANG === "en" ? "en" : "he", L("setLangT")) : "";
    h += card("setLang", IC.lang, L("setLangT"), L("setLangD"), seg);
    if (role.isSuperAdmin || role.canScreen) {
      h += card("setTimes", IC.clock, L("setTimesT"), L("setTimesD"), go("admin/#ptSection", L("setTimesGo")));
      h += card("setTexts", IC.tv, L("setTextsT"), L("setTextsD"), go("admin/#ttSection", L("setTextsGo")));
    }
    if (role.isSuperAdmin) {
      h += card("setHome", IC.home, L("setHomeT"), L("setHomeD"), go("admin/#htSection", L("setHomeGo")));
      h += card("setUsers", IC.shield, L("setUsersT"), L("setUsersD"), go("admin/#userMgmtSection", L("setUsersGo")));
      h += card("setBackup", IC.cloud, L("setBackupT"), L("setBackupD"), go("backup/", L("setBackupGo")));
    }
    el.innerHTML = h + "</div>";
    if (SH && SH.segWire) SH.segWire(document.getElementById("setLangSeg"), SH.setLang);
    document.body.setAttribute("data-set-ready", "1");
  }
  document.addEventListener("click", function (e) { if (e.target.closest("#setSignIn")) { var f = window.OH_FIREBASE; if (f && f.signIn) { var r = f.signIn(); if (r && r.catch) r.catch(function () {}); } } });
  setInterval(tick, 1000); tick();
})();
