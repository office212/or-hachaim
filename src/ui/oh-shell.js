/* Or Hachaim | shared top bar and phone bottom bar (stage A, 2026-11-03).
   Used by the gabbai home (gabbai/) and by admin, finance, congregant,
   backup and restore. Markup is the approved mockup A top bar.
   - Reads only what firebase-app.js already exposes (OH_FIREBASE.user,
     resolveRole, signIn, signOut). No new Firestore read, no rules change.
   - Every word comes from src/ui/labels.js (OH_LABELS).
   - The phone bottom bar is on/off with OH_LABELS.bottomBar.
   The page says which page it is with <body data-oha-page="home|admin|...">. */
(function () {
  var L = window.OH_LABELS || {};
  function t(k, d) { return (L[k] != null && L[k] !== "") ? L[k] : (d || ""); }
  var me = document.currentScript && document.currentScript.src || "";
  var ROOT = me ? me.replace(/src\/ui\/oh-shell\.js.*$/, "") : "../";
  var HOME = ROOT + "gabbai/", TV = ROOT + "tv/";
  var P = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  var IC = {
    home: P + '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
    tv: P + '<rect x="2.5" y="4.5" width="19" height="13" rx="2"/><path d="M8 21h8M12 17.5V21"/></svg>',
    out: P + '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M9 8l-4 4 4 4M5 12h10"/></svg>',
    cloud: P + '<path d="M7 18.5a4 4 0 0 1-.6-8A6 6 0 0 1 17.8 9.3a4.6 4.6 0 0 1-.3 9.2z"/><path d="M12 11.5v6M9.5 14L12 11.5 14.5 14"/></svg>',
    "in": P + '<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="M15 8l4 4-4 4M19 12H9"/></svg>',
    gear: P + '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.1-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.56-1.1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.04-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.56 1.04H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1.04z"/></svg>',
    /* Notifications (combined package, 2026-11-05) */
    bell: P + '<path d="M12 4a5 5 0 0 0-5 5v3.2c0 .6-.2 1.2-.6 1.7L5 16h14l-1.4-2.1a2.8 2.8 0 0 1-.6-1.7V9a5 5 0 0 0-5-5z"/><path d="M9.5 19a2.5 2.5 0 0 0 5 0"/></svg>',
    down: P + '<path d="M12 4v11m0 0 4-4m-4 4-4-4"/><path d="M5 20h14"/></svg>'
  };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  function firstName(user) {
    if (!user) return "";
    var n = String(user.displayName || "").trim().split(/\s+/)[0];
    if (n) return n;
    return String(user.email || "").split("@")[0];
  }
  function roleLabel(role) {
    if (!role) return "";
    if (role.isSuperAdmin) return t("roleSuperAdmin", "מנהל ראשי");
    if (role.canScreen && role.canFinance) return t("roleBoth", "גבאי | מסך וכספים");
    if (role.canFinance) return t("roleFinance", "גבאי | כספים");
    if (role.canScreen) return t("roleScreen", "גבאי | מסך");
    if (role.isCongregant) return t("roleCongregant", "מתפלל");
    return "";
  }


  /* ---------- 2040 phase 1: the segmented pill control (language) ----------
     Hanoch's reference (2026-11-04): a rounded pill track, the active segment a
     white pill with bold dark text, the others lighter. Direction A colours.
     Flags are small inline drawings shaped like the phone emoji, so they look the
     same on every computer (Windows shows flag emoji as the letters "IL" "US"). */
  var FLAG = {
    il: '<svg class="flag" viewBox="0 0 30 22" aria-hidden="true"><defs><clipPath id="ohFlIl"><rect width="30" height="22" rx="4"/></clipPath></defs><g clip-path="url(#ohFlIl)"><rect width="30" height="22" fill="#fff"/><rect y="2.6" width="30" height="3.2" fill="#1f4fbf"/><rect y="16.2" width="30" height="3.2" fill="#1f4fbf"/><path d="M15 6.9l3.6 6.2h-7.2zM15 15.1l-3.6-6.2h7.2z" fill="none" stroke="#1f4fbf" stroke-width="1.05" stroke-linejoin="round"/></g><rect x=".5" y=".5" width="29" height="21" rx="3.6" fill="none" stroke="rgba(14,44,76,.18)"/></svg>',
    us: '<svg class="flag" viewBox="0 0 30 22" aria-hidden="true"><defs><clipPath id="ohFlUs"><rect width="30" height="22" rx="4"/></clipPath></defs><g clip-path="url(#ohFlUs)"><rect width="30" height="22" fill="#fff"/>' +
      [0, 2, 4, 6, 8, 10, 12].map(function (i) { return '<rect y="' + (i * 22 / 13).toFixed(2) + '" width="30" height="' + (22 / 13).toFixed(2) + '" fill="#c8323c"/>'; }).join("") +
      '<rect width="13" height="11.85" fill="#2b3f86"/>' +
      [[2, 2], [5, 2], [8, 2], [11, 2], [3.5, 4.4], [6.5, 4.4], [9.5, 4.4], [2, 6.8], [5, 6.8], [8, 6.8], [11, 6.8], [3.5, 9.2], [6.5, 9.2], [9.5, 9.2]].map(function (d) { return '<circle cx="' + d[0] + '" cy="' + d[1] + '" r=".62" fill="#fff"/>'; }).join("") +
      '</g><rect x=".5" y=".5" width="29" height="21" rx="3.6" fill="none" stroke="rgba(14,44,76,.18)"/></svg>'
  };
  /* opts: [{v, label, short, flags:["il"|"us"], lang}], active value, aria label */
  function segHtml(id, opts, active, aria) {
    return '<div class="oh-seg" id="' + id + '" role="radiogroup" aria-label="' + esc(aria) + '" dir="rtl"><span class="oh-seg-pill" aria-hidden="true"></span>' +
      opts.map(function (o) {
        var on = o.v === active;
        return '<button type="button" role="radio" class="oh-seg-b' + (on ? " on" : "") + '" aria-checked="' + on + '" data-v="' + esc(o.v) + '"' + (o.lang ? ' lang="' + o.lang + '" dir="' + (o.lang === "en" ? "ltr" : "rtl") + '"' : "") + ">" +
          (o.flags || []).map(function (f) { return FLAG[f] || ""; }).join("") +
          '<span class="oh-seg-full">' + esc(o.label) + "</span>" + (o.short ? '<span class="oh-seg-short">' + esc(o.short) + "</span>" : "") + "</button>";
      }).join("") + "</div>";
  }
  function segPlace(el, instant) {
    if (!el) return;
    var on = el.querySelector(".oh-seg-b.on"), pill = el.querySelector(".oh-seg-pill");
    if (!on || !pill || !on.offsetWidth) return;
    if (instant) pill.style.transition = "none";
    pill.style.width = on.offsetWidth + "px";
    pill.style.transform = "translateX(" + on.offsetLeft + "px)";
    if (instant) { void pill.offsetWidth; pill.style.transition = ""; }
    el.classList.add("ready");
  }
  /* onPick(value) runs after the pill has moved */
  function segWire(el, onPick) {
    if (!el) return;
    segPlace(el, true);
    if (window.ResizeObserver) { try { new ResizeObserver(function () { segPlace(el, true); }).observe(el); } catch (e) {} }
    el.addEventListener("click", function (e) {
      var b = e.target.closest(".oh-seg-b"); if (!b || b.classList.contains("on")) return;
      el.querySelectorAll(".oh-seg-b").forEach(function (x) { x.classList.toggle("on", x === b); x.setAttribute("aria-checked", String(x === b)); });
      segPlace(el, false);
      var v = b.getAttribute("data-v");
      setTimeout(function () { onPick(v); }, 210);
    });
    el.addEventListener("keydown", function (e) {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].indexOf(e.key) < 0) return;
      var bs = Array.prototype.slice.call(el.querySelectorAll(".oh-seg-b")), i = bs.indexOf(document.activeElement); if (i < 0) return;
      e.preventDefault();
      var dir = (e.key === "ArrowLeft" || e.key === "ArrowDown") ? 1 : -1; /* the track is right to left */
      var n = bs[(i + dir + bs.length) % bs.length]; n.focus(); n.click();
    });
  }
  function langSegHtml() {
    var cur = window.OH_LANG === "en" ? "en" : "he";
    return segHtml("ohaLang", [{ v: "he", label: "עברית", short: "עב", flags: ["il"], lang: "he" }, { v: "en", label: "English", short: "EN", flags: ["us"], lang: "en" }], cur, "שפה | Language");
  }
  function setLang(v) {
    try { localStorage.setItem("ohLang", v === "en" ? "en" : "he"); } catch (e) {}
    location.reload();
  }
  var page = "";
  var els = {};
  function build() {
    if (document.getElementById("ohaTopbar")) return;
    page = (document.body.getAttribute("data-oha-page") || "").toLowerCase();
    var isHome = page === "home";
    if (!document.body.classList.contains("oha")) document.body.classList.add("oha-page");
    var h = document.createElement("header");
    h.id = "ohaTopbar";
    h.className = "oha oha-topbar no-print";
    h.innerHTML =
      '<a class="brand" href="' + HOME + '"><span class="logo-badge"><img src="' + ROOT + 'src/assets/logo.svg" alt="' + esc(t("logoAlt", "אור החיים")) + '"></span>' +
      '<span class="brand-txt"><b>' + esc(t("systemName")) + '</b><span>' + esc(t("systemNameEn")) + '</span></span></a>' +
      '<span class="m-only m-name" id="ohaMName" hidden></span>' +
      '<span class="tb-spacer"></span>' +
      '<a class="tb-link' + (isHome ? ' on' : '') + '" id="ohaHome" href="' + HOME + '"' + (isHome ? ' aria-current="page"' : '') + '>' + IC.home + esc(isHome ? t("navHome", "דף הבית") : t("navBackHome", "חזרה לדף הבית")) + '</a>' +
      '<a class="tb-link" id="ohaTv" href="' + TV + '">' + IC.tv + esc(t("navTv")) + '</a>' +
      (page === "backup" ? '<a class="tb-link" id="ohaPair" href="' + ROOT + 'restore/">' + IC.cloud + esc(t("navRestore", "שחזור")) + '</a>' : "") +
      (page === "restore" ? '<a class="tb-link" id="ohaPair" href="' + ROOT + 'backup/">' + IC.cloud + esc(t("navBackup", "גיבוי")) + '</a>' : "") +
      '<a class="tb-gear" id="ohaSettings" href="' + ROOT + 'gabbai/settings/" aria-label="' + esc(t("navSettings", "הגדרות")) + '" hidden' + (page === "settings" ? ' aria-current="page"' : "") + '>' + IC.gear + '<span>' + esc(t("navSettings", "הגדרות")) + "</span></a>" +
      langSegHtml() +
      /* Notifications (combined package, 2026-11-05): a bell, signed-in pages only,
         never the landing page (oh-shell never builds there, see comment above).
         The dropdown panel also holds the one-time "הפעל התראות" row. */
      '<span class="oha-bell-wrap" id="ohaBellWrap" hidden>' +
        '<button type="button" class="tb-link tb-bell" id="ohaBell" aria-haspopup="true" aria-expanded="false" aria-label="' + esc(t("bellTitle", "התראות")) + '">' + IC.bell + '<span class="oha-bell-badge" id="ohaBellBadge" hidden>0</span></button>' +
        '<div class="oha-bell-panel" id="ohaBellPanel" hidden role="dialog" aria-label="' + esc(t("bellTitle", "התראות")) + '">' +
          '<div class="oha-bell-head"><b>' + esc(t("bellTitle", "התראות")) + '</b><button type="button" class="oha-bell-markall" id="ohaBellMarkAll" hidden>' + esc(t("bellMarkAllRead", "סמן הכל כנקרא")) + '</button></div>' +
          '<div class="oha-bell-enable" id="ohaNotifyRow" hidden><button type="button" class="btn secondary" id="ohaNotifyBtn">' + esc(t("notifyIdle", "הפעל התראות")) + '</button><p class="hint" id="ohaNotifyNote" hidden></p></div>' +
          '<div class="oha-bell-list" id="ohaBellList"><p class="hint">' + esc(t("bellEmpty", "אין התראות")) + '</p></div>' +
        '</div>' +
      '</span>' +
      '<span class="who" id="ohaWho" hidden><span class="avatar" id="ohaAvatar"></span><span class="who-txt"><b id="ohaName"></b><span id="ohaRole"></span></span></span>' +
      '<button type="button" class="tb-link tb-out" id="ohaOut" hidden>' + IC.out + '<span>' + esc(t("signOut", "יציאה")) + '</span></button>' +
      '<button type="button" class="tb-link tb-out" id="ohaIn" hidden>' + IC["in"] + '<span>' + esc(t("signIn", "כניסה")) + '</span></button>' +
      '<span class="oha-auth-msg" id="ohaAuthMsg" hidden></span>';
    document.body.insertBefore(h, document.body.firstChild);
    els = { gear: h.querySelector("#ohaSettings"), mname: h.querySelector("#ohaMName"), who: h.querySelector("#ohaWho"), avatar: h.querySelector("#ohaAvatar"),
      name: h.querySelector("#ohaName"), role: h.querySelector("#ohaRole"), out: h.querySelector("#ohaOut"), "in": h.querySelector("#ohaIn"),
      authMsg: h.querySelector("#ohaAuthMsg"), bellWrap: h.querySelector("#ohaBellWrap"), bell: h.querySelector("#ohaBell"), bellBadge: h.querySelector("#ohaBellBadge"),
      bellPanel: h.querySelector("#ohaBellPanel"), bellMarkAll: h.querySelector("#ohaBellMarkAll"), bellList: h.querySelector("#ohaBellList"),
      notifyRow: h.querySelector("#ohaNotifyRow"), notifyBtn: h.querySelector("#ohaNotifyBtn"), notifyNote: h.querySelector("#ohaNotifyNote") };
    segWire(h.querySelector("#ohaLang"), setLang);
    els.out.addEventListener("click", signOut);
    els["in"].addEventListener("click", signIn);
    els.bell.addEventListener("click", function (e) { e.stopPropagation(); toggleBellPanel(); });
    els.bellMarkAll.addEventListener("click", markAllNotificationsRead);
    els.notifyBtn.addEventListener("click", onNotifyBtnClick);
    document.addEventListener("click", function (e) {
      if (els.bellPanel && !els.bellPanel.hidden && !els.bellWrap.contains(e.target)) closeBellPanel();
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeBellPanel(); });
    buildInstallUi();

    if (L.bottomBar === false) {
      document.body.classList.add("oha-no-bnav");
    } else {
      var n = document.createElement("nav");
      n.id = "ohaBnav";
      n.className = "oha oha-bnav no-print";
      n.setAttribute("aria-label", t("navHome", "דף הבית"));
      n.innerHTML =
        '<a' + (isHome ? ' class="on" aria-current="page"' : '') + ' href="' + HOME + '">' + IC.home + esc(t("bottomHome", "דף הבית")) + '</a>' +
        '<a href="' + TV + '">' + IC.tv + esc(t("bottomTimes", "זמני תפילה")) + '</a>' +
        '<a href="#" id="ohaBOut">' + IC.out + '<span id="ohaBOutTxt">' + esc(t("bottomSignOut", "יציאה")) + '</span></a>';
      document.body.appendChild(n);
      document.body.classList.add("oha-has-bnav");
      n.querySelector("#ohaBOut").addEventListener("click", function (e) {
        e.preventDefault();
        var fb = window.OH_FIREBASE;
        if (fb && fb.user) signOut(); else signIn();
      });
    }
    refresh();
    setInterval(refresh, 1000);
    scrollToHash();
  }
  /* A home tile can point at a section (gabbai/tv/#ptSection, finance/#nedarim).
     The inner pages show their sections only after sign-in, so wait until
     the section is visible, then scroll to it once. */
  function scrollToHash() {
    var id = decodeURIComponent((location.hash || "").slice(1));
    if (!id || !/^[A-Za-z][\w-]*$/.test(id)) return;
    var n = 0, iv = setInterval(function () {
      var el = document.getElementById(id);
      if (el && el.offsetParent !== null && el.getBoundingClientRect().height > 0) {
        clearInterval(iv);
        try { el.scrollIntoView({ block: "start" }); } catch (e) { el.scrollIntoView(); }
      } else if (++n > 40) clearInterval(iv);
    }, 250);
  }

  function signOut() {
    var fb = window.OH_FIREBASE;
    if (!fb || !fb.signOut) return;
    /* 2040 phase 2 (Hanoch 9:21 AM): signing out goes straight to the landing page */
    Promise.resolve(fb.signOut()).then(function () { location.href = ROOT; }, function () { location.href = ROOT; });
  }
  var authMsgTimer = null;
  function sayAuthMsg(text) {
    if (!els.authMsg) return;
    els.authMsg.textContent = text;
    els.authMsg.hidden = !text;
    clearTimeout(authMsgTimer);
    if (text) authMsgTimer = setTimeout(function () { els.authMsg.hidden = true; }, 6000);
  }
  /* Auth fix (2026-11-05): this used to swallow every sign-in failure with
     r.catch(function(){}), so a blocked or unsupported popup on any of
     these pages (finance, gabbai, admin, congregant, backup, restore)
     showed nothing at all: no error, no redirect, no sign-in (see
     NOTES.md). firebase-app.js's signIn() now falls back to redirect on
     its own for the codes that mean a popup cannot work here; what is
     left here is a real failure (e.g. the Google picker was closed, or
     something else went wrong), which now gets one short visible line
     instead of silence. A user closing the picker on purpose stays quiet. */
  function signIn() {
    var fb = window.OH_FIREBASE;
    if (!fb || !fb.signIn) return;
    var r = fb.signIn();
    if (r && r.catch) r.catch(function (e) {
      var c = e && e.code || "";
      if (c === "auth/popup-closed-by-user" || c === "auth/cancelled-popup-request" || c === "auth/user-cancelled") return;
      sayAuthMsg(t("signinError", "הכניסה לא הצליחה. נסה שוב."));
    });
  }

  var last = "";
  async function refresh() {
    var fb = window.OH_FIREBASE;
    var user = fb && fb.ready ? fb.user : null;
    var role = null;
    if (user) { try { role = await fb.resolveRole(); } catch (e) { role = null; } }
    var key = user ? (user.uid + "|" + (role ? roleLabel(role) + "|" + role.authorized : "?")) : (fb && fb.ready ? "out" : "wait");
    /* 2040 phase 2 (Hanoch 9:42 AM): explanation texts (.oh-help) for the super admin only */
    document.documentElement.classList.toggle("oh-sa", !!(user && role && role.isSuperAdmin));
    if (key === last) return;
    last = key;
    var signedIn = !!user;
    var name = firstName(user), rl = roleLabel(role);
    els.who.hidden = !signedIn;
    if (els.gear) els.gear.hidden = !(signedIn && role && (role.isSuperAdmin || role.canScreen || role.canFinance)); /* 2040 phase 1: ONE settings button, gabbaim only */
    els.out.hidden = !signedIn;
    els["in"].hidden = signedIn || !(fb && fb.ready);
    els.mname.hidden = !signedIn;
    if (els.bellWrap) els.bellWrap.hidden = !signedIn;
    if (signedIn) {
      els.avatar.textContent = name ? name.charAt(0) : "";
      els.name.textContent = name;
      els.role.textContent = rl;
      els.role.hidden = !rl;
      els.mname.innerHTML = esc((t("hello", "שלום,") + " " + name).trim()) + (rl ? "<span>" + esc(rl) + "</span>" : "");
    }
    var bt = document.getElementById("ohaBOutTxt");
    if (bt) bt.textContent = signedIn ? t("bottomSignOut", "יציאה") : t("signIn", "כניסה");
    /* Combined package (2026-11-05): install popup + notifications, signed-in
       dashboard pages only, wired once per sign-in (not every refresh tick). */
    if (signedIn && user.uid !== notifyWiredUid) {
      notifyWiredUid = user.uid;
      wireNotifications(user.uid);
      maybeShowInstallPopup();
    } else if (!signedIn && notifyWiredUid) {
      notifyWiredUid = null;
      teardownNotifications();
    }
  }

  /* 2040 phase 1: Ctrl+K (Cmd+K) opens the command bar from any gabbai page;
     on a page that has the bar (home, admin) oh-cmdbar.js focuses it instead. */
  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K" || e.key === "ל") && !document.getElementById("ohCmdInput")) { e.preventDefault(); location.href = HOME + "#cmd"; }
  });

  /* ===================================================================
     Install popup + footer link + notifications (combined package, 2026-11-05)
     Signed-in dashboard pages only (this file never builds on the landing
     page at all, see the comment at the top), wired once per sign-in.
     =================================================================== */

  /* Muse: paste the Web Push "VAPID key" here (see MUSE_INSTRUCTIONS.md for
     exactly where to find it in the Firebase console). Nothing works until
     this is a real key; with the placeholder left in place, the "הפעל
     התראות" button shows a plain "not available yet" note instead of
     failing silently. */
  var VAPID_KEY = "BK4jAjFBt0ARPyfy0-M5KXzkhgsMnWGrmnKfu9fjvqSkhSuoe5C55Hklkox-MAyZ5N63uv__y5-ngpqlYOFCiVI";

  var notifyWiredUid = null;
  var unsubNotifications = null;
  var notifDocs = [];
  var pushState = "idle"; /* idle | active | denied | unsupported | ios-needs-install | busy */

  function closeBellPanel() {
    if (!els.bellPanel) return;
    els.bellPanel.hidden = true;
    if (els.bell) els.bell.setAttribute("aria-expanded", "false");
  }
  function toggleBellPanel() {
    if (!els.bellPanel) return;
    var open = els.bellPanel.hidden;
    els.bellPanel.hidden = !open;
    if (els.bell) els.bell.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function fmtWhen(ts) {
    try {
      var ms = ts && ts.toMillis ? ts.toMillis() : (ts ? +new Date(ts) : 0);
      if (!ms) return "";
      var d = new Date(ms);
      return new Intl.DateTimeFormat("he", { timeZone: "America/New_York", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
    } catch (e) { return ""; }
  }

  function renderBellList() {
    if (!els.bellList) return;
    var sorted = notifDocs.slice().sort(function (a, b) {
      var am = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
      var bm = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
      return bm - am;
    });
    var unread = sorted.filter(function (n) { return !n.read; });
    if (els.bellBadge) {
      els.bellBadge.hidden = unread.length === 0;
      els.bellBadge.textContent = unread.length > 9 ? "9+" : String(unread.length);
    }
    if (els.bellMarkAll) els.bellMarkAll.hidden = unread.length === 0;
    if (!sorted.length) {
      els.bellList.innerHTML = '<p class="hint">' + esc(t("bellEmpty", "אין התראות")) + '</p>';
      return;
    }
    els.bellList.innerHTML = sorted.slice(0, 50).map(function (n) {
      return '<button type="button" class="oha-bell-item' + (n.read ? "" : " unread") + '" data-id="' + esc(n.id) + '">' +
        '<b>' + esc(n.title || "") + '</b>' + (n.body ? '<span>' + esc(n.body) + '</span>' : "") +
        '<small>' + esc(fmtWhen(n.createdAt)) + '</small></button>';
    }).join("");
    Array.prototype.forEach.call(els.bellList.querySelectorAll(".oha-bell-item"), function (btn) {
      btn.addEventListener("click", function () { markOneRead(btn.getAttribute("data-id")); });
    });
  }

  function markOneRead(id) {
    var fb = window.OH_FIREBASE, db = fb && fb._db && fb._db();
    if (!db || !id) return;
    db.collection("notifications").doc(id).update({ read: true }).catch(function () {});
  }
  function markAllNotificationsRead() {
    var fb = window.OH_FIREBASE, db = fb && fb._db && fb._db();
    if (!db || !window.firebase) return;
    var unread = notifDocs.filter(function (n) { return !n.read; });
    if (!unread.length) return;
    var batch = db.batch();
    unread.forEach(function (n) { batch.update(db.collection("notifications").doc(n.id), { read: true }); });
    batch.commit().catch(function () {});
  }

  /* One Firestore listener per sign-in. No orderBy/composite index: the
     collection is small per person (one shul), so fetching every document
     addressed to this uid and sorting in the browser is simpler and needs
     no index to deploy (see NOTES.md). */
  function wireNotifications(uid) {
    teardownNotifications();
    var fb = window.OH_FIREBASE, db = fb && fb._db && fb._db();
    if (!db) return;
    try {
      unsubNotifications = db.collection("notifications").where("recipientUid", "==", uid).onSnapshot(function (snap) {
        notifDocs = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
        renderBellList();
      }, function () { /* offline or rules hiccup: leave the last known list showing */ });
    } catch (e) {}
    syncNotifyRow();
  }
  function teardownNotifications() {
    if (unsubNotifications) { try { unsubNotifications(); } catch (e) {} unsubNotifications = null; }
    notifDocs = [];
    renderBellList();
  }

  /* ---------- the "הפעל התראות" row inside the bell panel ---------- */
  function supportsPush() {
    return "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
  }
  function pushLocalKey(uid) { return "ohPushToken:" + uid; }
  function syncNotifyRow() {
    if (!els.notifyRow) return;
    var pwa = window.OH_PWA;
    var ios = pwa && pwa.isIos() && !pwa.isStandalone();
    els.notifyRow.hidden = false;
    if (!supportsPush()) {
      els.notifyBtn.hidden = true; els.notifyNote.hidden = false;
      els.notifyNote.textContent = t("notifyUnsupported", "הדפדפן הזה לא תומך בהתראות.");
      return;
    }
    if (ios) {
      els.notifyBtn.hidden = true; els.notifyNote.hidden = false;
      els.notifyNote.textContent = t("notifyIosNeedsInstall", "באייפון: התראות עובדות רק כשהאפליקציה מותקנת למסך הבית.");
      return;
    }
    els.notifyNote.hidden = true; els.notifyBtn.hidden = false;
    var uid = notifyWiredUid;
    var already = uid && Notification.permission === "granted" && (function () { try { return !!localStorage.getItem(pushLocalKey(uid)); } catch (e) { return false; } })();
    if (Notification.permission === "denied") {
      els.notifyBtn.disabled = true;
      els.notifyBtn.textContent = t("notifyBlocked", "ההתראות חסומות בדפדפן");
    } else if (already) {
      els.notifyBtn.disabled = false;
      els.notifyBtn.textContent = t("notifyActive", "ההתראות פעילות ✓");
    } else {
      els.notifyBtn.disabled = false;
      els.notifyBtn.textContent = t("notifyIdle", "הפעל התראות");
    }
  }

  var messagingSdkLoading = null;
  function loadMessagingSdk() {
    if (window.firebase && window.firebase.messaging) return Promise.resolve();
    if (messagingSdkLoading) return messagingSdkLoading;
    messagingSdkLoading = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js";
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
    return messagingSdkLoading;
  }

  function saveToken(uid, email, token) {
    var fb = window.OH_FIREBASE, db = fb && fb._db && fb._db();
    if (!db) return Promise.reject(new Error("no-db"));
    var ref = db.collection("notificationTokens").doc(uid);
    return ref.get().then(function (snap) {
      var tokens = (snap.exists && Array.isArray(snap.data().tokens)) ? snap.data().tokens.slice() : [];
      tokens = tokens.filter(function (x) { return x && x !== token; });
      tokens.push(token);
      if (tokens.length > 6) tokens = tokens.slice(tokens.length - 6);
      return ref.set({
        uid: uid, email: email, tokens: tokens,
        updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
      });
    });
  }
  function removeToken(uid, token) {
    var fb = window.OH_FIREBASE, db = fb && fb._db && fb._db();
    if (!db) return Promise.resolve();
    var ref = db.collection("notificationTokens").doc(uid);
    return ref.get().then(function (snap) {
      if (!snap.exists) return;
      var tokens = (Array.isArray(snap.data().tokens) ? snap.data().tokens : []).filter(function (x) { return x !== token; });
      return ref.update({ tokens: tokens, updatedAt: window.firebase.firestore.FieldValue.serverTimestamp() });
    }).catch(function () {});
  }

  function onNotifyBtnClick() {
    var fb = window.OH_FIREBASE, user = fb && fb.user;
    if (!user || !notifyWiredUid) return;
    if (Notification.permission === "denied") return; /* nothing to do, the browser owns this */
    var uid = notifyWiredUid, email = user.email || "";
    var already = (function () { try { return !!localStorage.getItem(pushLocalKey(uid)); } catch (e) { return false; } })();
    if (already) {
      /* toggle off */
      var tok = (function () { try { return localStorage.getItem(pushLocalKey(uid)); } catch (e) { return null; } })();
      try { localStorage.removeItem(pushLocalKey(uid)); } catch (e) {}
      if (tok) removeToken(uid, tok);
      syncNotifyRow();
      return;
    }
    if (VAPID_KEY === "PASTE_VAPID_KEY_HERE") {
      els.notifyNote.hidden = false; els.notifyBtn.hidden = true;
      els.notifyNote.textContent = t("notifyNotConfigured", "ההתראות עוד לא מוגדרות. נסה שוב מאוחר יותר.");
      return;
    }
    els.notifyBtn.disabled = true;
    els.notifyBtn.textContent = t("notifyBusy", "רגע...");
    Notification.requestPermission().then(function (perm) {
      if (perm !== "granted") { syncNotifyRow(); return; }
      return loadMessagingSdk()
        .then(function () { return navigator.serviceWorker.ready; })
        .then(function (reg) { return window.firebase.messaging().getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: reg }); })
        .then(function (token) {
          if (!token) throw new Error("no-token");
          return saveToken(uid, email, token).then(function () {
            try { localStorage.setItem(pushLocalKey(uid), token); } catch (e) {}
          });
        })
        .catch(function () {
          els.notifyNote.hidden = false; els.notifyBtn.hidden = true;
          els.notifyNote.textContent = t("notifyFailed", "לא הצלחנו להפעיל התראות. נסה שוב מאוחר יותר.");
        });
    }).then(syncNotifyRow, syncNotifyRow);
  }

  /* ---------- install popup + footer link ---------- */
  var installUi = null;
  function buildInstallUi() {
    if (installUi) return;
    var pop = document.createElement("div");
    pop.className = "oha-install-popup"; pop.id = "ohaInstallPopup"; pop.hidden = true;
    pop.innerHTML =
      '<div class="oha-install-card" role="dialog" aria-label="' + esc(t("installTitle", "התקנת האפליקציה")) + '">' +
        '<p class="oha-install-title">' + esc(t("installTitle", "התקנת האפליקציה")) + '</p>' +
        '<p class="oha-install-body" id="ohaInstallBody"></p>' +
        '<div class="oha-install-actions" id="ohaInstallActions"></div>' +
      '</div>';
    document.body.appendChild(pop);
    var foot = document.createElement("div");
    foot.className = "oha-install-foot"; foot.id = "ohaInstallFoot"; foot.hidden = true;
    foot.innerHTML = '<button type="button" id="ohaInstallFootBtn">' + esc(t("installFooterLink", "התקן אפליקציה")) + '</button>';
    document.body.appendChild(foot);
    installUi = { pop: pop, body: pop.querySelector("#ohaInstallBody"), actions: pop.querySelector("#ohaInstallActions"), foot: foot, footBtn: foot.querySelector("#ohaInstallFootBtn") };
    installUi.footBtn.addEventListener("click", function () { openInstallPopup(true); });
    var pwa = window.OH_PWA;
    if (pwa && pwa.onChange) pwa.onChange(syncInstallFoot);
    syncInstallFoot();
  }
  function syncInstallFoot() {
    if (!installUi) return;
    var pwa = window.OH_PWA;
    var standalone = pwa && pwa.isStandalone();
    var ios = pwa && pwa.isIos();
    var actionable = !standalone && (ios || (pwa && pwa.canPrompt()));
    installUi.foot.hidden = !actionable;
  }
  var INSTALL_SEEN_KEY = "ohInstallPopupSeen";
  function openInstallPopup(forced) {
    if (!installUi) return;
    var pwa = window.OH_PWA;
    var ios = pwa && pwa.isIos();
    installUi.body.textContent = ios
      ? t("installIosBody", "כדי להתקין: לוחצים על כפתור השיתוף, ואז על \u201cהוסף למסך הבית\u201d.")
      : t("installBody", "אפשר להתקין את האתר כאפליקציה במסך הבית, לגישה מהירה.");
    if (ios) {
      installUi.actions.innerHTML = '<button type="button" class="btn" id="ohaInstallGotIt">' + esc(t("installGotIt", "הבנתי")) + '</button>';
      installUi.pop.hidden = false;
      document.getElementById("ohaInstallGotIt").addEventListener("click", function () { installUi.pop.hidden = true; });
    } else {
      installUi.actions.innerHTML =
        '<button type="button" class="btn" id="ohaInstallGo">' + esc(t("installNow", "התקן")) + '</button>' +
        '<button type="button" class="btn secondary" id="ohaInstallLater">' + esc(t("installLater", "לא עכשיו")) + '</button>';
      installUi.pop.hidden = false;
      document.getElementById("ohaInstallLater").addEventListener("click", function () { installUi.pop.hidden = true; });
      document.getElementById("ohaInstallGo").addEventListener("click", function () {
        installUi.pop.hidden = true;
        if (pwa && pwa.prompt) pwa.prompt();
      });
    }
    if (!forced) { try { localStorage.setItem(INSTALL_SEEN_KEY, "1"); } catch (e) {} }
  }
  function maybeShowInstallPopup() {
    if (!installUi) return;
    var pwa = window.OH_PWA;
    if (!pwa || pwa.isStandalone()) return;
    var seen = false;
    try { seen = localStorage.getItem(INSTALL_SEEN_KEY) === "1"; } catch (e) {}
    if (seen) return;
    var eligible = pwa.isIos() || pwa.canPrompt();
    if (!eligible) {
      /* beforeinstallprompt may still fire after this point (it can arrive
         late); try again once if it does, still only ever showing once. */
      pwa.onChange(function () {
        if (pwa.canPrompt()) { try { if (localStorage.getItem(INSTALL_SEEN_KEY) !== "1") openInstallPopup(false); } catch (e) {} }
      });
      return;
    }
    openInstallPopup(false);
  }


  window.OH_SHELL = { firstName: firstName, roleLabel: roleLabel, root: ROOT, home: HOME, tv: TV, icons: IC, segHtml: segHtml, segWire: segWire, segPlace: segPlace, flags: FLAG, setLang: setLang };
  /* 2040 phase 1: the older page bodies switch language through oh-i18n.js */
  if (!window.OH_I18N && (window.OH_LANG === "en" || Object.keys(window.OH_PAGE_TEXT_HE || {}).length)) {
    var sc = document.createElement("script"); sc.src = ROOT + "src/ui/oh-i18n.js"; document.head.appendChild(sc);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build); else build();
})();
