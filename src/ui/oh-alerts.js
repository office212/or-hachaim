/* Or Hachaim | 2040 phase 1 | "המערכת שמה לב לפניך" (src/ui/oh-alerts.js)
   The alerts strip on the gabbai home. Mounts into #ohAlerts once the
   signed-in person's role is known, and uses ONLY reads the current rules
   allow that role:
     content gabbai / super admin: prayerTimes (public), the 5 screen content
       collections (hasScreen reads everything), the daily zmanim file;
     finance gabbai / super admin: recurringSchedules and pledges (hasFinance).
   Each alert has one action button. Nothing here writes: an action opens a
   page or fills the command bar, where the gabbai still sees a preview and
   presses "אשר". */
(function () {
  "use strict";
  var DEF = {
    alTitle: "המערכת שמה לב לפניך", alTitleEn: "מה כדאי לבדוק השבוע",
    alAllGood: "הכל מסודר ✓ אין כרגע משהו שדורש תשומת לב",
    alShabbatT: "חבילת שבת", alShabbatGo: "פתח חבילת שבת",
    alYzT: "יארצייט השבוע", alYzGo: "לעורך המסך",
    alKiddushT: "אין עדיין חסות לקידוש", alKiddushGo: "הוסף חסות קידוש",
    alSunsetT: "זמן תפילה אחרי השקיעה", alSunsetGo: "תקן: 15 דק׳ לפני השקיעה",
    alExpireT: "זמן לפי תאריכים מסתיים בקרוב", alExpireGo: "הארך",
    alDraftsT: "טיוטות מחכות לפרסום", alDraftsGo: "לטיוטות",
    alRecT: "חיובים קבועים לשבוע הזה", alRecGo: "לחיובים הקבועים",
    alPledgeT: "נדרים פתוחים", alPledgeGo: "לנדרים",
    alShabbatD: "עלון להדפסה וטיוטה למסך לשבת {date}", alYzN: "{n} יארצייטים השבוע", alYzDraftN: "{n} עדיין לא על המסך", alYzOn: "מופיע על המסך",
    alKiddushD: "לשבת {date}", alKiddushDraft: "יש טיוטה שמחכה לפרסום", alDraftOne: "טיוטה אחת מחכה לפרסום",
    alSunsetD: "{name} {time} אחרי השקיעה ב-{n} ימים השבוע (השקיעה השבוע: {range})", alSunsetD1: "{name} {time} אחרי השקיעה ביום אחד השבוע (השקיעה: {range})",
    alRange: "{a} עד {b}", alExpireD: "{name} {time} ({days}) עד {date}", alRecOne: "חיוב קבוע אחד לשבוע הזה",
    alRecLate: "{n} כבר באיחור", alRecNot: "עדיין לא חויבו", alPledgeOld: "{n} מעל 30 יום"
  };
  function F(k, o) { return String(L(k)).replace(/\{(\w+)\}/g, function (m, x) { return o && o[x] != null ? o[x] : m; }); }
  function L(k) { var o = window.OH_LABELS || {}; return (o[k] !== undefined && o[k] !== null && o[k] !== "") ? o[k] : DEF[k]; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var P = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  var I = {
    candle: P + '<path d="M9 21h6M10 21V11h4v10M12 11V8"/><path d="M12 3c1.2 1.4 1.5 2.6 0 4-1.5-1.4-1.2-2.6 0-4z"/></svg>',
    flame: P + '<path d="M12 21a6 6 0 0 0 6-6c0-4-3-6-4-9-1 2-2 3-3 3 0-1 0-2-1-3-2 2-4 5-4 9a6 6 0 0 0 6 6z"/></svg>',
    cup: P + '<path d="M7 4h10l-1 7a4 4 0 0 1-8 0L7 4zM12 15v4M9 20h6"/></svg>',
    sun: P + '<path d="M3 18h18M6 18a6 6 0 0 1 12 0M12 6v2M5.6 9.6l1.4 1.4M18.4 9.6L17 11"/></svg>',
    clock: P + '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    draft: P + '<path d="M5 4h10l4 4v12H5z"/><path d="M14 4v5h5M8 13h8M8 17h5"/></svg>',
    wallet: P + '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 15h2"/></svg>',
    book: P + '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/></svg>'
  };
  function T() { return window.OH_TIMES; }
  function fb() { return window.OH_FIREBASE; }
  function now() { return window.OH_TEST_NOW ? new Date(window.OH_TEST_NOW) : new Date(); }
  function rootPath() { var s = document.querySelector('script[src*="oh-alerts.js"]'); var src = s ? s.getAttribute("src") : "../src/ui/oh-alerts.js"; return src.replace(/src\/ui\/oh-alerts\.js.*$/, ""); }
  function escT(s) { return esc(s).replace(/\b(\d{1,2}:\d{2}(?:\s?[AP]M)?)/g, '<bdi dir="ltr">$1</bdi>'); }
  function money(n) { n = +n || 0; return "$" + n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); }

  var st = { el: null, uid: null, role: null, items: null, docs: null, rec: null, pledges: null, unsub: null, sb: null, timer: null };

  /* ---------- pure: build the alert list (also used by the tests) ---------- */
  function build(d) {
    var t = T(), today = d.today, sh = t.comingShabbat(today), weekEnd = t.addDays(today, 6), out = [];
    var role = d.role || {}, screen = !!(role.isSuperAdmin || role.canScreen), finance = !!(role.isSuperAdmin || role.canFinance);
    if (screen) {
      out.push({ id: "shabbat", hi: false, icon: "candle", title: L("alShabbatT") + (d.parasha ? " | " + d.parasha : ""),
        text: F("alShabbatD", { date: t.dateLoc(sh, false) }) + (d.special ? " | " + d.special : ""), go: L("alShabbatGo"), href: "gabbai/shabbat/" });
    }
    if (screen && d.items) {
      var E = window.OH_DISPLAY;
      /* yahrzeits in the week of today (Sunday to Shabbat), published or still a draft */
      var yz = d.items.filter(function (x) { return x.type === "yahrzeit" && x.status !== "archived" && E && E.yahrzeitActive(x.yahrzeit || {}, today); });
      if (yz.length) {
        var drafts = yz.filter(function (x) { return x.status !== "published"; }).length;
        out.push({ id: "yahrzeit", hi: drafts > 0, icon: "flame", title: (yz.length === 1 ? L("alYzT") : F("alYzN", { n: yz.length })),
          text: yz.map(function (x) { return (x.yahrzeit && x.yahrzeit.nameHe) || x.titleHe || ""; }).join(", ") + (drafts ? " | " + F("alYzDraftN", { n: drafts }) : " | " + L("alYzOn")), go: L("alYzGo"), href: "admin/#screenContent" });
      }
      /* kiddush sponsor for the coming Shabbat */
      var kid = d.items.filter(function (x) { return x.type === "sponsor" && (x.subtype || "kiddush") === "kiddush" && x.status !== "archived" && (!x.startDate || x.startDate <= sh) && (!x.endDate || x.endDate >= sh); });
      var kidPub = kid.filter(function (x) { return x.status === "published"; });
      if (!kidPub.length) {
        out.push({ id: "kiddush", hi: true, icon: "cup", title: L("alKiddushT"), text: F("alKiddushD", { date: t.dateLoc(sh, false) }) + (d.parasha ? ", " + d.parasha : "") + (kid.length ? " | " + L("alKiddushDraft") : ""),
          go: L("alKiddushGo"), cmd: "קידוש בחסות ", cmdGo: false, href: "admin/#screenContent" });
      }
      var dr = d.items.filter(function (x) { return x.status === "draft"; });
      if (dr.length) out.push({ id: "drafts", hi: false, icon: "draft", title: dr.length === 1 ? L("alDraftOne") : dr.length + " " + L("alDraftsT"),
        text: dr.slice(0, 3).map(function (x) { return x.titleHe || (x.yahrzeit && x.yahrzeit.nameHe) || ""; }).filter(Boolean).join(" | "), go: L("alDraftsGo"), href: "admin/#screenContent" });
    }
    if (screen && d.docs && d.zman) {
      d.docs.forEach(function (doc) {
        if (!/^מנחה/.test(String(doc.nameHe || ""))) return;
        var after = 0, total = 0, minS = null, maxS = null;
        for (var i = 0; i < 7; i++) {
          var iso = t.addDays(today, i), tm = t.timeOn(doc, iso, d.zman, d.isYomTov), s = t.sunsetMin(d.zman, iso), ss = t.sunsetSec(d.zman, iso);
          if (tm < 0 || s < 0 || ss < 0) continue;
          total++; if (minS === null || s < minS) minS = s; if (maxS === null || s > maxS) maxS = s;
          if (tm * 60 >= ss) after++;
        }
        if (after > 0) {
          var lab = doc.rule && doc.rule.kind === "sunset" ? t.offsetLoc(doc.rule.offsetMin) : doc.time;
          out.push({ id: "sunset-" + doc.id, hi: true, icon: "sun", title: L("alSunsetT"),
            text: F(after === 1 ? "alSunsetD1" : "alSunsetD", { name: (t.isEn() && doc.nameEn) || doc.nameHe, time: lab, n: after, range: minS === maxS ? t.short12(minS) : F("alRange", { a: t.short12(minS), b: t.short12(maxS) }) }),
            go: L("alSunsetGo"), cmd: "שנה " + doc.nameHe + " " + (doc.rule && doc.rule.kind === "sunset" ? t.offsetHe(doc.rule.offsetMin).replace(" דק׳ ", " דקות ") : doc.time) + " ל-15 דקות לפני השקיעה", cmdGo: true, href: "admin/#ptSection" });
        }
      });
      d.docs.forEach(function (doc) {
        var r = doc.rule; if (!r || !r.until || (r.from && r.from === r.until)) return;
        if (r.until < today || r.until > t.addDays(today, 14)) return;
        var lab = r.kind === "sunset" ? t.offsetLoc(r.offsetMin) : doc.time;
        out.push({ id: "expire-" + doc.id, hi: false, icon: "clock", title: L("alExpireT"),
          text: F("alExpireD", { name: (t.isEn() && doc.nameEn) || doc.nameHe, time: lab, days: t.dayLoc(r.days || "all"), date: t.dateLoc(r.until, false) }),
          go: L("alExpireGo"), cmd: "שנה " + doc.nameHe + " " + (r.kind === "sunset" ? t.offsetHe(r.offsetMin).replace(" דק׳ ", " דקות ") : doc.time) + " עד ", cmdGo: false, href: "admin/#ptSection" });
      });
    }
    if (finance && d.rec) {
      var due = d.rec.filter(function (r) { return r.status === "active" && r.nextDue && r.nextDue <= weekEnd; });
      if (due.length) {
        var late = due.filter(function (r) { return r.nextDue < today; }).length, sum = due.reduce(function (a, r) { return a + (+r.amount || 0); }, 0);
        out.push({ id: "recurring", hi: late > 0, icon: "wallet", title: (due.length === 1 ? L("alRecOne") : due.length + " " + L("alRecT")),
          text: money(sum) + (late ? " | " + F("alRecLate", { n: late }) : "") + " | " + L("alRecNot"), go: L("alRecGo"), href: "finance/#reports" });
      }
    }
    if (finance && d.pledges) {
      var open = d.pledges.filter(function (p) { return p.status === "unpaid"; });
      if (open.length) {
        var old = open.filter(function (p) { return p.date && t.diffDays(p.date, today) > 30; }).length, sum2 = open.reduce(function (a, p) { return a + (+p.amount || 0); }, 0);
        out.push({ id: "pledges", hi: old > 0, icon: "book", title: open.length + " " + L("alPledgeT"), text: money(sum2) + (old ? " | " + F("alPledgeOld", { n: old }) : ""), go: L("alPledgeGo"), href: "finance/#nedarim" });
      }
    }
    return out;
  }

  /* ---------- render ---------- */
  function render() {
    if (!st.el) return;
    var t = T(), today = t.nyIso(now());
    var list = build({ today: today, role: st.role, items: st.items, docs: st.docs, zman: t.zman, rec: st.rec, pledges: st.pledges, isYomTov: st.cal && st.cal.isYomTov ? function (iso) { try { return !!st.cal.isYomTov(iso); } catch (e) { return false; } } : null,
      parasha: st.sb && st.sb.parashaHe, special: st.sb && st.sb.special && st.sb.special.map(function (x) { return x.he; }).join(" | ") });
    var real = list.filter(function (a) { return a.id !== "shabbat"; });
    var h = '<div class="al-head"><h2>' + esc(L("alTitle")) + "</h2><span>" + esc(L("alTitleEn")) + "</span></div>";
    h += '<div class="al-list">' + list.map(function (a) {
      return '<div class="al-item' + (a.hi ? " hi" : "") + '" data-alert="' + esc(a.id.replace(/-.*$/, "")) + '"><div class="al-top"><span class="al-ic">' + (I[a.icon] || "") + '</span><div><div class="al-t">' + esc(a.title) + '</div><div class="al-d">' + escT(a.text) + "</div></div></div>" +
        (a.cmd !== undefined
          ? '<button type="button" class="x-btn' + (a.hi ? " primary" : "") + '" data-cmd="' + esc(a.cmd) + '" data-go="' + (a.cmdGo ? "1" : "0") + '" data-href="' + esc(a.href) + '">' + esc(a.go) + "</button>"
          : '<a class="x-btn' + (a.id === "shabbat" ? " primary" : "") + '" href="' + esc(rootPath() + a.href) + '">' + esc(a.go) + "</a>") + "</div>";
    }).join("") + "</div>";
    if (!real.length && (st.items || st.rec)) h += '<div class="al-empty" style="margin-top:12px">' + esc(L("alAllGood")) + "</div>";
    if (st.el.getAttribute("data-html") !== h) { st.el.innerHTML = h; st.el.setAttribute("data-html", h); }
  }

  /* ---------- data per role ---------- */
  function stop() { if (st.unsub) { try { st.unsub(); } catch (e) {} st.unsub = null; } }
  async function start(role) {
    var f = fb(), t = T();
    st.items = st.docs = st.rec = st.pledges = null; st.sb = null; stop();
    var screen = role.isSuperAdmin || role.canScreen, finance = role.isSuperAdmin || role.canFinance;
    if (screen) {
      t.loadZmanim(rootPath()).then(render);
      if (window.OH_SCREEN_CONTENT) st.unsub = window.OH_SCREEN_CONTENT.subscribe("editor", function (items) { if (items) { st.items = items; render(); } });
      loadDocs();
      if (window.OH_CALENDAR && window.OH_CALENDAR.load) {
        window.OH_CALENDAR.load({ base: rootPath() + "src/", files: { zmanim: ["zmanim/roy-daily-5787.json"] } }).then(function (c) {
          st.cal = c; try { st.sb = c.shabbatBlock(t.comingShabbat(t.nyIso(now()))); } catch (e) {} render();
        }).catch(function () {});
      }
    }
    if (finance && f._db && f._db()) {
      var db = f._db();
      db.collection("recurringSchedules").get().then(function (s) { var a = []; s.forEach(function (x) { var o = x.data() || {}; o.id = x.id; a.push(o); }); st.rec = a; render(); }).catch(function () { st.rec = []; render(); });
      db.collection("pledges").get().then(function (s) { var a = []; s.forEach(function (x) { var o = x.data() || {}; o.id = x.id; a.push(o); }); st.pledges = a; render(); }).catch(function () { st.pledges = []; render(); });
    }
    render();
  }
  async function loadDocs() { var f = fb(); if (f && f.loadPrayerTimes) { var r = await f.loadPrayerTimes(); if (r && r.ok) { st.docs = r.items; render(); } } }
  window.addEventListener("oh-prayertimes-changed", function () { if (st.el) loadDocs(); });

  async function tick() {
    var el = document.getElementById("ohAlerts"), f = fb();
    if (!el || !f || !f.ready || !f.user) { if (st.el && (!el || !f || !f.user)) { stop(); st.el = null; } return; }
    var role; try { role = await f.resolveRole(); } catch (e) { role = null; }
    var ok = !!(role && (role.isSuperAdmin || role.canScreen || role.canFinance));
    if (!ok) { el.hidden = true; el.innerHTML = ""; el.removeAttribute("data-mounted"); return; }
    if (el.getAttribute("data-mounted") === f.user.uid && st.el === el) return;
    el.setAttribute("data-mounted", f.user.uid); el.classList.add("ohx", "al"); el.hidden = false;
    st.el = el; st.role = role; st.uid = f.user.uid;
    el.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-cmd]"); if (!b) return;
      var cmd = b.getAttribute("data-cmd"), go = b.getAttribute("data-go") === "1";
      if (window.OH_CMDBAR && window.OH_CMDBAR.fill(cmd, go)) return;
      location.href = rootPath() + "gabbai/#cmd=" + encodeURIComponent(cmd);
    });
    start(role);
  }
  window.OH_ALERTS = { build: build, _state: st };
  if (typeof document !== "undefined") { setInterval(tick, 1000); tick(); }
})();
