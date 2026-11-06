# sendMail (Or Hachaim, Nov 6 2026)

Self-managed mail sender. It **replaces the Firebase Trigger Email
extension** (`firestore-send-email`), which the owner abandoned:
Firebase Extensions shut down March 31, 2027. Do **not** install the
extension alongside this function: both would read the same `mail`
documents and a member could get the same email twice.

## What it does

Watches the Firestore `mail` collection. Every document written there
is sent once by email, through Gmail SMTP, and the document is marked
with the delivery result.

- Trigger: `onDocumentWritten` on `mail/{docId}` (create or update).
- Gen 2, region `us-east1`, Node 22, like the other functions.
- Transport: nodemailer, `smtp.gmail.com:465` (secure), authenticating
  as `hanochhason@gmail.com` with a Gmail app password from Secret
  Manager (`GMAIL_APP_PASSWORD`). The password is never in this file,
  never in the repo, never in a mail document.

## Mail document shape (accepted)

Written by `sendWelcomeEmail` (live) and `sendStatementEmail`:

```json
{
  "to": "member@example.com",
  "from": "Or Hachaim Congregation <orhachaimcong@gmail.com>",
  "message": { "subject": "...", "text": "...", "html": "..." },
  "createdAt": "<server timestamp>"
}
```

- `to`: one email address (a string). Anything else is marked ERROR.
- `from`: optional. When present it is used as-is; when absent the
  default is `Or Hachaim Congregation <orhachaimcong@gmail.com>`.
  (Both current writers omit `from`, so the default applies.)
- `message.subject` and `message.html` are required; `message.text`
  is optional and is sent as the plain-text part when present.

## Delivery bookkeeping (same contract the extension used)

After each attempt the function updates the mail document:

```json
"delivery": {
  "state": "SUCCESS",
  "attempts": 1,
  "endTime": "<server timestamp>"
}
```

On failure: `state` is `"ERROR"` and `error` holds the reason
(`missing-or-invalid-to`, `missing-message`, or the send error text).
`attempts` counts every send attempt for that document.

- A document with `delivery.state === "SUCCESS"` is never sent again.
- The function never throws: a failed send is recorded as ERROR and
  the invocation returns normally, so there is no retry storm.
- An ERROR document can be re-queued by writing it again (or fixing
  the address and updating it); the next write attempts the send once
  more.

## The "Send mail as" alias (owner step, separate from this function)

Gmail only keeps the From address `orhachaimcong@gmail.com` if that
address is a verified **"Send mail as"** alias in hanochhason's Gmail
settings (Settings → Accounts → "Send mail as" → add
orhachaimcong@gmail.com; the verification code is sent to the
orhachaimcong inbox). Otherwise Gmail rewrites From to
hanochhason@gmail.com. This function cannot fix that; the mail still
arrives either way, only the displayed sender address changes. The
welcome email's contact line already lists orhachaimcong@gmail.com
for replies.

## Secret setup (owner only)

The app password belongs to `hanochhason@gmail.com` (2-Step
Verification on, app password named "Or Hachaim website"). Set it
from Cloud Shell in project `or-hachaim`:

```
firebase functions:secrets:set GMAIL_APP_PASSWORD --project or-hachaim
```

Paste the 16-character app password when prompted. It is stored in
Secret Manager, encrypted; it is never typed into chat, never written
to a file, and never shown in the console after entry. To rotate it,
create a new app password in Google and set the secret again.

## Deploy (Cloud Shell, like the other functions)

```
cd <repo checkout>   # office212/or-hachaim
firebase deploy --only functions:sendMail --project or-hachaim
```

The function folder must be at `functions/sendMail/` in the repo
(`index.js`, `package.json`, this README), the same layout as
`functions/sendWelcomeEmail/`. Node 22 (Node 20 deploys are blocked
since 2026-10-30).

## Test procedure (after deploy)

1. In the Firebase console, Firestore, create one document in the
   `mail` collection addressed to the owner:
   `to: hanochhason@gmail.com`, `message.subject: "Or Hachaim mail
   test"`, `message.html: "<p>Test.</p>"`. (No `from`: the default
   applies.)
2. Wait a few seconds, reload the document: `delivery.state` must be
   `SUCCESS` and `delivery.attempts` must be `1`.
3. Confirm the email arrived in the hanochhason inbox (check the
   displayed From address: it shows orhachaimcong only if the alias
   above is set up, otherwise hanochhason).
4. Delete the test mail document afterwards, so it is not re-sent.
5. Do **not** create test congregants or test ledger entries; the
   live proof is the next real welcome or statement email.

## Files

- `index.js`: the function (handler is deps-injected; `exports._test`
  exposes the pure helpers for local checks).
- `package.json`: Node 22, firebase-admin ^12.1.0,
  firebase-functions ^5.0.0, nodemailer ^6.10.1.
- `README.md`: this file.
