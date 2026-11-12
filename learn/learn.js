/* ============================================================
   learn.js — lesson runtime.
   · renders maths with KaTeX auto-render ($…$, $$…$$, \(…\), \[…\])
   · highlights <pre><code class="language-*"> with highlight.js
   · adds copy buttons to code readouts
   · boots interactive demos registered with Learn.demo(name, setup)

   A demo is a <figure class="demo" data-demo="name"> containing a
   <canvas>. setup(fig, api) is called once; api gives a DPR-aware
   scope with the site's grid/trace styling plus seeded RNGs.
   ============================================================ */
(function () {
  "use strict";

  const css = getComputedStyle(document.documentElement);
  const tok = (k, d) => css.getPropertyValue(k).trim() || d;
  const C = {
    accent: tok("--accent", "oklch(0.80 0.175 150)"),
    accentDim: tok("--accent-dim", "oklch(0.80 0.175 150 / 0.45)"),
    accentGlow: tok("--accent-glow", "oklch(0.80 0.175 150 / 0.22)"),
    fg: tok("--fg", "#e8eeea"),
    fgDim: tok("--fg-dim", "#9aa59f"),
    fgFaint: tok("--fg-faint", "#6c7772"),
    line: tok("--line", "rgba(255,255,255,0.11)"),
    lineSoft: tok("--line-soft", "rgba(255,255,255,0.055)"),
    alt: "oklch(0.80 0.09 200)",
  };
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- randomness ---------- */
  // mulberry32: tiny seeded PRNG → [0,1)
  function rng(seed = 1) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // Box–Muller standard normal from a uniform source
  const randn = (u = Math.random) => {
    const r = Math.sqrt(-2 * Math.log(1 - u()));
    return r * Math.cos(2 * Math.PI * u());
  };

  /* ---------- scope: DPR-aware canvas with axes ---------- */
  function scope(canvas, { pad = [14, 14, 26, 40] } = {}) {
    const [pt, pr, pb, pl] = pad;
    let ctx, w, h, X, Y;

    function fit() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      w = Math.max(1, Math.round(r.width));
      h = Math.max(1, Math.round(r.height));
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // set data window; returns mappers data→px
    function axes(xr, yr, { xticks = 5, yticks = 4, fmt = (v) => +v.toFixed(2) } = {}) {
      fit();
      ctx.clearRect(0, 0, w, h);
      const sx = (x) => pl + ((x - xr[0]) / (xr[1] - xr[0])) * (w - pl - pr);
      const sy = (y) => h - pb - ((y - yr[0]) / (yr[1] - yr[0])) * (h - pt - pb);
      X = sx; Y = sy;
      ctx.font = "10px 'IBM Plex Mono', monospace";
      ctx.lineWidth = 1;
      ctx.fillStyle = C.fgFaint;
      for (let i = 0; i <= yticks; i++) {
        const v = yr[0] + ((yr[1] - yr[0]) * i) / yticks, y = Math.round(sy(v)) + 0.5;
        ctx.strokeStyle = C.lineSoft;
        ctx.beginPath(); ctx.moveTo(pl, y); ctx.lineTo(w - pr, y); ctx.stroke();
        ctx.textAlign = "right"; ctx.textBaseline = "middle";
        ctx.fillText(fmt(v), pl - 6, y);
      }
      for (let i = 0; i <= xticks; i++) {
        const v = xr[0] + ((xr[1] - xr[0]) * i) / xticks, x = Math.round(sx(v)) + 0.5;
        ctx.strokeStyle = C.lineSoft;
        ctx.beginPath(); ctx.moveTo(x, pt); ctx.lineTo(x, h - pb); ctx.stroke();
        ctx.textAlign = "center"; ctx.textBaseline = "top";
        ctx.fillText(fmt(v), x, h - pb + 7);
      }
      ctx.strokeStyle = C.line;
      ctx.strokeRect(pl + 0.5, pt + 0.5, w - pl - pr - 1, h - pt - pb - 1);
      return { sx, sy, ctx, w, h };
    }

    // polyline through (xs[i], ys[i]); glow=true gives the phosphor trace
    function trace(xs, ys, { color = C.accent, width = 1.6, glow = true, dash = null } = {}) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(pl, pt, w - pl - pr, h - pt - pb);
      ctx.clip();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineJoin = ctx.lineCap = "round";
      if (dash) ctx.setLineDash(dash);
      if (glow) { ctx.shadowColor = color; ctx.shadowBlur = 8; }
      ctx.beginPath();
      for (let i = 0; i < xs.length; i++) {
        const x = X(xs[i]), y = Y(ys[i]);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // shaded region between lo(x) and hi(x)
    function band(xs, lo, hi, { color = C.accentGlow } = {}) {
      ctx.save();
      ctx.fillStyle = color;
      ctx.beginPath();
      xs.forEach((x, i) => (i ? ctx.lineTo(X(x), Y(hi[i])) : ctx.moveTo(X(x), Y(hi[i]))));
      for (let i = xs.length - 1; i >= 0; i--) ctx.lineTo(X(xs[i]), Y(lo[i]));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    function label(text, x, y, { color = C.fgDim, align = "left" } = {}) {
      ctx.fillStyle = color;
      ctx.textAlign = align;
      ctx.textBaseline = "middle";
      ctx.fillText(text, X(x), Y(y));
    }

    fit();
    return { axes, trace, band, label, get ctx() { return ctx; }, get w() { return w; }, get h() { return h; } };
  }

  /* ---------- demo registry ---------- */
  const registry = {};
  function demo(name, setup) { registry[name] = setup; }

  function bootDemos() {
    document.querySelectorAll("figure.demo[data-demo]").forEach((fig) => {
      const setup = registry[fig.dataset.demo];
      if (!setup) return console.warn("Learn: no demo registered for", fig.dataset.demo);
      const canvas = fig.querySelector("canvas");
      const api = { scope: scope(canvas), rng, randn, colors: C, reduced: REDUCED };
      const redraw = setup(fig, api);
      if (typeof redraw === "function") {
        let t;
        new ResizeObserver(() => { clearTimeout(t); t = setTimeout(redraw, 60); }).observe(canvas);
      }
    });
  }

  /* ---------- maths, code, copy ---------- */
  function renderMath() {
    if (!window.renderMathInElement) return;
    renderMathInElement(document.body, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "\\[", right: "\\]", display: true },
        { left: "$", right: "$", display: false },
        { left: "\\(", right: "\\)", display: false },
      ],
      ignoredClasses: ["no-math"],
      throwOnError: false,
      macros: {
        "\\R": "\\mathbb{R}",
        "\\N": "\\mathbb{N}",
        "\\E": "\\operatorname{E}",
        "\\Var": "\\operatorname{Var}",
        "\\Cov": "\\operatorname{Cov}",
        "\\P": "\\operatorname{P}",
        "\\ind": "\\mathbb{1}",
        "\\iid": "\\overset{\\text{iid}}{\\sim}",
        "\\T": "^{\\mathsf T}",
        "\\d": "\\,\\mathrm{d}",
      },
    });
  }

  function renderCode() {
    if (window.hljs) document.querySelectorAll("pre code[class*='language-']").forEach((el) => hljs.highlightElement(el));
    document.querySelectorAll(".screen").forEach((scr) => {
      const code = scr.querySelector("pre code");
      const bar = scr.querySelector(".bar");
      if (!code || !bar || !navigator.clipboard) return;
      const btn = document.createElement("button");
      btn.className = "copy";
      btn.type = "button";
      btn.textContent = "copy";
      btn.addEventListener("click", () =>
        navigator.clipboard.writeText(code.innerText).then(() => {
          btn.textContent = "copied";
          setTimeout(() => (btn.textContent = "copy"), 1400);
        })
      );
      bar.appendChild(btn);
    });
  }

  window.Learn = { demo, scope, rng, randn, colors: C };

  function boot() { renderMath(); renderCode(); bootDemos(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
