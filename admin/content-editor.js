/* Screen content editor (admin page), stage v4 2026-11-03.
   For a gabbai with Content and Times permission and the super admin
   only (a finance-only gabbai never sees it; the rules enforce the
   same thing on the server). Phone and computer.
   Stage 2 (2026-11-03): this editor replaces every local placeholder
   section of the old admin page (announcements, dedications and
   sponsors, flyers, yahrzeit, images) in one flow. It writes to the
   existing content collections (announcements, dedications, sponsors,
   flyers, yahrzeits, chosen by type) plus one activityLog line per save
   that keeps the version for history and restore, and images to Storage
   under screen/ for accounts with image upload.
   - every item type in the plan: announcements, dedications (including
     permanent leiluy nishmat), flyers with an image, yahrzeit (entered
     once, shown every year in its week), Kiddush / Seudah Shlishit
     sponsors, Parnas Hayom / Ner LaMaor, Mazal Tov, hazkarot and
     condolences, rabbi message / Shabbat blessing, campaign board,
     donation block;
   - start and end date, weekday-only / Shabbat-only, public (/tv/) (the
     "protected screen only" choice was removed in v5.3.2: screen/index.html
     was deleted on Nov 3, 2026), order;
   - live 16:9 TV preview (the real /tv/ page, 1920x1080, scaled) with a
     weekday / Shabbat switch, BEFORE publishing;
   - change history for every item, with restore of any version
     (restore is a new version, nothing is deleted).
   Placeholders only in the fields; nothing is pre-filled. */
