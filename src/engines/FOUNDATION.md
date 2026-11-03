# Foundation, 2026-11-01 critical review

This file is the boundary contract for the scaffold. It is a
foundation requirement, not a future improvement. No new features
are added until the foundation below passes its gates.

## Four logically independent systems

- Zmanim Engine: calculations, calendar, and times only. Files:
  src/zmanim/*, validation/*, src/engines/validation-gates.md.
  It never writes finance data and never decides permissions.
- Display Engine: the TV screen and its content only. Files:
  screen/*, src/theme.css. It reads screen content only, never
  finance data, never user roles.
- Financial Engine: accounts, pledges, charges, payments, and
  reports only. Files: finance/*, src/engines/finance-states.js,
  src/engines/idempotency.js, src/firebase/backup-design.md.
  It never changes a time calculation and never changes a
  design token except through the theme layer.
- Identity and Permissions: users, permissions, and security
  only. Files: src/firebase/firestore.rules, admin permission
  notes. It never computes a balance and never renders a screen.

A design change must not affect the ledger. A time calculation
change must not break finance. A permission change must not
change a time. Each engine is tested separately.

## Gates before go-live, all must pass

1. Security rules tested with test users in the emulator or
   rules tester, including: finance gabbai cannot edit his own
   permissions, screen gabbai cannot read finance, the public /tv/
   page cannot read finance, congregant cannot read or write another
   congregant, congregant cannot change a balance, duplicate
   operationId is rejected.
2. Backup: daily automatic backup exists, a copy exists outside
   Firebase, and a full restore test has passed and is logged.
3. Idempotency: double submission with the same operationId
   records one entry only, in code and in rules.
4. Times: full-year validation (winter, summer, DST, standard
   time, holidays, fasts, method-difference dates) and a Torah
   authority approval. No unverified time is displayed live.
5. Shabbat safety: weekday-only content is hidden by the system
   on Shabbat and Yom Tov, preview shows the Shabbat view, and
   the screen never goes blank offline.
6. Finance states: pledge, charge, payment, and open balance are
   distinct in code, rules, and reports. Annual report and tax
   letters are separate documents, with deductible portion
   confirmed by a gabbai before a real tax letter is issued.

No real data is imported until all gates pass.
