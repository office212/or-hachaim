
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import { doc, getDoc, setDoc, updateDoc, writeBatch, serverTimestamp, collection, query, where, getDocs } from "firebase/firestore";
const env = await initializeTestEnvironment({ projectId: "demo-oh", firestore: { rules: readFileSync("../firestore.rules", "utf8"), host: "127.0.0.1", port: 8085 } });
let pass = 0, fail = 0;
async function t(name, p, expectOk) {
  try { await (expectOk ? assertSucceeds(p) : assertFails(p)); pass++; console.log("ok  ", name); }
  catch (e) { fail++; console.log("FAIL", name, String(e.message || e).slice(0, 200)); }
}
// seed
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "congregants/c1"), { name: "A", email: "cong@x.com" });
  await setDoc(doc(db, "congregants/c2"), { name: "B", email: "other@x.com" });
  await setDoc(doc(db, "users/udoc"), { email: "doc@x.com", permissions: "finance" });
  await setDoc(doc(db, "ledgerEntries/seed1"), { congregantId: "c1", amount: 10, type: "charge", operationId: "seed1" });
  await setDoc(doc(db, "ledgerEntries/seed2"), { congregantId: "c2", amount: 10, type: "charge", operationId: "seed2" });
  await setDoc(doc(db, "activityLog/a1"), { area: "ledger", action: "x" });
  await setDoc(doc(db, "activityLog/a2"), { area: "announcements", action: "y" });
  await setDoc(doc(db, "pledges/p1"), { congregantId: "c1", amount: 54, status: "unpaid" });
  await setDoc(doc(db, "pledges/p2"), { congregantId: "c1", amount: 36, status: "converted" });
  await setDoc(doc(db, "prayerTimes/pt1"), { nameHe: "שחרית", time: "7:00 AM" });
});
const fin = env.authenticatedContext("ufin", { email: "fin@x.com", email_verified: true, ohFinance: true }).firestore();
const docFin = env.authenticatedContext("udoc", { email: "doc@x.com", email_verified: true }).firestore();
const scr = env.authenticatedContext("uscr", { email: "scr@x.com", email_verified: true, ohScreen: true }).firestore();
const viewer = env.authenticatedContext("uview", { email: "view@x.com", email_verified: true, ohScreenViewer: true }).firestore();
const sa = env.authenticatedContext("usa", { email: "hanochhason@gmail.com", email_verified: true }).firestore();
const saUnverified = env.authenticatedContext("usa2", { email: "hanochhason@gmail.com", email_verified: false }).firestore();
const cong = env.authenticatedContext("ucong", { email: "cong@x.com", email_verified: true }).firestore();
function entry(db, uid, email, id, over = {}) {
  return { congregantId: "c1", date: "2026-11-03", type: "charge", amount: 18, description: "t", enteredBy: email, enteredByUid: uid, operationId: id, source: "manual", createdAt: serverTimestamp(), ...over };
}
function batchSave(db, uid, email, id, over = {}, withOp = true) {
  const b = writeBatch(db);
  if (withOp) b.set(doc(db, "operationIds/" + id), { createdAt: serverTimestamp(), congregantId: "c1", by: uid });
  b.set(doc(db, "ledgerEntries/" + id), entry(db, uid, email, id, over));
  return b.commit();
}
await t("finance(claim) saves entry in batch, id == operationId", batchSave(fin, "ufin", "fin@x.com", "op-1"), true);
await t("same operationId again is rejected", batchSave(fin, "ufin", "fin@x.com", "op-1"), false);
await t("ledger without operationIds claim in batch rejected", batchSave(fin, "ufin", "fin@x.com", "op-2", {}, false), false);
await t("doc id != operationId rejected", (async () => { const b = writeBatch(fin); b.set(doc(fin, "operationIds/op-3"), { createdAt: serverTimestamp() }); b.set(doc(fin, "ledgerEntries/random"), entry(fin, "ufin", "fin@x.com", "op-3")); return b.commit(); })(), false);
await t("spoofed enteredBy rejected", batchSave(fin, "ufin", "fin@x.com", "op-4", { enteredBy: "someone@else.com" }), false);
await t("spoofed enteredByUid rejected", batchSave(fin, "ufin", "fin@x.com", "op-5", { enteredByUid: "other" }), false);
await t("client createdAt rejected", batchSave(fin, "ufin", "fin@x.com", "op-6", { createdAt: new Date() }), false);
await t("amount as string rejected", batchSave(fin, "ufin", "fin@x.com", "op-7", { amount: "18" }), false);
await t("negative charge rejected", batchSave(fin, "ufin", "fin@x.com", "op-8", { amount: -5 }), false);
await t("negative correction allowed", batchSave(fin, "ufin", "fin@x.com", "op-9", { type: "correction", amount: -5 }), true);
await t("bad type rejected", batchSave(fin, "ufin", "fin@x.com", "op-10", { type: "gift" }), false);
await t("unknown congregant rejected", batchSave(fin, "ufin", "fin@x.com", "op-11", { congregantId: "nope" }), false);
await t("extra field rejected", batchSave(fin, "ufin", "fin@x.com", "op-12", { balance: 0 }), false);
await t("ledger update denied", updateDoc(doc(fin, "ledgerEntries/op-1"), { amount: 1 }), false);
await t("users/{uid} finance gabbai can save", batchSave(docFin, "udoc", "doc@x.com", "op-13"), true);
await t("screen gabbai cannot save ledger", batchSave(scr, "uscr", "scr@x.com", "op-14"), false);
await t("super admin unverified email: no read", getDoc(doc(saUnverified, "ledgerEntries/seed1")), false);
await t("super admin verified: read", getDoc(doc(sa, "ledgerEntries/seed1")), true);
await t("screen gabbai reads finance log entry: denied", getDoc(doc(scr, "activityLog/a1")), false);
await t("screen gabbai reads screen log entry", getDoc(doc(scr, "activityLog/a2")), true);
await t("screen gabbai unfiltered log query denied", getDocs(collection(scr, "activityLog")), false);
await t("screen gabbai filtered log query allowed", getDocs(query(collection(scr, "activityLog"), where("area", "in", ["screen", "prayerTimes", "announcements", "dedications", "sponsors", "flyers", "yahrzeits", "images"]))), true);
await t("finance reads finance log", getDoc(doc(fin, "activityLog/a1")), true);
await t("log create with forced who/when", setDoc(doc(fin, "activityLog/n1"), { who: "fin@x.com", whoUid: "ufin", when: serverTimestamp(), action: "x", area: "ledger" }), true);
await t("log create spoofed who rejected", setDoc(doc(fin, "activityLog/n2"), { who: "boss@x.com", whoUid: "ufin", when: serverTimestamp(), action: "x", area: "ledger" }), false);
await t("screen gabbai writes finance-area log rejected", setDoc(doc(scr, "activityLog/n3"), { who: "scr@x.com", whoUid: "uscr", when: serverTimestamp(), action: "x", area: "ledger" }), false);
await t("pledge create unpaid", setDoc(doc(fin, "pledges/p3"), { congregantId: "c1", amount: 54, status: "unpaid", createdBy: "ufin", createdAt: serverTimestamp() }), true);
await t("pledge create already converted rejected", setDoc(doc(fin, "pledges/p4"), { congregantId: "c1", amount: 54, status: "converted", createdBy: "ufin", createdAt: serverTimestamp() }), false);
await t("pledge amount change rejected", updateDoc(doc(fin, "pledges/p1"), { amount: 1, status: "converted", statusChangedAt: serverTimestamp(), statusChangedBy: "ufin" }), false);
await t("pledge unpaid -> converted allowed", updateDoc(doc(fin, "pledges/p1"), { status: "converted", statusChangedAt: serverTimestamp(), statusChangedBy: "ufin", ledgerEntryId: "op-1" }), true);
await t("pledge converted -> cancelled rejected", updateDoc(doc(fin, "pledges/p2"), { status: "cancelled", statusChangedAt: serverTimestamp(), statusChangedBy: "ufin" }), false);
await t("nedarim write closed", setDoc(doc(fin, "nedarim/n1"), { amount: 1 }), false);
await t("congregant reads own ledger entry", getDoc(doc(cong, "ledgerEntries/seed1")), true);
await t("congregant reads other ledger entry denied", getDoc(doc(cong, "ledgerEntries/seed2")), false);
await t("congregant reads own record", getDoc(doc(cong, "congregants/c1")), true);
await t("congregant cannot write ledger", batchSave(cong, "ucong", "cong@x.com", "op-15"), false);
await t("viewer reads prayer times", getDoc(doc(viewer, "prayerTimes/pt1")), true);
await t("viewer cannot read ledger", getDoc(doc(viewer, "ledgerEntries/seed1")), false);
await t("viewer cannot read activity log", getDoc(doc(viewer, "activityLog/a2")), false);
await t("viewer cannot write prayer times", setDoc(doc(viewer, "prayerTimes/x"), { time: "7:00 AM" }), false);
await t("screen gabbai writes prayer time", setDoc(doc(scr, "prayerTimes/x"), { nameHe: "מנחה", time: "4:20 PM", order: 980 }), true);
await t("super admin restore of ledger entry with original fields", setDoc(doc(sa, "ledgerEntries/old-1"), { congregantId: "c1", date: "2025-01-01", type: "payment", amount: 50, enteredBy: "oldgabbai@x.com", operationId: "old-1", restored: true, restoredAt: serverTimestamp(), restoredBy: "usa" }), true);
await t("finance gabbai cannot use restore path", setDoc(doc(fin, "ledgerEntries/old-2"), { congregantId: "c1", date: "2025-01-01", type: "payment", amount: 50, enteredBy: "x@x.com", operationId: "old-2", restored: true, restoredAt: serverTimestamp(), restoredBy: "ufin" }), false);
await t("users write by gabbai denied", setDoc(doc(fin, "users/ufin"), { permissions: "both" }), false);
console.log(`\n${pass} passed, ${fail} failed`);
await env.cleanup();
process.exit(fail ? 1 : 0);
