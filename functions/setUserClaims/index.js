// setUserClaims, Or Hachaim custom claims function. LOCAL DRAFT ONLY.
// NOT deployed, NOT live. See README.md in this folder before deploying.
//
// Deployment shape (to be set at deploy time, not here):
//   Project: or-hachaim, region: us-east1, runtime: Node 20,
//   Trigger: HTTP, Firebase Admin SDK, default credentials.
//   The caller is the super admin's browser, so the function MUST be
//   reachable by an HTTP request carrying a Firebase ID token.
//   See README.md, section "IAM warning": do NOT deny allUsers at the
//   IAM layer, or the browser call never reaches this code. Access
//   control lives in this code (valid super-admin Firebase token),
//   not in IAM. Unauthenticated calls get a generic 401 and no data.
//
// What this function does, and does not do:
//   - Verifies the caller's Firebase ID token, then requires the
//     caller email to be exactly hanochhason@gmail.com.
//   - Looks up the target user by email with Admin SDK. It NEVER
//     creates an Auth user: if the target has never signed in with
//     Google, getUserByEmail throws auth/user-not-found, and the
//     function returns 404 with code auth-user-not-found. The admin
//     dashboard must then save a pending users doc only, and tell
//     the super admin the target must sign in once first.
//   - Never grants super admin. The super admin is an email check
//     in the rules, not a claim. A request whose target email is
//     the super admin email is rejected.
//   - Never sets claims for the caller: target == caller is rejected,
//     so the super admin cannot use this to change their own token.
//   - Preserves unrelated existing custom claims, replaces only the
//     oh* keys, and increments ohRoleVersion on every grant/revoke.
//   - Writes/updates the matching users doc in Firestore, for the
//     admin dashboard list. Admin SDK bypasses Firestore rules;
//     that is why this function must only run for the super admin.

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}
const auth = admin.auth();
const db = admin.firestore();

const SUPER_ADMIN_EMAIL = "hanochhason@gmail.com";
const PERMISSIONS = ["finance", "screen", "both", "viewer"];

function isValidEmail(email) {
  return typeof email === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
}

// Permission input -> claim booleans. Viewer is read-only screen:
// ohScreenViewer alone grants screen reads in the rules diff, it
// does NOT grant screen writes or admin. ohScreen grants screen
// writes and admin (via hasScreen). ohScreenEdit grants Storage
// writes under /screen/ and is set together with ohScreen.
function claimsFor(permission, screenViewer, imageUpload) {
  const perm = String(permission || "").trim().toLowerCase();
  const viewer = screenViewer === true || perm === "viewer";
  return {
    ohFinance: perm === "finance" || perm === "both",
    ohScreen: perm === "screen" || perm === "both",
    ohScreenViewer: viewer,
    ohScreenEdit: perm === "screen" || perm === "both",
    ohImageUpload: imageUpload === true,
  };
}

async function upsertUsersDoc(email, permission, screenViewer, imageUpload, targetUid, version, callerEmail) {
  const data = {
    email,
    permissions: permission,
    screenViewer: screenViewer === true || permission === "viewer",
    imageUpload: imageUpload === true,
    claimsUid: targetUid,
    claimsVersion: version,
    claimsGrantedBy: callerEmail,
    claimsGrantedAt: new Date().toISOString(),
    source: "custom-claims",
    updatedBy: callerEmail,
    updatedAt: new Date().toISOString(),
  };
  const snap = await db.collection("users").where("email", "==", email).limit(1).get();
  if (!snap.empty) {
    const docId = snap.docs[0].id;
    await db.collection("users").doc(docId).update(data);
    return { id: docId, updated: true };
  }
  data.createdBy = callerEmail;
  data.createdAt = new Date().toISOString();
  const ref = await db.collection("users").add(data);
  return { id: ref.id, updated: false };
}

