# Or Hachaim Congregation Site (Scaffold, TEST DATA ONLY)

Synagogue: Or Hachaim Congregation, 321 Harold St, Staten Island, NY 10314.
Super admin: hanochhason@gmail.com. Login in production is Google only, via Firebase Auth.

This scaffold is NOT live, NOT connected to Firebase, NOT connected to a real
times engine, and contains NO real gabbai or congregant lists, NO real prayer
times, and NO real API keys. Everything on every page is labeled TEST or SAMPLE.

Authoritative plan: `~/workspace/your_files/Or-Hachaim-Synagogue-Site-Plan.md`.
That plan's YES list, NO list, Later list, and Shabbat rules govern this
scaffold. Anything in the plan's NO or Later lists is deliberately absent
here; this README does not enumerate them, so a search for those feature
labels in this scaffold should come back empty.

Do NOT touch `royzmanim-code/` (Roy clone, owned by a parallel validation
task) or `validation/` (also owned by that task).

## Structure

- `screen/index.html`, `screen/screen.css`, `screen/screen.js`: the TV screen.
  Landscape 16:9 first, three columns (daily zmanim, rotating center, prayer
  times), header with the official logo, date, clock with seconds, and
  parsha, bottom dedications strip, no long vertical scroll at 1920x1080.
  Phone and portrait layouts are secondary only.
- `admin/index.html`: gabbai editing interface, mock and local state only.
  Edit prayer times, announcements, dedications, sponsors, flyers with date
  windows, yahrzeit (add once, recurs yearly in its week), images and
  graphics (local preview only). No login wired yet, no saving to a backend.
- `finance/index.html`: congregant list (TEST names only), search, add a
  congregant with or without email, congregant card, append-only ledger.
  Every charge, payment, and correction is an entry with date, amount,
  description, and entered-by. Balance is computed from entries. Corrections
  are correction entries with a signed amount; nothing is ever deleted.
  Balance print uses `window.print` with a print stylesheet. Statement
  export is CSV (and printable). No PDF library is included, so no PDF
  library is claimed.
  Finance additions, decisions 2026-11-01 23:06, TEST data only:
  nedarim fast entry for Motzei Shabbat (name, amount, aliyah, one
  click per neder, stored as a ledger charge); recurring charges
  (monthly or annual membership, recorded on schedule, pausing or
  cancelling stops future charges only and never deletes past
  entries); annual tax receipts in January (one click, print-ready
  501c3 letters for all congregants, clearly labeled print-ready
  because no PDF library is included yet); activity log (who
  changed what and when, for permissions, congregants, and ledger
  changes, not only the ledger); backup from day one (full export
  button, see `src/firebase/backup-design.md`).
  Append-only is enforced in the database draft rules
  (`src/firebase/firestore.rules`): ledger entries, nedarim, and
  activity log entries can be created but never updated or deleted,
  by anyone, including the super admin. The user interface alone
  is not the enforcement.
- `congregant/index.html`: own-data-only dashboard for one TEST congregant.
  Real access is gated in the Firebase phase by the email the super admin
  added to that congregant's existing record plus Google login.
- `src/theme.css`: the separate theme layer. ALL colors, fonts, and frames
  live here only, so the design can change later without touching data.
  Theme: luxurious Sephardic, Jerusalem stone and marble with sky blue,
  navy `#0E2C4C`, gold from the logo, gold frames, Sephardic ornaments.
- `src/data/test-data.js`: ALL test data in one place, clearly labeled
  TEST or SAMPLE, easy to replace with Firebase reads later.
- `src/zmanim/shabbat-ends.js`: our own angle-based Shabbat ends
  module (sun centre 8.5 degrees below the horizon), NOT Roy,
  NOT fixed minutes.
- `src/zmanim/decisions-2026-11-01.js`: binding decisions from
  Hanoch 2026-11-01 23:06. Candle lighting is 18 minutes before
  sunset, NOT Roy default 20 (Toldot anchor: Friday sunset 4:40
  PM minus 18 = candles 4:22 PM). Shema Magen Avraham is equal
  minutes, NOT Roy seasonal (Toldot anchor: 8:35 AM).
