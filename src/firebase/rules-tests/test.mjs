/* Firestore rules tests for the LIVE rules (src/firebase/firestore.rules), hardening edition 2026-11-05.
   Before 2026-11-05 this file tested the unpublished hardened draft of Nov 3, not the live rules.
   Run inside the emulator from this folder: npm test (see README.md), or
     RULES=../firestore.rules OH_FS_PORT=8085 node test.mjs
   What it proves: the 4 hardening checks (ledger shape + restore path, activityLog who/whoUid/when,
   email_verified on the super admin and on every read by email, finance cannot change an existing
   member email) and that the rest behaves as before. Lines marked "unchanged" document live behaviour
   this package does not touch. */
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
const env = await initializeTestEnvironment({ projectId: "demo-oh", firestore: { rules: readFileSync(process.env.RULES || "../firestore.rules", "utf8"), host: "127.0.0.1", port: +(process.env.OH_FS_PORT || 8085) } });
let pass = 0, fail = 0;
async function t(name, p, expectOk) {
  try { await (expectOk ? assertSucceeds(p) : assertFails(p)); pass++; console.log("ok  ", name); }
  catch (e) { fail++; console.log("FAIL", name, String(e.message || e).slice(0, 200)); }
}
await env.clearFirestore();
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "congregants/c1"), { name: "A", email: "cong@x.com" });
  await setDoc(doc(db, "congregants/c2"), { name: "B", email: "other@x.com" });
  await setDoc(doc(db, "congregants/c3"), { name: "C", email: "" });
  await setDoc(doc(db, "congregants/c4"), { name: "D", phone: "7185550100" });
  await setDoc(doc(db, "users/udoc"), { email: "doc@x.com", permissions: "finance" });
  await setDoc(doc(db, "users/ucong"), { email: "cong@x.com", permissions: "" });
  await setDoc(doc(db, "ledgerEntries/seed1"), { congregantId: "c1", amount: 10, type: "charge", operationId: "seed1" });
  await setDoc(doc(db, "ledgerEntries/seed2"), { congregantId: "c2", amount: 10, type: "charge", operationId: "seed2" });
  await setDoc(doc(db, "activityLog/a1"), { area: "ledger", action: "x" });
  await setDoc(doc(db, "activityLog/a2"), { area: "screen", action: "y" });
  await setDoc(doc(db, "pledges/p1"), { congregantId: "c1", amount: 54, status: "unpaid" });
  await setDoc(doc(db, "prayerTimes/pt1"), { nameHe: "שחרית", time: "7:00 AM" });
});
const fin = env.authenticatedContext("ufin", { email: "fin@x.com", email_verified: true, ohFinance: true }).firestore();
const docFin = env.authenticatedContext("udoc", { email: "doc@x.com", email_verified: true }).firestore();
const scr = env.authenticatedContext("uscr", { email: "scr@x.com", email_verified: true, ohScreen: true }).firestore();
const plain = env.authenticatedContext("uplain", { email: "plain@x.com", email_verified: true }).firestore();
const sa = env.authenticatedContext("usa", { email: "hanochhason@gmail.com", email_verified: true }).firestore();
const saUnverified = env.authenticatedContext("usa2", { email: "hanochhason@gmail.com", email_verified: false }).firestore();
const cong = env.authenticatedContext("ucong", { email: "cong@x.com", email_verified: true }).firestore();
const congUnverified = env.authenticatedContext("ucong2", { email: "cong@x.com", email_verified: false }).firestore();
const anon = env.unauthenticatedContext().firestore();

/* A ledger entry exactly as saveLedgerEntry (firebase-app.js) writes it. */
function entry(uid, email, id, over = {}) {
  const e = { congregantId: "c1", date: "2026-11-05", type: "charge", amount: 18, description: "t", enteredBy: email, enteredByUid: uid, operationId: id, source: "manual", createdAt: serverTimestamp(), ...over };
  for (const k of Object.keys(e)) if (e[k] === undefined) delete e[k];
  return e;
}
function batchSave(db, uid, email, id, over = {}, withOp = true) {
  const b = writeBatch(db);
  if (withOp) b.set(doc(db, "operationIds/" + id), { createdAt: serverTimestamp(), congregantId: "c1", by: uid });
  b.set(doc(db, "ledgerEntries/" + id), entry(uid, email, id, over));
  return b.commit();
}
const F = (id, over, withOp) => batchSave(fin, "ufin", "fin@x.com", id, over, withOp);

