# Cloud Functions source (project or-hachaim)

Source of truth: exported 2026-11-05 from the Google Cloud Console Source tab
of the two deployed Gen 2 services. The files in `setUserClaims/` and
`dailybackup/` are verbatim console source. Do not edit them to match their
headers; the headers are stale (see below). No secrets live in this folder:
only env var names (`BACKUP_BUCKET`; `DRIVE_BACKUP_FOLDER_ID` appears only
in the old design text inside `dailybackup/README.md`).

## What is deployed

- `setUserClaims/` — HTTP, us-east1, Node 20 as deployed (its `package.json`
  moved to Node 22 on 2026-11-06; live only after a redeploy). Deployed 2026-11-02 21:34.
  Caller must be exactly hanochhason@gmail.com with a valid Firebase ID
  token. Never creates an Auth user, never grants super admin, never
  changes the caller's own claims. Sets ohFinance / ohScreen /
  ohScreenViewer / ohScreenEdit / ohImageUpload + ohRoleVersion, and
  mirrors the grant in the `users` doc. CORS allowlist is the five site
  origins in the code (the two old orhachaimcong.org origins are still
  in it; removing them is a separate approved step).
- `dailybackup/` — scheduled `0 3 * * *` America/New_York, us-east1,
  Node 20 as deployed (its `package.json` moved to Node 22 on 2026-11-06;
  live only after a redeploy). Deployed 2026-11-02 15:31. Runs verified 2026-11-03 and
  2026-11-04 03:00. Exports 10 collections to
  `or-hachaim-backup-YYYY-MM-DD.json` in the bucket from env
  `BACKUP_BUCKET`, and writes one `backupRuns` doc per run (status ok /
  failed). The collection is `backupRuns`, not `backups`.

## Stale text inside these files (do not "fix" by editing the code)

- Both `index.js` headers and `dailybackup/README.md` say "DRAFT, not
  deployed". That was true when written and is outdated now: both
  services are live and serving since 2026-11-02, and this folder is
  the export of what the console shows for them.
- `dailybackup/README.md` still describes the original Google Drive
  plan in its design section; the "Change 2026-11-02" section at its
  end records the owner decision to use the Cloud Storage bucket
  instead. The Drive folder stays empty for manual super-admin exports
  only. The README line saying the run writes a "backups" record is
  also stale: the code writes `backupRuns`.

## Deploy

Firebase CLI or the console only. GitHub Pages serves this repo
statically and never runs these functions. A redeploy from here must
use the same project, region and entry points (`setUserClaims`,
`dailyBackup`), and the `BACKUP_BUCKET` env var must be set for
`dailybackup`.
