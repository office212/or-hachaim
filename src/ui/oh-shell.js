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
    "in": P + '<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="M15 8l4 4-4 4M19 12H9"/></svg>'
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
      '<span class="who" id="ohaWho" hidden><span class="avatar" id="ohaAvatar"></span><span class="who-txt"><b id="ohaName"></b><span id="ohaRole"></span></span></span>' +
      '<button type="button" class="tb-link tb-out" id="ohaOut" hidden>' + IC.out + '<span>' + esc(t("signOut", "יציאה")) + '</span></button>' +
      '<button type="button" class="tb-link tb-out" id="ohaIn" hidden>' + IC["in"] + '<span>' + esc(t("signIn", "כניסה")) + '</span></button>';
    document.body.insertBefore(h, document.body.firstChild);
    els = { mname: h.querySelector("#ohaMName"), who: h.querySelector("#ohaWho"), avatar: h.querySelector("#ohaAvatar"),
      name: h.querySelector("#ohaName"), role: h.querySelector("#ohaRole"), out: h.querySelector("#ohaOut"), "in": h.querySelector("#ohaIn") };
    els.out.addEventListener("click", signOut);
    els["in"].addEventListener("click", signIn);

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
  /* A home tile can point at a section (admin/#ptSection, finance/#nedarim).
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
    Promise.resolve(fb.signOut()).then(function () { location.href = HOME; }, function () { location.href = HOME; });
  }
  function signIn() {
    var fb = window.OH_FIREBASE;
    if (!fb || !fb.signIn) return;
    var r = fb.signIn();
    if (r && r.catch) r.catch(function () {});
  }

  var last = "";
  async function refresh() {
    var fb = window.OH_FIREBASE;
    var user = fb && fb.ready ? fb.user : null;
    var role = null;
    if (user) { try { role = await fb.resolveRole(); } catch (e) { role = null; } }
    var key = user ? (user.uid + "|" + (role ? roleLabel(role) + "|" + role.authorized : "?")) : (fb && fb.ready ? "out" : "wait");
    if (key === last) return;
    last = key;
    var signedIn = !!user;
    var name = firstName(user), rl = roleLabel(role);
    els.who.hidden = !signedIn;
    els.out.hidden = !signedIn;
    els["in"].hidden = signedIn || !(fb && fb.ready);
    els.mname.hidden = !signedIn;
    if (signedIn) {
      els.avatar.textContent = name ? name.charAt(0) : "";
      els.name.textContent = name;
      els.role.textContent = rl;
      els.role.hidden = !rl;
      els.mname.innerHTML = esc((t("hello", "שלום,") + " " + name).trim()) + (rl ? "<span>" + esc(rl) + "</span>" : "");
    }
    var bt = document.getElementById("ohaBOutTxt");
    if (bt) bt.textContent = signedIn ? t("bottomSignOut", "יציאה") : t("signIn", "כניסה");
  }

  window.OH_SHELL = { firstName: firstName, roleLabel: roleLabel, root: ROOT, home: HOME, tv: TV, icons: IC };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build); else build();
})();
