/* Or Hachaim | the Shabbat sheet | drawing and export (src/shabbat-sheet/sheet-draw.js)
   Draws the shul's sheet on a canvas, US Letter at 200 dpi (1700 x 2200),
   from the rows of sheet-core.js. The preview on the page IS this drawing, so
   what the gabbai sees is exactly what is exported. Two looks:
     "bg"    the shul's background photo (src/shabbat-sheet/sheet-bg.jpg)
     "clean" no background at all: white, ink-friendly, same layout, logo and type
   Export, all in the browser (no outside service, no library):
     image = JPG (canvas.toBlob), PDF = the small writer in sheet-core.js
     (one Letter page per language: Hebrew, English, or both in one file).
   Layout measured from the approved mockup (a 1208 x 1563 design, scaled). */
(function (root) {
  "use strict";
  var S = function () { return root.OH_SHEET; };
  var DW = 1208, DH = 1563, OUT_W = 1700, OUT_H = 2200, K = OUT_W / DW;
  var INK = "#1f3354", RULE = "#5d6a80", GOLD = "#c39a52";
  var FONT = "OHSheetAssistant";
  var assets = null, loading = null;

  function base() {
    var s = document.querySelector('script[src*="shabbat-sheet/sheet-draw.js"]');
    var src = s ? s.getAttribute("src") : "../../src/shabbat-sheet/sheet-draw.js";
    return src.replace(/shabbat-sheet\/sheet-draw\.js.*$/, "");
  }
  function img(url) { return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { rej(new Error("image " + url)); }; i.src = url; }); }
  /* the background, the logo and the Assistant font (the site's own file) */
  function load() {
    if (assets) return Promise.resolve(assets);
    if (loading) return loading;
    var b = base(), fontP = Promise.resolve(false);
    try {
      if (root.FontFace && document.fonts) {
        var ff = new FontFace(FONT, "url(" + b + "assets/fonts/assistant-var.woff2) format('woff2')", { weight: "200 800" });
        fontP = ff.load().then(function (f) { document.fonts.add(f); return Promise.all([document.fonts.load("400 40px " + FONT, "אב 1:23 Ab"), document.fonts.load("700 40px " + FONT, "אב 1:23 Ab")]); }).then(function () { return true; }).catch(function () { return false; });
      }
    } catch (e) {}
    loading = Promise.all([img(b + "shabbat-sheet/sheet-bg.jpg"), img(b + "shabbat-sheet/sheet-logo.png"), fontP]).then(function (r) {
      assets = { bg: r[0], logo: r[1], font: r[2] }; return assets;
    }).catch(function (e) { loading = null; throw e; });
    return loading;
  }
  function font(w, px) { return w + " " + px + "px " + FONT + ", Assistant, Arial, sans-serif"; }

  /* ---------- layout (design units) ---------- */
  var CT = 240, CB = DH - 250, CL = 84, CR = DW - 84, CW = CR - CL, CH = CB - CT;
  function measure(ctx, items, fs, gap, isHe) {
    var total = 0;
    items.forEach(function (it) {
      if (it.t === "h1") { it.size = fs * 1.32 * (isHe ? 1.06 : 1); it.h = it.size * 1.1; }
      else if (it.t === "mev") { it.h = it.size * 1.3 - 4; }
      else if (it.t === "dv") { it.h = 30; }
      else if (it.t === "grp") {
        var h = 0;
        it.rows.forEach(function (r, i) {
          if (r.line) { r.size = fs * (r.id === "ends" ? 0.88 : 0.8); r.h = r.size * 1.3 + (r.id === "ends" ? 4 : 0); }
          else { r.size = fs; r.h = fs * 1.18; }
          h += r.h + (i ? gap : 0);
        });
        it.h = h; it.gap = gap;
      }
      total += it.h;
    });
    return total;
  }
  function layout(ctx, model, lang) {
    var isHe = lang !== "en", groups = S().lines(model, lang), items = [];
    items.push({ t: "h1", text: isHe ? model.title.he : (model.title.en || model.title.he) });
    if (model.mev && !model.mev.hidden) items.push({ t: "mev", text: isHe ? model.mev.he : model.mev.en });
    groups.forEach(function (g, i) { if (i) items.push({ t: "dv" }); items.push({ t: "grp", rows: g.rows }); });
    /* the Mevarchin line: shrink to fit the width */
    items.forEach(function (it) {
      if (it.t !== "mev") return;
      var s = 43; ctx.font = font(400, s);
      while (ctx.measureText(it.text).width > CW && s > 26) { s -= 1; ctx.font = font(400, s); }
      it.size = s;
    });
    var fs = 50, gap = 16, total = measure(ctx, items, fs, gap, isHe);
    for (var i = 0; i < 40 && total > CH; i++) { fs -= 1; gap = Math.max(6, gap - 1); total = measure(ctx, items, fs, gap, isHe); }
    /* long labels: make the row font smaller until every row fits the width */
    for (var j = 0; j < 30; j++) {
      var tooWide = false;
      items.forEach(function (it) {
        if (it.t !== "grp") return;
        it.rows.forEach(function (r) {
          ctx.font = font(r.star ? 700 : 400, r.size);
          var w = r.line ? ctx.measureText(r.line).width : ctx.measureText(r.label).width + ctx.measureText(r.time).width + 60;
          if (w > CW - (r.star ? 30 : 0)) tooWide = true;
        });
      });
      if (!tooWide) break;
      fs -= 1; total = measure(ctx, items, fs, gap, isHe);
    }
    var free = Math.max(0, CH - total), sp = free / (items.length + 1), y = CT + sp;
    items.forEach(function (it) { it.y = y; y += it.h + sp; });
    return { items: items, fs: fs, isHe: isHe };
  }

  /* ---------- drawing ---------- */
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath(); }
  function dots(ctx, x1, x2, y, r) {
    if (x2 - x1 < 12) return;
    var step = r * 4, n = Math.floor((x2 - x1) / step), start = x1 + ((x2 - x1) - n * step) / 2 + r;
    ctx.beginPath();
    for (var i = 0; i < n; i++) { var x = start + i * step; ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2); }
    ctx.fill();
  }
  function divider(ctx, cx, y) {
    /* the mockup's divider: viewBox -17 0 470 30, centred */
    var ox = cx - 470 / 2 + 17;
    ctx.save(); ctx.translate(ox, y); ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 2.2;
    [[-17, 150], [320, 453], [150, 160], [170, 180], [196, 206], [230, 240], [256, 266], [276, 320]].forEach(function (l) { ctx.beginPath(); ctx.moveTo(l[0], 15); ctx.lineTo(l[1], 15); ctx.stroke(); });
    function dia(cx2, r, fill) { ctx.beginPath(); ctx.moveTo(cx2 - r, 15); ctx.lineTo(cx2, 15 - r); ctx.lineTo(cx2 + r, 15); ctx.lineTo(cx2, 15 + r); ctx.closePath(); if (fill) ctx.fill(); else { ctx.lineWidth = 2.4; ctx.stroke(); } }
    dia(165, 5, true); dia(188, 8, true); dia(218, 12, false); dia(218, 6, true); dia(248, 8, true); dia(271, 5, true);
    ctx.restore();
  }
  function star(ctx, x, y, w, h, fs, clean) {
    var px = fs * 0.38, py = fs * 0.06;
    rr(ctx, x - px, y - py, w + 2 * px, h + 2 * py, fs * 0.5);
    if (!clean) {
      ctx.save(); ctx.shadowColor = "rgba(120,90,40,.45)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
      ctx.fillStyle = "rgba(255,250,238,.82)"; ctx.fill(); ctx.restore();
    }
    ctx.lineWidth = clean ? 3 : 2.5; ctx.strokeStyle = clean ? "#8a6a35" : GOLD; ctx.stroke();
  }
  /* model + "he" | "en" + { look: "bg" | "clean" } -> canvas 1700 x 2200 */
  function render(model, lang, opt, a) {
    opt = opt || {}; a = a || assets;
    var clean = opt.look === "clean";
    var cv = document.createElement("canvas"); cv.width = OUT_W; cv.height = OUT_H;
    var ctx = cv.getContext("2d");
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, OUT_W, OUT_H);
    ctx.scale(K, K);
    if (!clean && a && a.bg) ctx.drawImage(a.bg, 0, 0, DW, DH);
    /* header: address, logo, rule */
    ctx.fillStyle = INK; ctx.direction = "ltr"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.font = '25px "Liberation Sans", Arial, Helvetica, sans-serif';
    ctx.fillText("321 Harold St.", 68, 128 + 24); ctx.fillText("Staten Island, NY 10314", 68, 128 + 31 + 24);
    if (a && a.logo) { var lw = 345, lh = lw * a.logo.naturalHeight / a.logo.naturalWidth; ctx.drawImage(a.logo, DW - 66 - lw, 52, lw, lh); }
    ctx.fillStyle = RULE; ctx.fillRect(66, 206, DW - 66 - 68, 3);
    var L = layout(ctx, model, lang), isHe = L.isHe, cx = DW / 2;
    ctx.direction = isHe ? "rtl" : "ltr";
    L.items.forEach(function (it) {
      ctx.fillStyle = INK; ctx.strokeStyle = INK;
      if (it.t === "h1") { ctx.font = font(700, it.size); ctx.textAlign = "center"; ctx.fillText(it.text, cx, it.y + it.h * 0.5 + it.size * 0.33); return; }
      if (it.t === "mev") { ctx.font = font(400, it.size); ctx.textAlign = "center"; ctx.fillText(it.text, cx, it.y + it.h * 0.5 + it.size * 0.33); return; }
      if (it.t === "dv") { divider(ctx, cx, it.y); return; }
      var y = it.y;
      it.rows.forEach(function (r, i) {
        if (i) y += it.gap;
        var bl = y + r.h * 0.5 + r.size * 0.3 - (r.id === "ends" ? 0 : 0);
        if (r.star) {
          ctx.font = font(700, r.size);
          var bw = r.line ? Math.min(CW, ctx.measureText(r.line).width + 20) : CW, bx = r.line ? cx - bw / 2 : CL;
          star(ctx, bx, y, bw, r.h, r.size, clean);
          ctx.fillStyle = INK;
        }
        ctx.font = font(r.star ? 700 : 400, r.size);
        if (r.line) { ctx.textAlign = "center"; ctx.fillText(r.line, cx, bl); }
        else {
          ctx.textAlign = isHe ? "right" : "left"; ctx.direction = isHe ? "rtl" : "ltr";
          var lx = isHe ? CR : CL; ctx.fillText(r.label, lx, bl);
          var lw2 = ctx.measureText(r.label).width;
          ctx.direction = "ltr"; ctx.textAlign = isHe ? "left" : "right";
          var tx = isHe ? CL : CR; ctx.fillText(r.time, tx, bl);
          var tw = ctx.measureText(r.time).width;
          ctx.direction = isHe ? "rtl" : "ltr";
          var a1 = isHe ? CL + tw + 14 : CL + lw2 + 14, a2 = isHe ? CR - lw2 - 14 : CR - tw - 14;
          dots(ctx, a1, a2, bl - r.size * 0.2, r.star ? 2.5 : 2);
        }
        y += r.h;
      });
    });
    /* "Shabbat Shalom" band */
    ctx.direction = isHe ? "rtl" : "ltr";
    if (!clean) {
      ctx.save();
      try { ctx.filter = "blur(3px)"; } catch (e) {}
      var g = ctx.createLinearGradient(250, 0, DW - 250, 0);
      g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.06, "rgba(255,255,255,.72)"); g.addColorStop(0.94, "rgba(255,255,255,.72)"); g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g; rr(ctx, 250, 1378, DW - 500, 96, 6); ctx.fill(); ctx.restore();
    }
    ctx.fillStyle = INK; ctx.textAlign = "center"; ctx.font = font(700, isHe ? 60 : 62);
    ctx.fillText(isHe ? "שבת שלום ומבורך!" : "SHABBAT SHALOM!", cx, 1384 + 43 + (isHe ? 60 : 62) * 0.33);
    return cv;
  }
  function jpegBlob(cv, q) { return new Promise(function (res, rej) { cv.toBlob(function (b) { b ? res(b) : rej(new Error("toBlob")); }, "image/jpeg", q || 0.9); }); }
  function bytes(blob) { return blob.arrayBuffer().then(function (b) { return new Uint8Array(b); }); }
  function fileBase(model) { return "shabbat-" + model.shabbat; }
  /* opt: { langs: ["he"] | ["en"] | ["he","en"], look: "bg" | "clean", format: "pdf" | "jpg" }
     -> Promise<[{ name, blob, type }]> (both + jpg = 2 images; both + pdf = ONE file, 2 pages) */
  function exportFiles(model, opt) {
    return load().then(function (a) {
      var langs = opt.langs && opt.langs.length ? opt.langs : ["he"], look = opt.look === "clean" ? "clean" : "bg", suf = look === "clean" ? "-clean" : "";
      var cvs = langs.map(function (l) { return { lang: l, cv: render(model, l, { look: look }, a) }; });
      return Promise.all(cvs.map(function (c) { return jpegBlob(c.cv, look === "clean" ? 0.92 : 0.9); })).then(function (blobs) {
        if (opt.format === "pdf") {
          return Promise.all(blobs.map(bytes)).then(function (bs) {
            var pdf = S().pdf(bs.map(function (b) { return { jpeg: b, w: OUT_W, h: OUT_H }; }));
            return [{ name: fileBase(model) + "-" + langs.join("-") + suf + ".pdf", blob: new Blob([pdf], { type: "application/pdf" }), type: "application/pdf" }];
          });
        }
        return blobs.map(function (b, i) { return { name: fileBase(model) + "-" + cvs[i].lang + suf + ".jpg", blob: b, type: "image/jpeg" }; });
      });
    });
  }
  root.OH_SHEET_DRAW = { load: load, render: render, exportFiles: exportFiles, layout: layout, SIZE: { w: OUT_W, h: OUT_H, design: [DW, DH] } };
})(window);
