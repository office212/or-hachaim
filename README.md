# Or Hachaim Congregation Site

## What this is

The website of **Or Hachaim Congregation**, a Sephardic congregation in
Staten Island, New York.

It has two parts that share one codebase and one Firebase project:

1. **An always-on shul screen.** A public, no-sign-in TV page that
   shows the day's zmanim, the community's davening times, and gabbai
   published content (announcements, dedications, flyers, yahrzeits,
   images). It is built for a landscape 16:9 television, runs 24/7, and
   reloads its data every 60 seconds.
2. **A gabbai finance platform.** Member records, an append-only
   ledger (charges, payments, corrections), balances computed from the
   ledger, fast neder entry, recurring charges, annual tax letters, an
   annual report, an activity log, and a personal dashboard for each
   member. A signed-in person who is not a member yet can send a
   join request from the site.

**Live site:** https://orhachaimsi.org/
**Repository:** https://github.com/office212/or-hachaim (public, branch `main`)
**Hosting:** GitHub Pages (static frontend) + Firebase (Firestore
database, Google Auth, Cloud Storage for images, Cloud Functions for
claims and backup). There is no custom server.
**Address:** 321 Harold St, Staten Island, NY 10314.
**Public contact email:** orhachaimcong@gmail.com.

Design language: light Jerusalem stone, navy (#0e2c4c), thin gold
lines, no red or burgundy, Hebrew first, then English. One language is shown at a time.
The official congregation logo (`src/assets/logo-4k-transparent.png`)
is never altered.

## Page map

All addresses are in clean directory form (no `index.html` in any link
or shared address). GitHub Pages serves each folder's `index.html`
automatically.

| Path | Who can use it | What it is |
|---|---|---|
| `/` | Everyone (public) | Landing page. No davening times or zmanim on the landing. A signed-in gabbai sees one button to the gabbai system; a member sees "My Account". Public hero button links to `/tv/`. |
| `/tv/` | Everyone, no sign-in | The public TV screen. No sign-in/out button, no internal links. Loads only daily zmanim data, community davening times, and published screen content. |
| `/privacy/` | Everyone (public) | Privacy policy, Hebrew and English. Not linked from any page yet; reachable only by its direct address. |
| `/gabbai/` | Signed-in gabbaim and members, by role | Gabbai home. Tiles for screen content, davening times, finance, nedarim, reports, activity, and account, shown by role. The super admin also sees a "Join requests (N)" alert here. A signed-in person who is not a member yet is sent to the join screen instead. |
| `/gabbai/shabbat/` | Signed-in gabbaim (screen) | The Shabbat sheet ("לשבת הזאת"): the printable weekly bulletin, edited per Shabbat, plus the extended bulletin behind a button. |
| `/gabbai/settings/` | Signed-in gabbaim (screen texts, permissions, backup moved here) | Settings page. |
| `/gabbai/activity/` | Super admin only | Activity log: every action, with when and who, filterable by area. |
| `/gabbai/tv/` | Signed-in content gabbaim and super admin | Davening times editor and the TV texts editor (every heading and word on the TV, block order), each with a live TV preview. |
| `/gabbai/tv/content/` | Signed-in content gabbaim and super admin | Screen content editor: announcements, dedications, sponsors, flyers, yahrzeits, with a TV preview (weekday and Shabbat) before publishing. Also has the command bar. |
| `/gabbai/landing/` | Super admin only | Landing page wording editor (`settings/homeTexts`), with a live preview of `/`. |
| `/admin/` | Super admin (user management); content gabbaim see the command bar | User management (grant/revoke gabbai roles) and the broadcast notification form. The editors that used to live here moved to `/gabbai/tv/`, `/gabbai/tv/content/` and `/gabbai/landing/` on 2026-11-05; their scripts still sit in `admin/` (see Repository layout). |
| `/finance/` | Finance gabbaim and super admin | Member list and cards, ledger, neder fast entry, recurring charges, tax letters, annual report, backup export. Writes to the activity log as it goes, but does not show it (see `/gabbai/activity/`). The super admin also sees join requests and role controls here. |
| `/congregant/` | Signed-in member (own record only) | "My Account": the member's own balance and history. A signed-in person who is not a member yet sees only the join request screen here. |
| `/backup/` | Finance gabbaim and super admin | Download a full backup file (JSON) of all finance data. Changes nothing. |
| `/restore/` | Finance gabbaim and super admin | Restore from a backup file. Step 1 is always a dry run (no writes); step 2 imports missing documents only and never deletes or overwrites. |

Deleted on purpose: the old gated `/screen/` page was removed on
2026-11-03. Its shared files (`screen/screen.css`, `screen/content.css`,
`screen/content-board.js`, `screen/screen.js`) stay in the repo because
`/tv/` loads them. Do not recreate a gated screen page without a new
owner decision.

### A note on the original plan

The original plan called for a dedicated read-only screen account and
a gated screen page. Both were superseded: the viewer role was
abolished, the gated `/screen/` page was deleted, and `/tv/` is public
with no sign-in. The plan also once listed a "screen viewer" grant; the
current grant payload intentionally carries `screenViewer: false`.
Treat this README, not the early plan sections, as the current account
of access.

## Roles and permissions

Sign-in is **Google only**, via Firebase Auth. There is no password
login of the site's own.

### Roles

- **Super admin.** One account, management only:
  `hanochhason@gmail.com`, the email the Firestore rules check for
  (`isSuperAdmin()`, verified-email required since the 2026-11-05
  hardening) and the same email `functions/setUserClaims` and
  `functions/notifications`' broadcast function require. Only the
  super admin writes `users` documents, grants or revokes roles,
  approves or declines join requests, changes a member's status,
  and deletes uploaded images.
- **Finance gabbai** (`finance`). Members, ledger, nedarim,
  recurring charges, tax letters, reports, backup, restore. No screen
  content, no davening times.
- **Content and Times gabbai** (`screen`). Davening times, screen
  content, TV texts, Shabbat sheet. No finance data, in any form.
- **Both** (`both`). Finance plus content and times.
- **Image upload.** A separate flag, granted only together with
  content and times. It controls who may upload images to Storage.
- **Member** (`member`). Own dashboard and history only, plus
  read-only davening times and announcements as the rules allow. No
  finance tools, no admin tools, no other member's data.
- **Signed-in, not a member yet.** May send exactly one join request
  (see below) and nothing else.

### How roles are stored and granted

Roles live in two places that must agree:

1. **Firebase Auth custom claims** (`ohFinance`, `ohScreen`,
   `ohImageUpload`), set by the deployed `setUserClaims` Cloud
   Function. The function only accepts calls from the super admin,
   never grants super admin, and never creates an Auth user. That
   means a new gabbai must **sign in once with Google first** (so the
   Auth user exists), then the super admin grants in `/admin/`, then
   the gabbai **signs out and signs back in** to refresh the token.
2. **`users` documents in Firestore**, written by the super admin
   only. The rules also accept a `users` document as a fallback, so a
   gabbai whose claims have not refreshed yet can still be recognised
   from their document.

If a role is granted before the person has ever signed in, the grant
is recorded as pending and the claims grant must be repeated after
their first sign-in. Nothing retries it automatically.

Changing a gabbai to plain `member` revokes their claims **and
deletes that email's `users` documents**. The member record and
the ledger are untouched; only gabbai access is removed. Use it
knowingly: it is the one delete in the members system.

### Role checks in the app

Pages do not check "signed in" alone. A role resolver decides what
the signed-in user may open, and gated pages redirect anyone without
the role. An old or unknown Google account with no `users` document
and no member record gets nothing.

## Firestore rules philosophy

The rules are the central security layer, not a backup for the UI.
A client-side check can be bypassed; the rules cannot, for normal
client calls. The live rules file is `src/firebase/firestore.rules`
(the repo copy) and the same text published in the Firebase console.
Storage rules are `src/firebase/storage.rules`. Default is deny.

Key rules, in plain language:

- **Append-only ledger.** `ledgerEntries` can be created by finance
  gabbaim and the super admin, and **never updated or deleted by
  anyone, including the super admin**. A mistake is fixed by a new
  correction entry with a signed amount, never by editing or deleting
  the original.
- **No member delete.** `congregants` has `allow delete: if
  false` for everyone, including the super admin. There is no delete
  button for a member anywhere in the site. Test names must never
  be added to test a live save; only real people who need adding.
- **Idempotency.** Every financial action carries a unique
  `operationId`. The `operationIds` collection allows create only
  when the id does not exist yet, and never update or delete, so a
  double tap, a retry, or a resend after a disconnect is recorded
  once.
- **Finance vs. status fields.** Finance gabbaim create and edit
  member records as before, but they may not touch status or
  audit fields (`status`, `approvedBy`, `approvedAt`, `declinedBy`,
  `declinedAt`, `inactiveBy`, `inactiveAt`, `activeBy`, `activeAt`).
  A finance-created record is active (no status, or status
  `"active"`) and carries no audit field. Only the super admin writes
  those fields.
- **Member statuses.** A member record has no status (every
  record written before stage D counts as active), or `"active"`,
  `"pending"` (a join request), `"declined"`, or `"inactive"`.
  Pending and declined records never appear in the finance member
  list; inactive members appear only behind "Show inactive".
  Inactive members still receive tax letters; join requests do not.
  Only active members are offered for a new neder.
- **A member reads only their own record**, by signed-in Google
  email, and only its ledger entries. A member cannot list records
  and cannot reach another record by changing an id.
- **Davening times are public to read** (the TV needs them with no
  sign-in). Creating, editing, and deleting them requires content
  and times permission.
- **Screen content** (announcements, dedications, sponsors, flyers,
  yahrzeits) is public to read only when `status` is `"published"`.
  Drafts and archived items are readable only by content gabbaim and
  the super admin. Writes need content permission; deletes need the
  super admin.
- **Settings documents** are split by purpose, each with its own
  block and key allowlist: `settings/screenTexts` (TV wording,
  content gabbaim), `settings/homeTexts` (landing wording, super
  admin only), `settings/shabbatSheet` (Shabbat sheet, content
  gabbaim). The generic `settings/{docId}` block still lets the super
  admin alone write any settings document in any shape (Firestore
  ORs matching blocks); that is accepted and unchanged.
- **Images.** Storage path `screen/{type}/{itemId}/{file}`, images
  only (JPG, PNG, WebP), under 5 MB, upload requires content
  permission **and** the image-upload flag, delete is super admin
  only. There is no public read rule: the TV shows an image through
  the download URL saved in the published document. The backup bucket
  is guarded separately and is never writable from the site rules.
- **Pledge vs. charge vs. payment vs. open balance are four
  distinct states, never conflated.** A neder fast entry first
  creates a pledge; converting it creates a ledger charge; only
  charges and payments move the open balance. An unpaid pledge is
  not income.
- **Tax letters are separate from balance reports.** A balance
  report is not a donation receipt, and no letter may claim every
  payment is deductible. The gabbai confirms the deductible amount
  before any real letter is issued.
- **A ledger entry is shape-checked on the server, not only in the
  UI.** A create must carry exactly the allowed fields (member,
  date, type, amount, description, who entered it, operation id,
  source, server timestamp, and, optionally, a payment method,
  pledge id, or aliyah), the amount must fit the type (plus for a
  charge or payment, plus or minus for a correction, never zero),
  and the date must be a real date no more than one day in the
  future. The one-day allowance is for time-zone slack, not a loophole.
- **A member's email, once on their record, cannot be changed or
  removed by a finance gabbai.** Finance may add an email to a
  record that has none yet; only the super admin may move a record
  to a different email. This stops a balance from silently landing
  on the wrong Google account.
- **A check that trusts an email requires a verified one.**
  `isSuperAdmin()` and every "this is my own record" check now also
  require `email_verified` on the sign-in token, not just a matching
  address.
- **The activity log is read by the super admin only.** Finance and
  content gabbaim still write to it as they act, exactly as before;
  only the super admin reads it back, at `/gabbai/activity/`. Every
  entry must carry the signed-in person's own email and uid and the
  server's own time, never a value the client supplies.
- **Restore** (`/restore/`, super admin only) is its own rules path:
  a restored document must keep its original fields and add only
  `restored`, a server-timestamped `restoredAt`, and `restoredBy`
  (the super admin's own uid).
- **Push notification data is two collections, and nothing else
  changed to add them.** `notificationTokens/{uid}` (a person's own
  device registration) is readable and writable only by that
  person; `notifications/{id}` (one row per person per
  notification) is created only by the Cloud Functions below, never
  by any client including the super admin, and the one change a
  person may make to their own item is marking it read.

## Join requests

A signed-in person who is not a member yet can ask to join, from
`/congregant/` (and from the gabbai home, which sends them there):

1. They fill in full name and phone and press "Send request". They
   see "Request sent. The gabbai will approve soon."
2. The request is a `congregants` document with id `join_` + their
   Auth uid, exactly five fields (name, phone, email, status
   `"pending"`, createdAt), their own verified sign-in email, name
   2-80 characters, phone 7-30 characters. The rules allow exactly
   that shape, once. The requester cannot edit it afterwards, cannot
   approve themselves, cannot set a role, and cannot read anyone
   else's request.
3. The super admin sees "Join requests (N)" on the gabbai home and
   in `/finance/`, presses Approve, and picks a role in one tap
   (member, times gabbai, finance gabbai, or both). Approving sets
   the record active with `approvedBy`/`approvedAt`; declining sets
   it declined. The person then signs in again and sees their
   account. A finance gabbai opening `/finance/` sees no requests
   and no role buttons.
4. **Resend after decline (stage D2).** A declined person sees
   "Request not approved" with a "Send request again" button. The
   form reopens with their name and phone prefilled, and sending
   returns the same document to `"pending"` with a new createdAt.
   The old `declinedBy`/`declinedAt` stay on the document, which is
   how the super admin sees a small grey "Sent again" tag on the
   request card. A declined person may resend after every decline.
   There is still exactly one document per person, never two open
   requests.

## Zmanim: sources and decisions

All times follow **Zemaneh Yosef** (RoyZmanim, Sephardic, after Rav
Ovadia Yosef), except Shabbat ends, which follows **MyZmanim**.
No "Roy" label and no source label is shown next to times on the
site; sources live in code only. The haftarah shown is Sephardi
only, for this Sephardic community.

Binding decisions (owner-set, do not change without the owner):

- **Candle lighting:** 18 minutes before sunset (not the Roy
  default of 20).
- **Sof Zman Shema, Magen Avraham:** equal minutes (not Roy's
  seasonal value).
- **Shabbat ends:** MyZmanim Nightfall, 3 stars, angle-based (8.5
  degrees), not a fixed number of minutes. A minute late is
  acceptable; a minute early is not.
- **Rabbeinu Tam:** 72 zmaniyot after Shkiah, rounded **up**,
  for Shabbat and for Yom Kippur. This replaced the earlier basis
  (the MyZmanim column) by owner decision on 2026-11-04. Yom Kippur
  alone can be switched back to the MyZmanim column value if the
  owner asks.
- **Holidays** behave like Friday/Shabbat but carry **no** Rabbeinu
  Tam, unless the holiday falls on Shabbat or it is Yom Kippur.
- **Yom Tov immediately after Shabbat:** candle lighting is after
  Nightfall when Shabbat ends, not after Rabbeinu Tam.
- **Calculation by rule is acceptable** even where it is not written
  in a source, per the rabbi's answers relayed by the owner.

Daily zmanim, in display order (11): Alot, Earliest Talis/Tefillin,
Netz, Sof Zman Shema (Magen Avraham), Sof Zman Shema (Gra), Sof Zman
Tefillah, Chatzot, Mincha Gedola, Plag (Halacha Brurah), Shkiah,
Tzeit. Shabbat adds Friday candle lighting, Shabbat ends, and
Rabbeinu Tam. Community davening times are separate database data,
edited by gabbaim, never calculated.

Display behaviour: a small Netz countdown appears from 5 minutes
before Netz and disappears after Netz. Each zman disappears 5
minutes after it passes. The Hebrew date, on both the TV and the
landing page, turns at shkiah rather than at midnight (added to
both on 2026-11-05, the same rule and the same daily file), dropping
the weekday after it turns; checked once a minute, so a page left
open also turns on time without a reload. DST switches
automatically (America/New_York), the content shifts gently against
burn-in except on Shabbat and holidays (when it does not shift at
all), and an offline fallback keeps showing the last data with a
"last updated" stamp instead of a blank screen.
Weekday-only items (payment text, donation QR, weather if ever
added) are hidden automatically on Shabbat and Yom Tov by the
system, not by gabbai memory.

### Data files

- `src/zmanim/roy-daily-5787.json`: the live daily file, 385 days
  (2026-09-12 to 2027-10-01), including candle-lighting (18 min)
  and angle-based Shabbat ends, plus Saturdays only carrying
  MyZmanim Shabbat-ends and Rabbeinu Tam column values. The
  **displayed** Rabbeinu Tam now comes from the 72-zmaniyot
  function (`src/zmanim/rabbeinu-tam.js`), not from that column,
  and it shows only on days whose record carries a Rabbeinu Tam
  field.
- `src/zmanim/source-rule.js`, `src/zmanim/decisions-2026-11-01.js`,
  `src/zmanim/shabbat-ends.js`: the binding deviation rules.
- `src/calendar/`: the calendar engine, haftarah data, and
  date-windowed content rules. `src/tv/sunset-5787.json` holds
  sunset seconds per date, used only for sunset-relative davening
  rules.
- Coordinates used: the shul, 321 Harold St, Staten Island, NY
  10314 (lat 40.60155, lon -74.13206), America/New_York.

### The 5788 gate (still closed)

There is **no 5788 daily file live**. A 5788 model exists only in
development packages: Shabbat ends and Rabbeinu Tam computed by
MyZmanim's own rules with a 5-second safety window (values within
5 seconds of a minute boundary are moved one minute later, so
nothing is ever early). It stays gated until: the real MyZmanim
5788 PDF arrives, a dry-run replacement script swaps all model
values for real ones, a never-early recheck passes, and the owner
approves. Do not upload any 5788 file before that.

Reminder (2026-11-06): 30 days before the last day in the daily
files, the gabbai home shows the super admin an alert ("זמני היום על
המסך נגמרים בעוד N ימים") naming the file to upload
(`src/zmanim/roy-daily-5788.json`). The TV already loads that file
by itself once it exists, and the alert goes away on its own
(`src/ui/oh-alerts.js`, `checkDataEnd`).

## Features by area

### TV screen (`/tv/`)

Three columns on a 16:9 board: daily zmanim plus a Shabbat/holiday
block on one side (Shabbat ends and Rabbeinu Tam appear only in
that block, shown Friday all day until 5 minutes after Rabbeinu
Tam; after Tzeit the column shows tomorrow's zmanim labelled
"tomorrow's zmanim"), gabbai-entered davening times on the other
side, and the community board in the centre with an insertions
strip on top, a thin "next zman" strip (Netz countdown inside it
only), and a rotating centre board. The bottom bar shows the name
and address fixed, with permanent dedications in a slow ticker.
Donation/Zelle/QR boards are weekday-only rotating boards.
Placeholder welcome/dedication/halacha texts show until a gabbai
enters real content; that is by design, not a bug. A signed-in
check of the TV preview exists in `/gabbai/tv/content/` (exact TV preview
before publishing).

**Davening times on the TV (2026-11-06).** All Friday the list shows
Friday's rows under "ערב שבת" and then the whole Shabbat schedule under
"שבת" (people check the Shabbat times on Friday; before, Shabbat's
rows appeared only from candle lighting). A prayer of today leaves the
list one hour after its time (Mincha at 3:00 is gone at 4:00;
`GONE_AFTER_MIN` in `tv-live.js`); Shabbat's rows shown on Friday stay.
When nothing is left today, tomorrow's rows show under "מחר". Times
show without AM/PM.

### Davening times editor (`/gabbai/tv/`)

Community davening times are Firestore documents (`prayerTimes`:
Hebrew name, English name, time, order, updated by/at). The editor
groups them into weekday (Sun-Thu) and Friday/Shabbat sections.
The "לסדר" (sort) box assigns a time to weekday, Friday, or
Shabbat with one tap, which writes only the rule, and every sort
row carries a quiet blue Delete button that uses the same confirm
and delete path as every other row (davening-time rules only, never
members). The command bar accepts plain sentences: a time
with no days is never saved, the bar asks "מתי?" (when?) with day
chips and a date picker and does not confirm until a day is
chosen, and "כל השבוע" (all week) saves the same time on Friday
and Shabbat with full rollback if an extra save fails. All writes
go only through the davening-time save/update/delete functions.
No sorting of davening times by time was ordered by the owner; the
list order comes from the `order` field.

### Screen content editor (`/gabbai/tv/content/`)

Announcements, dedications, sponsors, flyers, and yahrzeits, each
with a date window (shown only between its dates), status
(draft/published/archived), and a TV preview before publishing.
Yahrzeit is entered once and recurs automatically every year in
its week. Images upload through the Storage rules above. Editor
writes go to the existing collections (no separate screen-items
collection) and history goes to `activityLog`.

### TV texts and landing texts editors (`/gabbai/tv/`, `/gabbai/landing/`)

Every word on the TV and on the landing page is editable: TV texts
at `/gabbai/tv/` by content gabbaim (`settings/screenTexts`),
landing texts at `/gabbai/landing/` by the super admin only
(`settings/homeTexts`),
each in Hebrew and English, up to 400 entries per map. The
landing page itself shows no davening times or zmanim
(`PUBLIC_ZMANIM` is off); turning it on is a separate owner
decision.

### Shabbat sheet (`/gabbai/shabbat/`)

The printable weekly bulletin ("לשבת הזאת"), stored in
`settings/shabbatSheet`: per-week overrides (`weeks`, up to 60
weeks) and rows kept for every week (`regular`, up to 30 rows).
Rows have order arrows, text size in steps that always fit the
page, a star, and hide/restore. The sheet draws from the system
zmanim and from davening-time documents for Friday/Shabbat, shows a
suggestion (grey time) where a row has no source, and exports
JPG/PDF client-side (canvas, no server round-trip, no outside
service) with a "clean for print" option. The background artwork
and logo are part of the sheet assets (`src/shabbat-sheet/`).
Changes made here apply to this Shabbat only unless marked for
every week.

**"שבת שלום לקהילה" (2026-11-06, super admin only).** A box on the
Shabbat package page sends the community this Shabbat's times exactly as
the sheet prints them (this week's changes included), the Kiddush
sponsors and this week's yahrzeits: a short line to every member's bell
and the full text by email to every active member with an email. A
confirm box shows the whole message first; a second send in the same week
asks again. It calls `sendBroadcast` (functions/notifications) with
`email: true`: the function writes one `mail/broadcast-<id>-<member>`
document per member, which `functions/sendMail` sends. Live:
`sendBroadcast` with the email option was redeployed by Hanoch on
2026-11-06 at 07:17 (New York time) through Cloud Shell and checked in
the console;
the first real send is the live proof of the email part.

**On the TV (2026-11-06).** "הצג בזמני התפילות במסך" puts this
sheet's davening, learning and added rows (shown rows with a time;
candle lighting, Shkiah, Shema and Shabbat ends stay out, since the
TV computes those) into `settings/shabbatScreen.weeks[<shabbat>]`
as `{ friday, rows: [{ he, en, time, min, day: "fri" | "sat" }] }`
(`OH_SHEET.screenRows`). The TV (`tv-live.js` →
`prayer-rules.js` `ctx.sheet`) then shows them **instead of** the
regular davening times: on that Friday the regular morning rows
(before noon) and then the sheet's Erev Shabbat rows; on that
Shabbat only the sheet's rows. Once it is on, every saved change to
the sheet updates the TV as well; "הפסק להציג במסך" takes it off.
After that Shabbat the TV is back to the regular times by itself;
past weeks are pruned on the next write (at most 12 weeks kept).
The document is public read (the TV has no sign-in) and written by
content gabbaim and the super admin only, exactly these keys
(`firestore.rules`, `match /settings/shabbatScreen`; tested in
`src/firebase/rules-tests/test.mjs`, section 7). Hanoch published the
rules on 2026-11-06 at 07:08 (New York time); a signed-out read of
the document answers 200, as the rule says.

### Finance (`/finance/`)

Since 2026-11-06 the page opens on the simpler finance screens
(`src/ui/oh-fin.js`, `src/ui/oh-finance.css`, from the demo Hanoch
approved). Five tabs: home, payment, nedarim, who owes, members
(added 2026-11-06). Each view
has its own address (`#pay`, `#charge`, `#nedarim`, `#owes`,
`#members`, `#m-<member id>`, `#more`; `#reports` opens "more" at the
annual report):

- **Home**: search by name or phone, three big buttons (record a
  payment, Shabbat nedarim, who owes), this month's collected
  total, the open balance, and the last entries.
- **Payment / charge**: one screen. Pick the member, the amount
  (quick amounts, and "full balance" for a payment), how they paid
  (cash, check, Zelle, card, transfer) or what the charge is for,
  an optional note, today's date or an earlier one. The balance
  before and after shows before saving. After saving, "בטל" undoes
  it and "קבלה" shows a receipt to print. The member's bell gets
  the payment notice on its own (`functions/notifications`,
  `onLedgerPayment`) when the member has an account.
- **Shabbat nedarim**: every aliyah in one table (פתיחת ההיכל to
  מפטיר), extra rows with their own name (הגבהה, גלילה, מי שברך...),
  and a separate box for pledges that are not aliyot (קידוש, סעודה
  שלישית, אירוע בבית הכנסת, or free text). A check screen, then one
  save. Each line is its own ledger charge with its own operationId:
  a neder carries `source: "neder"` and the aliyah, a pledge carries
  its details in the description. If some lines fail, the rest stay
  saved and pressing again saves only what is missing. The date is
  the last Shabbat on or before today (never a future date).
- **Who owes**: members with a balance, largest first, with the
  phone and the last payment date.
- **Member card**: balance, "+ תשלום" / "+ חיוב", the full history,
  print statement, CSV, and (super admin) role and inactive
  controls. **"ביטול"** never edits or deletes (the ledger is
  append-only): it writes a `correction` of the opposite sign whose
  description starts with `ביטול [<operationId>]`, operationId
  `void-<operationId>` (one cancellation per entry, ever). The
  original stays in the history, marked "בוטל". No rules change.
- **Edit details** (2026-11-06): "עריכת פרטים" on the member card
  lets a finance gabbai or the super admin fix the member's name and
  phone (a Google account name is not always the real name).
  `OH_FIREBASE.updateCongregantDetails` writes only `name` and
  `phone`; the email is shown but never changes there (the rules
  already let finance edit name and phone and lock an existing
  email; tested). One activity-log line, old → new.
- **Members** (`#members`, 2026-11-06): every member task in one
  place. Search by name or phone; "+ מתפלל חדש" opens the page's own
  add form (`addCong`: email required, the duplicate-email and
  same-person warnings) right in the tab; join requests with
  approve/decline for the super admin (`OH_MEMBERS`; the gabbai home's
  link `finance/#ohJoinReqs` opens this tab, and the finance home shows
  a "בקשות הצטרפות (N)" line); "הצג לא פעילים"; each row shows "לא
  פעיל" or "אין מייל" and opens the member card. These page parts keep
  their own state and are parked in `#fnPark` while another view is
  drawn.
- **More** (`#more`): tax letters, annual report, backup, unchanged
  (adding a member moved to the Members tab).

The details below still hold:

- Member list with search, member card, balance computed
  from the full ledger, printable balance statement and CSV
  export. A credit shows as "זכות: $X" in green; a zero balance
  shows "אין חוב ✓"; only an actual amount owed shows as a plain
  balance due (2026-11-05).
- Add a member with or without email. A member without
  email is fully managed here and cannot sign in until the super
  admin adds an email to the same record; history and balance are
  preserved. Duplicate email is refused.
- Ledger entries: date (today by default, any past date allowed for
  a payment entered after the fact, never a future date - blocked
  both in this form and, since 2026-11-05, by the rules
  themselves), amount, description, entered by, type (charge,
  payment, correction), source (manual, neder, recurring), and, on
  a payment only, a payment method (cash, check, Zelle, card, bank
  transfer, or none given), shown in the ledger row and totalled on
  the annual report. Choosing "card" today only records the word;
  it does not yet take a card (see "Donations and balance payment"
  below). Amounts are stored as dollars with 2 decimals and summed in
  whole cents; dates are New York dates.
- Neder fast entry for Motzei Shabbat: now the Shabbat nedarim
  screen above (all aliyot and pledges, one save), idempotent.
- Recurring charges: monthly or annual membership fees posted
  automatically on schedule with deterministic ids, so a schedule
  never double-charges. Pausing or cancelling stops future charges
  only; past ledger entries are never deleted.
- Annual tax letters (January, 501c3): one letter per member, from
  a dedicated print area. The gabbai confirms the deductible
  amount; which payments count as deductible is an owner decision
  that must be recorded before real letters go out.
- Annual financial report: total income, total charges, open
  balances, payments by method, unpaid pledges.
- Backup export: one JSON file that attempts every collection the
  rules define (members, ledger, pledges, recurring schedules, the
  activity log, screen content, backups, users). A collection the
  signed-in person cannot read - the activity log, for anyone but
  the super admin, since 2026-11-05 - is listed as "not read"
  instead of failing the whole export. Export files are financial
  data: never public.

### Activity log (`/gabbai/activity/`)

A single audit trail, separate from every other page: every
permissions change, member edit, ledger entry, join-request
decision, screen-content action, davening-time edit, text change,
and Shabbat-sheet edit, each with when, what, and who did it.
Newest first, 50 lines at a time ("טען עוד"), filterable by area
(finance, members, permissions, join requests, screen, times,
texts, Shabbat sheet, backup). The super admin only; anyone else
sees "אין הרשאה", and the rules refuse the read either way. Lines
written before this page existed are shown with their original
Hebrew sentence.

### Member dashboard (`/congregant/`)

Own balance, own history, own card only. If no record matches the
signed-in email, the page says so and shows nothing else.

**Family yahrzeits (2026-11-06).** Under the card, "יארצייטים של
המשפחה": the member adds a yahrzeit (name, relation, Hebrew day and
month, optional year; a Gregorian date can be turned into the Hebrew
date, with "after sunset") and sees each one's status: waiting for the
gabbai, on the TV in its week, or not approved. A pending one can be
cancelled. A request is `yahrzeitRequests/{id}` (`src/ui/oh-yahrzeit.js`,
`firestore.rules` `match /yahrzeitRequests`): created only by the member
for their own record, read by them and by content gabbaim. On
`/gabbai/tv/content/` a content gabbai sees "בקשות יארצייט ממתפללים
(N)" above the list (the gabbai home's alerts strip points there).
"אשר והצג במסך" saves a published public yahrzeit item with id
`yzreq-<request id>` through the usual screen-content path (shown on the
TV in its week, every year, like one added by hand), then marks the
request approved. Nothing reaches the TV without that approval.
The rule is live since 2026-11-06, 07:08 (New York time), when Hanoch
published the rules file with all three new rules (`shabbatScreen`,
`tvDisplay`, `yahrzeitRequests`).

### Backup and restore (`/backup/`, `/restore/`)

Manual export/import as above, plus the automatic cloud backup:
a Cloud Function (`dailybackup`) and a scheduler that runs it
every day at **03:00 America/New_York**, writing a dated JSON file
to a private Cloud Storage bucket (`or-hachaim-backups`) that has
no public permission. The backup account holds only the roles it
needs on that bucket. A Drive folder of the same name is kept
empty for manual super-admin exports only. Restore is tested
periodically; backup files are never published to the site.

### Install as an app (2026-11-05)

Every page except `/tv/` (which keeps its own, older service
worker, unchanged) loads one shared app-shell service worker
(`sw-app.js`, scope `/`) through `src/pwa/pwa-app.js`. It does two
things only: makes the site installable, and shows a push
notification when one arrives. It never touches sign-in, Firestore,
or Google's own domains, and it never caches a page or its data,
only one offline fallback page (`offline.html`) for when the
network fails - so sign-in and every balance shown are always
fresh, never a stale cached copy. Since 2026-11-06 it also asks
the server "changed?" for the site's own `.js`, `.css` and `.json`
files on every load (a 304 "not changed" costs a few bytes), so a
phone picks up a new upload at once instead of mixing a new page
with a script or stylesheet from before the upload; it still stores
nothing. `manifest.webmanifest` and the
icon set let Chrome, Edge, and iOS offer "install" or "add to home
screen". On a signed-in page (never the public landing, which keeps
its own top bar) a one-time popup offers the install the first time
it becomes possible, shown once and remembered in the browser;
after that, a small footer link ("התקן אפליקציה") offers it again
any time it is still possible, and disappears once installed or on
a page where it is not.