async function setUserClaims(req, res) {
  // CORS: the site is cross-origin to cloudfunctions.net, so the
  // browser needs an explicit allowlist, otherwise fetch fails with
  // "Failed to fetch" before the code ever runs. Only the site
  // origins are allowed, never "*", and the token check below is
  // still the real access control.
  const allowedOrigins = [
    "https://orhachaimcong.org",
    "https://www.orhachaimcong.org",
    "https://orhachaimsi.org",
    "https://www.orhachaimsi.org",
    "https://office212.github.io",
  ];
  const origin = req.headers.origin || "";
  if (allowedOrigins.includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  }
  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }
  // JSON only, POST only.
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method-not-allowed" });
  }
  try {
    const authHeader = req.headers.authorization || "";
    const match = authHeader.match(/^Bearer\s+(.+)$/);
    if (!match) {
      // Generic 401: never reveal whether an email exists to an
      // unauthenticated caller.
      return res.status(401).json({ ok: false, error: "unauthenticated" });
    }
    let decoded;
    try {
      decoded = await auth.verifyIdToken(match[1]);
    } catch (e) {
      return res.status(401).json({ ok: false, error: "unauthenticated" });
    }
    const callerEmail = String(decoded.email || "").toLowerCase();
    /* Fix (2026-11-06, after the repo review): a verified email too, like
       firestore.rules (isSuperAdmin) and sendBroadcast. Without it, an
       unverified account created with this address (for example if
       email/password sign-in were ever turned on) could grant roles. */
    if (callerEmail !== SUPER_ADMIN_EMAIL || decoded.email_verified !== true) {
      return res.status(403).json({ ok: false, error: "not-super-admin" });
    }

    const body = req.body || {};
    const action = String(body.action || "grant").trim().toLowerCase();
    const email = String(body.email || "").trim().toLowerCase();
    if (!isValidEmail(email)) {
      return res.status(400).json({ ok: false, error: "invalid-email" });
    }
    if (email === SUPER_ADMIN_EMAIL) {
      return res.status(400).json({ ok: false, error: "cannot-grant-super-admin" });
    }
    if (email === callerEmail) {
      return res.status(400).json({ ok: false, error: "cannot-grant-self" });
    }
    if (action !== "grant" && action !== "revoke") {
      return res.status(400).json({ ok: false, error: "invalid-action" });
    }
    let permission = "viewer";
    let screenViewer = false;
    let imageUpload = false;
    if (action === "grant") {
      permission = String(body.permission || "").trim().toLowerCase();
      if (PERMISSIONS.indexOf(permission) < 0) {
        return res.status(400).json({ ok: false, error: "invalid-permission" });
      }
      screenViewer = body.screenViewer === true;
      imageUpload = body.imageUpload === true;
    }

    let target;
    try {
      target = await auth.getUserByEmail(email);
    } catch (e) {
      if (e && e.code === "auth/user-not-found") {
        // Plain, actionable message for the super admin only (this
        // branch is reached only after the super-admin check above).
        return res.status(404).json({
          ok: false,
          error: "auth-user-not-found",
          message: "This email has no Auth record yet. Ask the user to sign in once with Google first, then grant again. Save as a pending users doc only.",
        });
      }
      throw e;
    }

    const existing = target.customClaims || {};
    const version = (typeof existing.ohRoleVersion === "number" ? existing.ohRoleVersion : 0) + 1;
    const next = Object.assign({}, existing);
    // Replace only the oh* keys, preserve unrelated claims.
    ["ohFinance", "ohScreen", "ohScreenViewer", "ohScreenEdit", "ohImageUpload"].forEach((k) => delete next[k]);
    let claims = {};
    if (action === "grant") {
      claims = claimsFor(permission, screenViewer, imageUpload);
      Object.assign(next, claims);
    }
    next.ohRoleVersion = version;
    await auth.setCustomUserClaims(target.uid, next);

    let usersDoc = null;
    if (action === "grant") {
      usersDoc = await upsertUsersDoc(email, permission, screenViewer, imageUpload, target.uid, version, callerEmail);
    } else {
      // Revoke: clear the users doc permission fields as well, so
      // the dashboard list does not show a stale grant. The doc
      // itself is kept (deletion is a separate dashboard action).
      const snap = await db.collection("users").where("email", "==", email).limit(1).get();
      if (!snap.empty) {
        await db.collection("users").doc(snap.docs[0].id).update({
          permissions: "",
          screenViewer: false,
          imageUpload: false,
          claimsVersion: version,
          claimsGrantedBy: callerEmail,
          claimsGrantedAt: new Date().toISOString(),
          source: "custom-claims-revoked",
          updatedBy: callerEmail,
          updatedAt: new Date().toISOString(),
        });
        usersDoc = { id: snap.docs[0].id, updated: true };
      }
    }

    return res.status(200).json({
      ok: true,
      action,
      uid: target.uid,
      email,
      claims: action === "grant" ? claims : {},
      claimsVersion: version,
      usersDocId: usersDoc ? usersDoc.id : null,
      usersDocUpdated: usersDoc ? usersDoc.updated : false,
      note: "The target user must sign out and sign in again to refresh their token and receive the new claims.",
    });
  } catch (e) {
    // Never leak a stack trace or an internal error string to the client.
    console.error("setUserClaims failed", e && e.message ? e.message : e);
    return res.status(500).json({ ok: false, error: "internal-error" });
  }
}

module.exports = { setUserClaims };
