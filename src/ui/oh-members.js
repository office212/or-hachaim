/* Stage D (Hanoch 2026-11-04, 4:12-4:14 PM): members, join requests and roles.
   One file, two places:
   - congregant/ : a signed-in person who is not a member yet sees ONE screen,
     "בקשת הצטרפות כמתפלל" (full name + phone + "שלח בקשה"), then "הבקשה נשלחה".
   - finance/    : the super admin sees "בקשות הצטרפות (N)" with אשר / דחה; אשר asks
     the role in one tap (מתפלל / גבאי זמנים / כספים / שניהם). On the member list
     he changes a role in one tap, makes a member inactive (one-tap confirm) and
     back. Inactive members are hidden behind "הצג לא פעילים". Nobody deletes.
   Deterministic, no network beyond Firestore and the existing claims function.
   Words: plain short Hebrew. Colors: navy and gold only. */
(function () {
  var ROLE_HE = { member: "מתפלל", screen: "גבאי זמנים", finance: "כספים", both: "שניהם" };
  var ROLE_ORDER = ["member", "screen", "finance", "both"];
  function esc(s) { return window.OH_UI ? OH_UI.esc(s) : String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function arg(v) { return window.OH_UI ? OH_UI.jsArg(v) : esc(JSON.stringify(String(v))); }
  function fb() { return window.OH_FIREBASE; }
  function isSA() { var f = fb(); return !!(f && f.isSuperAdminClient && f.isSuperAdminClient()); }
  function statusOf(c) { return (c && c.status) || "active"; }
  /* US format (2026-11-05): month first. */
  function shortDate(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || "")); return m ? (+m[2]) + "/" + (+m[3]) : ""; }
  var REASON_HE = { "permission-denied": "אין הרשאה", "unavailable": "אין חיבור", "not-signed-in": "לא מחובר", "super-admin-protected": "התפקיד של המנהל הראשי לא משתנה", "missing-name": "חסר שם מלא", "invalid-phone": "מספר הטלפון לא תקין" };
  function why(r) { var k = r && r.reason; return REASON_HE[k] || "לא נשמר"; }

  /* ================= finance page (super admin) ================= */
  var S = { roles: {}, rolesOk: false, requests: [], showInactive: false, open: null, msg: {}, busy: false, rerender: null, cons: null };

  function listed(c) {
    var st = statusOf(c);
    if (st === "pending" || st === "declined") return false;
    if (st === "inactive") return S.showInactive;
    return true;
  }
  function isMember(c) { var st = statusOf(c); return st === "active" || st === "inactive"; }
  function isActive(c) { return statusOf(c) === "active"; }
  function roleOf(email) { var r = S.roles[String(email || "").toLowerCase()]; return r ? r.perm : "member"; }

  function chooser(kind, id, current) {
    /* kind: "approve" (default מתפלל) or "role" (current role marked) */
    var q = kind === "approve" ? "איזה תפקיד?" : "תפקיד חדש:";
    var cur = kind === "approve" ? "member" : current;
    return '<div class="ohm-choose" role="group" aria-label="' + esc(q) + '"><span class="ohm-q">' + esc(q) + "</span>" +
      ROLE_ORDER.map(function (k) {
        return '<button type="button" class="ohm-chip' + (k === cur ? " on" : "") + '" data-role="' + k + '" onclick="OH_MEMBERS.pick(' + arg(kind) + "," + arg(id) + "," + arg(k) + ')">' + esc(ROLE_HE[k]) + "</button>";
      }).join("") + '<button type="button" class="ohm-link" onclick="OH_MEMBERS.close()">ביטול</button></div>';
  }
  function confirmBox(text, yes, kind, id) {
    return '<div class="ohm-choose ohm-confirm"><span class="ohm-q">' + esc(text) + '</span><button type="button" class="ohm-btn" data-yes="' + kind + '" onclick="OH_MEMBERS.yes(' + arg(kind) + "," + arg(id) + ')">' + esc(yes) + '</button><button type="button" class="ohm-link" onclick="OH_MEMBERS.close()">ביטול</button></div>';
  }

  function renderRequests() {
    var box = document.getElementById("ohJoinReqs");
    if (!box) return;
    if (!isSA()) { box.hidden = true; box.innerHTML = ""; return; }
    var n = S.requests.length;
    if (!n && !S.msg.req) { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    var h = '<h2 class="ohm-h">בקשות הצטרפות (' + n + ")</h2>";
    if (S.msg.req) h += '<p class="ohm-msg" role="status">' + esc(S.msg.req) + "</p>";
    h += S.requests.map(function (r) {
      var open = S.open && S.open.id === r.id ? S.open.kind : "";
      var body = '<div class="ohm-who"><b>' + esc(r.name) + '</b><span dir="ltr">' + esc(r.phone) + '</span><span dir="ltr" class="ohm-mail">' + esc(r.email) + "</span>" + (shortDate(r.createdAt) ? '<span class="ohm-when">' + esc(shortDate(r.createdAt)) + "</span>" : "") + (r.resent ? '<span class="ohm-again" data-resent="1">נשלחה שוב</span>' : "") + "</div>";
      if (open === "approve") body += chooser("approve", r.id);
      else if (open === "decline") body += confirmBox("לדחות את הבקשה של " + r.name + "?", "כן, לדחות", "decline", r.id);
      else body += '<div class="ohm-row"><button type="button" class="ohm-btn" data-act="approve" onclick="OH_MEMBERS.openFor(\'approve\',' + arg(r.id) + ')">אשר</button><button type="button" class="ohm-btn ohm-out" data-act="decline" onclick="OH_MEMBERS.openFor(\'decline\',' + arg(r.id) + ')">דחה</button></div>';
      return '<div class="ohm-req" data-req="' + esc(r.id) + '">' + body + "</div>";
    }).join("");
    box.innerHTML = h;
  }

  function renderToggle() {
    var box = document.getElementById("ohInactiveToggle");
    if (!box) return;
    var cons = S.cons || [];
    var n = cons.filter(function (c) { return statusOf(c) === "inactive"; }).length;
    if (!n) { box.hidden = true; box.innerHTML = ""; if (S.showInactive) S.showInactive = false; return; }
    box.hidden = false;
    box.innerHTML = '<button type="button" class="ohm-toggle" aria-pressed="' + (S.showInactive ? "true" : "false") + '" onclick="OH_MEMBERS.toggleInactive()">' + esc((S.showInactive ? "הסתר לא פעילים" : "הצג לא פעילים") + " (" + n + ")") + "</button>";
  }

  /* extra lines inside a member card on the finance list */
  function cardExtras(c) {
    var st = statusOf(c), out = "";
    if (st === "inactive") out += '<span class="ohm-pill">לא פעיל</span>';
    if (!isSA()) return out ? '<div class="ohm-card">' + out + "</div>" : "";
    var em = String(c.email || "").toLowerCase();
    var sa = em && fb() && fb().isSuperAdminClient && em === "hanochhason@gmail.com";
    if (sa) return '<div class="ohm-card">' + out + '<span class="ohm-role">תפקיד: מנהל ראשי</span></div>';
    var open = S.open && S.open.id === c.id ? S.open.kind : "";
    var role = roleOf(em);
    out += '<span class="ohm-role">תפקיד: ' + esc(ROLE_HE[role]) + "</span>";
    if (S.msg[c.id]) out += '<span class="ohm-msg" role="status">' + esc(S.msg[c.id]) + "</span>";
    if (open === "role") out += chooser("role", c.id, role);
    else if (open === "inactive") out += confirmBox("להפוך את " + c.name + " ללא פעיל? ההיסטוריה נשמרת.", "כן, לא פעיל", "inactive", c.id);
    else {
      out += '<div class="ohm-row">';
      if (st === "active") {
        if (em) out += '<button type="button" class="ohm-btn ohm-out" data-act="role" onclick="event.stopPropagation();OH_MEMBERS.openFor(\'role\',' + arg(c.id) + ')">שנה תפקיד</button>';
        out += '<button type="button" class="ohm-btn ohm-out" data-act="inactive" onclick="event.stopPropagation();OH_MEMBERS.openFor(\'inactive\',' + arg(c.id) + ')">הפוך ללא פעיל</button>';
      } else if (st === "inactive") {
        out += '<button type="button" class="ohm-btn" data-act="reactivate" onclick="event.stopPropagation();OH_MEMBERS.yes(\'active\',' + arg(c.id) + ')">החזר לפעיל</button>';
      }
      out += "</div>";
    }
    return '<div class="ohm-card" onclick="event.stopPropagation()">' + out + "</div>";
  }

  function paint() { renderRequests(); renderToggle(); if (S.rerender) S.rerender(); }
  function findCon(id) { return (S.cons || []).find(function (c) { return c.id === id; }); }
  /* Activity log (Nov 5): one Hebrew line after each saved change (super admin reads it on gabbai/activity/) */
  function log(area, sentence, code, target, targetId) { try { var f = fb(); if (f && f.logActivity) f.logActivity(sentence, "", { area: area, code: code, target: target, targetId: targetId, collection: "congregants" }); } catch (e) {} }

  async function refreshAdmin() {
    if (!isSA()) { S.requests = []; paint(); return; }
    var f = fb();
    var r = await f.loadJoinRequests();
    S.requests = r && r.ok ? r.items : [];
    var m = await f.loadMemberRoles();
    S.roles = m.roles || {}; S.rolesOk = !!m.ok;
    paint();
  }

  var api = {
    listed: listed, isMember: isMember, isActive: isActive, cardExtras: cardExtras, roleLabel: function (k) { return ROLE_HE[k] || ""; },
    /* finance page: called after every load of the member list */
    attach: function (cons, rerender) { S.cons = cons; S.rerender = rerender; renderToggle(); refreshAdmin(); },
    refresh: refreshAdmin,
    toggleInactive: function () { S.showInactive = !S.showInactive; paint(); },
    openFor: function (kind, id) { S.open = { kind: kind, id: id }; S.msg = {}; paint(); },
    close: function () { S.open = null; paint(); },
    pick: async function (kind, id, role) {
      if (S.busy) return; S.busy = true;
      var f = fb();
      try {
        if (kind === "approve") {
          var req = S.requests.find(function (x) { return x.id === id; });
          if (!req) return;
          var r = await f.setMemberStatus(id, "approve");
          if (!r.saved) { S.msg.req = "לא אושר (" + why(r) + "). אפשר לנסות שוב."; return; }
          var line = req.name + " אושר/ה כ" + ROLE_HE[role];
          if (role !== "member") {
            var g = await f.setMemberRole(req.email, role);
            if (!g.saved) line = req.name + " אושר/ה כמתפלל. התפקיד לא נשמר (" + why(g) + "), אפשר לבחור שוב ברשימה.";
            else line += ". שיתנתק ויתחבר שוב.";
          }
          log("join", "אושרה בקשת הצטרפות: " + req.name + " (" + (g && !g.saved ? ROLE_HE.member : ROLE_HE[role]) + ")", "join.approve", req.name, id);
          S.requests = S.requests.filter(function (x) { return x.id !== id; });
          var cons = S.cons || [];
          var c = cons.find(function (x) { return x.id === id; });
          if (c) c.status = "active";
          else cons.push({ id: id, name: req.name, phone: req.phone, email: req.email, status: "active", ledger: [] });
          S.open = null; S.msg.req = line;
          var m = await f.loadMemberRoles(); S.roles = m.roles || S.roles;
        } else if (kind === "role") {
          var c2 = findCon(id); if (!c2) return;
          var g2 = await f.setMemberRole(c2.email, role);
          S.open = null;
          if (g2.saved) {
            S.msg[id] = "נשמר: " + ROLE_HE[role] + (role === "member" ? "" : ". שיתנתק ויתחבר שוב.");
            log("permissions", "שונתה הרשאה של " + (c2.name || c2.email) + ": " + ROLE_HE[role], "permissions.role", c2.name || c2.email, id);
            var m2 = await f.loadMemberRoles(); S.roles = m2.roles || S.roles;
          } else S.msg[id] = "לא נשמר (" + why(g2) + ")";
        }
      } finally { S.busy = false; paint(); }
    },
    yes: async function (kind, id) {
      if (S.busy) return; S.busy = true;
      var f = fb();
      try {
        if (kind === "decline") {
          var req = S.requests.find(function (x) { return x.id === id; });
          var r = await f.setMemberStatus(id, "declined");
          S.open = null;
          if (r.saved) { S.requests = S.requests.filter(function (x) { return x.id !== id; }); S.msg.req = "הבקשה נדחתה" + (req ? ": " + req.name : ""); log("join", "נדחתה בקשת הצטרפות" + (req ? ": " + req.name : ""), "join.decline", req ? req.name : "", id); }
          else S.msg.req = "לא נשמר (" + why(r) + ")";
        } else if (kind === "inactive" || kind === "active") {
          var c = findCon(id);
          var r2 = await f.setMemberStatus(id, kind);
          S.open = null;
          if (r2.saved && c) { c.status = kind; S.msg[id] = kind === "inactive" ? "עכשיו לא פעיל" : "חזר לפעיל"; log("members", (kind === "inactive" ? "מתפלל סומן לא פעיל: " : "מתפלל חזר לפעיל: ") + (c.name || c.email), kind === "inactive" ? "member.inactive" : "member.active", c.name || c.email, id); }
          else S.msg[id] = "לא נשמר (" + why(r2) + ")";
        }
      } finally { S.busy = false; paint(); }
    },

    /* ================= congregant page: the join screen ================= */
    renderJoin: function (host, state, prefill) {
      /* state: "form" | "pending" | "declined" | "again" (the form again, after a decline) */
      if (!host) return;
      if (state === "pending") {
        host.innerHTML = '<section class="ohm-join gold-frame" data-join="sent"><h2>הבקשה נשלחה</h2><p class="ohm-big">הגבאי יאשר בקרוב.</p></section>';
        return;
      }
      if (state === "declined") {
        /* Stage D2 (Hanoch 5:19 PM): a declined person may send the request again. */
        host.innerHTML = '<section class="ohm-join gold-frame" data-join="declined"><h2>בקשת הצטרפות</h2><p class="ohm-big">הבקשה לא אושרה. לפרטים אפשר לפנות לגבאי.</p>' +
          '<button type="button" class="ohm-btn ohm-wide" id="ohmAgain" onclick="OH_MEMBERS.again()">שלח בקשה שוב</button></section>';
        return;
      }
      var pre = (state === "again" && prefill) ? prefill : {};
      host.innerHTML = '<section class="ohm-join gold-frame" data-join="' + (state === "again" ? "again" : "form") + '"><h2>בקשת הצטרפות כמתפלל</h2>' +
        '<label for="ohmName">שם מלא</label><input id="ohmName" autocomplete="name" maxlength="80" value="' + esc(pre.name || "") + '">' +
        '<label for="ohmPhone">טלפון</label><input id="ohmPhone" type="tel" inputmode="tel" autocomplete="tel" dir="ltr" maxlength="30" value="' + esc(pre.phone || "") + '">' +
        '<button type="button" class="ohm-btn ohm-wide" id="ohmSend" onclick="OH_MEMBERS.send()">שלח בקשה</button><p class="ohm-msg" id="ohmMsg" role="status"></p></section>';
    },
    send: async function () {
      var btn = document.getElementById("ohmSend"), msg = document.getElementById("ohmMsg");
      if (!btn || btn.disabled) return;
      var name = document.getElementById("ohmName").value, phone = document.getElementById("ohmPhone").value;
      if (String(name).trim().length < 2) { msg.textContent = "חסר שם מלא"; return; }
      if (String(phone).replace(/\D/g, "").length < 7) { msg.textContent = "מספר הטלפון לא תקין"; return; }
      btn.disabled = true; msg.textContent = "שולח...";
      var sec = btn.closest("[data-join]"), isAgain = !!(sec && sec.getAttribute("data-join") === "again");
      var r = isAgain ? await fb().resendJoinRequest({ name: name, phone: phone }) : await fb().sendJoinRequest({ name: name, phone: phone });
      btn.disabled = false;
      if (r && r.saved) { api.renderJoin(btn.closest("#card") || document.getElementById("card"), r.status === "declined" ? "declined" : "pending"); }
      else msg.textContent = why(r) + ". אפשר לנסות שוב.";
    },
    /* Stage D2: "שלח בקשה שוב" opens the same form, name and phone from the old request. */
    again: async function () {
      var btn = document.getElementById("ohmAgain");
      if (!btn || btn.disabled) return;
      btn.disabled = true;
      var old = null;
      try { old = await fb().loadMyJoinRequest(); } catch (e) {}
      api.renderJoin(btn.closest("#card") || document.getElementById("card"), "again", old || {});
      var n = document.getElementById("ohmName");
      if (n) { try { n.focus(); } catch (e) {} }
    }
  };
  window.OH_MEMBERS = api;
})();