### Signing in on iPhone (2026-11-05)

Google sign-in tries a popup first everywhere (`/finance/`,
`/gabbai/` and its sub-pages, `/admin/`, `/congregant/`, `/backup/`, `/restore/`, and
the landing page). Inside an installed, standalone app on iPhone,
and in a few other environments, a popup can silently fail to open;
sign-in now falls back to a full-page redirect for exactly the
error codes that mean a popup will not work there, so sign-in
completes either way. A real sign-in failure (not someone closing
the picker on purpose) now shows one short line instead of silence.

### Web push notifications (2026-11-05)

A bell in the top bar of every signed-in page offers "הפעל
התראות" (enable notifications); once allowed, the same bell shows
unread items with a badge and a short list, newest first, with a
mark-all-read button. Behind it, five Cloud Functions in
`functions/notifications/` (Node 22, region us-east1, deployed on
its own the same way as the two older functions - see "Cloud
Functions deploys" below):

- `onLedgerPayment` - a new ledger entry notifies finance gabbaim
  and the member it belongs to.
- `onJoinRequestWrite` - a new join request notifies finance
  gabbaim; its approval or decline notifies the person who asked.
- `onPrayerTimeWrite` - a davening-time change notifies content
  and times gabbaim.
- `onAnnouncementWrite` - a newly published announcement notifies
  content and times gabbaim and members.
- `sendBroadcast` - an HTTPS function the super admin's broadcast
  form calls, to notify everyone at once; checked the same way as
  `setUserClaims` (a verified Firebase token, the email checked in
  code).

Who gets notified is decided at send time from each person's
current custom claims, never from anything saved when they turned
notifications on, so a role change takes effect at once; the super
admin gets everything, by design. The data behind this is two new
Firestore collections (see "Firestore rules philosophy" above for
their rules): `notificationTokens/{uid}` for a person's own device
registration, `notifications/{id}` for the bell's items. The Web
Push "VAPID" key lives in `src/ui/oh-shell.js`. This has not yet
been confirmed received on a real phone or browser from this side;
there is no automated test for it yet.

## Repository layout

```
index.html                  Landing page
CNAME                       orhachaimsi.org (never overwrite)
manifest.webmanifest        PWA manifest (name, icons, colors)
sw-app.js                   App-shell service worker (installability + push)
offline.html                Offline fallback page (sw-app.js only)
icons/                      App icons (manifest + apple-touch-icon)
privacy/                    Privacy policy, Hebrew and English (not linked
                            from any page yet)
tv/                         Public TV screen (+ its own, older service worker)
gabbai/                     Gabbai home
gabbai/settings/            Settings page
gabbai/shabbat/             Shabbat sheet screen
gabbai/activity/            Activity log (super admin only)
gabbai/tv/                  Davening times + TV texts editor page
gabbai/tv/content/          Screen content editor page
gabbai/landing/             Landing wording editor page (super admin only)
admin/                      User management + broadcast form (page), and
                            the editor scripts the gabbai/ pages load:
  prayer-times.*            Prayer times list, sort box, styles (gabbai/tv/)
  content-editor.*          Announcements/dedications/flyers/yahrzeits/sponsors
                            (gabbai/tv/content/)
  tv-texts-editor.js        TV wording editor (gabbai/tv/)
  home-texts-editor.js      Landing wording editor (gabbai/landing/)
                            These scripts build relative links ("../../tv/")
                            for the page that loads them: a page moved to
                            another folder depth needs its links checked.
finance/                    Finance platform (single page app)
congregant/                 Member dashboard / join screen
backup/  restore/           Manual backup export / restore import
screen/                     Shared screen files loaded by /tv/
                            (the gated screen page itself is deleted)
functions/                  Cloud Functions source (see functions/README.md)
  setUserClaims/            Role grants, HTTP. package.json: Node 22
                            (2026-11-06); the live service stays Node 20
                            until it is redeployed
  dailybackup/              Nightly Cloud Storage backup, scheduled.
                            Same: package.json Node 22, live Node 20
                            until redeployed
  notifications/            Web push + in-app bell, 5 functions, Node 22;
                            sendBroadcast can also queue emails (Nov 6)
  sendWelcomeEmail/         One welcome email per new member (writes mail/)
  sendMail/                 Sends every mail/ document by Gmail SMTP
src/firebase/               firebase-app.js (role resolver, all Firestore calls)
                            firestore.rules, storage.rules (repo copies)
                            firebase-config.js (LIVE config, never push a
                              redacted or example config over it)
                            screen-content.js, backup-design.md
src/ui/                     labels.js (all UI words, Hebrew + English)
                            oh-home.js (gabbai home + tiles)
                            oh-members.js/css (members, join requests, roles)
                            oh-cmdbar.js, oh-command.js (command bar + parser)
                            oh-activity.js (activity log page)
                            oh-design.css, oh-shell.js (top bar, bell,
                              install popup, VAPID key), oh-shabbat.js, ...
src/pwa/                    pwa-app.js (install signal + service worker
                            registration; no UI of its own)
src/zmanim/                 Daily data + deviation rules + Rabbeinu Tam
src/calendar/               Calendar engine, haftarah, content data
src/engines/                display-engine, finance-states, idempotency,
                            shabbat-safe (Shabbat hiding), FOUNDATION.md
src/tv/                     TV texts, day state, sunset data, prayer rules
src/shabbat-sheet/          Sheet core, drawing, editor, background, logo
src/assets/                 Official logo, local fonts, stone textures
src/home/                   Landing texts + home logic
validation/                 Zmanim validation evidence (do not overwrite)
```

## Deploying changes

There is no build step and no CI deploy. Every change is a file
upload plus, when rules change, a console publish. The owner's
standing rules for this repo:

1. **Use the browser's signed-in GitHub session** (web editor /
   upload), not a connector push, to avoid approval cards. Never
   run two push tasks on the same repo at once.
