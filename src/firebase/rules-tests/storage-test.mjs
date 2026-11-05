
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import { ref, uploadString, getBytes } from "firebase/storage";
const env = await initializeTestEnvironment({ projectId: "demo-oh", storage: { rules: readFileSync("../storage.rules", "utf8"), host: "127.0.0.1", port: 9199 } });
let pass = 0, fail = 0;
async function t(name, p, ok) { try { await (ok ? assertSucceeds(p) : assertFails(p)); pass++; console.log("ok  ", name); } catch (e) { fail++; console.log("FAIL", name, String(e.message).slice(0, 160)); } }
const up = env.authenticatedContext("u1", { email: "g@x.com", email_verified: true, ohScreen: true, ohImageUpload: true }).storage();
const view = env.authenticatedContext("u2", { email: "v@x.com", email_verified: true, ohScreen: true }).storage();
const fin = env.authenticatedContext("u3", { email: "f@x.com", email_verified: true, ohFinance: true }).storage();
const scr = env.authenticatedContext("u5", { email: "s@x.com", email_verified: true, ohScreen: true }).storage();
// super admin email but NOT verified: not super admin (claims, set per account by the claims function, are what count for gabbaim)
const unv = env.authenticatedContext("u4", { email: "hanochhason@gmail.com", email_verified: false }).storage();
await t("image uploader uploads a png", uploadString(ref(up, "screen/flyer/t1/a.png"), "iVBORw0KGgo=", "base64", { contentType: "image/png" }), true);
await t("image uploader cannot upload a pdf", uploadString(ref(up, "screen/flyer/t1/a.pdf"), "JVBERi0=", "base64", { contentType: "application/pdf" }), false);
await t("viewer reads screen image", getBytes(ref(view, "screen/flyer/t1/a.png")), true);
await t("viewer cannot upload", uploadString(ref(view, "screen/flyer/t1/b.png"), "iVBORw0KGgo=", "base64", { contentType: "image/png" }), false);
await t("finance-only cannot read screen images", getBytes(ref(fin, "screen/flyer/t1/a.png")), false);
await t("unverified super-admin email cannot upload", uploadString(ref(unv, "screen/flyer/t1/c.png"), "iVBORw0KGgo=", "base64", { contentType: "image/png" }), false);
await t("Content and Times without ImageUpload cannot upload", uploadString(ref(scr, "screen/flyer/t1/d.png"), "iVBORw0KGgo=", "base64", { contentType: "image/png" }), false);
await t("outside screen/ denied", uploadString(ref(up, "other/a.png"), "iVBORw0KGgo=", "base64", { contentType: "image/png" }), false);
console.log(`\n${pass} passed, ${fail} failed`); await env.cleanup(); process.exit(fail ? 1 : 0);
