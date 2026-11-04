/* Screen content boards (Display Engine, view side), stage v4 2026-11-03.
   Loaded by /screen/ and /tv/ after display-engine.js and
   screen-content.js, before screen.js. Turns the gabbai's published
   items into:
     - centre boards (rotating in the community board),
     - the footer strip (permanent dedications, v5: endless slow ticker),
     - the donation board (v5: a centre board, weekday only, system hidden on Shabbat/YT).
   /tv/ (public, no sign-in) reads only published + public items;
   (the protected /screen/ page was deleted on 2026-11-03.)
   Offline: the last list is kept in localStorage and shown with the
   existing "last updated" note. Preview: the admin editor embeds this
   page with ?embed=preview and posts one draft item; nothing is saved.
   All gabbai text is escaped (no markup or script can reach the TV).
   No text is invented: titles of the boards are the section names,
   everything else is what the gabbai typed. */
(function () {
  "use strict";
  var E = window.OH_DISPLAY, SC = window.OH_SCREEN_CONTENT;
  if (!E) return;
  var params = new URLSearchParams(location.search);
  var EMBED = params.get("embed") === "preview";
  var IS_TV = /\/tv\/?/.test(location.pathname) || document.documentElement.getAttribute("data-screen-mode") === "public";
  var state = { items: null, live: false, unsub: null, preview: null, error: null, sig: "" };
  var WD_HE = ["יום א׳", "יום ב׳", "יום ג׳", "יום ד׳", "יום ה׳", "יום ו׳", "שבת"];
  /* 2040: section names, tags and day names are keys in src/tv/tv-texts.js, so a
     gabbai can change them (Hebrew and the small English line). Without that
     file: exactly the words below, as before. */
  var TYPE_KEY = { announcement: "bAnnouncements", dedication: "bDedications", flyer: "bFlyer", yahrzeit: "bYahrzeit", sponsor: "bSponsors",
    parnas: "bParnas", mazaltov: "bMazalTov", hazkara: "bHazkarot", rabbi: "bRabbi", campaign: "bCampaign", donation: "bDonation" };
  var SUB_KEY = { sponsor: { kiddush: "bSubKiddush", seudah3: "bSubSeudah3" }, parnas: { parnas: "bSubParnas", nerLamaor: "bSubNer" },
    hazkara: { hazkara: "bSubHazkara", tanchumim: "bSubTanchumim" }, rabbi: { message: "bSubRabbiMsg", brachaShabbat: "bSubBracha" },
    dedication: { leiluyNishmat: "bSubLeiluy", general: "bSubGeneral" } };
  function X() { return window.OH_TV_TEXTS || null; }
  function typeName(t) { var d = E.TYPES[t] || { he: "", en: "" }, x = X(); return x && TYPE_KEY[t] ? { he: x.t(TYPE_KEY[t]), en: x.t(TYPE_KEY[t], null, "en") } : d; }
  function subName(t, sub) { var d = E.SUBTYPES[t] && E.SUBTYPES[t][sub], x = X(); if (!d) return ""; return x && SUB_KEY[t] && SUB_KEY[t][sub] ? x.t(SUB_KEY[t][sub]) : d; }
  function wdName(n) { var x = X(); return x ? x.t("wdShort" + n) : WD_HE[n]; }
  function word(key, fb) { var x = X(); return x ? x.t(key) : fb; }

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function para(s) { return esc(s).replace(/\r?\n/g, "<br>"); }
  function safeUrl(u) { return /^https:\/\/firebasestorage\.googleapis\.com\//.test(String(u || "")) || /^data:image\/(png|jpeg|webp);base64,/.test(String(u || "")) || /^\.\.\/src\/assets\//.test(String(u || "")) ? u : ""; }
  function money(n) { var v = Number(n); if (!isFinite(v)) return ""; return v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }); }

  /* ---------- data ---------- */
  if (!EMBED && SC) { var c = SC.cached(); if (c) { state.items = c.items; } }
  function startLive() {
    if (EMBED || state.unsub || !SC) return;
    var fb = window.OH_FIREBASE; if (!fb || !fb.ready) return;
    if (!IS_TV) {
      if (document.body.classList.contains("gated") || !fb.user) return; /* /screen/ waits for its role gate */
    }
    state.unsub = SC.subscribe(IS_TV ? "public" : "screen", function (items, err) {
      var was = state.live;
      if (items) { state.items = items; state.live = true; state.error = null; }
      else { state.error = err; }
      paintStatic(true);
      if (!was && state.live && typeof window.renderZone === "function") window.renderZone(); /* first live data: show it now */
    });
  }
  function stopLive() { if (state.unsub) { try { state.unsub(); } catch (e) {} state.unsub = null; } }
  setInterval(function () {
    if (!IS_TV && document.body.classList.contains("gated")) { stopLive(); return; }
    startLive();
  }, 1000);

  function ctx(rest) { return { todayKey: E.nyParts(new Date()).key, rest: !!rest, publicOnly: IS_TV, preview: !!state.preview }; }
  function sourceItems() { return state.preview ? [state.preview.item] : (state.items || []); }

  /* ---------- building boards ---------- */
  var GROUPED = { sponsor: 1, parnas: 1, mazaltov: 1, hazkara: 1, yahrzeit: 1, dedication: 1 };
  function title(it) { return it.titleHe ? '<span class="ln-title">' + esc(it.titleHe) + "</span>" : ""; }
  function enLine(it) { return (it.titleEn || it.bodyEn) ? '<span class="ln-en" dir="ltr">' + esc([it.titleEn, it.bodyEn].filter(Boolean).join(". ")) + "</span>" : ""; }
  function line(it, prefix) {
    return '<li class="cb-line">' + (prefix ? '<span class="ln-tag">' + esc(prefix) + "</span>" : "") + title(it) +
      (it.bodyHe ? '<span class="ln-body">' + para(it.bodyHe) + "</span>" : "") + enLine(it) + "</li>";
  }
  function yahrzeitLine(it, today) {
    var y = it.yahrzeit || {}, hit = E.yahrzeitActive(y, today);
    var when = hit ? (hit.hebLabel + " | " + wdName(hit.weekday) + (hit.check ? word("ybCheck", " (לבדיקה)") : "")) : "";
    return '<li class="cb-line"><span class="ln-title">' + esc(y.nameHe || "") + "</span>" + (y.nameEn ? '<span class="ln-en" dir="ltr">' + esc(y.nameEn) + "</span>" : "") +
      (it.bodyHe ? '<span class="ln-body">' + para(it.bodyHe) + "</span>" : "") + (when ? '<span class="ln-when">' + esc(when) + "</span>" : "") + "</li>";
  }
  function board(key, he, en, inner, cls) { return { key: key, he: he, en: en, html: inner, cls: cls || "" }; }
  function build(active) {
    var T = E.TYPES, S = E.SUBTYPES, today = E.nyParts(new Date()).key;
    var out = { boards: [], ticker: [], donation: [] }, groups = {};
    active.forEach(function (it) {
      if (it.type === "donation") { out.donation.push(it); return; }
      if (it.type === "dedication" && it.permanent) { out.ticker.push(it); return; }
      if (GROUPED[it.type]) { (groups[it.type] = groups[it.type] || []).push(it); return; }
      if (it.type === "flyer") {
        var src = it.image ? safeUrl(it.image.url) : "";
        out.boards.push(board("flyer:" + it.id, it.titleHe || typeName("flyer").he, it.titleEn || "", src
          ? '<div class="cb-flyer"><img src="' + esc(src) + '" alt="' + esc(it.titleHe || typeName("flyer").he) + '"></div>' + (it.bodyHe ? '<p class="board-body">' + para(it.bodyHe) + "</p>" : "")
          : '<p class="board-body">' + para(it.bodyHe || "") + "</p>", src ? "is-flyer" : ""));
        return;
      }
      if (it.type === "campaign") {
        var bar = "";
        var g = it.campaign || {};
        if (Number(g.goal) > 0) {
          var pct = Math.max(0, Math.min(100, Math.round((Number(g.raised) || 0) / Number(g.goal) * 100)));
          bar = '<div class="cb-progress" role="img" aria-label="' + pct + '%"><span style="width:' + pct + '%"></span></div><p class="cb-progress-nums" dir="ltr">' + esc(money(g.raised || 0)) + " / " + esc(money(g.goal)) + "</p>";
        }
        out.boards.push(board("campaign:" + it.id, it.titleHe || typeName("campaign").he, it.titleEn || typeName("campaign").en, '<p class="board-body">' + para(it.bodyHe || "") + "</p>" + (it.bodyEn ? '<p class="board-body en-body" dir="ltr">' + para(it.bodyEn) + "</p>" : "") + bar));
        return;
      }
      /* announcement and rabbi: one board each */
      var he = it.type === "rabbi" ? ((S.rabbi[it.subtype] ? subName("rabbi", it.subtype) : typeName("rabbi").he)) : (it.titleHe || typeName("announcement").he);
      var en = it.type === "rabbi" ? (it.titleEn || typeName("rabbi").en) : (it.titleEn || "");
      var sub = it.type === "rabbi" && it.titleHe ? '<p class="cb-sub">' + esc(it.titleHe) + "</p>" : "";
      out.boards.push(board(it.type + ":" + it.id, he, en, sub + '<p class="board-body">' + para(it.bodyHe || "") + "</p>" + (it.bodyEn ? '<p class="board-body en-body" dir="ltr">' + para(it.bodyEn) + "</p>" : "")));
    });
    ["sponsor", "parnas", "dedication", "mazaltov", "hazkara", "yahrzeit"].forEach(function (t) {
      var list = groups[t]; if (!list || !list.length) return;
      var lis = list.map(function (it) {
        if (t === "yahrzeit") return yahrzeitLine(it, today);
        var tag = S[t] && S[t][it.subtype] ? subName(t, it.subtype) : "";
        return line(it, tag);
      }).join("");
      out.boards.push(board(t, typeName(t).he, typeName(t).en, '<ul class="cb-list">' + lis + "</ul>"));
    });
    return out;
  }
  function current(rest) {
    var c2 = ctx(rest);
    return build(E.activeItems(sourceItems(), c2));
  }

  /* ---------- footer strip (v5: endless ticker) ----------
     Hanoch (2026-11-03): the bottom bar runs slowly, with the names and
     everything in it, as a scroll that never ends. One "unit" holds the
     items (repeated until it is at least as wide as the bar); the track
     holds the unit twice and a CSS transform moves it by exactly one
     unit width, so the restart lands on identical pixels: no jump, no
     gap. RTL: the text enters from the left and moves right, so Hebrew
     is read from its start. Speed is a constant px per second (scaled to
     the screen height), whatever the length. Payment items never reach
     the strip: only permanent dedications go here, and activeItems()
     already hides weekday items on Shabbat and Yom Tov. */
  var TICKER_VH_PER_SEC = 5; /* 5% of the screen height per second: 54 px/s on 1080p */
  var tickerItems = "", tickerSig = "";
  function itemHtml(it) { return '<span class="tk-item">' + (it.titleHe ? "<b>" + esc(it.titleHe) + "</b> " : "") + esc(it.bodyHe || "") + "</span>"; }
  function paintTicker(list) {
    var el = document.getElementById("ticker"); if (!el) return;
    if (!list.length) {
      if (state.live || state.preview) { el.innerHTML = ""; el.classList.remove("is-long", "is-running"); tickerItems = ""; tickerSig = ""; }
      return;
    }
    tickerItems = list.map(function (it) { return itemHtml(it) + '<span class="tk-sep" aria-hidden="true">✦</span>'; }).join("");
    tickerSig = "";
    layoutTicker();
  }
  function layoutTicker() {
    var el = document.getElementById("ticker"); if (!el || !tickerItems) return;
    var w = el.clientWidth, sig = tickerItems.length + ":" + w + ":" + window.innerHeight + ":" + tickerItems;
    if (sig === tickerSig) return;
    tickerSig = sig;
    el.innerHTML = '<span class="tk-track"><span class="tk-unit">' + tickerItems + "</span></span>";
    var unit = el.querySelector(".tk-unit"), one = unit.getBoundingClientRect().width;
    if (!one || !w) return;
    var reps = Math.max(1, Math.ceil(w / one));
    var unitHtml = new Array(reps + 1).join(tickerItems);
    el.innerHTML = '<span class="tk-track"><span class="tk-unit">' + unitHtml + '</span><span class="tk-unit" aria-hidden="true">' + unitHtml + "</span></span>";
    var u = el.querySelector(".tk-unit"), uw = u.getBoundingClientRect().width;
    var dir = getComputedStyle(el).direction === "rtl" ? 1 : -1;
    var pxs = Math.max(30, window.innerHeight * TICKER_VH_PER_SEC / 100);
    var track = el.querySelector(".tk-track");
    track.style.setProperty("--tk-dist", (dir * uw).toFixed(2) + "px");
    track.style.setProperty("--tk-dur", (uw / pxs).toFixed(2) + "s");
    el.classList.add("is-long", "is-running");
  }
  window.addEventListener("resize", function () { tickerSig = ""; layoutTicker(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { tickerSig = ""; layoutTicker(); });
  /* v5: the donation block left the prayer-times column (that column is
     prayer times only, per Hanoch). A published donation item is now a
     centre board, weekday only: the system still hides it on Shabbat and
     Yom Tov (activeItems forces payment items weekday-only). */
  function donationBoards(list) {
    return list.map(function (it) {
      var src = it.image ? safeUrl(it.image.url) : "";
      return board("donation:" + it.id, it.titleHe || typeName("donation").he, it.titleEn || typeName("donation").en,
        '<div class="cb-donation">' + (src ? '<img class="cb-qr" src="' + esc(src) + '" alt="QR">' : "") +
        '<p class="board-body">' + para(it.bodyHe || "") + (it.bodyEn ? '<br><span dir="ltr">' + para(it.bodyEn) + "</span>" : "") + "</p></div>", "is-donation");
    });
  }
  /* Called every tick by screen.js; repaints only when something changed. */
  function paintStatic(force) {
    var rest = typeof window.isShabbatDay === "function" ? window.isShabbatDay() : false;
    var b = current(rest);
    var sig = JSON.stringify([X() ? X().sig : "", rest, b.ticker.map(function (x) { return x.id + ":" + x.version; }), b.donation.map(function (x) { return x.id + ":" + x.version; }), state.preview ? JSON.stringify(state.preview) : "", state.live]);
    if (!force && sig === state.sig) return;
    state.sig = sig;
    paintTicker(b.ticker);
  }

  /* ---------- long boards: scroll with a pause at the end ---------- */
  var boardAnim = null;
  function fit(zone) {
    if (boardAnim) { try { boardAnim.cancel(); } catch (e) {} boardAnim = null; }
    zone.classList.remove("is-long");
    var inner = zone.querySelector(".cb-inner"); if (!inner || !inner.animate) return 0;
    var over = inner.scrollHeight - zone.clientHeight;
    if (over <= 4) return 0;
    zone.classList.add("is-long");
    over = inner.scrollHeight - zone.clientHeight;
    var pxs = Math.max(24, window.innerHeight * 0.026), move = over / pxs * 1000, hold1 = 4000, hold2 = 5000, total = hold1 + move + hold2;
    boardAnim = inner.animate([
      { transform: "translateY(0)" }, { transform: "translateY(0)", offset: hold1 / total },
      { transform: "translateY(" + -over + "px)", offset: (hold1 + move) / total }, { transform: "translateY(" + -over + "px)" }
    ], { duration: total, fill: "forwards", easing: "linear" });
    return total + 600;
  }

  /* ---------- preview (admin editor iframe) ---------- */
  if (EMBED) {
    document.documentElement.classList.add("embed-preview");
    window.addEventListener("message", function (ev) {
      if (ev.origin !== location.origin || !ev.data || ev.data.type !== "oh-preview") return;
      state.preview = { item: ev.data.item || {}, rest: !!ev.data.rest };
      document.body.classList.toggle("shabbat", state.preview.rest);
      document.body.classList.toggle("force-weekday", !state.preview.rest);
      paintStatic(true);
      if (typeof window.renderZone === "function") window.renderZone(true);
      if (typeof window.applyWeekdayHiding === "function") window.applyWeekdayHiding();
    });
    try { parent.postMessage({ type: "oh-preview-ready" }, location.origin); } catch (e) {}
  }

  window.OH_BOARDS = {
    boards: function (rest) { var c3 = current(rest); return c3.boards.concat(donationBoards(c3.donation)); },
    hasLive: function () { return state.live || !!state.preview || (state.items && state.items.length > 0); },
    isPreview: function () { return !!state.preview; },
    paintStatic: paintStatic,
    fit: fit,
    build: build,
    _state: state
  };
})();