2. **Rules first, then files.** When a package changes rules, verify
   the currently published baseline first (version/time and the
   blocks it must contain), paste the full new rules text into the
   Firebase console editor (there is no file import; if the editor
   cannot load a granted file, paste the exact text), publish, and
   verify the new version before uploading any file. Publish
   Firestore rules only, or Storage rules only, as the package
   states; never open the other one "while you are there".
3. **One commit per file**, verifying each file's content after its
   commit before moving on. New files first, then changed files,
   unless the package says otherwise.
4. **Verify from live, not from the commit list.** After upload,
   check the Pages deployment (Actions run for the head commit)
   and then check the live pages. GitHub Pages can serve the
   previous deploy for minutes after a successful build, and a
   browser can serve a stale cached copy long after that. When a
   live check shows old content after a successful deploy, start a
   **fresh browser task/tab** rather than reloading the same
   windows, and confirm the new file is actually on the CDN
   (fetching the file URL directly) before calling anything a
   defect. The owner's phone view settles cache doubts.
5. **Check before approving.** Every package is diffed file by
   file against the live head before upload: hashes against the
   package manifest, forbidden scope (rules, config, functions,
   billing, domains, DNS, grants, 5788, backups, viewer roles),
   and a rollback that reproduces the live head exactly. Package
   test counts are the author's, not independently re-run here
   (no Java/Firebase CLI in the checking environment); emulator
   suites are quoted as claimed.
