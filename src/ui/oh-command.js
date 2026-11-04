/* Or Hachaim | 2040 phase 1 | שורת הפקודה החכמה: המנתח (src/ui/oh-command.js)
   A deterministic Hebrew parser. No AI, no outside service, no network:
   only fixed word lists and patterns, so the same sentence always gives the
   same answer, and an unknown sentence gives suggestions, never a guess.
   parse(text, ctx) returns one of:
     {type:"plan", plan}        a change to show in the preview card (nothing is written here)
     {type:"nav", href, label}  open a page
     {type:"undo"} | {type:"help"}
     {type:"error", message, suggestions:[...]}
   ctx = { today:"YYYY-MM-DD", docs:[prayerTimes], zman:function(iso), lastZmanDay:"YYYY-MM-DD",
           holiday:function(key, fromIso) -> {iso, he} | null, role:{...} }
   Works in the browser (window.OH_COMMAND) and in Node (module.exports). */
(function (root) {
  "use strict";
  var T = (typeof module !== "undefined" && module.exports) ? require("./oh-times.js") : root.OH_TIMES;

  /* ---------- words ---------- */
  /* prayer names: aliases (normalized) -> canonical Hebrew, English, and the
     half of the day an hour like "6:30" means when nobody said. */
  var PRAYERS = [
    { he: "שחרית ותיקין", en: "Shacharit Vatikin", ap: "am", a: ["שחרית ותיקין", "שחרית נץ", "ותיקין", "נץ החמה", "מניין ותיקין"] },
    { he: "מנחה גדולה", en: "Mincha Gedola", ap: "pm", a: ["מנחה גדולה"] },
    { he: "קבלת שבת", en: "Kabbalat Shabbat", ap: "pm", a: ["קבלת שבת", "קבלת השבת", "kabbalat shabbat"] },
    { he: "שחרית", en: "Shacharit", ap: "am", a: ["שחרית", "תפילת שחרית", "shacharit", "shacharis"] },
    { he: "מנחה", en: "Mincha", ap: "pm", a: ["מנחה", "תפילת מנחה", "mincha"] },
    { he: "ערבית", en: "Arvit", ap: "pm", a: ["ערבית", "מעריב", "תפילת ערבית", "arvit", "maariv"] },
    { he: "מוסף", en: "Musaf", ap: "am", a: ["מוסף", "musaf"] },
    { he: "סליחות", en: "Selichot", ap: "am", a: ["סליחות", "selichot"] },
    { he: "דף יומי", en: "Daf Yomi", ap: "ask", a: ["דף יומי", "שיעור דף יומי", "הדף היומי"] },
    { he: "שיעור", en: "Shiur", ap: "ask", a: ["שיעור תורה", "שיעור הרב", "שיעור"] }
  ];
  var ALIASES = [];
  PRAYERS.forEach(function (p) { p.a.forEach(function (a) { ALIASES.push({ a: a, p: p }); }); });
  ALIASES.sort(function (x, y) { return y.a.length - x.a.length; });

  var NUMWORDS = { "חמש": 5, "חמישה": 5, "עשר": 10, "עשרה": 10, "חמש עשרה": 15, "רבע שעה": 15, "עשרים": 20, "עשרים וחמש": 25, "חצי שעה": 30, "שלושים": 30, "ארבעים": 40, "ארבעים וחמש": 45, "שעה": 60 };
  var GMONTHS = { "ינואר": 1, "פברואר": 2, "מרץ": 3, "מרס": 3, "אפריל": 4, "מאי": 5, "יוני": 6, "יולי": 7, "אוגוסט": 8, "ספטמבר": 9, "אוקטובר": 10, "נובמבר": 11, "דצמבר": 12 };
  var HMONTHS = ["תשרי", "חשון", "חשוון", "כסלו", "טבת", "שבט", "אדר", "אדר א", "אדר ב", "ניסן", "אייר", "סיון", "סיוון", "תמוז", "אב", "אלול"];
  /* named days: alias -> calendar engine key (first day) */
  var HOLIDAYS = [
    ["ראש השנה", "Rosh Hashana", "ראש השנה"], ["יום כיפור", "Yom Kippur", "יום כיפור"], ["יום הכיפורים", "Yom Kippur", "יום כיפור"], ["יום כפור", "Yom Kippur", "יום כיפור"],
    ["סוכות", "Sukkot I", "סוכות"], ["חג הסוכות", "Sukkot I", "סוכות"], ["שמחת תורה", "Simchat Torah", "שמחת תורה"], ["שמיני עצרת", "Shmini Atzeret", "שמיני עצרת"],
    ["חנוכה", "Chanukah", "חנוכה"], ["חג החנוכה", "Chanukah", "חנוכה"], ["עשרה בטבת", "Asara B'Tevet", "עשרה בטבת"], ["י' בטבת", "Asara B'Tevet", "עשרה בטבת"],
    ["ט\"ו בשבט", "Tu BiShvat", "ט״ו בשבט"], ["טו בשבט", "Tu BiShvat", "ט״ו בשבט"], ["תענית אסתר", "Ta'anit Esther", "תענית אסתר"],
    ["פורים", "Purim", "פורים"], ["ערב פסח", "Erev Pesach", "ערב פסח"], ["פסח", "Pesach I", "פסח"], ["חג הפסח", "Pesach I", "פסח"],
    ["ל\"ג בעומר", "Lag BaOmer", "ל״ג בעומר"], ["לג בעומר", "Lag BaOmer", "ל״ג בעומר"], ["ערב שבועות", "Erev Shavuot", "ערב שבועות"], ["שבועות", "Shavuot I", "שבועות"], ["חג השבועות", "Shavuot I", "שבועות"],
    ["י\"ז בתמוז", "Tzom Tammuz", "י״ז בתמוז"], ["שבעה עשר בתמוז", "Tzom Tammuz", "י״ז בתמוז"], ["תשעה באב", "Tish'a B'Av", "תשעה באב"], ["ט' באב", "Tish'a B'Av", "תשעה באב"], ["ט באב", "Tish'a B'Av", "תשעה באב"],
    ["ערב ראש השנה", "Erev Rosh Hashana", "ערב ראש השנה"], ["שעון קיץ", "dst-start", "שעון קיץ"], ["שעון חורף", "dst-end", "שעון חורף"]
  ];
  HOLIDAYS.sort(function (x, y) { return y[0].length - x[0].length; });

  var NAV = [
    { k: ["כספים", "הכספים", "פיננסים", "הנהלת חשבונות", "חשבונות", "מתפללים", "רשימת מתפללים"], href: "finance/", he: "כספים", can: "finance" },
    { k: ["נדרים", "הנדרים"], href: "finance/#nedarim", he: "נדרים", can: "finance" },
    { k: ["דוחות", "דוח", "חיובים קבועים"], href: "finance/#reports", he: "דוחות וחיובים קבועים", can: "finance" },
    { k: ["יומן", "יומן פעולות", "פעולות אחרונות"], href: "finance/#activity", he: "יומן פעולות", can: "finance" },
    { k: ["גיבוי", "גיבויים", "הגיבוי"], href: "backup/", he: "גיבוי", can: "super" },
    { k: ["שחזור", "שחזר"], href: "restore/", he: "שחזור", can: "super" },
    { k: ["הרשאות", "משתמשים", "ניהול משתמשים", "גבאים"], href: "admin/#userMgmtSection", he: "הרשאות", can: "super" },
    { k: ["זמני תפילה", "זמני התפילה", "זמנים"], href: "admin/#ptSection", he: "זמני תפילה", can: "screen" },
    { k: ["עורך המסך", "תוכן", "תוכן המסך", "הכרזות", "עריכת המסך", "חסויות", "יארצייטים"], href: "admin/#screenContent", he: "תוכן המסך", can: "screen" },
    { k: ["המסך", "מסך", "טלוויזיה", "הטלוויזיה", "tv", "המסך בבית הכנסת"], href: "tv/", he: "המסך", can: "any" },
    { k: ["חבילת שבת", "עלון שבת", "עלון", "חבילת השבת", "עלון השבת", "שבת"], href: "gabbai/shabbat/", he: "חבילת שבת", can: "screen" },
    { k: ["דף הבית", "בית", "ראשי"], href: "gabbai/", he: "דף הבית", can: "any" },
    { k: ["החשבון שלי", "החשבון", "חשבון אישי"], href: "congregant/", he: "החשבון שלי", can: "congregant" }
  ];

  /* ---------- text ---------- */
  function norm(s) {
    return String(s == null ? "" : s)
      .replace(/[\u0591-\u05C7]/g, function (c) { return c === "\u05BE" ? "-" : ""; })
      .replace(/[״”“„]/g, "\"").replace(/[׳’‘`]/g, "'")
      .replace(/[\u2010-\u2015\u2212]/g, "-")
      .replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim()
      .replace(/[.!?,;]+$/, "").trim();
  }
  function esc(s) { return String(s == null ? "" : s); }
  var B = "(?:^|\\s)", E = "(?=\\s|$)";
  function cut(str, m) { return (str.slice(0, m.index) + " " + str.slice(m.index + m[0].length)).replace(/\s+/g, " ").trim(); }

  var FILLERS = ["את", "זמן", "זמני", "תפילת", "תפילה", "של", "להיות", "יהיה", "תהיה", "בשעה", "ב", "ל", "-", ":", "גם", "וגם", "מעכשיו", "בבקשה", "מניין", "המניין", "הזמן", "ה", "עכשיו", "על", "המסך", "למסך", "קבוע", "קבועה", "ו", "שוב", "בקביעות", "החל", "עד", "מ"];

  function err(message, suggestions) { return { type: "error", message: message, suggestions: suggestions || [] }; }
  function examples(role) {
    var ex = [];
    if (!role || role.canScreen) ex.push("מנחה 6:30 כל יום חול עד פסח", "ערבית 15 דקות אחרי השקיעה", "מחק שחרית 7:05", "שחרית ביום ראשון 8:00", "הכרזה: שיעור הרב אחרי ערבית");
    if (!role || role.canFinance) ex.push("כספים");
    if (!role || role.isSuperAdmin) ex.push("גיבוי");
    return ex;
  }

  /* ---------- time ---------- */
  var AMW = "(?:am|a\\.m|בבוקר|לפנה\"צ|לפני הצהריים|בלילה|בצהריים|בערב|pm|p\\.m|אחה\"צ|אחר הצהריים|אחרי הצהריים)";
  function apOf(w) {
    if (!w) return null; w = w.toLowerCase();
    if (/^(am|a\.m|בבוקר|לפנה"צ|לפני הצהריים)$/.test(w)) return "am";
    if (/^(בלילה)$/.test(w)) return "night";
    if (/^(בצהריים)$/.test(w)) return "noon";
    return "pm";
  }
  /* -> {min} | {ask:true} | {bad:true} */
  function resolveHour(h, mi, ap, prayer) {
    if (h > 23 || mi > 59) return { bad: true };
    if (h >= 13 || h === 0) { return { min: h * 60 + mi, explicit: true }; }
    var mode = ap || null;
    if (!mode) mode = prayer ? prayer.ap : "ask";
    if (mode === "ask") return { ask: true };
    if (mode === "am") return { min: (h % 12) * 60 + mi, explicit: !!ap };
    if (mode === "noon") return { min: (h === 12 ? 12 : (h <= 4 ? h + 12 : h)) * 60 + mi, explicit: true };
    if (mode === "night") return { min: (h >= 6 ? (h % 12) + 12 : (h % 12)) * 60 + mi, explicit: true };
    return { min: ((h % 12) + 12) * 60 + mi, explicit: !!ap }; /* pm */
  }

  /* ---------- dates ---------- */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function validDate(y, m, d) { var dt = new Date(Date.UTC(y, m - 1, d)); return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d; }
  function nextOccurrence(today, m, d) {
    var y = +today.slice(0, 4);
    for (var k = 0; k < 3; k++) { if (validDate(y + k, m, d)) { var iso = (y + k) + "-" + pad(m) + "-" + pad(d); if (iso >= today) return iso; } }
    return null;
  }
  function dstDate(kind, today) {
    var y = +today.slice(0, 4);
    for (var k = 0; k < 3; k++) {
      var yy = y + k, m = kind === "dst-start" ? 3 : 11, n = kind === "dst-start" ? 2 : 1, c = 0;
      for (var d = 1; d <= 14; d++) { var iso = yy + "-" + pad(m) + "-" + pad(d); if (T.dow(iso) === 0 && ++c === n) { if (iso >= today) return iso; break; } }
    }
    return null;
  }
  /* str -> {iso, he, named} | {error} */
  function parseDateRef(str, ctx) {
    var s = norm(str).replace(/^(?:ה-?|ל-?|ה|ל)(?=\d)/, "").replace(/^(?:יום )/, "");
    var today = ctx.today, m;
    if ((m = s.match(/^(\d{1,2})[./](\d{1,2})(?:[./](\d{2}|\d{4}))?$/))) {
      var d = +m[1], mo = +m[2], y = m[3] ? +m[3] : null;
      if (y !== null && y < 100) y += 2000;
      if (mo < 1 || mo > 12 || d < 1 || d > 31) return { error: "התאריך " + str + " לא תקין" };
      var iso = y ? (validDate(y, mo, d) ? y + "-" + pad(mo) + "-" + pad(d) : null) : nextOccurrence(today, mo, d);
      if (!iso) return { error: "התאריך " + str + " לא תקין" };
      return { iso: iso, he: T.dateHe(iso), named: false };
    }
    if ((m = s.match(/^(\d{1,2}) ?(?:ב|ל)?(ינואר|פברואר|מרץ|מרס|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)(?: (\d{4}))?$/))) {
      var mo2 = GMONTHS[m[2]], d2 = +m[1], y2 = m[3] ? +m[3] : null;
      var iso2 = y2 ? (validDate(y2, mo2, d2) ? y2 + "-" + pad(mo2) + "-" + pad(d2) : null) : nextOccurrence(today, mo2, d2);
      if (!iso2) return { error: "התאריך " + str + " לא תקין" };
      return { iso: iso2, he: T.dateHe(iso2), named: false };
    }
    if (/^(היום)$/.test(s)) return { iso: today, he: "היום", named: false };
    if (/^(מחר)$/.test(s)) return { iso: T.addDays(today, 1), he: "מחר", named: false };
    if (/^(השבת|שבת|שבת הקרובה|סוף השבוע)$/.test(s)) { var sh = T.comingShabbat(today); return { iso: sh, he: "שבת " + T.dateShort(sh), named: false }; }
    if (/^(סוף החודש)$/.test(s)) { var y3 = +today.slice(0, 4), m3 = +today.slice(5, 7), last = new Date(Date.UTC(y3, m3, 0)).getUTCDate(); var iso3 = y3 + "-" + pad(m3) + "-" + pad(last); return { iso: iso3, he: T.dateHe(iso3), named: false }; }
    if ((m = s.match(/^(?:ראש חודש|ר"ח|רח) ([\u05d0-\u05ea' ]+)$/))) {
      var mon = m[1].replace(/'/g, "").trim();
      if (HMONTHS.indexOf(mon) < 0) return { error: "לא הכרתי את החודש " + m[1] };
      var r = ctx.holiday ? ctx.holiday("rc:" + mon, today) : null;
      if (!r) return { error: "אין לי עדיין את ראש חודש " + mon + " בלוח" };
      return { iso: r.iso, he: "ראש חודש " + mon, named: true };
    }
    var s2 = s.replace(/^(?:חג |ה)(?=\S)/, function (x) { return x === "חג " ? "חג " : x; });
    for (var i = 0; i < HOLIDAYS.length; i++) {
      var h = HOLIDAYS[i];
      if (s === h[0] || s2 === h[0] || s === "ה" + h[0]) {
        if (h[1] === "dst-start" || h[1] === "dst-end") { var dd = dstDate(h[1], today); return dd ? { iso: dd, he: h[2] + " (" + T.dateShort(dd) + ")", named: true } : { error: "לא מצאתי את " + h[2] }; }
        var hr = ctx.holiday ? ctx.holiday(h[1], today) : null;
        if (!hr) return { error: ctx.holiday ? "אין לי עדיין את " + h[2] + " בלוח של השנה הזאת" : "הלוח עוד נטען, נסו שוב בעוד רגע" };
        return { iso: hr.iso, he: h[2], named: true };
      }
    }
    return { error: "לא הבנתי את התאריך \"" + str + "\"" };
  }

  /* ---------- the prayer sentence ---------- */
  var VERBS = [
    { re: /^(?:הוסף|תוסיף|הוסיפי|הוספה|להוסיף|הוסף זמן|זמן חדש|חדש|קבע|תקבע|קבעי)\s+/, act: "add" },
    { re: /^(?:שנה|תשנה|שני|לשנות|עדכן|תעדכן|עדכני|לעדכן|החלף|תחליף|הזז|תזיז|הזיזי|תקן|תתקן)\s+/, act: "update" },
    { re: /^(?:מחק|תמחק|מחקי|למחוק|הסר|תסיר|הסירי|להסיר|הורד|תוריד|הורידי|בטל|תבטל|בטלי)\s+/, act: "delete" }
  ];
  function findPrayer(s) {
    for (var i = 0; i < ALIASES.length; i++) {
      var a = ALIASES[i].a, re = new RegExp(B + "(?:ה|ו|ל|ב)?" + a.replace(/[.*+?^${}()|[\]\\"]/g, "\\$&") + E, "i");
      var m = s.match(re);
      if (m) return { p: ALIASES[i].p, m: m };
    }
    return null;
  }
  function samePrayer(doc, p) { var n = norm(doc.nameHe || ""); return n === p.he || p.a.indexOf(n) >= 0 || norm(doc.nameEn || "").toLowerCase() === p.en.toLowerCase(); }

  function extract(rest, p, ctx) {
    var o = { times: [], offset: null, days: null, daysHe: null, oneOff: null, from: null, until: null, notes: [] }, m, re;
    /* sunset relative */
    re = new RegExp(B + "(?:ב-?|ל-?)?(\\d{1,3}|" + Object.keys(NUMWORDS).sort(function (a, b) { return b.length - a.length; }).join("|") + ")\\s*(?:דקות|דק'|דק|דקה)?\\s*(לפני|אחרי|אחר)\\s+(?:ה)?שקיעה(?:\\s+החמה)?" + E);
    if ((m = rest.match(re))) {
      var n = /^\d+$/.test(m[1]) ? +m[1] : NUMWORDS[m[1]];
      if (n > 180) return { error: "הפרש גדול מדי מהשקיעה (" + n + " דקות)" };
      o.offset = m[2] === "לפני" ? -n : n; rest = cut(rest, m);
    } else if ((m = rest.match(new RegExp(B + "(?:ל-?)?(?:ב|עם |בזמן )(?:ה)?שקיעה" + E)))) { o.offset = 0; rest = cut(rest, m); }
    else if ((m = rest.match(new RegExp(B + "(?:\\d+\\s*)?(?:דקות|דק')?\\s*(?:לפני|אחרי)\\s+(?:צאת הכוכבים|הצאת|צאה\"כ|הנץ|נץ|פלג|פלג המנחה|חצות|עלות השחר)" + E)))) {
      return { error: "כרגע אפשר לקבוע זמן יחסי רק לשקיעה", suggestions: [p.he + " 15 דקות לפני השקיעה", p.he + " " + (p.ap === "am" ? "7:00" : "6:30")] };
    }
    /* date range: from X until Y, until Y, from X */
    var DATE = "((?:\\d{1,2}[./]\\d{1,2}(?:[./]\\d{2,4})?)|(?:\\d{1,2} ?(?:ב|ל)?(?:ינואר|פברואר|מרץ|מרס|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)(?: \\d{4})?)|(?:ראש חודש|ר\"ח) [\\u05d0-\\u05ea']+(?: [אב]'?)?|היום|מחר|סוף החודש|השבת|שבת הקרובה|" +
      HOLIDAYS.map(function (h) { return "(?:חג )?" + h[0].replace(/["']/g, function (c) { return c; }); }).join("|") + ")";
    var reFromUntil = new RegExp(B + "(?:החל )?(?:מ-?|מה-?|מתאריך |מיום |החל מ-?)" + DATE + "\\s+(?:ו?עד(?: ל-?| ה-?| ל| ה)?)\\s*" + DATE + E);
    var reUntil = new RegExp(B + "(?:ו?עד|ועד|עד ל|עד ה|עד ל-|עד ה-|עד ליום|עד יום|עד תאריך)\\s*-?\\s*" + DATE + E);
    var reFrom = new RegExp(B + "(?:החל מ-?|החל מה-?|מ-|מה-|מתאריך |מיום |מ|מה)" + DATE + E);
    if ((m = rest.match(reFromUntil))) {
      var f1 = parseDateRef(m[1], ctx), u1 = parseDateRef(m[2], ctx);
      if (f1.error) return { error: f1.error }; if (u1.error) return { error: u1.error };
      o.from = f1; o.until = u1; rest = cut(rest, m);
    } else {
      if ((m = rest.match(reUntil))) { var u2 = parseDateRef(m[1], ctx); if (u2.error) return { error: u2.error }; o.until = u2; rest = cut(rest, m); }
      if ((m = rest.match(reFrom))) { var f2 = parseDateRef(m[1], ctx); if (f2.error) return { error: f2.error }; o.from = f2; rest = cut(rest, m); }
    }
    /* days */
    var DAYP = [
      [/(?:^|\s)(?:כל יום חוץ משבת|חוץ משבת|ראשון עד שישי|מראשון עד שישי|א' ?- ?ו'|א-ו|א עד ו|ימים א-ו)(?=\s|$)/, "weekday"],
      [/(?:^|\s)(?:כל יום חול|כל ימי החול|בכל ימי החול|בימי החול|בימי חול|ימי חול|ימות החול|בימות החול|ביום חול|בימים רגילים|בחול|ראשון עד חמישי|מראשון עד חמישי|א' ?- ?ה'|א-ה|א עד ה|ימים א-ה|יום חול|חול(?!\s+המועד))(?=\s|$)/, "sun-thu"], /* 2040 phase 2: bare "חול" too (Hanoch 9:10 AM: חול = Sunday to Thursday) */
      [/(?:^|\s)(?:במוצאי שבת|מוצאי שבת|במוצ"ש|מוצ"ש|במוצש|מוצש)(?=\s|$)/, "shabbat", "מוצאי שבת"],
      [/(?:^|\s)(?:בשבת הקרובה|בשבת הזאת|בשבת הזו|השבת הקרובה|השבת)(?=\s|$)/, "one-shabbat"],
      [/(?:^|\s)(?:כל יום שישי|כל שישי|בימי שישי|בערב שבת|בערבי שבת|ערב שבת|ביום שישי|בשישי|יום שישי|שישי)(?=\s|$)/, "fri"],
      [/(?:^|\s)(?:כל שבת|בשבתות|בכל שבת|ביום שבת|בשבת|שבת)(?=\s|$)/, "shabbat"],
      [/(?:^|\s)(?:כל יום|בכל יום|כל הימים|יומי|יום יום)(?=\s|$)/, "all"],
      [/(?:^|\s)(?:היום)(?=\s|$)/, "one-today"],
      [/(?:^|\s)(?:מחר)(?=\s|$)/, "one-tomorrow"],
      [/(?:^|\s)כל יום (ראשון|שני|שלישי|רביעי|חמישי)(?=\s|$)/, "every-wd"],
      [/(?:^|\s)(?:ביום|יום|ב)(ראשון|שני|שלישי|רביעי|חמישי)(?:\s+הקרוב)?(?=\s|$)/, "one-wd"],
      [/(?:^|\s)(?:ביום |יום )(ראשון|שני|שלישי|רביעי|חמישי)(?:\s+הקרוב)?(?=\s|$)/, "one-wd"]
    ];
    for (var k = 0; k < DAYP.length; k++) {
      var dm = rest.match(DAYP[k][0]); if (!dm) continue;
      var kind = DAYP[k][1];
      if (kind === "every-wd") return { error: "המסך עוד לא יודע זמן קבוע ל\"כל יום " + dm[1] + "\" לבד", suggestions: [p.he + " ביום " + dm[1] + " " + (p.ap === "am" ? "8:00" : "6:30") + " (רק השבוע)", p.he + " " + (p.ap === "am" ? "8:00" : "6:30") + " ראשון עד חמישי"] };
      if (o.days || o.oneOff) return { error: "יש במשפט שני סוגי ימים. כתבו רק אחד, למשל \"כל יום חול\" או \"בשבת\"" };
      if (kind === "one-shabbat") { var sh = T.comingShabbat(ctx.today); o.oneOff = { iso: sh, he: "רק בשבת הקרובה, " + T.dateHe(sh) }; }
      else if (kind === "one-today") o.oneOff = { iso: ctx.today, he: "רק היום, " + T.dateHe(ctx.today) };
      else if (kind === "one-tomorrow") { var tm = T.addDays(ctx.today, 1); o.oneOff = { iso: tm, he: "רק מחר, " + T.dateHe(tm) }; }
      else if (kind === "one-wd") { var wd = T.WD_HE.indexOf(dm[1]); var nd = T.nextDow(ctx.today, wd); o.oneOff = { iso: nd, he: "רק ביום " + dm[1] + " הקרוב, " + T.dateHe(nd) }; }
      else { o.days = kind; o.daysHe = DAYP[k][2] || T.DAY_HE[kind]; }
      rest = cut(rest, dm);
    }
    /* clock times, with or without a part-of-day word */
    var reT = new RegExp(B + "(ל-?|ב-?|לשעה |בשעה )?(\\d{1,2})[:.](\\d{2})(?:\\s*(" + AMW + "))?" + E, "i");
    while ((m = rest.match(reT))) {
      o.times.push({ h: +m[2], mi: +m[3], ap: apOf(m[4]), to: !!(m[1] && /^ל/.test(m[1])), raw: m[0].trim() });
      rest = cut(rest, m);
    }
    var reH = new RegExp(B + "(ל-?|ב-?)?(\\d{1,2})\\s+(" + AMW + ")" + E, "i");
    while ((m = rest.match(reH))) { o.times.push({ h: +m[2], mi: 0, ap: apOf(m[3]), to: !!(m[1] && /^ל/.test(m[1])), raw: m[0].trim() }); rest = cut(rest, m); }
    var leftover = rest.split(" ").filter(function (w) { return w && FILLERS.indexOf(w) < 0; });
    o.leftover = leftover.join(" ");
    return o;
  }

  function describeDays(rule, oneOffHe) {
    if (oneOffHe) return oneOffHe;
    if (!rule) return "כל יום";
    return T.DAY_HE[rule.days || "all"];
  }
  function rangeHe(fromRef, untilRef) {
    var a = [];
    if (fromRef) a.push("מ" + (fromRef.named ? fromRef.he + ", " + T.dateHe(fromRef.iso) : T.dateHe(fromRef.iso)));
    if (untilRef) a.push("עד " + T.dateHe(untilRef.iso) + (untilRef.named ? " (" + untilRef.why + ")" : ""));
    return a.join(" ");
  }

  function parsePrayer(t, ctx) {
    var act = null, s = t;
    for (var i = 0; i < VERBS.length; i++) { var vm = s.match(VERBS[i].re); if (vm) { act = VERBS[i].act; s = s.slice(vm[0].length); break; } }
    var fp = findPrayer(s);
    if (!fp) return null;
    var p = fp.p, rest = cut(s, fp.m);
    var x = extract(rest, p, ctx);
    if (x.error) return err(x.error, x.suggestions || [p.he + " 6:30 כל יום חול עד פסח", p.he + " 15 דקות לפני השקיעה"]);
    if (x.leftover) return err("לא הבנתי את \"" + x.leftover + "\"", [p.he + " " + (p.ap === "am" ? "7:05" : "6:30"), p.he + " 15 דקות לפני השקיעה", p.he + " 6:30 כל יום חול עד פסח"].concat(act === "delete" ? [] : ["מחק " + p.he]));
    var docs = (ctx.docs || []).filter(function (d) { return samePrayer(d, p); });

    /* resolve the times */
    function res(tm) { return resolveHour(tm.h, tm.mi, tm.ap, p); }
    var toTime = null, atTime = null;
    for (var k = 0; k < x.times.length; k++) {
      var r = res(x.times[k]);
      if (r.bad) return err("השעה " + x.times[k].raw + " לא תקינה", [p.he + " 6:30"]);
      if (r.ask) return err("לא ברור אם " + x.times[k].raw + " בבוקר או בערב", [p.he + " " + x.times[k].h + ":" + pad(x.times[k].mi) + " בבוקר", p.he + " " + x.times[k].h + ":" + pad(x.times[k].mi) + " בערב"]);
      x.times[k].min = r.min; x.times[k].explicit = r.explicit;
    }
    if (x.times.length > 2) return err("יש במשפט יותר משתי שעות", [p.he + " 6:30", "שנה " + p.he + " 6:30 ל-6:45"]);
    if (x.times.length === 2) { atTime = x.times[0]; toTime = x.times[1]; if (!act) act = "update"; }
    else if (x.times.length === 1) {
      if (x.times[0].to && act !== "delete") { toTime = x.times[0]; if (!act) act = "update"; }
      else if (act === "delete") atTime = x.times[0];
      else if (act === "update" && (x.offset !== null || x.days || x.oneOff || x.from || x.until) && matchDocs(x.times[0], null).length) atTime = x.times[0]; /* "שנה מנחה 4:45 עד חנוכה": the time names the doc */
      else toTime = x.times[0];
    }

    function matchDocs(tm, offset) {
      return docs.filter(function (d) {
        if (offset !== null && offset !== undefined) return d.rule && d.rule.kind === "sunset" && Math.round(+d.rule.offsetMin || 0) === offset;
        if (!tm) return true;
        var dm = T.min12(d.time); if (dm < 0) dm = d.order;
        if (tm.explicit || tm.ap) return dm === tm.min;
        return T.short12(dm) === tm.h % 12 + ":" + pad(tm.mi) || T.short12(dm) === (tm.h % 12 || 12) + ":" + pad(tm.mi);
      });
    }
    function docLabel(d) { return (d.nameHe || "") + " " + (d.rule && d.rule.kind === "sunset" ? T.offsetHe(d.rule.offsetMin) : (T.min12(d.time) >= 0 ? d.time : T.fmt12(d.order))); }
    function pick(list, verb) {
      if (!docs.length) return err("אין כרגע זמן " + p.he + " ברשימה", ["הוסף " + p.he + " " + (p.ap === "am" ? "7:05" : "6:30")]);
      if (!list.length) return err("לא מצאתי " + p.he + " בשעה הזאת. יש: " + docs.map(docLabel).join(", "), docs.map(function (d) { return verb + " " + docLabel(d); }));
      if (list.length > 1) return err("יש " + list.length + " זמני " + p.he + ". איזה מהם?", list.map(function (d) { return verb + " " + docLabel(d); }));
      return list[0];
    }

    if (act === "delete") {
      if (x.days || x.oneOff || x.from || x.until || toTime) {
        /* "מחק מנחה 6:30 כל יום חול" still names one doc; the days only narrow nothing */
      }
      var target = pick(matchDocs(atTime, x.offset), "מחק");
      if (target.type === "error") return target;
      return { type: "plan", plan: { action: "delete", nameHe: target.nameHe, target: target, rows: [
        { k: "פעולה", v: "מחיקת זמן תפילה" }, { k: "תפילה", v: target.nameHe }, { k: "שעה", v: target.rule && target.rule.kind === "sunset" ? T.offsetHe(target.rule.offsetMin) : target.time },
        { k: "ימים", v: target.rule ? (T.describeRule(target.rule, target.time) || "כל יום") : "כל יום" }, { k: "על המסך", v: "הזמן יוסר מהמסך" }], warnings: [] } };
    }

    var keepTime = false;
    if (!toTime && x.offset === null && act === "update" && (x.days || x.oneOff || x.from || x.until)) keepTime = true;
    if (!toTime && x.offset === null && !keepTime) {
      if (act === "update") return err("לאיזו שעה לשנות?", [ "שנה " + p.he + " ל-" + (p.ap === "am" ? "7:15" : "6:45"), "שנה " + p.he + " ל-15 דקות לפני השקיעה"]);
      return err("חסרה שעה ל" + p.he, [p.he + " " + (p.ap === "am" ? "7:05" : "6:30"), p.he + " 15 דקות לפני השקיעה", p.he + " 6:30 כל יום חול עד פסח"]);
    }
    if (toTime && x.offset !== null) return err("יש במשפט גם שעה וגם זמן לפי השקיעה. בחרו אחד", [p.he + " " + T.short12(toTime.min), p.he + " " + T.offsetHe(x.offset).replace(" דק׳ ", " דקות ")]);

    /* build the rule */
    var target2 = null, base = null;
    if (act === "update") {
      target2 = pick(matchDocs(atTime, null), "שנה");
      if (target2.type === "error") return target2;
      base = target2.rule || null;
    }
    var rule = base ? JSON.parse(JSON.stringify(base)) : null;
    function ensure() { if (!rule) rule = { kind: "fixed", offsetMin: 0, days: "all" }; }
    if (keepTime) { var tm0 = T.min12(target2.time); toTime = { min: tm0 >= 0 ? tm0 : target2.order, explicit: true }; }
    if (x.offset !== null) { ensure(); rule.kind = "sunset"; rule.offsetMin = x.offset; }
    else if (rule && !(keepTime && rule.kind === "sunset")) { rule.kind = "fixed"; rule.offsetMin = 0; }
    if (x.days) { ensure(); rule.days = x.days; }
    var untilWhy = null;
    if (x.oneOff) { ensure(); rule.days = "all"; rule.from = x.oneOff.iso; rule.until = x.oneOff.iso; }
    if (x.from) { ensure(); rule.from = x.from.iso; }
    if (x.until) {
      ensure();
      var u = x.until.iso;
      if (x.until.named) { u = T.addDays(u, -1); x.until.why = "יום לפני " + x.until.he; x.until.iso = u; }
      rule.until = u;
    }
    if (rule && rule.from && rule.from <= ctx.today && !x.from) { /* keep a past from of the old rule as is */ }
    if (rule && rule.until && rule.until < ctx.today) return err("התאריך " + T.dateHe(rule.until) + " כבר עבר", [p.he + " " + (toTime ? T.short12(toTime.min) : "6:30") + " עד פסח"]);
    if (rule && rule.from && rule.until && rule.until < rule.from) return err("תאריך הסיום לפני תאריך ההתחלה", []);
    if (rule) {
      var fd = T.firstDay(rule, ctx.today, 400, ctx.isYomTov);
      if (!fd) return err("אין אף יום שמתאים לימים ולתאריכים שכתבתם", [p.he + " 6:30 כל יום חול עד פסח"]);
    }
    /* a plain time on every day stays a plain doc, exactly as before */
    if (rule && rule.kind === "fixed" && rule.days === "all" && !rule.from && !rule.until) rule = null;

    /* today's (or the first day's) time, for the time and order fields */
    var firstIso = rule ? T.firstDay(rule, ctx.today, 400, ctx.isYomTov) : ctx.today, min;
    if (rule && rule.kind === "sunset") {
      min = T.sunsetRuleMin(ctx.zman, firstIso, rule.offsetMin);
      if (min < 0) return err("אין עדיין נתוני שקיעה לתאריך " + T.dateHe(firstIso) + ", לכן המסך לא יוכל להציג זמן לפי השקיעה", []);
    } else min = toTime.min;
    var item = { nameHe: p.he, nameEn: (target2 && target2.nameEn) || p.en, time: T.fmt12(min), order: min, rule: rule };

    /* rows */
    var rows = [];
    rows.push({ k: "פעולה", v: act === "update" ? "שינוי זמן תפילה" : "הוספת זמן תפילה" });
    rows.push({ k: "תפילה", v: p.he });
    if (act === "update") rows.push({ k: "היה", v: docLabel(target2) + (target2.rule ? " | " + T.describeRule(target2.rule, target2.time) : "") });
    rows.push({ k: "שעה", v: rule && rule.kind === "sunset" ? T.offsetHe(rule.offsetMin) + " | מתעדכן כל יום (" + (firstIso === ctx.today ? "היום" : T.dateHe(firstIso, false)) + ": " + T.short12(min) + ")" : T.fmt12(min) });
    rows.push({ k: "ימים", v: describeDays(rule, x.oneOff && x.oneOff.he) + (x.daysHe && x.daysHe !== T.DAY_HE[x.days] ? " (" + x.daysHe + ")" : "") });
    if (!x.oneOff && rule && (rule.from || rule.until)) rows.push({ k: "תאריכים", v: rangeHe(x.from || (rule.from ? { iso: rule.from, he: T.dateHe(rule.from) } : null), rule.until ? (x.until || { iso: rule.until }) : null) });

    /* the smart checks */
    var warnings = [];
    if (/^מנחה/.test(p.he)) {
      var lastZ = ctx.lastZmanDay || T.addDays(ctx.today, 330);
      var from = rule && rule.from && rule.from > ctx.today ? rule.from : ctx.today;
      var until = rule && rule.until ? rule.until : T.addDays(from, 89);
      var openEnd = !(rule && rule.until);
      if (until > lastZ) until = lastZ;
      var chk = T.sunsetCheck(rule || { kind: "fixed", days: "all" }, min, from, until, ctx.zman, ctx.isYomTov);
      if (chk.after > 0) {
        var span = openEnd ? " ב-90 הימים הקרובים" : "";
        var w = { kind: "after-sunset", count: chk.after, total: chk.total,
          text: (rule && rule.kind === "sunset")
            ? "זמן " + p.he + " הזה הוא בשקיעה או אחריה"
            : (chk.after === chk.total
              ? T.short12(min) + " היא אחרי השקיעה בכל " + (openEnd ? "90 הימים הקרובים" : chk.total + " הימים") + (chk.minSunset ? " (השקיעה המוקדמת: " + T.short12(chk.minSunset.min) + ")" : "")
              : "ב-" + chk.after + " מתוך " + chk.total + " הימים" + span + ", " + T.short12(min) + " היא אחרי השקיעה (השקיעה המוקדמת: " + T.short12(chk.minSunset.min) + ", " + T.dateHe(chk.minSunset.iso, false) + ")") };
        var alt = JSON.parse(JSON.stringify(rule || { kind: "fixed", offsetMin: 0, days: "all" }));
        alt.kind = "sunset"; alt.offsetMin = -15;
        var altFirst = T.firstDay(alt, ctx.today, 400, ctx.isYomTov), altMin = altFirst ? T.sunsetRuleMin(ctx.zman, altFirst, -15) : -1;
        if (altMin >= 0) {
          w.alt = { label: "15 דק׳ לפני השקיעה, מתעדכן כל יום", item: { nameHe: p.he, nameEn: item.nameEn, time: T.fmt12(altMin), order: altMin, rule: alt } };
        }
        warnings.push(w);
      }
      if (chk.noData > 0 && !(rule && rule.kind === "sunset")) warnings.push({ kind: "no-data", text: chk.noData + " מהימים לא נבדקו מול השקיעה: הלוח של המערכת מגיע עד " + T.dateHe(lastZ) });
      if (!(rule && rule.kind === "sunset")) {
        var early = 0, n2 = T.diffDays(from, until);
        for (var dd = 0; dd <= n2; dd++) { var iso = T.addDays(from, dd); if (!T.ruleApplies(rule, iso, ctx.isYomTov)) continue; var z = ctx.zman && ctx.zman(iso); var mg = z && z.minchaGedola ? T.min24(z.minchaGedola) : -1; if (mg >= 0 && min < mg) early++; }
        if (early > 0) warnings.push({ kind: "before-gedola", text: "ב-" + early + " ימים " + T.short12(min) + " היא לפני מנחה גדולה" });
      }
    }
    if (rule && rule.kind === "sunset") {
      var lastZ2 = ctx.lastZmanDay;
      if (lastZ2 && (!rule.until || rule.until > lastZ2)) warnings.push({ kind: "past-data", text: "נתוני השקיעה של המערכת מגיעים עד " + T.dateHe(lastZ2) + ". אחרי התאריך הזה המסך לא יציג את הזמן הזה, עד שיתווסף הלוח של השנה הבאה" });
    }
    if (p.ap === "am" && min >= 12 * 60 && !(rule && rule.kind === "sunset")) warnings.push({ kind: "pm-for-am", text: p.he + " אחרי הצהריים? בדקו שהשעה נכונה (" + T.fmt12(min) + ")" });
    if (p.ap === "pm" && min < 12 * 60 && !(rule && rule.kind === "sunset")) warnings.push({ kind: "am-for-pm", text: p.he + " בבוקר? בדקו שהשעה נכונה (" + T.fmt12(min) + ")" });

    /* same name already there */
    var dup = null, others = [];
    if (act !== "update") {
      docs.forEach(function (d) {
        var same = T.min12(d.time) === min && JSON.stringify(d.rule || null) === JSON.stringify(rule || null);
        if (same) dup = d; else others.push(d);
      });
      if (dup) return err(p.he + " " + T.short12(min) + (rule ? " (" + T.describeRule(rule, item.time) + ")" : "") + " כבר ברשימה", ["מחק " + docLabel(dup), "שנה " + docLabel(dup) + " ל-" + T.short12(min + 15)]);
    }
    return { type: "plan", plan: { action: act === "update" ? "update" : "add", nameHe: p.he, item: item, target: target2, others: others, rows: rows, warnings: warnings } };
  }

  /* ---------- announcement and sponsor ---------- */
  function parseAnnouncement(t, ctx) {
    var m = t.match(/^(הכרזה חדשה|טיוטת הכרזה|פרסם הכרזה|פרסם הודעה|הכרזה|הודעה|טיוטה)\s*(?::|-)\s*(.*)$/) || t.match(/^(הכרזה חדשה|פרסם הכרזה|פרסם הודעה)\s+(.+)$/);
    if (!m) return null;
    var text = (m[2] || "").trim();
    if (text.length < 2) return err("מה לכתוב בהכרזה?", ["הכרזה: שיעור הרב אחרי ערבית"]);
    if (text.length > 2000) return err("ההכרזה ארוכה מדי (עד 2000 תווים)", []);
    var draft = /טיוט/.test(m[1]);
    var title = text, body = "";
    if (text.length > 90) { var cutAt = text.search(/[.|]\s/); if (cutAt > 5 && cutAt < 120) { title = text.slice(0, cutAt).trim(); body = text.slice(cutAt + 1).trim(); } else { title = text.slice(0, 90).replace(/\s+\S*$/, ""); body = text; } }
    var item = { type: "announcement", titleHe: title, bodyHe: body, startDate: ctx.today, endDate: T.addDays(ctx.today, 6), showOn: "all", status: draft ? "draft" : "published" };
    return { type: "plan", plan: { action: "announce", item: item, publish: !draft, rows: [
      { k: "פעולה", v: draft ? "הכרזה חדשה, טיוטה (לא על המסך)" : "הכרזה חדשה על המסך" }, { k: "כותרת", v: title }].concat(body ? [{ k: "טקסט", v: body }] : []).concat([
      { k: "מתי", v: "מ" + T.dateHe(item.startDate) + " עד " + T.dateHe(item.endDate) }]), warnings: [] } };
  }
  function parseSponsor(t, ctx) {
    var m = t.match(/^(?:חסות\s+)?(הקידוש|קידוש|סעודה שלישית|סעודה ג'|סעודה ג)(?:\s+(?:השבת|בשבת הקרובה|בשבת|לשבת|של שבת))?\s*(?:בחסות|נתרם על ידי|נתרם ע"י|ע"י|על ידי|לכבוד|:|-)\s*(.+)$/);
    if (!m) return null;
    var who = m[2].trim().replace(/^[:-]\s*/, "");
    if (who.length < 2) return err("בחסות מי?", ["קידוש בחסות משפחת כהן"]);
    var sub = /סעודה/.test(m[1]) ? "seudah3" : "kiddush", sh = T.comingShabbat(ctx.today), fri = T.addDays(sh, -1);
    var label = sub === "kiddush" ? "הקידוש" : "סעודה שלישית";
    var item = { type: "sponsor", subtype: sub, titleHe: label + " בחסות " + who, bodyHe: "", startDate: T.addDays(sh, -6) < ctx.today ? ctx.today : T.addDays(sh, -6), endDate: sh, showOn: "all", status: "published" };
    return { type: "plan", plan: { action: "sponsor", item: item, publish: true, rows: [
      { k: "פעולה", v: "חסות " + (sub === "kiddush" ? "קידוש" : "סעודה שלישית") + " על המסך" }, { k: "טקסט", v: item.titleHe },
      { k: "לשבת", v: T.dateHe(sh) }, { k: "מתי על המסך", v: "מ" + T.dateHe(item.startDate) + " עד מוצאי שבת" }], warnings: [] } };
  }

  /* ---------- navigation ---------- */
  function allowed(can, role) {
    role = role || {};
    if (can === "any") return true;
    if (can === "super") return !!role.isSuperAdmin;
    if (can === "finance") return !!(role.canFinance || role.isSuperAdmin);
    if (can === "screen") return !!(role.canScreen || role.isSuperAdmin);
    if (can === "congregant") return !!(role.isCongregant || role.isSuperAdmin);
    return false;
  }
  function parseNav(t, ctx) {
    var s = t.replace(/^(?:פתח|תפתח|פתחי|לך ל|לכי ל|עבור ל|עבור אל|קח אותי ל|תעביר אותי ל|הצג|תראה לי|תראי לי|הראה|אל|ל)\s*-?\s*/, "");
    var s2 = s.replace(/^(?:דף|עמוד|מסך) (?=\S)/, function (x) { return s === "מסך" ? x : ""; });
    for (var i = 0; i < NAV.length; i++) {
      var n = NAV[i];
      if (n.k.indexOf(s) >= 0 || n.k.indexOf(s2) >= 0 || n.k.indexOf(s.replace(/^ה/, "")) >= 0) {
        if (!allowed(n.can, ctx.role)) return err(n.he + " לא זמין בחשבון הזה", []);
        return { type: "nav", href: n.href, label: n.he };
      }
    }
    return null;
  }

  function parse(text, ctx) {
    ctx = ctx || {};
    if (!ctx.today) ctx.today = T.nyIso(new Date());
    var t = norm(text);
    if (!t) return err("כתבו מה לעשות", examples(ctx.role));
    if (/^(?:בטל|ביטול|תבטל|בטלי|undo|אנדו|בטל את זה|בטל את השינוי|בטל את השינוי האחרון|בטל את הפעולה האחרונה|בטל שינוי אחרון|תחזיר|החזר|החזר כמו שהיה)$/.test(t)) return { type: "undo" };
    if (/^(?:עזרה|\?|help|מה אפשר|מה אפשר לעשות|דוגמאות|דוגמה|איך משתמשים)$/i.test(t)) return { type: "help", suggestions: examples(ctx.role) };
    var a = parseAnnouncement(t, ctx); if (a) return needScreen(a, ctx);
    var sp = parseSponsor(t, ctx); if (sp) return needScreen(sp, ctx);
    var nv = parseNav(t, ctx); if (nv) return nv;
    var pr = parsePrayer(t, ctx); if (pr) return needScreen(pr, ctx);
    /* nothing matched: say what we saw, never guess */
    var timeOnly = /^(?:ב-?|ל-?)?\d{1,2}[:.]\d{2}(?:\s+\S+)?$/.test(t);
    if (timeOnly) return err("חסר שם התפילה", ["מנחה " + t, "שחרית " + t, "ערבית " + t]);
    if (/(שילם|חייב|יתרה|תרומה|תרומות|נדר)/.test(t)) return err("שאלות על כספים עוד לא בשורה הזאת. אפשר לפתוח את הכספים", allowed("finance", ctx.role) ? ["כספים", "נדרים"] : []);
    if (/(יארצייט|אזכרה|הזכרה|פלייר|חסות|הקדשה|מזל טוב)/.test(t)) return err("את זה עושים כרגע בעורך המסך", ["תוכן המסך", "קידוש בחסות משפחת כהן", "הכרזה: ..."]);
    if (/^(?:מחק|תמחק|הסר|שנה|עדכן|הוסף)(?:\s|$)/.test(t)) return err("איזה זמן תפילה?", ["מחק שחרית 7:05", "שנה מנחה ל-6:45", "הוסף ערבית 7:30"]);
    return err("לא הבנתי את \"" + t + "\". אפשר לנסות למשל:", examples(ctx.role));
  }
  function needScreen(r, ctx) {
    if (r.type === "plan" && ctx.role && !(ctx.role.canScreen || ctx.role.isSuperAdmin)) return err("רק גבאי תוכן יכולים לשנות את המסך", []);
    return r;
  }

  /* calendar-engine holiday finder for ctx.holiday, built once from cal.day() */
  function holidayFinder(cal, fromIso, days) {
    var idx = {};
    var iso = fromIso;
    for (var i = 0; i < (days || 400); i++) {
      var d; try { d = cal.day(iso); } catch (e) { d = null; }
      if (!d) break;
      (d.holidays || []).forEach(function (h) { var k = h.key; if (/^Rosh Hashana$/.test(k) || /^Chanukah/.test(k)) k = k.replace(/ .*$/, ""); if (!idx[k]) idx[k] = iso; });
      if (d.chanukah && !idx["Chanukah"]) idx["Chanukah"] = iso;
      if (d.roshChodesh && d.roshChodesh.dayOf === 1) { var mh = norm(d.roshChodesh.monthHe || "").replace(/'/g, "").replace(/^חשוון$/, "חשון").replace(/^סיוון$/, "סיון"); var key = "rc:" + mh; if (!idx[key]) idx[key] = iso; }
      iso = T.addDays(iso, 1);
    }
    if (!idx["Rosh Hashana"] && idx["Erev Rosh Hashana"]) idx["Rosh Hashana"] = T.addDays(idx["Erev Rosh Hashana"], 1);
    return function (key, from) {
      var k = key; if (/^rc:/.test(k)) { k = k.replace("חשוון", "חשון").replace("סיוון", "סיון").replace(/^rc:אדר$/, "rc:אדר"); }
      var v = idx[k]; if (!v && k === "rc:אדר") v = idx["rc:אדר א"] || idx["rc:אדר ב"];
      if (!v || (from && v < from)) return null;
      return { iso: v };
    };
  }

  var api = { parse: parse, norm: norm, PRAYERS: PRAYERS, examples: examples, parseDateRef: parseDateRef, holidayFinder: holidayFinder, _resolveHour: resolveHour };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.OH_COMMAND = api;
})(typeof window !== "undefined" ? window : this);
