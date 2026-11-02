/* Firebase config EXAMPLE ONLY. No real keys. Do not paste real keys here.
   Copy this file to firebase-config.js in the Firebase phase and fill it
   from the Firebase console, or load it from a private deploy step.
   Login is Google only (Firebase Auth). NOT connected yet. */
window.FIREBASE_CONFIG_EXAMPLE = {
  apiKey: "PASTE_FROM_FIREBASE_CONSOLE_IN_FIREBASE_PHASE",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000000000"
};
/* Firestore collections (planned, not created):
   - congregants: { name, phone, email (optional), createdBy, createdAt }
   - ledgerEntries: { congregantId, date, type: charge|payment|correction,
       amount, description, enteredBy, createdAt, source: neder|recurring|manual }
       (append-only; never update, never delete; see firestore.rules)
   - nedarim: stored as ledger entries with source neder and an aliyah
   - recurringSchedules: { congregantId, name, amount, period:
       monthly|annual, status: active|cancelled, nextDue }
       (pausing or cancelling stops future charges only; past ledger
       entries are never deleted)
   - activityLog: { when, who, action, area: congregants|permissions|
       ledger|recurring|tax|backup } (append-only; never update, never delete)
   - backups: { exportedAt, by, recordCount } (metadata only; the
       export file itself is downloaded, never public)
   - prayerTimes: { nameHe, nameEn, time, order, updatedBy, updatedAt }
   - announcements, dedications, sponsors, flyers { from, to }, yahrzeits
   - users: { email, role: superAdmin|gabbai, permissions: finance|screen|both,
       screenViewer: true only for the dedicated screen viewer account }
   Storage: images/graphics uploaded by gabbaim with screen permission.
   Security-rule intent (draft in firestore.rules, not deployed):
   - Super admin is hanochhason@gmail.com only, management only;
     super admin chooses each gabbai's permissions: finance only,
     times/screen only, or both.
   - A gabbai may read/write only the collections their permission covers.
   - A congregant, signed in with Google using the email the super admin
     added to their existing record, may read ONLY their own congregant
     record and its ledger entries, nothing else.
   - The TV screen runs on a DEDICATED synagogue viewer account,
     screen-read-only, NEVER the super admin account. That account
     reads prayer times, announcements, dedications, sponsors,
     flyers and yahrzeits only. It never reads finance data, never
     edits anything, and has no admin access.
   - Finance backup is a day-one requirement: full export from the
     start, plus a periodic export in the Firebase phase. See
     backup-design.md. */