6. **No silent changes to site copy or counts.** Review counts,
   schema numbers, and public wording change only on the owner's
   word.

### Cloud Functions deploys

Functions are not part of the GitHub Pages file upload above: they
deploy separately, from the Firebase console or the Firebase CLI,
project `or-hachaim`, region `us-east1`. `functions/README.md` is
the source of truth for what is actually deployed, and each
function folder's own `package.json` states its Node version.
`setUserClaims` and `dailybackup` are deployed on Node 20; Google
stopped accepting new Node 20 deploys on 2026-10-30 and is retiring
the runtime. Their `package.json` files were moved to Node 22 on
2026-11-06 (the same dependency versions `notifications` already
deploys with on Node 22), but **the live services change only when
each is redeployed** from its folder. Until then they still run on
Node 20. After a redeploy: check that `setUserClaims` still grants a
role, and that the next 03:00 run writes a `backupRuns` document with
status ok. If the deploy complains about `firebase-functions` or
`firebase-admin` versions, bump those too. `notifications` (the five push functions) is already on
Node 22 and is not affected.

### Rollback

Each package ships a rollback zip that restores the changed files
to their pre-package versions (and deletes any new files it
lists). Rollback is: upload the rollback files, republish the
rollback rules if the package changed rules, and verify the head.
Rollback restores code and rules only; data created under the new
code stays in the database (for example, a join request sent
under stage D still shows under the old code as a member in the
finance list, so approve or decline anything pending before
rolling back). A rollback built against the wrong base is
dangerous: it can wipe a later live stage. Always verify the
rollback's "before" hashes against the actual live head first.

