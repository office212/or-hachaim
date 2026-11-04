/* Or Hachaim | public landing page (index.html), 2040 phase 2 (Nov 4 2026).
   - ONE language at a time: Hebrew first, the same עב | EN pill as the gabbai system
     (OH_SHELL.segHtml / segWire from src/ui/oh-shell.js), the same saved choice
     (localStorage "ohLang"), flips lang / dir in place.
   - Every word comes from src/home/home-texts.js (the defaults) with the super
     admin's saved words on top: Firestore settings/homeTexts {texts, textsEn}.
     A missing doc or a failed read = the defaults, nothing breaks.
   - Preview: the editor can postMessage({type: "oh-home-texts-preview", texts,
     textsEn, lang?}) to a same-origin iframe of "/" to show a draft unsaved.
   - The top-bar button IS the Google sign-in (popup, redirect if the popup is
     blocked). Signed in: it becomes "מערכת הגבאים" (gabbai/) or "החשבון שלי".
   - Today's zmanim stay hidden until PUBLIC_ZMANIM is true (Hanoch's decision). */
(function () {
  "use strict";
  var PUBLIC_ZMANIM = window.OH_PUBLIC_ZMANIM === true; /* set to true to show today's zmanim on the landing */
  var T = window.OH_HOME_TEXTS || {};
  var DEF = { he: T.he || {}, en: T.en || {} }, INFO = T.info || {};
  var saved = { he: {}, en: {} }, preview = null;
  var lang = window.OH_LANG === "en" ? "en" : "he";
  var TZ = "America/New_York";
  var root = document.documentElement;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function clean(m) {
    var o = {};
    if (m && typeof m === "object") Object.keys(m).forEach(function (k) { if (INFO[k] && typeof m[k] === "string" && m[k].trim()) o[k] = m[k]; });
    return o;
  }
  /* the word for a key in the current language: preview > saved > default */
  function w(k, lg) {
    lg = lg || lang;
    var ov = preview || saved;
    if (INFO[k] && INFO[k].shared) lg = "he";
    var v = ov[lg] && ov[lg][k];
    if (v == null || v === "") v = DEF[lg][k];
    if ((v == null) && lg === "en") v = ""; /* no English default = hidden in English */
    return v == null ? "" : String(v);
  }

  /* ---------- words on the page ---------- */
  function fill() {
    var els = document.querySelectorAll("[data-k]");
    for (var i = 0; i < els.length; i++) {
      var el = els[i], v = w(el.getAttribute("data-k"));
      if (!v) { el.hidden = true; continue; }
      el.hidden = false;
      /* Hebrew text with English words inside ("Or Hachaim Congregation"): keep each English run whole */
      if (lang === "he" && /[A-Za-z]/.test(v) && /[\u0590-\u05FF]/.test(v)) el.innerHTML = esc(v).replace(/[A-Za-z][A-Za-z0-9 .,'&;#-]*[A-Za-z0-9]/g, function (m) { return '<bdi dir="ltr" lang="en">' + m + "</bdi>"; });
      else el.textContent = v;
    }
    /* a link whose words are all hidden is hidden too */
    document.querySelectorAll("#siteNav a, .nav-btn, .hero-cta, .today-more a").forEach(function (a) { var t = a.querySelector("[data-k]"); a.hidden = t ? t.hidden : !a.textContent.trim(); });
    document.title = w("pageTitle") || document.title;
  }
  function telOf(s) { var d = String(s || "").replace(/\D/g, ""); if (d.length === 10) d = "1" + d; return d.length >= 11 ? d : ""; }
  var IC = (function () {
    var P = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
    return {
      phone: P + '<path d="M5 4h3.2l1.6 4-2 1.3a11 11 0 0 0 4.9 4.9l1.3-2 4 1.6V17a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>',
      email: P + '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/></svg>',
      wa: P + '<path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z"/><path d="M9.2 8.6c.2-.4.5-.4.8-.4h.5l.8 1.9-.6.8c.5 1.1 1.4 2 2.5 2.5l.8-.6 1.9.8v.5c0 .4-.1.7-.5.9-.6.3-1.4.4-2.3.1a7 7 0 0 1-4-4c-.3-.9-.2-1.7.1-2.5z"/></svg>'
    };
  })();
  function contact() {
    var phones = [w("phone1"), w("phone2")].filter(function (p) { return p && telOf(p); });
    var email = w("email");
    function card(icon, label, links) {
      if (!links.length) return "";
      return '<article class="contact-card"><span class="cc-ic">' + icon + '</span><h3>' + esc(label) + "</h3><div class=\"cc-links\">" +
        links.map(function (l) { return '<a class="cc-link" href="' + esc(l.href) + '"' + (l.ext ? ' target="_blank" rel="noopener"' : "") + ' dir="ltr">' + esc(l.text) + "</a>"; }).join("") + "</div></article>";
    }
    var html =
      card(IC.phone, w("phoneLabel"), phones.map(function (p) { return { href: "tel:+" + telOf(p), text: p }; })) +
      card(IC.email, w("emailLabel"), email ? [{ href: "mailto:" + email, text: email }] : []) +
      card(IC.wa, w("whatsappLabel"), phones.map(function (p) { return { href: "https://wa.me/" + telOf(p), text: p, ext: true }; }));
    var box = document.getElementById("contactCards"), sec = document.getElementById("contact");
    if (box) box.innerHTML = html;
    if (sec) sec.hidden = !html;
    var nl = document.querySelector('#siteNav a[href="#contact"]'); if (nl && !html) nl.hidden = true;
    var fl = document.getElementById("footerLinks");
    if (fl) fl.innerHTML = phones.map(function (p) { return '<a href="tel:+' + esc(telOf(p)) + '" dir="ltr">' + esc(p) + "</a>"; }).concat(email ? ['<a href="mailto:' + esc(email) + '" dir="ltr">' + esc(email) + "</a>"] : []).join("");
  }
  var lastAddr = "";
  function address() {
    var a1 = w("addressLine1"), a2 = w("addressLine2"), one = [a1, a2].filter(Boolean).join(", ");
    document.querySelectorAll("[data-addr]").forEach(function (el) { el.textContent = one; el.hidden = !one; });
    var q = encodeURIComponent(one);
    var dir = "https://www.google.com/maps/dir/?api=1&destination=" + q;
    var g = document.getElementById("navGoogle"), z = document.getElementById("navWaze"), h = document.getElementById("heroNav");
    if (g) g.href = dir;
    if (h) h.href = dir;
    if (z) z.href = "https://www.waze.com/ul?q=" + q + "&navigate=yes";
    var f = document.getElementById("mapFrame");
    if (f) {
      f.title = w("mapTitle");
      if (one && one !== lastAddr) { lastAddr = one; f.src = "https://www.google.com/maps?q=" + q + "&output=embed"; }
    }
    var v = document.getElementById("visit"); if (v) v.hidden = !one;
  }

  /* ---------- language ---------- */
  function applyDir() {
    root.lang = lang; root.dir = lang === "en" ? "ltr" : "rtl";
    root.classList.toggle("oh-en", lang === "en");
  }
  var seg = null;
  function langPill() {
    var slot = document.getElementById("langSlot"), SH = window.OH_SHELL;
    if (!slot || !SH || !SH.segHtml || !SH.segWire) return;
    slot.innerHTML = SH.segHtml("ohLandLang", [
      { v: "he", label: "עברית", short: "עב", flags: ["il"], lang: "he" },
      { v: "en", label: "English", short: "EN", flags: ["us"], lang: "en" }
    ], lang, w("langLabel", "he") + " | " + w("langLabel", "en"));
    seg = document.getElementById("ohLandLang");
    SH.segWire(seg, function (v) { setLang(v, true); });
  }
  function setLang(v, keep) {
    lang = v === "en" ? "en" : "he";
    window.OH_LANG = lang;
    if (keep) { try { localStorage.setItem("ohLang", lang); } catch (e) {} }
    applyDir();
    if (seg) {
      seg.querySelectorAll(".oh-seg-b").forEach(function (b) { var on = b.getAttribute("data-v") === lang; b.classList.toggle("on", on); b.setAttribute("aria-checked", String(on)); });
      if (window.OH_SHELL && window.OH_SHELL.segPlace) window.OH_SHELL.segPlace(seg, true);
    }
    render();
  }

  /* ---------- today: the date, and the zmanim when PUBLIC_ZMANIM ---------- */
  var ZJ = null;
  function nyParts(d) { var p = {}; new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "numeric", minute: "numeric", hourCycle: "h23", weekday: "short" }).formatToParts(d || new Date()).forEach(function (x) { p[x.type] = x.value; }); return p; }
  function nyKey(off) { var p = nyParts(); var d = new Date(Date.UTC(+p.year, +p.month - 1, +p.day + (off || 0))); return d.toISOString().slice(0, 10); }
  function nowMins() { var p = nyParts(); return (+p.hour % 24) * 60 + (+p.minute); }
  function mins(t) { var a = String(t).split(":"); return +a[0] * 60 + (+a[1]); }
  function t12(t) { if (!t) return ""; var a = String(t).split(":"), h = +a[0], ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12; return h + ":" + a[1] + " " + ap; }
  function hebNum(n) {
    var ones = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"], tens = ["", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ"], hund = ["", "ק", "ר", "ש", "ת", "תק", "תר", "תש", "תת", "תתק"];
    var s = hund[Math.floor(n / 100)]; n = n % 100;
    if (n === 15) s += "טו"; else if (n === 16) s += "טז"; else s += tens[Math.floor(n / 10)] + ones[n % 10];
    return s.length > 1 ? s.slice(0, -1) + "\u05F4" + s.slice(-1) : s + "\u05F3";
  }
  function noonUtc(key) { return new Date(key + "T16:00:00Z"); } /* noon in New York, either offset */
  function hebDate(key, lg) {
    var d = noonUtc(key);
    if (lg === "en") {
      var s = new Intl.DateTimeFormat("en-u-ca-hebrew", { timeZone: TZ, day: "numeric", month: "long", year: "numeric" }).format(d);
      return s.replace(/Heshvan/, "Cheshvan").replace(/Tishri/, "Tishrei").replace(/Shvat/, "Shevat").replace(/Tammuz/, "Tamuz");
    }
    return new Intl.DateTimeFormat("he-IL-u-ca-hebrew", { timeZone: TZ, day: "numeric", month: "long", year: "numeric" }).formatToParts(d).map(function (p) {
      if (p.type === "day") return hebNum(parseInt(p.value, 10));
      if (p.type === "year") return hebNum(parseInt(p.value, 10) % 1000);
      return p.value;
    }).join("");
  }
  /* The Hebrew date turns at shkiah, like the TV. After shkiah the weekday is left out. */
  function dateLine() {
    var el = document.getElementById("heroDate"); if (!el) return;
    try {
      var today = nyKey(0), day = ZJ && ZJ.days && ZJ.days[today];
      var after = !!(day && day.shkiah && nowMins() >= mins(day.shkiah));
      var hk = after ? nyKey(1) : today, d = noonUtc(today), parts;
      if (lang === "en") {
        var g = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: after ? undefined : "long", month: "long", day: "numeric", year: "numeric" }).format(d);
        parts = [g, hebDate(hk, "en")];
      } else {
        var wd = after ? "" : new Intl.DateTimeFormat("he-IL", { timeZone: TZ, weekday: "long" }).format(d);
        var gh = new Intl.DateTimeFormat("he-IL", { timeZone: TZ, day: "numeric", month: "long", year: "numeric" }).format(d);
        parts = [wd, hebDate(hk, "he"), gh];
      }
      el.innerHTML = parts.filter(Boolean).map(function (p, i) { return '<span' + (/[A-Za-z]/.test(p) && lang === "he" ? ' dir="ltr"' : "") + ">" + esc(p) + "</span>"; }).join('<span class="sep" aria-hidden="true">|</span>');
      el.hidden = false;
    } catch (e) { el.hidden = true; }
  }
  function zmanim() {
    var sec = document.getElementById("today"); if (!sec) return;
    var day = PUBLIC_ZMANIM && ZJ && ZJ.days && ZJ.days[nyKey(0)];
    if (!day) { sec.hidden = true; return; }
    var items = [["netz", "zNetz"], ["shemaGra", "zShema"], ["chatzot", "zChatzot"], ["plag", "zPlag"], ["shkiah", "zShkiah"], ["tzeit", "zTzet"]];
    var now = nowMins(), nextDone = false;
    document.getElementById("zmanimGrid").innerHTML = items.map(function (it) {
      var t = day[it[0]]; if (!t || !w(it[1])) return "";
      var isNext = !nextDone && mins(t) >= now; if (isNext) nextDone = true;
      return '<div class="zman' + (isNext ? " is-next" : "") + '"><span class="z-name">' + esc(w(it[1])) + '</span><span class="z-time" dir="ltr">' + esc(t12(t)) + "</span></div>";
    }).join("");
    var wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(nyParts().weekday), toFri = wd === 6 ? -1 : (5 - wd);
    if (wd === 6 && day.shabbatEndsMyZmanim && now > mins(day.shabbatEndsMyZmanim)) toFri = 6; /* Motzei Shabbat: the next Shabbat */
    var fri = ZJ.days[nyKey(toFri)], sat = ZJ.days[nyKey(toFri + 1)], band = document.getElementById("shabbatBand");
    if (fri && sat && fri.candle18 && sat.shabbatEndsMyZmanim) {
      function cell(k, t) { return t && w(k) ? '<div class="sb-item"><span class="sb-name">' + esc(w(k)) + '</span><span class="sb-time" dir="ltr">' + esc(t12(t)) + "</span></div>" : ""; }
      band.innerHTML = '<div class="sb-title">' + esc(w("shabbatTitle")) + "</div>" + cell("shabbatCandles", fri.candle18) + cell("shabbatEnds", sat.shabbatEndsMyZmanim) + cell("shabbatRT", window.OH_RABBEINU_TAM && sat.rabbeinuTamMyZmanim ? window.OH_RABBEINU_TAM.timeFor(sat) : null);
      band.hidden = false;
    } else band.hidden = true;
    sec.hidden = false;
  }
  function loadZmanim() {
    if (!window.fetch) return;
    /* Rabbeinu Tam: the ONE site basis (src/zmanim/rabbeinu-tam.js, 72 zmaniyot after Shkiah), loaded only when the zmanim are public */
    if (PUBLIC_ZMANIM && !window.OH_RABBEINU_TAM) { var rs = document.createElement("script"); rs.src = "src/zmanim/rabbeinu-tam.js"; rs.onload = function () { if (ZJ) zmanim(); }; document.head.appendChild(rs); }
    fetch("src/zmanim/roy-daily-5787.json").then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (j && j.days) { ZJ = j; dateLine(); zmanim(); }
    }).catch(function () {});
  }

  /* ---------- the sign-in button ---------- */
  var btn = document.getElementById("authBtn"), lab = document.getElementById("authLabel"), msg = document.getElementById("authMsg");
  var authState = "out", busy = false, msgTimer = null;
  function say(k) {
    if (!msg) return;
    msg.textContent = w(k); msg.hidden = !w(k);
    clearTimeout(msgTimer); msgTimer = setTimeout(function () { msg.hidden = true; }, 7000);
  }
  function setAuth(st) {
    authState = st;
    if (!btn) return;
    btn.setAttribute("data-state", st);
    var k = { out: "signin", busy: "signinBusy", gabbai: "signinGabbai", account: "signinAccount", unauth: "signinOut" }[st] || "signin";
    if (lab) lab.textContent = w(k);
    btn.setAttribute("href", st === "account" ? "congregant/" : "gabbai/");
    btn.setAttribute("role", st === "gabbai" || st === "account" ? "link" : "button");
    btn.setAttribute("aria-busy", st === "busy" ? "true" : "false");
    if (st !== lastFitState) { lastFitState = st; fit(); }
  }
  var lastFitState = "";
  function goGabbaiFlag(set) {
    try { if (set) sessionStorage.setItem("ohGoGabbai", "1"); else { var v = sessionStorage.getItem("ohGoGabbai") === "1"; sessionStorage.removeItem("ohGoGabbai"); return v; } } catch (e) {}
    return false;
  }
  function redirectSignIn() {
    try {
      var fb = window.firebase;
      if (fb && fb.auth && fb.auth.GoogleAuthProvider) return fb.auth().signInWithRedirect(new fb.auth.GoogleAuthProvider());
    } catch (e) {}
    return Promise.reject(new Error("redirect unavailable"));
  }
  function signIn() {
    var fb = window.OH_FIREBASE;
    busy = true; setAuth("busy"); goGabbaiFlag(true);
    function fail(e) {
      busy = false; goGabbaiFlag(false); setAuth("out");
      var c = e && e.code || "";
      if (c !== "auth/popup-closed-by-user" && c !== "auth/cancelled-popup-request" && c !== "auth/user-cancelled") say("signinError");
    }
    function popup() {
      var r;
      try { r = window.OH_FIREBASE.signIn(); } catch (e) { r = Promise.reject(e); }
      return Promise.resolve(r).then(function () { busy = false; }, function (e) {
        var c = e && e.code || "";
        if (c === "auth/popup-blocked" || c === "auth/operation-not-supported-in-environment" || c === "auth/web-storage-unsupported") return redirectSignIn().catch(fail);
        fail(e);
      });
    }
    if (fb && fb.ready && fb.signIn) return popup();
    /* Firebase still loading: wait a little, then go by redirect (a popup needs the tap itself) */
    var n = 0, iv = setInterval(function () {
      var f = window.OH_FIREBASE; n++;
      if (f && f.ready) { clearInterval(iv); redirectSignIn().catch(function () { popup(); }); }
      else if (n > 40) { clearInterval(iv); fail({ code: "not-ready" }); }
    }, 250);
  }
  if (btn) btn.addEventListener("click", function (e) {
    if (authState === "gabbai" || authState === "account") return; /* a plain link */
    e.preventDefault();
    if (authState === "busy") return;
    if (authState === "unauth") { var fb = window.OH_FIREBASE; if (fb && fb.signOut) fb.signOut(); setAuth("out"); return; }
    signIn();
  });
  var shownUnauth = false;
  function syncAuth() {
    var fb = window.OH_FIREBASE, user = fb && fb.ready ? fb.user : null;
    if (!user) { shownUnauth = false; if (!busy) setAuth("out"); return; }
    var role = fb.role;
    if (!role) { setAuth("busy"); if (fb.resolveRole) Promise.resolve(fb.resolveRole()).then(syncAuth, function () {}); return; }
    busy = false;
    var isGabbai = role.isSuperAdmin || role.canFinance || role.canAdmin || role.canScreen;
    if (isGabbai) {
      setAuth("gabbai");
      if (goGabbaiFlag(false) && window.top === window) { location.href = "gabbai/"; }
    } else if (role.canCongregant) { setAuth("account"); goGabbaiFlag(false); }
    else if (role.canRequestJoin || role.joinStatus) {
      /* Stage D: not a member yet; "החשבון שלי" opens the join request screen,
         and right after signing in it opens by itself. */
      setAuth("account");
      if (goGabbaiFlag(false) && window.top === window) { location.href = "congregant/"; }
    }
    else { setAuth("unauth"); goGabbaiFlag(false); if (!shownUnauth) { shownUnauth = true; say("signinUnauth"); } }
  }

  /* ---------- the super admin's saved words ---------- */
  function loadSaved() {
    var n = 0, iv = setInterval(function () {
      var fb = window.OH_FIREBASE; n++;
      if (!(fb && fb.ready && fb._db)) { if (n > 60) clearInterval(iv); return; }
      clearInterval(iv);
      try {
        var db = fb._db(); if (!db) return;
        db.collection("settings").doc("homeTexts").get().then(function (s) {
          if (!s || !s.exists) return;
          var d = s.data() || {};
          saved = { he: clean(d.texts), en: clean(d.textsEn) };
          render();
        }).catch(function () {});
      } catch (e) {}
    }, 250);
  }
  window.addEventListener("message", function (e) {
    if (e.origin !== location.origin) return;
    var d = e.data;
    if (!d || d.type !== "oh-home-texts-preview") return;
    preview = { he: clean(d.texts), en: clean(d.textsEn) };
    if (d.lang === "he" || d.lang === "en") setLang(d.lang, false); else render();
  });

  /* the top bar never wraps or overflows: drop the name, then the pill flags, if the words don't fit */
  function fit() {
    var hd = document.querySelector(".site-header"), inner = hd && hd.querySelector(".site-header__inner"); if (!inner) return;
    hd.classList.remove("tight", "tighter");
    function over() { return inner.scrollWidth > inner.clientWidth + 1; }
    if (over()) hd.classList.add("tight");
    if (over()) hd.classList.add("tighter");
    if (seg && window.OH_SHELL && window.OH_SHELL.segPlace) window.OH_SHELL.segPlace(seg, true);
  }
  function render() {
    fill(); contact(); address(); dateLine(); zmanim();
    setAuth(authState);
    fit();
    if (seg) seg.setAttribute("aria-label", w("langLabel", "he") + " | " + w("langLabel", "en"));
    var y = document.getElementById("footerYear");
    if (y) try { y.textContent = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric" }).format(new Date()); } catch (e) {}
  }

  applyDir();
  render();
  langPill();
  fit();
  window.addEventListener("resize", fit);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  loadZmanim();
  loadSaved();
  syncAuth();
  setInterval(syncAuth, 800);
  window.OH_HOME = { render: render, setLang: setLang, word: w, get lang() { return lang; }, get authState() { return authState; } };
})();
