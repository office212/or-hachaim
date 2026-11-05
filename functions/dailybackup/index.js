// Or Hachaim cloud scheduled backup. DRAFT v2, not deployed yet in this form.
// Destination changed 2026-11-02 by owner decision: Cloud Storage bucket,
// NOT Google Drive, because a service account has no Drive storage quota.
// Runs in Firebase Cloud Functions with default credentials (Admin SDK).
// No API key, no secret, no bucket name hard-coded here.
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const { Storage } = require("@google-cloud/storage");

admin.initializeApp();
const db = admin.firestore();
const storage = new Storage();

const COLLECTIONS = [
  "congregants", "ledgerEntries", "prayerTimes", "operationIds", "users",
  "pledges", "recurringCharges", "activityLog", "nedarim", "backups",
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

exports.dailyBackup = onSchedule(
  { schedule: "0 3 * * *", timeZone: "America/New_York", region: "us-east1" },
  async () => {
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
    } catch (err) {
      await db.collection("backupRuns").add({
        date, status: "failed", fileName, error: String(err && err.message ? err.message : err),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      throw err;
    }
  }
);
