/* ============================================================
   DocFill landing — interactions (vanilla JS, no deps)
   ============================================================ */
(function () {
  "use strict";
  var body = document.body;
  var store = {
    get: function (k, d) { try { return localStorage.getItem("docfill." + k) || d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem("docfill." + k, v); } catch (e) {} }
  };

  /* ---------- restore persisted language ---------- */
  setLang(store.get("lang", "es"));

  /* ---------- nav shadow ---------- */
  var nav = document.querySelector(".nav");
  function onScroll() { if (nav) nav.classList.toggle("is-scrolled", window.scrollY > 8); }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- language toggle ---------- */
  function setLang(lang) {
    body.setAttribute("data-lang", lang);
    store.set("lang", lang);
    document.documentElement.setAttribute("lang", lang);
    document.querySelectorAll(".lang-toggle button").forEach(function (b) {
      b.classList.toggle("is-on", b.dataset.lang === lang);
    });
  }
  document.querySelectorAll(".lang-toggle button").forEach(function (b) {
    b.addEventListener("click", function () { setLang(b.dataset.lang); });
  });

  /* ---------- screenshot tabs ---------- */
  document.querySelectorAll("#shots-b .tab").forEach(function (t) {
    t.addEventListener("click", function () {
      var id = t.dataset.panel;
      document.querySelectorAll("#shots-b .tab").forEach(function (x) { x.classList.toggle("is-on", x === t); });
      document.querySelectorAll("#shots-b .tab-panel").forEach(function (p) {
        p.classList.toggle("is-on", p.dataset.panel === id);
      });
    });
  });

  /* ---------- flow demo (how it works): excel row -> output stack ---------- */
  var flowTimer = null;
  function initFlowDemo() {
    var xls = document.querySelector("#flow .mini-xls");
    var stack = document.querySelector("#flow .doc-stack");
    var counter = document.querySelector("#flow .flow-count b");
    if (!xls || !stack) return;
    var rows = Array.prototype.slice.call(xls.querySelectorAll(".xr:not(.head)"));
    var cards = Array.prototype.slice.call(stack.querySelectorAll(".ds"));
    var i = 0;
    function tick() {
      rows.forEach(function (r, idx) { r.classList.toggle("active", idx === i % rows.length); });
      var shown = (i % rows.length) + 1;
      cards.forEach(function (c, idx) {
        var on = idx < shown;
        c.style.opacity = on ? "1" : "0";
        c.style.transform = on
          ? "translateX(" + (idx * 26) + "px) translateY(" + (idx * -3) + "px) rotate(" + (idx * 2.2 - 2) + "deg)"
          : "translateX(0) translateY(8px) rotate(0deg)";
      });
      if (counter) counter.textContent = shown;
      i++;
      flowTimer = setTimeout(tick, 1100);
    }
    tick();
  }

  /* ---------- count-up on strip ---------- */
  function countUp(el) {
    var target = parseFloat(el.dataset.count);
    var suffix = el.dataset.suffix || "";
    var dur = 1100, start = null;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased).toLocaleString("es-ES") + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ---------- scroll reveal + lazy triggers (scroll-based, self-healing) ---------- */
  var counted = new WeakSet();
  function inView(el, margin) {
    var r = el.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    return r.top < vh * (margin || 0.92) && r.bottom > 0;
  }
  function reveal(el) {
    if (el.classList.contains("in")) return;
    el.classList.add("in");
    setTimeout(function () {
      if (parseFloat(getComputedStyle(el).opacity) < 0.9) {
        el.style.transition = "none";
        el.style.opacity = "1";
        el.style.transform = "none";
      }
    }, 850);
  }
  function checkReveals() {
    var animOff = body.getAttribute("data-anim") === "off";
    document.querySelectorAll(".reveal").forEach(function (el) {
      if (el.classList.contains("in")) return;
      if (animOff) { el.classList.add("in"); el.style.opacity = "1"; el.style.transform = "none"; }
      else if (inView(el)) reveal(el);
    });
    document.querySelectorAll("[data-count]").forEach(function (el) {
      if (!counted.has(el) && inView(el)) { counted.add(el); countUp(el); }
    });
    var flow = document.getElementById("flow");
    if (flow && !flowTimer && inView(flow, 0.8)) initFlowDemo();
  }
  window.addEventListener("scroll", checkReveals, { passive: true });
  window.addEventListener("resize", checkReveals, { passive: true });
  checkReveals();
  [120, 400, 900].forEach(function (t) { setTimeout(checkReveals, t); });
})();
