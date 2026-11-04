/* Or Hachaim | the Shabbat sheet (דף זמני שבת) | data, weekly edits, PDF (src/shabbat-sheet/sheet-core.js)
   Hanoch 2026-11-04: the gabbai page "חבילת שבת" makes the shul's own weekly
   sheet, Hebrew and English from the SAME numbers, and allows changes for one
   Shabbat only (change a time, hide a row, add a row, highlight ONE row).
   Pure functions, no page access, no network: the page (sheet-editor.js) and
   the Node tests call the same code.

   Where each row comes from:
     system (no typing): candle lighting, Shabbat end (calendar engine
       shabbatBlock, exactly as the TV), Shkiah Friday / Shabbat and Latest
       Shema Mg"a / Gr"a (the daily Zemaneh Yosef file, exactly as the TV),
       Rabbeinu Tam (src/zmanim/rabbeinu-tam.js: 72 zmaniyot after Shkiah),
       the parasha and the Mevarchin line (calendar engine).
     davening (prayerTimes, rules with days "fri" / "shabbat"): Mincha &
       Kabbalat Shabbat, Shacharit, Mincha & Seudah Shlishit, Arvit, and any
       other Friday / Shabbat time (shown under its own name).
     regular rows (settings/shabbatSheet.regular): rows added with "קבוע כל
       שבוע" (e.g. Chavruta, Shiur), on the sheet every week.
     this week only (settings/shabbatSheet.weeks[shabbat]): { times, hidden,
       star, extra }. No entry = the regular sheet.
   A davening row with no source shows in the editor as empty ("להזין") and
   is left off the sheet until it has a time. */
