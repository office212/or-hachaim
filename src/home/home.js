/* Or Hachaim | public landing page: puts the words from home-texts.js on the page
   and builds the contact cards. No login, no Firestore, no network. */
(function () {
  var T = window.OH_HOME_TEXTS || { he: {}, en: {}, contact: {} };
  var HE = T.he || {}, EN = T.en || {}, C = T.contact || {};
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fill(attr, src) {
    var els = document.querySelectorAll("[" + attr + "]");
    for (var i = 0; i < els.length; i++) {
      var el = els[i], v = src[el.getAttribute(attr)];
      if (v == null || v === "") { el.hidden = true; if (el.parentNode && el.parentNode.tagName === "A" && !el.parentNode.textContent.trim()) el.parentNode.hidden = true; }
      else {
        el.hidden = false;
        /* Hebrew text with English words inside (e.g. "Or Hachaim Congregation"): keep each English run in one piece */
        if (attr === "data-t" && /[A-Za-z]/.test(v) && /[\u0590-\u05FF]/.test(v)) el.innerHTML = esc(v).replace(/[A-Za-z][A-Za-z0-9 .,'&;#-]*[A-Za-z0-9]/g, function (m) { return '<bdi dir="ltr" lang="en">' + m + "</bdi>"; });
        else el.textContent = v;
      }
    }
  }
  fill("data-t", HE);
  fill("data-t-en", EN);

  /* Contact: one card per method, each number or address a big tap target */
  var P = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  var IC = {
    phone: P + '<path d="M5 4h3.2l1.6 4-2 1.3a11 11 0 0 0 4.9 4.9l1.3-2 4 1.6V17a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>',
    email: P + '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/></svg>',
    wa: P + '<path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z"/><path d="M9.2 8.6c.2-.4.5-.4.8-.4h.5l.8 1.9-.6.8c.5 1.1 1.4 2 2.5 2.5l.8-.6 1.9.8v.5c0 .4-.1.7-.5.9-.6.3-1.4.4-2.3.1a7 7 0 0 1-4-4c-.3-.9-.2-1.7.1-2.5z"/></svg>'
  };
  function card(icon, he, en, links) {
    if (!links.length) return "";
    return '<article class="contact-card"><div class="cc-head"><span class="cc-ic">' + icon + '</span><h3>' + esc(he) +
      (en ? '<small lang="en">' + esc(en) + "</small>" : "") + "</h3></div>" +
      links.map(function (l) { return '<a class="cc-link" href="' + esc(l.href) + '"' + (l.ext ? ' target="_blank" rel="noopener"' : "") + ' dir="ltr">' + esc(l.text) + "</a>"; }).join("") + "</article>";
  }
  var phones = (C.phones || []).filter(function (p) { return p && p.show; });
  var html =
    card(IC.phone, HE.phoneLabel, EN.phoneLabel, phones.filter(function (p) { return p.tel; }).map(function (p) { return { href: "tel:" + p.tel, text: p.show }; })) +
    card(IC.email, HE.emailLabel, EN.emailLabel, C.email ? [{ href: "mailto:" + C.email, text: C.email }] : []) +
    card(IC.wa, HE.whatsappLabel, EN.whatsappLabel, phones.filter(function (p) { return p.wa; }).map(function (p) { return { href: "https://wa.me/" + p.wa, text: p.show, ext: true }; }));
  var box = document.getElementById("contactCards");
  if (box) { box.innerHTML = html; if (!html) { var sec = document.getElementById("contact"); if (sec) sec.hidden = true; var nl = document.querySelector('a[href="#contact"]'); if (nl) nl.hidden = true; } }

  /* The zmanim section stays hidden until PUBLIC_ZMANIM is turned on; its menu link follows it */
  var z = document.getElementById("zmanim"), zl = document.getElementById("navZmanim");
  function syncZ() { if (z && zl) zl.hidden = z.hidden || !HE.navZmanim; }
  if (z && window.MutationObserver) new MutationObserver(syncZ).observe(z, { attributes: true, attributeFilter: ["hidden"] });
  syncZ();
})();
