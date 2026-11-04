/* Or Hachaim | 2040 phase 1 | the language switch for the older page bodies
   (src/ui/oh-i18n.js, loaded by the shared top bar oh-shell.js).
   Hebrew is the default and nothing here runs in Hebrew unless Hanoch has
   reworded a Hebrew text in labels.js (OH_PAGE_TEXT_HE).
   In English ("EN" in the top bar) it swaps every text the older pages show,
   using the word lists in src/ui/labels.js:
     OH_PAGE_TEXT_EN   Hebrew text exactly as on the page -> English
                       ({x} stands for a number, a date or a name)
     OH_EN_REGISTER    the house English (Shul, Davening Times, Mitpalelim...)
   A page text written "עברית / English" shows its English half, in the house
   English. Names, Hebrew dates and what the gabbaim typed stay as typed.
   The TV preview inside the page is the TV's own page and is not touched. */
(function () {
  "use strict";
  var EN = window.OH_LANG === "en";
  var HEMAP = window.OH_PAGE_TEXT_HE || {}, ENMAP = window.OH_PAGE_TEXT_EN || {};
  var hasHe = Object.keys(HEMAP).length > 0, hasReg = (window.OH_EN_REGISTER || []).length > 0;
  /* Hebrew: the English halves of "עברית / English" texts still get the house English */
  if (!EN && !hasHe && !hasReg) { window.OH_I18N = { active: false }; return; }
  var HEB = /[\u0590-\u05FF]/, LAT = /[A-Za-z]/;
  function norm(s) { return String(s).replace(/\s+/g, " ").trim(); }
  function reEsc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function compile(map) {
    var exact = {}, pats = [];
    Object.keys(map).forEach(function (k) {
      var nk = norm(k);
      if (/\{x\}/.test(nk)) pats.push({ re: new RegExp("^" + nk.split("{x}").map(reEsc).join("(.+?)") + "$"), to: map[k] });
      else exact[nk] = map[k];
    });
    return { exact: exact, pats: pats };
  }
  var D = compile(ENMAP), DH = compile(HEMAP);
  var REG = (window.OH_EN_REGISTER || []).map(function (r) { return [new RegExp(r[0], "g"), r[1]]; });
  function register(s) { REG.forEach(function (r) { s = s.replace(r[0], r[1]); }); return s; }
  function lookup(d, t) {
    if (Object.prototype.hasOwnProperty.call(d.exact, t)) return d.exact[t];
    for (var i = 0; i < d.pats.length; i++) {
      var m = t.match(d.pats[i].re);
      if (m) { var j = 0; return d.pats[i].to.replace(/\{x\}/g, function () { j++; return m[j] != null ? (HEB.test(m[j]) && EN ? (tr(m[j]) || m[j]) : m[j]) : ""; }); }
    }
    return null;
  }
  /* "עברית / English. עברית / English." -> "English. English." */
  function englishHalf(t) {
    if (!HEB.test(t) || !LAT.test(t)) return null;
    var parts = [];
    t.split(" / ").forEach(function (p) { p.replace(/([.:!?])\s+/g, "$1\u0001").split("\u0001").forEach(function (q) { parts.push(q); }); });
    var keep = parts.map(norm).filter(function (p) { return p && !HEB.test(p) && LAT.test(p); });
    if (!keep.length) return null;
    return keep.join(" ").replace(/^[\/|]\s*/, "");
  }
  function tr(t) {
    if (!t || !HEB.test(t)) return null;
    var h = lookup(DH, t); if (h != null) { if (!EN) return h; t = norm(h); }
    if (!EN) { if (!LAT.test(t)) return null; var rg = register(t); return rg !== t ? rg : null; }
    var e = lookup(D, t); if (e != null) return e;
    var half = englishHalf(t); if (half) return register(half);
    return null;
  }
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, IFRAME: 1, CODE: 1 };
  var done = new WeakMap();
  function skipEl(el) {
    for (var e = el; e && e.nodeType === 1; e = e.parentElement) {
      if (SKIP[e.tagName] || e.hasAttribute("data-no-i18n") || e.isContentEditable) return true;
      if (e.classList && (e.classList.contains("sh-sheet") || e.classList.contains("ohx") || e.id === "ohaTopbar" || e.id === "ohaBnav" || e.id === "ptSection" || e.id === "ttSection")) return true;
    }
    return false;
  }
  function doText(n) {
    var v = n.nodeValue; if (!v) return;
    if (!HEB.test(v)) {
      /* an English-only text (either language): house English only (Mitpalelim, Davening Times...) */
      if (!LAT.test(v) || done.get(n) === v || skipEl(n.parentElement)) return;
      var r0 = register(v); if (r0 !== v) n.nodeValue = r0; done.set(n, n.nodeValue); return;
    }
    if (done.get(n) === v) return;
    if (skipEl(n.parentElement)) return;
    var t = norm(v), out = tr(t);
    if (out != null && out !== t) {
      var lead = /^\s/.test(v) ? " " : "", trail = /\s$/.test(v) ? " " : "";
      n.nodeValue = lead + out + trail; done.set(n, n.nodeValue);
    } else done.set(n, v);
  }
  var ATTRS = ["placeholder", "aria-label", "title", "alt"];
  function doAttrs(el) {
    if (skipEl(el)) return;
    ATTRS.forEach(function (a) { var v = el.getAttribute(a); if (v && HEB.test(v)) { var o = tr(norm(v)); if (o != null) el.setAttribute(a, o); } });
    if (el.tagName === "INPUT" && /^(button|submit|reset)$/i.test(el.type) && HEB.test(el.value)) { var o = tr(norm(el.value)); if (o != null) el.value = o; }
    if (el.tagName === "OPTION" && HEB.test(el.textContent)) { /* text nodes do it */ }
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1) { if (SKIP[root.tagName]) return; doAttrs(root); }
    var tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null);
    var n; while ((n = tw.nextNode())) { if (n.nodeType === 3) doText(n); else doAttrs(n); }
  }
  var busy = false;
  var mo = new MutationObserver(function (list) {
    if (busy) return; busy = true;
    try {
      list.forEach(function (m) {
        if (m.type === "characterData") doText(m.target);
        else if (m.type === "attributes") doAttrs(m.target);
        else m.addedNodes.forEach(function (x) { walk(x); });
      });
    } finally { busy = false; }
  });
  function start() {
    walk(document.body);
    if (EN && document.title && HEB.test(document.title)) { var tt = tr(norm(document.title)); if (tt) document.title = tt; }
    mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS.concat(["value"]) });
  }
  /* the older pages ask with confirm()/alert(): those words switch too */
  if (EN) {
    ["confirm", "alert"].forEach(function (fn) {
      var orig = window[fn]; if (!orig) return;
      window[fn] = function (msg) { var s = String(msg == null ? "" : msg); return orig.call(window, s.split("\n").map(function (l) { var o = tr(norm(l)); return o != null ? o : l; }).join("\n")); };
    });
  }
  window.OH_I18N = { active: true, tr: tr, englishHalf: englishHalf, walk: walk };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
