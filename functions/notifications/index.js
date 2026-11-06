/* Or Hachaim: notifications (combined package, 2026-11-05, Hanoch approved).
   Web push (Firebase Cloud Messaging) plus the in-app bell. New function
   file, deployed on its own (its own folder, its own package.json, exactly
   like setUserClaims/ and dailybackup/ already are): nothing in those two
   folders is touched or imported by this one, and there is no top-level
   functions/index.js in this repo for this file to be added to (see
   functions/README.md: each function here is its own Gen 2 deploy). If a
   future package ever introduces a shared functions/index.js, these five
   exports are additive only.

   What this file does, and why there are only two new collections:
   - notificationTokens/{uid}: a person's own push registration (which
     browser/device tokens should get a push). The uid is the document id.
     Nothing here decides anything by itself: every send below looks up the
     CURRENT custom claims (admin.auth().getUser) at send time, so a role
     that changed since the token was registered is never stale here.
   - notifications/{id}: one row per person per notification, read by the
     in-app bell (src/ui/oh-shell.js) and never written by any client; only
     this file writes them (the security rules make this literal: client
     create is `false`).
   - Four Firestore triggers (a payment, a join request, a prayer time
     change, a published announcement) plus one HTTPS function the super
     admin's broadcast form calls (sendBroadcast, same auth shape as
     setUserClaims: a verified Firebase ID token, email checked in code,
     not in IAM - see that function's own comment for why).
   - Role targeting, as Hanoch asked (2026-11-05 12:35-12:37 PM): finance
     gabbaim get payments/donations and join requests; content/times
     gabbaim get prayer time changes and announcements; a person with both
     roles gets both (this falls out of the claims check below, nothing
     special needed); the super admin gets everything, always, by design
     (not a bug: he asked for this literally, "סופר אדמין מקבל הכל"); a
     member gets only things from their own dashboard (their own payment,
     new announcements).

   Business logic below (resolveGabbaiUids, resolveMemberUids, deliver,
   deliverToMany, and the four handle* functions, and sendBroadcastHandler)
   takes its db/auth/messaging/FieldValue through one `deps` object instead
   of reading the admin SDK singletons directly, so function/notifications/test/
   can unit-test the routing logic (who gets what) with fake deps and no
   emulator, no network call, and no real Admin SDK credentials. The real
   exports at the bottom wire the same functions to the live Admin SDK. */

const admin = require("firebase-admin");
const { onDocumentCreated, onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onRequest } = require("firebase-functions/v2/https");

const SUPER_ADMIN_EMAIL = "hanochhason@gmail.com";
const REGION = "us-east1"; /* same region as setUserClaims and dailybackup */

/* ---------- who gets what (pure, deps-injected) ---------- */

async function resolveGabbaiUids(deps, { finance, screen }) {
  const uids = new Set();
  const snap = await deps.db.collection("notificationTokens").get();
  for (const d of snap.docs) {
    const uid = d.id;
    let user;
    try { user = await deps.auth.getUser(uid); } catch (e) { continue; } /* deleted/unknown auth user: skip quietly */
    const claims = user.customClaims || {};
    const email = String(user.email || "").toLowerCase();
    const isSA = email === SUPER_ADMIN_EMAIL;
    if (isSA || (finance && claims.ohFinance === true) || (screen && claims.ohScreen === true)) uids.add(uid);
  }
  /* The super admin gets everything, even before ever opening the push
     button on a device (still only the in-app bell item without a token). */
  try {
    const sa = await deps.auth.getUserByEmail(SUPER_ADMIN_EMAIL);
    uids.add(sa.uid);
  } catch (e) { /* super admin has never signed in yet: nothing to add */ }
  return uids;
}

async function resolveMemberUids(deps) {
  const uids = new Set();
  const snap = await deps.db.collection("congregants").get();
  for (const d of snap.docs) {
    const c = d.data() || {};
    const status = c.status || "active"; /* existing records with no status field are active members */
    if (status !== "active") continue; /* skips pending/declined join requests and inactive members */
    const email = c.email;
    if (!email) continue;
    try {
      const u = await deps.auth.getUserByEmail(email);
      uids.add(u.uid);
    } catch (e) { /* this member has never signed in: nothing to notify yet */ }
  }
  return uids;
}

/* Hanoch Nov 6 ("שבת שלום לקהילה", bell + email): every active member who has
   an email, whether or not they ever signed in (the bell needs a sign-in, an
   email does not). Same filter as resolveMemberUids. */
