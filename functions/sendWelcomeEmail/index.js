/* Or Hachaim: welcome email (Hanoch, Nov 6 2026).
   When a gabbai adds a congregant with an email (or adds an email to an
   existing congregant), the member gets one welcome email from the site,
   with a short explanation and a link. Same infrastructure can later send
   a payment receipt by email after each payment.

   How it sends: this function does NOT send mail itself. It writes one
   document to the `mail` collection, and the Firebase Trigger Email
   extension (firestore-send-email) sends it through the synagogue Gmail
   (orhachaimcong@gmail.com, SMTP, app password). The extension is NOT
   installed by this file: the owner installs it in the Firebase console
   (see README.md). No mail is ever sent by a client: the `mail`
   collection has no client write rule (default deny), only this function
   writes it through the Admin SDK.

   Rules of the send:
   - One email per congregant, ever. The record carries welcomeEmailSent;
     once it is true, the trigger returns. The mail document id is
     `welcome-<congregantId>`, so even a repeated write cannot queue a
     second copy.
   - Only when the record has an email. A congregant without an email
     gets nothing (email is required when a gabbai adds a member, Hanoch
     Nov 5 2026, so this should not happen for new members).
   - The email carries NO balance and NO financial data: a greeting, how
     to sign in (Google, with this same email), what the member sees on
     the site, and the link to their account. Hebrew first, then English.
   - Shabbat: the function sends when the record is written. Gabbaim add
     members on weekdays; if a record is ever written on Shabbat, the
     email goes out then too. If Hanoch wants a Motzei Shabbat hold,
     that is a small change to this file (hold the mail write, not the
     flag), not a new function.

   Deploy: its own folder, its own package.json, exactly like
   setUserClaims/, dailybackup/ and notifications/ (see
   functions/README.md: each function here is its own Gen 2 deploy).
   Node 22 (Node 20 deploys are blocked since 2026-10-30). Region
   us-east1, same as the other functions. */

const admin = require("firebase-admin");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");

const REGION = "us-east1"; /* same region as setUserClaims, dailybackup, notifications */
const SITE = "https://orhachaimsi.org";
const FROM_NAME = "Or Hachaim Congregation";
const CONTACT_EMAIL = "orhachaimcong@gmail.com";

/* ---------- pure helpers (no Admin SDK, easy to check by hand) ---------- */