### Never overwrite, never do

- `CNAME` content (orhachaimsi.org).
- `firebase-config.js` (the live config). Never push the example
  or a redacted config over it. The local copy in some checkouts
  is stale and must never be pushed.
- The official logo (`src/assets/logo-4k-transparent.png`).
- `src/zmanim/roy-daily-5787.json` (the live daily file). Never
  replace it with a model, a recomputation, or a 5788 file without
  the 5788 gate (above) passing.
- `validation/` evidence.
- Never present test data as real. Test items are labelled test
  and are removed before real data goes in.
- Never delete a member, a ledger entry, or an operationId.
- Never grant super admin to anyone. Never grant a role to an
  account that has not signed in once, except as a recorded
  pending grant to be repeated after sign-in.
- Never re-enable auto-renew on the old domain orhachaimcong.org
  (one year only, intentionally off; it forwards to orhachaimsi.org).
- Never connect a domain to a test-data site.
- Never log out of the owner's accounts after a task; scheduled
  checks and browser work depend on staying signed in.
- Never ship a redesign without the actual approved demo file in
  hand, and never reinterpret an approved demo generically; copy
  its treatments exactly.

## Current status, 2026-11-06

Live HEAD: **`87ad210`** (a Pages-redeploy trigger commit; the last
content commit is `9350efc`, the Node 22 switch for the
notifications functions). Live domain orhachaimsi.org, Enforce
HTTPS on. The old domain orhachaimcong.org forwards (temporary
redirect, no path forwarding) to orhachaimsi.org.