(function (root) {
  "use strict";

  /* ---------- times ---------- */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function min24(t) { var m = String(t || "").match(/^(\d{1,2}):(\d{2})/); if (!m) return -1; var h = +m[1], mi = +m[2]; if (h > 23 || mi > 59) return -1; return h * 60 + mi; }
  /* minutes -> "4:29" (12-hour, no AM/PM, as the shul prints) */
  function show(min) { if (typeof min !== "number" || min < 0) return ""; min = min % 1440; var h = Math.floor(min / 60) % 12 || 12; return h + ":" + pad(min % 60); }
  /* what a gabbai types -> minutes. "8:30", "08:30", "8.30", "830", "20:30",
     "8:30 PM". Without AM/PM a time 1:00 to 11:59 is read by the row's group:
     morning = AM, Erev Shabbat / afternoon = PM. -1 when not a time. */
  function parseTyped(s, group) {
    s = String(s == null ? "" : s).trim().replace(/[.\u05BE\-]/g, ":").replace(/\s+/g, " ");
    var m = s.match(/^(\d{1,2})(?::?(\d{2}))?\s*([AaPp]\.?[Mm]\.?)?$/);
    if (!m) return -1;
    var h = +m[1], mi = m[2] == null ? 0 : +m[2];
    if (mi > 59 || h > 23) return -1;
    if (m[3]) { if (h < 1 || h > 12) return -1; h = h % 12; if (/p/i.test(m[3])) h += 12; return h * 60 + mi; }
    if (h >= 13 || h === 0) return h * 60 + mi;
    if (h === 12) return 12 * 60 + mi;
    return (group === "morning" ? h : h + 12) * 60 + mi;
  }
  function normTyped(s, group) { var m = parseTyped(s, group); return m < 0 ? null : show(m); }

  /* ---------- names ---------- */
  var PARASHA_EN = {
    "בראשית": "Bereshit", "נח": "Noach", "לך לך": "Lech Lecha", "וירא": "Vayera", "חיי שרה": "Chayei Sarah", "תולדות": "Toldot",
    "ויצא": "Vayetze", "וישלח": "Vayishlach", "וישב": "Vayeshev", "מקץ": "Miketz", "ויגש": "Vayigash", "ויחי": "Vayechi",
    "שמות": "Shemot", "וארא": "Vaera", "בא": "Bo", "בשלח": "Beshalach", "יתרו": "Yitro", "משפטים": "Mishpatim",
    "תרומה": "Terumah", "תצוה": "Tetzaveh", "כי תשא": "Ki Tisa", "ויקהל": "Vayakhel", "פקודי": "Pekudei",
    "ויקרא": "Vayikra", "צו": "Tzav", "שמיני": "Shemini", "תזריע": "Tazria", "מצורע": "Metzora", "אחרי מות": "Acharei Mot",
    "קדושים": "Kedoshim", "אמור": "Emor", "בהר": "Behar", "בחקתי": "Bechukotai", "במדבר": "Bamidbar", "נשא": "Nasso",
    "בהעלתך": "Behaalotecha", "שלח": "Shelach", "שלח לך": "Shelach Lecha", "קרח": "Korach", "חקת": "Chukat", "בלק": "Balak",
    "פינחס": "Pinchas", "פנחס": "Pinchas", "מטות": "Matot", "מסעי": "Masei", "דברים": "Devarim", "ואתחנן": "Vaetchanan",
    "עקב": "Eikev", "ראה": "Re'eh", "שופטים": "Shoftim", "כי תצא": "Ki Tetze", "כי תבוא": "Ki Tavo", "נצבים": "Nitzavim",
    "וילך": "Vayelech", "האזינו": "Haazinu", "וזאת הברכה": "Vezot Haberachah",
    /* other spellings the calendar uses */
    "מצרע": "Metzora", "קדשים": "Kedoshim", "קורח": "Korach", "חוקת": "Chukat", "בחוקותי": "Bechukotai", "בהעלותך": "Behaalotecha",
    "תצווה": "Tetzaveh", "פיקודי": "Pekudei", "אחרי": "Acharei Mot", "נשוא": "Nasso", "מטת": "Matot", "שופטים ": "Shoftim", "כי תשא ": "Ki Tisa",
    "לך-לך": "Lech Lecha", "כי-תצא": "Ki Tetze", "כי-תבוא": "Ki Tavo", "כי תבא": "Ki Tavo", "אחרי-מות": "Acharei Mot", "שלח-לך": "Shelach Lecha"
  };
  var MONTH_EN = { "ניסן": "Nisan", "אייר": "Iyar", "סיון": "Sivan", "תמוז": "Tammuz", "אב": "Av", "אלול": "Elul", "תשרי": "Tishrei",
    "חשון": "Cheshvan", "חשוון": "Cheshvan", "מרחשון": "Cheshvan", "כסלו": "Kislev", "טבת": "Tevet", "שבט": "Shevat",
    "אדר": "Adar", "אדר א׳": "Adar I", "אדר ב׳": "Adar II", "אדר א": "Adar I", "אדר ב": "Adar II" };
  var WD_EN = { "ראשון": "Sunday", "שני": "Monday", "שלישי": "Tuesday", "רביעי": "Wednesday", "חמישי": "Thursday", "שישי": "Friday", "שבת": "Shabbat" };
  function stripNikud(s) { return String(s || "").replace(/[\u0591-\u05C7]/g, ""); }
  function parashaEn(he) {
    var p = stripNikud(he).replace(/^פרשת\s+/, "").trim(); if (!p) return "";
    if (PARASHA_EN[p]) return PARASHA_EN[p];
    /* a double parasha: "חוקת-בלק", "ויקהל-פקודי", "ויקהל פקודי" */
    var pair = p.split(/\s*[-־]\s*/);
    if (pair.length === 2 && PARASHA_EN[pair[0]] && PARASHA_EN[pair[1]]) return PARASHA_EN[pair[0]] + "-" + PARASHA_EN[pair[1]];
    var w = p.split(/\s+/);
    for (var i = 1; i < w.length; i++) { var a = w.slice(0, i).join(" "), b = w.slice(i).join(" "); if (PARASHA_EN[a] && PARASHA_EN[b]) return PARASHA_EN[a] + "-" + PARASHA_EN[b]; }
    return "";
  }
  function title(sb) {
    sb = sb || {};
    if (sb.parashaHe) { var en = parashaEn(sb.parashaHe); return { he: stripNikud(sb.parashaHe), en: en ? "Parashat " + en : "" }; }
    var sp = (sb.special || [])[0];
    return { he: sp ? sp.he : "שבת קודש", en: sb.holidayReadingEn || (sp && sp.key) || "Shabbat Kodesh" };
  }
  /* "שבת מברכין - ר״ח כסלו בימים שלישי ורביעי" | "Shabbat Mevarchin - Rosh Chodesh Kislev: Tuesday & Wednesday" */
  function mevarchin(sb) {
    var m = sb && sb.mevarchim; if (!m) return null;
    var month = stripNikud(m.monthHe || String(m.he || "").replace(/^שבת מברכים\s*/, "")).trim();
    var days = (m.roshChodeshDays || []).map(function (d) { return String(d.weekdayHe || "").replace(/^יום\s+/, ""); }).filter(Boolean);
    var he = "שבת מברכין - ר״ח " + month + (days.length === 1 ? " ביום " + days[0] : days.length === 2 ? " בימים " + days[0] + " ו" + days[1] : "");
    var enDays = days.map(function (d) { return WD_EN[d] || d; });
    var en = "Shabbat Mevarchin - Rosh Chodesh " + (MONTH_EN[month] || month) + (enDays.length ? ": " + enDays.join(" & ") : "");
    return { he: he, en: en, month: month, days: (m.roshChodeshDays || []).map(function (d) { return d.date; }) };
  }

  /* ---------- the rows ---------- */
  var GROUPS = ["erev", "morning", "afternoon"];
  /* sheet wording = the shul's own (their samples) */
  var W = {
    candle: { he: "הדלקת נרות", en: "Candle Lighting" },
    candleNotBefore: { he: "הדלקת נרות, לא לפני", en: "Candle Lighting, not before" },
    minchaFri: { he: "מנחה וקבלת שבת", en: "Mincha & Kabbalat Shabbat" },
    shkiahFri: { he: "שקיעה", en: "Shkiah" },
    shacharit: { he: "שחרית של שבת", en: "Shacharit" },
    shema: { he: "סוף זמן קריאת שמע מג״א {a} הגר״א {b}", en: "Latest Shema Mg”a {a} Gr”a {b}", a: { he: "מג״א", en: "Mg”a" }, b: { he: "הגר״א", en: "Gr”a" } },
    minchaSat: { he: "מנחה וסעודה שלישית", en: "Mincha & Seudah Shlishit" },
    shkiahSat: { he: "שקיעה", en: "Shkiah" },
    arvit: { he: "ערבית", en: "Arvit" },
    ends: { he: "צאת השבת {a} ר״ת {b}", en: "Shabbat Ends {a} R”t {b}", a: { he: "צאת השבת", en: "Shabbat Ends" }, b: { he: "ר״ת", en: "R”t" } },
    endsYT: { he: "{a}", en: "{a}" }
  };
  /* which prayerTimes doc fills which davening row */
  var SLOTS = [
    { id: "minchaFri", day: "fri", re: /מנחה|קבלת\s*שבת|mincha|kabbal/i, best: /מנחה.*קבלת|קבלת.*מנחה|mincha.*kabbal/i },
    { id: "shacharit", day: "sat", re: /שחרית|shacharit|shachris|shacharis/i, morning: true },
    { id: "minchaSat", day: "sat", re: /מנחה|mincha/i, afternoon: true },
    { id: "arvit", day: "sat", re: /ערבית|מעריב|arvit|maariv|arbit/i, afternoon: true }
  ];
  function docName(d) { return (d && (d.nameHe || d.name || d.nameEn)) || ""; }
  function docText(d) { return [d && d.nameHe, d && d.name, d && d.nameEn].filter(Boolean).join(" "); }
  function emptyWeek() { return { times: {}, hidden: [], star: "", extra: [] }; }
  function weekOf(settings, iso) {
    var w = settings && settings.weeks && settings.weeks[iso];
    var o = emptyWeek();
    if (w && typeof w === "object") {
      if (w.times && typeof w.times === "object") Object.keys(w.times).forEach(function (k) { if (typeof w.times[k] === "string") o.times[k] = w.times[k]; });
      if (Array.isArray(w.hidden)) o.hidden = w.hidden.filter(function (x) { return typeof x === "string"; });
      if (typeof w.star === "string") o.star = w.star;
      if (Array.isArray(w.extra)) o.extra = w.extra.filter(function (x) { return x && typeof x === "object" && x.id; });
    }
    return o;
  }

  /* inp: { shabbat:"YYYY-MM-DD", sb: shabbatBlock(shabbat), days: daily file days map,
           docs: prayerTimes docs [{id, nameHe, nameEn, time, order, rule}],
           timeOf: function(doc, iso) -> minutes (-1 not that day, -2 no data),
           settings: settings/shabbatSheet data, rt: OH_RABBEINU_TAM }
     -> { shabbat, friday, title, mev, rows:[...], week } */
  function build(inp) {
    var sh = inp.shabbat, fri = addDays(sh, -1), sb = inp.sb || {}, days = inp.days || {}, zf = days[fri] || {}, zs = days[sh] || {};
    var week = weekOf(inp.settings, sh), rows = [], RT = inp.rt || root.OH_RABBEINU_TAM;
    function add(r) {
      r.he = r.he || ""; r.en = r.en || ""; r.hidden = week.hidden.indexOf(r.id) >= 0; r.star = week.star === r.id;
      if (r.parts) {
        r.parts.forEach(function (p) { p.base = p.base || ""; var o = week.times[p.key]; p.changed = typeof o === "string" && o !== "" && o !== p.base; p.time = p.changed ? o : p.base; });
        r.changed = r.parts.some(function (p) { return p.changed; });
        r.empty = r.parts.every(function (p) { return !p.time; });
        r.min = r.parts[0].time ? parseTyped(r.parts[0].time, r.group) : -1;
      } else {
        r.base = r.base || ""; var o = week.times[r.id];
        r.changed = typeof o === "string" && o !== "" && o !== r.base; r.time = r.changed ? o : r.base;
        r.empty = !r.time; r.min = r.time ? parseTyped(r.time, r.group) : -1;
      }
      rows.push(r);
    }
    var t = function (hhmm) { var m = min24(hhmm); return m < 0 ? "" : show(m); };
    /* system rows */
    var cl = sb.candleLighting || {};
    var clW = cl.kind === "notBefore" ? W.candleNotBefore : W.candle;
    add({ id: "candle", group: "erev", kind: "zman", src: "auto", he: clW.he, en: clW.en, base: t(cl.time), rank: 0 });
    add({ id: "shkiahFri", group: "erev", kind: "zman", src: "auto", he: W.shkiahFri.he, en: W.shkiahFri.en, base: t(zf.shkiah), rank: 9 });
    add({ id: "shema", group: "morning", kind: "line", src: "auto", he: W.shema.he, en: W.shema.en, name: { he: "סוף זמן קריאת שמע", en: "Latest Shema" }, rank: 99,
      parts: [{ key: "shemaMga", he: W.shema.a.he, en: W.shema.a.en, base: t(zs.shemaMagen) }, { key: "shemaGra", he: W.shema.b.he, en: W.shema.b.en, base: t(zs.shemaGra) }] });
    add({ id: "shkiahSat", group: "afternoon", kind: "zman", src: "auto", he: W.shkiahSat.he, en: W.shkiahSat.en, base: t(zs.shkiah), rank: 8 });
    var end = sb.end || null, rtTime = "";
    if (end && end.rabbeinuTam) rtTime = t(end.rabbeinuTam);
    else if (end && RT && zs.rabbeinuTamMyZmanim) rtTime = t(RT.forDay(zs, "shabbat").time);
    if (end) add({ id: "ends", group: "afternoon", kind: "line", src: "auto", he: W.ends.he, en: W.ends.en, name: { he: "צאת השבת ורבינו תם", en: "Shabbat Ends and R”t" }, rank: 100,
      parts: [{ key: "ends", he: W.ends.a.he, en: W.ends.a.en, base: t(end.time) }, { key: "rt", he: W.ends.b.he, en: W.ends.b.en, base: rtTime }] });
    else if (sb.candleLightingSaturdayNight) {
      var sn = sb.candleLightingSaturdayNight;
      add({ id: "ends", group: "afternoon", kind: "line", src: "auto", he: "{a}", en: "{a}", rank: 100,
        parts: [{ key: "ends", he: sn.label || "הדלקת נרות", en: "Candle Lighting (Motzei Shabbat)", base: t(sn.time) }] });
    }
    /* davening: prayerTimes rules with days fri / shabbat */
    var used = {}, timeOf = inp.timeOf || function () { return -1; };
    var cand = (inp.docs || []).filter(function (d) { return d && d.rule && (d.rule.days === "fri" || d.rule.days === "shabbat"); }).map(function (d) {
      var iso = d.rule.days === "fri" ? fri : sh, m = timeOf(d, iso);
      return { doc: d, day: d.rule.days === "fri" ? "fri" : "sat", min: typeof m === "number" ? m : -1 };
    }).filter(function (c) { return c.min >= 0; }).sort(function (a, b) { return a.min - b.min; });
    SLOTS.forEach(function (s) {
      var pool = cand.filter(function (c) { return !used[c.doc.id] && c.day === s.day && s.re.test(docText(c.doc)) && (!s.morning || c.min < 720) && (!s.afternoon || c.min >= 720); });
      var pick = (s.best && pool.filter(function (c) { return s.best.test(docText(c.doc)); })[0]) || pool[0] || null;
      if (pick) used[pick.doc.id] = 1;
      var w = W[s.id];
      add({ id: s.id, group: s.day === "fri" ? "erev" : (s.morning ? "morning" : "afternoon"), kind: "davening", src: pick ? "pt" : "none",
        ptName: pick ? docName(pick.doc) : "", he: w.he, en: w.en, base: pick ? show(pick.min) : "", rank: { minchaFri: 5, shacharit: 1, minchaSat: 6, arvit: 9.5 }[s.id] });
    });
    cand.forEach(function (c) {
      if (used[c.doc.id]) return;
      add({ id: "pt:" + c.doc.id, group: c.day === "fri" ? "erev" : (c.min < 720 ? "morning" : "afternoon"), kind: "davening", src: "pt", ptName: docName(c.doc),
        he: c.doc.nameHe || c.doc.name || c.doc.nameEn || "", en: c.doc.nameEn || c.doc.nameHe || c.doc.name || "", base: show(c.min), rank: 5 });
    });
    /* regular rows (every week) and this week's added rows */
    ((inp.settings && Array.isArray(inp.settings.regular)) ? inp.settings.regular : []).forEach(function (x) {
      if (!x || !x.id) return;
      add({ id: "r:" + x.id, rid: x.id, group: GROUPS.indexOf(x.group) >= 0 ? x.group : "afternoon", kind: "regular", src: "regular", he: String(x.he || ""), en: String(x.en || ""), base: x.time ? (normTyped(x.time, x.group) || "") : "", rank: 5 });
    });
    week.extra.forEach(function (x) {
      add({ id: "x:" + x.id, xid: x.id, group: GROUPS.indexOf(x.group) >= 0 ? x.group : "afternoon", kind: "extra", src: "extra", he: String(x.he || ""), en: String(x.en || ""), base: x.time ? (normTyped(x.time, x.group) || "") : "", rank: 5 });
    });
    /* order inside each group: by time; rows with no time at their usual place; lines last */
    rows.forEach(function (r, i) { r.seq = i; });
    rows.sort(function (a, b) {
      var g = GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group); if (g) return g;
      var la = a.kind === "line" ? 1 : 0, lb = b.kind === "line" ? 1 : 0; if (la !== lb) return la - lb;
      var ka = a.min >= 0 ? a.min : -1, kb = b.min >= 0 ? b.min : -1;
      if (ka >= 0 && kb >= 0 && ka !== kb) return ka - kb;
      if (ka >= 0 && kb >= 0) return a.rank - b.rank || a.seq - b.seq;
      return a.rank - b.rank || a.seq - b.seq;
    });
    var mev = mevarchin(sb);
    return { shabbat: sh, friday: fri, title: title(sb), mev: mev ? { he: mev.he, en: mev.en, hidden: week.hidden.indexOf("mev") >= 0 } : null, rows: rows, week: week };
  }

  /* What goes on the sheet in one language: [{group, rows:[{label, time, star}|{line, star}]}] */
  function lines(model, lang) {
    var en = lang === "en", out = [];
    GROUPS.forEach(function (g) {
      var list = [];
      model.rows.forEach(function (r) {
        if (r.group !== g || r.hidden) return;
        if (r.kind === "line") {
          var have = r.parts.filter(function (p) { return p.time; });
          if (!have.length) return;
          var txt;
          if (r.parts.length === 2 && have.length === 2) txt = (en ? r.en : r.he).replace("{a}", r.parts[0].time).replace("{b}", r.parts[1].time);
          else txt = have.map(function (p) { return (en ? p.en : p.he) + " " + p.time; }).join(" ");
          list.push({ id: r.id, line: txt, star: r.star });
          return;
        }
        if (!r.time) return;
        var label = en ? (r.en || r.he) : (r.he || r.en);
        if (!label) return;
        list.push({ id: r.id, label: label, time: r.time, star: r.star });
      });
      if (list.length) out.push({ group: g, rows: list });
    });
    return out;
  }

  /* ---------- weekly edits (the page saves the result) ---------- */
  function addDays(iso, n) { var p = iso.split("-"), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]) + n * 864e5); return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate()); }
  function clone(o) { return JSON.parse(JSON.stringify(o || {})); }
  function clean(s, n) { return String(s == null ? "" : s).replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, n || 60); }
  var KEEP_WEEKS = 8;
  /* settings -> a copy with one change for the Shabbat `iso`. Empty weeks are
     removed; weeks older than KEEP_WEEKS before `iso` are dropped. */
  function edit(settings, iso, op) {
    var s = clone(settings); if (!s.weeks || typeof s.weeks !== "object" || Array.isArray(s.weeks)) s.weeks = {};
    if (!Array.isArray(s.regular)) s.regular = [];
    var w = weekOf(s, iso);
    switch (op.type) {
      case "time": /* key, value ("" = back to the regular time) */
        var k = String(op.key || ""); if (!/^[A-Za-z0-9:_-]{1,60}$/.test(k)) return null;
        if (op.value === "" || op.value == null) delete w.times[k];
        else { var v = normTyped(op.value, op.group); if (!v) return null; if (op.base && v === op.base) delete w.times[k]; else w.times[k] = v; }
        break;
      case "hide": var i = w.hidden.indexOf(op.id); if (op.hidden && i < 0) w.hidden.push(op.id); if (!op.hidden && i >= 0) w.hidden.splice(i, 1); break;
      case "star": w.star = op.on ? String(op.id || "") : (w.star === op.id ? "" : w.star); break;
      case "add":
        var he = clean(op.he), en = clean(op.en), g = GROUPS.indexOf(op.group) >= 0 ? op.group : "afternoon";
        if (!he && !en) return null;
        var tm = op.time ? normTyped(op.time, g) : ""; if (op.time && !tm) return null;
        var id = op.id || ("a" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36));
        if (op.every) { if (s.regular.length >= 30) return null; s.regular.push({ id: id, he: he, en: en, time: tm || "", group: g }); }
        else { if (w.extra.length >= 12) return null; w.extra.push({ id: id, he: he, en: en, time: tm || "", group: g }); }
        break;
      case "remove": /* a row added this week, or a regular row (from every week) */
        if (/^x:/.test(op.id)) w.extra = w.extra.filter(function (x) { return "x:" + x.id !== op.id; });
        else if (/^r:/.test(op.id)) s.regular = s.regular.filter(function (x) { return "r:" + x.id !== op.id; });
        else return null;
        if (w.star === op.id) w.star = "";
        w.hidden = w.hidden.filter(function (x) { return x !== op.id; });
        delete w.times[op.id];
        break;
      case "reset": w = emptyWeek(); break;
      default: return null;
    }
    var emptyW = !Object.keys(w.times).length && !w.hidden.length && !w.star && !w.extra.length;
    if (emptyW) delete s.weeks[iso]; else s.weeks[iso] = w;
    var oldest = addDays(iso, -7 * KEEP_WEEKS);
    Object.keys(s.weeks).forEach(function (k) { if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || k < oldest) delete s.weeks[k]; });
    return { weeks: s.weeks, regular: s.regular };
  }

  /* ---------- PDF: JPEG pages, no library ----------
     pages: [{ jpeg: Uint8Array, w: pixel width, h: pixel height }]
     Each page is US Letter (612 x 792 pt) filled with its image. Returns Uint8Array. */
  function pdf(pages, opts) {
    opts = opts || {}; var PW = opts.width || 612, PH = opts.height || 792;
    var enc = function (s) { var a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 255; return a; };
    var chunks = [], len = 0, offs = [];
    function push(b) { if (typeof b === "string") b = enc(b); chunks.push(b); len += b.length; }
    function obj(n, body) { offs[n] = len; push(n + " 0 obj\n"); body.forEach(push); push("\nendobj\n"); }
    push("%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n");
    var n = pages.length, kids = [];
    for (var i = 0; i < n; i++) kids.push((3 + i * 3) + " 0 R");
    obj(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
    obj(2, ["<< /Type /Pages /Count " + n + " /Kids [" + kids.join(" ") + "] >>"]);
    pages.forEach(function (p, i) {
      var pg = 3 + i * 3, im = pg + 1, ct = pg + 2;
      var content = "q " + PW + " 0 0 " + PH + " 0 0 cm /Im0 Do Q";
      obj(pg, ["<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + PW + " " + PH + "] /Resources << /XObject << /Im0 " + im + " 0 R >> >> /Contents " + ct + " 0 R >>"]);
      obj(im, ["<< /Type /XObject /Subtype /Image /Width " + p.w + " /Height " + p.h + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + p.jpeg.length + " >>\nstream\n", p.jpeg, "\nendstream"]);
      obj(ct, ["<< /Length " + content.length + " >>\nstream\n" + content + "\nendstream"]);
    });
    var total = 3 + n * 3, xref = len;
    var x = "xref\n0 " + total + "\n0000000000 65535 f \n";
    for (var k = 1; k < total; k++) x += String(offs[k]).padStart(10, "0") + " 00000 n \n";
    push(x + "trailer\n<< /Size " + total + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n");
    var out = new Uint8Array(len), o = 0; chunks.forEach(function (c) { out.set(c, o); o += c.length; });
    return out;
  }

  var api = { GROUPS: GROUPS, WORDS: W, SLOTS: SLOTS, KEEP_WEEKS: KEEP_WEEKS, show: show, min24: min24, parseTyped: parseTyped, normTyped: normTyped,
    parashaEn: parashaEn, title: title, mevarchin: mevarchin, build: build, lines: lines, edit: edit, weekOf: weekOf, addDays: addDays, pdf: pdf };
  root.OH_SHEET = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
