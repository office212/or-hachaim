/* Or Hachaim: self-managed mail sender (Hanoch, Nov 6 2026).
   REPLACES the Firebase Trigger Email extension (firestore-send-email).
   The owner abandoned the extension install (Nov 6 2026): Firebase
   Extensions shut down March 31, 2027, so the site sends its own mail
   instead of depending on one.

   What it does: watches the `mail` collection and sends every document
   written there, through the synagogue Gmail over SMTP. Two functions
   already write mail documents in this shape:
   - sendWelcomeEmail (live): { to, message: { subject, text, html } }
   - sendStatementEmail: { to, message: { subject, text, html } }
   Neither sends mail itself; both only queue the document. This
   function is the sender. No mail is ever sent by a client: the `mail`
   collection has no client write rule (default deny), only functions
   write it through the Admin SDK.

   Transport: nodemailer, smtp.gmail.com port 465 (secure), authenticating
   as hanochhason@gmail.com with a Gmail app password. The password lives
   in Secret Manager as GMAIL_APP_PASSWORD (see README.md); it is never
   in this file, never in the repo, never in a mail document.

   From address: the mail document's `from` field when present, else the
   default "Or Hachaim Congregation <orhachaimcong@gmail.com>". NOTE:
   Gmail only keeps that From if orhachaimcong@gmail.com is a verified
   "Send mail as" alias in hanochhason's Gmail settings (the verification
   code goes to the orhachaimcong inbox). Otherwise Gmail rewrites From
   to hanochhason@gmail.com. This function cannot fix that; the alias is
   a separate owner step (see README.md). The mail still arrives either
   way; only the displayed sender address changes.

   Delivery bookkeeping (same contract as the extension had): after
   attempting to send, the function updates the mail document's
   `delivery` field to { state: "SUCCESS" or "ERROR", attempts: number,
   error?: string, endTime: serverTimestamp }. attempts counts every
   send attempt for that document.

   Idempotency: a document whose delivery.state is already "SUCCESS" is
   never sent again. A document with no valid `to`, or with no message
   subject+html, is never sent; it is marked delivery ERROR with the
   reason. A failed send is recorded as ERROR and the function returns
   normally: it never throws, so there is no retry storm and no endless
   loop. A document marked ERROR can be re-queued by writing it again
   (or fixing the address and updating it); the next write attempts
   the send once more.

   Deploy: its own folder, its own package.json, exactly like
   setUserClaims/, dailybackup/, notifications/ and sendWelcomeEmail/
   (see functions/README.md: each function here is its own Gen 2
   deploy). Node 22 (Node 20 deploys are blocked since 2026-10-30).
   Region us-east1, same as the other functions. Do NOT install the
   Trigger Email extension alongside this function: both would read
   the same `mail` documents and the member could get the mail twice. */

const admin = require("firebase-admin");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const nodemailer = require("nodemailer");

const REGION = "us-east1"; /* same region as setUserClaims, dailybackup, notifications, sendWelcomeEmail */
const SMTP_HOST = "smtp.gmail.com";
const SMTP_PORT = 465;
const SMTP_USER = "hanochhason@gmail.com";
const DEFAULT_FROM = "Or Hachaim Congregation <orhachaimcong@gmail.com>";

/* The Gmail app password for hanochhason@gmail.com. Set with
   `firebase functions:secrets:set GMAIL_APP_PASSWORD` (owner only);
   the value never appears in this file or in the repo. */
const gmailAppPassword = defineSecret("GMAIL_APP_PASSWORD");

/* ---------- pure helpers (no Admin SDK, easy to check by hand) ---------- */

function isEmail(s) {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

/* ---------- handler (deps-injected, like functions/notifications) ---------- */

/* deps: { send: async function (mail) } where mail is
   { from, to, subject, text?, html }. The live `send` builds a
   nodemailer transporter from the secret and calls sendMail. */
async function handleMailWrite(deps, event) {
  var after = event.data && event.data.after ? event.data.after : null;
  if (!after) return; /* deleted document: nothing to send */
  var data = after.data() || {};
  var ref = after.ref;
  var delivery = data.delivery || {};
  if (delivery.state === "SUCCESS") return; /* already sent: never send twice */
  var attempts = (typeof delivery.attempts === "number" ? delivery.attempts : 0) + 1;

  async function markError(reason) {
    var doc = { state: "ERROR", attempts: attempts, error: reason, endTime: admin.firestore.FieldValue.serverTimestamp() };
    try { await ref.update({ delivery: doc }); }
    catch (e) { console.error("sendMail: could not mark delivery ERROR", e && e.message ? e.message : e); }
  }

  if (!isEmail(data.to)) { await markError("missing-or-invalid-to"); return; }
  var msg = data.message || {};
  if (typeof msg.subject !== "string" || !msg.subject.trim() ||
      typeof msg.html !== "string" || !msg.html.trim()) {
    await markError("missing-message");
    return;
  }
  var from = (typeof data.from === "string" && data.from.trim()) ? data.from.trim() : DEFAULT_FROM;
  var mail = {
    from: from,
    to: String(data.to).trim(),
    subject: msg.subject,
    html: msg.html
  };
  if (typeof msg.text === "string" && msg.text) mail.text = msg.text;

  try {
    await deps.send(mail);
  } catch (e) {
    /* Record ERROR and return normally: never throw, so the platform
       never retries this invocation and the member never gets the same
       mail twice. The failure stays visible in delivery.error. */
    var reason = String((e && e.message) || e || "send-failed").slice(0, 500);
    console.error("sendMail: send failed for", mail.to, reason);
    await markError(reason);
    return;
  }

  try {
    await ref.update({
      delivery: {
        state: "SUCCESS",
        attempts: attempts,
        endTime: admin.firestore.FieldValue.serverTimestamp()
      }
    });
  } catch (e) {
    /* The mail was sent but the bookkeeping write failed. Log it and
       return: throwing here would risk a platform retry that sends
       the mail a second time. */
    console.error("sendMail: sent but could not mark delivery SUCCESS", e && e.message ? e.message : e);
  }
}

/* ---------- live wiring ---------- */

if (!admin.apps.length) admin.initializeApp();

const liveDeps = {
  send: async function (mail) {
    var transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: true,
      auth: { user: SMTP_USER, pass: gmailAppPassword.value() }
    });
    return transporter.sendMail(mail);
  }
};

exports.sendMail = onDocumentWritten(
  { document: "mail/{docId}", region: REGION, secrets: [gmailAppPassword] },
  function (event) { return handleMailWrite(liveDeps, event); }
);

exports._test = { isEmail: isEmail, handleMailWrite: handleMailWrite };
