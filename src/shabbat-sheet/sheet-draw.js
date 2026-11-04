/* Or Hachaim | the Shabbat sheet | drawing and export (src/shabbat-sheet/sheet-draw.js)
   Draws the shul's sheet on a canvas, US Letter at 200 dpi (1700 x 2200),
   from the rows of sheet-core.js. The preview on the page IS this drawing, so
   what the gabbai sees is exactly what is exported. Two looks:
     "bg"    the shul's own original artwork, full quality (src/shabbat-sheet/sheet-bg.jpg,
             1207 x 1562). It already carries the logo, the address and the navy rule,
             so nothing is drawn over them; the rows sit in its clean middle, above
             the candles and the challah.
     "clean" no background at all: white, ink-friendly, our logo + address + rule drawn
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

  /* ---------- layout (design units) ----------
     v3 (Hanoch 3:19 PM): the whole text block (title, Mevarchin line, every row
     and "Shabbat Shalom") FITS THE PAGE. Letters and spacing grow and shrink
     together: fewer rows = bigger letters and more air, more rows = smaller,
     never past the clean area (never on the logo, never on the candles/challah).
     The gabbai can make the letters bigger or smaller in whole steps (8 % each,
     weeks[shabbat].size, 0 = fit); every step is clamped so nothing can overflow:
     past the biggest size that still fits, the spacing tightens and then stops. */
  var CT = 236, CB = DH - 98, CL = 84, CR = DW - 84, CW = CR - CL;
  /* the artwork: its navy rule is at y 209 and the challah starts near y 1280.
     Between them the photo is soft, out-of-focus candle glow; the block uses all
     of it, like the shul's own sheets (their rows run over the candles too), and
     on the artwork every word gets a soft light halo so it reads on the glow.
     The block, with "Shabbat Shalom" as its last line, ends at BG_CB, above the
     challah. */
  var BG_CT = 228, BG_CB = 1262;
  var FIT = {
    min: 24,            /* smallest row size (design units; 34 px on the 1700 export) */
    autoMax: 72,        /* the fit never goes past this (3 rows would be a poster) */
    max: 96,            /* the biggest a manual step can reach (still clamped to fit) */
    step: 0.08,         /* one − / + step */
    gap: 0.22, sp: 0.30,          /* row gap and space between parts, x row size (the fit) */
    gapMin: 0.10, spMin: 0.20,    /* the tightest they get when the gabbai goes bigger */
    slotMax: 0.9                  /* the most extra air one slot takes before the block centres */
  };
  function sizes(it, fs, isHe, ctx) {
    if (it.t === "h1") { it.size = Math.min(fs * 1.32 * (isHe ? 1.06 : 1), it.wmax || 1e9); it.h = it.size * 1.1; }
    else if (it.t === "mev") { it.size = Math.min(fs * 0.86, it.wmax || 1e9); it.h = it.size * 1.3; }
    else if (it.t === "dv") { it.h = 30; }
    else if (it.t === "sh") { it.size = Math.min(fs * (isHe ? 1.1 : 1.06), it.wmax || 1e9); it.h = it.size * 1.15; }
    else if (it.t === "grp") {
      it.rows.forEach(function (r) {
        if (r.line) { r.size = fs * (r.id === "ends" ? 0.88 : 0.8); r.h = r.size * 1.3 + (r.id === "ends" ? 4 : 0); }
        else { r.size = fs; r.h = fs * 1.18; }
      });
    }
  }
  /* height of the block at row size fs with row gap g*fs and part spacing p*fs (no extra air) */
  function natural(items, fs, g, p, isHe) {
    var total = 0, n = 0;
    items.forEach(function (it, i) {
      sizes(it, fs, isHe);
      if (it.t === "grp") { it.rows.forEach(function (r, j) { total += r.h + (j ? g * fs : 0); }); }
      else total += it.h;
      if (i) total += p * fs;
      n++;
    });
    return total;
  }
  /* the widest each item may be: rows fit the width (label + leader + time) */
  function widthCap(ctx, items) {
    var cap = 1e9;
    items.forEach(function (it) {
      if (it.t === "h1" || it.t === "mev" || it.t === "sh") {
        ctx.font = font(it.t === "mev" ? 400 : 700, 100);
        var w = ctx.measureText(it.text).width; it.wmax = w > 0 ? (CW - 10) * 100 / w : 1e9;
        return;
      }
      if (it.t !== "grp") return;
      it.rows.forEach(function (r) {
        ctx.font = font(r.star ? 700 : 400, 100);
        var k = r.line ? (r.id === "ends" ? 0.88 : 0.8) : 1;
        var w100 = r.line ? ctx.measureText(r.line).width : ctx.measureText(r.label).width + ctx.measureText(r.time).width;
        var room = r.line ? CW - 20 : CW - 60 - (r.star ? 30 : 0);
        if (w100 > 0) cap = Math.min(cap, room * 100 / (w100 * k));
      });
    });
    return cap;
  }
  /* the biggest row size whose block fits the height h with spacing (g, p) */
  function biggest(items, h, g, p, isHe, hi) {
    var lo = 4;
    if (natural(items, hi, g, p, isHe) <= h) return hi;
    for (var i = 0; i < 40; i++) { var mid = (lo + hi) / 2; if (natural(items, mid, g, p, isHe) <= h) lo = mid; else hi = mid; }
    return lo;
  }
  function itemsOf(ctx, model, lang) {
    var isHe = lang !== "en", groups = S().lines(model, lang), items = [];
    items.push({ t: "h1", text: isHe ? model.title.he : (model.title.en || model.title.he) });
    if (model.mev && !model.mev.hidden) items.push({ t: "mev", text: isHe ? model.mev.he : model.mev.en });
    groups.forEach(function (g, i) { if (i) items.push({ t: "dv" }); items.push({ t: "grp", rows: g.rows }); });
    items.push({ t: "sh", text: isHe ? "שבת שלום ומבורך!" : "SHABBAT SHALOM!" });
    return { items: items, isHe: isHe };
  }
  /* the sizes for one page: { autoFs, maxFs, minFs, minStep, maxStep } */
  function fitInfo(ctx, model, lang, area) {
    var top = area ? area.top : CT, H = (area ? area.bottom : CB) - top;
    var o = itemsOf(ctx, model, lang), items = o.items, wcap = widthCap(ctx, items);
    var autoFs = Math.min(biggest(items, H, FIT.gap, FIT.sp, o.isHe, Math.min(FIT.autoMax, wcap)), wcap); /* never past the page, even under FIT.min */
    var maxFs = Math.max(autoFs, Math.min(biggest(items, H, FIT.gapMin, FIT.spMin, o.isHe, Math.min(FIT.max, wcap)), wcap));
    var minFs = Math.min(FIT.min, autoFs);
    var minStep = Math.max(S().SIZE_MIN, Math.ceil((minFs / autoFs - 1) / FIT.step - 1e-9));
    var maxStep = Math.min(S().SIZE_MAX, Math.max(0, Math.floor((maxFs / autoFs - 1) / FIT.step + 1e-9)));
    return { items: items, isHe: o.isHe, top: top, H: H, autoFs: autoFs, maxFs: maxFs, minFs: minFs, minStep: minStep, maxStep: maxStep };
  }
  /* step: whole steps from the fit (0 = fit); clamped so the page never overflows */
  function layout(ctx, model, lang, area, step) {
    var f = fitInfo(ctx, model, lang, area), items = f.items, isHe = f.isHe;
    if (step == null) step = model && model.week && typeof model.week.size === "number" ? model.week.size : 0;
    step = Math.round(Number(step) || 0);
    var want = f.autoFs * (1 + FIT.step * step), fs = Math.max(f.minFs, Math.min(f.maxFs, want));
    /* spacing: the fit's spacing, tightened only as much as a bigger size needs */
    var g = FIT.gap, p = FIT.sp;
    if (natural(items, fs, g, p, isHe) > f.H) {
      var lo = 0, hi = 1;
      for (var i = 0; i < 30; i++) { var t = (lo + hi) / 2; if (natural(items, fs, FIT.gapMin + (FIT.gap - FIT.gapMin) * t, FIT.spMin + (FIT.sp - FIT.spMin) * t, isHe) <= f.H) lo = t; else hi = t; }
      g = FIT.gapMin + (FIT.gap - FIT.gapMin) * lo; p = FIT.spMin + (FIT.sp - FIT.spMin) * lo;
    }
    var total = natural(items, fs, g, p, isHe), free = Math.max(0, f.H - total);
    /* the leftover air: between the parts (weight 2) and between rows (weight 1),
       up to slotMax x size per slot; anything past that centres the block */
    var wParts = Math.max(0, items.length - 1) * 2, wRows = 0;
    items.forEach(function (it) { if (it.t === "grp") wRows += it.rows.length - 1; });
    var wsum = wParts + wRows, unit = wsum ? free / wsum : 0, cap = fs * FIT.slotMax / 2;
    if (unit > cap) unit = cap;
    var used = unit * wsum, y = f.top + (free - used) / 2;
    var gapPx = g * fs + unit, spPx = p * fs + 2 * unit;
    items.forEach(function (it, i) {
      if (i) y += spPx;
      it.y = y;
      if (it.t === "grp") { var h = 0; it.rows.forEach(function (r, j) { h += r.h + (j ? gapPx : 0); }); it.h = h; it.gap = gapPx; }
      y += it.h;
    });
    return { items: items, fs: fs, isHe: isHe, step: step, autoFs: f.autoFs, maxFs: f.maxFs, minFs: f.minFs, minStep: f.minStep, maxStep: f.maxStep,
      top: f.top, bottom: f.top + f.H, end: y, overflow: y > f.top + f.H + 0.5 };
  }
  /* the − / + range of one page (the editor greys a button out at the end) */
  function sizeRange(model, lang, look) {
    var cv = document.createElement("canvas"), ctx = cv.getContext("2d");
    var L = layout(ctx, model, lang, look === "clean" ? null : { top: BG_CT, bottom: BG_CB });
    return { step: L.step, minStep: L.minStep, maxStep: L.maxStep, fs: L.fs, autoFs: L.autoFs, maxFs: L.maxFs };
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
    var art = !clean && a && a.bg;
    ctx.textBaseline = "alphabetic";
    if (art) {
      /* the shul's artwork as it is, full quality (logo, address and rule are in it) */
      ctx.imageSmoothingEnabled = true; try { ctx.imageSmoothingQuality = "high"; } catch (e) {}
      ctx.drawImage(a.bg, 0, 0, DW, DH);
    } else {
      /* header: address, logo, rule (the clean page, or no artwork loaded) */
      ctx.fillStyle = INK; ctx.direction = "ltr"; ctx.textAlign = "left";
      ctx.font = '25px "Liberation Sans", Arial, Helvetica, sans-serif';
      ctx.fillText("321 Harold St.", 68, 128 + 24); ctx.fillText("Staten Island, NY 10314", 68, 128 + 31 + 24);
      if (a && a.logo) { var lw = 345, lh = lw * a.logo.naturalHeight / a.logo.naturalWidth; ctx.drawImage(a.logo, DW - 66 - lw, 52, lw, lh); }
      ctx.fillStyle = RULE; ctx.fillRect(66, 206, DW - 66 - 68, 3);
    }
    var L = layout(ctx, model, lang, art ? { top: BG_CT, bottom: BG_CB } : null, opt.size), isHe = L.isHe, cx = DW / 2;
    if (opt.out) opt.out.layout = L;
    ctx.direction = isHe ? "rtl" : "ltr";
    /* on the artwork: a soft light halo under every word, so the lower rows read on the candle glow */
    if (art) { ctx.shadowColor = "rgba(255,255,255,.92)"; ctx.shadowBlur = 12; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; }
    L.items.forEach(function (it) {
      ctx.fillStyle = INK; ctx.strokeStyle = INK;
      if (it.t === "h1") { ctx.font = font(700, it.size); ctx.textAlign = "center"; ctx.fillText(it.text, cx, it.y + it.h * 0.5 + it.size * 0.33); return; }
      if (it.t === "mev") { ctx.font = font(400, it.size); ctx.textAlign = "center"; ctx.fillText(it.text, cx, it.y + it.h * 0.5 + it.size * 0.33); return; }
      if (it.t === "dv") { divider(ctx, cx, it.y); return; }
      if (it.t === "sh") {
        /* "Shabbat Shalom", the last line of the block: on the artwork with a soft
           light halo and no band over the photo (it reads on the candle glow) */
        ctx.font = font(700, it.size); ctx.textAlign = "center";
        var sy = it.y + it.h * 0.5 + it.size * 0.33;
        if (art) { ctx.save(); ctx.shadowColor = "rgba(255,255,255,.95)"; ctx.shadowBlur = 14; ctx.fillText(it.text, cx, sy); ctx.fillText(it.text, cx, sy); ctx.restore(); }
        ctx.fillText(it.text, cx, sy);
        return;
      }
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
      return Promise.all(cvs.map(function (c) { return jpegBlob(c.cv, look === "clean" ? 0.92 : 0.95); })).then(function (blobs) {
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
  root.OH_SHEET_DRAW = { load: load, render: render, exportFiles: exportFiles, layout: layout, fitInfo: fitInfo, sizeRange: sizeRange, FIT: FIT, AREA: { bg: [BG_CT, BG_CB], clean: [CT, CB], width: [CL, CR] }, SIZE: { w: OUT_W, h: OUT_H, design: [DW, DH] } };
})(typeof window !== "undefined" ? window : globalThis);
