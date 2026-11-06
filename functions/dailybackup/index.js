// Or Hachaim cloud backup, called by the Cloud Scheduler job
// "dailybackup-daily" (03:00 America/New_York). The live function is an
// HTTP function named "dailybackup" (lowercase). The repo once held an
// onSchedule DRAFT named "dailyBackup" that was never deployed, and
// deploying it fails with 409 because the Cloud Run service name is
// already taken by the live function. So this file matches the live
// function: onRequest, lowercase name, same handler.
// Destination: Cloud Storage bucket, NOT Google Drive, because a service
// account has no Drive storage quota. Runs in Firebase Cloud Functions
// with default credentials (Admin SDK). No API key, no secret, no bucket
// name hard-coded here.
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { Storage } = require("@google-cloud/storage");

admin.initializeApp();
const db = admin.firestore();
const storage = new Storage();

/* Fix (2026-11-06, after the repo review): the list said "recurringCharges",
   a collection that does not exist (the site writes recurringSchedules), and
   left out the screen content, the settings documents (Shabbat sheet, TV
   texts, landing texts, the Shabbat times on the TV) and members' yahrzeit
   requests. Now the same collections as the manual backup page (backup/),
   so a nightly file holds everything the restore page (restore/) can bring
   back. Each document keeps its id as "id" (restore/ reads "id" or "_id"). */
const COLLECTIONS = [
  "congregants", "ledgerEntries", "operationIds", "pledges", "recurringSchedules",
  "nedarim", "activityLog", "prayerTimes", "announcements", "dedications",
  "sponsors", "flyers", "yahrzeits", "yahrzeitRequests", "settings", "backups", "users",
];

async function exportCollections() {
  const collections = {};
  const counts = {};
  for (const name of COLLECTIONS) {
    const snap = await db.collection(name).get();
    collections[name] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    counts[name] = snap.docs.length;
  }
  return { collections, counts };
}

/* Fix (2026-11-06): the run failed with 500 because the upload could call
   delete, and the backup's own service account (or-hachaim-backup) has only
   roles/storage.objectCreator on the bucket, no delete. In
   @google-cloud/storage 7.x, file.save() is createWriteStream() plus end();
   the one delete on that path is the after-upload checksum check
   (File#validateIntegrity: on a mismatch it deletes the object "as a
   precaution"), which runs only when validation (crc32c or md5) is on, and
   crc32c is on by default. Here: a direct createWriteStream with
   validation: false, so the client never calls delete. A plain, single-request
   (non-resumable) upload; same file name, same content type.
   Note: Cloud Storage itself asks for storage.objects.delete to REPLACE an
   object that already exists. The 03:00 run writes a new name each day, so it
   only needs create; a second run on the same day (a manual re-run) still
   needs delete on the bucket to overwrite that day's file. */
async function uploadToBucket(fileName, jsonText) {
  const bucketName = process.env.BACKUP_BUCKET;
  if (!bucketName) throw new Error("BACKUP_BUCKET is not set");
  const file = storage.bucket(bucketName).file(fileName);
  await new Promise((resolve, reject) => {
    const stream = file.createWriteStream({
      resumable: false,
      validation: false,
      contentType: "application/json",
    });
    stream.on("error", reject);
    stream.on("finish", resolve);
    stream.end(jsonText);
  });
  return `${bucketName}/${fileName}`;
}

exports.dailybackup = onRequest(
  { region: "us-east1" },
  async (req, res) => {
    const date = new Date().toISOString().slice(0, 10);
    const fileName = `or-hachaim-backup-${date}.json`;
    try {
      const { collections, counts } = await exportCollections();
      const payload = {
        exportedAt: new Date().toISOString(),
        exportedBy: "cloud-scheduled-backup",
        collections,
        counts,
      };
      const jsonText = JSON.stringify(payload, null, 2);
      const bucketPath = await uploadToBucket(fileName, jsonText);
      await db.collection("backupRuns").add({
        date, status: "ok", fileName, bucketPath, counts,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      res.status(200).json({ ok: true, fileName, bucketPath, counts });
    } catch (err) {
      const message = String(err && err.message ? err.message : err);
      try {
        await db.collection("backupRuns").add({
          date, status: "failed", fileName, error: message,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (e) { /* recording the failure must not hide the response */ }
      res.status(500).json({ ok: false, error: message });
    }
  }
);