- `src/firebase/firebase-config.example.js`: placeholder config shape only,
  NO real keys, plus Firestore collection and security-rule intent.
- `src/assets/logo-4k-transparent.png` and `src/assets/logo.svg`: the
  official Or Hachaim logo, copied verbatim, never redrawn, recolored,
  cropped, or altered.

## Screen rules implemented

- Daily zmanim in plan order: Alot (equal minutes), Talis and Tefillin,
  Netz, Shema Magen Avraham (equal minutes), Shema Gra, Tefillah, Chatzot,
  Mincha Gedola, Plag, Shkiah, Tzeit.
- Next zman is highlighted.
- Netz window: a small window in addition to Netz time, starting 5 minutes
  before Netz, disappearing after Netz. This is the only time window of
  this kind on the screen.
- Hide-after rule: each zman disappears 5 minutes after it passes, for
  that day.
- Shabbat-adapted screen: from Shabbat entry to Shabbat exit, weekday-only
  items (donation QR placeholder and payment text) are hidden. A Shabbat
  preview toggle on the screen is provided for demo and testing.
- Screen account, decision 4: the TV screen runs on a DEDICATED
  synagogue viewer account, screen-read-only, NEVER the super
  admin account. No finance, no admin, no editing from the
  screen. Super admin hanochhason@gmail.com is management only.
  This supersedes the earlier note about a super admin profile
  on the screen device.
- Burn-in prevention, decision 7: the screen content shifts
  gently (a few pixels, every 5 minutes in this scaffold) to
  protect a TV that runs 24/7. On Shabbat and on holidays there
  is NO movement at all, including this shift. Entering Shabbat
  preview removes any shift at once.
- Hebrew and English only.
- Clock: device clock with seconds in this demo. In the live phase the
  screen will state its sync source honestly as client clock sync; this
  demo makes no stronger sync claim.
- Rotating center: one zone at a time, rotating through the plan's YES
  boards only (announcements, parsha and haftarah per Edot HaMizrach,
  special Shabbatot, Rosh Chodesh and Shabbat Mevarchim and Molad, shiur
  schedule, Hayom Yom, daily halacha 365, seasonal prayer insertions,
  fast start and end detail, Hanukkah candle lighting with candle count,
  animated digital Hanukkiah, Kiddush Levana window per Edot HaMizrach,
  Eruv Tavshilin reminder, Diaspora Yom Tov adaptation, holiday customs
  board, festive Shabbat and Yom Tov screen styling, Mazal Tov,
  hazkarot and condolences, Kiddush and Seudah Shlishit sponsors,
  Parnas Hayom and Ner LaMaor, Seudah Shlishit donor, rabbi message and
  Shabbat blessing, date-windowed flyers, date-windowed sponsorships,
  permanent Leilui Nishmat dedication, campaign and magbit board).

## Zmanim source rule, final, Hanoch 2026-11-02

All times from Zemaneh Yosef, using the unmodified code
in `royzmanim-code/`, except Shabbat ends, which stays
only per MyZmanim with our own 8.5 degree angle module
in `src/zmanim/shabbat-ends.js`. Central rule and
configurable values live in `src/zmanim/source-rule.js`.
OPEN QUESTION, not decided: Hanoch has not confirmed
whether the final rule overrides the two earlier
decisions, candle 18 minutes and Shema Magen Avraham
equal minutes, or whether they stay in force. Until he
confirms, those decisions are KEPT, not silently switched
to Roy defaults (candle 20, Shema seasonal), and the
equal-minutes validation is kept, not deleted.
Haskama note: a haskama image received 2026-11-02 from
Rav Yitzchak Yosef, Rishon Lezion, for the Zemaneh Yosef
calendar itself is recorded in
`validation/torah-approval-packet.md`, section 1A. It is
NOT approval of this screen implementation.

## Times and the Shabbat ends placeholder

Sample Toldot anchor, labeled SAMPLE on the screen: candles 4:22, Netz
6:43, Shema 8:35 and 9:11, Chatzot 11:40, Plag 3:37, Shkiah 4:39, Shabbat
ends 5:23, Rabbeinu Tam 5:52. All other times on the sample day are labeled
demo calculation, NOT Roy output, until the validation task lands.