function isEmail(s) {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function escHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* Fix (2026-11-06, after the repo review): a join request is also a
   congregants document (join_<uid>, status "pending"), and the old check
   never looked at the status, so a person who only ASKED to join got
   "you were added as a member" at once (and a declined one too); the
   welcomeEmailSent flag it then wrote also blocked their "send again"
   (the stage D2 rule allowed only the request's own keys). And any later
   write to an older member (one added before this function existed, so
   with no flag) sent them a welcome too. Now a welcome goes only to an
   ACTIVE member, and only when they become one or get a new email:
   - the record is created active (a gabbai adds a member);
   - it turns active (a join request approved, or an inactive member back);
   - its email is added or changed.
   A plain edit of an active member (name, phone, status fields) sends nothing. */
function isActive(c) { return !!c && (c.status || "active") === "active"; }
function shouldSend(before, after) {
  if (!after) return false;
  if (after.welcomeEmailSent) return false;
  if (!isActive(after)) return false;
  if (!isEmail(after.email)) return false;
  if (!before) return true;                                   /* created active */
  if (!isActive(before)) return true;                         /* became active */
  if (String(before.email || "").toLowerCase() !== String(after.email || "").toLowerCase()) return true; /* new email */
  return false;
}

function buildMail(c) {
  const name = String(c.name || "").trim();
  const email = String(c.email || "").trim();
  const subject = "ברוכים הבאים לאתר בית הכנסת אור החיים / Welcome to the Or Hachaim website";
  const text =
    "שלום " + (name || "") + ",\n\n" +
    "נרשמת כמתפלל בבית הכנסת אור החיים, ועכשיו יש לך חשבון באתר שלנו.\n\n" +
    "מה אפשר לראות באתר:\n" +
    "את היתרה שלך ואת היסטוריית התשלומים, ואת זמני התפילה וזמני היום.\n\n" +
    "איך נכנסים:\n" +
    "היכנס עם גוגל באותה כתובת מייל: " + email + "\n" +
    "החשבון שלי: " + SITE + "/congregant/\n" +
    "דף הבית: " + SITE + "/\n\n" +
    "שאלות: " + CONTACT_EMAIL + " | (646) 529-2504 | (347) 244-9382\n\n" +
    "בברכה,\nבית הכנסת אור החיים\n\n" +
    "----\n\n" +
    "Hello " + (name || "") + ",\n\n" +
    "You were added as a member of Or Hachaim Congregation, and you now have an account on our website.\n\n" +
    "What you can see on the site:\n" +
    "Your balance and payment history, and the prayer times and daily zmanim.\n\n" +
    "How to sign in:\n" +
    "Sign in with Google using this same email address: " + email + "\n" +
    "My account: " + SITE + "/congregant/\n" +
    "Home page: " + SITE + "/\n\n" +
    "Questions: " + CONTACT_EMAIL + " | (646) 529-2504 | (347) 244-9382\n\n" +
    "Or Hachaim Congregation";
  const html =
    "<div dir=\"rtl\" style=\"font-family:Arial,sans-serif;line-height:1.7;color:#26231e\">" +
    "<p>שלום " + escHtml(name) + ",</p>" +
    "<p>נרשמת כמתפלל בבית הכנסת אור החיים, ועכשיו יש לך חשבון באתר שלנו.</p>" +
    "<p><b>מה אפשר לראות באתר:</b><br>את היתרה שלך ואת היסטוריית התשלומים, ואת זמני התפילה וזמני היום.</p>" +
    "<p><b>איך נכנסים:</b><br>היכנס עם גוגל באותה כתובת מייל: " + escHtml(email) + "<br>" +
    "<a href=\"" + SITE + "/congregant/\">החשבון שלי</a> · <a href=\"" + SITE + "/\">דף הבית</a></p>" +
    "<p>שאלות: <a href=\"mailto:" + CONTACT_EMAIL + "\">" + CONTACT_EMAIL + "</a> | (646) 529-2504 | (347) 244-9382</p>" +
    "<p>בברכה,<br>בית הכנסת אור החיים</p>" +
    "<hr>" +
    "</div>" +
    "<div dir=\"ltr\" style=\"font-family:Arial,sans-serif;line-height:1.7;color:#26231e\">" +
    "<p>Hello " + escHtml(name) + ",</p>" +
    "<p>You were added as a member of Or Hachaim Congregation, and you now have an account on our website.</p>" +
    "<p><b>What you can see on the site:</b><br>Your balance and payment history, and the prayer times and daily zmanim.</p>" +
    "<p><b>How to sign in:</b><br>Sign in with Google using this same email address: " + escHtml(email) + "<br>" +
    "<a href=\"" + SITE + "/congregant/\">My account</a> · <a href=\"" + SITE + "/\">Home page</a></p>" +
    "<p>Questions: <a href=\"mailto:" + CONTACT_EMAIL + "\">" + CONTACT_EMAIL + "</a> | (646) 529-2504 | (347) 244-9382</p>" +
    "<p>Or Hachaim Congregation</p>" +
    "</div>";
  return { to: email, message: { subject: subject, text: text, html: html } };
}

/* ---------- handler (deps-injected, like functions/notifications) ---------- */

async function handleCongregantWrite(deps, event) {
  const before = event.data && event.data.before ? event.data.before.data() : null;
  const after = event.data && event.data.after ? event.data.after.data() : null;
  if (!shouldSend(before, after)) return;
  const id = event.params.congregantId;
  const mail = buildMail(after);
  /* Queue first, then mark sent. The mail id is deterministic, so a
     retry cannot queue a second copy. */
  await deps.db.collection("mail").doc("welcome-" + id).set(mail);
  await deps.db.collection("congregants").doc(id).update({ welcomeEmailSent: true });
}

/* ---------- live wiring ---------- */

if (!admin.apps.length) admin.initializeApp();
const liveDeps = { db: admin.firestore() };

exports.onCongregantWrite = onDocumentWritten(
  { document: "congregants/{congregantId}", region: REGION },
  function (event) { return handleCongregantWrite(liveDeps, event); }
);

exports._test = { shouldSend: shouldSend, buildMail: buildMail, handleCongregantWrite: handleCongregantWrite };