Stages live, in order:

- **Stage 2** (2026-11-03): content editor writing to the existing
  collections, published-only public reads, Storage rules with
  claims-based image upload.
- **Stage A** (2026-11-03): gabbai home at `/gabbai/`, unified top
  bar, phone bottom bar ("Home | Davening times | Sign out").
- **Stage B1** (2026-11-04): davening-times editor rebuild, delete
  permission for content gabbaim.
- **2040 phase 1** (2026-11-04): new Firestore block
  `settings/screenTexts`, TV wording indirection, gabbai settings
  and Shabbat pages, sunset-relative davening rules, chametz zmanim.
- **2040 phase 2** (2026-11-04): new block `settings/homeTexts`
  (landing editor, super admin only), weekday vs. Friday/Shabbat
  davening-time sections, command-bar parser improvements, sign-out
  returns to the landing page.
- **Shabbat sheet** (2026-11-04): new block
  `settings/shabbatSheet`, the sheet screen, and the Rabbeinu Tam
  72-zmaniyot basis change (owner's own change).
- **Combined package v2** (2026-11-04): upgraded sheet (original
  background, sunset-based suggestions, text size, row order),
  working finance "Add member" save, blue Delete button in the
  "לסדר" sort box, command-bar "מתי?" flow. (v1 of this package
  was discarded: its rollback was built against the wrong base
  and would have wiped the Shabbat sheet stage.)
- **Stage D** (2026-11-04): members, join requests, and roles
  (members block change, join-request flow, role controls,
  inactive members).
- **Stage D2** (2026-11-04): resend after decline (one new rules
  rule, "Send request again" with prefilled form, "Sent again"
  tag).
- **Text cleanup** (2026-11-04): short one-line hints, one
  language at a time, developer notes removed, English for
  מתפלל uniformly "member". Second-language lines are hidden by
  CSS, not deleted from page source.
- **Hardening** (2026-11-05): additive-only rules checks (ledger
  entry shape, a verified email required for email-based checks, a
  member's existing email locked against finance, restore as its
  own checked path), calendar-engine vendor license files added,
  and the rules-tests suite updated to match.
- **Functions exported to the repo** (2026-11-05): `functions/`
  now holds the console source of the two already-deployed
  functions (`setUserClaims`, `dailybackup`) plus
  `functions/README.md` describing what is actually live; no
  function code changed by this, only its source being checked in.
- **Privacy page** (2026-11-05): `/privacy/`, Hebrew and English,
  not yet linked from any page.
- **Datefix v2** (2026-11-05): the Hebrew date on both the TV and
  the landing page now turns at shkiah instead of midnight, checked
  every minute so an already-open page turns on time too.
- **Activity log** (2026-11-05): a dedicated page,
  `/gabbai/activity/`, super admin only, separated out of the
  general finance/screen read access it used to share.
- **Today's combined package** (2026-11-05): install as an app
  (manifest, app-shell service worker, a one-time install popup
  after sign-in, a footer link), a sign-in redirect fallback for
  iPhone's installed-app browser, a payment-method field on ledger
  payments, a hard stop (UI and rules) on a future-dated ledger
  entry, and web push notifications by role with an in-app bell and
  a super-admin broadcast (`functions/notifications`, 5 functions,
  Node 22; two new Firestore collections). See "Install as an app",
  "Signing in on iPhone", and "Web push notifications" above, and
  the Finance section for the payment method and date limit.

- **TV / landing split** (2026-11-05, fixes1): the old `/admin/`
  editors split into `/gabbai/tv/` (times + TV texts),
  `/gabbai/tv/content/` (screen content) and `/gabbai/landing/`
  (landing wording); `/admin/` keeps user management and the
  broadcast form. Follow-up fix: the content page's TV preview and
  "open the screen" links pointed one folder too shallow, and the
  command bar stylesheet was missing there.
- **2026-11-06**: the 30-day reminder before the daily zmanim
  files run out (see "The 5788 gate"); the site's own question
  boxes (`OH_UI.ask` / `OH_UI.tell` in `src/ui/oh-ui.js`) in place
  of the browser's `confirm()` / `alert()` in the content editor and
  user management; fresh `.js` / `.css` / `.json` after every upload
  (`sw-app.js` v3); one unescaped error text in user management
  escaped.
- **Finance screens** (2026-11-06, PR #4): `/finance/` opens on the
  simpler screens (home, payment, Shabbat nedarim with pledges, who
  owes, member card with "ביטול" as a correction). See "Finance".
- **Members** (2026-11-06, Hanoch): an email is required when a
  gabbai adds a member, with a duplicate warning and a link on
  approve; a welcome email goes out once per member
  (`functions/sendWelcomeEmail` writes to `mail`, `functions/sendMail`
  sends it through Gmail SMTP; the Trigger Email extension is not
  used).
- **TV night dim** (2026-11-06, Hanoch): off by default; the super
  admin turns it on in `/admin/` ("תצוגת טלוויזיה"), stored in
  `settings/tvDisplay` (public read, super admin write).
- **TV and the Shabbat package** (2026-11-06, PRs #6 and #7): the
  package's times on the TV instead of the regular ones
  (`settings/shabbatScreen`); "רבינו תם" without "(המוקדם)"; times
  without AM/PM; the whole Shabbat schedule all Friday; a prayer
  leaves the list an hour after its time.
- **Community** (2026-11-06, PR #8): "שבת שלום לקהילה" (bell + email,
  super admin) and family yahrzeits sent by members and approved by a
  content gabbai (`yahrzeitRequests`).

Checked from outside on 2026-11-06 after the merges: GitHub Pages
deployed main (`48318b7`); every signed-out read of the live database
answers as `firestore.rules` says (open: `prayerTimes`, published
screen items, `settings/screenTexts`, `homeTexts`, `tvDisplay`,
`shabbatScreen`; closed: members, ledger, users, activity log, mail,
notifications, `shabbatSheet`, `yahrzeitRequests`, drafts). The rules
suite passes in the emulator (156). Write rules and the redeployed
functions can only be proven with a signed-in use (see "Still open").

Real data entered by the owner himself: the live community davening
times, as read from the database on 2026-11-06: Mincha 4:27 PM on
Friday and Shacharit 8:30 AM on Shabbat (no weekday times yet, so
after Shabbat the TV shows "אין זמני תפילה עדיין" until there are).
The final gabbai list is granted and
re-sign-in verified.

### Still open (genuinely, not placeholders)

- **Real member list not yet entered.** Names, phones, emails
  where known, and opening charges/payments. Members can be
  added without email and given dashboard access later by adding
  the email to the same record.
- **Finance "Add member" live save untested by design.** It is
  verified in code only; it will be tested when a real person
  needs adding, never with a test name, because a member
  cannot be deleted.
- **5788 times file gated** (see "The 5788 gate" above): real
  MyZmanim PDF, dry-run replacement, never-early recheck, owner
  approval. Nothing uploaded yet.
- **Donations and balance payment: plan only, nothing built.**
  Provider: **Sola Payments (Cardknox)**, merchant application
  pending. Shape: Sola's hosted PaymentSITE (card data is entered
  only on Sola's page), opened from "Donate Now" buttons, a QR on
  the TV, and "Pay my balance" on the member dashboard, with amount,
  name, email and member id (`xInvoice`) prefilled in the link.
  The payer's email receipt comes from Sola (`xCustReceipt`). The
  balance updates only from Sola's signed webhook (Webhook PIN,
  `ck-signature` header) received by a Firebase Cloud Function in
  this project (already on Blaze); the redirect back to the site is
  never treated as proof of payment. Order: Sola sandbox, build and
  test the function and buttons with test cards, deploy the function
  once, then go live. Binding rules: no card data ever in
  Firestore, donation button/payment links/QR hidden automatically
  on Shabbat and Yom Tov, a successful payment creates exactly one
  ledger entry with `operationId = xRefNum` (Sola's reference),
  failed/declined payments create none, refunds are correction
  entries, and the donor tax receipt is a separate document that
  never claims every payment is deductible. Zeffy and Stripe were
  earlier options and are no longer the plan. As an interim step
  (2026-11-05), a ledger payment can now carry a free-text payment
  method (cash, check, Zelle, card, bank transfer); choosing "card"
  today only records the word, it does not take a card - that
  still waits on Sola.
- **Two old test suites are stale.** The B1 suite expects the
  pre-phase-2 davening-times page (an add button and edit on every
  row) and the Shabbat sheet suite fails 9 checks (mostly an empty
  Arvit row); both fail the same way on the untouched live head, so
  they no longer measure anything and should be updated before they
  are relied on.
- **Physical TV check pending.** The TV has not been verified on
  the shul's own television, including the Netz countdown
  window near Netz and the full Shabbat block on Shabbat itself.
- **Owner-side role checks pending.** Content gabbai publishing
  an announcement and a flyer with an image (the live proof of
  the image-upload claim), finance-only admin view, per-role
  gabbai-home tiles, and the Shabbat sheet edit/star/PDF/share
  checks.
- **Holiday Shabbat logic.** Friday-night Shabbat logic covers
  candle lighting onward, but holidays are not yet fully covered
  by that logic.
- **Final setUserClaims CORS cleanup.** Removing the two old-domain
  origins from the function allowlist is a separate, approval-gated
  step.
- **`setUserClaims` and `dailybackup` must be redeployed on Node 22.**
  Their `package.json` files say Node 22 since 2026-11-06, but the live
  services are still the Node 20 deploys of 2026-11-02 until each is
  redeployed (Google closed new Node 20 deploys 2026-10-30 and is
  retiring the runtime). See "Cloud Functions deploys" above.
- **First live use of the 2026-11-06 features** (not testable from
  outside without a real sign-in): record one real payment on the new
  finance screen and cancel it; a member sends a yahrzeit and a content
  gabbai approves it; "שבת שלום לקהילה" once (bell items arrive, and
  the `mail/broadcast-...` documents reach `delivery.state: SUCCESS`);
  ("הצג במסך" in the Shabbat package is already proven live: on
  2026-11-06 Hanoch turned it on for Shabbat Chayei Sarah and the
  document holds that sheet's six rows, Mincha 4:30 to Arvit 6:00).
- **TV offline alert** (approved 2026-11-06, waiting until a TV is
  in the shul): the TV reports "alive" every few minutes through a
  server function, and the super admin gets a bell item when it has
  been silent for 30 minutes.
- **Privacy page is not linked from the site.** `/privacy/` exists
  and works but no page points to it yet.
- **Web push notifications are not yet confirmed received** on a
  real phone or browser; the code and rules are in, there is no
  automated test for the send path yet.
- **PUBLIC_ZMANIM flip** (showing zmanim on the landing page)
  remains a separate owner decision; it is currently off.
- **Firebase Hosting custom-domain migration (Level 2)** is
  relevant in principle but not decided; do not migrate now.
- **Rabbi questions from the 2040 package:** the owner reports
  they are already answered and will be folded into a later
  package; the answers themselves have not been delivered in
  this channel, so they are not recorded here.

## For a new gabbai-developer

Start here, in order:

1. Read this README and the plan file (the plan holds the long
   YES/NO/Later feature lists and the original design direction;
   where they disagree with this README, this README describes
   what is live).
2. Open the live site as each role in turn (super admin, finance
   gabbai, content gabbai, member, signed-out) and compare
   what each sees against the page map above.
3. Before touching anything, clone the repo, check the head
   commit, and diff your package against it file by file.
4. Never edit live data to test. The only safe live tests are
   the ones that create nothing (viewing, opening and closing
   dialogs without saving) or that the owner explicitly approves
   with a real person (join requests, real member adds).
5. When in doubt, ask the owner. A "no" from the owner is final;
   a green-looking answer is not approval until the owner says
   so explicitly after the check report.