Shabbat ends: the real module is built by the parallel validation task and
lands in `src/zmanim/shabbat-ends.js`. It must be angle-based (8.5 degrees
of the sun below the horizon), computed for every date, NOT a Roy value
and NOT fixed minutes after sunset. The placeholder in that file throws
until the real module lands, so no invented Shabbat ends value can leak
into production code from this scaffold.

## Foundation, critical review 2026-11-01 23:11

See src/engines/FOUNDATION.md. Four independent engines:
Zmanim, Display, Financial, Identity and Permissions. No new
features are added until the foundation gates pass: security
rules tested with test users, daily automatic backup with an
off-Firebase copy and a tested full restore, idempotency for
every financial action, full-year times validation plus a Torah
authority approval, system-enforced Shabbat safety, offline
fallback that never goes blank, preview before publishing,
pledge versus charge versus payment distinction, annual report,
and fault log with automatic monitoring. Pledges are in
src/data/test-data.js, states in src/engines/finance-states.js,
idempotency in src/engines/idempotency.js, Shabbat safety in
src/engines/shabbat-safe.js, validation gates in
src/engines/validation-gates.md.

## Firebase-ready, not connected

Firestore collections (planned): congregants, ledger entries, prayer
times, announcements, dedications, sponsors, yahrzeits, flyers, users and
roles. Storage for images and graphics.

Security-rule intent (draft in `src/firebase/firestore.rules`, not
deployed, no project created yet): super admin is
hanochhason@gmail.com only, management only. The super admin
chooses each gabbai's permissions: finance only, times and screen
only, or both. A gabbai touches only the collections their permission
covers. A congregant, signed in with Google using the email added to their
existing record, reads only their own record and its ledger entries. The
screen viewer account reads screen content only and never reads
finance data. Ledger entries, nedarim, and activity log entries can
be created but never updated or deleted, by anyone.

Firebase project: NOT created in this task. Creation is authorized
by Hanoch (2026-11-01 23:06) when needed, free as far as possible,
under hanochhason@gmail.com. That authorization does not cover a
paid project; a paid tier still needs a separate decision.

## How to run locally (static server, no build step)

From this folder:

```
cd ~/workspace/or-hachaim-site
python3 -m http.server 8000
```

Then open: `http://localhost:8000/screen/index.html`,
`http://localhost:8000/admin/index.html`,
`http://localhost:8000/finance/index.html`,
`http://localhost:8000/congregant/index.html`.

No build, no install, no keys. If a page is opened as a plain file instead
of through the server, relative paths still resolve, but the server route
above is the supported one.

## Ledger worked example (TEST Congregant One)

Charges: 180 + 120 = 300. Payments: 100 + 50 = 150.
Balance owed: 300 - 150 = 150. Verified by the totals function in
`src/data/test-data.js` and shown on the finance and congregant pages.

## NOT yet done (checklist)

- [x] Live GitHub repo: CREATED by Hanoch, https://github.com/office212/or-hachaim, owner office212, Public, README only, no code pushed yet. Local codebase is ready to push to this repo later. Do NOT push via the GitHub connector (it returned 401 before); pushing goes through the browser session when Hanoch approves that step.
- [ ] Code push to office212/or-hachaim: PRE-APPROVED by Hanoch 2026-11-01 22:54, for validated code with test data only, without asking again for the push itself. Scope does NOT cover go-live, real lists, or a paid Firebase project. Push via the browser's signed-in GitHub session, not the connector.
- [ ] Live Firebase project (not created; creation authorized by Hanoch 2026-11-01 23:06 when needed, free as far as possible, under hanochhason@gmail.com; no paid tier covered)
- [ ] Google login wiring (placeholder only)
- [ ] Roy engine integration (demo and sample data only for now)
- [x] Shabbat ends module (real module in src/zmanim/shabbat-ends.js; the placeholder note above was stale and is corrected here)
- [ ] Real gabbai list, real congregant list, real prayer times (all arrive only after verification, per the plan)
- [ ] Go-live, public sharing, or any real data import (none done, none claimed)
