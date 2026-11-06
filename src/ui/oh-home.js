/* Or Hachaim | gabbai home page (stage A, 2026-11-03), layout of mockup A.
   Shows ONLY what the signed-in person may do, using the existing role
   logic in firebase-app.js (buildRole: super admin, claims ohFinance /
   ohScreen / ohImageUpload, or the users doc permissions). Reads only data
   the current rules already allow for that role:
   - screen items: the same query the admin editor uses (content gabbai and
     super admin only),
   - next zman: read from the real public screen (/tv/) shown in the card,
   - ledgerEntries of the last 7 days: finance gabbai only (finance already
     reads them).
   backupRuns is NOT read (the rules block it in the browser); the backup
   card says when the automatic backup runs. All words: src/ui/labels.js. */
(function () {
  var L = window.OH_LABELS || {};
  function t(k, d) { return (L[k] != null && L[k] !== "") ? L[k] : (d || ""); }
  /* Nov 6: a tile whose words are missing from labels.js (a phone still holding an
     older copy of labels.js right after an upload) shows these Hebrew words, never
     the bare key ("members" read as English on a Hebrew page) */
  var TILE_DEF = { members: { title: "ניהול מתפללים", en: "Members", text: "הוספת מתפלל, עריכת שם וטלפון, בקשות הצטרפות" } };
  function tile(k) { return (L.tiles && L.tiles[k]) || TILE_DEF[k] || { title: k, en: "", text: "" }; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var ROOT = (window.OH_SHELL && window.OH_SHELL.root) || "../";
  var P = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  function ic(d) { return P + d + "</svg>"; }
  var I = {
    tv: ic('<rect x="2.5" y="4.5" width="19" height="13" rx="2"/><path d="M8 21h8M12 17.5V21"/>'),
    clock: ic('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>'),
    wallet: ic('<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18"/><circle cx="16.5" cy="14.5" r="1.2"/>'),
    book: ic('<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3"/><path d="M9 7.5h6"/>'),
    doc: ic('<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h4"/>'),
    shield: ic('<path d="M12 3l7 3v5c0 5-3.4 8.4-7 10-3.6-1.6-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/>'),
    cloud: ic('<path d="M7 18.5a4 4 0 0 1-.6-8A6 6 0 0 1 17.8 9.3a4.6 4.6 0 0 1-.3 9.2z"/><path d="M12 11.5v6M9.5 14L12 11.5 14.5 14"/>'),
    list: ic('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>'),
    cal: ic('<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
    plus: ic('<path d="M12 5v14M5 12h14"/>'),
    search: ic('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'),
    lock: ic('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>'),
    arrow: ic('<path d="M14.5 6l-6 6 6 6"/>'),
    person: ic('<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>'),
    people: ic('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.8"/><path d="M15.5 14.2A5.5 5.5 0 0 1 21.5 20"/>'),
    signin: ic('<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="M15 8l4 4-4 4M19 12H9"/>'),
    edit: ic('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>')
  };
  /* The tiles, in the mockup order. "can" uses the existing role flags. */
  /* 2040 phase 1 (Hanoch 5:49 AM): the home keeps the daily actions; screen texts,
     permissions and backup moved to the one Settings page (gabbai/settings/). */
  var TILES = [
    { k: "screen", icon: I.tv, href: "gabbai/tv/content/", can: function (r) { return r.canScreen; }, count: true },
    { k: "times", icon: I.clock, href: "gabbai/tv/#ptSection", can: function (r) { return r.canScreen; } },
    { k: "finance", icon: I.wallet, href: "finance/", can: function (r) { return r.canFinance; } },
    { k: "members", icon: I.people, href: "finance/#members", can: function (r) { return r.canFinance || r.isSuperAdmin; } }, /* Nov 6: the Members tab */
    { k: "nedarim", icon: I.book, href: "finance/#nedarim", can: function (r) { return r.canFinance; } },
    { k: "reports", icon: I.doc, href: "finance/#reports", can: function (r) { return r.canFinance; } },
    { k: "activity", icon: I.list, href: "gabbai/activity/", can: function (r) { return r.isSuperAdmin; } }, /* Nov 5: the log is super admin only */
    { k: "account", icon: I.person, href: "congregant/", can: function (r) { return r.isCongregant; } }
  ];
  window.OH_HOME_TILES = TILES;

  var main = document.getElementById("ohHome");
  var state = { key: "", published: null, drafts: null, zman: null, today: null, nedarim: null, unsub: null, frame: null };

  /* datefix (Nov 5, Hanoch): the Hebrew date turns at shkiah, the same rule and
     the same shkiah (the daily zmanim file) as the landing page and the TV.
     After shkiah: tomorrow's Hebrew date, and the weekday is left out. */
  var ZDAYS = null;
  function nyKey(off) {
    var p = {}; new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
    return new Date(Date.UTC(+p.year, +p.month - 1, +p.day + (off || 0))).toISOString().slice(0, 10);
  }
  function afterShkiah() {
    try {
      var z = ZDAYS && ZDAYS[nyKey(0)]; if (!z || !z.shkiah) return false;
      var p = {}; new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
      var a = String(z.shkiah).split(":");
      return (+p.hour % 24) * 60 + (+p.minute) >= (+a[0]) * 60 + (+a[1]);
    } catch (e) { return false; }
  }
  try {
    fetch(ROOT + "src/zmanim/roy-daily-5787.json").then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (j && j.days) { ZDAYS = j.days; paintDate(); }
    }).catch(function () {});
  } catch (e) {}
  function paintDate() { var el = main && main.querySelector(".hello .date"); if (el) el.innerHTML = I.cal + esc(dateLine()); }
  setInterval(paintDate, 60000);
  function dateLine() {
    var d = new Date(), tz = "America/New_York", after = afterShkiah();
    var hd = after ? new Date(nyKey(1) + "T16:00:00Z") : d; /* noon in New York tomorrow */
    var wd = "", heb = "", en = "";
    try { if (!after) wd = new Intl.DateTimeFormat("he-IL", { weekday: "long", timeZone: tz }).format(d); } catch (e) {}
    try { heb = new Intl.DateTimeFormat("he-IL-u-ca-hebrew", { day: "numeric", month: "long", timeZone: tz }).format(hd); } catch (e) {}
    try { en = new Intl.DateTimeFormat("en-US", { weekday: after ? undefined : "long", month: "long", day: "numeric", timeZone: tz }).format(d); } catch (e) {}
    heb = hebDay(heb);
    if (window.OH_LANG === "en") { /* English: Wednesday, November 4 | 24 Cheshvan */
      var hm = ""; try { hm = new Intl.DateTimeFormat("en-u-ca-hebrew", { day: "numeric", month: "long", timeZone: tz }).format(hd); } catch (e) {}
      hm = hm.replace(/Heshvan/, "Cheshvan").replace(/Tishri/, "Tishrei").replace(/Shevat|Shvat/, "Shevat").replace(/Tamuz|Tammuz/, "Tamuz");
      return [en, hm].filter(Boolean).join(" | ");
    }
    return [wd, heb, en].filter(Boolean).join(" | ");
  }
  /* "23 בחשוון" -> "כ״ג בחשוון" (Hebrew numerals, like the screen) */
  function hebDay(s) {
    return String(s).replace(/^(\d{1,2})\s/, function (m, n) {
      n = +n; var ones = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"], tens = ["", "י", "כ", "ל"];
      var r = n === 15 ? "טו" : n === 16 ? "טז" : tens[Math.floor(n / 10)] + ones[n % 10];
      r = r.length > 1 ? r.slice(0, -1) + "״" + r.slice(-1) : r + "׳";
      return r + " ";
    });
  }

  function stat(icon, k, id, v) {
    return '<div class="card stat"><span class="sic">' + icon + '</span><span><div class="k">' + esc(k) + '</div><div class="v" id="' + id + '">' + v + "</div></span></div>";
  }
  var WAIT = '<span class="wait">' + esc(t("statLoading", "טוען...")) + "</span>";

  function renderGate(msg) {
    stopData();
    main.innerHTML = '<section class="card gate goldframe" id="ohGate"><img src="' + ROOT + 'src/assets/logo.svg" alt="' + esc(t("logoAlt", "אור החיים")) + '" style="height:72px;width:auto;margin-bottom:10px">' +
      "<h1>" + esc(t("gateTitle")) + "</h1><p>" + esc(t("gateText")) + "</p>" +
      '<button type="button" class="btn primary" id="ohGateBtn">' + I.signin + esc(t("gateButton")) + "</button>" +
      '<div class="msg" id="ohGateMsg" role="status">' + esc(msg || "") + "</div></section>";
    document.getElementById("ohGateBtn").addEventListener("click", function () {
      var fb = window.OH_FIREBASE;
      if (!fb || !fb.ready || !fb.signIn) { document.getElementById("ohGateMsg").textContent = t("gateNotReady"); return; }
      var r = fb.signIn();
      if (r && r.catch) r.catch(function () { var m = document.getElementById("ohGateMsg"); if (m) m.textContent = t("gateFailed"); });
    });
  }
  function renderLoading() {
    main.innerHTML = '<section class="card hello goldframe" style="max-width:640px"><span class="date">' + I.cal + esc(dateLine()) + '</span><p>' + esc(t("loading", "טוען...")) + "</p></section>";
  }

  /* 6a (Nov 5): the account lookup failed. Not the join screen and not "not
     authorized": one line and "נסה שוב" (the hardening package's pattern). */
  function renderLoadErr() {
    var en = window.OH_LANG === "en";
    main.innerHTML = '<section class="card hello goldframe" style="max-width:640px"><span class="date">' + I.cal + esc(dateLine()) + "</span>" +
      '<div class="oh-loaderr" role="alert" style="display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;margin-top:12px;font-weight:700"><span>' +
      esc(en ? "Couldn't load your account." : "לא הצלחנו לטעון את החשבון.") + '</span><button type="button" class="btn" id="ohRetry">' + esc(en ? "Try again" : "נסה שוב") + "</button></div></section>";
    document.getElementById("ohRetry").addEventListener("click", function () {
      var fb = window.OH_FIREBASE; state.key = ""; renderLoading();
      if (fb && fb.retryRole) Promise.resolve(fb.retryRole()).then(tick, tick);
    });
  }
  function renderRole(user, role) {
    if (role && role.loadFailed) { renderLoadErr(); return; }
    /* Stage D: a signed-in person who is not a member yet goes to the join screen */
    if (role && !role.authorized && (role.canRequestJoin || role.joinStatus)) { location.replace(ROOT + "congregant/"); return; }
    var S = window.OH_SHELL || {};
    var name = S.firstName ? S.firstName(user) : "";
    var gabbai = role.isSuperAdmin || role.canScreen || role.canFinance;
    var financeOnly = role.canFinance && !role.canScreen && !role.isSuperAdmin;
    var helloText = t("helloText"), btn = "";
    if (!role.authorized) helloText = "";
    else if (role.canScreen) btn = '<a class="btn primary" href="' + ROOT + 'gabbai/tv/content/">' + I.plus + esc(t("mainButtonScreen")) + "</a>";
    else if (role.canFinance) { helloText = t("helloTextFinance"); btn = '<a class="btn primary" href="' + ROOT + 'finance/#search">' + I.search + esc(t("mainButtonFinance")) + "</a>"; }
    else if (role.isCongregant) { helloText = t("helloTextCongregant"); btn = '<a class="btn primary" href="' + ROOT + 'congregant/">' + I.person + esc(t("mainButtonCongregant")) + "</a>"; }
    if (role.canScreen && !role.canFinance && !role.isSuperAdmin) helloText = t("helloTextScreen");

    /* 2040 phase 1: the command bar (content gabbaim, super admin) mounts here, src/ui/oh-cmdbar.js */
    var h = (role.isSuperAdmin || role.canScreen) ? '<div id="ohCmdMount" hidden></div>' : "";
    h += '<section class="hero"><div class="card hello goldframe"><span class="date">' + I.cal + esc(dateLine()) + "</span>" +
      "<h1>" + esc((t("hello", "שלום,") + " " + name).trim()) + '</h1><span class="h1-en">' + esc(t("helloEn")) + "</span>" +
      (helloText ? '<p class="oh-help">' + esc(helloText) + "</p>" : "") + (btn ? '<div class="row">' + btn + "</div>" : "") + "</div>";
    if (role.authorized) {
      h += '<div class="card livetv"><div class="livetv-head"><span class="live-pill"><span class="dot"></span>' + esc(financeOnly ? t("liveInShul") : t("liveOnScreen")) + "</span>" +
        '<a href="' + ROOT + 'tv/" target="_blank" rel="noopener">' + esc(t("openScreen")) + " " + I.arrow + "</a></div>" +
        '<div class="mtv live" id="ohMtv"></div></div>';
    }
    h += "</section>";
    /* 2040 phase 1: the command bar (content gabbaim, super admin), optional, below the greeting; src/ui/oh-cmdbar.js */
    if (role.isSuperAdmin || role.canScreen) h += '<div id="ohCmdMount" hidden></div>';

    if (gabbai) {
      h += '<section class="stats">';
      if (role.canScreen) h += stat(I.tv, t("statOnScreen"), "ohStatScreen", WAIT);
      h += stat(I.clock, t("statNextZman"), "ohStatZman", WAIT);
      if (role.isSuperAdmin) h += stat(I.cloud, t("statBackup"), "ohStatBackup", esc(t("statBackupValue")) + " <small>" + esc(t("statBackupTime")) + "</small>");
      else if (role.canScreen) h += stat(I.cal, t("statDrafts"), "ohStatDrafts", WAIT);
      if (financeOnly) {
        h += stat(I.wallet, t("statToday"), "ohStatToday", WAIT);
        h += stat(I.book, t("statNedarim"), "ohStatNedarim", WAIT);
      }
      h += "</section>";
    }
    /* 2040 phase 1: "the system notices before you", src/ui/oh-alerts.js */
    if (gabbai) h += '<div id="ohAlerts" hidden></div>';
    /* Stage D: the super admin sees waiting join requests here, one tap to them */
    if (role.isSuperAdmin) h += '<a class="card noaccess" id="ohJoinAlert" hidden href="' + ROOT + 'finance/#members" style="min-height:48px;text-decoration:none"></a>';
    var shown = TILES.filter(function (x) { return x.can(role); });
    if (shown.length) {
      h += '<h2 class="sec-title">' + esc(t("sectionTitle")) + " <span>" + esc(t("sectionTitleEn")) + "</span></h2>";
      /* mockup A: 8 or 4 tiles in rows of 4, 6 (or 3) tiles in rows of 3 */
      var t3 = shown.length % 3 === 0 && shown.length % 4 !== 0;
      h += '<section class="tiles' + (t3 ? " t3" : "") + '" id="ohTiles">' + shown.map(function (x) {
        var L1 = tile(x.k);
        return '<a class="card tile" data-tile="' + x.k + '" href="' + ROOT + x.href + '">' +
          (x.count ? '<span class="count" id="ohTileCount" hidden></span>' : "") +
          '<span class="tic">' + x.icon + '</span><span class="tb"><h3>' + esc(L1.title) + '</h3><span class="en">' + esc(L1.en) + '</span><p class="oh-help">' + esc(L1.text) + "</p></span>" +
          '<span class="go"><b>' + esc(t("tileGo", "כניסה")) + "</b>" + I.arrow + "</span></a>";
      }).join("") + "</section>";
    }
    /* Hanoch 2026-11-04 5:46 AM: no lock banners and no "want access?" lines.
       A gabbai simply does not see what is not theirs; only an account with no
       access at all hears one neutral line. */
    var na = "";
    if (!role.authorized) na = t("notAuthorized");
    if (na) h += '<div class="card noaccess" id="ohNoAccess">' + I.lock + "<span>" + esc(na) + "</span></div>";
    main.innerHTML = h;
    var fb = window.OH_FIREBASE;
    if (role.isSuperAdmin && fb && fb.loadJoinRequests) {
      fb.loadJoinRequests().then(function (r) {
        var el = document.getElementById("ohJoinAlert"), n = r && r.ok ? r.items.length : 0;
        if (el && n) { el.textContent = "בקשות הצטרפות (" + n + ")"; el.hidden = false; }
      }, function () {});
    }
    startData(user, role);
  }

  /* ---------- live data ---------- */
  function setV(id, html) { var el = document.getElementById(id); if (el && el.innerHTML !== html) el.innerHTML = html; }
  function unit(n, many, one) { return n + " <small>" + esc(n === 1 && one ? one : many) + "</small>"; }
  function stopData() {
    if (state.unsub) { try { state.unsub(); } catch (e) {} state.unsub = null; }
    if (state.zt) { clearInterval(state.zt); state.zt = null; }
  }
  function startData(user, role) {
    stopData();
    var mtv = document.getElementById("ohMtv");
    if (mtv) {
      var f = document.createElement("iframe");
      f.src = ROOT + "tv/"; f.title = t("liveOnScreen"); f.setAttribute("tabindex", "-1"); f.setAttribute("aria-hidden", "true");
      mtv.appendChild(f); state.frame = f;
      var fit = function () { var w = mtv.clientWidth; if (w) f.style.transform = "scale(" + (w / 1920) + ")"; };
      fit(); if (window.ResizeObserver) new ResizeObserver(fit).observe(mtv); else window.addEventListener("resize", fit);
      f.addEventListener("load", function () { setTimeout(readZman, 1500); });
    }
    if (role.canScreen && window.OH_SCREEN_CONTENT && window.OH_SCREEN_CONTENT.subscribe) {
      state.unsub = window.OH_SCREEN_CONTENT.subscribe("editor", function (items, err) {
        if (err || !items) { setV("ohStatScreen", "-"); setV("ohStatDrafts", "-"); return; }
        var pub = items.filter(function (x) { return x.status === "published"; }).length;
        var drafts = items.filter(function (x) { return x.status === "draft"; }).length;
        setV("ohStatScreen", unit(pub, t("statOnScreenUnit"), t("statOnScreenUnitOne")));
        setV("ohStatDrafts", unit(drafts, t("statDraftsUnit")));
        var c = document.getElementById("ohTileCount");
        if (c) { c.textContent = pub + " " + t("tileCountOnScreen"); c.hidden = false; }
      });
    }
    if (role.canFinance && !role.canScreen && !role.isSuperAdmin) financeStats(user);
  }
  /* The next zman is read from the real public screen in the card, so the
     home always says exactly what the TV says. Checked every 3 seconds. */
  var zTries = 0;
  function readZman() {
    if (!document.getElementById("ohStatZman")) return;
    var html = null, tries = ++zTries;
    try {
      var fr = document.querySelector("#ohMtv iframe");
      var d = fr && fr.contentDocument;
      var row = d && d.querySelector("#zmanList .zman-row.next");
      if (row) {
        var he = row.querySelector(".zn .he"), tm = row.querySelector(".zt");
        if (he && tm) html = esc(he.textContent.trim()) + " <small>" + esc(tm.textContent.trim()) + "</small>";
      }
    } catch (e) {}
    if (html) { zTries = 0; setV("ohStatZman", html); }
    else if (tries > 40) setV("ohStatZman", "-");
  }
  async function financeStats(user) {
    try {
      var fb = window.OH_FIREBASE, db = fb && fb._db && fb._db();
      if (!db) throw new Error("no-db");
      var today = window.OH_UI && window.OH_UI.nyDate ? window.OH_UI.nyDate() : new Date().toISOString().slice(0, 10);
      var wk = new Date(today + "T12:00:00Z"); wk.setUTCDate(wk.getUTCDate() - 6);
      var from = wk.toISOString().slice(0, 10);
      var snap = await db.collection("ledgerEntries").where("date", ">=", from).get();
      var mine = 0, ned = 0, em = String(user.email || "").toLowerCase();
      snap.forEach(function (doc) {
        var x = doc.data() || {};
        if (x.date === today && String(x.enteredBy || "").toLowerCase() === em) mine++;
        if (x.source === "neder") ned++;
      });
      setV("ohStatToday", unit(mine, t("statTodayUnit")));
      setV("ohStatNedarim", unit(ned, t("statNedarimUnit")));
    } catch (e) { setV("ohStatToday", "-"); setV("ohStatNedarim", "-"); }
  }

  /* ---------- state machine: signed out / loading / role ---------- */
  var busy = false;
  async function tick() {
    if (busy) return;
    busy = true;
    try { await tick2(); } finally { busy = false; }
  }
  async function tick2() {
    var fb = window.OH_FIREBASE;
    if (!fb || !fb.ready) {
      if (fb && fb.mode === "test-only") { if (state.key !== "nofb") { state.key = "nofb"; renderGate(t("gateNotReady")); } }
      else if (state.key !== "wait") { state.key = "wait"; renderLoading(); }
      return;
    }
    if (!fb.user) { if (state.key !== "out") { state.key = "out"; renderGate(""); } return; }
    var role = null;
    try { role = await fb.resolveRole(); } catch (e) {}
    if (!role) { if (state.key !== "wait") { state.key = "wait"; renderLoading(); } return; }
    var key = fb.user.uid + "|" + [role.isSuperAdmin, role.canScreen, role.canFinance, role.isCongregant, role.authorized, !!role.loadFailed].join(",");
    if (key === state.key) return;
    state.key = key;
    renderRole(fb.user, role);
  }
  renderLoading();
  tick();
  setInterval(tick, 1000);
  setInterval(readZman, 3000);
})();