console.log("--- 1. ledger entries: shape ---");
await t("finance (claim) saves a charge in one batch, id == operationId", F("op-1"), true);
await t("same operationId again is rejected", F("op-1"), false);
await t("payment with method allowed", F("op-pay", { type: "payment", amount: 180, method: "check" }), true);
await t("neder charge (source neder, pledgeId, aliyah) allowed", F("op-neder", { source: "neder", pledgeId: "p1", aliyah: "שלישי" }), true);
await t("recurring charge (source recurring) allowed", F("op-rec", { source: "recurring" }), true);
await t("amount with cents (18.5) allowed", F("op-cents", { amount: 18.5 }), true);
await t("negative correction allowed", F("op-9", { type: "correction", amount: -5 }), true);
await t("positive correction allowed", F("op-9b", { type: "correction", amount: 5 }), true);
await t("entry without description allowed", F("op-nodesc", { description: undefined }), true);
await t("ledger without operationIds claim in the batch rejected", F("op-2", {}, false), false);
await t("doc id != operationId rejected", (async () => { const b = writeBatch(fin); b.set(doc(fin, "operationIds/op-3"), { createdAt: serverTimestamp() }); b.set(doc(fin, "ledgerEntries/random"), entry("ufin", "fin@x.com", "op-3")); return b.commit(); })(), false);
await t("spoofed enteredBy rejected", F("op-4", { enteredBy: "someone@else.com" }), false);
await t("spoofed enteredByUid rejected", F("op-5", { enteredByUid: "other" }), false);
await t("client createdAt rejected", F("op-6", { createdAt: new Date(Date.now() - 60000) }), false);
await t("amount as string rejected", F("op-7", { amount: "18" }), false);
await t("negative charge rejected", F("op-8", { amount: -5 }), false);
await t("zero payment rejected", F("op-8b", { type: "payment", amount: 0 }), false);
await t("zero correction rejected", F("op-8c", { type: "correction", amount: 0 }), false);
await t("bad type rejected", F("op-10", { type: "gift" }), false);
await t("bad source rejected", F("op-10b", { source: "webhook" }), false);
await t("bad date rejected", F("op-10c", { date: "11/05/2026" }), false);
await t("unknown congregant rejected", F("op-11", { congregantId: "nope" }), false);
await t("empty congregantId rejected", F("op-11b", { congregantId: "" }), false);
await t("extra field rejected", F("op-12", { balance: 0 }), false);
await t("missing enteredBy rejected", F("op-12b", { enteredBy: undefined }), false);
await t("ledger update denied", updateDoc(doc(fin, "ledgerEntries/op-1"), { amount: 1 }), false);
await t("users/{uid} finance gabbai can save", batchSave(docFin, "udoc", "doc@x.com", "op-13"), true);
await t("super admin (verified) can save", batchSave(sa, "usa", "hanochhason@gmail.com", "op-sa"), true);
await t("super admin with unverified email cannot save", batchSave(saUnverified, "usa2", "hanochhason@gmail.com", "op-sa2"), false);
await t("screen gabbai cannot save ledger", batchSave(scr, "uscr", "scr@x.com", "op-14"), false);
await t("member cannot write ledger", batchSave(cong, "ucong", "cong@x.com", "op-15"), false);

console.log("--- 2. restore path (/restore/) ---");
const old = (by, over = {}) => ({ congregantId: "c1", date: "2025-01-01", type: "payment", amount: 50, description: "old", enteredBy: "oldgabbai@x.com", enteredByUid: "u-old", operationId: "old-1", source: "manual", createdAt: { seconds: 1735689600, nanoseconds: 0 }, restored: true, restoredAt: serverTimestamp(), restoredBy: by, ...over });
await t("super admin restores a ledger entry with its original fields", setDoc(doc(sa, "ledgerEntries/old-1"), old("usa")), true);
await t("restored entry cannot be restored again (exists)", setDoc(doc(sa, "ledgerEntries/old-1"), old("usa")), false);
await t("super admin restore of an entry in the old bare shape", setDoc(doc(sa, "ledgerEntries/old-bare"), { congregantId: "c1", amount: 10, type: "charge", operationId: "old-bare", restored: true, restoredAt: serverTimestamp(), restoredBy: "usa" }), true);
await t("restore with a client restoredAt rejected", setDoc(doc(sa, "ledgerEntries/old-3"), old("usa", { operationId: "old-3", restoredAt: new Date(Date.now() - 60000) })), false);
await t("restore with someone else's restoredBy rejected", setDoc(doc(sa, "ledgerEntries/old-4"), old("other", { operationId: "old-4" })), false);
await t("finance gabbai cannot use the restore path", setDoc(doc(fin, "ledgerEntries/old-2"), old("ufin", { operationId: "old-2" })), false);
await t("unverified super admin cannot restore", setDoc(doc(saUnverified, "ledgerEntries/old-5"), old("usa2", { operationId: "old-5" })), false);
await t("super admin restores an activityLog line with its original who", setDoc(doc(sa, "activityLog/old-log"), { area: "screen", action: "screenItem.create", who: "gabbai@x.com", whoUid: "u-g", when: { seconds: 1, nanoseconds: 0 }, restored: true, restoredAt: serverTimestamp(), restoredBy: "usa" }), true);
await t("super admin restores an operationIds claim", setDoc(doc(sa, "operationIds/old-1"), { createdAt: { seconds: 1, nanoseconds: 0 }, congregantId: "c1", by: "u-old" }), true);
await t("super admin restores a congregant", setDoc(doc(sa, "congregants/old-c"), { name: "Old", phone: "1", email: "old@x.com", createdBy: "x", createdAt: "2025-01-01" }), true);

