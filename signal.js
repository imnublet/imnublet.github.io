/* ============================================================
   signal.js — biosignal canvas engine
   One instrument, four channels: ECG · PPG · neural spikes · telemetry.
   Scrolling-oscilloscope rendering, boot-up resolve, channel morph.
   ============================================================ */
(function () {
  "use strict";

  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- read accent from CSS so the trace always matches the theme ----
  const css = getComputedStyle(document.documentElement);
  const ACCENT = css.getPropertyValue("--accent").trim() || "oklch(0.8 0.175 150)";
  const BG = css.getPropertyValue("--bg").trim() || "#101312";

  // small deterministic hash → [0,1)
  function hash(n) {
    let x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }
  const gauss = (x, c, w) => Math.exp(-((x - c) * (x - c)) / (2 * w * w));
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ------------------------------------------------------------------
     CHANNEL GENERATORS — each maps a continuous phase (px) to y∈[-1,1]
     ------------------------------------------------------------------ */
  const CH = {
    ecg(p) {
      const period = 230;
      const u = (p % period) / period;
      let v =
        0.10 * gauss(u, 0.18, 0.022) + // P
        1.00 * gauss(u, 0.30, 0.0095) - // R
        0.16 * gauss(u, 0.272, 0.006) - // Q
        0.28 * gauss(u, 0.330, 0.0075) + // S
        0.26 * gauss(u, 0.56, 0.045); // T
      return v * 0.9;
    },
    ppg(p) {
      const period = 260;
      const u = (p % period) / period;
      const systolic = gauss(u, 0.20, 0.075);
      const dicrotic = gauss(u, 0.48, 0.11) * 0.42;
      return clamp(-0.45 + 1.55 * (systolic + dicrotic), -0.7, 1);
    },
    neural(p) {
      const cellW = 26;
      const cell = Math.floor(p / cellW);
      const r = hash(cell);
      let v = -0.55 + (hash(cell * 2.3) - 0.5) * 0.08; // jittery baseline
      if (r < 0.34) {
        const pos = 0.25 + hash(cell * 7.1) * 0.5;
        const local = (p % cellW) / cellW;
        v += 1.55 * gauss(local, pos, 0.018); // spike
        v -= 0.28 * gauss(local, pos + 0.05, 0.04); // AHP dip
      }
      return clamp(v, -0.85, 1);
    },
    telemetry(p) {
      const u = (p / 300) * Math.PI * 2;
      let v =
        0.55 * Math.sin(u) +
        0.22 * Math.sin(u * 2 + 0.7) +
        0.13 * Math.sin(u * 3.3 + 1.4) +
        0.06 * Math.sin(u * 6.1);
      v *= 0.9 + 0.1 * Math.sin(u * 0.33); // slow envelope
      return clamp(v, -1, 1);
    },
    // gait — vertical ground-reaction force: double hump in stance, flat in swing.
    // Reads instantly as biomechanics / sport.
    gait(p) {
      const period = 300;
      const u = (p % period) / period;
      if (u < 0.62) {
        const heel = 0.95 * gauss(u, 0.14, 0.05); // heel strike
        const toe = 0.88 * gauss(u, 0.46, 0.055); // push-off
        const mid = -0.18 * gauss(u, 0.30, 0.05); // midstance dip
        return clamp(-0.78 + 1.7 * (heel + toe + mid), -0.85, 1);
      }
      return -0.78 + (hash(Math.floor(p)) - 0.5) * 0.05; // swing: foot off ground
    },
    // descent — repeating optimisation curve: noisy decay toward a minimum.
    descent(p) {
      const period = 220;
      const cell = Math.floor(p / period);
      const frac = (p % period) / period;
      const decay = Math.exp(-frac * 2.6);
      const wobble = 0.12 * Math.sin(frac * 34) * decay; // damped oscillation
      const noise = (hash(cell * 5.1 + Math.floor(p / 7)) - 0.5) * 0.06;
      return clamp(-1 + 2 * decay + wobble + noise, -1, 1);
    },
  };
  const ORDER = ["ecg", "gait", "neural", "descent"];

  /* ------------------------------------------------------------------
     CANVAS helper — DPR aware
     ------------------------------------------------------------------ */
  function fit(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  /* ------------------------------------------------------------------
     central RAF loop
     ------------------------------------------------------------------ */
  const ticks = [];
  let running = false;
  function loop(t) {
    for (const fn of ticks) fn(t);
    if (running) requestAnimationFrame(loop);
  }
  function start() {
    if (running) return;
    running = true;
    requestAnimationFrame(loop);
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) running = false;
    else start();
  });

  /* ==================================================================
     HERO SCOPE — large scrolling trace that scans through channels
     ================================================================== */
  function heroScope(canvas) {
    let offset = 0;
    let resolve = REDUCED ? 1 : 0.5; // boot-up; start partly-resolved so the first paint already reads as signal, not a noise wall
    let inView = true;
    // morph state
    let idx = 0;
    let mix = 1; // 1 = fully on ORDER[idx]
    let nextIdx = 0;
    let lastSwitch = performance.now();

    new IntersectionObserver((es) => (inView = es[0].isIntersecting), {
      threshold: 0,
    }).observe(canvas);

    const STEP = 2;
    const SPEED = REDUCED ? 0 : 1.05;

    function gen(name, p) {
      return CH[name](p);
    }

    function render(now) {
      if (!inView) return;
      const { ctx, w, h } = fit(canvas);
      const mid = h * 0.68;
      const amp = Math.min(h * 0.17, 78);

      // boot resolve
      if (resolve < 1) resolve = Math.min(1, resolve + 0.012);

      // channel scan every ~5.2s
      if (!REDUCED && now - lastSwitch > 5200) {
        lastSwitch = now;
        nextIdx = (idx + 1) % ORDER.length;
        mix = 0;
      }
      if (mix < 1) mix = Math.min(1, mix + 0.016);
      if (mix >= 1 && nextIdx !== idx) {
        idx = nextIdx;
      }
      const from = ORDER[idx];
      const to = ORDER[nextIdx];

      ctx.clearRect(0, 0, w, h);

      // faint baseline + grid ticks
      ctx.strokeStyle = "oklch(0.935 0.01 165 / 0.05)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, mid);
      ctx.lineTo(w, mid);
      ctx.stroke();

      offset += SPEED;

      // build trace
      const noiseAmt = (1 - resolve) * 0.55;
      function sampleY(x) {
        const p = x + offset;
        let v = lerp(gen(from, p), gen(to, p), mix);
        if (noiseAmt > 0) v += (hash((p + now * 0.05) * 1.7) - 0.5) * 2 * noiseAmt;
        return mid - clamp(v, -1.4, 1.4) * amp;
      }

      // glow pass
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.shadowColor = ACCENT;
      ctx.shadowBlur = 9;
      ctx.strokeStyle = ACCENT;
      ctx.globalAlpha = 0.38;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let x = 0; x <= w; x += STEP) {
        const y = sampleY(x);
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      // bright leading dot
      const ly = sampleY(w);
      ctx.fillStyle = ACCENT;
      ctx.globalAlpha = 0.85;
      ctx.shadowColor = ACCENT;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(w - 1, ly, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      // channel label readout — bottom-right, clear of the nav
      ctx.font = '500 11px "IBM Plex Mono", monospace';
      ctx.fillStyle = "oklch(0.69 0.012 168 / 0.6)";
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "right";
      const label = "CH" + String(idx + 1).padStart(2, "0") + " · " + from.toUpperCase() + " · ACQUIRING";
      ctx.fillText(label, w - 16, h - 16);
      ctx.textAlign = "left";

      if (REDUCED) return; // single static frame
    }

    ticks.push(render);
    render(performance.now()); // guaranteed good first paint even if rAF is throttled
  }

  /* ==================================================================
     SPARKLINE — small static-ish trace for each thread/channel
     ================================================================== */
  function sparkline(canvas, name, animate) {
    let off = hash(name.length * 9.7) * 400;
    let inView = false;
    let painted = false;
    new IntersectionObserver((es) => (inView = es[0].isIntersecting), {
      threshold: 0,
    }).observe(canvas);

    function render() {
      if (!inView && painted && !REDUCED) return;
      painted = true;
      const { ctx, w, h } = fit(canvas);
      const mid = h * 0.5;
      const amp = h * 0.46;
      ctx.clearRect(0, 0, w, h);
      if (animate && !REDUCED) off += 0.7;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = "oklch(0.74 0.05 160 / 0.7)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 2) {
        const v = CH[name](x + off);
        const y = mid - clamp(v, -1, 1) * amp;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    if (REDUCED) {
      requestAnimationFrame(render);
    } else {
      ticks.push(render);
    }
    render(); // first paint
  }

  /* ==================================================================
     RESOLVE BAND — the scroll-triggered moment.
     setResolve(0..1): noise → clean signal, dim → bright.
     ================================================================== */
  function resolveBand(canvas, name) {
    let off = 0;
    let resolve = REDUCED ? 1 : 0;
    let target = REDUCED ? 1 : 0;
    let inView = true;
    new IntersectionObserver((es) => (inView = es[0].isIntersecting), {
      threshold: 0,
    }).observe(canvas);

    function render(now) {
      if (!inView) return;
      const { ctx, w, h } = fit(canvas);
      const mid = h * 0.5;
      const amp = Math.min(h * 0.3, 90);
      resolve += (target - resolve) * 0.08;
      off += REDUCED ? 0 : 0.8;

      ctx.clearRect(0, 0, w, h);
      const noiseAmt = (1 - resolve) * 1.1;
      const bright = 0.18 + resolve * 0.72;

      function sampleY(x) {
        const p = x + off;
        let v = CH[name](p);
        if (noiseAmt > 0) v += (hash((p + now * 0.06) * 2.1) - 0.5) * 2 * noiseAmt;
        return mid - clamp(v, -1.6, 1.6) * amp;
      }
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.shadowColor = ACCENT;
      ctx.shadowBlur = 8 + resolve * 12;
      ctx.strokeStyle = ACCENT;
      ctx.globalAlpha = bright;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 2) {
        const y = sampleY(x);
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }
    ticks.push(render);
    render(performance.now()); // first paint
    if (REDUCED) requestAnimationFrame((t) => render(t));
    return { setResolve: (v) => (target = clamp(v, 0, 1)) };
  }

  // ---- expose ----
  window.Signal = {
    heroScope,
    sparkline,
    resolveBand,
    barScope,
    start,
    reduced: REDUCED,
    channels: ORDER,
  };

  /* ==================================================================
     BAR SCOPE — tiny live trace in the fixed instrument bar.
     setChannel(name) morphs it to whatever section is active.
     ================================================================== */
  function barScope(canvas) {
    let off = 0;
    let cur = "ecg";
    let nxt = "ecg";
    let mix = 1;
    let inView = true;
    new IntersectionObserver((es) => (inView = es[0].isIntersecting), {
      threshold: 0,
    }).observe(canvas);

    function render() {
      if (!inView) return;
      const { ctx, w, h } = fit(canvas);
      const mid = h * 0.5;
      const amp = h * 0.4;
      if (!REDUCED) off += 1.1;
      if (mix < 1) mix = Math.min(1, mix + 0.05);
      ctx.clearRect(0, 0, w, h);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.shadowColor = ACCENT;
      ctx.shadowBlur = 5;
      ctx.strokeStyle = ACCENT;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 2) {
        const p = x + off;
        const v = lerp(CH[cur](p), CH[nxt](p), mix);
        const y = mid - clamp(v, -1, 1) * amp;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }
    ticks.push(render);
    render();
    return {
      setChannel(name) {
        if (!CH[name] || name === nxt) return;
        cur = nxt;
        nxt = name;
        mix = 0;
      },
    };
  }
})();
