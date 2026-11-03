/* TEST / SAMPLE DATA ONLY. Every value below is invented for testing.
   Replace this file with Firebase reads in the Firebase phase.
   Nothing here is a real congregant, gabbai, prayer time or Roy output,
   except the labeled Toldot anchor values, which are sample anchors
   supplied for demo layout only. */
window.TEST_DATA = {
  synagogue: {
    nameHe: "אור החיים",
    nameEn: "Or Hachaim Congregation",
    address: "321 Harold St, Staten Island, NY 10314",
    timezone: "America/New_York",
    superAdmin: "hanochhason@gmail.com"
  },
  /* Decisions 2026-11-01 23:06, binding: candle lighting is 18
     minutes before sunset, NOT Roy default 20. Toldot anchor:
     Friday sunset 4:40 PM minus 18 minutes = candles 4:22 PM.
     Shema Magen Avraham is equal minutes (shavot), NOT Roy
     seasonal. Toldot anchor: 8:35 AM. See
     src/zmanim/decisions-2026-11-01.js. */
  /* Sample day, labeled SAMPLE. Times marked "demo" are demo layout
     values only, NOT Roy output. The real engine lands later. */
  sampleDay: {
    label: "SAMPLE: Shabbat Toldot (demo layout only)",
    isHoliday: false, /* Burn-in shift is disabled on Shabbat (body class) and on holidays (this flag; date logic in the Firebase phase). */
    hebrewDate: "SAMPLE Hebrew date",
    secularDate: "SAMPLE date",
    parshaHe: "פרשת תולדות",
    parshaEn: "Parashat Toldot",
    haftarahEn: "Haftarah per Edot HaMizrach (sample text)",
    candleLighting: "4:22",
    shabbatEnds: "5:23",
    rabbeinuTam: "5:52",
    zmanim: [
      { key: "alot", he: "עלות השחר (שוות)", en: "Alot (equal minutes)", time: "5:31", source: "demo" },
      { key: "talis", he: "זמן טלית ותפילין", en: "Talis and Tefillin", time: "5:58", source: "demo" },
      { key: "netz", he: "נץ החמה", en: "Netz", time: "6:43", source: "sample anchor" },
      { key: "shemaMagen", he: "סוף זמן קריאת שמע מגן אברהם (שוות)", en: "Shema, Magen Avraham (equal minutes)", time: "8:35", source: "sample anchor" },
      { key: "shemaGra", he: "סוף זמן קריאת שמע גרא", en: "Shema, Gra", time: "9:11", source: "sample anchor" },
      { key: "tefillah", he: "סוף זמן תפילה", en: "Sof Zman Tefillah", time: "10:12", source: "demo" },
      { key: "chatzot", he: "חצות יום", en: "Chatzot", time: "11:40", source: "sample anchor" },
      { key: "minchaGedola", he: "מנחה גדולה", en: "Mincha Gedola", time: "12:08", source: "demo" },
      { key: "plag", he: "פלג המנחה", en: "Plag HaMincha", time: "3:37", source: "sample anchor" },
      { key: "shkiah", he: "שקיעה", en: "Shkiah", time: "4:39", source: "sample anchor" },
      { key: "tzeit", he: "צאת הכוכבים", en: "Tzeit HaKochavim", time: "5:23", source: "sample anchor (Shabbat ends)" }
    ]
  },
  prayerTimes: [
    { nameHe: "שחרית", nameEn: "Shacharit", time: "7:00 AM (TEST)" },
    { nameHe: "מנחה", nameEn: "Mincha", time: "4:20 PM (TEST)" },
    { nameHe: "ערבית", nameEn: "Arvit", time: "5:45 PM (TEST)" }
  ],
  seasonal: {
    prayerInsertions: "TEST: Yaaleh Veyavo on Rosh Chodesh; Barech Aleinu / Varechenu per chutz laaretz; Mashiv HaRuach and Morid HaGeshem in season, Morid HaTal in summer.",
    fastDetail: "TEST fast example: fast starts 5:15 AM, fast ends 5:30 PM, with fast details shown here.",
    hanukkah: "TEST: Hanukkah candle lighting 4:45 PM, 3 candles on this sample night.",
    kiddushLevana: "TEST: Kiddush Levana window per Edot HaMizrach, sample dates only.",
    eruvTavshilin: "TEST: Eruv Tavshilin reminder shown when a Yom Tov precedes Shabbat.",
    yomTovNote: "TEST: Diaspora Yom Tov, two days, per chutz laaretz custom."
  },
  boards: {
    parsha: "TEST: Parashat Toldot, Haftarah per Edot HaMizrach.",
    specialShabbatot: "TEST: Shabbat Mevarchim sample entry.",
    roshChodesh: "TEST: Rosh Chodesh / Shabbat Mevarchim / Molad sample entry.",
    omer: "TEST: Sefirat HaOmer sample count (shown in season only).",
    hanukkiah: "Animated digital Hanukkiah: sample animation on the screen (candles light in order).",
    holidayCustoms: "TEST: Holiday customs board sample text.",
    shiurim: "TEST: Shiur schedule: Sunday 8:00 PM sample shiur.",
    hayomYom: "TEST: Hayom Yom sample entry.",
    dailyHalacha: "TEST: Daily halacha, 365 cycle, sample entry 1 of 365.",
    mazalTov: "TEST: Mazal Tov sample announcement.",
    hazkarot: "TEST: Hazkarot and condolences sample entry.",
    sponsors: "TEST: Kiddush sponsored by TEST Family; Seudah Shlishit sponsored by TEST Family.",
    parnasHayom: "TEST: Parnas Hayom and Ner LaMaor sample entry.",
    seudahShlishitDonor: "TEST: Seudah Shlishit donor sample entry.",
    rabbiMessage: "TEST: Rabbi message / Shabbat blessing sample text."
  },
  announcements: [
    { textHe: "הודעת בדיקה בלבד", textEn: "TEST announcement only", from: "2026-11-01", to: "2026-12-31" }
  ],
  flyers: [
    { title: "TEST flyer", from: "2026-11-01", to: "2026-11-30", note: "Date-windowed: shown only inside its window." }
  ],
  dedications: [
    { textHe: "לעילוי נשמת פלוני בן פלוני (בדיקה)", textEn: "Leilui Nishmat TEST Name (permanent dedication, sample)" }
  ],
  campaign: { title: "TEST campaign / magbit board", text: "Sample campaign progress only, no real amounts." },
  yahrzeits: [
    { name: "TEST Yahrzeit Name", hebrewDate: "Sample Hebrew date", note: "Added once, recurs yearly in its week (sample)." }
  ],
  donation: { qrNote: "TEST donation QR placeholder (weekday-only item, hidden in Shabbat mode).", zelleNote: "TEST payment text placeholder (weekday-only item, hidden in Shabbat mode)." },
  congregants: [
    {
      id: "test-1", name: "TEST Congregant One", phone: "555-000-1000", email: "test-one@example.test",
      ledger: [
        { date: "2026-10-05", operationId: "op-test-1", type: "charge", amount: 180, description: "TEST charge: seat fee", enteredBy: "TEST gabbai" },
        { date: "2026-10-20", operationId: "op-test-2", type: "charge", amount: 120, description: "TEST charge: converted pledge, now a charge", enteredBy: "TEST gabbai" },
        { date: "2026-11-01", operationId: "op-test-3", type: "payment", amount: 100, description: "TEST payment: cash", enteredBy: "TEST gabbai" },
        { date: "2026-11-01", operationId: "op-test-4", type: "payment", amount: 50, description: "TEST payment: check", enteredBy: "TEST gabbai" }
      ]
    },
    {
      id: "test-2", name: "TEST Congregant Two (no email)", phone: "555-000-2000", email: "",
      ledger: [
        { date: "2026-10-10", operationId: "op-test-5", type: "charge", amount: 75, description: "TEST charge", enteredBy: "TEST gabbai" },
        { date: "2026-10-25", operationId: "op-test-6", type: "payment", amount: 75, description: "TEST payment: transfer", enteredBy: "TEST gabbai" }
      ]
    }
  ],
  /* Finance additions, decisions 2026-11-01 23:06, TEST data only.
     Nedarim are ledger charges with source "neder" and an aliyah.
     Recurring schedules create ledger charges on schedule; pausing
     or cancelling a schedule never deletes past ledger entries.
     Activity log records who changed what and when, for
     permissions, congregants, and ledger changes, not only the
     ledger itself. Tax letters list payments recorded in the year;
     which payments count as tax-deductible donations is an open
     question for Hanoch, so the letter template says so plainly
     and does not claim every payment is a donation. */
  nedarim: [
    { name: "TEST Neder Name", amount: 54, aliyah: "TEST aliyah", date: "2026-10-31" }
  ],
  /* Foundation, 2026-11-01: pledges are commitments, not charges
     and not payments. A pledge does not change the open balance
     until it is converted to a charge, and an unpaid pledge is
     reported separately from charges and payments. */
  pledges: [
    { id: "pledge-1", congregantId: "test-1", name: "TEST Pledge Name", amount: 54, aliyah: "TEST aliyah", date: "2026-10-31", status: "unpaid" },
    { id: "pledge-2", congregantId: "test-1", name: "TEST Converted Pledge", amount: 36, aliyah: "TEST aliyah", date: "2026-10-15", status: "converted" }
  ],
  recurringSchedules: [
    { id: "rec-1", congregantId: "test-1", name: "TEST monthly membership", amount: 25, period: "monthly", status: "active", nextDue: "2026-12-01" },
    { id: "rec-2", congregantId: "test-2", name: "TEST annual membership", amount: 180, period: "annual", status: "active", nextDue: "2027-01-01" }
  ],
  activityLog: [
    { when: "2026-11-01", who: "TEST super admin", action: "Added TEST Congregant One", area: "congregants" },
    { when: "2026-11-01", who: "TEST gabbai", action: "Added TEST charge: seat fee, $180", area: "ledger" },
    { when: "2026-11-01", who: "TEST super admin", action: "Set TEST gabbai permission to finance only", area: "permissions" }
  ],
  screenAccount: {
    note: "TV screen /tv/ is public and uses no account (stage 2). It reads prayer times and published public screen items only. No finance, no admin, no editing. Super admin hanochhason@gmail.com is management only."
  }
};
/* Ledger check for TEST Congregant One: charges 180 + 120 = 300;
   payments 100 + 50 = 150; balance owed = 300 - 150 = 150. */
/* Correction entries never delete an earlier entry. A correction amount is
   a signed delta to the balance: negative lowers what is owed, positive
   raises it. Charges and payments totals are unchanged by corrections. */
window.ledgerTotals = function (c) {
  var charges = 0, payments = 0, corrections = 0;
  c.ledger.forEach(function (e) {
    if (e.type === "charge") charges += e.amount;
    if (e.type === "payment") payments += e.amount;
    if (e.type === "correction") corrections += e.amount;
  });
  return { charges: charges, payments: payments, balance: charges - payments + corrections };
};