console.log("--- 3. activityLog: who / whoUid / when ---");
const log = (who, whoUid, over = {}) => ({ area: "screen", action: "x", detail: "", who, whoUid, when: serverTimestamp(), ...over });
await t("finance logs with its own who/whoUid and server time", setDoc(doc(fin, "activityLog/n1"), log("fin@x.com", "ufin", { area: "ledger" })), true);
await t("screen gabbai logs (logActivity shape)", setDoc(doc(scr, "activityLog/n1s"), log("scr@x.com", "uscr", { itemId: "i1", collection: "announcements", command: "x" })), true);
await t("screen gabbai: item + log in one batch (screen-content.js shape)", (async () => { const b = writeBatch(scr); b.set(doc(scr, "announcements/b1"), { titleHe: "x", status: "draft", version: 1 }); b.set(doc(collection(scr, "activityLog")), { area: "screen", action: "screenItem.create", collection: "announcements", itemId: "b1", itemType: "announcement", version: 1, snapshot: { titleHe: "x" }, who: "scr@x.com", whoUid: "uscr", when: serverTimestamp() }); return b.commit(); })(), true);
await t("super admin logs", setDoc(doc(sa, "activityLog/n1a"), log("hanochhason@gmail.com", "usa")), true);
await t("spoofed who rejected", setDoc(doc(fin, "activityLog/n2"), log("boss@x.com", "ufin")), false);
await t("spoofed whoUid rejected", setDoc(doc(fin, "activityLog/n2b"), log("fin@x.com", "other")), false);
await t("client 'when' rejected", setDoc(doc(fin, "activityLog/n2c"), log("fin@x.com", "ufin", { when: new Date(Date.now() - 60000) })), false);
await t("missing who rejected", setDoc(doc(fin, "activityLog/n2d"), { area: "ledger", action: "x", whoUid: "ufin", when: serverTimestamp() }), false);
await t("signed-in user without a role cannot log", setDoc(doc(plain, "activityLog/n2e"), log("plain@x.com", "uplain")), false);
await t("log update denied", updateDoc(doc(fin, "activityLog/a1"), { action: "z" }), false);
/* Activity log (Nov 5): read by the super admin only */
await t("finance can NOT read the log (Nov 5)", getDoc(doc(fin, "activityLog/a1")), false);
await t("screen gabbai can NOT read the log (Nov 5)", getDoc(doc(scr, "activityLog/a2")), false);
await t("screen gabbai: history of one item from the log is refused (Nov 5)", getDocs(query(collection(scr, "activityLog"), where("itemId", "==", "b1"))), false);
await t("signed-in user without a role cannot read the log", getDoc(doc(plain, "activityLog/a2")), false);
console.log("--- 3b. activity log separated (Nov 5): super admin only reads; versions kept in the item ---");
const docScr = env.authenticatedContext("udocscr", { email: "docscr@x.com", email_verified: true }).firestore();
await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), "users/udocscr"), { email: "docscr@x.com", permissions: "screen" }); });
await t("super admin reads one log line", getDoc(doc(sa, "activityLog/a1")), true);
await t("super admin reads the log newest first (page query)", getDocs(query(collection(sa, "activityLog"), orderBy("when", "desc"), limit(50))), true);
await t("super admin with an unverified email cannot read the log", getDoc(doc(saUnverified, "activityLog/a1")), false);
await t("finance (users document) cannot read the log", getDoc(doc(docFin, "activityLog/a1")), false);
await t("screen (users document) cannot read the log", getDoc(doc(docScr, "activityLog/a1")), false);
await t("finance cannot list the log", getDocs(query(collection(fin, "activityLog"), limit(5))), false);
await t("screen cannot list the log", getDocs(query(collection(scr, "activityLog"), limit(5))), false);
await t("member cannot read the log", getDoc(doc(cong, "activityLog/a1")), false);
await t("signed out cannot read the log", getDoc(doc(anon, "activityLog/a1")), false);
await t("finance (users document) logs a valid line", setDoc(doc(docFin, "activityLog/v1"), log("doc@x.com", "udoc", { area: "finance", amount: 18, target: "A", targetId: "c1", code: "ledger.payment" })), true);
await t("screen (users document) logs a valid line", setDoc(doc(docScr, "activityLog/v2"), log("docscr@x.com", "udocscr", { area: "screen" })), true);
await t("screen logs a valid line (claims)", setDoc(doc(scr, "activityLog/v3"), log("scr@x.com", "uscr", { area: "times" })), true);
await t("finance logs a valid line (claims)", setDoc(doc(fin, "activityLog/v4"), log("fin@x.com", "ufin", { area: "members" })), true);
await t("super admin logs a valid line", setDoc(doc(sa, "activityLog/v5"), log("hanochhason@gmail.com", "usa", { area: "permissions" })), true);
await t("member cannot log", setDoc(doc(cong, "activityLog/v6"), log("cong@x.com", "ucong")), false);
await t("signed out cannot log", setDoc(doc(anon, "activityLog/v7"), { area: "join", action: "x", who: "", whoUid: "", when: serverTimestamp() }), false);
await t("screen: forged who rejected", setDoc(doc(scr, "activityLog/v8"), log("hanochhason@gmail.com", "uscr")), false);
await t("screen: forged when rejected", setDoc(doc(scr, "activityLog/v9"), log("scr@x.com", "uscr", { when: new Date(2026, 0, 1) })), false);
await t("super admin cannot update a log line", updateDoc(doc(sa, "activityLog/a1"), { action: "z" }), false);
await t("super admin cannot delete a log line", deleteDoc(doc(sa, "activityLog/a1")), false);
await t("finance cannot delete a log line", deleteDoc(doc(fin, "activityLog/a1")), false);
const ver = (n) => Array.from({ length: n }, (_, i) => ({ version: i + 1, action: "update", savedAt: "2026-11-05T12:00:00.000Z", snapshot: { titleHe: "v" + (i + 1), status: "draft" } }));
for (const col of ["announcements", "dedications", "sponsors", "flyers", "yahrzeits"]) {
  await t(col + ": screen saves an item with 10 earlier versions", setDoc(doc(scr, col + "/vv1"), { titleHe: "x", status: "draft", version: 11, versions: ver(10) }), true);
  await t(col + ": 11 earlier versions rejected", setDoc(doc(scr, col + "/vv1"), { titleHe: "x", status: "draft", version: 12, versions: ver(11) }), false);
}
await t("versions that is not a list rejected", setDoc(doc(scr, "announcements/vv2"), { titleHe: "x", status: "draft", versions: { a: 1 } }), false);
await t("an item with no versions is still saved (every item today)", setDoc(doc(scr, "announcements/vv3"), { titleHe: "x", status: "draft", version: 1 }), true);
await t("update of an item to 10 versions", updateDoc(doc(scr, "announcements/vv3"), { version: 2, versions: ver(1) }), true);
await t("finance still cannot write screen items", setDoc(doc(fin, "announcements/vv4"), { titleHe: "x", status: "draft", versions: [] }), false);
await t("signed out reads a published item with its versions (public, no emails in versions)", (async () => { await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), "announcements/pub1"), { titleHe: "x", status: "published", versions: ver(2) }); }); return getDoc(doc(anon, "announcements/pub1")); })(), true);

