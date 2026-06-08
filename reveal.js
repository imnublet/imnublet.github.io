/* ============================================================
   reveal.js — orchestrated load, staggered reveals,
   scroll-driven resolve moment. Boots the Signal engine.
   ============================================================ */
(function () {
  "use strict";
  const S = window.Signal;
  if (!S) return;

  function boot() {
    // ---- hero scope ----
    const hero = document.getElementById("hero-signal");
    if (hero) S.heroScope(hero);

    // ---- thread sparklines ----
    document.querySelectorAll("[data-spark]").forEach((cv) => {
      S.sparkline(cv, cv.getAttribute("data-spark"), true);
    });

    // ---- resolve band tied to scroll position ----
    const rb = document.getElementById("resolve-signal");
    let band = null;
    if (rb) band = S.resolveBand(rb, rb.getAttribute("data-channel") || "ecg");

    S.start();

    // ---- instrument bar: live scope + section/channel/position readout ----
    const barCanvas = document.getElementById("bar-signal");
    const bar = barCanvas ? S.barScope(barCanvas) : null;
    const elSection = document.querySelector("[data-bar-section]");
    const elChannel = document.querySelector("[data-bar-channel]");
    const elPos = document.querySelector("[data-bar-pos]");
    const sections = Array.from(document.querySelectorAll("[data-screen-label]"));

    if (sections.length) {
      const secIO = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (!e.isIntersecting) return;
            const label = (e.target.getAttribute("data-screen-label") || "").toUpperCase();
            const ch = e.target.getAttribute("data-channel") || "ecg";
            if (elSection) elSection.textContent = label;
            if (elChannel) elChannel.textContent = ch.toUpperCase();
            if (bar) bar.setChannel(ch);
          });
        },
        { threshold: 0.5, rootMargin: "-20% 0px -40% 0px" }
      );
      sections.forEach((s) => secIO.observe(s));
    }

    if (elPos) {
      let praf = 0;
      const updatePos = () => {
        praf = 0;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const pct = max > 0 ? Math.round((window.pageYOffset / max) * 100) : 0;
        elPos.textContent = String(Math.min(100, Math.max(0, pct))).padStart(2, "0");
      };
      window.addEventListener(
        "scroll",
        () => {
          if (!praf) praf = requestAnimationFrame(updatePos);
        },
        { passive: true }
      );
      updatePos();
    }

    // scroll → resolve progress as the band crosses the viewport centre
    if (band && !S.reduced) {
      const section = rb.closest("section") || rb;
      let raf = 0;
      function onScroll() {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          const r = section.getBoundingClientRect();
          const vh = window.innerHeight;
          // 0 when section enters from below, 1 once it's settled in view
          const p = (vh - r.top) / (vh * 0.85);
          band.setResolve(Math.max(0, Math.min(1, p)));
        });
      }
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }

    // ---- staggered reveals ----
    const revealEls = document.querySelectorAll("[data-reveal]");
    if (!("IntersectionObserver" in window)) {
      revealEls.forEach((el) => el.classList.add("is-in"));
    } else {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add("is-in");
              io.unobserve(e.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
      );
      revealEls.forEach((el) => io.observe(el));
      // safety net: never let above-the-fold content stay invisible
      setTimeout(() => {
        revealEls.forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.top < window.innerHeight * 1.15) el.classList.add("is-in");
        });
      }, 2600);
    }

    // ---- orchestrated hero load: stagger child delays ----
    const heroItems = document.querySelectorAll("[data-hero-stagger] > *");
    heroItems.forEach((el, i) => {
      el.style.setProperty("--delay", 220 + i * 110 + "ms");
      el.setAttribute("data-reveal", "");
      // hero reveals immediately on load
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("is-in")));
    });

    // ---- live clock in nav status (mono, dry detail) ----
    const clock = document.querySelector("[data-clock]");
    if (clock) {
      const tick = () => {
        const d = new Date();
        const hh = String(d.getHours()).padStart(2, "0");
        const mm = String(d.getMinutes()).padStart(2, "0");
        clock.textContent = hh + ":" + mm + " CET";
      };
      tick();
      setInterval(tick, 30000);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