(function () {
  "use strict";
  var E = window.OH_DISPLAY, SC = window.OH_SCREEN_CONTENT;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var TYPE_ORDER = ["announcement", "dedication", "flyer", "yahrzeit", "sponsor", "parnas", "mazaltov", "hazkara", "rabbi", "campaign", "donation"];
  var TYPE_LABEL = { announcement: "הכרזה", dedication: "הקדשה", flyer: "פלייר", yahrzeit: "יארצייט", sponsor: "חסות קידוש / סעודה שלישית", parnas: "פרנס היום / נר למאור",
    mazaltov: "מזל טוב", hazkara: "הזכרה / תנחומים", rabbi: "הודעת הרב / ברכת שבת", campaign: "מבצע / מגבית", donation: "תרומה (Zelle / QR)" };
  var STATUS_LABEL = { draft: "טיוטה", published: "מפורסם", archived: "בארכיון" };
  var WHY = { "ok": "יוצג עכשיו במסך", "not-published": "לא מפורסם (טיוטה)", "screen-only": "רק במסך המוגן, לא ב-/tv/", "before-start": "עוד לא התחיל (לפני תאריך ההתחלה)",
    "after-end": "הסתיים (אחרי תאריך הסיום)", "not-yahrzeit-week": "יוצג אוטומטית בשבוע היארצייט", "rest-type": "מוסתר בשבת וחג: סוג זה תמיד יום חול בלבד",
    "rest-payment-flag": "מוסתר בשבת וחג: מסומן כתשלום", "rest-payment-text": "מוסתר בשבת וחג: המערכת זיהתה טקסט תשלום", "rest-flag": "מוסתר בשבת וחג: סומן יום חול בלבד", "shabbat-only": "מוצג רק בשבת וחג" };
  var IMAGE_TYPES = { flyer: 1, donation: 1, announcement: 1, campaign: 1 };
  var st = { items: [], role: null, filter: "active", typeFilter: "", editing: null, rest: false, pvReady: false, unsub: null, image: null, dirty: false };

  function today() { return E.nyParts(new Date()).key; }
  function fmtDate(k) { if (!k) return ""; var p = k.split("-"); return +p[2] + "." + +p[1] + "." + p[0]; }
  function fmtStamp(v) {
    if (!v) return ""; var d = new Date(v); if (isNaN(d)) return "";
    return d.toLocaleString("he-IL", { timeZone: "America/New_York", day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  function windowText(it) {
    if (it.type === "yahrzeit") { var y = it.yahrzeit || {}; return y.hDay ? "כל שנה, שבוע " + E.hebrewDayMonthLabel(+y.hDay, y.hMonth) : ""; }
    if (it.type === "dedication" && it.permanent) return "קבוע, מ-" + fmtDate(it.startDate);
    return fmtDate(it.startDate) + (it.endDate ? " עד " + fmtDate(it.endDate) : " ללא סיום");
  }

  /* ---------- list ---------- */
  function renderList() {
    var box = $("scList"); if (!box) return;
    var rest = typeof st.restNow === "boolean" ? st.restNow : false;
    var list = st.items.filter(function (it) {
      if (st.typeFilter && it.type !== st.typeFilter) return false;
      if (st.filter === "active") return it.status !== "archived";
      if (st.filter === "archived") return it.status === "archived";
      if (st.filter === "draft") return it.status === "draft";
      if (st.filter === "published") return it.status === "published";
      return true;
    }).sort(function (a, b) { return String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")); });
    if (!list.length) { box.innerHTML = '<p class="sc-empty">אין פריטים ברשימה זו עדיין. לחצו "פריט חדש" כדי להוסיף.</p>'; return; }
    box.innerHTML = list.map(function (it) {
      var v = E.visibility(it, { todayKey: today(), rest: rest });
      var name = it.type === "yahrzeit" ? ((it.yahrzeit || {}).nameHe || "") : (it.titleHe || (it.bodyHe || "").slice(0, 60));
      var live = it.status === "published" && v.show;
      return '<article class="sc-row' + (live ? " is-live" : "") + '">' +
        '<div class="sc-row-main"><span class="sc-type">' + esc(TYPE_LABEL[it.type] || it.type) + '</span>' +
        '<strong class="sc-title">' + esc(name || "(ללא כותרת)") + "</strong>" +
        '<span class="sc-state"><span class="sc-meta">' + esc(windowText(it)) + (it.visibility === "screen" ? " | מסך מוגן בלבד" : "") + "</span>" +
        '<span class="sc-state"><span class="sc-badge st-' + esc(it.status) + '">' + esc(STATUS_LABEL[it.status] || it.status) + "</span>" +
        (it.status === "published" ? '<span class="sc-why' + (live ? " ok" : "") + '">' + esc(WHY[v.why] || v.why) + "</span>" : "") + "</span></span></div>" +
        '<div class="sc-row-actions"><button class="btn secondary sc-sm" data-act="edit" data-id="' + esc(it.id) + '">עריכה</button>' +
        '<button class="btn secondary sc-sm" data-act="history" data-id="' + esc(it.id) + '">היסטוריה</button>' +
        (it.status === "archived" ? '<button class="btn secondary sc-sm" data-act="unarchive" data-id="' + esc(it.id) + '">החזרה מהארכיון</button>'
          : '<button class="btn secondary sc-sm" data-act="archive" data-id="' + esc(it.id) + '">לארכיון</button>') + "</div></article>";
    }).join("");
  }

  /* ---------- form ---------- */
  function fieldsFor(type) {
    var subs = E.SUBTYPES[type];
    $("scSubWrap").hidden = !subs;
    if (subs) $("scSub").innerHTML = Object.keys(subs).map(function (k) { return '<option value="' + k + '">' + esc(subs[k]) + "</option>"; }).join("");
    $("scYzWrap").hidden = type !== "yahrzeit";
    $("scCampWrap").hidden = type !== "campaign";
    $("scImgWrap").hidden = !IMAGE_TYPES[type];
    $("scImgLabel").textContent = type === "donation" ? "קוד QR (תמונה)" : (type === "flyer" ? "תמונת הפלייר" : "תמונה (רשות)");
    $("scPermWrap").hidden = type !== "dedication";
    $("scTitleWrap").hidden = type === "yahrzeit";
    $("scWhenWrap").hidden = type === "yahrzeit";
    $("scShowWrap").hidden = type === "donation" || type === "campaign";
    $("scForcedNote").hidden = !(type === "donation" || type === "campaign");
    $("scBodyLabel").textContent = type === "yahrzeit" ? "הערה (רשות), למשל שעת אזכרה" : "טקסט בעברית";
    syncEnd();
  }
  function syncEnd() { var perm = $("scType").value === "dedication" && $("scPerm").checked; $("scEnd").disabled = perm; if (perm) $("scEnd").value = ""; }
  function readForm() {
    var type = $("scType").value, it = {
      id: st.editing && st.editing.id, col: st.editing && !st.editing._new ? st.editing.col : undefined, type: type,
      subtype: E.SUBTYPES[type] ? $("scSub").value : "",
      titleHe: $("scTitleHe").value, titleEn: $("scTitleEn").value, bodyHe: $("scBodyHe").value, bodyEn: $("scBodyEn").value,
      startDate: $("scStart").value, endDate: $("scEnd").value,
      showOn: (document.querySelector('input[name="scShowOn"]:checked') || {}).value || "all",
      hasPayment: $("scPay").checked, visibility: (document.querySelector('input[name="scVis"]:checked') || {}).value || "public",
      permanent: type === "dedication" && $("scPerm").checked, order: parseInt($("scOrder").value, 10) || 100,
      status: st.editing ? st.editing.status || "draft" : "draft"
    };
    if (type === "yahrzeit") it.yahrzeit = { nameHe: $("scYzName").value.trim(), nameEn: $("scYzNameEn").value.trim(), hDay: parseInt($("scYzDay").value, 10) || 0, hMonth: $("scYzMonth").value, hYear: parseInt($("scYzYear").value, 10) || null };
    if (type === "yahrzeit" && !it.yahrzeit.hYear) delete it.yahrzeit.hYear;
    if (type === "campaign") it.campaign = { goal: parseFloat($("scGoal").value) || 0, raised: parseFloat($("scRaised").value) || 0 };
    if (IMAGE_TYPES[type] && st.image) it.image = st.image;
    if (type === "yahrzeit") { it.startDate = ""; it.endDate = ""; }
    return it;
  }
  function fillForm(it) {
    $("scType").value = it.type || "announcement"; fieldsFor($("scType").value);
    if (it.subtype && E.SUBTYPES[it.type]) $("scSub").value = it.subtype;
    $("scTitleHe").value = it.titleHe || ""; $("scTitleEn").value = it.titleEn || ""; $("scBodyHe").value = it.bodyHe || ""; $("scBodyEn").value = it.bodyEn || "";
    $("scStart").value = it.startDate || today(); $("scEnd").value = it.endDate || "";
    var so = document.querySelector('input[name="scShowOn"][value="' + (it.showOn || "all") + '"]'); if (so) so.checked = true;
    var vi = document.querySelector('input[name="scVis"][value="' + (it.visibility || "public") + '"]'); if (vi) vi.checked = true;
    $("scPay").checked = it.hasPayment === true; $("scPerm").checked = it.permanent === true; $("scOrder").value = it.order || 100;
    var y = it.yahrzeit || {};
    $("scYzName").value = y.nameHe || ""; $("scYzNameEn").value = y.nameEn || ""; $("scYzDay").value = y.hDay || ""; $("scYzMonth").value = y.hMonth || "tishrei"; $("scYzYear").value = y.hYear || "";
    var c = it.campaign || {}; $("scGoal").value = c.goal || ""; $("scRaised").value = c.raised || "";
    st.image = it.image || null; renderImage();
    syncEnd(); onChange();
  }
  function renderImage() {
    var b = $("scImgPrev"); if (!b) return;
    b.innerHTML = st.image ? '<img src="' + esc(st.image.url) + '" alt=""><button type="button" class="btn secondary sc-sm" id="scImgDel">הסרת התמונה</button>' : "";
    var del = $("scImgDel"); if (del) del.onclick = function () { st.image = null; renderImage(); onChange(); };
  }
  /* Warnings under the form: what the system will do with this item. */
  function warnings(it) {
    var w = [], r = E.weekdayOnlyReason(it);
    if (r === "type") w.push("סוג זה (תרומה / מגבית) מוסתר תמיד בשבת וחג, אוטומטית.");
    else if (r === "payment-text") w.push("זוהה טקסט תשלום (Zelle / QR / $ / תרומה): הפריט יוסתר אוטומטית בשבת וחג.");
    else if (r === "payment-flag") w.push("מסומן כתשלום: יוסתר אוטומטית בשבת וחג.");
    else if (r === "flag") w.push("יום חול בלבד: יוסתר בשבת וחג.");
    if (it.type === "flyer" && it.image && !it.hasPayment && it.showOn !== "weekday") w.push("המערכת לא קוראת טקסט בתוך תמונה: אם בפלייר יש תשלום, QR או Zelle, סמנו \"מכיל תשלום\".");
    if (it.type === "yahrzeit" && it.yahrzeit && it.yahrzeit.hDay) {
      var hy = E.hebParts(today()).year, d = E.yahrzeitDates(it.yahrzeit, hy).concat(E.yahrzeitDates(it.yahrzeit, hy + 1)).filter(function (x) { return x.key >= today(); })[0];
      if (d) { var h = E.hebParts(d.key); w.push("היארצייט הבא: " + E.hebrewDayMonthLabel(h.day, h.month) + " (" + fmtDate(d.key) + "), יוצג בשבוע הזה" + (d.check ? ". לבדיקה: לא הוזנה שנת פטירה, ותאריך ל׳ לא קיים השנה." : ".")); }
      if (it.yahrzeit.hMonth === "adar") w.push("נפטר באדר של שנה רגילה: בשנה מעוברת יוצג באדר ב׳ (מנהג ספרד, לאישור הרב).");
    }
    var v = E.visibility(Object.assign({}, it, { status: "published" }), { todayKey: today(), rest: st.rest });
    w.push((st.rest ? "בתצוגת שבת: " : "בתצוגת חול: ") + (v.show ? "יוצג" : (WHY[v.why] || v.why)));
    return w;
  }
  var pvTimer = null;
  function onChange() {
    st.dirty = true;
    var it = readForm();
    $("scWarn").innerHTML = warnings(it).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("");
    clearTimeout(pvTimer); pvTimer = setTimeout(postPreview, 250);
  }
  function postPreview(item) {
    var fr = $("scPv"); if (!fr || !fr.contentWindow) return;
    var it = item || readForm();
    try { fr.contentWindow.postMessage({ type: "oh-preview", item: Object.assign({}, it, { status: "published", id: it.id || "preview" }), rest: st.rest }, location.origin); } catch (e) {}
    var v = E.visibility(Object.assign({}, it, { status: "published" }), { todayKey: today(), rest: st.rest });
    $("scPvNote").textContent = v.show ? (st.rest ? "כך זה ייראה בשבת ובחג" : "כך זה ייראה ביום חול") : ("לא יוצג במצב זה: " + (WHY[v.why] || v.why));
    $("scPvNote").className = "sc-pv-note" + (v.show ? "" : " is-hidden");
  }
  function scalePreview() {
    var box = $("scPvBox"), fr = $("scPv"); if (!box || !fr) return;
    var big = box.parentNode.classList.contains("is-big");
    box.style.width = "";
    var s = big ? Math.min(Math.min(window.innerWidth * 0.94, 1600) / 1920, (window.innerHeight * 0.78) / 1080) : box.clientWidth / 1920;
    if (big) box.style.width = Math.round(1920 * s) + "px";
    fr.style.transform = "scale(" + s + ")"; box.style.height = Math.round(1080 * s) + "px";
  }

  /* ---------- editor open / save ---------- */
  function openEditor(it) {
    st.editing = it ? Object.assign({}, it) : { id: SC.newId ? SC.newId() : null, status: "draft", _new: true };
    $("scEditor").hidden = false; $("scHistory").innerHTML = "";
    $("scEdTitle").textContent = it ? "עריכת פריט" : "פריט חדש";
    fillForm(it || { type: $("scTypeFilter").value || "announcement", startDate: today() });
    $("scMsg").textContent = ""; st.dirty = false;
    lockType();
    updateButtons();
    setTimeout(function () { scalePreview(); postPreview(); }, 50);
    $("scEditor").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  /* A saved item stays in its collection, so its type is fixed after the
     first save (moving it would need a delete, which only the super admin
     has). To change the type: a new item, and archive this one. */
  function lockType() {
    var saved = !!(st.editing && st.editing.id && !st.editing._new);
    $("scType").disabled = saved;
    $("scType").title = saved ? "אחרי השמירה הראשונה סוג הפריט קבוע. לשינוי: פריט חדש, ואת זה להעביר לארכיון. / The type is fixed after the first save." : "";
  }
  function updateButtons() {
    var e = st.editing || {};
    $("scPublish").textContent = e.status === "published" ? "עדכון במסך" : "פרסום למסך";
    $("scUnpublish").hidden = e.status !== "published";
  }
  async function doSave(status) {
    var it = readForm(); it.status = status;
    var errs = SC.validate(SC.clean(it));
    if (errs.length) { $("scMsg").innerHTML = '<span class="sc-err">' + errs.map(esc).join("<br>") + "</span>"; return; }
    if (status === "published") {
      var vW = E.visibility(Object.assign({}, it), { todayKey: today(), rest: false }), vS = E.visibility(Object.assign({}, it), { todayKey: today(), rest: true });
      var txt = "לפרסם למסך?\n" + (it.type === "yahrzeit" ? windowText(it) : ("מוצג: " + windowText(it))) + "\nיום חול: " + (vW.show ? "מוצג היום" : (WHY[vW.why] || vW.why)) + "\nשבת וחג: " + (vS.show ? "מוצג" : (WHY[vS.why] || vS.why)) + "\n\nבדקתם את התצוגה המקדימה בשני המצבים?";
      if (!confirm(txt)) return;
    }
    $("scMsg").textContent = "שומר...";
    var action = status === "published" ? "publish" : (st.editing && st.editing.status === "published" && status === "draft" ? "unpublish" : null);
    var r = await SC.save(it, action);
    if (r && r.saved) {
      st.editing.id = r.id; st.editing.col = r.col; st.editing.status = status; st.editing.version = r.version; st.editing._new = false; st.dirty = false;
      lockType();
      $("scMsg").innerHTML = '<span class="sc-ok">' + (status === "published" ? "פורסם. המסך מתעדכן תוך שניות." : "נשמר כטיוטה, לא מוצג במסך.") + " (גרסה " + r.version + ")</span>";
      updateButtons();
    } else {
      var why = r && r.errors ? r.errors.join(", ") : (r && r.reason === "permission-denied" ? "אין הרשאה לשמור (בדקו הרשאת תוכן וזמנים)" : (r && r.reason === "type-moves-collection" ? "אי אפשר לשנות סוג של פריט שמור. צרו פריט חדש והעבירו את זה לארכיון" : (r && r.reason) || "שגיאה"));
      $("scMsg").innerHTML = '<span class="sc-err">השמירה נכשלה, שום דבר לא נשמר: ' + esc(why) + "</span>";
    }
  }
  async function showHistory(id) {
    var it = st.items.filter(function (x) { return x.id === id; })[0];
    if (it && (!st.editing || st.editing.id !== id)) openEditor(it);
    var box = $("scHistory"); box.innerHTML = "<p>טוען היסטוריה...</p>";
    var r = await SC.history(id);
    if (!r.ok) { box.innerHTML = '<p class="sc-err">טעינת ההיסטוריה נכשלה: ' + esc(r.reason) + "</p>"; return; }
    var ACT = { create: "נוצר", update: "עודכן", publish: "פורסם", unpublish: "הורד מהמסך", archive: "הועבר לארכיון", restore: "שוחזר" };
    box.innerHTML = '<h3>היסטוריית שינויים</h3><ol class="sc-hist">' + r.versions.map(function (v) {
      return '<li><span class="sc-hv">גרסה ' + v.version + "</span> <span>" + esc(ACT[v.action] || v.action) + (v.restoredFromVersion ? " מגרסה " + v.restoredFromVersion : "") + "</span> <span class=\"sc-meta\">" + esc(fmtStamp(v.savedAt)) + " | " + esc(v.savedBy || "") + "</span>" +
        ' <button type="button" class="btn secondary sc-sm" data-hact="view" data-v="' + v.version + '">הצגה בתצוגה</button>' +
        (v.version !== (it && it.version) ? ' <button type="button" class="btn secondary sc-sm" data-hact="restore" data-v="' + v.version + '">שחזור גרסה זו</button>' : ' <span class="sc-badge st-published">הגרסה הנוכחית</span>') + "</li>";
    }).join("") + "</ol>";
    box.onclick = async function (ev) {
      var b = ev.target.closest("button[data-hact]"); if (!b) return;
      var ver = r.versions.filter(function (x) { return String(x.version) === b.getAttribute("data-v"); })[0]; if (!ver) return;
      if (b.getAttribute("data-hact") === "view") { postPreview(Object.assign({}, ver.snapshot, { id: id })); $("scPvNote").textContent = "מוצגת גרסה " + ver.version + " (לא נשמר שום דבר)"; return; }
      if (!confirm("לשחזר את גרסה " + ver.version + "? זו תהיה גרסה חדשה, והגרסה הנוכחית נשארת בהיסטוריה.")) return;
      var res = await SC.restore(id, ver, it && it.col);
      if (res.saved) { $("scMsg").innerHTML = '<span class="sc-ok">שוחזר מגרסה ' + ver.version + " (גרסה חדשה " + res.version + ")</span>"; var cur = Object.assign({}, ver.snapshot, { id: id, col: res.col, version: res.version }); st.editing = cur; fillForm(cur); updateButtons(); showHistory(id); }
      else $("scMsg").innerHTML = '<span class="sc-err">השחזור נכשל: ' + esc(res.reason) + "</span>";
    };
  }

  /* ---------- wiring ---------- */
  function bind() {
    var root = $("screenContent"); if (!root || root._bound) return; root._bound = true;
    $("scType").innerHTML = TYPE_ORDER.map(function (t) { return '<option value="' + t + '">' + esc(TYPE_LABEL[t]) + "</option>"; }).join("");
    $("scTypeFilter").innerHTML = '<option value="">כל הסוגים</option>' + TYPE_ORDER.map(function (t) { return '<option value="' + t + '">' + esc(TYPE_LABEL[t]) + "</option>"; }).join("");
    $("scYzMonth").innerHTML = E.MONTHS.map(function (m) { return '<option value="' + m + '">' + esc(E.MONTH_HE[m] + (m === "adar" ? " (שנה רגילה)" : "")) + "</option>"; }).join("");
    $("scYzDay").innerHTML = '<option value="">יום</option>' + Array.apply(null, Array(30)).map(function (_, i) { return '<option value="' + (i + 1) + '">' + E.hebrewNumeral(i + 1) + "</option>"; }).join("");
    $("scType").addEventListener("change", function () { fieldsFor(this.value); onChange(); });
    $("scPerm").addEventListener("change", function () { syncEnd(); onChange(); });
    $("scForm").addEventListener("input", onChange);
    $("scForm").addEventListener("change", onChange);
    $("scForm").addEventListener("submit", function (e) { e.preventDefault(); });
    $("scNew").addEventListener("click", function () { openEditor(null); });
    $("scCancel").addEventListener("click", function () { if (st.dirty && !confirm("לצאת בלי לשמור?")) return; $("scEditor").hidden = true; st.editing = null; });
    $("scDraft").addEventListener("click", function () { doSave("draft"); });
    $("scPublish").addEventListener("click", function () { doSave("published"); });
    $("scUnpublish").addEventListener("click", function () { if (confirm("להוריד מהמסך? הפריט יישמר כטיוטה.")) doSave("draft"); });
    document.querySelectorAll(".sc-pv-tabs button").forEach(function (b) {
      b.addEventListener("click", function () {
        st.rest = b.getAttribute("data-rest") === "1";
        document.querySelectorAll(".sc-pv-tabs button").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        onChange(); postPreview();
      });
    });
    document.querySelectorAll(".sc-filter button").forEach(function (b) {
      b.addEventListener("click", function () { st.filter = b.getAttribute("data-f"); document.querySelectorAll(".sc-filter button").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); }); renderList(); });
    });
    $("scPvBig").addEventListener("click", function () {
      var pv = this.closest(".sc-preview"), on = !pv.classList.contains("is-big");
      pv.classList.toggle("is-big", on); this.setAttribute("aria-pressed", on ? "true" : "false"); this.textContent = on ? "סגירת ההגדלה" : "הגדלה";
      scalePreview();
    });
    document.addEventListener("keydown", function (ev) { if (ev.key === "Escape") { var pv = document.querySelector(".sc-preview.is-big"); if (pv) $("scPvBig").click(); } });
    $("scTypeFilter").addEventListener("change", function () { st.typeFilter = this.value; renderList(); });
    $("scList").addEventListener("click", async function (ev) {
      var b = ev.target.closest("button[data-act]"); if (!b) return;
      var id = b.getAttribute("data-id"), it = st.items.filter(function (x) { return x.id === id; })[0]; if (!it) return;
      var act = b.getAttribute("data-act");
      if (act === "edit") openEditor(it);
      else if (act === "history") showHistory(id);
      else if (act === "archive" || act === "unarchive") {
        if (act === "archive" && !confirm("להעביר לארכיון? הפריט יורד מהמסך ונשמר בהיסטוריה.")) return;
        var r = await SC.setStatus(it, act === "archive" ? "archived" : "draft");
        if (!r.saved) alert("הפעולה נכשלה: " + (r.reason || ""));
      }
    });
    $("scImg").addEventListener("change", async function () {
      var f = this.files && this.files[0]; if (!f) return;
      var msg = $("scImgMsg");
      if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { msg.textContent = "רק JPG, PNG או WebP."; this.value = ""; return; }
      msg.textContent = "מעלה...";
      var r = await SC.uploadImage(f, $("scType").value, st.editing && st.editing.id);
      if (r.ok) { st.image = r.image; renderImage(); msg.textContent = "התמונה הועלתה. היא תוצג רק אחרי פרסום."; onChange(); }
      else msg.textContent = r.reason === "no-image-permission" ? "אין הרשאה להעלאת תמונות." : (r.reason === "too-big" ? "התמונה גדולה מדי (עד 5MB אחרי הקטנה)." : "ההעלאה נכשלה: " + r.reason);
      this.value = "";
    });
    $("scYzCalc").addEventListener("click", function () {
      var g = $("scYzGreg").value; if (!E.isDateKey(g)) { $("scYzCalcMsg").textContent = "בחרו תאריך לועזי."; return; }
      var k = $("scYzAfter").checked ? E.addDays(g, 1) : g, h = E.hebParts(k);
      $("scYzDay").value = h.day; $("scYzMonth").value = h.month; $("scYzYear").value = h.year;
      $("scYzCalcMsg").textContent = "תאריך הפטירה: " + E.hebrewDayMonthLabel(h.day, h.month) + " " + h.year; onChange();
    });
    window.addEventListener("message", function (ev) { if (ev.origin === location.origin && ev.data && ev.data.type === "oh-preview-ready") { st.pvReady = true; postPreview(); } });
    window.addEventListener("resize", scalePreview);
  }
  async function refresh() {
    var fb = window.OH_FIREBASE, root = $("screenContent"); if (!root || !E || !SC) return;
    if (!fb || !fb.ready || !fb.user) { root.hidden = true; if (st.unsub) { st.unsub(); st.unsub = null; } return; }
    var role = await fb.resolveRole();
    if (!SC.canEdit(role)) { root.hidden = true; return; }
    st.role = role; root.hidden = false; bind();
    $("scImgWrapNote").hidden = true; /* 2040 phase 1: no "no permission" notes; without upload permission the image field is not shown */
    document.body.classList.toggle("sc-no-upload", !SC.canUpload(role));
    $("scImg").disabled = !SC.canUpload(role); /* no image upload permission: no active upload control */
    if (!st.unsub) st.unsub = SC.subscribe("editor", function (items, err) {
      if (items) { st.items = items; $("scListMsg").textContent = ""; } else $("scListMsg").textContent = "טעינת התוכן נכשלה: " + err;
      renderList();
    });
    st.restNow = E.isRestTime(new Date(), null); /* list hint only (no daily JSON on this page: Friday from 16:00, the safe side) */
  }
  setInterval(refresh, 1500); refresh();
  window.OH_CONTENT_EDITOR = { open: openEditor, _st: st, postPreview: postPreview, scale: scalePreview };
})();