console.log("--- 4. email_verified ---");
await t("super admin verified: reads a ledger entry", getDoc(doc(sa, "ledgerEntries/seed1")), true);
await t("super admin unverified email: no ledger read", getDoc(doc(saUnverified, "ledgerEntries/seed1")), false);
await t("super admin unverified email: no member list", getDocs(collection(saUnverified, "congregants")), false);
await t("super admin unverified email: cannot write users", setDoc(doc(saUnverified, "users/x"), { email: "x@x.com", permissions: "finance" }), false);
await t("super admin unverified email: cannot write settings", setDoc(doc(saUnverified, "settings/s1"), { a: 1 }), false);
await t("super admin verified: writes users", setDoc(doc(sa, "users/x"), { email: "x@x.com", permissions: "finance" }), true);
await t("member reads own record", getDoc(doc(cong, "congregants/c1")), true);
await t("member reads own record by email query (loadOwnCongregant)", getDocs(query(collection(cong, "congregants"), where("email", "==", "cong@x.com"))), true);
await t("member reads own ledger entry", getDoc(doc(cong, "ledgerEntries/seed1")), true);
await t("member reads own ledger by congregantId query", getDocs(query(collection(cong, "ledgerEntries"), where("congregantId", "==", "c1"))), true);
await t("member reads other record denied", getDoc(doc(cong, "congregants/c2")), false);
await t("member reads other ledger entry denied", getDoc(doc(cong, "ledgerEntries/seed2")), false);
await t("unverified email: own record denied", getDoc(doc(congUnverified, "congregants/c1")), false);
await t("unverified email: own ledger entry denied", getDoc(doc(congUnverified, "ledgerEntries/seed1")), false);
await t("unverified email: users doc by email denied", getDoc(doc(congUnverified, "users/ucong")), false);
await t("verified email: users doc by email (unchanged)", getDoc(doc(cong, "users/udoc")), false);

