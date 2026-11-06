# Welcome email (Or Hachaim)

One welcome email when a gabbai adds a congregant with an email (or adds
an email to an existing congregant). Hebrew first, then English. No
balance and no financial data in the email: a greeting, how to sign in
(Google, with the same email), what the member sees on the site, and the
link to their account (`https://orhachaimsi.org/congregant/`).

## How it sends

This function does NOT send mail itself. It writes one document to the
`mail` collection, and the Firebase **Trigger Email extension**
(`firestore-send-email`) sends it through the synagogue Gmail
(`orhachaimcong@gmail.com`, SMTP). The function is one email per
congregant, ever: the record carries `welcomeEmailSent`, and the mail
document id is `welcome-<congregantId>`.

## Setup the owner does once (before the first deploy)

1. **App password for orhachaimcong@gmail.com.** In that Google
   account: Security, turn on 2-Step Verification, then App passwords,
   create one named "Or Hachaim website". Keep the 16-character password;
   it is never written in the repo, in chat, or in any file.
2. **Install the Trigger Email extension** in the Firebase console
   (project or-hachaim, Extensions, `firestore-send-email`):
   - SMTP connection URI:
     `smtps://orhachaimcong@gmail.com:<the app password>@smtp.gmail.com:465`
   - Default FROM: `Or Hachaim Congregation <orhachaimcong@gmail.com>`
   - Mail collection: `mail` (the default).
3. **Deploy this function** (its own folder, its own package.json,
   Node 22, region us-east1, exactly like the other functions):
   `firebase deploy --only functions:onCongregantWrite`
   (from `functions/sendWelcomeEmail/`, with the project's Firebase
   credentials; the repo has no firebase.json, the runtime is set in
   the deploy command as for the notifications deploy).
4. **Test with the first real congregant added.** The function logs
   nothing to the site; check in the Firebase console that a `mail`
   document `welcome-<id>` appeared and that the extension sent it.
   Never create a test congregant in the live system.

## Open decision

Shabbat: the function sends when the record is written. Gabbaim add
members on weekdays; if a record is ever written on Shabbat, the email
goes out then too. If Hanoch wants a Motzei Shabbat hold, that is a
small change to `index.js` (hold the mail write, not the flag), not a
new function.
