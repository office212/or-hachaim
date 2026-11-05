# Finance backup, from day one, foundation requirement

Decision 5, Hanoch, 2026-11-01 23:06, strengthened by the critical
review 2026-11-01 23:11: finance backup starts on day one, not at
go-live (not deferred to phase 7). Append-only alone is NOT a
backup. A CSV export occasionally is NOT enough. This design is
part of the finance scaffold from the start.

Status (2026-11-05): the automatic daily backup runs. The Cloud Function
`dailybackup` runs every day at 03:00 America/New_York and writes a dated
JSON file to the private bucket `or-hachaim-backups` (see README, "Backup
and restore").

## What is backed up

Every backup export contains, in full:
- All congregant records (name, phone, email if present).
- All ledger entries (date, type, amount, description, entered-by,
  operationId, source such as neder or recurring charge, when present).
- All pledges, with status (unpaid, converted to charge, paid).
- All recurring charge schedules (amount, period, status).
- All activity log entries (who changed what and when).
- All neder records, when stored separately from ledger entries.
- Backup records themselves (when an export ran, by whom or by
  schedule, how many records, restore test result).

A backup is never a partial export of only the current balances.
Balances are always recomputed from the full ledger, so a backup
without the full ledger cannot restore a correct balance.

## How it runs, foundation standard

- Automatic daily backup, in the Firebase phase, scheduled by a
  server-side function, not by a person remembering to click.
- A copy outside Firebase, in a private destination, never public
  and never readable by the public /tv/ page or a content-only gabbai. Today the
  daily file lands in the private bucket `or-hachaim-backups`, inside the
  same Google project; the copy outside Google is a monthly download of
  the newest file by the super admin (see "What is still open").
- Manual export, one click, from the finance page: download the
  full export as JSON and as CSV statement files. This is already
  scaffolded as a mock in finance/index.html (local data only).
- Periodic export record: each automatic backup writes a backup
  record to the backups collection (when it ran, by whom or by
  schedule, how many records, off-Firebase copy location
  reference, no financial data in the reference itself).
- Each backup record is append only (see firestore.rules):
  nobody deletes a backup record.
- Fault log and automatic monitoring, priority high: a missed
  daily backup, a failed export, or a screen offline for a
  sustained period is logged and flagged for the super admin.
  Monitoring is a foundation item, not a later add-on.

## Restore, without breaking append-only, and tested

Restore never deletes, overwrites, or edits an existing entry.
Restore procedure:
1. Verify the backup file (record counts, date range, no
   duplicate operationId already present).
2. Import only entries that are missing from the live database,
   as new entries carrying their original dates, amounts,
   descriptions, operationIds, and entered-by values.
3. If a live entry conflicts with a backup entry, keep the live
   entry and log the conflict in the activity log. Do not
   overwrite it.
4. Recompute every balance from the full ledger after restore
   and compare it with the backup balances before declaring the
   restore complete.
5. Periodic restore test, logged: on a test project, restore a
   backup and verify balances, pledges, and activity log match.
   A restore that has never been tested is not counted as a
   backup capability.

A restore that deletes live data to match a backup is forbidden.
That rule protects the append-only ledger even during recovery.

## What is still open

- The scheduled function runs (dailybackup, 03:00). Its source code
  is not in this repository yet: it is to be exported from the
  Google Cloud console into functions/ (no secrets).
- A copy outside Google: today a monthly manual download of the
  newest backup file by the super admin. An automatic outside copy
  is not built.
- Export files contain financial data and must never be public
  and never be readable by the public /tv/ page or a content-only gabbai.
