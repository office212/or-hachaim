# Or Hachaim cloud scheduled backup (DRAFT, not deployed)

Decision 2026-11-02: cloud scheduled backup, not manual daily work, provided the charge looks very low.
Destination DECIDED 2026-11-02: Google Drive folder "Or Hachaim Backups" in the super admin account (hanochhason@gmail.com), not shared with anyone yet.

## Design (matches the manual backup page and the restore page)

- Runtime: Firebase Cloud Functions v2, scheduled, Node 20, firebase-admin, googleapis.
- Schedule: every day at 03:00 America/New_York.
- Collections exported, in full, never balances only: congregants, ledgerEntries, prayerTimes, operationIds, users, plus pledges, recurringCharges, activityLog, nedarim, backups when present. Missing collections export as empty lists, never fail the run.
- Output file: or-hachaim-backup-YYYY-MM-DD.json, same shape as the manual export:
  { exportedAt, exportedBy: "cloud-scheduled-backup", collections: { <name>: [{ id, ...data }] }, counts: { <name>: n } }
  The existing restore page reads this shape and imports missing documents only, never overwrites live documents.
- Drive upload: to the "Or Hachaim Backups" folder, folder ID from environment variable DRIVE_BACKUP_FOLDER_ID (never hard-coded in code that could be published). The function service account must be shared as writer on that folder first. That sharing needs Hanoch's explicit yes with the exact service account email. No sharing has been done yet.
- Success/failure record: each run writes one document to Firestore collection backupRuns (date, counts, Drive file name, status, error message when failed, no financial data in the record itself). Admin SDK bypasses client Firestore rules, so this write does not change client rules.
- Failure alert: Google Cloud Monitoring alert on function errors, emailed to the super admin (billing admin). The function itself does not send email, so no SMTP secret is needed.
- Restore test: download the Drive JSON, upload it to the existing restore page, dry run then import missing only, recompute balances, compare with backup counts. Periodic test, monthly, as in backup-design.md.
- Cost expectation: daily reads of a few hundred documents at most, one function invocation per day, negligible Drive storage. Expected near $0, like current $0 usage, costs can lag, $1 budget alert already exists. No cost guarantee.
- Security: no API key or secret in code. Code lives here, NOT in the public GitHub Pages repo office212/or-hachaim. Deploy only via Firebase CLI or console, never by pushing this folder to GitHub Pages. Screen viewer account never gets Drive access.

## Status

- Function code drafted (index.js), syntax-checked only, never run against live Firestore, never deployed.
- BLOCKED before deployment: (1) identify the exact Cloud Functions service account email for project or-hachaim via console, (2) Hanoch's explicit yes to share the Drive folder with that exact email as writer, (3) Firebase deployment auth via the browser session.
- Test emails stay as-is until real run, per Hanoch 2026-11-02.

## Change 2026-11-02: destination is Cloud Storage bucket, NOT Drive

Owner decision after cost explanation: bucket destination is effectively free at this usage (5 GB-months, 5,000 uploads, 50,000 downloads per month in us-east1 under Always Free, per published free tier summaries; Blaze billing still required, usage beyond free tier billed, no cost guarantee).
Reason: a service account has no Drive storage quota, so Drive upload fails even when the folder is shared as writer.
Bucket: region us-east1, Standard, uniform bucket-level access, no public access, private to project owner and backup service account only.
Function v2: @google-cloud/storage, env BACKUP_BUCKET, same schedule, same service account, same JSON format, backupRuns record now carries bucketPath instead of driveFileId.
Drive folder "Or Hachaim Backups" remains, empty, for manual super-admin exports only, not for the cloud function.