console.log("--- 5. finance and a member's email ---");
await t("finance changes an existing email: rejected", updateDoc(doc(fin, "congregants/c1"), { email: "attacker@gmail.com" }), false);
await t("finance removes an existing email: rejected", updateDoc(doc(fin, "congregants/c2"), { email: "" }), false);
await t("finance adds an email to a record with empty email: allowed", updateDoc(doc(fin, "congregants/c3"), { email: "new@x.com" }), true);
await t("finance adds an email to a record with no email field: allowed", updateDoc(doc(fin, "congregants/c4"), { email: "new4@x.com" }), true);
await t("finance then changes that email: rejected", updateDoc(doc(fin, "congregants/c4"), { email: "other4@x.com" }), false);
await t("finance edits name and phone, email untouched: allowed", updateDoc(doc(fin, "congregants/c1"), { name: "A2", phone: "7185550199" }), true);
await t("finance re-saves the same email (no change): allowed", setDoc(doc(fin, "congregants/c1"), { name: "A2", phone: "7185550199", email: "cong@x.com" }), true);
await t("finance (users doc) changes an existing email: rejected", updateDoc(doc(docFin, "congregants/c1"), { email: "x@y.com" }), false);
await t("finance creates a member with an email (unchanged)", setDoc(doc(fin, "congregants/c9"), { name: "New", phone: "1", email: "n9@x.com", createdBy: "fin@x.com", createdAt: "2026-11-05" }), true);
await t("super admin changes an existing email: allowed", updateDoc(doc(sa, "congregants/c2"), { email: "fixed@x.com" }), true);
await t("screen gabbai cannot edit members (unchanged)", updateDoc(doc(scr, "congregants/c3"), { phone: "1" }), false);

console.log("--- 6. unchanged by this package ---");
await t("operationIds overwrite denied", setDoc(doc(fin, "operationIds/op-1"), { by: "x" }), false);
await t("pledge create (unchanged)", setDoc(doc(fin, "pledges/p3"), { congregantId: "c1", amount: 54, status: "unpaid", createdBy: "ufin", createdAt: serverTimestamp() }), true);
await t("pledge status change (unchanged)", updateDoc(doc(fin, "pledges/p1"), { status: "converted" }), true);
await t("pledge amount change denied (unchanged)", updateDoc(doc(fin, "pledges/p1"), { amount: 1 }), false);
await t("users write by a gabbai denied", setDoc(doc(fin, "users/ufin"), { permissions: "both" }), false);
await t("anyone reads prayer times", getDoc(doc(anon, "prayerTimes/pt1")), true);
await t("signed-in user without a role cannot read the ledger", getDoc(doc(plain, "ledgerEntries/seed1")), false);
await t("signed-in user without a role cannot write prayer times", setDoc(doc(plain, "prayerTimes/x"), { time: "7:00 AM" }), false);
await t("screen gabbai writes a prayer time", setDoc(doc(scr, "prayerTimes/x"), { nameHe: "מנחה", time: "4:20 PM", order: 980 }), true);
await t("screen gabbai cannot read the ledger", getDoc(doc(scr, "ledgerEntries/seed1")), false);
console.log(`\n${pass} passed, ${fail} failed`);
await env.cleanup();
process.exit(fail ? 1 : 0);
