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
    { k: ["כספים", "הכספים", "פיננסים", "הנהלת חשבונות", "חשבונות", "מתפללים", "רשימת מתפללים", "finance", "finances", "money"], href: "finance/", he: "כספים", can: "finance" },
    { k: ["נדרים", "הנדרים"], href: "finance/#nedarim", he: "נדרים", can: "finance" },
    { k: ["דוחות", "דוח"], href: "finance/#reports", he: "דוחות", can: "finance" },
    { k: ["יומן", "יומן פעולות", "פעולות אחרונות"], href: "gabbai/activity/", he: "יומן פעולות", can: "super" },
    { k: ["גיבוי", "גיבויים", "הגיבוי", "backup", "backups"], href: "backup/", he: "גיבוי", can: "super" },
    { k: ["שחזור", "שחזר"], href: "restore/", he: "שחזור", can: "super" },
    { k: ["הרשאות", "משתמשים", "ניהול משתמשים", "גבאים"], href: "admin/#userMgmtSection", he: "הרשאות", can: "super" },
    { k: ["זמני תפילה", "זמני התפילה", "זמנים", "prayer times", "zmanim"], href: "gabbai/tv/#ptSection", he: "זמני תפילה", can: "screen" },
    /* 2040 phase 1 fix (2026-11-05, Hanoch: TV management separate from the landing page, and
       TV content on its own simple screen, separate from the TV headings): the old single
       "admin/#screenContent" page split into gabbai/tv/ (times + headings) and
       gabbai/tv/content/ (the content itself). "חסויות" stays as a recognized word so an old
       habit still finds the content screen, where the free-text item itself now carries the
       occasion instead of a fixed list. */
    { k: ["ניהול המסך", "הגדרות מסך", "כותרות המסך", "זמנים וכותרות"], href: "gabbai/tv/", he: "ניהול המסך", can: "screen" },
    { k: ["עורך המסך", "תוכן", "תוכן המסך", "הכרזות", "עריכת המסך", "חסויות", "תרומות", "יארצייטים"], href: "gabbai/tv/content/", he: "תוכן המסך", can: "screen" },
    { k: ["המסך", "מסך", "טלוויזיה", "הטלוויזיה", "tv", "המסך בבית הכנסת", "screen"], href: "tv/", he: "המסך", can: "any" },
    { k: ["חבילת שבת", "עלון שבת", "עלון", "חבילת השבת", "עלון השבת", "שבת"], href: "gabbai/shabbat/", he: "חבילת שבת", can: "screen" },
    { k: ["דף הבית", "בית", "ראשי", "home"], href: "gabbai/", he: "דף הבית", can: "any" },
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
  var B = "(?:^|\\s)", E = "(?=\\s|$)";
  function cut(str, m) { return (str.slice(0, m.index) + " " + str.slice(m.index + m[0].length)).replace(/\s+/g, " ").trim(); }

  var FILLERS = ["את", "זמן", "זמני", "תפילת", "תפילה", "של", "להיות", "יהיה", "תהיה", "בשעה", "ב", "ל", "-", ":", "גם", "וגם", "מעכשיו", "בבקשה", "מניין", "המניין", "הזמן", "ה", "עכשיו", "על", "המסך", "למסך", "קבוע", "קבועה", "ו", "שוב", "בקביעות", "החל", "עד", "מ",
    /* cmdbar v2 (Nov 4): everyday words that change nothing */
    "רק", "אני", "רוצה", "רוצים", "צריך", "צריכה", "צריכים", "ש", "שיהיה", "שתהיה", "שיהיו", "יהיו", "תודה", "אפשר", "תוכל", "תוכלי", "נא", "אנא", "יאללה", "תשים", "שים", "שימי", "תשימי", "לשים", "תעשה", "תעשי", "לעשות", "הזה", "הזאת", "הזו", "זה", "זאת", "הקיים", "הקיימת", "הישן", "הישנה", "שלנו", "אצלנו", "במסך", "מהמסך", "ברשימה", "מהרשימה", "מהלוח", "בלוח", "הלוח", "שעה", "השעה", "לשעה", "משעה", "זמנים", "הזמנים", "התפילה", "מנין", "המנין", "במניין", "במנין", "מהיום", "מעתה", "והלאה", "ואילך", "הלאה", "באופן", "תמיד", "עוד", "כמו", "בערך", "בסביבות", "בדיוק", "בבית", "הכנסת", "כנסת", "ביהכ\"נ", "ביכנ\"ס", "בביהכ\"נ", "אותו", "אותה", "שורה", "השורה", "כבר", "פעם", "לי", "לנו", "בשביל", "עבור", "כל", "הכל", "במקום", "please", "ok", "pls"];
  NUMWORDS["דקה"] = 1; NUMWORDS["רבע"] = 15; NUMWORDS["שעה וחצי"] = 90; NUMWORDS["שתי דקות"] = 2; NUMWORDS["שלוש"] = 3; NUMWORDS["שלושה"] = 3; NUMWORDS["שבע"] = 7; NUMWORDS["שמונה"] = 8; NUMWORDS["עשרים וחמישה"] = 25; NUMWORDS["שלושים וחמש"] = 35; NUMWORDS["חמישים"] = 50; NUMWORDS["שעתיים"] = 120;

  function err(message, suggestions) { return { type: "error", message: message, suggestions: suggestions || [] }; }
  function examples(role) {
    var ex = [];
    if (!role || role.canScreen) ex.push("מנחה 6:30 כל יום חול עד פסח", "ערבית 15 דקות אחרי השקיעה", "מחק שחרית 7:05", "שחרית ביום ראשון 8:00", "ערבית 8 רק בימי חול", "תקדים שחרית ב-5 דקות", "מה הזמנים", "הכרזה: שיעור הרב אחרי ערבית");
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

  /* ---------- everyday language (cmdbar v2, Nov 4 2026) ----------
     Still fully deterministic: fixed word lists and patterns only. canon()
     rewrites everyday Hebrew and English into the plain sentence shapes the
     parser below already knows; anything it does not recognise is left as is,
     so the parser still answers "לא הבנתי" with suggestions, never a guess. */
  var FINALS = { "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" }, TO_FINAL = { "כ": "ך", "מ": "ם", "נ": "ן", "פ": "ף", "צ": "ץ" };
  function fixFinals(w) {
    if (w.length < 2 || /["']/.test(w) || !/^[\u05d0-\u05ea]+$/.test(w)) return w;
    var mid = w.slice(0, -1).replace(/[ךםןףץ]/g, function (c) { return FINALS[c]; }), last = w.slice(-1);
    return mid + (TO_FINAL[last] || last);
  }
  function rx(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function alt(list) { return list.slice().sort(function (a, b) { return b.length - a.length; }).map(rx).join("|"); }
  /* English -> Hebrew, longest phrase first; applied only when the sentence has Latin letters */
  var EN = [
    /* prayers */
    [["shacharit vatikin", "vatikin", "vasikin", "netz minyan", "neitz minyan", "sunrise minyan"], "שחרית ותיקין"],
    [["mincha gedola", "mincha gedolah", "minha gedola"], "מנחה גדולה"],
    [["kabbalat shabbat", "kabalat shabbat", "kabbolas shabbos", "kabbalas shabbos", "kabbalat shabbos"], "קבלת שבת"],
    [["shacharit", "shacharis", "shachris", "shaharit", "shachrit", "shacharith", "morning prayer", "morning prayers", "morning minyan", "morning service"], "שחרית"],
    [["mincha", "minha", "minchah", "afternoon prayer", "afternoon minyan", "afternoon service"], "מנחה"],
    [["maariv", "ma'ariv", "maarive", "arvit", "arvis", "arbit", "evening prayer", "evening minyan", "evening service", "night minyan"], "ערבית"],
    [["musaf", "mussaf"], "מוסף"], [["selichot", "slichot", "selichos", "slichos"], "סליחות"], [["daf yomi"], "דף יומי"], [["shiur", "class", "lecture"], "שיעור"],
    /* verbs */
    [["get rid of", "take off", "take out", "delete", "remove", "cancel", "drop", "erase", "scrap"], " מחק "],
    [["bring forward", "move up", "make earlier", "earlier"], " מוקדם יותר "],
    [["push back", "make later", "later"], " מאוחר יותר "],
    [["reschedule", "change", "update", "move", "switch", "edit", "modify", "shift", "set", "make"], " שנה "],
    [["add", "create", "new", "insert", "schedule", "put"], " הוסף "],
    /* days */
    [["every day except shabbat", "every day except saturday", "sunday to friday", "sunday through friday", "sun-fri", "sun to fri"], " ראשון עד שישי "],
    [["every weekday", "on weekdays", "weekdays", "weekday", "sunday to thursday", "sunday through thursday", "sun-thu", "sun to thu", "mid-week", "midweek"], " בימי חול "],
    [["all week", "the whole week", "whole week", "every day of the week"], " כל השבוע "],
    [["every day", "each day", "daily", "all days"], " כל יום "],
    [["this shabbat", "this shabbos", "this saturday", "this coming shabbat", "this week's shabbat"], " בשבת הקרובה "],
    [["this friday", "this coming friday"], " ביום שישי הקרוב "],
    [["motzei shabbat", "motzei shabbos", "motzash", "saturday night", "saturday nights"], " במוצאי שבת "],
    [["friday night", "erev shabbat", "erev shabbos", "every friday", "on fridays", "fridays", "on friday", "friday"], " בשישי "],
    [["every shabbat", "every shabbos", "every saturday", "on shabbat", "on shabbos", "on saturday", "on saturdays", "saturdays", "shabbat", "shabbos", "saturday", "sabbath"], " בשבת "],
    [["tonight", "this evening"], " היום בערב "], [["today"], " היום "], [["day after tomorrow"], " מחרתיים "], [["tomorrow"], " מחר "],
    /* sunset and other zmanim */
    [["shkiah", "shkia", "shekiah", "shkiya", "shkiyah", "sunset", "sundown"], " השקיעה "],
    [["tzeit hakochavim", "tzet hakochavim", "tzeis hakochavim", "nightfall", "tzeit", "tzais", "tzet"], " צאת הכוכבים "],
    [["hanetz", "neitz", "netz", "sunrise"], " הנץ "],
    [["quarter of an hour", "quarter hour", "a quarter hour"], " רבע שעה "], [["half an hour", "half hour", "a half hour"], " חצי שעה "], [["an hour", "one hour"], " שעה "],
    [["minutes", "minute", "mins", "min"], " דקות "], [["before"], " לפני "], [["after"], " אחרי "],
    /* parts of the day */
    [["in the morning", "morning", "a.m.", "a.m", "am"], " בבוקר "], [["in the afternoon", "afternoon"], " אחה\"צ "], [["in the evening", "evening", "p.m.", "p.m", "pm"], " בערב "], [["at night"], " בלילה "],
    /* dates */
    [["until", "till", "untill", "through", "thru", "up to", "up until"], " עד "], [["starting from", "starting", "beginning", "as of", "effective"], " החל מ "],
    [["passover", "pesach"], " פסח "], [["chanukah", "hanukkah", "hanukah", "chanuka", "hanuka"], " חנוכה "], [["purim"], " פורים "],
    [["rosh hashanah", "rosh hashana"], " ראש השנה "], [["yom kippur"], " יום כיפור "], [["sukkot", "succos", "sukkos", "succot"], " סוכות "], [["shavuot", "shavuos"], " שבועות "],
    [["simchat torah", "simchas torah"], " שמחת תורה "], [["lag baomer", "lag b'omer"], " ל\"ג בעומר "], [["tisha b'av", "tisha bav", "tishah b'av"], " תשעה באב "],
    [["daylight saving time", "daylight saving", "daylight savings", "summer time", "dst"], " שעון קיץ "], [["winter time", "standard time"], " שעון חורף "],
    /* words that carry nothing */
    [["only", "just"], " רק "], [["instead of"], " במקום "],
    [["please", "can you", "could you", "i want", "i'd like", "we need", "i need", "the", "a", "an", "of", "on", "for", "time", "times", "minyan", "prayer", "service", "it", "and", "every", "each", "next", "this", "coming", "o'clock", "oclock", "should be", "be", "is", "will"], " "]
  ];
  var EN_MONTHS = { "january": "ינואר", "jan": "ינואר", "february": "פברואר", "feb": "פברואר", "march": "מרץ", "mar": "מרץ", "april": "אפריל", "apr": "אפריל", "may": "מאי", "june": "יוני", "jun": "יוני", "july": "יולי", "jul": "יולי", "august": "אוגוסט", "aug": "אוגוסט", "september": "ספטמבר", "sep": "ספטמבר", "sept": "ספטמבר", "october": "אוקטובר", "oct": "אוקטובר", "november": "נובמבר", "nov": "נובמבר", "december": "דצמבר", "dec": "דצמבר" };
  var EN_WD = { "sunday": "ראשון", "monday": "שני", "tuesday": "שלישי", "wednesday": "רביעי", "thursday": "חמישי" };
  var EN_RE = EN.map(function (e) { return { re: new RegExp("(^|[^a-z'])(?:" + alt(e[0]) + ")(?=$|[^a-z'])", "g"), to: e[1] }; });
  function english(t) {
    var s = " " + t.toLowerCase() + " ";
    s = s.replace(/(\d)\s*(a\.?m\.?|p\.?m\.?)(?=$|[^a-z])/g, "$1 $2");
    s = s.replace(/(^|[^a-z])noon(?=$|[^a-z])/g, "$1 12:00 בצהריים ");
    s = s.replace(/half past (\d{1,2})(?=$|\D)/g, "$1:30").replace(/quarter past (\d{1,2})(?=$|\D)/g, "$1:15").replace(/quarter to (\d{1,2})(?=$|\D)/g, function (x, h) { return ((+h + 11) % 12 || 12) + ":45"; });
    s = s.replace(/(^|[^a-z])(?:from )?(?:sunday|sun) ?(?:to|through|thru|till|until|-) ?(?:thursday|thu|thurs)(?=$|[^a-z])/g, "$1 בימי חול ").replace(/(^|[^a-z])(?:from )?(?:sunday|sun) ?(?:to|through|thru|till|until|-) ?(?:friday|fri)(?=$|[^a-z])/g, "$1 ראשון עד שישי ");
    /* weekday names: "next/this/on tuesday" -> a one-time change on the coming one; "every tuesday" -> asked below */
    s = s.replace(/(^|[^a-z])(?:every|each) (sunday|monday|tuesday|wednesday|thursday)s?(?=$|[^a-z])/g, function (x, p, d) { return p + " כל יום " + EN_WD[d] + " "; });
    s = s.replace(/(^|[^a-z])next (sunday|monday|tuesday|wednesday|thursday)(?=$|[^a-z])/g, function (x, p, d) { return p + " ביום " + EN_WD[d] + " הבא "; });
    s = s.replace(/(^|[^a-z])(?:on |this )?(sunday|monday|tuesday|wednesday|thursday)(?=$|[^a-z])/g, function (x, p, d) { return p + " ביום " + EN_WD[d] + " "; });
    s = s.replace(/(^|[^a-z])next (?:shabbat|shabbos|saturday)(?=$|[^a-z])/g, "$1 שבת הבאה ");
    /* month names, both orders */
    var MON = alt(Object.keys(EN_MONTHS));
    s = s.replace(new RegExp("(^|[^a-z])(" + MON + ")\\.? (\\d{1,2})(?:st|nd|rd|th)?(?:,? (\\d{4}))?(?=$|[^a-z0-9])", "g"), function (x, p, mo, d, y) { return p + " " + d + " ב" + EN_MONTHS[mo] + (y ? " " + y : "") + " "; });
    s = s.replace(new RegExp("(^|[^a-z0-9])(\\d{1,2})(?:st|nd|rd|th)?(?: of)? (" + MON + ")(?:,? (\\d{4}))?(?=$|[^a-z])", "g"), function (x, p, d, mo, y) { return p + " " + d + " ב" + EN_MONTHS[mo] + (y ? " " + y : "") + " "; });
    /* "from 8 to 8:15", "at 8", "to weekdays" */
    s = s.replace(/(^|[^a-z])from (?=\d)/g, "$1 מ-").replace(/(^|[^a-z])(?:to|till|until) (?=\d{1,2}(?::\d{2})?(?:\s|$))/g, "$1 ל-").replace(/(^|[^a-z])at (?=\d)/g, "$1 ב-");
    s = s.replace(/(^|[^a-z])(?:at|to|from|in|by)(?=$|[^a-z])/g, "$1 ");
    for (var i = 0; i < EN_RE.length; i++) s = s.replace(EN_RE[i].re, function (x, p) { return p + EN_RE[i].to; });
    return s.replace(/\s+/g, " ").trim();
  }
  /* verbs, anywhere in the sentence, any common form */
  var ACTS = [
    ["add", ["הוסף", "תוסיף", "תוסיפי", "תוסיפו", "הוסיפי", "הוסיפו", "להוסיף", "הוספה", "הוספת", "תכניס", "הכנס", "תכניסי", "להכניס", "חדש", "חדשה", "קבע", "תקבע", "קבעי", "תקבעי", "לקבוע"]],
    ["update", ["שנה", "תשנה", "שני", "תשני", "תשנו", "לשנות", "שינוי", "עדכן", "תעדכן", "עדכני", "תעדכני", "לעדכן", "עדכון", "החלף", "תחליף", "תחליפי", "להחליף", "הזז", "תזיז", "הזיזי", "תזיזי", "להזיז", "תזוז", "העבר", "תעביר", "תעבירי", "העבירי", "להעביר", "תקן", "תתקן", "תתקני", "לתקן", "תסדר", "סדר", "לסדר"]],
    ["delete", ["מחק", "תמחק", "מחקי", "תמחקי", "תמחקו", "למחוק", "מחיקה", "מחיקת", "הסר", "תסיר", "הסירי", "תסירי", "להסיר", "הסרה", "הורד", "תוריד", "הורידי", "תורידי", "להוריד", "בטל", "תבטל", "בטלי", "תבטלי", "לבטל", "ביטול", "תעיף", "תעיפי", "להעיף", "תוציא", "הוצא", "תוציאי", "להוציא"]],
    ["earlier", ["תקדים", "תקדימי", "תקדימו", "הקדם", "הקדימי", "להקדים", "הקדמה", "מוקדם", "מוקדמת"]],
    ["later", ["תאחר", "תאחרי", "תאחרו", "תדחה", "תדחי", "דחה", "לדחות", "מאוחר", "מאוחרת"]]
  ];
  var ACT_OF = {};
  ACTS.forEach(function (a) { a[1].forEach(function (w) { ACT_OF[w] = a[0]; }); });
  /* prayer-name typos: distance 1 from these, only when no name was found as written */
  var TYPO_TARGETS = ["שחרית", "מנחה", "ערבית", "מעריב", "ותיקין", "סליחות"];
  var TYPO_KEEP = ["מנחם", "מנחת", "ערבי", "ערבה", "ערבות", "שחרור", "מוסיף", "מוסיפה", "ערבים", "מנחות"];
  /* edit distance with swapped neighbours counted as one (short words only) */
  function dist1(a, b) {
    if (Math.abs(a.length - b.length) > 1) return 2;
    var d = [], i, j;
    for (i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (j = 0; j <= b.length; j++) d[0][j] = j;
    for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
    return d[a.length][b.length];
  }
  function fixTypos(s) {
    if (findPrayer(s)) return s;
    return s.split(" ").map(function (w) {
      if (w.length < 4 || TYPO_KEEP.indexOf(w) >= 0 || ACT_OF[w] || !/^[\u05d0-\u05ea]+$/.test(w)) return w;
      for (var k = 0; k < TYPO_TARGETS.length; k++) if (dist1(w, TYPO_TARGETS[k]) === 1) return TYPO_TARGETS[k];
      var m = w.match(/^([והלבש]{1,2})(\S{4,})$/); if (!m) return w;
      var pre = m[1], body = m[2];
      if (TYPO_KEEP.indexOf(body) >= 0 || ACT_OF[body]) return w;
      for (var i = 0; i < TYPO_TARGETS.length; i++) if (dist1(body, TYPO_TARGETS[i]) === 1) return pre + TYPO_TARGETS[i];
      return w;
    }).join(" ");
  }
  /* the cleaned sentence: quotes, punctuation, emoji, "ב - 7", final letters, English, typos */
  function canon(t) {
    var s = norm(t).replace(/''/g, "\"").replace(/(\d)\.(\d)/g, "$1\u0001$2").replace(/[,;!?()[\]{}…]|\./g, " ").replace(/\u0001/g, ".");
    s = s.replace(/[\u2600-\u27BF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDC00-\uDFFF]|\uFE0F/g, " ");
    if (/[a-z]/i.test(s)) s = english(s);
    s = s.replace(/(^|\s)([בלמה])\s*-\s+(?=\S)/g, "$1$2-").replace(/(^|\s)([בלהמוש])-(?=[\u05d0-\u05ea])/g, "$1$2");
    s = s.replace(/(^|\s)(ב|ל|מ)\s+(?=\d)/g, "$1$2-");
    s = s.split(" ").map(fixFinals).join(" ").replace(/\s+/g, " ").trim();
    return fixTypos(s);
  }

  /* ---------- the prayer sentence ---------- */
  function findPrayer(s) {
    for (var i = 0; i < ALIASES.length; i++) {
      var a = ALIASES[i].a, re = new RegExp(B + "(?:[וש]?[הלב]?)" + a.replace(/[.*+?^${}()|[\]\\"]/g, "\\$&") + E, "i");
      var m = s.match(re);
      if (m) return { p: ALIASES[i].p, m: m };
    }
    return null;
  }
  function samePrayer(doc, p) { var n = norm(doc.nameHe || ""); return n === p.he || p.a.indexOf(n) >= 0 || norm(doc.nameEn || "").toLowerCase() === p.en.toLowerCase() || (p.en === "Arvit" && /^ma'?ariv$/i.test(norm(doc.nameEn || ""))); }

  var NUMRE = "\\d{1,3}|" + Object.keys(NUMWORDS).sort(function (a, b) { return b.length - a.length; }).join("|");
  function numOf(w) { return /^\d+$/.test(w) ? +w : NUMWORDS[w]; }
  /* Hebrew number words for clock hours and minutes */
  var HOURW = { "אחת": 1, "אחד": 1, "שתיים": 2, "שתים": 2, "שניים": 2, "שלוש": 3, "ארבע": 4, "חמש": 5, "שש": 6, "שבע": 7, "שמונה": 8, "תשע": 9, "עשר": 10, "אחת עשרה": 11, "אחד עשרה": 11, "אחד עשר": 11, "אחת עשר": 11, "שתים עשרה": 12, "שתיים עשרה": 12, "שנים עשר": 12, "שתים עשר": 12 };
  var MINW = { "חצי": 30, "רבע": 15, "עשרה": 10, "עשר": 10, "חמש": 5, "חמישה": 5, "עשרים": 20, "עשרים וחמש": 25, "עשרים וחמישה": 25, "שלושים": 30, "שלושים וחמש": 35, "ארבעים": 40, "ארבעים וחמש": 45, "ארבעים וחמישה": 45, "חמישים": 50, "חמישים וחמש": 55, "חמש עשרה": 15, "רבע שעה": 15, "עשרים דקות": 20, "עשר דקות": 10, "חמש דקות": 5 };
  var HOURRE = "(?:" + alt(Object.keys(HOURW)) + "|\\d{1,2})", MINRE = alt(Object.keys(MINW));
  var ORD = { "הראשון": 1, "הראשונה": 1, "השני": 2, "השנייה": 2, "השניה": 2, "השלישי": 3, "השלישית": 3, "האחרון": -1, "האחרונה": -1, "המוקדם": 1, "המוקדמת": 1, "המאוחר": -1, "המאוחרת": -1, "הכי מוקדם": 1, "הכי מאוחר": -1 };
  var MULTI_FILLERS = ["תעשה לי טובה", "תעשי לי טובה", "תעשה טובה", "תעשי טובה", "אני רוצה ש", "אני רוצה", "אני צריך", "אני צריכה", "אנחנו רוצים", "בבית הכנסת", "בבית כנסת", "על המסך", "מהיום והלאה", "מעכשיו והלאה", "מעכשיו ואילך", "מהיום ואילך", "בכל פעם", "בבקשה", "תעשה ש", "תדאג ש", "תדאגי ש", "אם אפשר", "של ה", "את ה", "תודה רבה", "בתור", "יהיה כתוב", "כתוב", "שוב פעם", "עוד פעם", "עכשיו"];

  function extract(rest, p, ctx, o0) {
    var o = { times: [], offset: null, days: null, daysHe: null, oneOff: null, from: null, until: null, notes: [], shift: null, ord: null, ap: null, askNext: null }, m, re;
    rest = " " + rest + " ";
    rest = rest.replace(/ (?:ל|ב|עם |בזמן )?(?:ה)?(?:שקיעת החמה|שקיעה החמה|שקיעת חמה|שקיה|שקיעא|שקעה|שקיעות)(?= )/g, function (x) { return " " + (/^ (?:ל|ב|עם |בזמן )/.test(x) ? x.trim().replace(/(?:ה)?(?:שקיעת החמה|שקיעה החמה|שקיעת חמה|שקיה|שקיעא|שקעה|שקיעות)$/, "השקיעה") : "השקיעה"); })
      .replace(/ (?:לאחר|אחר) (?=ה?שקיעה)/g, " אחרי ").replace(/ בדיוק (?=ב|עם )/g, " ").trim();
    /* sunset relative: "15 דקות לפני השקיעה", "לפני השקיעה ב-15 דקות", "רבע שעה אחרי השקיעה" */
    re = new RegExp(B + "(?:ב-?|ל-?)?(" + NUMRE + ")\\s*(?:דקות|דק'|דק|דקה)?\\s*(לפני|אחרי|אחר)\\s+(?:ה)?שקיעה(?:\\s+החמה)?" + E);
    var re2 = new RegExp(B + "(לפני|אחרי)\\s+(?:ה)?שקיעה\\s+(?:ב-?)?(" + NUMRE + ")\\s*(?:דקות|דק'|דק|דקה)?" + E);
    if ((m = rest.match(re))) {
      var n = numOf(m[1]);
      if (n > 180) return { error: "הפרש גדול מדי מהשקיעה (" + n + " דקות)" };
      o.offset = m[2] === "לפני" ? -n : n; rest = cut(rest, m);
    } else if ((m = rest.match(re2))) {
      var n2 = numOf(m[2]);
      if (n2 > 180) return { error: "הפרש גדול מדי מהשקיעה (" + n2 + " דקות)" };
      o.offset = m[1] === "לפני" ? -n2 : n2; rest = cut(rest, m);
    } else if ((m = rest.match(new RegExp(B + "(?:ל-?)?(?:ב|עם |בזמן |ל)?(?:ה)?שקיעה" + E)))) { o.offset = 0; rest = cut(rest, m); }
    else if ((m = rest.match(new RegExp(B + "(?:(?:\\d+|" + alt(Object.keys(NUMWORDS)) + ")\\s*)?(?:דקות|דק')?\\s*(?:לפני|אחרי|לאחר|עם|ב|בזמן|ל)?\\s*(?:צאת הכוכבים|בצאת הכוכבים|צאת|בצאת|צה\"כ|צאה\"כ|בצה\"כ|הנץ|בהנץ|בנץ|נץ החמה|נץ|זריחה|הזריחה|בזריחה|פלג המנחה|פלג|חצות|בחצות|עלות השחר|עלות)" + E)))) {
      var isNetz = /נץ|זריחה|עלות/.test(m[0]);
      return { error: "המסך יודע לעקוב רק אחרי השקיעה. כתבו שעה קבועה, או זמן לפי השקיעה", suggestions: isNetz ? [p.he + " " + (p.ap === "pm" ? "6:30" : "6:45")] : [p.he + " 15 דקות אחרי השקיעה", p.he + " " + (p.ap === "am" ? "7:00" : "6:30")] };
    }
    /* earlier / later by some minutes */
    if (o0 && o0.shift) {
      re = new RegExp(B + "(?:ב-?)?(" + NUMRE + ")\\s*(?:דקות|דק'|דק|דקה)" + E);
      var re3 = new RegExp(B + "(?:ב-?)?(רבע שעה|חצי שעה|שעה|רבע|חצי)" + E), re4 = new RegExp(B + "ב-?(\\d{1,2})" + E);
      if ((m = rest.match(re)) || (m = rest.match(re3)) || (m = rest.match(re4))) {
        var sn = m[1] === "רבע" ? 15 : m[1] === "חצי" ? 30 : numOf(m[1]);
        if (!sn || sn > 180) return { error: "בכמה דקות?", suggestions: [] };
        o.shift = o0.shift === "earlier" ? -sn : sn; rest = cut(rest, m);
      } else o.shift = 0;
    }
    /* date range: from X until Y, until Y, from X */
    var DATE = "((?:\\d{1,2}[./]\\d{1,2}(?:[./]\\d{2,4})?)|(?:\\d{1,2} ?(?:ב|ל)?(?:ינואר|פברואר|מרץ|מרס|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)(?: \\d{4})?)|(?:ראש חודש|ר\"ח) [\\u05d0-\\u05ea']+(?: [אב]'?)?|היום|מחר|סוף החודש|השבת|שבת הקרובה|" +
      HOLIDAYS.map(function (h) { return "(?:חג )?" + h[0]; }).join("|") + ")";
    var reFromUntil = new RegExp(B + "(?:החל )?(?:מ-?|מה-?|מתאריך |מיום |החל מ-?)" + DATE + "\\s+(?:ו?עד(?: ל-?| ה-?| ל| ה)?)\\s*" + DATE + E);
    var reUntil = new RegExp(B + "(?:ו?עד|ועד|עד ל|עד ה|עד ל-|עד ה-|עד ליום|עד יום|עד תאריך|עד אחרי|עד סוף)\\s*-?\\s*" + DATE + E);
    var reFrom = new RegExp(B + "(?:החל מ-?|החל מה-?|מ-|מה-|מתאריך |מיום |מ|מה|החל מ )" + DATE + E);
    if ((m = rest.match(reFromUntil))) {
      var f1 = parseDateRef(m[1], ctx), u1 = parseDateRef(m[2], ctx);
      if (f1.error) return { error: f1.error }; if (u1.error) return { error: u1.error };
      o.from = f1; o.until = u1; rest = cut(rest, m);
    } else {
      if ((m = rest.match(reUntil))) { var u2 = parseDateRef(m[1], ctx); if (u2.error) return { error: u2.error }; o.until = u2; rest = cut(rest, m); }
      if ((m = rest.match(reFrom))) { var f2 = parseDateRef(m[1], ctx); if (f2.error) return { error: f2.error }; o.from = f2; rest = cut(rest, m); }
    }
    /* days */
    var LP = "(?:ב|ל)?";
    var DAYP = [
      [new RegExp(B + "(?:כל יום חוץ משבת|חוץ משבת|ראשון עד שישי|מראשון עד שישי|ראשון-שישי|א' ?- ?ו'|א-ו|א עד ו|מא' עד ו'|מא עד ו|ימים א-ו|בימים א-ו)" + E), "weekday"],
      [new RegExp(B + "(?:כל יום חול|כל ימי החול|בכל ימי החול|לכל ימי החול|כל ימות החול|בכל ימות החול|" + LP + "ימי החול|" + LP + "ימי חול|" + LP + "ימות החול|" + LP + "יום חול|בימים רגילים|ביום רגיל|לימים רגילים|ימים רגילים|" + LP + "חול|באמצע השבוע|אמצע השבוע|לאמצע השבוע|באמצע שבוע|ראשון עד חמישי|מראשון עד חמישי|ראשון-חמישי|א' ?- ?ה'|א-ה|א עד ה|מא' עד ה'|מא עד ה|ימים א-ה|בימים א-ה|לימים א-ה|כל יום חוץ משישי ושבת|חוץ משישי ושבת|חוץ מסוף השבוע|weekdays)(?!\\s+המועד)" + E), "sun-thu"],
      [new RegExp(B + "(?:במוצאי שבת|מוצאי שבת|למוצאי שבת|במוצ\"ש|מוצ\"ש|למוצ\"ש|במוצש|מוצש|במוצאי שבתות)" + E), "shabbat", "מוצאי שבת"],
      [new RegExp(B + "(?:בשבת הקרובה|בשבת הזאת|בשבת הזו|בשבת הזה|השבת הקרובה|לשבת הקרובה|לשבת הזאת|לשבת הזו|השבת הזאת|השבת הזו|השבת|רק השבת|בשבת זו|שבת הזאת|שבת הזו|שבת הזה|שבת הקרובה|לשבת זו|שבת זו)" + E), "one-shabbat"],
      [new RegExp(B + "(?:בשבת הבאה|לשבת הבאה|שבת הבאה|השבת הבאה)" + E), "ask-next-shabbat"],
      [new RegExp(B + "(?:(?:ב|ל)?יום שישי (?:הקרוב|הזה|הבא)|(?:ב|ל)?שישי (?:הקרוב|הזה|הבא)|בערב שבת הקרוב|בערב שבת הזה|ערב שבת הקרוב|בערב שבת הזאת)" + E), "one-fri"],
      [new RegExp(B + "(?:כל יום שישי|כל שישי|בכל שישי|" + LP + "ימי שישי|בערב שבת|בערבי שבת|לערב שבת|ערב שבת|ערבי שבת|בליל שבת|ליל שבת|" + LP + "יום שישי|" + LP + "יום ו'|" + LP + "יום ו|בשישי|לשישי|שישי)" + E), "fri"],
      [new RegExp(B + "(?:כל שבת|בשבתות|לשבתות|בכל שבת|לכל שבת|" + LP + "יום שבת|" + LP + "יום ש'|בשבת קודש|שבת קודש|בשבת|לשבת|שבת)" + E), "shabbat"],
      /* v2: "כל השבוע" = three rows (חול, שישי, שבת), each in its own place on the admin page */
      [new RegExp(B + "(?:כל השבוע|בכל השבוע|לכל השבוע|כל ימות השבוע|כל ימי השבוע|all week|the whole week)" + E), "week3", "כל השבוע: חול, שישי ושבת"],
      [new RegExp(B + "(?:כל יום|בכל יום|לכל יום|כל הימים|בכל הימים|לכל הימים|יומי|יומיומי|יום יום|כל יום כולל שבת|כל יום כולל שישי ושבת|ז' ימים)" + E), "all"],
      [new RegExp(B + "(?:היום|להיום|הערב|הלילה|להערב)" + E), "one-today"],
      [new RegExp(B + "(?:מחרתיים|למחרתיים)" + E), "one-after-tomorrow"],
      [new RegExp(B + "(?:מחר|למחר|מחר בערב|מחר בבוקר)" + E), "one-tomorrow"],
      [new RegExp(B + "(?:כל|בכל) יום (ראשון|שני|שלישי|רביעי|חמישי|א'|ב'|ג'|ד'|ה')" + E), "every-wd"],
      [new RegExp(B + "(?:ביום|יום|ב|ל|ליום)(ראשון|שני|שלישי|רביעי|חמישי|א'|ב'|ג'|ד'|ה')(?:\\s+(הקרוב|הזה|הבא))?" + E), "one-wd"],
      [new RegExp(B + "(?:ביום |יום |ליום )(ראשון|שני|שלישי|רביעי|חמישי|א'|ב'|ג'|ד'|ה'|א|ב|ג|ד|ה)(?:\\s+(הקרוב|הזה|הבא))?" + E), "one-wd"]
    ];
    var LET = { "א'": "ראשון", "ב'": "שני", "ג'": "שלישי", "ד'": "רביעי", "ה'": "חמישי", "א": "ראשון", "ב": "שני", "ג": "שלישי", "ד": "רביעי", "ה": "חמישי" };
    for (var k = 0; k < DAYP.length; k++) {
      var dm = rest.match(DAYP[k][0]); if (!dm) continue;
      var kind = DAYP[k][1];
      if (kind === "every-wd") { var wn = LET[dm[1]] || dm[1]; return { error: "המסך עוד לא יודע זמן קבוע ל\"כל יום " + wn + "\" לבד", suggestions: [p.he + " ביום " + wn + " " + (p.ap === "am" ? "8:00" : "6:30") + " (רק השבוע)", p.he + " " + (p.ap === "am" ? "8:00" : "6:30") + " ראשון עד חמישי"] }; }
      if (o.days || o.oneOff) return { error: "יש במשפט שני סוגי ימים. כתבו רק אחד, למשל \"כל יום חול\" או \"בשבת\"" };
      if (kind === "one-shabbat") { var sh = T.comingShabbat(ctx.today); o.oneOff = { iso: sh, he: "רק בשבת הקרובה, " + T.dateHe(sh) }; }
      else if (kind === "ask-next-shabbat") { var s1 = T.comingShabbat(ctx.today), s2 = T.addDays(s1, 7); o.askNext = [s1, s2]; }
      else if (kind === "one-fri") { var fr = T.nextDow(ctx.today, 5); o.oneOff = { iso: fr, he: "רק ביום שישי הקרוב, " + T.dateHe(fr) }; }
      else if (kind === "one-today") { o.oneOff = { iso: ctx.today, he: "רק היום, " + T.dateHe(ctx.today) }; if (/ערב|לילה/.test(dm[0])) o.ap = "pm"; }
      else if (kind === "one-tomorrow") { var tm = T.addDays(ctx.today, 1); o.oneOff = { iso: tm, he: "רק מחר, " + T.dateHe(tm) }; if (/בערב/.test(dm[0])) o.ap = "pm"; if (/בבוקר/.test(dm[0])) o.ap = "am"; }
      else if (kind === "one-after-tomorrow") { var tm2 = T.addDays(ctx.today, 2); o.oneOff = { iso: tm2, he: "רק מחרתיים, " + T.dateHe(tm2) }; }
      else if (kind === "one-wd") {
        var wname = LET[dm[1]] || dm[1], wd = T.WD_HE.indexOf(wname), nd = T.nextDow(ctx.today, wd);
        if (dm[2] === "הבא" && T.diffDays(ctx.today, nd) <= 2) { o.askNext = [nd, T.addDays(nd, 7)]; }
        else o.oneOff = { iso: nd, he: "רק ביום " + wname + " הקרוב, " + T.dateHe(nd) };
      }
      else { o.days = kind; o.daysHe = DAYP[k][2] || T.DAY_HE[kind]; }
      rest = cut(rest, dm);
    }
    /* one date: "ב-10/11", "ביום 12 בנובמבר" */
    var reOne = new RegExp(B + "(?:ב-?|ביום |בתאריך |ל-?|ליום |לתאריך )?((?:\\d{1,2}/\\d{1,2}(?:/\\d{2,4})?)|(?:\\d{1,2} ?(?:ב|ל)(?:ינואר|פברואר|מרץ|מרס|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)(?: \\d{4})?))" + E);
    if ((m = rest.match(reOne))) {
      var od = parseDateRef(m[1], ctx); if (od.error) return { error: od.error };
      if (o.days || o.oneOff) return { error: "יש במשפט גם ימים וגם תאריך. כתבו רק אחד" };
      if (od.iso < ctx.today) return { error: "התאריך " + T.dateHe(od.iso) + " כבר עבר" };
      o.oneOff = { iso: od.iso, he: "רק ב-" + T.dateHe(od.iso) }; rest = cut(rest, m);
    }
    /* which one: "המנחה השנייה", "ערבית האחרונה" */
    re = new RegExp(B + "(?:של |את |ה?מניין |ה?מנין )?(" + alt(Object.keys(ORD)) + ")" + E);
    if ((m = rest.match(re)) && !/(?:^|\s)(?:ב|ל)?יום\s*$/.test(rest.slice(0, m.index))) { o.ord = ORD[m[1]]; rest = cut(rest, m); }

    /* clock times. Each match is replaced by a marker so the order in the sentence is kept. */
    var found = [];
    function mark(str, mm, tm) { found.push(tm); return str.slice(0, mm.index) + " \u0002" + (found.length - 1) + "\u0002 " + str.slice(mm.index + mm[0].length); }
    function pre(px, before) { px = px || ""; return { to: /^ל/.test(px) || /(?:^|\s)(?:עכשיו|תהיה|יהיה|יהיו|להיות|שתהיה|שיהיה)\s*$/.test(before || ""), from: /^מ/.test(px) || /(?:^|\s)במקום\s*$/.test(before || "") }; }
    function hourVal(w) { return /^\d+$/.test(w) ? +w : HOURW[w]; }
    var PX = "(ל-?|ב-?|מ-?|לשעה |בשעה |משעה |בסביבות |בערך |ב|ל|מ)?";
    /* "רבע לשמונה", "עשרה לשבע", "חמש דקות לשמונה" */
    re = new RegExp(B + PX + "(" + MINRE + ")(?:\\s*דקות)?\\s+ל-?(" + HOURRE + ")" + E);
    while ((m = rest.match(re))) { var hv = hourVal(m[3]), mv = MINW[m[2]]; if (!hv || hv > 12) break; var pp = pre(m[1], rest.slice(0, m.index)); rest = mark(rest, m, { h: hv === 1 ? 12 : hv - 1, mi: 60 - mv, ap: null, to: pp.to, from: pp.from, raw: m[0].trim() }); }
    /* "עשרים אחרי שבע", "רבע אחרי שמונה" */
    re = new RegExp(B + "(" + MINRE + ")(?:\\s*דקות)?\\s+(?:אחרי|אחר)\\s+" + PX + "(" + HOURRE + ")" + E);
    while ((m = rest.match(re))) { var hv2 = hourVal(m[3]); if (!hv2 || hv2 > 12) break; var pp2 = pre(m[2], rest.slice(0, m.index)); rest = mark(rest, m, { h: hv2, mi: MINW[m[1]], ap: null, to: pp2.to, from: pp2.from, raw: m[0].trim() }); }
    /* "שבע וחצי", "שמונה ורבע", "7 וחצי", "שבע שלושים", "שבע" */
    re = new RegExp(B + PX + "(" + alt(Object.keys(HOURW)) + "|\\d{1,2})(?:\\s+(?:ו-?(" + MINRE + ")|ו-?(\\d{1,2})(?:\\s*דקות)?|(שלושים|ארבעים וחמש|ארבעים|עשרים וחמש|עשרים|חמש עשרה|חמישים)))" + E);
    while ((m = rest.match(re))) { var hv3 = hourVal(m[2]); var mi3 = m[3] ? MINW[m[3]] : m[4] ? +m[4] : MINW[m[5]]; if (hv3 === undefined || hv3 > 23 || mi3 > 59) break; var pp3 = pre(m[1], rest.slice(0, m.index)); rest = mark(rest, m, { h: hv3, mi: mi3, ap: null, to: pp3.to, from: pp3.from, raw: m[0].trim() }); }
    /* digits: "7:30", "19:30", "7.30", with or without a part-of-day word */
    var reT = new RegExp(B + "(ל-?|ב-?|מ-?|לשעה |בשעה |משעה )?(\\d{1,2})[:.](\\d{2})(?:\\s*(" + AMW + "))?" + E, "i");
    while ((m = rest.match(reT))) { var pp4 = pre(m[1], rest.slice(0, m.index)); rest = mark(rest, m, { h: +m[2], mi: +m[3], ap: apOf(m[4]), to: pp4.to, from: pp4.from, raw: m[0].trim() }); }
    var reH = new RegExp(B + PX + "(\\d{1,2}|" + alt(Object.keys(HOURW)) + ")\\s+(" + AMW + ")" + E, "i");
    while ((m = rest.match(reH))) { var hv5 = hourVal(m[2]); var pp5 = pre(m[1], rest.slice(0, m.index)); rest = mark(rest, m, { h: hv5, mi: 0, ap: apOf(m[3]), to: pp5.to, from: pp5.from, raw: m[0].trim() }); }
    /* a number right after "עד" is not a clock time ("עד 15" is a date we did not understand): it stays for "לא הבנתי" */
    rest = rest.replace(/(^|\s)(ו?עד|מ-|מ)\s*(\d{1,2})(?=\s|$)/g, function (x, a, b, n) { return /^מ/.test(b) && !/^ו?עד$/.test(b) ? x : a + b + " \u0003" + n; });
    /* a bare hour: "ערבית 8", "ב-7", "בשבע", "לשמונה" */
    re = new RegExp(B + PX + "(\\d{1,2}|" + alt(Object.keys(HOURW)) + ")" + E);
    while ((m = rest.match(re))) { var hv6 = hourVal(m[2]); if (hv6 === undefined) break; var pp6 = pre(m[1], rest.slice(0, m.index)); rest = mark(rest, m, { h: hv6, mi: 0, ap: null, to: pp6.to, from: pp6.from, raw: m[0].trim(), bare: true }); }
    /* the order in the sentence */
    var order = []; rest.replace(/\u0002(\d+)\u0002/g, function (x, i) { order.push(+i); return x; });
    o.times = order.map(function (i) { return found[i]; });
    rest = rest.replace(/\s*\u0002\d+\u0002\s*/g, " ");
    /* a part-of-day word on its own ("שבת בבוקר", "בערב ערבית 8") applies to the times */
    re = new RegExp(B + "(" + AMW + ")" + E, "i");
    while ((m = rest.match(re))) { o.ap = apOf(m[1]); rest = cut(rest, m); }
    if (o.ap) o.times.forEach(function (tm) { if (!tm.ap) tm.ap = o.ap; });
    /* words that carry nothing */
    rest = " " + rest + " ";
    MULTI_FILLERS.forEach(function (f) { rest = rest.split(" " + f + " ").join(" "); });
    var leftover = rest.trim().split(/\s+/).filter(function (w) { return w && FILLERS.indexOf(w) < 0 && FILLERS.indexOf(w.replace(/^[וש]/, "")) < 0; });
    o.only = /(?:^|\s)(?:רק|ורק)(?:\s|$)/.test(rest);
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

  var START_ONLY = ["שני", "תשני", "סדר", "לסדר", "קבע", "בטל", "ביטול", "דחה"];
  var NEG_DEL = /(?:^|\s)(?:אין יותר|אין כבר|אין צורך ב|לא צריך יותר|לא צריכים יותר|לא צריך את|לא צריך|לא צריכים|כבר אין|לא יהיה יותר|לא יהיה|לא יהיו|לא יתקיים|לא תתקיים|בלי)(?=\s|$)/;
  var POS_ADD = /(?:^|\s)(?:יש עכשיו|יהיה גם|יהיה עוד|יש גם|עוד מניין|מניין נוסף|מנין נוסף|זמן נוסף|צור|תיצור|תייצר|ליצור|צרי|תיצרי|תפתח|לפתוח|פתח)(?=\s|$)/;
  var SHOW = /(?:^|\s)(?:מתי|מה הזמנים|מה הזמן|מה השעה|מה השעות|באיזו שעה|באיזה שעה|כמה זמני|איזה זמני|אילו זמני|תראה לי|תראי לי|תראה|תראי|הראה|הצג|תציג|להציג|רשימה|רשימת|תן לי את|show|list)(?=\s|$)/;
  var SHOW_WORDS = /(?:^|\s)(?:מתי|מה|הזמנים|השעה|השעות|באיזו|באיזה|כמה|איזה|אילו|תראה|תראי|הראה|הצג|תציג|להציג|רשימה|רשימת|תן|לי|show|list|יש)(?=\s|$)/g;
  function scanActs(s) {
    var acts = {}, kept = [], words = s.split(" ");
    for (var i = 0; i < words.length; i++) {
      var w = words[i], b = w.replace(/^[וש](?=\S{3})/, ""), a = ACT_OF[w] || ACT_OF[b];
      if (a && START_ONLY.indexOf(b) >= 0 && i > 0) a = null;
      if (a && /^(מוקדם|מאוחר|מוקדמת|מאוחרת)$/.test(b) && words[i - 1] === "הכי") a = null;
      if (a) acts[a] = 1; else kept.push(w);
    }
    var t = " " + kept.join(" ") + " ";
    if (NEG_DEL.test(t)) { acts["delete"] = 1; t = t.replace(NEG_DEL, " "); }
    while (POS_ADD.test(t)) { acts.add = 1; t = t.replace(POS_ADD, " "); }
    t = t.replace(/(?:^|\s)יותר(?=\s|$)/g, " ");
    var act = null;
    if (acts.earlier || acts.later) { if (acts.earlier && acts.later) return { error: true }; act = "shift"; }
    else if (acts["delete"] && (acts.add || acts.update)) return { error: true };
    else if (acts.update) act = "update";
    else if (acts.add) act = "add";
    else if (acts["delete"]) act = "delete";
    return { act: act, shift: acts.earlier ? "earlier" : acts.later ? "later" : null, rest: t.replace(/\s+/g, " ").trim() };
  }
  var DEMO = /(?:^|\s)(?:את זה|זה|הזה|הזאת|הזו|זאת|אותו|אותה|אותם|אותן|את התפילה|התפילה|תפילה|את הזמן|הזמן|הזמנים|את הזמנים|את השורה|השורה|שורה|הכל|את הכל|כולם|את כולם|הכול|את|this|that|it)(?=\s|$)/;
  function sortable(d) { return !d.rule || ((!d.rule.days || d.rule.days === "all") && d.rule.kind !== "sunset" && !d.rule.from && !d.rule.until); }
  function docLine(d) { return (d.nameHe || d.nameEn || "") + " " + (d.rule && d.rule.kind === "sunset" ? T.offsetHe(d.rule.offsetMin) : (T.min12(d.time) >= 0 ? d.time : T.fmt12(d.order))); }
  function docCmd(d) { return (d.nameHe || d.nameEn || "") + " " + (T.min12(d.time) >= 0 ? d.time : T.fmt12(d.order)); }
  function docDays(d) { return d.rule ? (T.describeRule(d.rule, d.time) || "כל יום") : "כל יום"; }
  function docMin(d) { var x = T.min12(d.time); return x < 0 ? d.order : x; }
  function sortedDocs(list) { return (list || []).slice().sort(function (a, b) { return docMin(a) - docMin(b); }); }
  function listResult(title, docs, verbs) {
    return { type: "list", message: title, items: docs.map(function (d) { return (d.nameHe || d.nameEn || "") + " " + (d.rule ? (T.describeRule(d.rule, d.time) || d.time) : d.time + " | כל יום"); }),
      suggestions: [].concat.apply([], docs.slice(0, 6).map(function (d) { return (verbs || ["מחק"]).map(function (v) { return v + " " + docCmd(d); }); })) };
  }
  /* no prayer named: "תמחק את זה", "תוסיף את התפילה הזאת", "מה הזמנים" -> a short question with one-tap choices, never a guess */
  function noPrayer(s, ctx, sc) {
    var docs = sortedDocs(ctx.docs);
    if (SHOW.test(" " + s + " ") && !sc.act) {
      if (!docs.length) return err("עוד אין זמני תפילה ברשימה", ["הוסף שחרית 7:00 בימי חול", "הוסף מנחה 1:40 בימי חול", "הוסף ערבית 8:00 בימי חול"]);
      return listResult("זמני התפילה עכשיו:", docs, ["מחק"]);
    }
    var demo = DEMO.test(" " + s + " ") || !s.replace(/(?:^|\s)(?:רק|גם|של|ה|ב|ל|-)(?=\s|$)/g, " ").trim();
    if (!demo || !sc.act) return null;
    if (sc.act === "delete") {
      if (!docs.length) return err("אין כרגע זמני תפילה למחוק", []);
      return err("איזה זמן למחוק? לחצו על אחד:", docs.map(function (d) { return "מחק " + docCmd(d); }));
    }
    if (sc.act === "add" || sc.act === "update") {
      var loose = docs.filter(sortable), sug = [];
      loose.forEach(function (d) { sug.push(docCmd(d) + " רק בימי חול", docCmd(d) + " רק בשבת"); });
      if (sc.act === "add") sug = sug.concat(["הוסף שחרית 7:00 בימי חול", "הוסף מנחה 1:40 בימי חול", "הוסף ערבית 8:00 בימי חול"]);
      else docs.filter(function (d) { return !sortable(d); }).slice(0, 4).forEach(function (d) { sug.push("שנה " + docCmd(d) + " ל-" + T.short12(docMin(d) + 15)); });
      return err(sc.act === "add" ? (loose.length ? "איזו תפילה? אפשר לבחור זמן מ\"לסדר\" או להוסיף חדש:" : "איזו תפילה ובאיזו שעה? למשל:") : "איזה זמן לשנות? לחצו על אחד:", sug.slice(0, 10));
    }
    if (sc.act === "shift") return err("איזה זמן " + (sc.shift === "earlier" ? "להקדים" : "לאחר") + "? לחצו על אחד:", docs.slice(0, 8).map(function (d) { return (sc.shift === "earlier" ? "תקדים " : "תאחר ") + docCmd(d) + " ב-5 דקות"; }));
    return null;
  }

  /* v2: "מתי?" one-tap chips. Each chip is a full sentence the parser already knows (so it gets the normal preview + "אשר");
     "תאריך מסוים" opens a date field and runs base + " ב-D/M/YYYY" (the existing one-day change). */
  function askWhen(p, min, offset, raw, ctx) {
    var en = /[a-z]/i.test(raw) && !/[\u05d0-\u05ea]/.test(raw);
    var base = p.he + " " + (offset !== null && offset !== undefined ? (offset === 0 ? "עם השקיעה" : Math.abs(offset) + " דקות " + (offset < 0 ? "לפני" : "אחרי") + " השקיעה") : T.fmt12(min));
    var C = [["רק היום", "Today only", "רק היום"], ["מחר", "Tomorrow", "מחר"], ["כל יום חול", "Every weekday", "כל יום חול"], ["שישי", "Friday", "בשישי"], ["שבת", "Shabbat", "בשבת"], ["כל השבוע", "All week", "כל השבוע"]];
    var choices = C.map(function (c) { return { label: en ? c[1] : c[0], cmd: base + " " + c[2] }; });
    return { message: en ? "When?" : "מתי?", sub: en ? p.en + " " + (offset !== null && offset !== undefined ? T.offsetHe(offset) : T.fmt12(min)) : base, lang: en ? "en" : "he",
      choices: choices, suggestions: choices.map(function (c) { return c.cmd; }),
      date: { label: en ? "A specific date" : "תאריך מסוים", go: en ? "Continue" : "המשך", base: base, min: ctx.today } };
  }
  function whenDateCmd(base, iso) { return base + " ב-" + (+iso.slice(8, 10)) + "/" + (+iso.slice(5, 7)) + "/" + iso.slice(0, 4); }
  function parsePrayer(t, ctx) {
    var sc = scanActs(canon(t));
    if (sc.error) return err("כתבו פעולה אחת בכל פעם, למשל:", ["מחק מנחה 1:40", "הוסף ערבית 8:00 בימי חול", "תקדים שחרית ב-5 דקות"]);
    var s = sc.rest, act = sc.act === "shift" ? "update" : sc.act;
    var fp = findPrayer(s);
    if (!fp) return noPrayer(s, ctx, sc);
    var p = fp.p, rest = cut(s, fp.m);
    var fp2 = findPrayer(rest);
    if (fp2 && fp2.p !== p) return err("יש במשפט שתי תפילות (" + p.he + ", " + fp2.p.he + "). כתבו אחת בכל פעם", [p.he + " " + (p.ap === "am" ? "7:00" : "6:30"), fp2.p.he + " " + (fp2.p.ap === "am" ? "7:00" : "6:30")]);
    if (fp2) rest = cut(rest, fp2.m);
    var docs = (ctx.docs || []).filter(function (d) { return samePrayer(d, p); });
    if (!act && SHOW.test(" " + rest + " ")) {
      if (!docs.length) return err("אין כרגע זמן " + p.he + " ברשימה", ["הוסף " + p.he + " " + (p.ap === "am" ? "7:05" : "6:30")]);
      return listResult("זמני " + p.he + " עכשיו:", sortedDocs(docs), ["שנה", "מחק"].slice(1));
    }
    var x = extract(rest, p, ctx, { shift: sc.shift });
    if (x.error) return err(x.error, x.suggestions || [p.he + " 6:30 כל יום חול עד פסח", p.he + " 15 דקות לפני השקיעה"]);
    if (x.leftover && DEMO.test(" " + x.leftover + " ")) x.leftover = (" " + x.leftover + " ").replace(new RegExp(DEMO.source, "g"), " ").trim();
    if (x.leftover) return err("לא הבנתי את \"" + x.leftover.replace(/\u0003/g, "") + "\"", [p.he + " " + (p.ap === "am" ? "7:05" : "6:30"), p.he + " 15 דקות לפני השקיעה", p.he + " 6:30 כל יום חול עד פסח"].concat(act === "delete" ? [] : ["מחק " + p.he]));
    if (x.askNext) {
      var base0 = (sc.act === "delete" ? "מחק " : "") + p.he + x.times.map(function (tm) { return " " + tm.raw.replace(/^(?:ל-?|ב-?|מ-?)/, ""); }).join("") + (x.offset !== null ? " " + Math.abs(x.offset) + " דקות " + (x.offset < 0 ? "לפני" : "אחרי") + " השקיעה" : "");
      return err("לאיזה יום?", x.askNext.map(function (iso) { return base0 + " ב-" + (+iso.slice(8, 10)) + "/" + (+iso.slice(5, 7)) + " (" + T.dateHe(iso) + ")"; }));
    }

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
    if (x.times.length === 2) {
      var i0 = 0, i1 = 1;
      if ((x.times[0].to && !x.times[1].to) || (x.times[1].from && !x.times[0].from)) { i0 = 1; i1 = 0; }
      if (act === "add" && !x.times[i1].to && !x.times[i0].from) return err("יש במשפט שתי שעות. הוסיפו זמן אחד בכל פעם", [p.he + " " + T.short12(x.times[0].min), p.he + " " + T.short12(x.times[1].min)]);
      if (act === "delete") return err("איזה מהשניים למחוק?", ["מחק " + p.he + " " + T.short12(x.times[0].min), "מחק " + p.he + " " + T.short12(x.times[1].min)]);
      atTime = x.times[i0]; toTime = x.times[i1]; if (act !== "update") act = "update";
    }
    else if (x.times.length === 1) {
      var t0 = x.times[0];
      if (sc.shift) atTime = t0;
      else if (t0.from && act !== "add") { atTime = t0; if (!act) act = "update"; }
      else if (t0.to && act !== "delete") { toTime = t0; if (!act) act = docs.length ? "update" : "add"; }
      else if (act === "delete") atTime = t0;
      else if (act === "update" && (x.offset !== null || x.days || x.oneOff || x.from || x.until) && matchDocs(t0, null).length) atTime = t0; /* "שנה מנחה 4:45 עד חנוכה": the time names the doc */
      else if (!act && x.days && x.offset === null && !x.oneOff) {
        /* "ערבית 8 רק בימי חול", "מנחה 1:40 חול": an existing time that shows every day goes to its place */
        var same = docs.filter(function (d) { return docMin(d) === t0.min; }); /* the exact time, after am/pm */
        var movable = same.filter(function (d) { return x.only || sortable(d); });
        if (movable.length >= 1 && (x.only || movable.length === 1)) { act = "update"; atTime = t0; }
        else toTime = t0;
      }
      else toTime = t0;
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
    /* narrow by the days named and by "the first / the last" */
    function narrow(list) {
      if (list.length > 1 && x.days) { var byDays = list.filter(function (d) { return (d.rule && d.rule.days || "all") === x.days; }); if (byDays.length) list = byDays; }
      if (x.ord) { var srt = sortedDocs(list); var one = x.ord > 0 ? srt[x.ord - 1] : srt[srt.length - 1]; return one ? [one] : []; }
      return list;
    }
    function docLabel(d) { return docLine(d); }
    /* what the person asked for, kept on every one-tap choice: "שנה מנחה 1:40 PM ל-1:50 PM" */
    var DAYW = { "sun-thu": "בימי חול", "weekday": "ראשון עד שישי", "fri": "בשישי", "shabbat": "בשבת", "all": "כל יום" };
    function dm(iso) { return (+iso.slice(8, 10)) + "/" + (+iso.slice(5, 7)); }
    function intent(verb) {
      var a = [];
      if (verb !== "מחק") {
        if (x.shift) a.push("ב-" + Math.abs(x.shift) + " דקות");
        else if (toTime) a.push("ל-" + T.fmt12(toTime.min));
        else if (x.offset !== null) a.push("ל-" + Math.abs(x.offset) + " דקות " + (x.offset < 0 ? "לפני" : "אחרי") + " השקיעה");
        if (x.days) a.push((x.only ? "רק " : "") + DAYW[x.days]);
        if (x.oneOff) a.push("ב-" + dm(x.oneOff.iso));
        if (x.from) a.push("מ-" + dm(x.from.iso));
        if (x.until) a.push("עד " + dm(x.until.iso));
      }
      return a.length ? " " + a.join(" ") : "";
    }
    function pick(list, verb) {
      if (!docs.length) return err("אין כרגע זמן " + p.he + " ברשימה", ["הוסף " + p.he + " " + (toTime ? T.short12(toTime.min) : (p.ap === "am" ? "7:05" : "6:30"))]);
      var tail = intent(verb);
      if (!list.length) return err("לא מצאתי " + p.he + " " + (x.ord ? "כזה" : "בשעה הזאת") + ". יש: " + docs.map(docLabel).join(", "), sortedDocs(docs).map(function (d) { return verb + " " + docCmd(d) + tail; }));
      if (list.length > 1) return err("יש " + list.length + " זמני " + p.he + ". איזה מהם?", sortedDocs(list).map(function (d) { return verb + " " + docCmd(d) + tail; }));
      return list[0];
    }

    if (act === "delete") {
      var target = pick(narrow(matchDocs(atTime, x.offset)), "מחק");
      if (target.type === "error") return target;
      return { type: "plan", plan: { action: "delete", nameHe: target.nameHe, target: target, rows: [
        { k: "פעולה", v: "מחיקת זמן תפילה" }, { k: "תפילה", v: target.nameHe }, { k: "שעה", v: target.rule && target.rule.kind === "sunset" ? T.offsetHe(target.rule.offsetMin) : target.time },
        { k: "ימים", v: target.rule ? (T.describeRule(target.rule, target.time) || "כל יום") : "כל יום" }, { k: "על המסך", v: "הזמן יוסר מהמסך" }], warnings: [] } };
    }

    /* earlier / later: "תקדים שחרית ב-5 דקות", "ערבית 10 דקות מאוחר יותר" */
    var target2 = null, base = null;
    if (sc.shift) {
      var verbS = sc.shift === "earlier" ? "תקדים" : "תאחר";
      target2 = pick(narrow(matchDocs(atTime, x.offset)), verbS);
      if (target2.type === "error") return target2;
      if (!x.shift) return err("בכמה דקות " + (sc.shift === "earlier" ? "להקדים" : "לאחר") + "?", [5, 10, 15].map(function (n) { return verbS + " " + docCmd(target2) + " ב-" + n + " דקות"; }));
      if (target2.rule && target2.rule.kind === "sunset") x.offset = Math.round(+target2.rule.offsetMin || 0) + x.shift;
      else toTime = { min: docMin(target2) + x.shift, explicit: true };
      if (toTime && (toTime.min < 0 || toTime.min >= 1440)) return err("השעה יוצאת מחוץ ליום", []);
      atTime = null; act = "update";
    }

    var keepTime = false;
    if (!toTime && x.offset === null && act === "update" && (x.days || x.oneOff || x.from || x.until)) keepTime = true;
    if (!toTime && x.offset === null && !keepTime) {
      if (act === "update") return err("לאיזו שעה לשנות?", [ "שנה " + p.he + " ל-" + (p.ap === "am" ? "7:15" : "6:45"), "שנה " + p.he + " ל-15 דקות לפני השקיעה"]);
      return err("חסרה שעה ל" + p.he, [p.he + " " + (p.ap === "am" ? "7:05" : "6:30"), p.he + " 15 דקות לפני השקיעה", p.he + " 6:30 כל יום חול עד פסח"]);
    }
    if (toTime && x.offset !== null) return err("יש במשפט גם שעה וגם זמן לפי השקיעה. בחרו אחד", [p.he + " " + T.short12(toTime.min), p.he + " " + T.offsetHe(x.offset).replace(" דק׳ ", " דקות ")]);

    /* build the rule */
    if (act === "update" && !target2) {
      target2 = pick(narrow(matchDocs(atTime, null)), "שנה");
      if (target2.type === "error") return target2;
    }
    if (act === "update") base = target2.rule || null;
    var rule = base ? JSON.parse(JSON.stringify(base)) : null;
    function ensure() { if (!rule) rule = { kind: "fixed", offsetMin: 0, days: "all" }; }
    if (keepTime) { var tm0 = T.min12(target2.time); toTime = { min: tm0 >= 0 ? tm0 : target2.order, explicit: true }; }
    if (x.offset !== null) { ensure(); rule.kind = "sunset"; rule.offsetMin = x.offset; }
    else if (rule && !(keepTime && rule.kind === "sunset")) { rule.kind = "fixed"; rule.offsetMin = 0; }
    if (x.days) { ensure(); rule.days = x.days === "week3" ? "sun-thu" : x.days; }
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
    /* v2 (Hanoch, Nov 4): a new time with no days (or "כל יום") is not parked in "לסדר": ask once "מתי?" with one-tap chips */
    /* the plan below stays exactly as before (old suites unchanged); it carries "when" and the bar shows the chips instead of "אשר" */
    var whenAsk = (act !== "update" && (!rule || ((!rule.days || rule.days === "all") && !rule.from && !rule.until))) ? askWhen(p, x.offset !== null ? null : toTime.min, x.offset, t, ctx) : null;

    /* today's (or the first day's) time, for the time and order fields */
    var firstIso = rule ? T.firstDay(rule, ctx.today, 400, ctx.isYomTov) : ctx.today, min;
    if (rule && rule.kind === "sunset") {
      min = T.sunsetRuleMin(ctx.zman, firstIso, rule.offsetMin);
      if (min < 0) return err("אין עדיין נתוני שקיעה לתאריך " + T.dateHe(firstIso) + ", לכן המסך לא יוכל להציג זמן לפי השקיעה", []);
    } else min = toTime.min;
    var item = { nameHe: p.he, nameEn: (target2 && target2.nameEn) || p.en, time: T.fmt12(min), order: min, rule: rule };
    /* v2: "כל השבוע" = this row on חול plus the same on שישי and on שבת (each lands in its own place) */
    var extra = [];
    if (x.days === "week3" && rule) {
      ["fri", "shabbat"].forEach(function (dd) {
        var r2 = JSON.parse(JSON.stringify(rule)); r2.days = dd;
        var m2 = min;
        if (r2.kind === "sunset") { var f2 = T.firstDay(r2, ctx.today, 400, ctx.isYomTov); m2 = f2 ? T.sunsetRuleMin(ctx.zman, f2, r2.offsetMin) : -1; if (m2 < 0) m2 = min; }
        var it2 = { nameHe: p.he, nameEn: item.nameEn, time: T.fmt12(m2), order: m2, rule: r2 };
        var twin = (ctx.docs || []).some(function (d) { return samePrayer(d, p) && T.min12(d.time) === m2 && JSON.stringify(d.rule || null) === JSON.stringify(r2); });
        if (!twin) extra.push(it2);
      });
    }

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
    if (extra.length) rows.push({ k: "גם", v: extra.map(function (e) { return p.he + " " + T.short12(e.order) + " " + T.DAY_HE[e.rule.days]; }).join(" | ") });
    return { type: "plan", plan: { action: act === "update" ? "update" : "add", nameHe: p.he, item: item, target: target2, others: extra.length ? [] : others, extra: extra, when: whenAsk, rows: rows, warnings: warnings } };
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
  /* Free text (2026-11-05, Hanoch: "חסות does not sound good"): the generated
     title now reads "X נתרם על ידי Y" instead of "X בחסות Y", and "בחסות" is
     still read as an input synonym so an old habit keeps working, but it is
     never written out any more. subtype still records kiddush/seudah3 for
     this one shortcut; a different occasion (not Kiddush or Seudah Shlishit)
     has no command-bar shortcut and is written in the TV content screen
     (gabbai/tv/content/) instead, as free text, with no fixed list. */
  function parseSponsor(t, ctx) {
    var m = t.match(/^(?:חסות\s+)?(הקידוש|קידוש|סעודה שלישית|סעודה ג'|סעודה ג)(?:\s+(?:השבת|בשבת הקרובה|בשבת|לשבת|של שבת))?\s*(?:בחסות|נתרם על ידי|נתרם ע"י|ע"י|על ידי|לכבוד|:|-)\s*(.+)$/);
    if (!m) return null;
    var who = m[2].trim().replace(/^[:-]\s*/, "");
    if (who.length < 2) return err("מי תרם?", ["קידוש נתרם על ידי משפחת כהן"]);
    var sub = /סעודה/.test(m[1]) ? "seudah3" : "kiddush", sh = T.comingShabbat(ctx.today), fri = T.addDays(sh, -1);
    var label = sub === "kiddush" ? "הקידוש" : "סעודה שלישית";
    var item = { type: "sponsor", subtype: sub, titleHe: label + " נתרם על ידי " + who, bodyHe: "", startDate: T.addDays(sh, -6) < ctx.today ? ctx.today : T.addDays(sh, -6), endDate: sh, showOn: "all", status: "published" };
    return { type: "plan", plan: { action: "sponsor", item: item, publish: true, rows: [
      { k: "פעולה", v: "תרומה ל" + (sub === "kiddush" ? "קידוש" : "סעודה שלישית") + " על המסך" }, { k: "טקסט", v: item.titleHe },
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
    var s = t.toLowerCase().replace(/^(?:open|go to|show me|show|פתח|תפתח|פתחי|לך ל|לכי ל|עבור ל|עבור אל|קח אותי ל|תעביר אותי ל|תכניס אותי ל|הצג|תראה לי|תראי לי|הראה|אל|ל)\s*-?\s*(?:את\s+)?/, "").replace(/^(?:the|דף|עמוד)\s+(?=\S)/, function (x) { return x; });
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
    var t = norm(text).replace(/[.!?,;]+$/, "").trim();
    if (!t) return err("כתבו מה לעשות", examples(ctx.role));
    if (/^(?:undo|undo that|undo last|cancel that|cancel last|תבטל את זה|בטל את זה|תחזיר את זה|תחזיר כמו שהיה|תחזיר אחורה|אופס|טעות|טעיתי|תבטל את מה שעשית|בטל את מה שעשית)$/i.test(t)) return { type: "undo" };
    if (/^(?:help|what can i (?:do|write|type)|examples|עזרה בבקשה|מה אני יכול לכתוב|מה לכתוב|איך כותבים|מה אפשר לכתוב|מה אתה יודע|מה את יודעת|מה אתה מבין|עזור לי|תעזור לי)$/i.test(t)) return { type: "help", suggestions: examples(ctx.role) };
    if (/^(?:בטל|ביטול|תבטל|בטלי|undo|אנדו|בטל את זה|בטל את השינוי|בטל את השינוי האחרון|בטל את הפעולה האחרונה|בטל שינוי אחרון|תחזיר|החזר|החזר כמו שהיה)$/.test(t)) return { type: "undo" };
    if (/^(?:עזרה|\?|help|מה אפשר|מה אפשר לעשות|דוגמאות|דוגמה|איך משתמשים)$/i.test(t)) return { type: "help", suggestions: examples(ctx.role) };
    var a = parseAnnouncement(t, ctx); if (a) return needScreen(a, ctx);
    var sp = parseSponsor(t, ctx); if (sp) return needScreen(sp, ctx);
    /* "תראה לי את הזמנים", "show times": the list itself, right here */
    if (SHOW.test(" " + t.toLowerCase() + " ") && /(?:^|\s)(?:ה?זמנים|זמני ה?תפילה|ה?תפילות|times|prayer times)(?:\s|$)/i.test(t) && !findPrayer(canon(t))) { var ls = noPrayer(canon(t), ctx, { act: null }); if (ls) return needList(ls, ctx); }
    var nv = parseNav(t, ctx); if (nv) return nv;
    var pr = parsePrayer(t, ctx); if (pr) return needScreen(pr, ctx);
    /* nothing matched: say what we saw, never guess */
    var timeOnly = /^(?:ב-?|ל-?)?\d{1,2}[:.]\d{2}(?:\s+\S+)?$/.test(t);
    if (timeOnly) return err("חסר שם התפילה", ["מנחה " + t, "שחרית " + t, "ערבית " + t]);
    if (/(שילם|חייב|יתרה|תרומה|תרומות|נדר)/.test(t)) return err("שאלות על כספים עוד לא בשורה הזאת. אפשר לפתוח את הכספים", allowed("finance", ctx.role) ? ["כספים", "נדרים"] : []);
    if (/(יארצייט|אזכרה|הזכרה|פלייר|חסות|הקדשה|מזל טוב)/.test(t)) return err("את זה עושים כרגע בעורך המסך", ["תוכן המסך", "קידוש נתרם על ידי משפחת כהן", "הכרזה: ..."]);
    if (/^(?:מחק|תמחק|הסר|שנה|עדכן|הוסף)(?:\s|$)/.test(t)) return err("איזה זמן תפילה?", ["מחק שחרית 7:05", "שנה מנחה ל-6:45", "הוסף ערבית 7:30"]);
    return err("לא הבנתי את \"" + t + "\". אפשר לנסות למשל:", examples(ctx.role));
  }
  function needList(r, ctx) { if (ctx.role && !(ctx.role.canScreen || ctx.role.isSuperAdmin)) return err("רק גבאי תוכן רואים את זמני התפילה כאן", []); return r; }
  function needScreen(r, ctx) {
    if ((r.type === "plan" || r.type === "list") && ctx.role && !(ctx.role.canScreen || ctx.role.isSuperAdmin)) return err("רק גבאי תוכן יכולים לשנות את המסך", []);
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

  var api = { parse: parse, norm: norm, PRAYERS: PRAYERS, examples: examples, parseDateRef: parseDateRef, holidayFinder: holidayFinder, whenDateCmd: whenDateCmd, _resolveHour: resolveHour };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.OH_COMMAND = api;
})(typeof window !== "undefined" ? window : this);
