/* Liquid glass on the header controls, using liquid-glass-js (MIT, static/vendor/liquid-glass.min.js).
   Each control gets a glass lens that bends the header picture (.lg-scene) behind it.
   The lenses are placed in page coordinates (position:absolute), so they scroll together with the page natively:
   no per-scroll JavaScript, so nothing can lag behind or jiggle. Skipped if the library or the scene is missing. */
(function () {
  "use strict";
  var scene = document.querySelector(".top .lg-scene");
  if (!window.LiquidGlass || !scene) return;
  var TARGETS = ".top .hero-btn, .top .signout, .top .user-chip, .top .signin, .top .hero-landing, .top .hero-card";
  var lenses = new Map();

  function look(el, r) {
    var big = el.classList.contains("hero-landing") || el.classList.contains("hero-card");
    var pill = !big;
    var h = Math.round(r.height);
    return {
      width: Math.round(r.width), height: h,
      radius: big ? 32 : Math.round(h / 2),
      scale: big ? 42 : 22,              // how strongly the edge bends the picture
      depth: big ? 46 : Math.max(10, Math.round(h * 0.42)),
      curvature: big ? 3.2 : 2.6,
      chroma: big ? 0.08 : 0.12,         // the faint rainbow fringe at the rim
      edge: big ? 0.75 : 0.9, glow: big ? 0.05 : 0.08, specAngle: 125,
      tint: big ? 0.22 : 0.5, tintColor: "#1A100A"   // dark tint behind the text so the lines never cut through it
    };
  }

  function make(el, r) {
    var g = new window.LiquidGlass(Object.assign({ background: scene, draggable: false, zIndex: 0,
      x: r.left + window.scrollX, y: r.top + window.scrollY }, look(el, r)));
    // Page coordinates instead of screen coordinates: the browser scrolls the glass with the page.
    window.removeEventListener("scroll", g._onSync, true);
    window.removeEventListener("resize", g._onSync);
    g._syncBg = function () {
      var b = this.background.getBoundingClientRect();
      this.bgX = b.left + window.scrollX; this.bgY = b.top + window.scrollY;
      this.lensInner.style.width = b.width + "px"; this.lensInner.style.height = b.height + "px";
    };
    g.lensEl.style.position = g.glassEl.style.position = "absolute";
    g.refresh();
    g.glassEl.style.pointerEvents = "none";
    el.classList.add("lg-on");
    lenses.set(el, { g: g, w: r.width, h: r.height });
  }

  var queued = false;
  function sync() {
    queued = false;
    document.querySelectorAll(TARGETS).forEach(function (el) {
      var r = el.getBoundingClientRect(), shown = r.width > 0 && r.height > 0 && !el.hidden;
      var it = lenses.get(el);
      if (!it) { if (shown) make(el, r); return; }
      it.g.lensEl.style.display = it.g.glassEl.style.display = shown ? "" : "none";
      if (!shown) return;
      if (Math.abs(r.width - it.w) > 1 || Math.abs(r.height - it.h) > 1) {
        it.w = r.width; it.h = r.height; it.g.set(look(el, r));
      }
      it.g._syncBg();
      it.g.moveTo(r.left + window.scrollX, r.top + window.scrollY);
    });
  }
  function later() { if (!queued) { queued = true; requestAnimationFrame(sync); } }

  window.addEventListener("resize", function () { later(); lenses.forEach(function (it) { it.g.refresh(); }); });
  window.addEventListener("load", function () { lenses.forEach(function (it) { it.g.refresh(); }); later(); });
  // Buttons that appear later (e.g. "Remove Member Access") get their lens as soon as they show.
  new MutationObserver(later).observe(document.querySelector(".top"), { attributes: true, subtree: true, attributeFilter: ["hidden", "class", "style"] });
  // Anything that shifts the header (a scrollbar appearing when the page content loads, fonts, a longer name)
  // moves the controls without a resize event, so watch their sizes directly.
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(later);
    ro.observe(document.documentElement); ro.observe(document.body); ro.observe(document.querySelector(".top"));
    document.querySelectorAll(TARGETS).forEach(function (el) { ro.observe(el); });
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(later);
  setTimeout(later, 600); setTimeout(later, 2000);
  window.addEventListener("load", later);
  later();
})();
