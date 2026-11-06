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

async function uploadToBucket(fileName, jsonText) {
  const bucketName = process.env.BACKUP_BUCKET;
  if (!bucketName) throw new Error("BACKUP_BUCKET is not set");
  await storage.bucket(bucketName).file(fileName).save(jsonText, {
    contentType: "application/json",
    resumable: false,
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