async function resolveMemberEmails(deps) {
  const out = [], seen = new Set();
  const snap = await deps.db.collection("congregants").get();
  for (const d of snap.docs) {
    const c = d.data() || {};
    if ((c.status || "active") !== "active") continue;
    const email = String(c.email || "").trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || seen.has(email)) continue;
    seen.add(email); out.push({ id: d.id, email: email, name: c.name || "" });
  }
  return out;
}
function escHtml(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
/* one email; the text is the gabbai's own lines, English first then Hebrew
   (Nov 6, Hanoch): each line takes its own direction (dir="auto"), and a
   "----" line becomes a divider between the two languages */
function broadcastMailHtml(title, text) {
  const lines = String(text || "").split("\n").map(function (l) {
    if (/^-{3,}$/.test(l.trim())) return "<hr style=\"border:0;border-top:1px solid #d8cfbd;margin:16px 0\">";
    return l.trim() ? "<p dir=\"auto\" style=\"margin:0 0 8px\">" + escHtml(l) + "</p>" : "";
  }).join("");
  return "<div dir=\"ltr\" style=\"font-family:Arial,sans-serif;font-size:16px;line-height:1.6;color:#26231e;max-width:560px\">" +
    "<h2 dir=\"auto\" style=\"color:#0e2c4c;margin:0 0 12px\">" + escHtml(title) + "</h2>" + lines +
    "<p style=\"margin:18px 0 0;color:#7a6f61;font-size:13px\">Or Hachaim Congregation · בית הכנסת אור החיים · 321 Harold St, Staten Island, NY 10314<br><a href=\"https://orhachaimsi.org/\">orhachaimsi.org</a></p></div>";
}
/* the mail documents functions/sendMail sends; one id per broadcast and member, so a repeat never sends twice */
async function queueBroadcastMail(deps, broadcastId, people, title, text) {
  let n = 0;
  for (let i = 0; i < people.length; i += 400) {
    const batch = deps.db.batch();
    people.slice(i, i + 400).forEach(function (p) {
      batch.set(deps.db.collection("mail").doc("broadcast-" + broadcastId + "-" + p.id), {
        to: p.email, message: { subject: title, text: title + "\n\n" + text, html: broadcastMailHtml(title, text) },
        createdAt: deps.FieldValue.serverTimestamp(), kind: "broadcast", broadcastId: broadcastId
      });
      n++;
    });
    await batch.commit();
  }
  return n;
}

async function deliver(deps, uid, payload) {
  const ref = deps.db.collection("notifications").doc();
  const doc = {
    recipientUid: uid,
    title: payload.title,
    body: payload.body || "",
    kind: payload.kind,
    read: false,
    createdAt: deps.FieldValue.serverTimestamp(),
    createdBy: payload.createdBy || "system"
  };
  if (payload.broadcastId) doc.broadcastId = payload.broadcastId;
  await ref.set(doc);

  /* Push, only if this person has registered at least one device. A
     failure here never fails the function: the in-app bell item above is
     already saved, which is the part nothing else can recreate. */
  try {
    const tokSnap = await deps.db.collection("notificationTokens").doc(uid).get();
    const tokens = (tokSnap.exists && Array.isArray(tokSnap.data().tokens)) ? tokSnap.data().tokens : [];
    if (!tokens.length) return;
    const resp = await deps.messaging.sendEachForMulticast({
      tokens: tokens,
      notification: { title: payload.title, body: payload.body || "" }
    });
    const bad = [];
    (resp.responses || []).forEach(function (r, i) {
      if (r.success) return;
      const code = r.error && r.error.code;
      if (code === "messaging/invalid-registration-token" || code === "messaging/registration-token-not-registered") bad.push(tokens[i]);
    });
    if (bad.length) {
      const keep = tokens.filter(function (tk) { return bad.indexOf(tk) < 0; });
      await deps.db.collection("notificationTokens").doc(uid).update({ tokens: keep });
    }
  } catch (e) {
    console.warn("push send failed for " + uid + ": " + (e && e.message ? e.message : e));
  }
}

async function deliverToMany(deps, uids, payload) {
  const list = Array.from(uids instanceof Set ? uids : new Set(uids));
  await Promise.all(list.map(function (uid) { return deliver(deps, uid, payload); }));
}

/* ---------- the four triggers ---------- */

async function handleLedgerCreate(deps, event) {
  const snap = event.data;
  if (!snap) return;
  const data = snap.data();
  if (!data || data.type !== "payment") return; /* "incoming payments/donations", not charges or corrections */
  const amountStr = (typeof data.amount === "number") ? data.amount.toFixed(2) : String(data.amount || "");
  const financeUids = await resolveGabbaiUids(deps, { finance: true, screen: false });
  await deliverToMany(deps, financeUids, {
    title: "התקבל תשלום",
    body: "תשלום של $" + amountStr + (data.description ? (" - " + data.description) : ""),
    kind: "payment"
  });
  if (data.congregantId) {
    try {
      const cSnap = await deps.db.collection("congregants").doc(data.congregantId).get();
      const email = cSnap.exists ? cSnap.data().email : null;
      if (email) {
        const u = await deps.auth.getUserByEmail(email);
        await deliver(deps, u.uid, { title: "תשלום נרשם בחשבונך", body: "סכום $" + amountStr, kind: "payment" });
      }
    } catch (e) { /* the member has never signed in: nothing to notify yet */ }
  }
}

async function handleCongregantWrite(deps, event) {
  const id = event.params && event.params.id;
  if (!id || id.indexOf("join_") !== 0) return; /* only join requests, not every member edit */
  const before = event.data && event.data.before && event.data.before.exists ? event.data.before.data() : null;
  const after = event.data && event.data.after && event.data.after.exists ? event.data.after.data() : null;
  if (!after) return;
  const wasPending = before && before.status === "pending";
  /* Fix (2026-11-06, after the repo review): only the super admin approves
     join requests, so only the super admin is told about a new one (it went
     to every finance gabbai too); and the person who asked now hears the
     answer, on their own bell (the document id is "join_" + their uid). */
  if (after.status === "pending" && !wasPending) {
    try {
      const sa = await deps.auth.getUserByEmail(SUPER_ADMIN_EMAIL);
      await deliver(deps, sa.uid, { title: "בקשת הצטרפות חדשה", body: after.name ? ("מאת " + after.name) : "", kind: "joinRequest" });
    } catch (e) { /* the super admin has never signed in: nothing to notify */ }
    return;
  }
  if (wasPending && after.status !== "pending") {
    const uid = id.slice(5);
    if (!uid) return;
    const approved = after.status === "active" || after.status === "linked";
    const declined = after.status === "declined";
    if (!approved && !declined) return;
    await deliver(deps, uid, approved
      ? { title: "בקשת ההצטרפות אושרה ✓", body: "אפשר להיכנס לאתר ולראות את החשבון שלך.", kind: "joinAnswer" }
      : { title: "בקשת ההצטרפות לא אושרה", body: "לשאלות: orhachaimcong@gmail.com", kind: "joinAnswer" });
  }
}

async function handlePrayerTimeWrite(deps, event) {
  const after = event.data && event.data.after && event.data.after.exists ? event.data.after.data() : null;
  const before = event.data && event.data.before && event.data.before.exists ? event.data.before.data() : null;
  const src = after || before || {};
  const name = src.nameHe || "";
  const body = after ? (name + (after.time ? (" - " + after.time) : "")) : (name + " הוסר");
  const uids = await resolveGabbaiUids(deps, { finance: false, screen: true });
  await deliverToMany(deps, uids, { title: "עדכון בזמני התפילה", body: body, kind: "prayerTime" });
}

async function handleAnnouncementWrite(deps, event) {
  const after = event.data && event.data.after && event.data.after.exists ? event.data.after.data() : null;
  const before = event.data && event.data.before && event.data.before.exists ? event.data.before.data() : null;
  if (!after || after.status !== "published") return;
  if (before && before.status === "published") return; /* already notified when it first went live */
  const title = after.titleHe || "הכרזה חדשה";
  const body = after.bodyHe || "";
  const gabbaiUids = await resolveGabbaiUids(deps, { finance: false, screen: true });
  const memberUids = await resolveMemberUids(deps);
  const all = new Set([].concat(Array.from(gabbaiUids), Array.from(memberUids)));
  await deliverToMany(deps, all, { title: title, body: body, kind: "announcement" });
}

/* ---------- the super admin's broadcast form ---------- */

const BROADCAST_ORIGINS = [
  "https://orhachaimcong.org",
  "https://www.orhachaimcong.org",
  "https://orhachaimsi.org",
  "https://www.orhachaimsi.org",
  "https://office212.github.io"
]; /* identical allowlist to setUserClaims, deliberately: same site, same reason */

async function sendBroadcastHandler(deps, req, res) {
  const origin = req.headers.origin || "";
  if (BROADCAST_ORIGINS.indexOf(origin) >= 0) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  }
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method-not-allowed" });
  try {
    const authHeader = req.headers.authorization || "";
    const match = authHeader.match(/^Bearer\s+(.+)$/);
    if (!match) return res.status(401).json({ ok: false, error: "unauthenticated" });
    let decoded;
    try { decoded = await deps.auth.verifyIdToken(match[1]); }
    catch (e) { return res.status(401).json({ ok: false, error: "unauthenticated" }); }
    const callerEmail = String(decoded.email || "").toLowerCase();
    if (callerEmail !== SUPER_ADMIN_EMAIL || decoded.email_verified !== true) {
      return res.status(403).json({ ok: false, error: "not-super-admin" });
    }
    const body = req.body || {};
    const title = String(body.title || "").trim().slice(0, 120);
    const text = String(body.body || "").trim().slice(0, 500);
    /* optional (Nov 6): also by email to every active member with an email,
       with a longer text when given (the bell keeps the short one) */
    const withEmail = body.email === true;
    const mailText = String(body.emailBody || body.body || "").trim().slice(0, 4000);
    const audience = String(body.audience || "").trim().toLowerCase();
    if (!title) return res.status(400).json({ ok: false, error: "missing-title" });
    if (["members", "gabbaim", "everyone"].indexOf(audience) < 0) {
      return res.status(400).json({ ok: false, error: "invalid-audience" });
    }
    const uids = new Set();
    if (audience === "gabbaim" || audience === "everyone") {
      (await resolveGabbaiUids(deps, { finance: true, screen: true })).forEach(function (u) { uids.add(u); });
    }
    if (audience === "members" || audience === "everyone") {
      (await resolveMemberUids(deps)).forEach(function (u) { uids.add(u); });
    }
    const broadcastId = deps.db.collection("notifications").doc().id;
    await deliverToMany(deps, uids, { title: title, body: text, kind: "broadcast", createdBy: callerEmail, broadcastId: broadcastId });
    let emailedTo = 0;
    if (withEmail && (audience === "members" || audience === "everyone")) {
      try { emailedTo = await queueBroadcastMail(deps, broadcastId, await resolveMemberEmails(deps), title, mailText); }
      catch (e) { console.error("broadcast email queue failed", e && e.message ? e.message : e); return res.status(200).json({ ok: true, sentTo: uids.size, broadcastId: broadcastId, emailedTo: 0, emailError: "queue-failed" }); }
    }
    return res.status(200).json({ ok: true, sentTo: uids.size, broadcastId: broadcastId, emailedTo: emailedTo });
  } catch (e) {
    console.error("sendBroadcast failed", e && e.message ? e.message : e);
    return res.status(500).json({ ok: false, error: "internal-error" });
  }
}

/* ---------- wiring to the live Admin SDK (Gen 2, region us-east1) ---------- */

if (!admin.apps.length) admin.initializeApp();
const liveDeps = {
  db: admin.firestore(),
  auth: admin.auth(),
  messaging: admin.messaging(),
  FieldValue: admin.firestore.FieldValue
};

exports.onLedgerPayment = onDocumentCreated({ document: "ledgerEntries/{id}", region: REGION }, function (event) { return handleLedgerCreate(liveDeps, event); });
exports.onJoinRequestWrite = onDocumentWritten({ document: "congregants/{id}", region: REGION }, function (event) { return handleCongregantWrite(liveDeps, event); });
exports.onPrayerTimeWrite = onDocumentWritten({ document: "prayerTimes/{id}", region: REGION }, function (event) { return handlePrayerTimeWrite(liveDeps, event); });
exports.onAnnouncementWrite = onDocumentWritten({ document: "announcements/{id}", region: REGION }, function (event) { return handleAnnouncementWrite(liveDeps, event); });
exports.sendBroadcast = onRequest({ region: REGION }, function (req, res) { return sendBroadcastHandler(liveDeps, req, res); });

/* exported for functions/notifications/test/ only: the pure logic, no admin SDK needed to call these directly with fake deps */
exports._test = {
  SUPER_ADMIN_EMAIL: SUPER_ADMIN_EMAIL,
  resolveGabbaiUids: resolveGabbaiUids,
  resolveMemberUids: resolveMemberUids,
  resolveMemberEmails: resolveMemberEmails,
  broadcastMailHtml: broadcastMailHtml,
  deliver: deliver,
  deliverToMany: deliverToMany,
  handleLedgerCreate: handleLedgerCreate,
  handleCongregantWrite: handleCongregantWrite,
  handlePrayerTimeWrite: handlePrayerTimeWrite,
  handleAnnouncementWrite: handleAnnouncementWrite,
  sendBroadcastHandler: sendBroadcastHandler
};
