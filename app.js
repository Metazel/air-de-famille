(() => {
  // src/js/util.js
  var $ = (sel, root = document) => root.querySelector(sel);
  var $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  function applyCss(root) {
    if (root.nodeType !== 1) return;
    const list = root.matches("[data-css]") ? [root, ...root.querySelectorAll("[data-css]")] : root.querySelectorAll("[data-css]");
    for (const n of list) {
      n.style.cssText = n.dataset.css;
      n.removeAttribute("data-css");
    }
  }
  function initCssAttrs() {
    applyCss(document.body);
    new MutationObserver((muts) => {
      for (const m of muts) for (const n of m.addedNodes) applyCss(n);
    }).observe(document.body, { childList: true, subtree: true });
  }
  var esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  var fmt = (v, d = 2) => v.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
  var cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  var clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  var mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
  var median = (a) => {
    const s = [...a].sort((x, y) => x - y);
    return s.length ? s[s.length >> 1] : NaN;
  };
  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }
  function makeCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  }
  var ctx2d = (c) => c.getContext("2d", { willReadFrequently: true });
  function ageLabel(a, estimate = false) {
    if (a == null || !isFinite(a)) return "";
    const cut = estimate ? Math.round : Math.floor;
    if (a < 2) {
      const m = Math.max(0, cut(a * 12 + 1e-6));
      return `${m} mois`;
    }
    const y = cut(a + 1e-6);
    return y === 1 ? "1 an" : `${y} ans`;
  }
  function parseAge(text) {
    const t = String(text || "").trim().toLowerCase().replace(",", ".");
    if (!t) return null;
    let years = 0;
    let found = false;
    const y = t.match(/(\d+(?:\.\d+)?)\s*(?:a|an|ans|y)\b/);
    const m = t.match(/(\d+(?:\.\d+)?)\s*(?:m|mois)\b/);
    if (y) {
      years += parseFloat(y[1]);
      found = true;
    }
    if (m) {
      years += parseFloat(m[1]) / 12;
      found = true;
    }
    if (!found) {
      const n = t.match(/^\d+(?:\.\d+)?$/);
      if (!n) return null;
      years = parseFloat(n[0]);
    }
    return years >= 0 && years <= 120 ? years : null;
  }
  function yearsBetween(fromIso, toIso) {
    const d = (s) => {
      const [Y, M = "07", D = "15"] = String(s).split("-");
      return new Date(Date.UTC(+Y, +M - 1, +D));
    };
    if (!fromIso || !toIso) return null;
    const v = (d(toIso) - d(fromIso)) / (365.25 * 864e5);
    return isFinite(v) && v >= 0 ? v : null;
  }

  // src/js/queue.js
  var tail = Promise.resolve();
  var pending = 0;
  var listeners = /* @__PURE__ */ new Set();
  function enqueue(job) {
    pending++;
    emit();
    const run22 = tail.then(job, job);
    tail = run22.catch(() => {
    }).finally(() => {
      pending--;
      emit();
    });
    return run22;
  }
  function onQueueChange(fn) {
    listeners.add(fn);
  }
  function emit() {
    for (const fn of listeners) fn(pending);
  }

  // src/js/engine/geometry.js
  function meanPt(P, a, b) {
    let x = 0, y = 0;
    for (let i = a; i <= b; i++) {
      x += P[i][0];
      y += P[i][1];
    }
    const n = b - a + 1;
    return [x / n, y / n];
  }
  function normalize(P) {
    const r = meanPt(P, 36, 41), l = meanPt(P, 42, 47);
    const mx = (r[0] + l[0]) / 2, my = (r[1] + l[1]) / 2;
    const ang = Math.atan2(l[1] - r[1], l[0] - r[0]);
    const iod = Math.hypot(l[0] - r[0], l[1] - r[1]);
    const c = Math.cos(-ang), s = Math.sin(-ang);
    return {
      frame: { mx, my, ang, iod },
      norm: P.map(([x, y]) => {
        const dx = x - mx, dy = y - my;
        return [(dx * c - dy * s) / iod, (dx * s + dy * c) / iod];
      })
    };
  }
  function frameTransform(F, K3, u0, v0) {
    const c = Math.cos(-F.ang), s = Math.sin(-F.ang), q = K3 / F.iod;
    return [q * c, q * s, -q * s, q * c, -q * (c * F.mx - s * F.my) - K3 * u0, -q * (s * F.mx + c * F.my) - K3 * v0];
  }
  var MIRROR = (() => {
    const m = [...Array(68).keys()];
    const pair = (a, b) => {
      m[a] = b;
      m[b] = a;
    };
    for (let i = 0; i < 8; i++) pair(i, 16 - i);
    [
      [17, 26],
      [18, 25],
      [19, 24],
      [20, 23],
      [21, 22],
      [31, 35],
      [32, 34],
      [36, 45],
      [37, 44],
      [38, 43],
      [39, 42],
      [40, 47],
      [41, 46],
      [48, 54],
      [49, 53],
      [50, 52],
      [55, 59],
      [56, 58],
      [60, 64],
      [61, 63],
      [65, 67]
    ].forEach(([a, b]) => pair(a, b));
    return m;
  })();
  var symmetrize = (N) => N.map((p, i) => {
    const q = N[MIRROR[i]];
    return [(p[0] - q[0]) / 2, (p[1] + q[1]) / 2];
  });
  function measures(N) {
    const D = (i, j) => Math.hypot(N[i][0] - N[j][0], N[i][1] - N[j][1]);
    const fw = D(0, 16);
    const open2 = (a, b, c, d, e, f) => (D(b, f) + D(c, e)) / 2 / D(a, d);
    const tilt = (outer, inner) => Math.atan2(N[inner][1] - N[outer][1], Math.abs(N[inner][0] - N[outer][0])) * 180 / Math.PI;
    const arch = (a, m, b) => {
      const [ax, ay] = N[a], [bx, by] = N[b], [mx, my] = N[m];
      const len = Math.hypot(bx - ax, by - ay);
      return Math.abs((bx - ax) * (my - ay) - (by - ay) * (mx - ax)) / len / len;
    };
    const eyeR = meanPt(N, 36, 41), eyeL = meanPt(N, 42, 47);
    const mid = [(N[0][0] + N[16][0]) / 2, (N[0][1] + N[16][1]) / 2];
    const contour = [];
    for (let i = 0; i <= 16; i++) contour.push((N[i][0] - mid[0]) / fw, (N[i][1] - mid[1]) / fw);
    const upper = D(51, 62), lower = D(66, 57), mw = D(48, 54);
    return {
      hw: D(27, 8) / fw,
      jaw: D(4, 12) / fw,
      chin: D(6, 10) / fw,
      contour,
      eyeSpan: 1 / fw,
      inner: D(39, 42),
      open: (open2(36, 37, 38, 39, 40, 41) + open2(42, 43, 44, 45, 46, 47)) / 2,
      eyeW: (D(36, 39) + D(42, 45)) / 2,
      tilt: (tilt(36, 39) + tilt(45, 42)) / 2,
      browEye: (eyeR[1] - N[19][1] + (eyeL[1] - N[24][1])) / 2,
      arch: (arch(17, 19, 21) + arch(22, 24, 26)) / 2,
      browLen: (D(17, 21) + D(22, 26)) / 2,
      noseW: D(31, 35),
      noseL: D(27, 33),
      noseR: D(31, 35) / D(27, 33),
      mouthW: mw,
      lips: (upper + lower) / mw,
      lipRatio: upper / (upper + lower),
      philtrum: D(33, 51),
      lower3: D(33, 8) / D(27, 33),
      chinPart: D(57, 8) / D(33, 8),
      noseMouth: D(31, 35) / mw
    };
  }
  function inPoly(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if (yi > y !== yj > y && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function shiftDet(det, ox, oy, k) {
    const P = ([x, y]) => [(x - ox) * k, (y - oy) * k];
    return {
      ...det,
      pts: det.pts.map(P),
      box: { x: (det.box.x - ox) * k, y: (det.box.y - oy) * k, width: det.box.width * k, height: det.box.height * k },
      frame: { mx: (det.frame.mx - ox) * k, my: (det.frame.my - oy) * k, ang: det.frame.ang, iod: det.frame.iod * k }
    };
  }

  // src/js/engine/appearance.js
  var REGIONS = {
    eyes: { ids: [36, 47], w: 2.4, h: 0.8 },
    brows: { ids: [17, 26], w: 2.6, h: 0.6 },
    nose: { ids: [27, 35], w: 1, h: 1.1 },
    mouth: { ids: [48, 59], w: 1.5, h: 0.7 }
  };
  var K = 40;
  function appearance(src, N, F) {
    const out = {};
    for (const [key, R] of Object.entries(REGIONS)) {
      const [cu, cv] = meanPt(N, R.ids[0], R.ids[1]);
      const W = Math.round(R.w * K / 8) * 8, H = Math.round(R.h * K / 8) * 8;
      const c = makeCanvas(W, H), g = ctx2d(c);
      g.imageSmoothingQuality = "high";
      const [a, b, cc, d, e, f] = frameTransform(F, K, cu, cv);
      g.setTransform(a, b, cc, d, e + W / 2, f + H / 2);
      g.drawImage(src, 0, 0);
      const px = g.getImageData(0, 0, W, H).data, lum = new Float32Array(W * H);
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const k = (y * W + x) * 4, k2 = (y * W + (W - 1 - x)) * 4;
          lum[y * W + x] = Math.sqrt((0.299 * (px[k] + px[k2]) + 0.587 * (px[k + 1] + px[k2 + 1]) + 0.114 * (px[k + 2] + px[k2 + 2])) / 510);
        }
      out[key] = hog(lum, W, H);
    }
    return out;
  }
  function hog(L, W, H) {
    const B = 9, cw = W / 8, ch = H / 8, cells = new Float32Array(cw * ch * B);
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        const gx = L[y * W + x + 1] - L[y * W + x - 1], gy = L[(y + 1) * W + x] - L[(y - 1) * W + x];
        const m2 = Math.hypot(gx, gy);
        let a = Math.atan2(gy, gx);
        if (a < 0) a += Math.PI;
        const bf = a / Math.PI * B, b0 = Math.floor(bf) % B, b1 = (b0 + 1) % B, t = bf - Math.floor(bf);
        const ci = (Math.floor(y / 8) * cw + Math.floor(x / 8)) * B;
        cells[ci + b0] += m2 * (1 - t);
        cells[ci + b1] += m2 * t;
      }
    const v = [];
    for (let cy = 0; cy < ch; cy++)
      for (let cx = 0; cx < cw; cx++) {
        let e = 1e-6;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const yy = cy + dy, xx = cx + dx;
            if (yy < 0 || xx < 0 || yy >= ch || xx >= cw) continue;
            for (let b = 0; b < B; b++) e += cells[(yy * cw + xx) * B + b] ** 2;
          }
        const n = Math.sqrt(e);
        for (let b = 0; b < B; b++) v.push(Math.min(0.4, cells[(cy * cw + cx) * B + b] / n));
      }
    let m = 0;
    for (const x of v) m += x;
    m /= v.length;
    let nn = 0;
    for (let i = 0; i < v.length; i++) {
      v[i] -= m;
      nn += v[i] * v[i];
    }
    nn = Math.sqrt(nn) || 1;
    return v.map((x) => x / nn);
  }
  var cosine = (a, b) => {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i] * b[i];
    return s;
  };

  // src/js/engine/color.js
  function srgbToLab(r, g, b) {
    const f = (v) => {
      v /= 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    const R = f(r), G = f(g), B = f(b);
    let X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
    let Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
    let Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
    const h = (t) => t > 8856e-6 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
    X = h(X);
    Y = h(Y);
    Z = h(Z);
    return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
  }
  var lumOf = (p) => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
  function pixelsIn(ctx, x0, y0, x1, y1, test) {
    x0 = Math.max(0, Math.floor(x0));
    y0 = Math.max(0, Math.floor(y0));
    x1 = Math.min(ctx.canvas.width, Math.ceil(x1));
    y1 = Math.min(ctx.canvas.height, Math.ceil(y1));
    const w = x1 - x0, h = y1 - y0, out = [];
    if (w < 1 || h < 1) return out;
    const d = ctx.getImageData(x0, y0, w, h).data;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (!test(x0 + x, y0 + y)) continue;
        const k = (y * w + x) * 4;
        out.push([d[k], d[k + 1], d[k + 2]]);
      }
    return out;
  }
  function band(px, lo, hi) {
    const s = [...px].sort((a, b) => lumOf(a) - lumOf(b));
    return s.slice(Math.floor(s.length * lo), Math.ceil(s.length * hi));
  }
  function summarize(px, gain) {
    const cor = px.map((p) => p.map((v, i) => Math.min(255, v * gain[i])));
    const clipped = cor.filter((p) => p[0] >= 254 || p[1] >= 254 || p[2] >= 254).length / Math.max(1, cor.length);
    if (clipped > 0.25) return null;
    const labs = cor.map((p) => srgbToLab(p[0], p[1], p[2]));
    return {
      rgb: [0, 1, 2].map((i) => Math.round(median(cor.map((p) => p[i])))),
      lab: [0, 1, 2].map((i) => median(labs.map((l) => l[i])))
    };
  }
  function sampleColors(c, P) {
    const ctx = ctx2d(c);
    const avg2 = (ids) => {
      let x = 0, y = 0;
      ids.forEach((i) => {
        x += P[i][0];
        y += P[i][1];
      });
      return [x / ids.length, y / ids.length];
    };
    const r = meanPt(P, 36, 41), l = meanPt(P, 42, 47), iod = Math.hypot(l[0] - r[0], l[1] - r[1]);
    let eyePx = [], irisPx = [];
    for (const [a, b] of [
      [36, 41],
      [42, 47]
    ]) {
      const poly = P.slice(a, b + 1), xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
      const [cx, cy] = meanPt(P, a, b), rr = Math.hypot(P[a + 3][0] - P[a][0], P[a + 3][1] - P[a][1]) * 0.3;
      eyePx = eyePx.concat(pixelsIn(ctx, Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), (x, y) => inPoly(x, y, poly)));
      irisPx = irisPx.concat(
        pixelsIn(ctx, cx - rr, cy - rr, cx + rr, cy + rr, (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= rr * rr && inPoly(x, y, poly))
      );
    }
    let gain = [1, 1, 1], wb = false;
    if (eyePx.length >= 40) {
      const top = band(eyePx, 0.75, 0.95), ref = [0, 1, 2].map((i) => median(top.map((p) => p[i]))), lr = lumOf(ref);
      if (lr > 45) {
        gain = ref.map((v) => Math.min(1.25, Math.max(0.8, lr / Math.max(1, v))));
        wb = true;
      }
    }
    let skinPx = [];
    for (const ids of [
      [1, 2, 31, 41],
      [15, 14, 35, 46]
    ]) {
      const [x, y] = avg2(ids), rr = iod * 0.11;
      skinPx = skinPx.concat(pixelsIn(ctx, x - rr, y - rr, x + rr, y + rr, (px, py) => (px - x) ** 2 + (py - y) ** 2 <= rr * rr));
    }
    const skin = skinPx.length >= 30 ? summarize(band(skinPx, 0.15, 0.85), gain) : null;
    const iris = irisPx.length >= 20 ? summarize(band(irisPx, 0.15, 0.6), gain) : null;
    return { skin, iris, wb };
  }
  var deltaE = (a, b) => Math.hypot(0.3 * (a[0] - b[0]), a[1] - b[1], a[2] - b[2]);

  // src/js/engine/quality.js
  function patchStats(ctx, cx, cy, r) {
    const x0 = Math.max(0, Math.floor(cx - r)), y0 = Math.max(0, Math.floor(cy - r));
    const w = Math.min(ctx.canvas.width - x0, Math.ceil(2 * r)), h = Math.min(ctx.canvas.height - y0, Math.ceil(2 * r));
    if (w < 4 || h < 4) return null;
    const d = ctx.getImageData(x0, y0, w, h).data, L = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) L[i] = lumOf([d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]);
    const ls = [];
    let e = 0, n = 0;
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++) {
        if ((x - w / 2) ** 2 + (y - h / 2) ** 2 > r * r) continue;
        const i = y * w + x;
        ls.push(L[i]);
        e += Math.abs(L[i + 1] - L[i - 1]) + Math.abs(L[i + w] - L[i - w]);
        n++;
      }
    if (n < 10) return null;
    const lm = median(ls);
    return { L: lm, E: e / n / Math.max(20, lm) };
  }
  function glassesBridge(c, N, F) {
    const K3 = 60, W = 30, H = 30, cu = (N[39][0] + N[42][0]) / 2, cv = (N[39][1] + N[42][1]) / 2 - 0.04;
    const o = makeCanvas(W, H), g = ctx2d(o);
    const [a, b, cc, d, e, f] = frameTransform(F, K3, cu, cv);
    g.setTransform(a, b, cc, d, e + W / 2, f + H / 2);
    g.drawImage(c, 0, 0);
    const px = g.getImageData(0, 0, W, H).data, L = (i) => 0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2];
    let lum = 0;
    for (let i = 0; i < W * H; i++) lum += L(i);
    lum /= W * H;
    const rowE = [];
    for (let y = 1; y < H - 1; y++) {
      let t = 0;
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        t += Math.abs(L(i + W) - L(i - W));
      }
      rowE.push(t / (W - 2));
    }
    const peak = Math.max(...rowE);
    return peak / Math.max(20, lum) >= 0.28 && peak / (mean(rowE) + 1) >= 2.3;
  }
  function occlusion(c, P, F, N) {
    const ctx = ctx2d(c), iod = F.iod, up = [Math.sin(F.ang), -Math.cos(F.ang)];
    const mid = (a, b, t = 0.5) => [P[a][0] + (P[b][0] - P[a][0]) * t, P[a][1] + (P[b][1] - P[a][1]) * t];
    const ref = [mid(2, 31), mid(14, 35)].map(([x, y]) => patchStats(ctx, x, y, iod * 0.09)).filter(Boolean);
    if (!ref.length) return {};
    const L0 = mean(ref.map((r) => r.L)), E0 = mean(ref.map((r) => r.E));
    const hidden = (st) => st && (st.L < L0 * 0.7 || st.E > Math.max(E0 * 2.4, 0.1));
    const open2 = Math.hypot(P[62][0] - P[66][0], P[62][1] - P[66][1]) / Math.hypot(P[48][0] - P[54][0], P[48][1] - P[54][1]) > 0.12;
    const chin = patchStats(ctx, ...mid(57, 8, open2 ? 0.7 : 0.55), iod * (open2 ? 0.09 : 0.12));
    const lip = open2 ? null : patchStats(ctx, ...mid(33, 51), iod * 0.06);
    const fore = [19, 24].map((i) => patchStats(ctx, P[i][0] + up[0] * iod * 0.32, P[i][1] + up[1] * iod * 0.32, iod * 0.1));
    return { beard: !!(hidden(chin) || hidden(lip)), fringe: fore.every((f) => f && f.L < L0 * 0.7), glasses: glassesBridge(c, N, F) };
  }
  function quality(N, box, occ = {}, age = null) {
    const w = [], q = { eyes: 1, mouth: 1, jaw: 1, brows: 1, overall: 1, why: {}, ageRisk: null };
    const D = (i, j) => Math.hypot(N[i][0] - N[j][0], N[i][1] - N[j][1]);
    const yaw = Math.abs((N[30][0] - N[0][0]) / (N[16][0] - N[0][0]) - 0.5);
    if (yaw > 0.07) {
      w.push("Visage tourné");
      q.overall -= yaw > 0.12 ? 0.4 : 0.2;
    }
    if ((D(37, 41) + D(38, 40)) / 2 / D(36, 39) < 0.14) {
      w.push("Yeux mi-clos");
      q.eyes = 0.3;
      q.why.eyes = "yeux mi-clos";
      q.overall -= 0.15;
    }
    if (D(62, 66) / D(48, 54) > 0.12) {
      w.push("Bouche ouverte");
      q.mouth = 0.3;
      q.why.mouth = "bouche ouverte";
      q.overall -= 0.1;
    }
    if (occ.beard && !(age != null && age < 14)) {
      w.push("Barbe");
      q.mouth = Math.min(q.mouth, 0.3);
      q.jaw = 0.3;
      q.why.mouth = "barbe ou moustache";
      q.why.jaw = "barbe";
      q.overall -= 0.1;
    }
    if (occ.fringe) {
      w.push("Frange sur le front");
      q.brows = 0.3;
      q.why.brows = "sourcils en partie cachés";
      q.overall -= 0.05;
    }
    if (occ.hairSides) {
      w.push("Cheveux sur les côtés");
      q.jaw = Math.min(q.jaw, 0.3);
      q.why.jaw = q.why.jaw ? `${q.why.jaw}, cheveux sur les côtés` : "cheveux sur les côtés";
      q.overall -= 0.05;
    }
    if (occ.glasses) {
      w.push("Lunettes");
      q.eyes = Math.min(q.eyes, 0.5);
      q.why.eyes = "lunettes";
      q.ageRisk = "lunettes";
      q.overall -= 0.1;
    }
    const mw = D(48, 54), curv = ((N[62][1] + N[66][1]) / 2 - (N[48][1] + N[54][1]) / 2) / mw;
    if (curv >= 0.1 && mw >= 0.95) {
      w.push("Grand sourire");
      q.mouth = Math.min(q.mouth, 0.5);
      q.why.mouth = q.why.mouth || "grand sourire";
      q.eyes = Math.min(q.eyes, 0.8);
      q.ageRisk = q.ageRisk || "sourire";
      q.overall -= 0.1;
    }
    if (box.width < 110) {
      w.push("Visage petit");
      q.overall -= 0.25;
    }
    q.overall = Math.max(0.2, q.overall);
    return { warn: w, q };
  }
  function imageStats(c, box) {
    const S = 160, sw = Math.max(box.width, box.height) * 0.8, cx = box.x + box.width / 2, cy = box.y + box.height * 0.55;
    const o = makeCanvas(S, S), g = ctx2d(o);
    g.drawImage(c, cx - sw / 2, cy - sw / 2, sw, sw, 0, 0, S, S);
    const d = g.getImageData(0, 0, S, S).data, L = new Float32Array(S * S);
    let sum = 0;
    for (let i = 0; i < S * S; i++) sum += L[i] = lumOf([d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]);
    const light = sum / (S * S);
    let s1 = 0, s2 = 0, n = 0;
    for (let y = 1; y < S - 1; y++)
      for (let x = 1; x < S - 1; x++) {
        const i = y * S + x, lap = 4 * L[i] - L[i - 1] - L[i + 1] - L[i - S] - L[i + S];
        s1 += lap;
        s2 += lap * lap;
        n++;
      }
    const sharp = Math.sqrt(Math.max(0, s2 / n - (s1 / n) ** 2)) / Math.max(20, light) * 100;
    return { light: Math.round(light), sharp: Math.round(sharp * 10) / 10 };
  }
  var GATE = { minWidth: 110, maxYaw: 0.12, minSharp: 4, minLight: 55, maxLight: 235, maxRough: 0.11 };
  function contourRoughness(N) {
    let t = 0;
    for (let i = 1; i < 16; i++) t += Math.hypot(N[i - 1][0] - 2 * N[i][0] + N[i + 1][0], N[i - 1][1] - 2 * N[i][1] + N[i + 1][1]);
    return t / 15;
  }
  function gate(det) {
    const redo = [], keep = [], N = det.norm, occ = det.occ || {}, img = det.img;
    if (det.box.width < GATE.minWidth) redo.push("visage trop petit : rapprochez-vous ou recadrez");
    if (N && Math.abs((N[30][0] - N[0][0]) / (N[16][0] - N[0][0]) - 0.5) > GATE.maxYaw) redo.push("visage tourné : regardez l'objectif");
    if (N && contourRoughness(N) > GATE.maxRough) redo.push("repères mal placés : photo floue ou bougée ?");
    if (det.warn?.includes("Yeux mi-clos")) redo.push("yeux mi-clos");
    if (occ.glasses) redo.push("lunettes : retirez-les si possible (les verres changent la taille apparente des yeux)");
    if (img && img.sharp < GATE.minSharp) redo.push("photo floue");
    if (img && img.light < GATE.minLight) redo.push("visage trop sombre");
    if (img && img.light > GATE.maxLight) redo.push("visage surexposé");
    if (occ.beard && det.warn?.includes("Barbe")) keep.push("barbe ou moustache : bouche et menton comptent moins");
    if (occ.fringe) keep.push("frange : sourcils moins fiables");
    if (occ.hairSides) keep.push("cheveux sur les côtés : forme du visage moins fiable");
    return { verdict: redo.length ? "reprendre" : keep.length ? "reserve" : "ok", redo, keep };
  }
  var relLabel = (r) => r >= 0.85 ? ["Bonne", "ok"] : r >= 0.6 ? ["Moyenne", "warn"] : ["Faible", "bad"];

  // src/js/engine/detect.js
  var MODEL_URL = "model";
  var detSeq = 0;
  var nextDetId = () => ++detSeq;
  function loadScript(src, integrity) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      if (integrity) {
        s.integrity = integrity;
        s.crossOrigin = "anonymous";
      }
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  async function loadEngine(onStep = () => {
  }) {
    if (!window.faceapi) {
      onStep("Chargement de la bibliothèque…");
      if (true) await loadScript("vendor/face-api.js");
      else await loadScript(CDN, CDN_SRI).catch(() => loadScript("vendor/face-api.js"));
    }
    onStep("Initialisation du calcul…");
    try {
      faceapi.tf.removeBackend("wasm");
    } catch {
    }
    try {
      await faceapi.tf.setBackend("webgl");
    } catch {
      await faceapi.tf.setBackend("cpu");
    }
    await faceapi.tf.ready();
    let done = 0;
    const load = (net) => net.loadFromUri(MODEL_URL).then(() => {
      done++;
      onStep(`Chargement des modèles : ${done} sur 4`);
    });
    await Promise.all([
      load(faceapi.nets.ssdMobilenetv1),
      load(faceapi.nets.faceLandmark68Net),
      load(faceapi.nets.faceRecognitionNet),
      load(faceapi.nets.ageGenderNet)
    ]);
    onStep("Préparation finale (la première analyse peut prendre quelques secondes)…");
  }
  async function decodeImage(file, maxSide = 2e3) {
    let img;
    if (window.createImageBitmap) {
      try {
        img = await createImageBitmap(file, { imageOrientation: "from-image" });
      } catch {
        img = null;
      }
    }
    if (!img) {
      img = await new Promise((res, rej) => {
        const url = URL.createObjectURL(file), im = new Image();
        im.onload = () => {
          URL.revokeObjectURL(url);
          res(im);
        };
        im.onerror = () => {
          URL.revokeObjectURL(url);
          rej(new Error("image illisible"));
        };
        im.src = url;
      });
    }
    const iw = img.width || img.naturalWidth, ih = img.height || img.naturalHeight;
    const k = Math.min(1, maxSide / Math.max(iw, ih)), c = makeCanvas(iw * k, ih * k);
    ctx2d(c).drawImage(img, 0, 0, c.width, c.height);
    img.close?.();
    return c;
  }
  async function decodeVideo(file) {
    const url = URL.createObjectURL(file), v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.src = url;
    try {
      await new Promise((res, rej) => {
        v.onloadeddata = res;
        v.onerror = () => rej(new Error("vidéo illisible"));
        setTimeout(() => rej(new Error("délai dépassé")), 15e3);
      });
      const dur2 = v.duration;
      if (!isFinite(dur2) || dur2 <= 0) throw new Error("durée inconnue");
      const n = Math.min(12, Math.max(4, Math.round(dur2 * 3))), frames = [];
      for (let k = 0; k < n; k++) {
        await new Promise((r) => {
          v.onseeked = r;
          v.currentTime = Math.min(dur2 - 0.05, dur2 * (k + 0.5) / n);
        });
        const kk = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight)), c = makeCanvas(v.videoWidth * kk, v.videoHeight * kk);
        ctx2d(c).drawImage(v, 0, 0, c.width, c.height);
        frames.push(c);
      }
      return frames;
    } finally {
      URL.revokeObjectURL(url);
      v.removeAttribute("src");
      v.load();
    }
  }
  async function exifDate(file) {
    try {
      if (!/jpe?g/i.test(file.type) && !/\.jpe?g$/i.test(file.name || "")) return null;
      const v = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
      if (v.getUint16(0) !== 65496) return null;
      let o = 2;
      while (o + 4 < v.byteLength) {
        const marker = v.getUint16(o), len = v.getUint16(o + 2);
        if (marker === 65505 && v.getUint32(o + 4) === 1165519206) return readTiffDate(v, o + 10);
        if ((marker & 65280) !== 65280) break;
        o += 2 + len;
      }
    } catch {
    }
    return null;
  }
  function readTiffDate(v, t) {
    const le = v.getUint16(t) === 18761;
    const u16 = (p) => v.getUint16(t + p, le), u32 = (p) => v.getUint32(t + p, le);
    const ifd = (off, want) => {
      const n = u16(off), out = {};
      for (let i = 0; i < n; i++) {
        const e = off + 2 + i * 12, tag = u16(e);
        if (want.includes(tag)) out[tag] = { type: u16(e + 2), count: u32(e + 4), val: u32(e + 8) };
      }
      return out;
    };
    const str = (ent) => {
      let s = "";
      for (let i = 0; i < Math.min(19, ent.count - 1); i++) s += String.fromCharCode(v.getUint8(t + ent.val + i));
      return s;
    };
    const ifd0 = ifd(u32(4), [34665, 306]);
    let raw = null;
    if (ifd0[34665]) {
      const ex = ifd(ifd0[34665].val, [36867]);
      if (ex[36867]) raw = str(ex[36867]);
    }
    if (!raw && ifd0[306]) raw = str(ifd0[306]);
    const m = raw && raw.match(/^(\d{4}):(\d{2}):(\d{2})/);
    return m && m[1] !== "0000" ? `${m[1]}-${m[2]}-${m[3]}` : null;
  }
  var detectAll = (c) => faceapi.detectAllFaces(c, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.35 })).withFaceLandmarks().withFaceDescriptors().withAgeAndGender();
  function exposeFace(c, b) {
    const ctx = ctx2d(c);
    const L = pixelsIn(
      ctx,
      b.x + b.width * 0.2,
      b.y + b.height * 0.25,
      b.x + b.width * 0.8,
      b.y + b.height * 0.85,
      (x, y) => (x + y & 3) === 0
    ).map(lumOf);
    if (L.length < 50) return c;
    const m = mean(L);
    if (m >= 135 && m <= 190) return c;
    const g = Math.log(150 / 255) / Math.log(Math.max(20, Math.min(240, m)) / 255), lut = new Uint8ClampedArray(256);
    for (let i = 0; i < 256; i++) lut[i] = 255 * Math.pow(i / 255, g);
    const o = makeCanvas(c.width, c.height), og = ctx2d(o), im = ctx.getImageData(0, 0, c.width, c.height), d = im.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = lut[d[i]];
      d[i + 1] = lut[d[i + 1]];
      d[i + 2] = lut[d[i + 2]];
    }
    og.putImageData(im, 0, 0);
    o.exposed = Math.round(m);
    return o;
  }
  async function refineLandmarks(src, box, pts) {
    try {
      const m = 0.25, x0 = Math.max(0, box.x - box.width * m), y0 = Math.max(0, box.y - box.height * m);
      const x1 = Math.min(src.width, box.x + box.width * (1 + m)), y1 = Math.min(src.height, box.y + box.height * (1 + m));
      const w = x1 - x0, h = y1 - y0, c = makeCanvas(w, h), g = c.getContext("2d");
      g.translate(c.width, 0);
      g.scale(-1, 1);
      g.drawImage(src, x0, y0, w, h, 0, 0, c.width, c.height);
      const P = (await faceapi.detectFaceLandmarks(c)).positions, k = w / c.width;
      return pts.map((p, i) => {
        const q = P[MIRROR[i]];
        return [(p[0] + (x0 + (c.width - q.x) * k)) / 2, (p[1] + (y0 + q.y * k)) / 2];
      });
    } catch {
      return pts;
    }
  }
  async function describe(canvas, d, colorCanvas = canvas, onStep) {
    await onStep?.("align");
    const pts = await refineLandmarks(
      canvas,
      d.detection.box,
      d.landmarks.positions.map((p) => [p.x, p.y])
    );
    await onStep?.("traits");
    const { norm, frame } = normalize(pts);
    const b = d.detection.box, box = { x: b.x, y: b.y, width: b.width, height: b.height };
    const occ = occlusion(colorCanvas, pts, frame, norm);
    const { warn, q } = quality(norm, box, occ, d.age);
    return {
      id: nextDetId(),
      pts,
      norm,
      frame,
      box,
      occ,
      warn,
      q,
      age: d.age,
      desc: d.descriptor,
      m: measures(symmetrize(norm)),
      app: appearance(canvas, norm, frame),
      col: sampleColors(colorCanvas, pts),
      img: { ...imageStats(canvas, box), light: imageStats(colorCanvas, box).light }
    };
  }
  function requalify(det, age) {
    if (!det.occ) return det;
    const { warn, q } = quality(det.norm, det.box, det.occ, age ?? det.age);
    return { ...det, warn, q, id: nextDetId() };
  }
  async function findFaces(canvas, onStep) {
    await onStep?.("detect");
    let dets = await detectAll(canvas);
    if (!dets.length) return { work: canvas, faces: [] };
    dets.sort((a, b) => b.detection.box.area - a.detection.box.area);
    let work2 = exposeFace(canvas, dets[0].detection.box);
    if (work2 !== canvas) {
      await onStep?.("light");
      const d2 = await detectAll(work2);
      if (d2.length) dets = d2.sort((a, b) => b.detection.box.area - a.detection.box.area);
      else work2 = canvas;
    }
    return { work: work2, faces: dets.slice(0, 8) };
  }
  async function describeVideo(frames) {
    const cand = [];
    for (const c of frames) {
      const dets2 = await detectAll(c);
      if (!dets2.length) continue;
      const d = dets2.reduce((a, b) => b.detection.box.area > a.detection.box.area ? b : a);
      const P = d.landmarks.positions, yaw = Math.abs((P[30].x - P[0].x) / (P[16].x - P[0].x) - 0.5);
      cand.push({ c, d, yaw });
    }
    if (!cand.length) return null;
    cand.sort((a, b) => a.yaw - b.yaw);
    const keep = cand.filter((x) => x.yaw <= 0.06).slice(0, 6);
    const use = keep.length >= 2 ? keep : cand.slice(0, Math.min(3, cand.length));
    const dets = [];
    for (const x of use) dets.push(await describe(x.c, x.d));
    const best = dets[0], n = dets.length;
    const avgArr = (arrs) => arrs[0].map((_, i) => arrs.reduce((t, a) => t + a[i], 0) / arrs.length);
    const norm = best.norm.map((_, i) => [mean(dets.map((d) => d.norm[i][0])), mean(dets.map((d) => d.norm[i][1]))]);
    const app = {};
    for (const k of Object.keys(best.app)) {
      const v = avgArr(dets.map((d) => d.app[k])), nn = Math.hypot(...v) || 1;
      app[k] = v.map((x) => x / nn);
    }
    const medCol = (key) => {
      const cs = dets.map((d) => d.col[key]).filter(Boolean);
      if (!cs.length) return null;
      return {
        lab: [0, 1, 2].map((i) => median(cs.map((c) => c.lab[i]))),
        rgb: [0, 1, 2].map((i) => Math.round(median(cs.map((c) => c.rgb[i]))))
      };
    };
    const q = { ...best.q };
    for (const k of ["eyes", "mouth", "jaw", "brows", "overall"]) q[k] = Math.max(...dets.map((d) => d.q[k]));
    const det = {
      ...best,
      id: nextDetId(),
      norm,
      m: measures(symmetrize(norm)),
      app,
      desc: new Float32Array(avgArr(dets.map((d) => Array.from(d.desc)))),
      col: { skin: medCol("skin"), iris: medCol("iris") },
      q,
      age: median(dets.map((d) => d.age)),
      occ: null,
      frames: n,
      of: frames.length,
      warn: best.warn.filter((w) => !(w === "Visage tourné" && q.overall >= 0.8))
    };
    return { canvas: use[0].c, det };
  }
  function fuseDets(dets) {
    if (dets.length < 2) return dets[0];
    const main = dets[0], w = dets.map((d) => Math.max(0.05, d.q.overall) * (gate(d).verdict === "reprendre" ? 0.3 : 1)), W = w.reduce((a, b) => a + b, 0);
    const wavg = (get) => get(main).map((_, i) => dets.reduce((t, d, k) => t + w[k] * get(d)[i], 0) / W);
    const norm = main.norm.map((_, i) => [0, 1].map((j) => dets.reduce((t, d, k) => t + w[k] * d.norm[i][j], 0) / W));
    const app = {};
    for (const key of Object.keys(main.app)) {
      if (!dets.every((d) => d.app?.[key])) continue;
      const v = wavg((d) => d.app[key]), nn = Math.hypot(...v) || 1;
      app[key] = v.map((x) => x / nn);
    }
    const medCol = (key) => {
      const cs = dets.map((d) => d.col?.[key]).filter(Boolean);
      if (!cs.length) return null;
      return { lab: [0, 1, 2].map((i) => median(cs.map((c) => c.lab[i]))), rgb: [0, 1, 2].map((i) => Math.round(median(cs.map((c) => c.rgb[i])))) };
    };
    const q = { ...main.q, why: { ...main.q.why } };
    for (const k of ["eyes", "mouth", "jaw", "brows", "overall"]) q[k] = dets.reduce((t, d, i) => t + w[i] * d.q[k], 0) / W;
    for (const k of ["eyes", "mouth", "jaw", "brows"]) {
      if (q[k] >= 0.999) delete q.why[k];
      else if (!q.why[k]) q.why[k] = dets.map((d) => d.q.why?.[k]).find(Boolean) || "une des photos";
    }
    return {
      ...main,
      id: nextDetId(),
      norm,
      m: measures(symmetrize(norm)),
      app,
      desc: new Float32Array(wavg((d) => Array.from(d.desc))),
      col: { skin: medCol("skin"), iris: medCol("iris") },
      q,
      photos: dets.length
    };
  }

  // src/js/engine/compare.js
  var TRAITS = [
    {
      id: "visage",
      name: "Forme du visage",
      tag: "signal faible",
      w: 0.4,
      q: "jaw",
      items: [
        { k: "hw", label: "Hauteur ÷ largeur", s: 0.0335, r: 0.55 },
        { k: "jaw", label: "Mâchoire ÷ largeur", s: 0.0127, r: 0.1 },
        { k: "chin", label: "Menton ÷ largeur", s: 0.0156, r: 0.1 },
        { k: "contour", label: "Tracé du contour", s: 0.0204, r: 0.16, shape: true }
      ]
    },
    {
      id: "ecart",
      name: "Écart des yeux",
      tag: "signal faible",
      w: 0.6,
      items: [
        { k: "eyeSpan", label: "Écart ÷ largeur du visage", s: 0.0103, r: 0.48 },
        { k: "inner", label: "Coins internes", s: 67e-4, r: 0.1, u: "é", lens: true }
      ]
    },
    {
      id: "yeux",
      name: "Yeux",
      w: 1.2,
      app: "eyes",
      aw: 0.75,
      q: "eyes",
      items: [
        { k: "open", label: "Ouverture (h ÷ l)", s: 0.0199, r: 0.78 },
        { k: "eyeW", label: "Largeur de l'œil", s: 63e-4, r: 0.13, u: "é" },
        { k: "tilt", label: "Inclinaison", s: 1.3665, r: 0.25, u: "°", d: 1 }
      ]
    },
    {
      id: "sourcils",
      name: "Sourcils",
      w: 0.8,
      app: "brows",
      aw: 0.65,
      q: "brows",
      items: [
        { k: "browEye", label: "Hauteur au-dessus de l'œil", s: 0.035, r: 0.32, u: "é" },
        { k: "arch", label: "Arc", s: 0.0213, r: 0.21 },
        { k: "browLen", label: "Longueur", s: 0.0165, r: 0.55, u: "é" }
      ]
    },
    {
      id: "nez",
      name: "Nez",
      w: 1.1,
      app: "nose",
      aw: 0.6,
      items: [
        { k: "noseW", label: "Largeur des ailes", s: 0.0264, r: 0.55, u: "é" },
        { k: "noseL", label: "Longueur", s: 0.0307, r: 0.74, u: "é" },
        { k: "noseR", label: "Largeur ÷ longueur", s: 0.0412, r: 0.6 }
      ]
    },
    {
      id: "bouche",
      name: "Bouche",
      w: 0.9,
      app: "mouth",
      aw: 0.6,
      q: "mouth",
      items: [
        { k: "mouthW", label: "Largeur", s: 0.0891, r: 0.42, u: "é" },
        { k: "lips", label: "Épaisseur des lèvres", s: 0.0315, r: 0.63 },
        { k: "lipRatio", label: "Part de la lèvre sup.", s: 0.034, r: 0.53 },
        { k: "philtrum", label: "Nez → lèvre", s: 0.0256, r: 0.5, u: "é" }
      ]
    },
    {
      id: "prop",
      name: "Proportions",
      w: 0.8,
      q: "jaw",
      items: [
        { k: "lower3", label: "Bas du visage ÷ nez", s: 0.0794, r: 0.1 },
        { k: "chinPart", label: "Menton ÷ bas du visage", s: 0.0448, r: 0.63 },
        { k: "noseMouth", label: "Nez ÷ bouche", s: 0.0161, r: 0.1 }
      ]
    },
    { id: "teint", name: "Teint", tag: "indicatif", w: 0.3, color: "skin", s: 10 },
    { id: "iris", name: "Couleur des yeux", tag: "hors score", w: 0, color: "iris", s: 12 }
  ];
  var APPMAP = { eyes: [-9.1, 14.422], brows: [-12.044, 17.728], nose: [-6.872, 11.258], mouth: [-6.65, 11.486] };
  var toSim = (meanZ2) => 100 * Math.exp(-meanZ2 / 2);
  var appSim = (r, c) => {
    const [al, be] = APPMAP[r];
    return 100 / (1 + Math.exp(-(al + be * c)));
  };
  var BIG_GAP = 20;
  var REFERENCES = {
    stranger: { lo: 17, hi: 39, mean: 28, label: "Deux inconnus" },
    same: { lo: 64, hi: 89, mean: 78, label: "Même personne" }
  };
  var cache = /* @__PURE__ */ new Map();
  var clearCompareCache = () => cache.clear();
  function compare(A, B, opt = {}) {
    const key = `${A.key}|${B.key}|${A.age ?? ""}|${B.age ?? ""}${opt.lens ? "|L" : ""}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const qa = A.det.q, qb = B.det.q;
    const ageA = A.age ?? A.det.age, ageB = B.age ?? B.det.age;
    const ageGap = ageA != null && ageB != null ? Math.abs(ageA - ageB) : 0;
    const bigGap = ageGap > BIG_GAP;
    const lens = !!(A.det.lens || B.det.lens || opt.lens);
    const traits = TRAITS.map((t) => {
      if (lens && (t.id === "yeux" || t.color === "iris")) return { t, sim: null, wq: 0, lens: true };
      if (t.color) {
        const ca = A.det.col[t.color], cb = B.det.col[t.color];
        if (!ca || !cb) return { t, sim: null, wq: 0 };
        const de = deltaE(ca.lab, cb.lab);
        return { t, sim: toSim((de / t.s) ** 2), de, ca, cb, wq: 1 };
      }
      let sw2 = 0, sz = 0;
      const rows = t.items.filter((it) => !(lens && it.lens)).map((it) => {
        const va = A.det.m[it.k], vb = B.det.m[it.k];
        let z, o;
        if (it.shape) {
          let s = 0;
          for (let i = 0; i < va.length; i += 2) s += (va[i] - vb[i]) ** 2 + (va[i + 1] - vb[i + 1]) ** 2;
          const rms = Math.sqrt(s / (va.length / 2));
          z = rms / it.s;
          o = { it, rms, z };
        } else {
          z = (va - vb) / it.s;
          o = { it, va, vb, z };
        }
        sw2 += it.r;
        sz += it.r * z * z;
        return o;
      });
      const geo2 = toSim(sz / sw2);
      let app = null, sim = geo2;
      if (t.app) {
        app = appSim(t.app, cosine(A.det.app[t.app], B.det.app[t.app]));
        const aw = t.aw * (bigGap ? 0.5 : 1);
        sim = aw * app + (1 - aw) * geo2;
      }
      let wq = t.q && (qa[t.q] < 1 || qb[t.q] < 1) ? Math.min(qa[t.q], qb[t.q]) : 1;
      const why = t.q ? qa.why?.[t.q] || qb.why?.[t.q] : null;
      if (bigGap && t.id === "prop") wq *= 0.5;
      return { t, rows, geo: geo2, app, sim, wq, why, lensCut: lens && t.items.some((it) => it.lens) };
    });
    const dist = faceapi.euclideanDistance(A.det.desc, B.det.desc);
    const ia = 100 / (1 + Math.exp((dist - 0.55) / 0.07));
    let sw = 0, ss = 0;
    for (const r of traits)
      if (r.sim != null) {
        const w = r.t.w * r.wq;
        sw += w;
        ss += r.sim * w;
      }
    const geo = ss / sw;
    const wIA = bigGap ? 0.8 : 0.4;
    const R = { traits, ia, dist, geo, total: wIA * ia + (1 - wIA) * geo, rel: Math.min(qa.overall, qb.overall), ageGap, bigGap, wIA, lens, lensA: !!A.det.lens, lensB: !!B.det.lens };
    if (cache.size > 2e3) cache.delete(cache.keys().next().value);
    cache.set(key, R);
    return R;
  }
  var level = (p) => p >= 80 ? "Très forte" : p >= 65 ? "Forte" : p >= 50 ? "Marquée" : p >= 35 ? "Modérée" : "Faible";

  // src/js/engine/aging.js
  var K2 = 120;
  var BX = [-1.7, 1.7];
  var BY = [-1.6, 2.7];
  var HEAD_W = Math.round((BX[1] - BX[0]) * K2);
  var HEAD_H = Math.round((BY[1] - BY[0]) * K2);
  var toPx = ([x, y]) => [(x - BX[0]) * K2, (y - BY[0]) * K2];
  var HEAD_FRAME = { mx: -BX[0] * K2, my: -BY[0] * K2, ang: 0, iod: K2 };
  var ANCHORS = (() => {
    const a = [];
    for (let i = 0; i < 20; i++) {
      const t = i / 20 * 2 * Math.PI;
      a.push([1.62 * Math.sin(t), 0.55 - 2.05 * Math.cos(t)]);
    }
    const [x0, x1] = BX, [y0, y1] = BY, ym = (y0 + y1) / 2;
    return a.concat([
      [x0, y0],
      [0, y0],
      [x1, y0],
      [x1, ym],
      [x1, y1],
      [0, y1],
      [x0, y1],
      [x0, ym]
    ]);
  })();
  function headCanvas(src, bg) {
    const c = makeCanvas(HEAD_W, HEAD_H), g = c.getContext("2d");
    g.imageSmoothingQuality = "high";
    g.fillStyle = bg;
    g.fillRect(0, 0, HEAD_W, HEAD_H);
    const [a, b, cc, d, e, f] = frameTransform(src.det.frame, K2, BX[0], BY[0]);
    g.setTransform(a, b, cc, d, e, f);
    g.drawImage(src.canvas, 0, 0);
    return c;
  }
  var kGrowth = (a) => 0.38 * (1 - Math.exp(-Math.max(0, a) / 6.5));
  var sag = (a) => clamp((a - 45) / 30, 0, 1);
  var puberty = (a) => clamp((a - 12) / 6, 0, 1);
  function agedShape(N, from, to, sex, P, w) {
    const C = [0, -0.5], k1 = kGrowth(from), k2 = kGrowth(to);
    let T2 = N.map(([x, y]) => {
      const dx = x - C[0], dy = y - C[1], R = Math.hypot(dx, dy);
      if (R < 1e-6) return [x, y];
      const c = -dy / R, f = (1 + k2 * (1 - c)) / (1 + k1 * (1 - c));
      return [C[0] + dx * f, C[1] + dy * f];
    });
    const ds = sag(to) - sag(from);
    if (ds) {
      const mv = (ids, dx, dy) => ids.forEach((i) => {
        T2[i] = [T2[i][0] + Math.sign(T2[i][0]) * dx * ds, T2[i][1] + dy * ds];
      });
      mv([3, 4, 5, 11, 12, 13], 0.035, 0.09);
      mv([6, 7, 8, 9, 10], 0, 0.07);
      mv([30, 31, 32, 33, 34, 35], 0, 0.05);
      mv([17, 18, 19, 20, 21, 22, 23, 24, 25, 26], 0, 0.035);
      mv([50, 51, 52, 61, 62, 63], 0, 0.03);
      mv([56, 57, 58, 65, 66, 67], 0, -0.02);
      mv([48, 54], 0, 0.045);
      mv([37, 38, 43, 44], 0, 0.018);
    }
    const dp = puberty(to) - puberty(from);
    if (dp && sex === "m") {
      [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].forEach((i) => {
        T2[i] = [T2[i][0] * (1 + 0.05 * dp), T2[i][1] + (i >= 6 && i <= 10 ? 0.04 * dp : 0)];
      });
      [27, 28, 29, 30].forEach((i) => {
        T2[i] = [T2[i][0], T2[i][1] + 0.01 * dp];
      });
    }
    if (P && w > 0) T2 = T2.map((p, i) => [p[0] * (1 - w) + P[i][0] * w, p[1] * (1 - w) + P[i][1] * w]);
    return T2;
  }
  function delaunay(P) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, y] of P) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    const d = Math.max(x1 - x0, y1 - y0) * 20, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, n = P.length;
    const V = P.concat([
      [cx - d, cy - d],
      [cx + d, cy - d],
      [cx, cy + d]
    ]);
    const circ = (t) => {
      const [ax, ay] = V[t[0]], [bx, by] = V[t[1]], [qx, qy] = V[t[2]];
      const D = 2 * (ax * (by - qy) + bx * (qy - ay) + qx * (ay - by));
      const ux = ((ax * ax + ay * ay) * (by - qy) + (bx * bx + by * by) * (qy - ay) + (qx * qx + qy * qy) * (ay - by)) / D;
      const uy = ((ax * ax + ay * ay) * (qx - bx) + (bx * bx + by * by) * (ax - qx) + (qx * qx + qy * qy) * (bx - ax)) / D;
      return [ux, uy, (ax - ux) ** 2 + (ay - uy) ** 2];
    };
    let tris = [[n, n + 1, n + 2]];
    for (let i = 0; i < n; i++) {
      const [px, py] = V[i], keep = [], edges = [];
      for (const t of tris) {
        const c = t.c || (t.c = circ(t));
        if ((px - c[0]) ** 2 + (py - c[1]) ** 2 < c[2]) {
          for (const [a, b] of [
            [t[0], t[1]],
            [t[1], t[2]],
            [t[2], t[0]]
          ]) {
            const k = edges.findIndex((e) => e[0] === b && e[1] === a);
            if (k >= 0) edges.splice(k, 1);
            else edges.push([a, b]);
          }
        } else keep.push(t);
      }
      tris = keep;
      for (const [a, b] of edges) tris.push([a, b, i]);
    }
    return tris.filter((t) => t[0] < n && t[1] < n && t[2] < n);
  }
  function warp(src, S, D, tris = delaunay(S)) {
    const out = makeCanvas(src.width, src.height), g = out.getContext("2d");
    g.drawImage(src, 0, 0);
    for (const t of tris) {
      const [[x0, y0], [x1, y1], [x2, y2]] = t.map((i) => S[i]);
      const d = t.map((i) => D[i]);
      const [[u0, v0], [u1, v1], [u2, v2]] = d;
      const den = x0 * (y1 - y2) + x1 * (y2 - y0) + x2 * (y0 - y1);
      if (Math.abs(den) < 1e-6) continue;
      const A = (u0 * (y1 - y2) + u1 * (y2 - y0) + u2 * (y0 - y1)) / den;
      const B = (v0 * (y1 - y2) + v1 * (y2 - y0) + v2 * (y0 - y1)) / den;
      const C = (u0 * (x2 - x1) + u1 * (x0 - x2) + u2 * (x1 - x0)) / den;
      const Dd = (v0 * (x2 - x1) + v1 * (x0 - x2) + v2 * (x1 - x0)) / den;
      const E = (u0 * (x1 * y2 - x2 * y1) + u1 * (x2 * y0 - x0 * y2) + u2 * (x0 * y1 - x1 * y0)) / den;
      const F = (v0 * (x1 * y2 - x2 * y1) + v1 * (x2 * y0 - x0 * y2) + v2 * (x0 * y1 - x1 * y0)) / den;
      const mx = (u0 + u1 + u2) / 3, my = (v0 + v1 + v2) / 3;
      g.save();
      g.beginPath();
      d.forEach(([x, y], j) => {
        const r = Math.hypot(x - mx, y - my) || 1, k = (r + 0.8) / r;
        if (j) g.lineTo(mx + (x - mx) * k, my + (y - my) * k);
        else g.moveTo(mx + (x - mx) * k, my + (y - my) * k);
      });
      g.closePath();
      g.clip();
      g.setTransform(A, B, C, Dd, E, F);
      g.drawImage(src, 0, 0);
      g.restore();
    }
    return out;
  }
  function ageSimulate(src, to, { sex = "", model = null, w = 0, bg = "#888" } = {}) {
    const det = src.det, from = src.age ?? det.age;
    const head = src.head || headCanvas(src, bg);
    const P = model ? model.norm : null;
    const T2 = agedShape(det.norm, from, to, sex, P, P && to >= 14 ? w : 0);
    const out = warp(head, det.norm.concat(ANCHORS).map(toPx), T2.concat(ANCHORS).map(toPx));
    retouch(out, T2.map(toPx), from, to);
    return { head, out, from, to, shape: T2 };
  }
  function retouch(out, TP, from, to) {
    const W = out.width, H = out.height, g = out.getContext("2d", { willReadFrequently: true });
    const facePath = (fresh = true) => {
      if (fresh) g.beginPath();
      for (let i = 0; i <= 16; i++) {
        const [x, y] = TP[i];
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      for (let i = 26; i >= 17; i--) {
        const [x, y] = TP[i];
        g.lineTo(x, y - 0.35 * K2);
      }
      g.closePath();
    };
    const holes = () => {
      [
        [36, 41],
        [42, 47],
        [48, 59]
      ].forEach(([a, b]) => {
        g.moveTo(...TP[a]);
        for (let i = a + 1; i <= b; i++) g.lineTo(...TP[i]);
        g.closePath();
      });
      [
        [17, 21],
        [22, 26]
      ].forEach(([a, b]) => {
        g.moveTo(TP[a][0], TP[a][1] - 6);
        for (let i = a; i <= b; i++) g.lineTo(TP[i][0], TP[i][1] - 6);
        for (let i = b; i >= a; i--) g.lineTo(TP[i][0], TP[i][1] + 6);
        g.closePath();
      });
    };
    const snap = makeCanvas(W, H);
    snap.getContext("2d").drawImage(out, 0, 0);
    const skinPass = (alpha, filter) => {
      g.save();
      facePath();
      holes();
      g.clip("evenodd");
      g.globalAlpha = alpha;
      g.filter = filter;
      g.drawImage(snap, 0, 0);
      g.restore();
    };
    if (to < 14 && from >= 14) shave(g, W, H, TP);
    if (to < from && to < 18)
      skinPass(Math.min(0.55, 0.25 + (from - to) / 70), `blur(${Math.round(K2 * 0.02)}px) saturate(1.06) brightness(1.03)`);
    if (to < from && from >= 55) skinPass(0.4, `blur(${Math.round(K2 * 0.02)}px)`);
    if (to >= 55 && to > from) {
      const a = Math.min(1, (to - Math.max(from, 40)) / 30);
      skinPass(0.45 * a, "contrast(1.15) saturate(.85)");
      greyHair(g, W, H, TP, a);
    }
  }
  function skinTone(d, W, TP) {
    let r = 0, gg = 0, bb = 0, n = 0;
    for (const i of [2, 14]) {
      const j = i < 8 ? 31 : 35, cx = (TP[i][0] + TP[j][0]) / 2, cy = (TP[i][1] + TP[j][1]) / 2;
      for (let y = -4; y <= 4; y++)
        for (let x = -4; x <= 4; x++) {
          const k = ((cy + y | 0) * W + (cx + x | 0)) * 4;
          r += d[k];
          gg += d[k + 1];
          bb += d[k + 2];
          n++;
        }
    }
    return [r / n, gg / n, bb / n];
  }
  function shave(g, W, H, TP) {
    const im = g.getImageData(0, 0, W, H), d = im.data, skin = skinTone(d, W, TP);
    const L0 = 0.2126 * skin[0] + 0.7152 * skin[1] + 0.0722 * skin[2];
    const zone = TP.slice(2, 15).concat([TP[35], TP[34], TP[33], TP[32], TP[31]]), mouth = TP.slice(48, 60);
    const ys = zone.map((p) => p[1]), xs = zone.map((p) => p[0]);
    for (let y = Math.max(0, Math.min(...ys) | 0); y < Math.min(H, Math.max(...ys)); y++)
      for (let x = Math.max(0, Math.min(...xs) | 0); x < Math.min(W, Math.max(...xs)); x++) {
        if (!inPoly(x, y, zone) || inPoly(x, y, mouth)) continue;
        const k = (y * W + x) * 4, l = 0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2];
        const t = clamp((L0 * 0.97 - l) / (L0 * 0.22), 0, 1);
        if (!t) continue;
        d[k] += (skin[0] - d[k]) * t;
        d[k + 1] += (skin[1] - d[k + 1]) * t;
        d[k + 2] += (skin[2] - d[k + 2]) * t;
      }
    g.putImageData(im, 0, 0);
    const snap = makeCanvas(W, H);
    snap.getContext("2d").drawImage(g.canvas, 0, 0);
    g.save();
    g.beginPath();
    zone.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
    g.closePath();
    mouth.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
    g.closePath();
    g.clip("evenodd");
    g.globalAlpha = 0.6;
    g.filter = `blur(${Math.round(K2 * 0.03)}px)`;
    g.drawImage(snap, 0, 0);
    g.restore();
  }
  function greyHair(g, W, H, TP, a) {
    const im = g.getImageData(0, 0, W, H), d = im.data, [ex, ey] = toPx([0, 0.45]), rx = 1.62 * K2, ry = 2.05 * K2;
    const mouth = TP.slice(48, 60);
    const eyeC = [
      [36, 41],
      [42, 47]
    ].map(([p0, p1]) => {
      const e = TP.slice(p0, p1 + 1);
      return [e.reduce((t, p) => t + p[0], 0) / e.length, e.reduce((t, p) => t + p[1], 0) / e.length];
    });
    let L0 = 0;
    for (const i of [2, 14]) {
      const j = i < 8 ? 31 : 35, x = (TP[i][0] + TP[j][0]) / 2 | 0, y = (TP[i][1] + TP[j][1]) / 2 | 0, k = (y * W + x) * 4;
      L0 += (0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2]) / 2;
    }
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (((x - ex) / rx) ** 2 + ((y - ey) / ry) ** 2 > 1) continue;
        let eyeW = 1;
        for (const c of eyeC) {
          const r = ((x - c[0]) / (0.33 * K2)) ** 2 + ((y - c[1]) / (0.17 * K2)) ** 2;
          if (r < 1) {
            eyeW = 0;
            break;
          }
          if (r < 2.2) eyeW = Math.min(eyeW, (r - 1) / 1.2);
        }
        if (!eyeW) continue;
        const k = (y * W + x) * 4, l = 0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2];
        const dark = clamp((L0 * 0.72 - l) / (L0 * 0.35), 0, 1);
        if (!dark || inPoly(x, y, mouth)) continue;
        const t = dark * a * 0.8 * eyeW, gv = Math.min(232, 85 + l * 1.9);
        d[k] += (gv - d[k]) * t;
        d[k + 1] += (gv - d[k + 1]) * t;
        d[k + 2] += (gv - d[k + 2]) * t;
      }
    g.putImageData(im, 0, 0);
  }
  function prepareMorph(A, B, bg) {
    const S1 = A.det.norm.concat(ANCHORS), S2 = B.det.norm.concat(ANCHORS);
    const headA = headCanvas(A, bg), headB = headCanvas(B, bg);
    matchTones(headA, A.det.norm.map(toPx), headB, B.det.norm.map(toPx));
    return { A, B, headA, headB, S1, S2, tris: delaunay(S1.map(toPx)) };
  }
  function matchTones(ca, PA, cb, PB) {
    const ga = ca.getContext("2d", { willReadFrequently: true }), gb = cb.getContext("2d", { willReadFrequently: true });
    const ia = ga.getImageData(0, 0, ca.width, ca.height), ib = gb.getImageData(0, 0, cb.width, cb.height);
    const ta = skinTone(ia.data, ca.width, PA), tb = skinTone(ib.data, cb.width, PB), mid = ta.map((v, i) => (v + tb[i]) / 2);
    for (const [im, t] of [
      [ia, ta],
      [ib, tb]
    ]) {
      const gain = t.map((v, i) => clamp(mid[i] / Math.max(1, v), 0.75, 1.35)), d = im.data;
      for (let k = 0; k < d.length; k += 4) {
        d[k] *= gain[0];
        d[k + 1] *= gain[1];
        d[k + 2] *= gain[2];
      }
    }
    ga.putImageData(ia, 0, 0);
    gb.putImageData(ib, 0, 0);
  }
  function morph(prep2, t) {
    const M = prep2.S1.map((p, i) => [p[0] * (1 - t) + prep2.S2[i][0] * t, p[1] * (1 - t) + prep2.S2[i][1] * t]);
    const Mp = M.map(toPx);
    const wa = warp(prep2.headA, prep2.S1.map(toPx), Mp, prep2.tris);
    const wb = warp(prep2.headB, prep2.S2.map(toPx), Mp, prep2.tris);
    const out = makeCanvas(HEAD_W, HEAD_H), g = out.getContext("2d");
    g.drawImage(wa, 0, 0);
    g.globalAlpha = t;
    g.drawImage(wb, 0, 0);
    g.globalAlpha = 1;
    vignette(out);
    return { out, norm: M.slice(0, 68) };
  }
  function vignette(c, bg = null) {
    const g = c.getContext("2d"), [cx, cy] = toPx([0, 0.5]);
    g.save();
    g.translate(cx, cy);
    g.scale(1, 1.3);
    const grad = g.createRadialGradient(0, 0, 1.25 * K2, 0, 0, 1.7 * K2);
    grad.addColorStop(0, "rgba(0,0,0,1)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.globalCompositeOperation = "destination-in";
    g.fillStyle = grad;
    g.fillRect(-cx, -cy / 1.3, c.width, c.height / 1.3 + c.height);
    g.restore();
    if (bg) {
      g.save();
      g.globalCompositeOperation = "destination-over";
      g.fillStyle = bg;
      g.fillRect(0, 0, c.width, c.height);
      g.restore();
    }
    return c;
  }

  // src/js/engine/guide.js
  var GUIDE = { minLight: 60, backlight: 0.6, minSize: 0.3, maxSize: 0.58, maxOffX: 0.12, maxOffY: 0.14, maxYaw: 0.07, pitchLo: 0.38, pitchHi: 0.68, maxRoll: 8 };
  function guide(m, mode2 = "self") {
    const G = GUIDE, self2 = mode2 === "self";
    if (!m || !m.face) return { key: "noface", ok: false, score: 0 };
    const checks = [];
    if (m.light != null && m.light < G.minLight) checks.push(self2 ? "dark" : "darkOther");
    else if (m.light != null && m.around != null && m.light < m.around * G.backlight) checks.push(self2 ? "backlight" : "backlightOther");
    if (m.size < G.minSize) checks.push("closer");
    else if (m.size > G.maxSize) checks.push("farther");
    if (Math.abs(m.cx) > G.maxOffX) checks.push(self2 ? m.cx > 0 ? "phoneLeft" : "phoneRight" : m.cx > 0 ? "aimRight" : "aimLeft");
    if (Math.abs(m.cy) > G.maxOffY) checks.push(m.cy > 0 ? "phoneDown" : "phoneUp");
    if (Math.abs(m.yaw) > G.maxYaw) checks.push(self2 ? m.yaw > 0 ? "headRight" : "headLeft" : "lookOther");
    else if (m.pitch < G.pitchLo) checks.push(self2 ? "chinDown" : "lookOther");
    else if (m.pitch > G.pitchHi) checks.push(self2 ? "chinUp" : "lookOther");
    else if (Math.abs(m.roll) > G.maxRoll) checks.push(self2 ? m.roll > 0 ? "rollRight" : "rollLeft" : "lookOther");
    const total = 5;
    return checks.length ? { key: checks[0], ok: false, score: Math.max(0, (total - checks.length) / total) } : { key: "ok", ok: true, score: 1 };
  }
  var PHRASES = {
    fr: {
      noface: "Je ne vois pas de visage. Tenez le téléphone devant le visage, à hauteur des yeux.",
      dark: "Trop sombre. Tournez-vous vers une fenêtre ou une lampe.",
      darkOther: "Trop sombre : placez la personne face à une fenêtre ou une lampe.",
      backlight: "Trop de lumière derrière vous. Tournez-vous face à la lumière.",
      backlightOther: "Contre-jour : placez la personne face à la lumière.",
      closer: "Rapprochez le téléphone.",
      farther: "Éloignez le téléphone.",
      phoneLeft: "Déplacez le téléphone vers votre gauche.",
      phoneRight: "Déplacez le téléphone vers votre droite.",
      aimLeft: "Visez un peu plus à gauche.",
      aimRight: "Visez un peu plus à droite.",
      phoneUp: "Montez le téléphone.",
      phoneDown: "Baissez le téléphone.",
      headLeft: "Tournez légèrement la tête vers votre gauche.",
      headRight: "Tournez légèrement la tête vers votre droite.",
      chinDown: "Baissez légèrement le menton.",
      chinUp: "Relevez légèrement le menton.",
      rollLeft: "Redressez la tête : penchez-la un peu vers votre épaule gauche.",
      rollRight: "Redressez la tête : penchez-la un peu vers votre épaule droite.",
      lookOther: "Demandez à la personne de regarder l'objectif, la tête droite.",
      ok: "Parfait. Ne bougez plus.",
      shot: "Photo prise.",
      nocam: "Caméra indisponible. Vous pouvez choisir une photo à la place."
    },
    en: {
      noface: "I can't see a face. Hold the phone in front of the face, at eye level.",
      dark: "Too dark. Turn towards a window or a lamp.",
      darkOther: "Too dark: place the person facing a window or a lamp.",
      backlight: "Too much light behind you. Turn to face the light.",
      backlightOther: "Backlit: place the person facing the light.",
      closer: "Move the phone closer.",
      farther: "Move the phone away.",
      phoneLeft: "Move the phone to your left.",
      phoneRight: "Move the phone to your right.",
      aimLeft: "Aim a little more to the left.",
      aimRight: "Aim a little more to the right.",
      phoneUp: "Raise the phone.",
      phoneDown: "Lower the phone.",
      headLeft: "Turn your head slightly to your left.",
      headRight: "Turn your head slightly to your right.",
      chinDown: "Lower your chin slightly.",
      chinUp: "Raise your chin slightly.",
      rollLeft: "Straighten your head: tilt it slightly towards your left shoulder.",
      rollRight: "Straighten your head: tilt it slightly towards your right shoulder.",
      lookOther: "Ask the person to look at the lens, head straight.",
      ok: "Perfect. Hold still.",
      shot: "Photo taken.",
      nocam: "Camera unavailable. You can choose a photo instead."
    }
  };

  // src/js/engine/live.js
  var LIVE_URL = "model";
  var liveReady = null;
  function loadLive(url = LIVE_URL) {
    liveReady ??= Promise.all([faceapi.nets.tinyFaceDetector.loadFromUri(url), faceapi.nets.faceLandmark68TinyNet.loadFromUri(url)]).catch((e) => {
      liveReady = null;
      throw e;
    });
    return liveReady;
  }
  async function detectLive(input) {
    const r = await faceapi.detectSingleFace(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.45 })).withFaceLandmarks(true);
    if (!r) return null;
    const b = r.detection.box;
    return { box: { x: b.x, y: b.y, width: b.width, height: b.height }, score: r.detection.score, pts: r.landmarks.positions.map((p) => [p.x, p.y]) };
  }
  function lumStats(img, box = null, scale = 1) {
    const { data, width: w, height: h } = img;
    let all = 0, face = 0, nf = 0;
    const x0 = box ? Math.max(0, Math.floor(box.x * scale)) : 0, y0 = box ? Math.max(0, Math.floor(box.y * scale)) : 0;
    const x1 = box ? Math.min(w, Math.ceil((box.x + box.width) * scale)) : 0, y1 = box ? Math.min(h, Math.ceil((box.y + box.height) * scale)) : 0;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4, l = lumOf([data[i], data[i + 1], data[i + 2]]);
        all += l;
        if (box && x >= x0 && x < x1 && y >= y0 && y < y1) {
          face += l;
          nf++;
        }
      }
    const n = w * h, rest = n - nf;
    return { all: all / n, face: nf ? face / nf : null, around: rest ? (all - face) / rest : null };
  }
  var avg = (P, a, b) => {
    let x = 0, y = 0;
    for (let i = a; i <= b; i++) {
      x += P[i][0];
      y += P[i][1];
    }
    return [x / (b - a + 1), y / (b - a + 1)];
  };
  function liveMeasure(d, W, H, lum = null, view = null) {
    const V = view || { x: 0, y: 0, w: W, h: H };
    if (!d) return { face: false, light: lum?.all ?? null };
    const P = d.pts, b = d.box;
    const L = avg(P, 36, 41), R = avg(P, 42, 47), eyeY = (L[1] + R[1]) / 2, mouthY = (P[51][1] + P[57][1]) / 2;
    return {
      face: true,
      cx: (b.x + b.width / 2 - V.x) / V.w - 0.5,
      cy: (b.y + b.height / 2 - V.y) / V.h - 0.5,
      size: b.width / Math.min(V.w, V.h),
      yaw: (P[30][0] - P[0][0]) / (P[16][0] - P[0][0] || 1) - 0.5,
      pitch: (P[30][1] - eyeY) / (mouthY - eyeY || 1),
      roll: Math.atan2(R[1] - L[1], R[0] - L[0]) * 180 / Math.PI,
      light: lum?.face ?? null,
      around: lum?.around ?? null
    };
  }

  // src/js/ui/common.js
  var handlers = {};
  var on = (ev, fn) => (handlers[ev] || (handlers[ev] = /* @__PURE__ */ new Set())).add(fn);
  var emit2 = (ev, data) => handlers[ev]?.forEach((fn) => fn(data));
  var engine = { ready: false };
  function toast(text, action = null, { ms = action ? 12e3 : 5e3, after = null } = {}) {
    const el22 = document.createElement("div");
    el22.className = "toast";
    el22.setAttribute("role", "status");
    const span = document.createElement("span");
    span.textContent = text;
    el22.appendChild(span);
    if (action) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = action.label;
      b.addEventListener("click", () => {
        action.run();
        el22.remove();
      });
      el22.appendChild(b);
    }
    $("#toasts").appendChild(el22);
    Promise.resolve(after).catch(() => {
    }).then(() => setTimeout(() => el22.remove(), ms));
    return el22;
  }
  var openSheet = null;
  var returnFocus = null;
  function openDialog(el22, onClose) {
    if (openSheet && openSheet.el !== el22) {
      const prev = openSheet;
      openSheet = null;
      prev.el.hidden = true;
      prev.onClose?.();
    } else returnFocus = document.activeElement;
    openSheet = { el: el22, onClose };
    el22.hidden = false;
    (el22.querySelector("[data-autofocus]") || el22.querySelector("[data-close]"))?.focus();
  }
  var dialogOpen = () => !!openSheet;
  function closeDialog() {
    if (!openSheet) return;
    const { el: el22, onClose } = openSheet;
    openSheet = null;
    el22.hidden = true;
    onClose?.();
    returnFocus?.focus?.();
  }
  document.addEventListener("keydown", (e) => {
    if (!openSheet) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeDialog();
      return;
    }
    if (e.key !== "Tab") return;
    const f = $$('button:not([hidden]):not(:disabled), input:not([hidden]), select, [tabindex="0"]', openSheet.el).filter(
      (x) => x.offsetParent
    );
    if (!f.length) return;
    const first = f[0], last2 = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last2.focus();
    } else if (!e.shiftKey && document.activeElement === last2) {
      e.preventDefault();
      first.focus();
    }
  });
  document.addEventListener("click", (e) => {
    if (!openSheet) return;
    if (e.target === openSheet.el || e.target.closest("[data-close]")) closeDialog();
  });
  function stamp(cv) {
    const g = cv.getContext("2d"), h = Math.max(14, Math.round(cv.height * 0.055)), t = "Image simulée";
    g.save();
    g.font = `600 ${h}px system-ui, sans-serif`;
    const w = g.measureText(t).width + h;
    g.fillStyle = "rgba(0,0,0,.62)";
    g.fillRect(cv.width - w - h * 0.4, cv.height - h * 1.8, w, h * 1.4);
    g.fillStyle = "#fff";
    g.textBaseline = "middle";
    g.fillText(t, cv.width - w - h * 0.4 + h / 2, cv.height - h * 1.1);
    g.restore();
  }
  function fillSelect(sel, options, keep = true) {
    const prev = sel.value;
    sel.innerHTML = options.map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join("");
    if (keep && options.some((o) => o.value === prev)) sel.value = prev;
    return sel.value;
  }

  // src/js/ui/capture.js
  var cam = { session: 0, stream: null, timer: null, mode: "self", lang: "fr", voice: true, beeps: true, target: null, guided: false, last: "", lastSaid: 0, pending: "", pendingN: 0, okSince: 0, prev: null, audio: null, beepAt: 0, count: 0, shooting: false, openTok: 0, openBusy: 0, nofaceSince: 0, bad: 0 };
  var T = (k) => (PHRASES[cam.lang] || PHRASES.fr)[k] || k;
  var canSpeak = () => "speechSynthesis" in window;
  var alive = (sess) => sess === cam.session && !$("#camSheet").hidden;
  function say(text, force = false, queue = false) {
    $("#camText").textContent = text;
    const now = performance.now();
    if (!force && text === cam.last && now - cam.lastSaid < 4e3) return;
    if (!force && cam.voice && canSpeak() && speechSynthesis.speaking && now - cam.lastSaid < 4e3) return;
    cam.last = text;
    cam.lastSaid = now;
    if (!cam.voice || !canSpeak()) {
      $("#camSay").textContent = text;
      return;
    }
    if (!queue) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = cam.lang === "en" ? "en-US" : "fr-FR";
    const v = speechSynthesis.getVoices().find((x) => x.lang?.toLowerCase().startsWith(cam.lang));
    if (v) u.voice = v;
    u.rate = 1.05;
    speechSynthesis.speak(u);
  }
  function beep(freq = 880, ms = 70, vol = 0.08) {
    if (!cam.beeps) return;
    try {
      cam.audio ??= new (window.AudioContext || window.webkitAudioContext)();
      const a = cam.audio;
      if (a.state === "suspended") a.resume();
      const o = a.createOscillator(), g = a.createGain();
      o.frequency.value = freq;
      g.gain.value = vol;
      o.connect(g).connect(a.destination);
      o.start();
      o.stop(a.currentTime + ms / 1e3);
    } catch {
    }
  }
  var buzz = (p) => {
    try {
      navigator.vibrate?.(p);
    } catch {
    }
  };
  function initCapture() {
    $("#camGo").addEventListener("click", startLive);
    $("#camConsent").addEventListener("change", () => $("#camGo").disabled = !$("#camConsent").checked);
    $("#camVoice").addEventListener("click", () => {
      cam.voice = !cam.voice;
      $("#camVoice").setAttribute("aria-pressed", String(cam.voice));
      $("#camVoice").textContent = cam.voice ? "Voix : activée" : "Voix : coupée";
      $("#camSay").textContent = cam.voice ? "" : $("#camText").textContent;
      if (!cam.voice && canSpeak()) speechSynthesis.cancel();
    });
    $("#camBeeps").addEventListener("click", () => {
      cam.beeps = !cam.beeps;
      $("#camBeeps").setAttribute("aria-pressed", String(cam.beeps));
      $("#camBeeps").textContent = cam.beeps ? "Bips : activés" : "Bips : coupés";
    });
    $("#camFlip").addEventListener("click", () => {
      cam.mode = cam.mode === "self" ? "other" : "self";
      openStream(cam.session);
    });
    $("#camShot").addEventListener("click", () => shoot(cam.session));
    for (const b of [$("#camFile"), $("#camFile2")])
      b.addEventListener("click", () => {
        const t = cam.target;
        closeDialog();
        t?.pickFile?.();
      });
    $("#camResume").addEventListener("click", () => openStream(cam.session));
    document.addEventListener("visibilitychange", () => {
      if ($("#camSheet").hidden || $("#camLive").hidden) return;
      if (document.hidden) {
        if (cam.stream || cam.openBusy) pause();
      } else if (!$("#camPaused").hidden) {
        $("#camResume").focus();
        say(cam.lang === "fr" ? "Caméra arrêtée. Touchez « Reprendre la caméra »." : "Camera stopped. Tap “Resume the camera”.", true);
      }
    });
  }
  function pause() {
    cam.openTok++;
    stopStream();
    $("#camPaused").hidden = false;
    $("#camNoCam").hidden = true;
    $("#camShot").disabled = true;
  }
  function openCapture(target2) {
    cam.session++;
    cam.target = target2;
    cam.lang = (navigator.language || "fr").toLowerCase().startsWith("fr") ? "fr" : "en";
    $("#camLang").value = cam.lang;
    $("#camIntro").hidden = false;
    $("#camLive").hidden = true;
    $("#camConsent").checked = false;
    $("#camGo").disabled = true;
    $("#camWho").textContent = target2.name ? ` (${target2.name})` : "";
    Object.assign(cam, { last: "", lastSaid: 0, pending: "", pendingN: 0, count: 0, okSince: 0, bad: 0, shooting: false });
    $("#camSay").textContent = "";
    $("#camPaused").hidden = true;
    $("#camNoCam").hidden = true;
    openDialog($("#camSheet"), stopCam);
  }
  async function startLive() {
    const sess = cam.session;
    cam.mode = $("input[name=camMode]:checked").value;
    cam.lang = $("#camLang").value;
    $("#camIntro").hidden = true;
    $("#camLive").hidden = false;
    $("#camShot").disabled = true;
    $("#camText").textContent = cam.lang === "fr" ? "Préparation de la caméra…" : "Starting the camera…";
    $("#camText").focus();
    say($("#camText").textContent, true);
    for (let i = 0; !window.faceapi && i < 150 && alive(sess); i++) await new Promise((r) => setTimeout(r, 100));
    let guided = !!window.faceapi;
    if (guided) {
      try {
        while (!engine.ready && !engine.failed && alive(sess)) await new Promise((r) => setTimeout(r, 150));
        if (engine.failed) throw new Error("moteur indisponible");
        await loadLive();
      } catch (e) {
        console.error(e);
        guided = false;
      }
    }
    if (!alive(sess)) return;
    cam.guided = guided;
    if (document.hidden) return pause();
    await openStream(sess);
  }
  async function openStream(sess) {
    if (!alive(sess)) return;
    const tok = ++cam.openTok;
    cam.openBusy = tok;
    stopStream();
    const v = $("#camVideo");
    v.classList.toggle("mirror", cam.mode === "self");
    $("#camFlip").textContent = cam.mode === "self" ? "Caméra arrière (un proche photographie)" : "Caméra avant (se photographier)";
    $("#camPaused").hidden = true;
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: cam.mode === "self" ? "user" : "environment", width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
    } catch (e) {
      console.warn(e);
    }
    if (cam.openBusy === tok) cam.openBusy = 0;
    if (!alive(sess) || tok !== cam.openTok || document.hidden) {
      stream?.getTracks().forEach((t) => t.stop());
      if (alive(sess) && tok === cam.openTok) pause();
      return;
    }
    if (!stream) {
      $("#camNoCam").hidden = false;
      $("#camShot").disabled = true;
      say(T("nocam"), true);
      return;
    }
    stopStream();
    cam.stream = stream;
    $("#camNoCam").hidden = true;
    $("#camShot").disabled = false;
    v.srcObject = stream;
    await v.play().catch(() => {
    });
    Object.assign(cam, { okSince: 0, prev: null, count: 0, pending: "", pendingN: 0, nofaceSince: 0, shooting: false, bad: 0 });
    if (!cam.guided) {
      say(cam.lang === "fr" ? "Guidage indisponible : cadrez le visage puis touchez « Prendre la photo »." : "Guidance unavailable: frame the face, then tap “Take the photo”.", true);
      return;
    }
    loop(sess, stream);
  }
  var work = null;
  async function loop(sess, stream) {
    if (!alive(sess) || cam.stream !== stream) return;
    const v = $("#camVideo"), t0 = performance.now();
    if (v.readyState >= 2 && v.videoWidth && !cam.shooting) {
      try {
        const W = 320, H = Math.round(320 * v.videoHeight / v.videoWidth);
        work ??= makeCanvas(W, H);
        if (work.height !== H) work.height = H;
        const g = work.getContext("2d", { willReadFrequently: true });
        g.drawImage(v, 0, 0, W, H);
        const d = await detectLive(work);
        if (!alive(sess) || cam.stream !== stream) return;
        const sw = 64, sh = Math.round(64 * H / W);
        const lum = lumStats(scaled(g, W, H, sw, sh), d?.box, sw / W);
        const view = visible(v, W, H);
        if (view) step(liveMeasure(d, W, H, lum, view), sess);
      } catch (e) {
        console.error(e);
      }
    }
    if (!alive(sess) || cam.stream !== stream) return;
    const spent = performance.now() - t0;
    cam.timer = setTimeout(() => loop(sess, stream), Math.max(83 - spent, spent * 0.5, 30));
  }
  function visible(v, W, H) {
    const cw = v.clientWidth, ch = v.clientHeight;
    if (!cw || !ch) return null;
    const k = Math.max(cw / W, ch / H), w = cw / k, h = ch / k;
    return { x: (W - w) / 2, y: (H - h) / 2, w, h };
  }
  var tiny = null;
  function scaled(g, W, H, sw, sh) {
    tiny ??= makeCanvas(sw, sh);
    if (tiny.height !== sh) tiny.height = sh;
    const t = tiny.getContext("2d", { willReadFrequently: true });
    t.drawImage(g.canvas, 0, 0, W, H, 0, 0, sw, sh);
    return t.getImageData(0, 0, sw, sh);
  }
  function step(m, sess) {
    if (cam.shooting) return;
    const g0 = guide(m, cam.mode), now = performance.now();
    let g = g0;
    if (g0.key === "noface") {
      cam.nofaceSince ||= now;
      if (now - cam.nofaceSince < 1e3) g = { key: cam.pending || "noface", ok: false, score: 0, wait: true };
    } else cam.nofaceSince = 0;
    const moved = cam.prev && m.face ? Math.hypot(m.cx - cam.prev.cx, m.cy - cam.prev.cy) > 0.03 : true;
    cam.prev = m.face ? m : null;
    if (!g.ok || moved) {
      if (cam.count && ++cam.bad < 2) return;
      cam.bad = 0;
      $("#camFrame").classList.remove("ok");
      if (cam.count) {
        cam.count = 0;
        buzz(40);
        if (!g.wait) $("#camText").textContent = T(g.key);
      }
      cam.okSince = g.ok ? now : 0;
      if (g.key === cam.pending) cam.pendingN++;
      else {
        cam.pending = g.key;
        cam.pendingN = 1;
      }
      if (cam.pendingN >= 3 && !g.wait && !g.ok) say(T(g.key));
      if (now - cam.beepAt > 1100 - 800 * g.score) {
        cam.beepAt = now;
        beep(520 + 400 * g.score);
      }
      return;
    }
    cam.bad = 0;
    $("#camFrame").classList.add("ok");
    if (!cam.okSince) cam.okSince = now;
    const held = now - cam.okSince;
    if (held >= 400 && !cam.count) {
      cam.count = 4;
      buzz(80);
      say(T("ok"), true);
    }
    const n = held < 1200 ? 4 : Math.max(0, 3 - Math.floor((held - 1200) / 450));
    if (cam.count && n < cam.count) {
      cam.count = n;
      if (n > 0) {
        say(String(n), true, true);
        beep(1200, 90, 0.1);
      } else shoot(sess, true);
    }
  }
  async function shoot(sess, auto = false) {
    const v = $("#camVideo"), stream = cam.stream;
    if (cam.shooting || !alive(sess) || !stream || v.readyState < 2 || !v.videoWidth) return;
    cam.shooting = true;
    let c = null;
    const track = stream.getVideoTracks()[0];
    try {
      if (window.ImageCapture && track && track.readyState === "live") {
        const blob = await Promise.race([new ImageCapture(track).takePhoto(), new Promise((_, no) => setTimeout(() => no(new Error("délai")), 2e3))]);
        const bmp = await createImageBitmap(blob);
        const k = Math.min(1, 2e3 / Math.max(bmp.width, bmp.height));
        c = makeCanvas(Math.round(bmp.width * k), Math.round(bmp.height * k));
        c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
      }
    } catch {
      c = null;
    }
    if (!alive(sess) || cam.stream !== stream) {
      cam.shooting = false;
      return;
    }
    if (!c) {
      if (!v.videoWidth) {
        cam.shooting = false;
        return;
      }
      c = makeCanvas(v.videoWidth, v.videoHeight);
      c.getContext("2d").drawImage(v, 0, 0);
    }
    buzz([100, 60, 100]);
    beep(1500, 120, 0.12);
    const t = cam.target;
    closeDialog();
    if (cam.voice && canSpeak()) {
      const u = new SpeechSynthesisUtterance(T("shot"));
      u.lang = cam.lang === "en" ? "en-US" : "fr-FR";
      speechSynthesis.speak(u);
    } else toast(T("shot"));
    t?.onShot?.(c, auto);
  }
  function stopStream() {
    clearTimeout(cam.timer);
    cam.timer = null;
    if (cam.stream) for (const tr of cam.stream.getTracks()) tr.stop();
    cam.stream = null;
    const v = $("#camVideo");
    if (v) v.srcObject = null;
  }
  function stopCam() {
    cam.session++;
    stopStream();
    const sess = cam.session, shot = cam.shooting;
    cam.openTok++;
    Object.assign(cam, { count: 0, okSince: 0, shooting: false, openBusy: 0 });
    if (canSpeak() && !shot) speechSynthesis.cancel();
    setTimeout(() => {
      if (cam.session === sess) cam.audio?.suspend?.().catch?.(() => {
      });
    }, 400);
  }
  var camState = () => ({ open: !!cam.stream, mode: cam.mode, guided: !!cam.guided, text: $("#camText")?.textContent || "", session: cam.session });

  // src/js/ui/compare.js
  var LET = ["A", "B", "C"];
  var CVAR = ["--pa", "--pb", "--pc"];
  var blank = (i) => ({
    i,
    name: "",
    canvas: null,
    orig: null,
    work: null,
    faces: [],
    faceIdx: 0,
    det: null,
    status: "empty",
    realAge: null,
    ageTyped: false,
    photoDate: null,
    gen: 0,
    extras: [],
    fused: null,
    kept: false,
    checked: false,
    simulated: false,
    prog: null
  });
  var slots = [0, 1, 2].map(blank);
  var slotName = (s) => s.name || `Photo ${LET[s.i]}`;
  var nm = (i) => esc(slotName(slots[i]));
  var lensAny = () => slots.some((s) => s.status === "ok" && (s.fused || s.det)?.lens);
  var record = (s) => {
    const det = s.fused || s.det;
    return { key: `s${s.i}:${det.id}`, det, age: s.realAge };
  };
  function refresh(s) {
    s.fused = s.det && s.extras.length ? fuseDets([s.det, ...s.extras.map((e) => requalify(e.det, s.realAge))]) : null;
  }
  var STEPS = { open: "Ouverture de la photo", detect: "Recherche du visage et empreinte", light: "Correction de la lumière", align: "Alignement des repères", traits: "Mesure des traits", video: "Analyse des images de la vidéo" };
  var PLAN = { photo: ["open", "wait", "detect", "light", "align", "traits"], video: ["open", "wait", "video"] };
  var dur = { open: 0.4, wait: 0, detect: 2.5, light: 1.5, align: 1, traits: 0.6, video: 8 };
  STEPS.wait = "En attente d'une autre analyse";
  var srSay = (t) => {
    const r = $("#srStatus");
    if (r) r.textContent = t;
  };
  function startProg(s, label, plan = "photo") {
    stopProg(s);
    const now = performance.now();
    s.prog = { label, plan: PLAN[plan], step: "open", t0: now, ts: now, done: [] };
    s.prog.tick = setInterval(() => paintProg(s), 1e3);
    srSay(`${label} : analyse en cours.`);
  }
  async function advance(s, step2) {
    const p = s.prog;
    if (!p || p.step === step2) return;
    const now = performance.now();
    if (p.step !== "wait") dur[p.step] = dur[p.step] * 0.6 + (now - p.ts) / 1e3 * 0.4;
    p.done.push(p.step);
    p.step = step2;
    p.ts = now;
    paintProg(s);
    await new Promise((r) => setTimeout(r, 0));
  }
  function stopProg(s) {
    if (!s.prog) return;
    if (document.activeElement?.closest?.(".prog")) refocus = s.i;
    clearInterval(s.prog.tick);
    s.prog = null;
  }
  function progInfo(p) {
    const steps = p.plan.filter((k) => k !== "wait"), i = p.plan.indexOf(p.step);
    const left = p.plan.slice(i + 1).filter((k) => k !== "light" || p.step === "detect" || p.step === "wait" || p.step === "open");
    const now = performance.now(), inStep = (now - p.ts) / 1e3;
    const rest = Math.max(0, dur[p.step] - inStep) + left.reduce((t, k) => t + dur[k], 0);
    const spent = (now - p.t0) / 1e3, pct = Math.min(97, Math.round(spent / (spent + rest + 0.01) * 100));
    return { n: steps.indexOf(p.step) + 1, total: steps.length, rest, pct, waiting: p.step === "wait" };
  }
  function paintProg(s) {
    const root = el(s), box = root && $(".prog", root);
    if (!box || !s.prog) return;
    const p = s.prog, { n, total, rest, pct, waiting } = progInfo(p);
    $(".pstep", box).textContent = waiting ? STEPS.wait : `Étape ${n} sur ${total} · ${STEPS[p.step]}`;
    $(".prest", box).textContent = rest >= 1 ? `environ ${Math.ceil(rest)} s restantes` : "presque fini…";
    $(".pbar b", box).style.width = `${pct}%`;
    $(".pbar", box).setAttribute("aria-valuenow", pct);
  }
  var birthLookup = () => null;
  var setBirthLookup = (fn) => {
    birthLookup = fn;
  };
  var camIcon = '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.6"/></svg>';
  var el = (s) => $(`.slot[data-i="${s.i}"]`);
  var lastTouched = 0;
  var lastSlot = () => lastTouched;
  var emptyLabel = (s) => `${LET[s.i]} ${s.i < 2 ? "Ajouter une photo" : "3ᵉ photo (facultative)"}`;
  function buildSlots() {
    $("#slots").innerHTML = slots.map(
      (s) => `
    <div class="slot" data-i="${s.i}">
      <div class="mwrap">
        <button class="media" type="button" aria-label="${emptyLabel(s)}">
          <span class="badge" aria-hidden="true">${LET[s.i]}</span>
          <span class="ph">${camIcon}<span>${s.i < 2 ? "Ajouter une photo" : "3ᵉ photo<br>(facultative)"}</span></span>
        </button>
        <button class="x" type="button" aria-label="Retirer la photo ${LET[s.i]}" hidden>✕</button>
        <div class="prog" hidden><span class="pstep"></span><span class="pbar" role="progressbar" aria-label="Analyse de la photo ${LET[s.i]}" aria-valuemin="0" aria-valuemax="100"><b></b></span><span class="prest"></span><button type="button" class="btn small pcancel">Annuler</button></div>
      </div>
      <input class="name" id="name${s.i}" aria-label="Prénom, photo ${LET[s.i]}" maxlength="24" placeholder="Prénom" autocomplete="off" list="peopleList">
      <label class="agewrap">Âge <input class="age" id="age${s.i}" type="text" inputmode="decimal" placeholder="ex. 4 mois" title="En années (10 ou 10,5) ou en mois (4 mois)" aria-label="Âge réel sur la photo ${LET[s.i]}"></label>
      <div class="chips"></div>
      <input type="file" accept="image/*,video/*" id="file${s.i}" hidden>
      <input type="file" accept="image/*" id="more${s.i}" hidden>
    </div>`
    ).join("");
    for (const s of slots) {
      const root = el(s), file = $("input[type=file]", root);
      root.addEventListener("pointerdown", () => {
        lastTouched = s.i;
      });
      $(".media", root).addEventListener("click", () => file.click());
      $(".x", root).addEventListener("click", () => clearSlot(s));
      const more = $(`#more${s.i}`);
      $(".chips", root).addEventListener("click", (e) => {
        const act = e.target.closest("[data-act]")?.dataset.act;
        if (act === "pick") openPicker(s);
        if (act === "retake") s.source === "camera" ? startCam(s) : file.click();
        if (act === "cam") startCam(s);
        if (act === "keep") {
          s.kept = true;
          renderSlot(s);
          renderResults();
          $(".chips [data-act]", root)?.focus();
        }
        if (act === "check") openMasks(s);
        if (act === "more") more.click();
        if (act === "less") {
          s.extras = [];
          refresh(s);
          renderSlot(s);
          renderResults();
          emit2("faces");
          toast(`Photos ajoutées retirées de la photo ${LET[s.i]}.`);
        }
      });
      $(".pcancel", root).addEventListener("click", () => cancelSlot(s));
      more.addEventListener("change", () => {
        if (more.files[0]) addExtra(s, more.files[0]);
        more.value = "";
      });
      file.addEventListener("change", () => {
        if (file.files[0]) loadInto(s, file.files[0]);
        file.value = "";
      });
      $(".name", root).addEventListener("input", (e) => {
        s.name = e.target.value.trim();
        autoAge(s);
        renderSlotSoon(s);
      });
      $(".age", root).addEventListener("input", (e) => {
        const v = parseAge(e.target.value);
        s.ageTyped = e.target.value.trim() !== "";
        setAge(s, v);
      });
    }
  }
  var renderSlotSoon = debounce((s) => {
    renderSlot(s);
    renderResults();
    emit2("faces");
  }, 150);
  function setAge(s, age) {
    s.realAge = age;
    if (s.det && !s.det.frames) s.det = requalify(s.det, age);
    refresh(s);
    renderSlot(s);
    renderResults();
    emit2("faces");
  }
  function autoAge(s) {
    if (s.ageTyped) return;
    const birth = birthLookup(s.name);
    const a = birth && s.photoDate ? yearsBetween(birth, s.photoDate) : null;
    if (a != null && a !== s.realAge) {
      s.realAge = a;
      $(`#age${s.i}`).value = "";
      $(`#age${s.i}`).placeholder = `${ageLabel(a)} (calculé)`;
      if (s.det && !s.det.frames) s.det = requalify(s.det, a);
      refresh(s);
    } else if (a == null && !s.ageTyped) {
      if (s.realAge != null && s.det && !s.det.frames) {
        s.realAge = null;
        s.det = requalify(s.det, null);
        refresh(s);
      }
      s.realAge = null;
      $(`#age${s.i}`).placeholder = "ex. 4 mois";
    }
  }
  function refreshAutoAges() {
    for (const s of slots) autoAge(s);
    slots.forEach(renderSlot);
    renderResults();
  }
  async function loadInto(s, file) {
    const gen = ++s.gen;
    Object.assign(s, { canvas: null, orig: null, work: null, faces: [], det: null, status: "loading", photoDate: null, extras: [], fused: null, kept: false, checked: false, simulated: false, source: null });
    const isVideo = file.type.startsWith("video/");
    startProg(s, `Photo ${LET[s.i]}`, isVideo ? "video" : "photo");
    renderSlot(s);
    try {
      if (isVideo) {
        const frames = await decodeVideo(file);
        if (gen !== s.gen) return;
        s.canvas = frames[frames.length >> 1];
        await analyzeSlot(s, frames);
      } else {
        const [c, date] = await Promise.all([decodeImage(file), exifDate(file)]);
        if (gen !== s.gen) return;
        s.canvas = c;
        s.photoDate = date;
        autoAge(s);
        await analyzeSlot(s);
      }
    } catch (err) {
      console.error(err);
      if (gen === s.gen) {
        stopProg(s);
        s.canvas = null;
        s.status = isVideo ? "badvideo" : "badfile";
        renderSlot(s);
        renderResults();
      }
    }
  }
  async function putCanvas(s, canvas, { name, age = null, det = null, simulated = false, photoDate = null } = {}) {
    const gen = ++s.gen;
    stopProg(s);
    Object.assign(s, { canvas, orig: null, work: null, faces: [], det: null, status: "loading", photoDate, ageTyped: age != null, extras: [], fused: null, kept: false, checked: false, simulated, source: null });
    if (name != null) {
      s.name = name;
      $(`#name${s.i}`).value = name;
    }
    s.realAge = age;
    $(`#age${s.i}`).value = age != null ? String(Math.round(age * 10) / 10).replace(".", ",") : "";
    if (photoDate && age == null) autoAge(s);
    if (det) {
      s.det = { ...requalify(det, age), id: nextDetId() };
      refresh(s);
      s.status = "ok";
      renderSlot(s);
      renderResults();
      emit2("faces");
      return;
    }
    await analyzeSlot(s, null, gen);
  }
  async function analyzeSlot(s, frames = null, gen = s.gen) {
    if (!engine.ready) {
      stopProg(s);
      s.status = "queued";
      s.pendingFrames = frames;
      renderSlot(s);
      return;
    }
    s.status = "busy";
    if (!s.prog) startProg(s, `Photo ${LET[s.i]}`, frames ? "video" : "photo");
    const onStep = (k) => advance(s, k);
    renderSlot(s);
    await advance(s, "wait");
    try {
      await enqueue(async () => {
        if (gen !== s.gen) return;
        if (frames) {
          await onStep("video");
          const v = await describeVideo(frames);
          if (gen !== s.gen) return;
          if (!v) {
            s.status = "noface";
            return;
          }
          s.canvas = v.canvas;
          s.det = v.det;
          s.faces = [];
          s.status = "ok";
          return;
        }
        const { work: work2, faces } = await findFaces(s.canvas, onStep);
        if (gen !== s.gen) return;
        s.work = work2;
        s.faces = faces;
        s.faceIdx = 0;
        if (!faces.length) {
          s.status = "noface";
          s.det = null;
          return;
        }
        const det = await describe(work2, faces[0], s.canvas, onStep);
        if (gen !== s.gen) return;
        s.det = s.realAge != null ? requalify(det, s.realAge) : det;
        refresh(s);
        s.status = "ok";
      });
    } catch (err) {
      console.error(err);
      if (gen === s.gen) {
        s.status = "error";
        s.det = null;
      }
    }
    if (gen !== s.gen) return;
    stopProg(s);
    s.pendingFrames = null;
    renderSlot(s);
    renderResults();
    emit2("faces");
    if (s.status === "ok") srSay(`Photo ${LET[s.i]} analysée${!s.simulated && gate(s.det).verdict === "reprendre" ? " : photo à reprendre" : ""}.`);
    else if (s.status !== "queued") srSay(`Photo ${LET[s.i]} : ${s.status === "noface" ? "aucun visage trouvé" : "analyse impossible"}.`);
  }
  function cancelSlot(s) {
    stopProg(s);
    if (s.status === "ok") {
      s.extraGen = (s.extraGen || 0) + 1;
      renderSlot(s);
      toast("Ajout de photo annulé.");
      return;
    }
    s.gen++;
    if (s.orig) {
      Object.assign(s, { canvas: s.orig, orig: null, work: null, det: null, faces: [] });
      toast("Recadrage annulé : retour à la photo d'origine.");
      analyzeSlot(s);
      return;
    }
    Object.assign(s, { canvas: null, work: null, faces: [], det: null, status: "empty", photoDate: null, extras: [], fused: null, kept: false, checked: false, simulated: false });
    renderSlot(s);
    renderResults();
    emit2("faces");
    toast("Analyse annulée : photo retirée, prénom et âge conservés.");
  }
  async function addExtra(s, file, det = null) {
    if (s.status !== "ok" || s.det?.frames || s.simulated || s.extras.length >= 2) return;
    const gen = s.gen, eg = s.extraGen = (s.extraGen || 0) + 1;
    try {
      if (!det) {
        startProg(s, `Photo ajoutée à ${LET[s.i]}`);
        renderSlot(s);
        const step2 = (k) => advance(s, k);
        const c = await decodeImage(file);
        det = await enqueue(async () => {
          if (gen !== s.gen || eg !== s.extraGen) return null;
          const { work: work2, faces } = await findFaces(c, step2);
          if (!faces.length || gen !== s.gen || eg !== s.extraGen) return faces.length ? null : "noface";
          return describe(work2, faces[0], c, step2);
        });
      }
    } catch (err) {
      console.error(err);
      det = "bad";
    }
    if (gen !== s.gen || eg !== s.extraGen) {
      if (eg === s.extraGen) stopProg(s);
      return;
    }
    stopProg(s);
    if (!det || det === "noface" || det === "bad") {
      renderSlot(s);
      toast(det === "bad" ? "Photo ajoutée illisible." : "Aucun visage sur la photo ajoutée.");
      return;
    }
    const g = gate(det);
    s.extras.push({ det });
    refresh(s);
    renderSlot(s);
    renderResults();
    emit2("faces");
    const msg = `${s.extras.length + 1} photos utilisées pour ${slotName(s)}.`;
    toast(g.verdict === "reprendre" ? `${msg} La photo ajoutée est peu exploitable (${g.redo[0]}) : elle compte moins.` : msg);
  }
  function analyzeQueued() {
    for (const s of slots) if (s.status === "queued") analyzeSlot(s, s.pendingFrames || null);
  }
  function resetChoices(s) {
    if (s.extras.length) toast(`Photos ajoutées à la photo ${LET[s.i]} retirées : elles concernaient l'autre visage.`);
    Object.assign(s, { extras: [], fused: null, kept: false, checked: false });
  }
  async function chooseFace(s, idx) {
    if (!s.faces[idx] || idx === s.faceIdx) return;
    const gen = ++s.gen;
    resetChoices(s);
    s.faceIdx = idx;
    s.status = "busy";
    startProg(s, `Photo ${LET[s.i]}`);
    renderSlot(s);
    await advance(s, "wait");
    const det = await enqueue(() => gen === s.gen ? describe(s.work || s.canvas, s.faces[idx], s.canvas, (k) => advance(s, k)) : null);
    if (gen !== s.gen) return;
    stopProg(s);
    s.det = s.realAge != null ? requalify(det, s.realAge) : det;
    refresh(s);
    s.status = "ok";
    renderSlot(s);
    renderResults();
    emit2("faces");
  }
  function clearSlot(s, quiet = false) {
    stopProg(s);
    const keepGen = s.gen + 1;
    Object.assign(s, blank(s.i), { gen: keepGen });
    $(`#name${s.i}`).value = "";
    $(`#age${s.i}`).value = "";
    $(`#age${s.i}`).placeholder = "ex. 4 mois";
    renderSlot(s);
    if (!quiet) {
      renderResults();
      emit2("faces");
    }
  }
  function clearAll() {
    slots.forEach((s) => clearSlot(s, true));
    activePair = null;
    renderResults();
    emit2("faces");
  }
  var snapshot = (s) => ({ ...s, faces: [...s.faces], extras: [...s.extras], prog: null, nameVal: $(`#name${s.i}`).value, ageVal: $(`#age${s.i}`).value });
  function restore(snap) {
    const s = slots[snap.i];
    const { nameVal, ageVal, ...data } = snap;
    stopProg(s);
    Object.assign(s, data, { gen: s.gen + 1 });
    $(`#name${s.i}`).value = nameVal;
    $(`#age${s.i}`).value = ageVal;
    if (["busy", "loading"].includes(s.status)) {
      if (s.det) s.status = "ok";
      else if (s.canvas) {
        analyzeSlot(s);
        return;
      } else s.status = "empty";
    }
    renderSlot(s);
    renderResults();
    emit2("faces");
  }
  var snapshotSlots = () => slots.map(snapshot);
  var restoreSlots = (snaps) => snaps.forEach(restore);
  function sendToSlot(canvas, opts = {}, avoid = []) {
    const s = slots.find((x) => !x.canvas) || [2, 1, 0].map((i) => slots[i]).find((x) => !avoid.includes(x.i)) || slots[2];
    const replaced = s.canvas ? snapshot(s) : null;
    const done = putCanvas(s, canvas, opts);
    if (replaced) toast(`Photo ${LET[s.i]} remplacée${opts.simulated ? " par une image simulée" : ""}.`, { label: "Annuler", run: () => restore(replaced) }, { after: done });
    else toast(`Placé en photo ${LET[s.i]}.`);
    return s;
  }
  function renderSlot(s) {
    const root = el(s), media = $(".media", root);
    $$("canvas,.busy", media).forEach((n) => n.remove());
    root.classList.toggle("filled", !!s.canvas);
    $(".ph", media).hidden = !!s.canvas;
    $(".x", root).hidden = !s.canvas && s.status === "empty";
    media.setAttribute("aria-label", s.canvas ? `Changer la photo ${LET[s.i]}` : emptyLabel(s));
    if (s.canvas) media.appendChild(thumb(s, 360));
    const prog = $(".prog", root);
    prog.hidden = !s.prog;
    if (s.prog) paintProg(s);
    const busyText = { queued: "En attente du moteur…" }[s.status];
    if (busyText) {
      const b = document.createElement("div");
      b.className = "busy";
      b.textContent = busyText;
      media.appendChild(b);
    }
    let h = "";
    if (s.status === "empty" || s.status === "noface" || s.status === "badfile") h += `<button type="button" class="chip act" data-act="cam" aria-label="Prise de vue guidée, photo ${LET[s.i]}">Prise de vue guidée</button>`;
    if (s.status === "ok") {
      h += s.det.frames ? `<span class="chip ok">Vidéo · ${s.det.frames} images de face</span>` : '<span class="chip ok">Visage détecté</span>';
      if (s.simulated) h += '<span class="chip warn">Image simulée</span>';
      if (!s.det.frames)
        h += `<button type="button" class="chip act" data-act="pick">${s.faces.length > 1 ? `Visage ${s.faceIdx + 1}/${s.faces.length} · choisir` : "Recadrer"}</button>`;
      h += gateHtml(s);
    }
    const bad = {
      noface: "Aucun visage trouvé",
      badfile: "Image illisible",
      badvideo: "Vidéo illisible sur cet appareil",
      error: "Erreur d'analyse"
    }[s.status];
    if (bad) h += `<span class="chip bad">${bad}</span>`;
    if (s.status === "noface") h += '<button type="button" class="chip act" data-act="pick">Recadrer à la main</button>';
    const inBox = s.status === "ok" && !s.kept && !s.simulated && gate(s.det).verdict === "reprendre" ? ["Visage tourné", "Visage petit", "Lunettes", "Yeux mi-clos"] : [];
    if (s.det) {
      for (const w of s.det.warn) if (!inBox.includes(w)) h += `<span class="chip warn">${w}</span>`;
    }
    if (s.status === "ok" && s.det.occ) h += `<button type="button" class="chip act" data-act="check">${s.checked ? "Masques vérifiés · modifier" : "Vérifier les masques"}</button>`;
    if (s.status === "ok") h += ageInfo(s);
    if (s.status === "ok" && !s.det.frames) {
      if (s.extras.length) h += `<span class="chip ok">${s.extras.length + 1} photos utilisées</span><button type="button" class="chip act" data-act="less">Retirer les ajouts</button>`;
      if (s.extras.length < 2) h += `<button type="button" class="chip act" data-act="more" aria-label="Ajouter une photo de la même personne, photo ${LET[s.i]}">Ajouter une photo</button>`;
    }
    $(".chips", root).innerHTML = h;
    if (refocus === s.i && s.status !== "busy") {
      refocus = null;
      ($("[data-act=check]", root) || $("[data-act=pick]", root) || $(".media", root)).focus();
    }
  }
  function startCam(s) {
    openCapture({
      name: $(`#name${s.i}`)?.value.trim() || "",
      pickFile: () => $(`#file${s.i}`).click(),
      onShot: (c) => {
        const typed = s.ageTyped, age = s.realAge;
        refocus = s.i;
        putCanvas(s, c, { name: $(`#name${s.i}`)?.value.trim() || void 0, age: typed ? age : null, photoDate: /* @__PURE__ */ new Date() });
        s.source = "camera";
      }
    });
  }
  function gateHtml(s) {
    if (s.simulated) return "";
    const g = gate(s.det);
    if (g.verdict !== "reprendre") return "";
    if (s.kept) return `<span class="chip bad">Gardée malgré : ${esc(g.redo.join(", "))}</span>`;
    return `<div class="gatebox" role="group" aria-label="Contrôle de qualité, photo ${LET[s.i]}"><p><strong>Photo à reprendre</strong> : ${esc(g.redo.join(" ; "))}.</p><div class="gateact"><button type="button" class="btn small primary" data-act="retake">Autre photo</button>${s.source === "camera" ? "" : '<button type="button" class="btn small" data-act="cam">Caméra guidée</button>'}<button type="button" class="btn small" data-act="keep">Garder</button></div></div>`;
  }
  function thumb(s, S) {
    const t = makeCanvas(S, S), g = t.getContext("2d"), c = s.canvas;
    let sx, sy, sw;
    if (s.det) {
      const b = s.det.box;
      sw = Math.max(b.width, b.height) * 1.55;
      sx = b.x + b.width / 2 - sw / 2;
      sy = b.y + b.height / 2 - sw / 2 - b.height * 0.05;
    } else {
      sw = Math.min(c.width, c.height);
      sx = (c.width - sw) / 2;
      sy = (c.height - sw) / 2;
    }
    g.fillStyle = cssVar("--sunk");
    g.fillRect(0, 0, S, S);
    g.drawImage(c, sx, sy, sw, sw, 0, 0, S, S);
    if (s.det) {
      const k = S / sw;
      g.fillStyle = cssVar(CVAR[s.i]);
      g.strokeStyle = "rgba(255,255,255,.85)";
      g.lineWidth = 1;
      for (const [x, y] of s.det.pts) {
        g.beginPath();
        g.arc((x - sx) * k, (y - sy) * k, 2.6, 0, 7);
        g.fill();
        g.stroke();
      }
    }
    return t;
  }
  function ageInfo(s) {
    const est = s.det?.age, real = s.realAge;
    if (est == null) return "";
    let h = real != null && !s.ageTyped ? `<span class="chip" title="Calculé d'après la date de la photo et la date de naissance">${ageLabel(real)} sur la photo</span>` : "";
    const risk = s.det.q?.ageRisk, riskTxt = risk ? ` · peu fiable (${risk})` : "";
    if (real != null && real >= 14 && real <= 20 || real == null && est >= 12 && est < 25)
      return h + `<span class="chip" title="À l'adolescence, le modèle vieillit nettement les visages">Âge apparent : peu fiable à l'adolescence</span>`;
    if ((real ?? est) < 14) {
      if (real != null && Math.abs(est - real) > 5)
        return h + `<span class="chip warn" title="L'estimation s'écarte trop de l'âge réel : frange, regard de côté ou lumière">Âge apparent incohérent : photo peu exploitable</span>`;
      return h + `<span class="chip" title="Chez l'enfant, environ 2 ans d'erreur sur nos essais ; ne dit rien de la croissance">Paraît ≈ ${ageLabel(est, true)} (± ${est < 2 ? 2 : 3} ans)${riskTxt}</span>`;
    }
    h += `<span class="chip" title="Marge d'erreur d'environ 7 ans">Paraît ≈ ${Math.round(est)} ans${riskTxt}</span>`;
    if (real != null && !risk) {
      const d = Math.round(est - real);
      h += Math.abs(d) > 10 ? `<span class="chip">${Math.abs(d)} ans de ${d > 0 ? "plus" : "moins"} que son âge</span>` : `<span class="chip">écart dans la marge d'erreur</span>`;
    }
    return h;
  }
  var MASKS = [["glasses", "Lunettes"], ["beard", "Barbe ou moustache"], ["fringe", "Frange sur le front"], ["hairSides", "Cheveux sur les côtés du visage"]];
  var maskSlot = null;
  function openMasks(s) {
    maskSlot = s;
    $("#maskWho").textContent = `Photo ${LET[s.i]}${s.name ? ` · ${s.name}` : ""}`;
    $("#maskList").innerHTML = MASKS.map(([k, label]) => `<label class="check"><input type="checkbox" data-k="${k}"${s.det.occ[k] ? " checked" : ""}> ${label}${k === "glasses" ? " (les yeux ne seront pas notés)" : ""}${s.det.occ[k] && !s.checked ? ' <span class="chip">détecté</span>' : ""}</label>`).join("");
    openDialog($("#maskSheet"), () => {
      refocus = s.i;
      maskSlot = null;
      renderSlot(s);
    });
  }
  function applyMasks() {
    const s = maskSlot;
    if (!s?.det?.occ) return;
    const occ = { ...s.det.occ };
    for (const c of $$("#maskList input")) occ[c.dataset.k] = c.checked;
    s.det = { ...requalify({ ...s.det, occ }, s.realAge), lens: !!occ.glasses };
    s.checked = true;
    refresh(s);
    closeDialog();
    renderResults();
    emit2("faces");
    const masked = MASKS.filter(([k]) => occ[k]).map(([, l]) => l.toLowerCase());
    toast(masked.length ? `Pris en compte : ${masked.join(", ")}.${occ.glasses ? " Les yeux ne sont pas notés : les verres changent leur taille apparente." : ""}` : "Aucun masque : tous les traits comptent pleinement.");
  }
  function initMasks() {
    $("#maskGo").addEventListener("click", applyMasks);
  }
  var picker = { s: null, mode: "pick", a: null, b: null, scale: 1 };
  var refocus = null;
  function openPicker(s) {
    Object.assign(picker, { s, a: null, b: null });
    setPickMode(s.faces.length ? "pick" : "crop");
    $("#cropUndo").hidden = !s.orig;
    renderFacePick();
    openDialog($("#faceSheet"), () => {
      refocus = s.i;
      picker.s = null;
    });
  }
  function setPickMode(m) {
    const s = picker.s;
    picker.mode = m;
    $("#modePick").setAttribute("aria-pressed", m === "pick");
    $("#modeCrop").setAttribute("aria-pressed", m === "crop");
    $("#facePick").hidden = m !== "pick";
    $("#sheetHint").textContent = m === "pick" ? s.faces.length ? `${s.faces.length} visage${s.faces.length > 1 ? "s" : ""} trouvé${s.faces.length > 1 ? "s" : ""} : choisissez celui à analyser.` : "Aucun visage trouvé : passez en recadrage." : "Faites glisser un cadre autour du visage, puis « Analyser cette zone ».";
    $("#cropGo").hidden = !(m === "crop" && picker.a && picker.b);
    drawPicker();
  }
  function renderFacePick() {
    const s = picker.s, box = $("#facePick");
    box.innerHTML = "";
    s.faces.forEach((f, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-pressed", i === s.faceIdx);
      b.setAttribute("aria-label", `Visage ${i + 1}`);
      const c = makeCanvas(128, 128), g = c.getContext("2d"), r = f.detection.box, sw = Math.max(r.width, r.height) * 1.4;
      g.drawImage(s.canvas, r.x + r.width / 2 - sw / 2, r.y + r.height / 2 - sw / 2, sw, sw, 0, 0, 128, 128);
      b.append(c, document.createTextNode(`Visage ${i + 1}`));
      b.addEventListener("click", () => {
        closeDialog();
        chooseFace(s, i);
      });
      box.appendChild(b);
    });
  }
  function drawPicker() {
    const s = picker.s;
    if (!s?.canvas) return;
    const cv = $("#pickCanvas"), src = s.canvas;
    picker.scale = Math.min(1200, src.width) / src.width;
    cv.width = Math.round(src.width * picker.scale);
    cv.height = Math.round(src.height * picker.scale);
    const g = cv.getContext("2d"), k = picker.scale, lw = Math.max(2, cv.width / 300);
    g.drawImage(src, 0, 0, cv.width, cv.height);
    if (picker.mode === "pick") {
      s.faces.forEach((f, i) => {
        const b = f.detection.box, sel = i === s.faceIdx, r = Math.max(12, cv.width / 40);
        g.lineWidth = sel ? lw * 1.8 : lw;
        g.strokeStyle = sel ? cssVar(CVAR[s.i]) : "rgba(255,255,255,.9)";
        g.strokeRect(b.x * k, b.y * k, b.width * k, b.height * k);
        g.fillStyle = sel ? cssVar(CVAR[s.i]) : "rgba(0,0,0,.65)";
        g.beginPath();
        g.arc(b.x * k + r, b.y * k + r, r, 0, 7);
        g.fill();
        g.fillStyle = "#fff";
        g.font = `600 ${Math.round(r * 1.1)}px system-ui,sans-serif`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(i + 1, b.x * k + r, b.y * k + r + 1);
      });
    } else if (picker.a && picker.b) {
      const x = Math.min(picker.a[0], picker.b[0]), y = Math.min(picker.a[1], picker.b[1]);
      const w = Math.abs(picker.a[0] - picker.b[0]), h = Math.abs(picker.a[1] - picker.b[1]);
      g.fillStyle = "rgba(0,0,0,.45)";
      g.fillRect(0, 0, cv.width, y);
      g.fillRect(0, y + h, cv.width, cv.height - y - h);
      g.fillRect(0, y, x, h);
      g.fillRect(x + w, y, cv.width - x - w, h);
      g.strokeStyle = "#fff";
      g.lineWidth = lw;
      g.setLineDash([lw * 3, lw * 2]);
      g.strokeRect(x, y, w, h);
      g.setLineDash([]);
    }
  }
  function canvasPt(e) {
    const cv = $("#pickCanvas"), r = cv.getBoundingClientRect();
    return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height];
  }
  function initPicker() {
    const cv = $("#pickCanvas");
    cv.addEventListener("pointerdown", (e) => {
      const s = picker.s;
      if (!s) return;
      const p = canvasPt(e);
      if (picker.mode === "pick") {
        const [x, y] = [p[0] / picker.scale, p[1] / picker.scale];
        let best = -1, bd = 1e9;
        s.faces.forEach((f, i) => {
          const b = f.detection.box, inside = x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
          const d = Math.hypot(x - b.x - b.width / 2, y - b.y - b.height / 2) / (inside ? 10 : 1);
          if (d < bd) {
            bd = d;
            best = i;
          }
        });
        if (best >= 0) {
          closeDialog();
          chooseFace(s, best);
        }
      } else {
        picker.a = p;
        picker.b = null;
        cv.setPointerCapture(e.pointerId);
      }
    });
    cv.addEventListener("pointermove", (e) => {
      if (picker.mode === "crop" && picker.a && e.buttons) {
        picker.b = canvasPt(e);
        drawPicker();
      }
    });
    cv.addEventListener("pointerup", (e) => {
      if (picker.mode !== "crop" || !picker.a) return;
      picker.b = canvasPt(e);
      if (Math.abs(picker.a[0] - picker.b[0]) < 12 || Math.abs(picker.a[1] - picker.b[1]) < 12) picker.a = picker.b = null;
      $("#cropGo").hidden = !(picker.a && picker.b);
      drawPicker();
    });
    $("#modePick").addEventListener("click", () => setPickMode("pick"));
    $("#modeCrop").addEventListener("click", () => setPickMode("crop"));
    $("#cropGo").addEventListener("click", () => {
      const s = picker.s;
      if (!s || !picker.a || !picker.b) return;
      const k = 1 / picker.scale;
      const x = Math.min(picker.a[0], picker.b[0]) * k, y = Math.min(picker.a[1], picker.b[1]) * k;
      const w = Math.abs(picker.a[0] - picker.b[0]) * k, h = Math.abs(picker.a[1] - picker.b[1]) * k;
      const m = 0.15, X = Math.max(0, x - w * m), Y = Math.max(0, y - h * m);
      const W = Math.min(s.canvas.width - X, w * (1 + 2 * m)), H = Math.min(s.canvas.height - Y, h * (1 + 2 * m));
      const up = Math.min(4, Math.max(1, 600 / Math.max(W, H))), c = makeCanvas(W * up, H * up), g = ctx2d(c);
      g.imageSmoothingQuality = "high";
      g.drawImage(s.canvas, X, Y, W, H, 0, 0, c.width, c.height);
      const orig = s.orig || s.canvas;
      closeDialog();
      s.gen++;
      resetChoices(s);
      Object.assign(s, { orig, canvas: c, work: null, det: null, faces: [] });
      analyzeSlot(s);
    });
    $("#cropUndo").addEventListener("click", () => {
      const s = picker.s;
      if (!s?.orig) return;
      closeDialog();
      s.gen++;
      resetChoices(s);
      Object.assign(s, { canvas: s.orig, orig: null, work: null, det: null, faces: [] });
      analyzeSlot(s);
    });
  }
  var activePair = null;
  var refIdx = 0;
  var lastRes = null;
  var NO_GLOBAL_GAP = 30;
  var STABLE = /* @__PURE__ */ new Set(["nez", "bouche", "yeux", "sourcils", "iris"]);
  var noGlobal = (R) => R.ageGap > NO_GLOBAL_GAP;
  var ageOf = (i) => slots[i].realAge ?? (slots[i].fused || slots[i].det)?.age;
  var stableTraits = (R) => R.traits.filter((r) => r.sim != null && STABLE.has(r.t.id)).sort((x, y) => y.sim - x.sim);
  function renderResults() {
    const ok = slots.filter((s) => s.status === "ok");
    $("#empty").hidden = ok.length >= 2;
    $("#results").hidden = ok.length < 2;
    if (ok.length < 2) {
      lastRes = null;
      return;
    }
    const pairs = [];
    for (let a2 = 0; a2 < ok.length; a2++) for (let b2 = a2 + 1; b2 < ok.length; b2++) pairs.push([ok[a2].i, ok[b2].i]);
    const res = {};
    const lensAll = lensAny();
    for (const [a2, b2] of pairs) res[`${a2}${b2}`] = compare(record(slots[a2]), record(slots[b2]), { lens: lensAll });
    if (!activePair || !res[activePair]) activePair = pairs[0].join("");
    $("#tabs").innerHTML = pairs.map(([a2, b2]) => {
      const k = `${a2}${b2}`, sel = k === activePair;
      return `<button class="tab" role="tab" id="tab${k}" aria-selected="${sel}" tabindex="${sel ? 0 : -1}" aria-controls="pairPanel" data-k="${k}"><span class="pdots"><i data-css="background:var(${CVAR[a2]})"></i><i data-css="background:var(${CVAR[b2]})"></i></span>${nm(a2)} · ${nm(b2)}<span class="num">${noGlobal(res[k]) ? `<span aria-hidden="true">—</span><span class="sr-only">écart d'âge : pas de score global</span>` : `${Math.round(res[k].total)} %`}</span></button>`;
    }).join("");
    const [a, b] = activePair.split("").map(Number), R = res[activePair];
    lastRes = { a, b, R };
    renderScore(a, b, R);
    renderTraits(a, b, R);
    drawOverlay(a, b);
    renderHeritage(ok);
  }
  function selectPair(k, focus) {
    activePair = k;
    renderResults();
    if (focus) $(`#tab${k}`)?.focus();
  }
  function gauge(R) {
    const pos = (v) => `${Math.max(0, Math.min(100, v))}%`;
    const st = REFERENCES.stranger, sm = REFERENCES.same;
    const bands = R.bigGap ? "" : `
      <div class="g-band" data-css="left:${pos(st.lo)};width:${st.hi - st.lo}%" title="${st.label} : ${st.lo} à ${st.hi} %"></div>
      <div class="g-band same" data-css="left:${pos(sm.lo)};width:${sm.hi - sm.lo}%" title="${sm.label} : ${sm.lo} à ${sm.hi} %"></div>`;
    const labels = R.bigGap ? `<span data-css="left:50%">Grand écart d'âge : repères non applicables</span>` : `<span data-css="left:${(st.lo + st.hi) / 2}%">${st.label}<br>${st.lo}–${st.hi} %</span><span data-css="left:${(sm.lo + sm.hi) / 2}%">${sm.label}<br>${sm.lo}–${sm.hi} %</span>`;
    return `<div class="gauge" role="img" aria-label="Score ${Math.round(R.total)} sur 100. Repères : ${st.label.toLowerCase()} ${st.lo} à ${st.hi} ; ${sm.label.toLowerCase()} ${sm.lo} à ${sm.hi}.">
      <div class="g-track"><div class="g-line"></div>${bands}<div class="g-mark" data-css="left:${pos(R.total)}"></div></div>
      <div class="g-axis" aria-hidden="true"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div>
      <div class="g-labels" aria-hidden="true">${labels}</div></div>`;
  }
  function renderScore(a, b, R) {
    if (noGlobal(R)) return renderNoGlobal(a, b, R);
    const valid = R.traits.filter((r) => r.sim != null && !r.t.tag).sort((x, y) => y.sim - x.sim);
    const top = valid.slice(0, 2).map((r) => r.t.name.toLowerCase()), low = valid[valid.length - 1];
    const [rl, rc] = relLabel(R.rel);
    $("#scoreCard").innerHTML = `
    <span class="label">Ressemblance ${nm(a)} · ${nm(b)}</span>
    <div class="big"><span class="n">${Math.round(R.total)}<small>%</small></span><span class="level">${level(R.total)}</span></div>
    ${gauge(R)}
    <div class="split">
      <div><span class="label">Impression globale</span><b>${Math.round(R.ia)} %</b><span class="hint">réseau de reconnaissance</span></div>
      <div><span class="label">Traits mesurés</span><b>${Math.round(R.geo)} %</b><span class="hint">moyenne pondérée</span></div>
    </div>
    <p class="summary">Points communs les plus nets : <strong>${top.join("</strong> et <strong>")}</strong>. Le trait le plus différent : <strong>${low.t.name.toLowerCase()}</strong>.</p>
    ${R.bigGap ? `<p class="hint"><strong>${Math.round(R.ageGap)} ans d'écart</strong> entre les deux visages : les traits mesurés deviennent trompeurs (croissance, rides), le score repose à 80 % sur l'impression globale et reste naturellement bas. L'album compare automatiquement des photos d'âges proches.</p>` : ""}
    <div class="relrow"><span class="chip ${rc}">Fiabilité ${rl.toLowerCase()}</span><span class="hint">${R.rel < 0.85 ? "Photos de face, bouche fermée et bien éclairées donnent un résultat plus sûr." : "Photos de bonne qualité pour la comparaison."}</span></div>
    ${notes(a, b, R)}
    <p class="hint">Ce n'est pas un test de parenté : une famille se situe souvent entre les deux zones, mais pas toujours.</p>
    <div class="actions"><button type="button" class="btn" id="copyBtn">Copier le résumé</button><button type="button" class="btn" id="shareBtn">Créer une image</button></div>`;
  }
  function renderNoGlobal(a, b, R) {
    const st = stableTraits(R), gap2 = Math.round(R.ageGap);
    const old = (ageOf(a) ?? 0) >= (ageOf(b) ?? 0) ? a : b, young = old === a ? b : a;
    const top = st.filter((r) => !r.t.tag).slice(0, 2).map((r) => r.t.name.toLowerCase());
    const trio2 = slots.filter((s) => s.status === "ok").length >= 3;
    $("#scoreCard").innerHTML = `
    <span class="label">Ressemblance ${nm(a)} · ${nm(b)}</span>
    <div class="big"><span class="level">Pas de score global</span></div>
    <p class="summary"><strong>${gap2} ans d'écart</strong> : trop pour un pourcentage global. Au-delà de ${NO_GLOBAL_GAP} ans, il ne distingue plus une famille de deux inconnus. Comparez plutôt ce qui change peu avec l'âge.</p>
    <div class="stable"><span class="label">Traits stables avec l'âge</span>
      <ul class="stablelist">${st.map((r) => `<li><span>${r.t.name}${r.t.tag ? ` <em>${r.t.tag}</em>` : ""}</span><b>${Math.round(r.sim)} %</b></li>`).join("") || "<li>Aucun trait stable mesurable sur ces photos.</li>"}</ul></div>
    ${top.length ? `<p class="summary">Points communs les plus nets : <strong>${top.join("</strong> et <strong>")}</strong>.</p>` : ""}
    <p class="hint">Forme du visage, écart des yeux, proportions et teint changent avec la croissance et l'âge : ils restent affichés plus bas, sans conclusion.</p>
    <div class="relrow"><span class="chip bad">Fiabilité limitée : écart d'âge</span><span class="hint">Pour une vraie comparaison, ajoutez une photo de ${nm(old)} à l'âge de ${nm(young)} (photo ancienne).</span></div>
    ${trio2 ? '<p><a class="linkbtn" href="#heritage">Voir qui a transmis quoi, trait par trait</a></p>' : ""}
    ${notes(a, b, R)}
    <p class="hint">Ce n'est pas un test de parenté.</p>
    <div class="actions"><button type="button" class="btn" id="copyBtn">Copier le résumé</button><button type="button" class="btn" id="shareBtn">Créer une image</button></div>`;
  }
  function notes(a, b, R) {
    const out = [];
    for (const i of [a, b]) {
      const s = slots[i], g = s.simulated ? null : gate(s.det);
      if (s.kept && g?.verdict === "reprendre") out.push(`<li class="bad">${nm(i)} : photo gardée malgré un défaut (${esc(g.redo.join(", "))}). Résultat moins sûr.</li>`);
      if (s.extras.length) out.push(`<li>${nm(i)} : ${s.extras.length + 1} photos combinées, chacune pondérée par sa qualité.</li>`);
      if (s.simulated) out.push(`<li class="bad">${nm(i)} : image simulée (vieillissement ou fusion), pas une vraie photo.</li>`);
    }
    if (R.lens) {
      const who = [a, b].filter((i) => (slots[i].fused || slots[i].det).lens).map(nm);
      out.push(`<li>Yeux et couleur des yeux non notés : lunettes confirmées${who.length ? ` (${who.join(" et ")})` : " sur une autre photo"}. Score calculé sans ces traits ; les repères « inconnus / même personne » restent indicatifs.</li>`);
    }
    if (R.ia >= 80 && R.geo <= 25) out.push(`<li class="bad">Impression globale élevée (${Math.round(R.ia)} %) mais traits très bas (${Math.round(R.geo)} %) : les repères d'une photo sont sans doute mal placés (photo floue ou bougée ?). Vérifiez le contour superposé ou reprenez la photo.</li>`);
    const miss = [a, b].filter((i) => slots[i].realAge == null);
    if (miss.length) {
      const near = Math.abs(R.ageGap - BIG_GAP) < 8 || Math.abs(R.ageGap - NO_GLOBAL_GAP) < 8;
      const what = noGlobal(R) || Math.abs(R.ageGap - NO_GLOBAL_GAP) < 8 ? "décide si un score global peut être affiché" : "change la façon de calculer le score";
      out.push(`<li class="${R.bigGap || near ? "bad" : ""}">Âge ${miss.length > 1 ? "estimé pour les deux photos" : `estimé pour ${nm(miss[0])}`} : l'écart d'âge (${Math.round(R.ageGap)} ans) ${what}${R.bigGap || near ? ", et l'estimation peut se tromper de plus de 10 ans" : ""}. <button type="button" class="linkbtn" data-age="${miss[0]}">Indiquer l'âge réel</button></li>`);
    }
    return out.length ? `<ul class="notes-score">${out.join("")}</ul>` : "";
  }
  function summaryText() {
    if (!lastRes) return "";
    const { a, b, R } = lastRes, ng = noGlobal(R);
    const lines = ng ? [
      `Air de famille — ${slotName(slots[a])} / ${slotName(slots[b])} : pas de score global (${Math.round(R.ageGap)} ans d'écart)`,
      "Fiabilité limitée : écart d'âge. Traits stables avec l'âge mis en avant ; pour comparer vraiment, utilisez une photo du parent au même âge."
    ] : [
      `Air de famille — ${slotName(slots[a])} / ${slotName(slots[b])} : ${Math.round(R.total)} % (${level(R.total).toLowerCase()})`,
      `Impression globale ${Math.round(R.ia)} % · traits mesurés ${Math.round(R.geo)} % · fiabilité ${relLabel(R.rel)[0].toLowerCase()}`
    ];
    for (const r of R.traits) lines.push(`- ${r.t.name} : ${r.sim == null ? r.lens ? "non mesurable (lunettes confirmées)" : "non mesurable" : `${Math.round(r.sim)} %`}${ng && !STABLE.has(r.t.id) ? " (change avec l'âge)" : ""}`);
    if (slots[a].simulated || slots[b].simulated) lines.push("Contient une image simulée (vieillissement ou fusion).");
    lines.push("Analyse locale, simulation de ressemblance : pas un test de parenté.");
    return lines.join("\n");
  }
  async function copySummary() {
    const t = summaryText();
    try {
      await navigator.clipboard.writeText(t);
      toast("Résumé copié.");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = t;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      let done = false;
      try {
        done = document.execCommand("copy");
      } catch {
        done = false;
      }
      ta.remove();
      toast(done ? "Résumé copié." : "Copie impossible ici : sélectionnez le texte à la main.");
    }
  }
  function lensWho(a, b) {
    const who = [a, b].filter((i) => (slots[i].fused || slots[i].det).lens).map(nm);
    return who.length ? `lunettes confirmées (${who.join(" et ")})` : "lunettes confirmées sur une autre photo";
  }
  function renderTraits(a, b, R) {
    const ng = noGlobal(R);
    const open2 = new Set($$("#traits details[open]").map((d) => d.dataset.id));
    const unit = (it) => it.u === "°" ? "°" : "";
    $("#traits").innerHTML = R.traits.map((r) => {
      const t = r.t, na = r.sim == null, p = na ? 0 : Math.round(r.sim);
      let body;
      if (na && r.lens) body = `<p class="hint">Non mesurable : ${lensWho(a, b)}. Les verres changent la taille et la couleur apparentes des yeux ; pour mesurer ce trait, utilisez une photo sans lunettes.</p>`;
      else if (na) body = `<p class="hint">Non mesurable sur l'une des photos (zone trop petite, sombre ou masquée).</p>`;
      else if (t.color) {
        const row = (i, c, cls) => `<tr><th>${nm(i)}</th><td class="${cls}">L ${fmt(c.lab[0], 0)} · a ${fmt(c.lab[1], 0)} · b ${fmt(c.lab[2], 0)}<span class="sw" data-css="background:rgb(${c.rgb})"></span></td></tr>`;
        body = `<table class="mtable" data-css="--a:var(${CVAR[a]});--b:var(${CVAR[b]})">${row(a, r.ca, "ca")}${row(b, r.cb, "cb")}<tr><th>Écart de couleur (ΔE)</th><td>${fmt(r.de, 1)}</td></tr></table>
        <p class="hint">${t.color === "skin" ? "Mesuré sur les deux joues" : "Mesuré au centre de chaque œil, hors pupille et reflets"}, après correction de la lumière par le blanc des yeux. Reste sensible aux éclairages colorés et au maquillage.</p>`;
      } else {
        body = `<table class="mtable" data-css="--a:var(${CVAR[a]});--b:var(${CVAR[b]})"><tr><th></th><td class="ca">${nm(a)}</td><td class="cb">${nm(b)}</td></tr>${r.rows.map(
          (x) => x.it.shape ? `<tr><th>${x.it.label}</th><td colspan="2">écart moyen ${fmt(x.rms * 100, 1)} %</td></tr>` : `<tr><th>${x.it.label}</th><td class="ca">${fmt(x.va, x.it.d ?? 2)}${unit(x.it)}</td><td class="cb">${fmt(x.vb, x.it.d ?? 2)}${unit(x.it)}</td></tr>`
        ).join("")}</table>`;
        if (r.app != null)
          body += `<div class="sub"><span>Texture de la zone</span><b>${Math.round(r.app)} %</b><span>Mesures</span><b>${Math.round(r.geo)} %</b></div>`;
        if (r.wq < 1 && r.why)
          body += `<p class="hint">Zone peu fiable sur l'une des photos (${r.why}) : son poids dans le score est réduit.</p>`;
        if (r.lensCut) body += '<p class="hint">Lunettes confirmées : la mesure des coins internes, vue à travers les verres, est retirée.</p>';
        if (t.id === "visage")
          body += '<p class="hint">Le contour du visage est le repère le moins stable : il varie avec la pose, la coiffure et la barbe.</p>';
        if (r.rows.some((x) => x.it.u === "é")) body += '<p class="hint">Longueurs en écarts inter-yeux (centre à centre = 1).</p>';
      }
      return `<details class="trait" data-id="${t.id}"${open2.has(t.id) ? " open" : ""}>
      <summary><span class="tname">${t.name}${t.tag ? `<em>${t.tag}</em>` : ""}${r.lens ? "<em>non mesurable : lunettes</em>" : ""}${ng && !STABLE.has(t.id) ? "<em>change avec l'âge</em>" : ""}</span><span class="bar${na ? " na" : ""}"><b data-css="width:${p}%"></b></span><span class="pct">${na ? "—" : `${p} %`}</span></summary>
      <div class="detail">${body}</div></details>`;
    }).join("");
  }
  var GROUPS = [
    [0, 16, false],
    [17, 21, false],
    [22, 26, false],
    [27, 30, false],
    [31, 35, false],
    [36, 41, true],
    [42, 47, true],
    [48, 59, true],
    [60, 67, true]
  ];
  function drawOverlay(a, b) {
    if (a == null) {
      if (!lastRes) return;
      ({ a, b } = lastRes);
    }
    if (!slots[a].det || !slots[b].det) return;
    const cv = $("#overlay"), dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth || 300;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(W * dpr);
    const g = cv.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, W);
    const sets = [slots[a].det.norm, slots[b].det.norm];
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const P of sets)
      for (const [x, y] of P) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
    const span = Math.max(x1 - x0, y1 - y0) * 1.2, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, k = W / span;
    const X = (x) => W / 2 + (x - cx) * k, Y = (y) => W / 2 + (y - cy) * k;
    g.strokeStyle = cssVar("--line");
    g.lineWidth = 1;
    g.globalAlpha = 0.55;
    const step2 = 0.25 * k;
    for (let v = X(0) % step2; v < W; v += step2) {
      g.beginPath();
      g.moveTo(v, 0);
      g.lineTo(v, W);
      g.stroke();
    }
    for (let v = Y(0) % step2; v < W; v += step2) {
      g.beginPath();
      g.moveTo(0, v);
      g.lineTo(W, v);
      g.stroke();
    }
    g.globalAlpha = 1;
    g.setLineDash([4, 4]);
    g.strokeStyle = cssVar("--muted");
    g.beginPath();
    g.moveTo(0, Y(0));
    g.lineTo(W, Y(0));
    g.stroke();
    g.setLineDash([]);
    g.font = '10px "Martian Mono", monospace';
    const lt = "ligne des yeux", lw = g.measureText(lt).width;
    g.fillStyle = cssVar("--sunk");
    g.fillRect(4, Y(0) - 15, lw + 6, 13);
    g.fillStyle = cssVar("--muted");
    g.fillText(lt, 7, Y(0) - 5);
    [a, b].forEach((idx, n) => {
      const P = sets[n];
      g.strokeStyle = cssVar(CVAR[idx]);
      g.lineWidth = 2.2;
      g.lineJoin = "round";
      g.lineCap = "round";
      for (const [s, e, closed] of GROUPS) {
        g.beginPath();
        g.moveTo(X(P[s][0]), Y(P[s][1]));
        for (let i = s + 1; i <= e; i++) g.lineTo(X(P[i][0]), Y(P[i][1]));
        if (closed) g.closePath();
        g.stroke();
      }
      g.beginPath();
      g.moveTo(X(P[30][0]), Y(P[30][1]));
      g.lineTo(X(P[33][0]), Y(P[33][1]));
      g.stroke();
    });
    $("#legend").innerHTML = `${[a, b].map((i) => `<span><i data-css="background:var(${CVAR[i]})"></i>${nm(i)}</span>`).join("")}<span class="hint">quadrillage = ¼ d'écart inter-yeux</span>`;
  }
  function renderHeritage(ok) {
    const box = $("#heritage");
    if (ok.length < 3) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    if (!ok.some((s) => s.i === refIdx)) refIdx = ok[0].i;
    const sel = $("#refSel");
    sel.innerHTML = ok.map((s) => `<option value="${s.i}"${s.i === refIdx ? " selected" : ""}>${esc(slotName(s))}</option>`).join("");
    const [x, y] = ok.map((s) => s.i).filter((i) => i !== refIdx);
    const lensAll = lensAny(), RX = compare(record(slots[refIdx]), record(slots[x]), { lens: lensAll }), RY = compare(record(slots[refIdx]), record(slots[y]), { lens: lensAll });
    const ng = noGlobal(RX) || noGlobal(RY);
    const far = [[x, RX], [y, RY]].filter(([, R]) => noGlobal(R)).map(([i, R]) => `${nm(i)} (${Math.round(R.ageGap)} ans)`);
    $("#heritageIntro").innerHTML = `Pour chaque trait de <strong>${nm(refIdx)}</strong>, la barre penche vers le visage le plus proche.${ng ? ` Écart d'âge de plus de ${NO_GLOBAL_GAP} ans avec ${far.join(" et ")} : seuls les traits stables avec l'âge sont départagés.` : ""}`;
    const rows = TRAITS.map((t, n) => {
      const sx = RX.traits[n].sim, sy = RY.traits[n].sim, name = `<span class="tname">${t.name}${t.tag ? `<em>${t.tag}</em>` : ""}</span>`;
      if (sx == null || sy == null)
        return `<div class="hrow">${name}<div class="tugwrap"><div class="tug"></div></div><span class="verdict muted">non mesurable${RX.traits[n].lens ? " (lunettes)" : ""}</span></div>`;
      if (ng && !STABLE.has(t.id))
        return `<div class="hrow">${name}<div class="tugwrap"><div class="tug"></div><div class="hnums"><span>${Math.round(sx)} %</span><span>${Math.round(sy)} %</span></div></div><span class="verdict muted">change avec l'âge</span></div>`;
      const wx = sx / (sx + sy || 1) * 100;
      const v = Math.abs(sx - sy) < 6 ? '<span class="muted">à égalité</span>' : `<span data-css="text-decoration:underline 3px var(${CVAR[sx > sy ? x : y]});text-underline-offset:3px">côté ${nm(sx > sy ? x : y)}</span>`;
      return `<div class="hrow">${name}<div class="tugwrap"><div class="tug"><b data-css="width:${wx}%;background:var(${CVAR[x]})"></b><b data-css="flex:1;background:var(${CVAR[y]})"></b></div><div class="hnums"><span>${Math.round(sx)} %</span><span>${Math.round(sy)} %</span></div></div><span class="verdict">${v}</span></div>`;
    }).join("");
    const side = (n) => TRAITS[n] && STABLE.has(TRAITS[n].id) && RX.traits[n].sim != null && RY.traits[n].sim != null && Math.abs(RX.traits[n].sim - RY.traits[n].sim) >= 6 ? RX.traits[n].sim > RY.traits[n].sim ? x : y : null;
    const cnt = (i) => TRAITS.filter((_, n) => side(n) === i).length;
    const lead = ng ? (cnt(x) + cnt(y) ? `Sur les traits stables avec l'âge, ${nm(refIdx)} tient de <strong>${nm(x)}</strong> pour ${cnt(x)} trait${cnt(x) > 1 ? "s" : ""} et de <strong>${nm(y)}</strong> pour ${cnt(y)}.` : "Aucun trait stable avec l'âge ne départage les deux visages.") + " Pas de total : l'écart d'âge est trop grand." : Math.abs(RX.total - RY.total) < 3 ? `${nm(refIdx)} ressemble autant à ${nm(x)} qu'à ${nm(y)}.` : `Au total, ${nm(refIdx)} ressemble davantage à <strong>${nm(RX.total > RY.total ? x : y)}</strong> (${Math.round(Math.max(RX.total, RY.total))} % contre ${Math.round(Math.min(RX.total, RY.total))} %).`;
    $("#hrows").innerHTML = `${rows}<p class="summary" data-css="margin-top:10px">${lead}</p>`;
  }
  function shareCard() {
    const { a, b, R } = lastRes, W = 1080, H = 1350, c = makeCanvas(W, H), g = c.getContext("2d");
    const C = (v) => cssVar(v);
    g.fillStyle = C("--bg");
    g.fillRect(0, 0, W, H);
    g.fillStyle = C("--ink");
    g.font = '700 64px "Familjen Grotesk", system-ui, sans-serif';
    g.textAlign = "center";
    g.fillText("Air de famille", W / 2, 120);
    const face = (s, cx) => {
      const r = 210, b2 = s.det.box, sw = Math.max(b2.width, b2.height) * 1.7;
      g.save();
      g.beginPath();
      g.arc(cx, 400, r, 0, 7);
      g.clip();
      g.fillStyle = C("--sunk");
      g.fillRect(cx - r, 400 - r, 2 * r, 2 * r);
      g.drawImage(s.canvas, b2.x + b2.width / 2 - sw / 2, b2.y + b2.height / 2 - sw / 2 - b2.height * 0.05, sw, sw, cx - r, 400 - r, 2 * r, 2 * r);
      g.restore();
      g.lineWidth = 12;
      g.strokeStyle = C(CVAR[s.i]);
      g.beginPath();
      g.arc(cx, 400, r, 0, 7);
      g.stroke();
      g.fillStyle = C("--ink");
      g.font = '600 44px "Familjen Grotesk", system-ui, sans-serif';
      g.fillText(slotName(s).slice(0, 18), cx, 680);
    };
    face(slots[a], 290);
    face(slots[b], 790);
    g.fillStyle = C("--ink");
    g.font = '700 190px "Familjen Grotesk", system-ui, sans-serif';
    const ng = noGlobal(R);
    if (ng) g.font = '700 120px "Familjen Grotesk", system-ui, sans-serif';
    g.fillText(ng ? `${Math.round(R.ageGap)} ans d'écart` : `${Math.round(R.total)} %`, W / 2, 900);
    g.fillStyle = C("--accent");
    g.font = '700 50px "Familjen Grotesk", system-ui, sans-serif';
    g.fillText(ng ? "Traits stables avec l'âge" : `Ressemblance ${level(R.total).toLowerCase()}`, W / 2, 975);
    const main = ng ? stableTraits(R) : R.traits.filter((r) => r.sim != null && !r.t.tag);
    const mentions = [];
    if (R.lens) mentions.push(["--muted", "500 28px", "Yeux non notés : lunettes confirmées"]);
    if (ng) mentions.push(["--bad", "600 30px", main.length ? "Fiabilité limitée : écart d'âge, pas de score global" : "Fiabilité limitée : aucun trait stable mesurable"]);
    if (slots[a].simulated || slots[b].simulated) mentions.push(["--bad", "600 30px", "Contient une image simulée"]);
    const step2 = Math.min(46, (H - 1030 - 90 - mentions.length * 44) / Math.max(1, main.length));
    const bh = Math.min(22, step2 - 8), fs = Math.round(Math.min(32, step2 - 4));
    main.forEach((r, n) => {
      const y = 1035 + n * step2, x0 = 330, bw = 560;
      g.textAlign = "right";
      g.fillStyle = C("--muted");
      g.font = `500 ${fs}px "Familjen Grotesk", system-ui, sans-serif`;
      g.fillText(r.t.name, x0 - 24, y - 8 + bh / 2 + fs * 0.35);
      g.fillStyle = C("--sunk");
      g.beginPath();
      g.roundRect(x0, y - 8, bw, bh, bh / 2);
      g.fill();
      g.fillStyle = C("--accent");
      g.beginPath();
      g.roundRect(x0, y - 8, Math.max(bh, bw * r.sim / 100), bh, bh / 2);
      g.fill();
      g.textAlign = "left";
      g.fillStyle = C("--ink");
      g.fillText(`${Math.round(r.sim)} %`, x0 + bw + 20, y - 8 + bh / 2 + fs * 0.35);
    });
    g.textAlign = "center";
    g.fillStyle = C("--muted");
    g.font = '400 28px "Familjen Grotesk", system-ui, sans-serif';
    g.fillText("Simulation de ressemblance · analyse sur l'appareil · pas un test de parenté", W / 2, H - 50);
    mentions.forEach(([col, font, text], k) => {
      g.fillStyle = C(col);
      g.font = `${font} "Familjen Grotesk", system-ui, sans-serif`;
      g.fillText(text, W / 2, H - 95 - (mentions.length - 1 - k) * 44);
    });
    return c;
  }
  async function openShare() {
    const c = shareCard(), url = c.toDataURL("image/jpeg", 0.9);
    $("#shareImg").src = url;
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.9));
    const file = new File([blob], "air-de-famille.jpg", { type: "image/jpeg" });
    let canShare = false;
    try {
      canShare = !!navigator.canShare?.({ files: [file] });
    } catch {
      canShare = false;
    }
    $("#shareGo").hidden = !canShare;
    $("#shareHint").textContent = canShare ? "" : "Appui long sur l'image pour l'enregistrer ou la partager.";
    $("#shareGo").onclick = async () => {
      try {
        await navigator.share({ files: [file], title: "Air de famille", text: summaryText() });
      } catch (e) {
        if (e.name !== "AbortError") toast("Partage impossible ici : appui long sur l'image pour l'enregistrer.");
      }
    };
    openDialog($("#shareSheet"));
  }
  function initResults() {
    $("#tabs").addEventListener("click", (e) => {
      const t = e.target.closest(".tab");
      if (t) selectPair(t.dataset.k, true);
    });
    $("#tabs").addEventListener("keydown", (e) => {
      const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      const tabs = $$("#tabs .tab"), n = tabs.findIndex((t) => t.dataset.k === activePair);
      selectPair(tabs[(n + d + tabs.length) % tabs.length].dataset.k, true);
    });
    $("#refSel").addEventListener("change", (e) => {
      refIdx = +e.target.value;
      renderResults();
    });
    $("#scoreCard").addEventListener("click", (e) => {
      if (e.target.closest("#copyBtn")) copySummary();
      if (e.target.closest("#shareBtn")) openShare();
      const ab = e.target.closest("[data-age]");
      if (ab) {
        const inp = $(`#age${ab.dataset.age}`);
        inp.scrollIntoView({ block: "center" });
        inp.focus();
      }
    });
    on("theme", () => {
      slots.forEach(renderSlot);
      renderResults();
    });
  }

  // src/js/ui/album.js
  var STORE = "adf.people.v1";
  var album = { faces: [], people: {}, remember: false };
  var seq = 0;
  var selectedCell = null;
  var baseView = { on: false };
  function setBaseView(v) {
    baseView = v;
    render();
  }
  var keyOf = (name) => name.trim().replace(/\s+/g, " ").toLowerCase();
  var personOf = (f) => f.person ? album.people[keyOf(f.person)] : null;
  var birthOf = (name) => name ? album.people[keyOf(name)]?.birth || null : null;
  function ageOf2(f) {
    const birth = personOf(f)?.birth;
    const fromDates = birth && f.date ? yearsBetween(birth, f.date) : null;
    if (fromDates != null) return { age: fromDates, src: "dates" };
    if (f.typed != null) return { age: f.typed, src: "saisi" };
    return { age: f.det.age, src: "estimé" };
  }
  var record2 = (f) => {
    const a = ageOf2(f);
    return { key: `a${f.id}:${f.det.id}`, det: f.det, age: a.src === "estimé" ? null : a.age };
  };
  function loadPeople() {
    try {
      const raw = localStorage.getItem(STORE);
      if (!raw) return;
      const saved = JSON.parse(raw);
      album.remember = true;
      for (const p of saved) album.people[keyOf(p.name)] = { name: p.name, birth: p.birth || "" };
    } catch {
    }
  }
  function savePeople() {
    try {
      if (!album.remember) {
        localStorage.removeItem(STORE);
        return;
      }
      localStorage.setItem(
        STORE,
        JSON.stringify(
          Object.values(album.people).filter((p) => p.birth).map(({ name, birth }) => ({ name, birth }))
        )
      );
    } catch {
    }
  }
  async function addFiles(files) {
    if (!engine.ready) {
      toast("Le moteur d'analyse se charge encore, réessayez dans un instant.");
      return;
    }
    const list = [...files].filter((f) => f.type.startsWith("image/"));
    let done = 0, found = 0;
    const status = () => {
      $("#albumStatus").textContent = done < list.length ? `Analyse ${done + 1} sur ${list.length}…` : "";
    };
    status();
    for (const file of list) {
      await enqueue(async () => {
        try {
          const [canvas, date] = await Promise.all([decodeImage(file), exifDate(file)]);
          const { work: work2, faces } = await findFaces(canvas);
          for (let n = 0; n < faces.length; n++) {
            const det = await describe(work2, faces[n], canvas);
            album.faces.push(cropEntry(canvas, det, { date: date ? date.slice(0, 7) : "", src: file.name, n: n + 1, of: faces.length }));
            found++;
          }
          if (!faces.length) toast(`Aucun visage trouvé dans « ${file.name} ».`);
        } catch (err) {
          console.error(err);
          toast(`« ${file.name} » n'a pas pu être ouverte.`);
        }
        done++;
        status();
        suggestAll();
        render();
      });
    }
    if (found) toast(`${found} visage${found > 1 ? "s" : ""} ajouté${found > 1 ? "s" : ""} à l'album.`);
  }
  function cropEntry(canvas, det, meta) {
    const b = det.box, side = Math.max(b.width, b.height) * 2.2;
    const ox = Math.max(0, b.x + b.width / 2 - side / 2), oy = Math.max(0, b.y + b.height / 2 - side / 2);
    const w = Math.min(canvas.width - ox, side), h = Math.min(canvas.height - oy, side), k = Math.min(1, 512 / Math.max(w, h));
    const crop = makeCanvas(w * k, h * k), g = ctx2d(crop);
    g.imageSmoothingQuality = "high";
    g.drawImage(canvas, ox, oy, w, h, 0, 0, crop.width, crop.height);
    return { id: ++seq, crop, det: shiftDet(det, ox, oy, k), person: "", typed: null, ...meta, suggestion: null };
  }
  function suggestAll() {
    const named = album.faces.filter((f) => f.person);
    for (const f of album.faces) {
      f.suggestion = null;
      if (f.person || !named.length) continue;
      let best = null, bestIa = 0;
      for (const g of named) {
        const ia = 100 / (1 + Math.exp((faceapi.euclideanDistance(f.det.desc, g.det.desc) - 0.55) / 0.07));
        if (ia > bestIa) {
          bestIa = ia;
          best = g;
        }
      }
      if (best && bestIa >= 70) f.suggestion = best.person;
    }
  }
  function people() {
    const map = /* @__PURE__ */ new Map();
    for (const f of album.faces) {
      if (!f.person) continue;
      const k = keyOf(f.person);
      if (!album.people[k]) album.people[k] = { name: f.person.trim(), birth: "" };
      if (!map.has(k)) map.set(k, { key: k, name: album.people[k].name, faces: [] });
      map.get(k).faces.push(f);
    }
    return [...map.values()];
  }
  function pairScore(P, Q) {
    const all = [];
    for (const f of P.faces)
      for (const g of Q.faces) {
        const af = ageOf2(f), ag = ageOf2(g);
        all.push({ f, g, af, ag, gap: Math.abs(af.age - ag.age) });
      }
    all.sort((x, y) => x.gap - y.gap);
    const minGap = all[0].gap;
    const chosen = all.filter((p) => p.gap <= minGap + 2).slice(0, 3);
    for (const p of chosen) p.R = compare(record2(p.f), record2(p.g));
    return {
      chosen,
      score: mean(chosen.map((p) => p.R.total)),
      gap: mean(chosen.map((p) => p.gap)),
      estimated: chosen.some((p) => p.af.src === "estimé" || p.ag.src === "estimé")
    };
  }
  function render() {
    const n = album.faces.length;
    $("#albumCount").hidden = !n;
    $("#albumCount").textContent = n;
    $("#albumEmpty").hidden = !!n;
    $("#albumClear").hidden = !n;
    renderGrid();
    renderPeople();
    renderMatrix();
    emit2("faces");
  }
  function renderGrid() {
    const grid = $("#albumGrid");
    const seen = /* @__PURE__ */ new Set();
    for (const f of album.faces) {
      seen.add(String(f.id));
      let card = grid.querySelector(`[data-id="${f.id}"]`);
      if (!card) {
        card = faceCard(f);
        grid.appendChild(card);
      }
      updateCard(card, f);
    }
    $$(".aface", grid).forEach((c) => {
      if (!seen.has(c.dataset.id)) c.remove();
    });
  }
  function faceCard(f) {
    const card = document.createElement("div");
    card.className = "aface";
    card.dataset.id = f.id;
    const c = makeCanvas(160, 160), g = c.getContext("2d"), b = f.det.box, sw = Math.max(b.width, b.height) * 1.5;
    g.drawImage(f.crop, b.x + b.width / 2 - sw / 2, b.y + b.height / 2 - sw / 2 - b.height * 0.05, sw, sw, 0, 0, 160, 160);
    c.setAttribute("role", "img");
    c.setAttribute("aria-label", `Visage ${f.n} de ${f.src}`);
    card.innerHTML = `
    <button class="x" type="button" aria-label="Retirer ce visage de l'album">✕</button>
    <input class="who" type="text" list="peopleList" placeholder="Qui est-ce ?" aria-label="Prénom" maxlength="24" autocomplete="off">
    <div class="when-row"><label>Photo du<input class="when" type="month" aria-label="Mois de la photo"></label><label>ou âge<input class="typed" type="text" inputmode="decimal" placeholder="4 mois" aria-label="Âge sur la photo"></label></div>
    <div class="aage"></div>
    <div class="meta src"></div>`;
    card.prepend(c);
    $(".who", card).value = f.person;
    $(".when", card).value = f.date;
    $(".src", card).textContent = f.of > 1 ? `Visage ${f.n}/${f.of} · ${f.src}` : f.src;
    $(".who", card).addEventListener("change", (e) => {
      if (f.baseRef) {
        e.target.value = f.person;
        return;
      }
      f.person = e.target.value.trim();
      afterEdit();
    });
    $(".typed", card).addEventListener("change", (e) => {
      f.typed = parseAge(e.target.value);
      if (e.target.value.trim() && f.typed == null) toast("Âge non compris : écrivez par exemple 10, 10,5 ou 4 mois.");
      afterEdit();
    });
    $(".when", card).addEventListener("change", (e) => {
      f.date = e.target.value;
      afterEdit();
    });
    $(".x", card).addEventListener("click", () => {
      album.faces = album.faces.filter((x) => x !== f);
      selectedCell = null;
      suggestAll();
      render();
      if (f.baseRef) toast("Retirée de l'album. Elle reste dans votre base (« Gérer ma base » pour la supprimer).");
    });
    card.addEventListener("click", (e) => {
      if (e.target.closest(".bkeep")) return emit2("base-save", [f]);
      const s = e.target.closest(".sugg");
      if (!s) return;
      f.person = f.suggestion;
      $(".who", card).value = f.person;
      afterEdit();
    });
    return card;
  }
  function updateCard(card, f) {
    card.classList.toggle("untagged", !f.person);
    const a = ageOf2(f);
    const age = $(".aage", card);
    age.textContent = a.src === "estimé" ? `Âge estimé ≈ ${ageLabel(a.age, true)}` : `${ageLabel(a.age)} sur la photo${a.src === "dates" ? " (calculé)" : ""}`;
    age.classList.toggle("est", a.src === "estimé");
    let sug = $(".sugg", card);
    if (f.suggestion && !f.person) {
      if (!sug) {
        sug = document.createElement("button");
        sug.type = "button";
        sug.className = "sugg";
        $(".aage", card).before(sug);
      }
      sug.textContent = `C'est ${f.suggestion} ?`;
    } else sug?.remove();
    const who = $(".who", card);
    who.readOnly = !!f.baseRef;
    if (f.baseRef) {
      who.value = f.person;
      who.title = "Photo gardée dans votre base sous ce prénom : supprimez-la de la base pour la renommer.";
      who.setAttribute("aria-describedby", "lockedHint");
    } else {
      who.removeAttribute("title");
      who.removeAttribute("aria-describedby");
    }
    let bk = $(".bstate", card);
    const want = baseView.on ? f.baseRef ? "in" : f.person ? "keep" : "" : "";
    if (!want) bk?.remove();
    else {
      if (!bk || bk.dataset.s !== want) {
        bk?.remove();
        bk = document.createElement(want === "keep" ? "button" : "span");
        bk.className = `bstate${want === "keep" ? " bkeep btn small" : " chip ok"}`;
        bk.dataset.s = want;
        if (want === "keep") bk.type = "button";
        $(".meta.src", card).before(bk);
      }
      bk.textContent = want === "keep" ? "Garder dans ma base" : "Dans ma base";
      if (want === "keep") bk.setAttribute("aria-label", `Garder dans ma base : photo de ${f.person}`);
    }
  }
  function afterEdit() {
    selectedCell = null;
    suggestAll();
    render();
    refreshAutoAges();
  }
  function renderPeople() {
    const ps = people();
    const known = new Set(ps.map((p) => p.key));
    const extra = Object.entries(album.people).filter(([k, p]) => !known.has(k) && p.birth).map(([k, p]) => ({ key: k, name: p.name, faces: [] }));
    const rows = ps.concat(extra);
    $("#peopleCard").hidden = !rows.length;
    $("#peopleList").innerHTML = Object.values(album.people).map((p) => `<option value="${esc(p.name)}">`).join("");
    const box = $("#people");
    box.innerHTML = rows.map((p) => {
      const ages = p.faces.map((f) => ageOf2(f).age).sort((x, y) => x - y);
      const info = !ages.length ? '<button type="button" class="btn small" data-forget>Oublier</button>' : `${p.faces.length} photo${p.faces.length > 1 ? "s" : ""} · ${ages.length > 1 ? `${ageLabel(ages[0])} → ${ageLabel(ages[ages.length - 1])}` : ageLabel(ages[0])}`;
      return `<div class="person" data-k="${esc(p.key)}"><span class="pn">${esc(p.name)}</span>
      <label class="hint">Né(e) le <input type="date" value="${esc(album.people[p.key].birth || "")}" aria-label="Date de naissance de ${esc(p.name)}"></label>
      <span class="pc">${info}</span></div>`;
    }).join("");
    $$(".person input", box).forEach(
      (inp) => inp.addEventListener("change", (e) => {
        const k = e.target.closest(".person").dataset.k;
        album.people[k].birth = e.target.value;
        savePeople();
        for (const f of album.faces) if (f.person && keyOf(f.person) === k) f.det = requalify(f.det, ageOf2(f).age);
        render();
        refreshAutoAges();
      })
    );
    $$("[data-forget]", box).forEach(
      (btn) => btn.addEventListener("click", (e) => {
        delete album.people[e.target.closest(".person").dataset.k];
        savePeople();
        render();
        refreshAutoAges();
      })
    );
    $("#rememberPeople").checked = album.remember;
  }
  function renderMatrix() {
    const ps = people();
    $("#albumResults").hidden = ps.length < 2;
    if (ps.length < 2) return;
    const S = {};
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) S[`${i}-${j}`] = S[`${j}-${i}`] = pairScore(ps[i], ps[j]);
    const head = `<thead><tr><th></th>${ps.map((p) => `<th scope="col" title="${esc(p.name)}">${esc(p.name)}</th>`).join("")}</tr></thead>`;
    const body = ps.map(
      (p, i) => `<tr><th scope="row">${esc(p.name)}</th>${ps.map((q, j) => {
        if (i === j) return '<td><div class="cell self" aria-hidden="true">—</div></td>';
        const r = S[`${i}-${j}`], ng = r.gap > NO_GLOBAL_GAP, v = Math.round(r.score), pct = ng ? 0 : Math.round(Math.max(0, Math.min(100, v)) * 0.85);
        const far = r.gap > 20, key = `${Math.min(i, j)}-${Math.max(i, j)}`;
        return `<td><button type="button" class="cell${pct > 50 ? " dark" : ""}${far ? " far" : ""}" data-css="--p:${pct}%" data-k="${key}" aria-pressed="${selectedCell === key}"
      ><span class="sr-only">${esc(p.name)} et ${esc(q.name)} : </span>${ng ? `<b aria-hidden="true">—</b><span class="sr-only">pas de score, photos d'âges trop éloignés,</span>` : `<b>${v}</b><span class="sr-only"> %,</span>`}<small><span aria-hidden="true">Δ</span><span class="sr-only">écart d'âge</span> ${Math.round(r.gap)} an${Math.round(r.gap) > 1 ? "s" : ""}</small></button></td>`;
      }).join("")}</tr>`
    ).join("");
    $("#matrix").innerHTML = head + `<tbody>${body}</tbody>`;
    $("#nearest").innerHTML = ps.map((p, i) => {
      let best = null;
      ps.forEach((q, j) => {
        const r = S[`${i}-${j}`];
        if (i !== j && r.gap <= NO_GLOBAL_GAP && (!best || r.score > best.r.score)) best = { q, r };
      });
      if (!best) return `<li><strong>${esc(p.name)}</strong> : pas de comparaison possible, photos d'âges trop éloignés (plus de ${NO_GLOBAL_GAP} ans d'écart). Ajoutez des photos d'âges proches.</li>`;
      const note = best.r.gap > 20 ? " — écart d'âge important : ajoutez des photos d'âges proches" : "";
      return `<li><strong>${esc(p.name)}</strong> ressemble le plus à <strong>${esc(best.q.name)}</strong> (${Math.round(best.r.score)} %, photos à ${Math.round(best.r.gap)} an${Math.round(best.r.gap) > 1 ? "s" : ""} d'écart)${note}</li>`;
    }).join("");
    const estimated = Object.values(S).some((r) => r.estimated);
    $("#albumHint").hidden = !estimated;
    renderPairDetail(ps, S);
  }
  function renderPairDetail(ps, S) {
    const box = $("#pairDetail");
    if (!selectedCell || !S[selectedCell]) {
      box.innerHTML = "";
      return;
    }
    const [i, j] = selectedCell.split("-").map(Number), r = S[selectedCell];
    const items = r.chosen.map(
      (p, n) => `<div class="pair" data-n="${n}"><canvas data-side="f"></canvas><canvas data-side="g"></canvas>
      <div class="pv"><b>${p.gap > NO_GLOBAL_GAP ? "Pas de score" : `${Math.round(p.R.total)} %`}</b><br>${esc(ps[i].name)} ${ageLabel(p.af.age, p.af.src === "estimé")}${p.af.src === "estimé" ? " (est.)" : ""}<br>${esc(ps[j].name)} ${ageLabel(p.ag.age, p.ag.src === "estimé")}${p.ag.src === "estimé" ? " (est.)" : ""}</div></div>`
    ).join("");
    box.innerHTML = `<h3 data-css="margin-top:14px">${esc(ps[i].name)} et ${esc(ps[j].name)} : photos comparées</h3><div class="pairs" data-css="margin-top:8px">${items}</div>
    <div class="actions" data-css="margin-top:10px"><button type="button" class="btn" id="pairOpen">Voir le détail trait par trait</button></div>`;
    r.chosen.forEach((p, n) => {
      const row = box.querySelector(`.pair[data-n="${n}"]`);
      for (const [side, f] of [
        ["f", p.f],
        ["g", p.g]
      ]) {
        const c = row.querySelector(`canvas[data-side="${side}"]`), b = f.det.box, sw = Math.max(b.width, b.height) * 1.5;
        c.width = c.height = 128;
        c.getContext("2d").drawImage(f.crop, b.x + b.width / 2 - sw / 2, b.y + b.height / 2 - sw / 2, sw, sw, 0, 0, 128, 128);
      }
    });
    $("#pairOpen").addEventListener("click", () => {
      const best = r.chosen[0];
      const to = (s, f) => putCanvas(s, f.crop, { name: f.person, age: ageOf2(f).src === "estimé" ? null : ageOf2(f).age, det: f.det });
      to(slots[0], best.f);
      to(slots[1], best.g);
      if (slots[2].canvas) emit2("clear-slot", 2);
      emit2("mode", "comparer");
    });
  }
  var albumSources = () => album.faces.map((f) => {
    const a = ageOf2(f);
    return {
      id: `a${f.id}`,
      label: `Album · ${f.person || `visage ${f.id}`} (${a.src === "estimé" ? "≈ " : ""}${ageLabel(a.age, a.src === "estimé")})`,
      canvas: f.crop,
      det: f.det,
      age: a.src === "estimé" ? null : a.age,
      name: f.person
    };
  });
  function albumFace(canvas, det, meta) {
    album.faces.push(cropEntry(canvas, det, meta));
  }
  function albumRefresh() {
    selectedCell = null;
    suggestAll();
    render();
    refreshAutoAges();
  }
  function addAlbumFiles(files) {
    return addFiles(files);
  }
  function restoreAlbum(faces) {
    album.faces = faces;
    suggestAll();
    render();
  }
  function clearAlbum() {
    album.faces = [];
    selectedCell = null;
    render();
  }
  function initAlbum() {
    loadPeople();
    $("#albumAdd").addEventListener("click", () => $("#albumFile").click());
    $("#albumFile").addEventListener("change", (e) => {
      addFiles(e.target.files);
      e.target.value = "";
    });
    $("#albumClear").addEventListener("click", () => {
      const backup = album.faces;
      clearAlbum();
      toast("Album vidé.", {
        label: "Annuler",
        run: () => {
          album.faces = backup;
          render();
        }
      });
    });
    $("#rememberPeople").addEventListener("change", (e) => {
      album.remember = e.target.checked;
      savePeople();
      toast(album.remember ? "Prénoms et dates de naissance mémorisés sur cet appareil." : "Plus rien n'est mémorisé sur cet appareil.");
    });
    $("#matrix").addEventListener("click", (e) => {
      const c = e.target.closest(".cell[data-k]");
      if (!c) return;
      selectedCell = selectedCell === c.dataset.k ? null : c.dataset.k;
      renderMatrix();
      $("#pairDetail").scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    });
    on("theme", render);
    render();
  }

  // src/js/store.js
  var NAME = "adf-base";
  var VERSION = 1;
  var dbp = null;
  var closedFn = null;
  var onBaseClosed = (fn) => closedFn = fn;
  function open(create = false) {
    if (dbp) return dbp;
    dbp = new Promise((ok, ko) => {
      let fresh = false;
      const r = indexedDB.open(NAME, VERSION);
      r.onupgradeneeded = () => {
        fresh = r.result.version === VERSION && !r.result.objectStoreNames.length;
        if (fresh && !create) {
          r.transaction.abort();
          return;
        }
        const db = r.result;
        if (!db.objectStoreNames.contains("items")) db.createObjectStore("items", { keyPath: "id", autoIncrement: true });
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
      };
      r.onsuccess = () => {
        const db = r.result;
        const lost = () => {
          try {
            db.close();
          } catch {
          }
          dbp = null;
          closedFn?.();
        };
        db.onversionchange = lost;
        db.onclose = lost;
        ok(db);
      };
      r.onerror = () => {
        dbp = null;
        if (fresh && !create) indexedDB.deleteDatabase(NAME);
        ko(r.error || new Error("base absente"));
      };
      r.onblocked = () => {
        dbp = null;
        ko(new Error("base bloquée par un autre onglet"));
      };
    });
    return dbp;
  }
  async function run(store, mode2, fn) {
    const db = await open();
    const t = db.transaction(store, mode2), s = t.objectStore(store);
    const out = fn(s);
    await new Promise((ok, ko) => {
      t.oncomplete = ok;
      t.onerror = () => ko(t.error);
      t.onabort = () => ko(t.error || new Error("transaction annulée"));
    });
    return out instanceof IDBRequest ? out.result : out;
  }
  async function baseExists() {
    if (!("indexedDB" in self)) return false;
    if (indexedDB.databases) {
      try {
        return (await indexedDB.databases()).some((d) => d.name === NAME);
      } catch {
      }
    }
    try {
      await open(false);
      return true;
    } catch {
      return false;
    }
  }
  async function createBase() {
    await open(true);
    if (!await getMeta("created")) await setMeta("created", (/* @__PURE__ */ new Date()).toISOString());
  }
  var getMeta = (key) => run("meta", "readonly", (s) => s.get(key));
  var setMeta = (key, value) => run("meta", "readwrite", (s) => s.put(value, key));
  var listItems = () => run("items", "readonly", (s) => s.getAll());
  var chan = typeof BroadcastChannel === "function" ? new BroadcastChannel("adf-base") : null;
  var notify = () => {
    try {
      chan?.postMessage("changed");
    } catch {
    }
  };
  var onBaseChanged = (fn) => chan && chan.addEventListener("message", () => fn());
  async function addItem(item) {
    const id = await run("items", "readwrite", (s) => s.add(item));
    notify();
    return id;
  }
  async function updateIfExists(item) {
    let found = false;
    await run("items", "readwrite", (s) => {
      const r = s.get(item.id);
      r.onsuccess = () => {
        if (r.result) {
          found = true;
          s.put(item);
        }
      };
    });
    if (found) notify();
    return found;
  }
  async function deleteIds(ids) {
    await run("items", "readwrite", (s) => {
      for (const id of ids) s.delete(id);
    });
    notify();
  }
  async function wipeBase() {
    if (dbp) {
      try {
        (await dbp).close();
      } catch {
      }
    }
    dbp = null;
    await new Promise((ok, ko) => {
      const r = indexedDB.deleteDatabase(NAME);
      r.onsuccess = ok;
      r.onerror = () => ko(r.error);
      r.onblocked = () => ko(new Error("bloquée"));
    });
  }
  async function askPersist() {
    try {
      if (await navigator.storage?.persisted?.()) return true;
      return !!await navigator.storage?.persist?.();
    } catch {
      return false;
    }
  }
  async function isPersisted() {
    try {
      return !!await navigator.storage?.persisted?.();
    } catch {
      return false;
    }
  }

  // src/js/ui/base.js
  var YEAR = 365 * 864e5;
  var ARM_MS = 1e4;
  var MIN_MS = 600;
  var base = { on: false, items: [], persisted: false, include: {}, loading: false, gen: 0, saving: false };
  var keyOf2 = (name) => name.trim().replace(/\s+/g, " ").toLowerCase();
  var say2 = (t) => {
    const s = $("#srStatus");
    if (s) s.textContent = t;
  };
  var count = (items = base.items) => {
    const people2 = new Set(items.map((i) => keyOf2(i.person))), iris = items.filter((i) => i.kind === "iris").length, faces = items.length - iris;
    return `${people2.size} personne${people2.size > 1 ? "s" : ""}, ${faces} photo${faces > 1 ? "s" : ""}${iris ? `, ${iris} iris` : ""}`;
  };
  var IRIS_EYE = { G: "œil gauche", D: "œil droit" };
  var countOf = (items) => {
    const iris = items.filter((i) => i.kind === "iris").length, faces = items.length - iris;
    return [faces ? `${faces} photo${faces > 1 ? "s" : ""}` : "", iris ? `${iris} iris` : ""].filter(Boolean).join(", ");
  };
  var months = (iso) => Math.max(1, Math.round((Date.now() - Date.parse(iso)) / (30.44 * 864e5)));
  function twoStep(btn, label, run4) {
    if (btn.dataset.armed) {
      if (Date.now() - Number(btn.dataset.at) < MIN_MS) return;
      clearTimeout(Number(btn.dataset.armed));
      disarm(btn);
      run4();
      return;
    }
    btn.dataset.text = btn.textContent;
    btn.dataset.aria = btn.getAttribute("aria-label") || "";
    btn.textContent = label.short || label.text;
    btn.setAttribute("aria-label", label.text);
    btn.dataset.at = String(Date.now());
    btn.classList.add("danger");
    say2(`${label.text} : appuyez de nouveau pour confirmer.`);
    btn.dataset.armed = String(setTimeout(() => disarm(btn), ARM_MS));
  }
  function disarm(btn) {
    delete btn.dataset.armed;
    delete btn.dataset.at;
    btn.textContent = btn.dataset.text;
    if (btn.dataset.aria) btn.setAttribute("aria-label", btn.dataset.aria);
    else btn.removeAttribute("aria-label");
    btn.classList.remove("danger");
  }
  var reloadSeq = 0;
  async function reload() {
    const my = ++reloadSeq;
    let items, include;
    try {
      items = base.on ? await listItems() : [];
      include = base.on ? await getMeta("include") || {} : {};
      if (my !== reloadSeq) return;
      base.items = items;
      base.include = include;
    } catch (e) {
      if (my !== reloadSeq) return;
      console.warn(e);
      base.on = false;
      base.items = [];
      base.include = {};
    }
    const refs = new Set(base.items.map((i) => i.ref));
    for (const f of album.faces) if (f.baseRef && !refs.has(f.baseRef)) delete f.baseRef;
    setBaseView({ on: base.on });
    renderCard();
    emit2("base");
  }
  var refreshBase = () => reload();
  function renderCard() {
    $("#baseOff").hidden = base.on;
    $("#baseOnBox").hidden = !base.on;
    if (!base.on) return;
    $("#baseInfo").textContent = base.items.length ? `Sur ce téléphone : ${count()}.` : "Votre base est vide : gardez des photos nommées de l'album, ou des iris depuis l'onglet Iris.";
    $("#basePersist").hidden = base.persisted;
    const pend = album.faces.filter((f) => f.person && !f.baseRef);
    $("#baseSaveAll").disabled = !pend.length;
    $("#baseSaveAll").textContent = pend.length ? `Garder les photos nommées (${pend.length})` : "Garder les photos nommées";
    $("#baseUse2").hidden = !base.items.length;
  }
  async function detect() {
    if (!await baseExists()) return;
    base.on = true;
    base.persisted = await isPersisted();
    await reload();
    if (!base.on || !base.items.length) return;
    let created = await getMeta("created");
    if (!created) await setMeta("created", created = (/* @__PURE__ */ new Date()).toISOString());
    const reminded = await getMeta("reminded") || created;
    const yearly = Date.now() - Date.parse(reminded) >= YEAR;
    $("#baseBarTxt").textContent = yearly ? `Votre base contient ${countOf(base.items)} depuis ${months(created)} mois : garder ou supprimer ?` : `Base trouvée sur ce téléphone : ${count()}.`;
    $("#baseKeep").hidden = !yearly;
    $("#baseUse").hidden = yearly;
    $("#baseBar").hidden = false;
  }
  async function enable() {
    try {
      await createBase();
    } catch (e) {
      console.error(e);
      toast("Ce navigateur refuse le stockage local (navigation privée ?). La base n'est pas disponible.");
      return;
    }
    base.on = true;
    base.persisted = await askPersist();
    await reload();
    toast(base.persisted ? "Base activée sur ce téléphone." : "Base activée. Le navigateur pourra l'effacer s'il manque de place.");
    $("#baseSaveAll").focus();
  }
  async function wipe() {
    base.gen++;
    try {
      await wipeBase();
    } catch (e) {
      console.error(e);
      toast("La suppression n'a pas abouti : fermez les autres onglets de l'application puis réessayez.");
      return;
    }
    base.on = false;
    base.items = [];
    base.include = {};
    for (const f of album.faces) delete f.baseRef;
    $("#baseBar").hidden = true;
    closeDialog();
    await reload();
    albumRefresh();
    toast("Base supprimée de ce téléphone.");
    emit2("mode", "album");
    $("#baseEnable").focus();
  }
  var MASK = { cy: 0.42, rx: 0.62, ry: 0.72 };
  async function maskedCrop(f) {
    const src = f.crop, c = makeCanvas(src.width, src.height), g = c.getContext("2d"), b = f.det.box;
    g.fillStyle = "#808080";
    g.fillRect(0, 0, c.width, c.height);
    g.save();
    g.beginPath();
    g.ellipse(b.x + b.width / 2, b.y + b.height * MASK.cy, b.width * MASK.rx, b.height * MASK.ry, 0, 0, Math.PI * 2);
    g.clip();
    g.drawImage(src, 0, 0);
    g.restore();
    let others = [];
    try {
      others = (await findFaces(src)).faces.map((d) => d.detection.box).filter((o) => Math.hypot(o.x + o.width / 2 - b.x - b.width / 2, o.y + o.height / 2 - b.y - b.height / 2) > Math.max(b.width, b.height) * 0.35);
    } catch (e) {
      console.warn(e);
    }
    if (others.length) {
      g.save();
      g.beginPath();
      g.rect(0, 0, c.width, c.height);
      g.rect(b.x, b.y, b.width, b.height);
      g.clip("evenodd");
      for (const o of others) g.fillRect(o.x - o.width * 0.15, o.y - o.height * 0.25, o.width * 1.3, o.height * 1.4);
      g.restore();
    }
    return c;
  }
  var pending2 = [];
  function askConsent(faces) {
    if (base.saving) return;
    pending2 = faces.filter((f) => f.person && !f.baseRef).map((f) => ({ f, person: f.person.trim() }));
    if (!pending2.length) {
      toast("Nommez d'abord la personne (« Qui est-ce ? ») pour la garder dans la base.");
      return;
    }
    const names = [...new Map(pending2.map((p) => [keyOf2(p.person), p.person])).values()];
    $("#consentList").innerHTML = names.map((n, k) => `<label class="check"><input type="checkbox" data-k="${esc(keyOf2(n))}"${k ? "" : " data-autofocus"}> J'ai l'accord de <strong>${esc(n)}</strong> (pour un enfant : de ses parents) pour garder ses photos sur ce téléphone.</label>`).join("");
    $("#consentGo").disabled = true;
    $("#consentCount").textContent = `${pending2.length} photo${pending2.length > 1 ? "s" : ""} à garder.`;
    openDialog($("#consentSheet"));
  }
  async function saveConsented() {
    if (base.saving) return;
    base.saving = true;
    const ok = new Set($$("#consentList input:checked").map((i) => i.dataset.k));
    const todo = pending2.filter((p) => ok.has(keyOf2(p.person)) && !p.f.baseRef);
    pending2 = [];
    closeDialog();
    let n = 0;
    try {
      for (const { f, person } of todo) {
        const masked = await maskedCrop(f);
        const blob = await new Promise((r) => masked.toBlob(r, "image/jpeg", 0.9));
        if (!blob?.size) throw new Error("image vide");
        const ref = `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
        await addItem({ kind: "face", ref, person, date: f.date || "", typed: f.typed, added: (/* @__PURE__ */ new Date()).toISOString(), jpeg: blob });
        f.baseRef = ref;
        f.person = person;
        n++;
      }
    } catch (e) {
      console.error(e);
      toast("Une photo n'a pas pu être gardée (stockage plein ou base supprimée ?).");
    } finally {
      base.saving = false;
    }
    await reload();
    albumRefresh();
    if (n) toast(`${n} photo${n > 1 ? "s" : ""} gardée${n > 1 ? "s" : ""} dans la base.`);
    const first = todo.find((p) => p.f.baseRef);
    if (first) setTimeout(() => $(`#albumGrid [data-id="${first.f.id}"] .who`)?.focus(), 0);
  }
  async function useBase() {
    if (base.loading) return;
    base.loading = true;
    const st = $("#albumStatus");
    try {
      $("#baseBar").hidden = true;
      closeDialog();
      await reload();
      const loaded = new Set(album.faces.map((f) => f.baseRef).filter(Boolean));
      const todo = base.items.filter((i) => i.kind === "face" && base.include[keyOf2(i.person)] !== false && !loaded.has(i.ref));
      emit2("mode", "album");
      $("#albumAdd").focus();
      if (!todo.length) {
        toast(!base.items.length ? "La base est vide." : !base.items.some((i) => i.kind === "face") ? "Votre base ne contient que des iris : ouvrez l'onglet Iris, puis « Depuis ma base »." : "Rien de nouveau à charger depuis la base.");
        return;
      }
      const gen = base.gen;
      if (!engine.ready) st.textContent = "Chargement de la base : en attente du moteur d'analyse…";
      while (!engine.ready && !engine.failed && gen === base.gen) await new Promise((r) => setTimeout(r, 300));
      if (engine.failed) return toast("Moteur d'analyse indisponible : la base n'a pas pu être chargée.");
      let done = 0, lost = 0, added = 0;
      for (const it of todo) {
        await enqueue(async () => {
          if (gen !== base.gen || !base.items.some((i) => i.ref === it.ref)) return;
          st.textContent = `Base : photo ${done + 1} sur ${todo.length}…`;
          try {
            const bmp = await createImageBitmap(it.jpeg);
            const c = makeCanvas(bmp.width, bmp.height);
            c.getContext("2d").drawImage(bmp, 0, 0);
            const { work: work2, faces } = await findFaces(c);
            if (!faces.length || gen !== base.gen) lost++;
            else {
              const mid = (d) => Math.hypot(d.detection.box.x + d.detection.box.width / 2 - c.width / 2, d.detection.box.y + d.detection.box.height / 2 - c.height / 2);
              const det = await describe(work2, faces.reduce((a, b) => mid(b) < mid(a) ? b : a), c);
              if (gen !== base.gen || !base.items.some((i) => i.ref === it.ref)) return;
              albumFace(c, det, { date: it.date, src: "Ma base", n: 1, of: 1, person: it.person, typed: it.typed, baseRef: it.ref });
              added++;
            }
          } catch (e) {
            console.error(e);
            lost++;
          }
          done++;
          albumRefresh();
        });
      }
      if (gen === base.gen) toast(`${added} photo${added > 1 ? "s" : ""} chargée${added > 1 ? "s" : ""} depuis la base${lost ? ` ; ${lost} sans visage retrouvé` : ""}.`);
    } finally {
      st.textContent = "";
      base.loading = false;
    }
  }
  async function renderManage() {
    const groups = /* @__PURE__ */ new Map();
    for (const it of base.items) {
      const k = keyOf2(it.person);
      if (!groups.has(k)) groups.set(k, { name: it.person, items: [] });
      groups.get(k).items.push(it);
    }
    $("#manageInfo").textContent = base.items.length ? `${count()} sur ce téléphone. Désinstaller l'application ou effacer les données du site supprime aussi la base.` : "La base est vide.";
    const box = $("#manageList");
    box.innerHTML = [...groups].map(([k, g]) => `<div class="mperson" data-k="${esc(k)}">
      <div class="mhead"><strong>${esc(g.name)}</strong><span class="hint">${countOf(g.items)}</span>
        ${g.items.some((i) => i.kind === "face") ? `<label class="check"><input type="checkbox" class="minc"${base.include[k] === false ? "" : " checked"}> Charger ${esc(g.name)} dans l'album</label>` : ""}
        <button type="button" class="btn small mdelp">Supprimer ${esc(g.name)}</button></div>
      <div class="mthumbs">${g.items.map((it) => `<div class="mthumb" data-id="${it.id}"><canvas width="72" height="72" role="img" aria-label="${it.kind === "iris" ? `Iris de ${esc(g.name)}${IRIS_EYE[it.eye] ? `, ${IRIS_EYE[it.eye]}` : ""}` : `Photo de ${esc(g.name)}${it.date ? `, ${esc(it.date)}` : it.typed != null ? `, ${esc(ageLabel(it.typed))}` : ""}`}"></canvas><button type="button" class="x" aria-label="Supprimer ${it.kind === "iris" ? "cet iris" : "cette photo"} de ${esc(g.name)}">✕</button></div>`).join("")}</div></div>`).join("");
    for (const el3 of $$(".mthumb", box)) {
      const it = base.items.find((i) => String(i.id) === el3.dataset.id);
      try {
        const bmp = await createImageBitmap(it.jpeg), cv = $("canvas", el3), g = cv.getContext("2d"), s = Math.min(bmp.width, bmp.height);
        g.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, 72, 72);
      } catch {
      }
    }
    $("#manageUse").hidden = !base.items.length;
  }
  async function deleteFrom(ids, what, nextFocus) {
    let failed = false;
    try {
      await deleteIds(ids);
    } catch (e) {
      console.error(e);
      failed = true;
    }
    await reload();
    const left = new Set(base.items.map((i) => keyOf2(i.person)));
    let changed = false;
    for (const k of Object.keys(base.include)) if (!left.has(k)) {
      delete base.include[k];
      changed = true;
    }
    if (changed && base.on) await setMeta("include", base.include).catch(() => {
    });
    albumRefresh();
    await renderManage();
    toast(failed ? "La suppression n'a pas abouti." : `${what} supprimée${ids.length > 1 ? "s" : ""} de la base.`);
    (nextFocus && $(nextFocus) || $("#manageList .x") || $("#manageSheet [data-close]"))?.focus();
  }
  function initBase() {
    onBaseChanged(() => {
      if (!base.on) return;
      reload().then(() => {
        if (!$("#manageSheet").hidden) renderManage();
      }).catch(() => {
      });
    });
    onBaseClosed(() => {
      base.gen++;
      baseExists().then((yes) => {
        base.on = yes;
        if (!yes) {
          $("#baseBar").hidden = true;
          if (!$("#manageSheet").hidden || !$("#consentSheet").hidden) closeDialog();
          $("#manageList").innerHTML = "";
          pending2 = [];
        }
        return reload();
      }).then(() => albumRefresh()).catch((e) => console.warn(e));
    });
    $("#baseEnable").addEventListener("click", enable);
    $("#baseSaveAll").addEventListener("click", () => askConsent(album.faces));
    on("base-save", (faces) => askConsent(faces));
    $("#consentList").addEventListener("change", () => {
      $("#consentGo").disabled = !$$("#consentList input:checked").length;
    });
    $("#consentGo").addEventListener("click", saveConsented);
    for (const b of [$("#baseUse"), $("#baseUse2"), $("#manageUse")]) b.addEventListener("click", useBase);
    const manage = async () => {
      $("#baseBar").hidden = true;
      await reload();
      if (!base.on) return toast("Aucune base sur ce téléphone.");
      await renderManage();
      openDialog($("#manageSheet"));
    };
    for (const b of [$("#baseManage"), $("#baseManage2")]) b.addEventListener("click", manage);
    $("#baseKeep").addEventListener("click", async () => {
      await setMeta("reminded", (/* @__PURE__ */ new Date()).toISOString());
      $("#baseBar").hidden = true;
      toast("Base gardée. Prochain rappel dans un an.");
      $("#tab-comparer")?.focus();
    });
    const all = { text: "Confirmer : tout supprimer (toute la base)", short: "Confirmer : tout supprimer" };
    for (const b of [$("#baseBarWipe"), $("#baseWipe"), $("#manageWipe")]) b.addEventListener("click", (e) => twoStep(e.currentTarget, all, wipe));
    $("#manageList").addEventListener("click", (e) => {
      const x = e.target.closest(".mthumb .x"), p = e.target.closest(".mdelp");
      if (x) {
        const th = x.closest(".mthumb"), id = Number(th.dataset.id), who = th.closest(".mperson").querySelector("strong").textContent;
        const next = th.nextElementSibling || th.previousElementSibling;
        twoStep(x, { text: `Confirmer la suppression de ${x.getAttribute("aria-label").replace(/^Supprimer /, "")}`, short: "✕" }, () => deleteFrom([id], "Photo", next ? `.mthumb[data-id="${next.dataset.id}"] .x` : null));
      } else if (p) {
        const k = p.closest(".mperson").dataset.k;
        const ids = base.items.filter((i) => keyOf2(i.person) === k).map((i) => i.id);
        twoStep(p, { text: `Confirmer la suppression de ${p.textContent.replace(/^Supprimer /, "")}` }, () => deleteFrom(ids, "Photos"));
      }
    });
    $("#manageList").addEventListener("change", async (e) => {
      const c = e.target.closest(".minc");
      if (!c) return;
      base.include[c.closest(".mperson").dataset.k] = c.checked;
      await setMeta("include", base.include).catch(() => {
      });
    });
    on("faces", renderCard);
    renderCard();
    detect().catch((e) => console.error(e));
  }
  var baseState = () => ({ on: base.on, items: base.items.length, people: new Set(base.items.map((i) => keyOf2(i.person))).size, persisted: base.persisted, loading: base.loading });

  // src/js/ui/sources.js
  function faceSources() {
    const fromSlots = slots.filter((s) => s.status === "ok").map((s) => ({
      id: `s${s.i}`,
      label: `Photo ${LET[s.i]}${s.name ? ` · ${s.name}` : ""}${s.realAge != null ? ` (${ageLabel(s.realAge)})` : ""}`,
      canvas: s.canvas,
      det: s.det,
      age: s.realAge,
      name: slotName(s),
      slot: s.i
    }));
    return fromSlots.concat(albumSources());
  }
  var findSource = (id) => faceSources().find((f) => f.id === id) || null;

  // src/js/ui/aging.js
  var target = null;
  var last = null;
  var memo = "";
  function refresh2() {
    const src = faceSources();
    $("#agNoFace").hidden = !!src.length;
    $("#agPanel").hidden = !src.length;
    if (!src.length) {
      last = null;
      return;
    }
    const sid = fillSelect(
      $("#agSrc"),
      src.map((f) => ({ value: f.id, label: f.label }))
    );
    fillSelect(
      $("#agModel"),
      [{ value: "", label: "Aucun" }].concat(src.filter((f) => f.id !== sid).map((f) => ({ value: f.id, label: f.label })))
    );
    const s = findSource(sid), model = $("#agModel").value, sex = $("#agSex").value;
    const need = [
      s.age != null ? `<li class="ok">Âge réel connu : ${ageLabel(s.age)}</li>` : `<li class="miss">Indiquez l'âge réel (sinon l'âge estimé, ${ageLabel(s.det.age, true)}, est utilisé)</li>`,
      s.det.warn.includes("Visage tourné") ? '<li class="miss">Photo de face conseillée : ce visage est tourné</li>' : '<li class="ok">Visage de face</li>',
      sex ? '<li class="ok">Sexe précisé</li>' : `<li class="miss">Précisez le sexe si l'âge cible franchit la puberté</li>`,
      model ? `<li class="ok">Modèle familial choisi (un parent photographié à l'âge cible, comme le font les portraitistes)</li>` : "<li>Facultatif : un parent photographié à l'âge cible rend la forme adulte plus plausible</li>"
    ];
    $("#agNeed").innerHTML = need.join("");
    run2();
  }
  function run2() {
    if (target == null) return;
    const s = findSource($("#agSrc").value);
    if (!s) return;
    const modelSrc = $("#agModel").value ? findSource($("#agModel").value) : null;
    const w = +$("#agW").value / 100, sex = $("#agSex").value;
    const key = [s.id, s.det.id, s.age, target, sex, modelSrc?.det.id, w, cssVar("--sunk")].join("|");
    if (key === memo && last) return;
    memo = key;
    const r = ageSimulate(s, target, { sex, model: modelSrc?.det, w, bg: cssVar("--sunk") });
    last = { r, s };
    const draw2 = (id, c) => {
      const cv = $(id);
      cv.width = c.width;
      cv.height = c.height;
      cv.getContext("2d").drawImage(c, 0, 0);
    };
    draw2("#agBefore", r.head);
    draw2("#agAfter", r.out);
    $("#agCapA").textContent = `${s.name} · ${ageLabel(r.from, s.age == null)}${s.age == null ? " (estimé)" : ""}`;
    $("#agCapB").textContent = `Image simulée · ${ageLabel(r.to)}`;
    stamp($("#agAfter"));
    $("#agOut").hidden = false;
    $("#agUse").hidden = false;
  }
  function initAging() {
    $("#agTarget").addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      target = +b.dataset.age;
      $$("#agTarget button").forEach((x) => x.setAttribute("aria-pressed", x === b));
      run2();
    });
    ["agSrc", "agSex", "agModel"].forEach((id) => $(`#${id}`).addEventListener("change", refresh2));
    $("#agW").addEventListener("input", (e) => {
      $("#agWv").textContent = `${e.target.value} %`;
      run2();
    });
    $("#agUse").addEventListener("click", () => {
      if (!last) return;
      const { r, s } = last, c = makeCanvas(r.out.width * 2, r.out.height * 2), g = c.getContext("2d");
      g.imageSmoothingQuality = "high";
      g.drawImage(r.out, 0, 0, c.width, c.height);
      sendToSlot(c, { name: `${s.name} ${Math.round(r.to)} ans (simulé)`.slice(0, 24), age: r.to, simulated: true }, s.slot != null ? [s.slot] : []);
    });
    on("faces", refresh2);
    on("theme", () => {
      memo = "";
      refresh2();
    });
    refresh2();
  }

  // src/js/ui/fusion.js
  var prep = null;
  var prepKey = "";
  var renderKey = "";
  var result = null;
  var playing = 0;
  var reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  function refresh22() {
    const src = faceSources();
    const enough = src.length >= 2;
    $("#fuNoFace").hidden = enough;
    $("#fuPanel").hidden = !enough;
    if (!enough) {
      prep = null;
      return;
    }
    const opts = src.map((f) => ({ value: f.id, label: f.label }));
    const a = fillSelect($("#fuA"), opts);
    let b = fillSelect($("#fuB"), opts);
    if (b === a) {
      b = opts.find((o) => o.value !== a).value;
      $("#fuB").value = b;
    }
    render2();
  }
  function ensurePrep() {
    const A = findSource($("#fuA").value), B = findSource($("#fuB").value);
    if (!A || !B) return null;
    const key = [A.id, A.det.id, B.id, B.det.id, cssVar("--sunk")].join("|");
    if (key !== prepKey) {
      prep = prepareMorph(A, B, cssVar("--sunk"));
      prepKey = key;
      draw("#fuCa", vignetteCopy(prep.headA));
      draw("#fuCb", vignetteCopy(prep.headB));
      $("#fuCapA").textContent = A.name;
      $("#fuCapB").textContent = B.name;
      $("#fuNameA").textContent = A.name;
      $("#fuNameB").textContent = B.name;
    }
    return prep;
  }
  var vignetteCopy = (c) => {
    const o = makeCanvas(c.width, c.height);
    o.getContext("2d").drawImage(c, 0, 0);
    return vignette(o, cssVar("--sunk"));
  };
  var draw = (id, c) => {
    const cv = $(id);
    cv.width = c.width;
    cv.height = c.height;
    cv.getContext("2d").drawImage(c, 0, 0);
  };
  function compute(t, quick = false) {
    const p = ensurePrep();
    if (!p) return null;
    const m = morph(p, t);
    const ageA = p.A.age ?? p.A.det.age, ageB = p.B.age ?? p.B.det.age, from = ageA * (1 - t) + ageB * t;
    const target2 = $("#fuAge").value;
    let out = vignette(m.out, cssVar("--sunk")), age = from;
    if (target2 && !quick) {
      const det = { norm: m.norm, frame: HEAD_FRAME, age: from };
      out = vignette(ageSimulate({ canvas: m.out, det, age: from, head: m.out }, +target2, { bg: cssVar("--sunk") }).out, cssVar("--sunk"));
      age = +target2;
    }
    return { out, t, age, from, A: p.A, B: p.B };
  }
  function render2() {
    const t = +$("#fuT").value / 100;
    $("#fuTv").textContent = `${Math.round(t * 100)} %`;
    const A = findSource($("#fuA").value), B = findSource($("#fuB").value);
    const key = [A?.id, A?.det.id, A?.age, B?.id, B?.det.id, B?.age, t, $("#fuAge").value, cssVar("--sunk")].join("|");
    if (key === renderKey && result) {
      $("#fuCapA").textContent = A.name;
      $("#fuCapB").textContent = B.name;
      $("#fuNameA").textContent = A.name;
      $("#fuNameB").textContent = B.name;
      return;
    }
    renderKey = key;
    result = compute(t);
    if (!result) return;
    draw("#fuCm", result.out);
    stamp($("#fuCm"));
    $("#fuCapM").textContent = `Image simulée · ${Math.round((1 - t) * 100)} / ${Math.round(t * 100)}${$("#fuAge").value ? ` · ${ageLabel(result.age)}` : ""}`;
  }
  var renderSoon = debounce(render2, 60);
  function play() {
    if (playing) {
      stop();
      return;
    }
    if (reduceMotion()) {
      toast("Animation désactivée (réglage « réduire les animations » de l'appareil).");
      return;
    }
    $("#fuPlay").setAttribute("aria-pressed", "true");
    $("#fuPlay").textContent = "Arrêter";
    const t0 = performance.now();
    const step2 = (now) => {
      if (!playing) return;
      const t = 0.5 - 0.5 * Math.cos((now - t0) / 4e3 * 2 * Math.PI);
      const r = compute(t, true);
      if (r) {
        draw("#fuCm", r.out);
        stamp($("#fuCm"));
      }
      $("#fuTv").textContent = `${Math.round(t * 100)} %`;
      playing = requestAnimationFrame(step2);
    };
    playing = requestAnimationFrame(step2);
  }
  function stop() {
    cancelAnimationFrame(playing);
    playing = 0;
    $("#fuPlay").setAttribute("aria-pressed", "false");
    $("#fuPlay").textContent = "Animer le fondu";
    renderKey = "";
    render2();
  }
  function initFusion() {
    ["fuA", "fuB"].forEach(
      (id) => $(`#${id}`).addEventListener("change", () => {
        if ($("#fuA").value === $("#fuB").value) toast("Choisissez deux visages différents.");
        render2();
      })
    );
    $("#fuAge").addEventListener("change", render2);
    $("#fuT").addEventListener("input", () => {
      if (playing) stop();
      renderSoon();
    });
    $("#fuPlay").addEventListener("click", play);
    $("#fuEnfant").addEventListener("click", () => {
      if (playing) stop();
      $("#fuT").value = 50;
      $("#fuAge").value = "7";
      render2();
    });
    $("#fuUse").addEventListener("click", () => {
      if (!result) return;
      const c = makeCanvas(result.out.width * 2, result.out.height * 2), g = c.getContext("2d");
      g.imageSmoothingQuality = "high";
      g.drawImage(result.out, 0, 0, c.width, c.height);
      const name = `Fusion ${result.A.name.slice(0, 8)}+${result.B.name.slice(0, 8)}`.slice(0, 24);
      sendToSlot(
        c,
        { name, age: result.age, simulated: true },
        [result.A.slot, result.B.slot].filter((x) => x != null)
      );
    });
    on("faces", () => {
      if (!playing) refresh22();
    });
    on("theme", () => {
      prepKey = "";
      renderKey = "";
      refresh22();
    });
    on("mode", (m) => {
      if (m !== "fusion" && playing) stop();
    });
    refresh22();
  }

  // src/js/engine/iris/img.js
  var refl = (i, n) => {
    if (n === 1) return 0;
    while (i < 0 || i >= n) i = i < 0 ? -i : 2 * n - 2 - i;
    return i;
  };
  function gray(img) {
    const { width: w, height: h, data: d } = img, out = new Float32Array(w * h);
    for (let i = 0, j = 0; i < out.length; i++, j += 4) out[i] = 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2];
    return out;
  }
  function resize(img, nw, nh, win = null) {
    const { width: W, height: H, data: d } = img, out = new Uint8ClampedArray(nw * nh * 4);
    const sx0 = win ? win.x : 0, sy0 = win ? win.y : 0, sw = win ? win.w : W, sh = win ? win.h : H;
    const fx = sw / nw, fy = sh / nh;
    if (fx > 1 || fy > 1) {
      for (let y = 0; y < nh; y++) {
        const ya = sy0 + y * fy, yb = ya + fy;
        for (let x = 0; x < nw; x++) {
          const xa = sx0 + x * fx, xb = xa + fx;
          let r = 0, g = 0, b = 0, a = 0, n = 0;
          for (let yy = Math.floor(ya); yy < Math.ceil(yb); yy++) {
            const wy = Math.min(yb, yy + 1) - Math.max(ya, yy);
            if (wy <= 0) continue;
            for (let xx = Math.floor(xa); xx < Math.ceil(xb); xx++) {
              const wx = Math.min(xb, xx + 1) - Math.max(xa, xx);
              if (wx <= 0) continue;
              const ww = wx * wy;
              if (xx < 0 || yy < 0 || xx >= W || yy >= H) {
                r += 128 * ww;
                g += 128 * ww;
                b += 128 * ww;
                a += 255 * ww;
              } else {
                const j = (yy * W + xx) * 4;
                r += d[j] * ww;
                g += d[j + 1] * ww;
                b += d[j + 2] * ww;
                a += d[j + 3] * ww;
              }
              n += ww;
            }
          }
          const o = (y * nw + x) * 4;
          out[o] = r / n;
          out[o + 1] = g / n;
          out[o + 2] = b / n;
          out[o + 3] = a / n;
        }
      }
    } else {
      for (let y = 0; y < nh; y++)
        for (let x = 0; x < nw; x++) {
          const o = (y * nw + x) * 4, px = sx0 + (x + 0.5) * fx - 0.5, py = sy0 + (y + 0.5) * fy - 0.5;
          for (let c = 0; c < 4; c++) out[o + c] = sampleRGBA(img, px, py, c);
        }
    }
    return { width: nw, height: nh, data: out };
  }
  function sampleRGBA(img, x, y, c) {
    const { width: W, height: H, data: d } = img;
    if (x < -0.5 || y < -0.5 || x > W - 0.5 || y > H - 0.5) return c === 3 ? 255 : 128;
    const x0 = Math.max(0, Math.min(W - 1, Math.floor(x))), y0 = Math.max(0, Math.min(H - 1, Math.floor(y)));
    const x1 = Math.min(W - 1, x0 + 1), y1 = Math.min(H - 1, y0 + 1), ax = Math.max(0, Math.min(1, x - x0)), ay = Math.max(0, Math.min(1, y - y0));
    const p = (xx, yy) => d[(yy * W + xx) * 4 + c];
    return (p(x0, y0) * (1 - ax) + p(x1, y0) * ax) * (1 - ay) + (p(x0, y1) * (1 - ax) + p(x1, y1) * ax) * ay;
  }
  function sample(f, w, h, x, y, border = 0) {
    if (x < 0 || y < 0 || x > w - 1 || y > h - 1) return border;
    const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1), ax = x - x0, ay = y - y0;
    return (f[y0 * w + x0] * (1 - ax) + f[y0 * w + x1] * ax) * (1 - ay) + (f[y1 * w + x0] * (1 - ax) + f[y1 * w + x1] * ax) * ay;
  }
  function blur(f, w, h, sigma) {
    const k = Math.max(3, Math.round(sigma * 8 + 1) | 1), r = k >> 1, ker = new Float32Array(k);
    let s = 0;
    for (let i = 0; i < k; i++) s += ker[i] = Math.exp(-((i - r) ** 2) / (2 * sigma * sigma));
    for (let i = 0; i < k; i++) ker[i] /= s;
    const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        let a = 0;
        for (let i = 0; i < k; i++) a += ker[i] * f[row + refl(x + i - r, w)];
        tmp[row + x] = a;
      }
    }
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let a = 0;
        for (let i = 0; i < k; i++) a += ker[i] * tmp[refl(y + i - r, h) * w + x];
        out[y * w + x] = a;
      }
    return out;
  }
  function blur1d(a, sigma) {
    const n = a.length, k = Math.max(3, Math.round(sigma * 8 + 1) | 1), r = k >> 1, out = new Float32Array(n);
    let s = 0;
    const ker = [];
    for (let i = 0; i < k; i++) s += ker[i] = Math.exp(-((i - r) ** 2) / (2 * sigma * sigma));
    for (let x = 0; x < n; x++) {
      let v = 0;
      for (let i = 0; i < k; i++) v += ker[i] / s * a[refl(x + i - r, n)];
      out[x] = v;
    }
    return out;
  }
  function sobel(f, w, h) {
    const gx = new Float32Array(w * h), gy = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const ym = refl(y - 1, h) * w, y0 = y * w, yp = refl(y + 1, h) * w;
      for (let x = 0; x < w; x++) {
        const xm = refl(x - 1, w), xp = refl(x + 1, w);
        gx[y0 + x] = f[ym + xp] - f[ym + xm] + 2 * (f[y0 + xp] - f[y0 + xm]) + f[yp + xp] - f[yp + xm];
        gy[y0 + x] = f[yp + xm] - f[ym + xm] + 2 * (f[yp + x] - f[ym + x]) + f[yp + xp] - f[ym + xp];
      }
    }
    return { gx, gy };
  }
  var lin = (c) => (c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  var fl = (t) => t > 8856e-6 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  var LIN = new Float32Array(256).map((_, i) => lin(i));
  function lab(r, g, b) {
    const R = LIN[r | 0], G = LIN[g | 0], B = LIN[b | 0];
    const X = (0.412453 * R + 0.35758 * G + 0.180423 * B) / 0.950456, Y = 0.212671 * R + 0.71516 * G + 0.072169 * B, Z = (0.019334 * R + 0.119193 * G + 0.950227 * B) / 1.088754;
    const fx = fl(X), fy = fl(Y), fz = fl(Z), L = Y > 8856e-6 ? 116 * fy - 16 : 903.3 * Y;
    return [L * 2.55, 500 * (fx - fy) + 128, 200 * (fy - fz) + 128];
  }
  function clahe(f, w, h, clip, tx, ty) {
    const tw = Math.ceil(w / tx), th = Math.ceil(h / ty), area = tw * th, lim = Math.max(1, Math.floor(clip * area / 256));
    const luts = [];
    for (let j = 0; j < ty; j++)
      for (let i = 0; i < tx; i++) {
        const hist = new Int32Array(256);
        for (let y = j * th; y < (j + 1) * th; y++)
          for (let x = i * tw; x < (i + 1) * tw; x++) hist[Math.max(0, Math.min(255, Math.round(f[refl(y, h) * w + refl(x, w)])))]++;
        let ex = 0;
        for (let v = 0; v < 256; v++)
          if (hist[v] > lim) {
            ex += hist[v] - lim;
            hist[v] = lim;
          }
        const add = Math.floor(ex / 256), rest = ex - add * 256;
        for (let v = 0; v < 256; v++) hist[v] += add;
        if (rest) for (let v = 0, step2 = Math.max(1, Math.floor(256 / rest)), n = 0; v < 256 && n < rest; v += step2, n++) hist[v]++;
        const lut = new Float32Array(256);
        let c = 0;
        for (let v = 0; v < 256; v++) lut[v] = Math.min(255, Math.round((c += hist[v]) * 255 / area));
        luts.push(lut);
      }
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const gy = y / th - 0.5, j0 = Math.floor(gy), ay = gy - j0, ja = Math.max(0, j0), jb = Math.min(ty - 1, j0 + 1);
      for (let x = 0; x < w; x++) {
        const gx = x / tw - 0.5, i0 = Math.floor(gx), ax = gx - i0, ia = Math.max(0, i0), ib = Math.min(tx - 1, i0 + 1);
        const v = Math.max(0, Math.min(255, Math.round(f[y * w + x])));
        const top = luts[ja * tx + ia][v] * (1 - ax) + luts[ja * tx + ib][v] * ax, bot = luts[jb * tx + ia][v] * (1 - ax) + luts[jb * tx + ib][v] * ax;
        out[y * w + x] = Math.round(top * (1 - ay) + bot * ay);
      }
    }
    return out;
  }
  function minmax(m, w, h, r, isMax) {
    const t = new Uint8Array(w * h), o = new Uint8Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let v = isMax ? 0 : 1;
        for (let i = -r; i <= r; i++) {
          const xx = x + i;
          const p = xx < 0 || xx >= w ? isMax ? 0 : 1 : m[y * w + xx];
          if (isMax ? p : !p) {
            v = isMax ? 1 : 0;
            break;
          }
        }
        t[y * w + x] = v;
      }
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let v = isMax ? 0 : 1;
        for (let i = -r; i <= r; i++) {
          const yy = y + i;
          const p = yy < 0 || yy >= h ? isMax ? 0 : 1 : t[yy * w + x];
          if (isMax ? p : !p) {
            v = isMax ? 1 : 0;
            break;
          }
        }
        o[y * w + x] = v;
      }
    return o;
  }
  var openSquare = (m, w, h, k) => minmax(minmax(m, w, h, k >> 1, false), w, h, k >> 1, true);
  function dilateDisk(m, w, h, r) {
    const o = new Uint8Array(w * h), offs = [];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + r) offs.push([dx, dy]);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (!m[y * w + x]) continue;
        for (const [dx, dy] of offs) {
          const xx = x + dx, yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < w && yy < h) o[yy * w + xx] = 1;
        }
      }
    return o;
  }
  function components(m, w, h, wantLargest = false) {
    const lab2 = new Int32Array(w * h), stack = new Int32Array(w * h);
    let n = 0, best = { area: 0, cx: 0, cy: 0, minx: 0, miny: 0, maxx: 0, maxy: 0 };
    for (let s = 0; s < m.length; s++) {
      if (!m[s] || lab2[s]) continue;
      n++;
      let sp = 0, area = 0, sx = 0, sy = 0, minx = w, miny = h, maxx = 0, maxy = 0;
      stack[sp++] = s;
      lab2[s] = n;
      while (sp) {
        const p = stack[--sp], x = p % w, y = (p - x) / w;
        area++;
        sx += x;
        sy += y;
        if (wantLargest) {
          if (x < minx) minx = x;
          if (x > maxx) maxx = x;
          if (y < miny) miny = y;
          if (y > maxy) maxy = y;
        }
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx, yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            const q = yy * w + xx;
            if (m[q] && !lab2[q]) {
              lab2[q] = n;
              stack[sp++] = q;
            }
          }
      }
      if (wantLargest && area > best.area) best = { area, cx: sx / area, cy: sy / area, minx, miny, maxx, maxy };
    }
    return { n, best };
  }
  function inpaint(img, mask) {
    const { width: w, height: h } = img, d = new Uint8ClampedArray(img.data), known = new Uint8Array(w * h);
    for (let i = 0; i < known.length; i++) known[i] = mask[i] ? 0 : 1;
    let front = [];
    for (let i = 0; i < known.length; i++) if (!known[i]) front.push(i);
    let guard = 0;
    while (front.length && guard++ < 4e3) {
      const next = [], done = [];
      for (const p of front) {
        const x = p % w, y = (p - x) / w;
        let r = 0, g = 0, b = 0, n = 0;
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) {
            const xx = x + dx, yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            const q = yy * w + xx;
            if (!known[q]) continue;
            const wt = 1 / (dx * dx + dy * dy);
            r += d[q * 4] * wt;
            g += d[q * 4 + 1] * wt;
            b += d[q * 4 + 2] * wt;
            n += wt;
          }
        if (n) {
          d[p * 4] = r / n;
          d[p * 4 + 1] = g / n;
          d[p * 4 + 2] = b / n;
          done.push(p);
        } else next.push(p);
      }
      for (const p of done) known[p] = 1;
      if (!done.length) break;
      front = next;
    }
    return { width: w, height: h, data: d };
  }
  function fitCircle(pts, it = 5, tol = 2) {
    let p = pts, cx = 0, cy = 0, r = 0;
    for (let k = 0; k < it && p.length >= 3; k++) {
      let sxx = 0, sxy = 0, syy = 0, sx = 0, sy = 0, sxz = 0, syz = 0, sz = 0;
      const n = p.length;
      for (const [x, y] of p) {
        const z = x * x + y * y;
        sxx += x * x;
        sxy += x * y;
        syy += y * y;
        sx += x;
        sy += y;
        sxz += x * z;
        syz += y * z;
        sz += z;
      }
      const A = [[2 * sxx, 2 * sxy, sx], [2 * sxy, 2 * syy, sy], [2 * sx, 2 * sy, n]], B = [sxz, syz, sz];
      const s = solve3(A, B);
      if (!s) break;
      [cx, cy] = s;
      r = Math.sqrt(Math.max(s[2] + cx * cx + cy * cy, 1));
      const res = p.map(([x, y]) => Math.abs(Math.hypot(x - cx, y - cy) - r)), med = [...res].sort((a, b) => a - b)[res.length >> 1];
      p = p.filter((_, i) => res[i] < Math.max(tol * med, 1.5));
    }
    return { cx, cy, r, n: p.length };
  }
  function solve3(A, B) {
    const m = A.map((row, i) => [...row, B[i]]);
    for (let c = 0; c < 3; c++) {
      let piv = c;
      for (let r = c + 1; r < 3; r++) if (Math.abs(m[r][c]) > Math.abs(m[piv][c])) piv = r;
      if (Math.abs(m[piv][c]) < 1e-9) return null;
      [m[c], m[piv]] = [m[piv], m[c]];
      for (let r = 0; r < 3; r++) {
        if (r === c) continue;
        const f = m[r][c] / m[c][c];
        for (let k = c; k < 4; k++) m[r][k] -= f * m[c][k];
      }
    }
    return [m[0][3] / m[0][0], m[1][3] / m[1][1], m[2][3] / m[2][2]];
  }
  var medianOf = (a) => {
    const s = Float64Array.from(a).sort();
    return s.length ? s[s.length >> 1] : NaN;
  };

  // src/js/engine/iris/segment.js
  var NA = 360;
  var WORK = 1e3;
  var yieldNow = () => new Promise((r) => setTimeout(r, 0));
  var ARC = (() => {
    const a = [];
    for (let d = -45; d <= 45; d += 4.5) a.push(d * Math.PI / 180, (180 + d) * Math.PI / 180);
    return a.map((t) => [Math.cos(t), Math.sin(t)]);
  })();
  function arcValues(f, w, h, cx, cy, rs) {
    return rs.map((r) => ARC.map(([c, s]) => {
      const x = cx + r * c, y = cy + r * s;
      return x < 0 || y < 0 || x > w - 1 || y > h - 1 ? NaN : sample(f, w, h, x, y);
    }));
  }
  function bestRadius(f, w, h, cx, cy, rs) {
    const M = arcValues(f, w, h, cx, cy, rs);
    let best = { score: -Infinity, r: 0 };
    for (let i = 2; i < rs.length - 2; i++) {
      const d = [];
      for (let a = 0; a < ARC.length; a++) {
        const v = (M[i + 1][a] + M[i + 2][a] - M[i - 1][a] - M[i - 2][a]) / 2;
        if (isFinite(v)) d.push(v);
      }
      if (d.length < ARC.length * 0.6) continue;
      d.sort((x, y) => x - y);
      const sc = d[Math.floor(d.length * 0.3)];
      if (sc > best.score) best = { score: sc, r: rs[i] };
    }
    return best;
  }
  function search(f, w, h, cxs, cys, rs) {
    let best = { score: -Infinity, cx: 0, cy: 0, r: 0 };
    for (const cy of cys)
      for (const cx of cxs) {
        const b = bestRadius(f, w, h, cx, cy, rs);
        if (b.score > best.score) best = { score: b.score, cx, cy, r: b.r };
      }
    return best;
  }
  var range = (a, b, s) => {
    const o = [];
    for (let v = a; v <= b + 1e-9; v += s) o.push(v);
    return o;
  };
  var radii = (r0, r1) => {
    const o = [];
    for (let r = r0; r <= r1; r += Math.max(1, r * 0.03)) o.push(r);
    return o;
  };
  function ringLum(f, w, h, cx, cy, r, a, b) {
    let s = 0, n = 0;
    for (let q = a; q <= b + 1e-9; q += (b - a) / 3)
      for (const [c, sn] of ARC) {
        const x = cx + q * r * c, y = cy + q * r * sn;
        if (x < 0 || y < 0 || x > w - 1 || y > h - 1) continue;
        s += sample(f, w, h, x, y);
        n++;
      }
    return n ? s / n : NaN;
  }
  function ringStat(f, w, h, cx, cy, r, a, b) {
    const v = [];
    let tot = 0;
    for (let q = a; q <= b + 1e-9; q += (b - a) / 3)
      for (let d = 0; d < 360; d += 15) {
        tot++;
        const t = d * Math.PI / 180, x = cx + q * r * Math.cos(t), y = cy + q * r * Math.sin(t);
        if (x < 0 || y < 0 || x > w - 1 || y > h - 1) continue;
        v.push(sample(f, w, h, x, y));
      }
    return v.length >= tot / 2 ? medianOf(v) : NaN;
  }
  function ringSd(f, w, h, cx, cy, r, a, b) {
    let s = 0, s2 = 0, n = 0;
    for (let q = a; q <= b + 1e-9; q += (b - a) / 5)
      for (const [c, sn] of ARC) {
        const x = cx + q * r * c, y = cy + q * r * sn;
        if (x < 0 || y < 0 || x > w - 1 || y > h - 1) continue;
        const v = sample(f, w, h, x, y);
        s += v;
        s2 += v * v;
        n++;
      }
    return n > 8 ? Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2)) : NaN;
  }
  async function daugman(g, cn, w, h) {
    const k = 384 / Math.max(w, h), sw = Math.round(w * k), sh = Math.round(h * k);
    const small = new Float32Array(sw * sh), smallC = new Float32Array(sw * sh);
    for (let y = 0; y < sh; y++)
      for (let x = 0; x < sw; x++) {
        const X = (x + 0.5) / k - 0.5, Y = (y + 0.5) / k - 0.5;
        small[y * sw + x] = sample(g, w, h, X, Y);
        smallC[y * sw + x] = sample(cn, w, h, X, Y);
      }
    const sb = blur(small, sw, sh, 1.2), sd = blur(small, sw, sh, 3), sl = blur(small, sw, sh, 9), cb = blur(smallC, sw, sh, 1.2), mn = Math.min(sw, sh);
    const mins = [];
    for (let y = 4; y < sh - 4; y += 2)
      for (let x = 4; x < sw - 4; x += 2) {
        const v = sd[y * sw + x];
        let isMin = true;
        for (let dy = -4; dy <= 4 && isMin; dy += 2) for (let dx = -4; dx <= 4; dx += 2) if ((dx || dy) && sd[(y + dy) * sw + x + dx] < v) {
          isMin = false;
          break;
        }
        if (isMin) mins.push([v, x, y, v - sl[y * sw + x]]);
      }
    const cand = [], take = (list, nmax) => {
      let n = 0;
      for (const m of list) {
        if (n >= nmax) break;
        if (cand.some((c) => Math.hypot(c[1] - m[1], c[2] - m[2]) < 8)) continue;
        cand.push(m);
        n++;
      }
    };
    take([...mins].sort((a, b) => a[0] - b[0]), 40);
    take([...mins].sort((a, b) => a[3] - b[3]), 30);
    const plausible = (c) => c.pl ??= plausible0(c);
    const plausible0 = (c) => {
      if (c.cx < c.r * 0.6 || c.cy < c.r * 0.6 || c.cx > sw - c.r * 0.6 || c.cy > sh - c.r * 0.6) return 0;
      const out = ringLum(sb, sw, sh, c.cx, c.cy, c.r, 1.1, 1.3), inn = ringLum(sb, sw, sh, c.cx, c.cy, c.r, 0.3, 0.8);
      const side = (sgn) => {
        let v = 0, ch = 0, n = 0;
        for (let q = 1.1; q <= 1.41; q += 0.1)
          for (let d = -30; d <= 30; d += 10) {
            const t = (sgn > 0 ? d : 180 + d) * Math.PI / 180, x = c.cx + q * c.r * Math.cos(t), y = c.cy + q * c.r * Math.sin(t);
            if (x < 0 || y < 0 || x > sw - 1 || y > sh - 1) continue;
            v += sample(sb, sw, sh, x, y);
            ch += sample(cb, sw, sh, x, y);
            n++;
          }
        return n >= 14 ? { L: v / n, C: ch / n } : null;
      };
      const skin = ringStat(cb, sw, sh, c.cx, c.cy, c.r, 2.5, 3.5), cmax = isFinite(skin) ? Math.max(0.12, skin * 0.6) : 0.22;
      const L = side(-1), R = side(1);
      const bright = (s) => s.L > inn + 8, sclera = (s) => bright(s) && s.C < cmax;
      const level2 = L && R ? sclera(L) && sclera(R) ? 3 : bright(L) && bright(R) ? 2 : 0 : !L && !R ? 1 : bright(L || R) ? 1 : 0;
      return out > inn + 15 ? level2 : 0;
    };
    const outer = (c) => {
      const off = Math.max(2, c.r * 0.6);
      const big = search(sb, sw, sh, range(c.cx - off, c.cx + off, Math.max(1, off / 3)), range(c.cy - off, c.cy + off, Math.max(1, off / 3)), radii(c.r * 1.6, Math.min(mn * 0.75, c.r * 7)));
      const lb = isFinite(big.score) && big.score > c.score * 0.4 ? plausible(big) : 0;
      const lc = plausible(c);
      if (!lb || lb === 1 && lc >= 2 || lb === 2 && lc === 3) return null;
      big.level = lb;
      const outSmall = ringLum(sb, sw, sh, c.cx, c.cy, c.r, 1.15, 1.4), outBig = ringLum(sb, sw, sh, big.cx, big.cy, big.r, 1.08, 1.25);
      const sdAnn = ringSd(small, sw, sh, big.cx, big.cy, big.r, Math.min(0.8, c.r * 1.3 / big.r), 0.85), sdOut = ringSd(small, sw, sh, big.cx, big.cy, big.r, 1.08, 1.3);
      return outSmall < outBig - 15 && sdAnn >= Math.max(4, 0.7 * sdOut) ? big : null;
    };
    const rs = radii(Math.max(4, mn * 0.025), mn * 0.62), found = [];
    for (let n = 0; n < cand.length; n++) {
      const [, x, y] = cand[n];
      found.push(search(sb, sw, sh, range(x - 4, x + 4, 2), range(y - 4, y + 4, 2), rs));
      if (n % 8 === 7) await yieldNow();
    }
    found.sort((a, b) => b.score - a.score);
    const picks = [];
    for (const c of found.slice(0, 24)) {
      if (!isFinite(c.score)) continue;
      let big = outer(c);
      for (let n = 0, b2; big && n < 2 && (b2 = outer(big)); n++) big = b2;
      const lc = big ? 0 : plausible(c), pick = big || (lc ? Object.assign(c, { level: lc }) : null);
      if (pick) picks.push(pick);
    }
    const smax = Math.max(-Infinity, ...picks.map((p) => p.score));
    let c1 = { score: -Infinity, level: 0 };
    const rank = (p) => p.level === 3 && p.score >= smax * 0.25 ? 1 : 0;
    for (const p of picks) if (rank(p) > rank(c1) || rank(p) === rank(c1) && p.score > c1.score) c1 = p;
    if (!isFinite(c1.score)) return { ix: NaN, iy: NaN, R0: NaN, contrast: 0 };
    await yieldNow();
    const r0 = c1.r / k, cx0 = c1.cx / k, cy0 = c1.cy / k, gb = blur(g, w, h, 1.5), st = Math.max(1, 1 / k / 2);
    const fine = search(gb, w, h, range(cx0 - 2 / k, cx0 + 2 / k, st), range(cy0 - 2 / k, cy0 + 2 / k, st), radii(Math.min(r0 * 0.92, r0 - 5), Math.max(r0 * 1.08, r0 + 5)));
    return { ix: fine.cx, iy: fine.cy, R0: fine.r, contrast: fine.score };
  }
  function pupilCircle(img, ix, iy, R, wl = 1, wc = 0) {
    const { width: W, height: H, data: D } = img, s = 60 / R, S = Math.ceil(R * 1.1 * s), N = 2 * S + 1, f = new Float32Array(N * N);
    const oob = new Uint8Array(N * N);
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const X0 = Math.round(ix + (x - S) / s), Y0 = Math.round(iy + (y - S) / s);
        if (X0 < 0 || Y0 < 0 || X0 >= W || Y0 >= H) oob[y * N + x] = 1;
        const X = Math.min(W - 1, Math.max(0, X0)), Y = Math.min(H - 1, Math.max(0, Y0)), o = (Y * W + X) * 4;
        const r = D[o], g = D[o + 1], b = D[o + 2];
        f[y * N + x] = wl * (0.299 * r + 0.587 * g + 0.114 * b) + wc * (Math.max(r, g, b) - Math.min(r, g, b));
      }
    const fb = blur(f, N, N, 1.2), r60 = 60;
    const lum = new Float32Array(N * N);
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const X = Math.min(W - 1, Math.max(0, Math.round(ix + (x - S) / s))), Y = Math.min(H - 1, Math.max(0, Math.round(iy + (y - S) / s))), o = (Y * W + X) * 4;
        lum[y * N + x] = 0.299 * D[o] + 0.587 * D[o + 1] + 0.114 * D[o + 2];
      }
    const lb = blur(lum, N, N, 1.2), inside = [], insideF = [];
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++)
        if (Math.hypot(x - S, y - S) < r60 * 0.85) {
          inside.push(lb[y * N + x]);
          insideF.push(fb[y * N + x]);
        }
    const med = medianOf(inside), mad = medianOf(inside.map((v) => Math.abs(v - med))), thr = med + Math.max(35, 4 * mad);
    const medF = medianOf(insideF), spread = Math.max(2, medianOf(insideF.map((v) => Math.abs(v - medF))));
    const spec = new Uint8Array(N * N);
    for (let i = 0; i < spec.length; i++) spec[i] = lb[i] > thr || oob[i] ? 1 : 0;
    const sp = dilateDisk(spec, N, N, 2);
    const ANG = [];
    for (let d = 0; d < 360; d += 7.5) ANG.push([Math.cos(d * Math.PI / 180), Math.sin(d * Math.PI / 180)]);
    const at = (x, y) => {
      const xi = Math.round(x), yi = Math.round(y);
      if (xi < 0 || yi < 0 || xi >= N || yi >= N || sp[yi * N + xi]) return NaN;
      return fb[yi * N + xi];
    };
    const score = (cx, cy, r) => {
      const d = [];
      for (const [c, sn] of ANG) {
        const a = at(cx + (r - 2) * c, cy + (r - 2) * sn), b = at(cx + (r - 1) * c, cy + (r - 1) * sn);
        const e = at(cx + (r + 1) * c, cy + (r + 1) * sn), f2 = at(cx + (r + 2) * c, cy + (r + 2) * sn);
        const v = (e + f2 - a - b) / 2;
        if (isFinite(v)) d.push(v);
      }
      if (d.length < ANG.length * 0.5) return -Infinity;
      d.sort((x, y) => x - y);
      return d[Math.floor(d.length * 0.3)];
    };
    const zone = (c, a, b) => {
      const v = [];
      for (const [cs, sn] of ANG)
        for (let q = a; q <= b + 1e-9; q += (b - a) / 3) {
          const u = at(c.cx + q * c.r * cs, c.cy + q * c.r * sn);
          if (isFinite(u)) v.push(u);
        }
      if (v.length < 8) return null;
      const m = medianOf(v);
      return { m, sd: medianOf(v.map((u) => Math.abs(u - m))) };
    };
    const r0 = Math.max(3, r60 * 0.1), r1 = r60 * 0.75, off = r60 * 0.2, prof = [];
    for (let r = r0; r <= r1; r += 1) {
      let b = { sc: -Infinity };
      for (let cy = S - off; cy <= S + off; cy += 2)
        for (let cx = S - off; cx <= S + off; cx += 2) {
          const sc = score(cx, cy, r);
          if (sc > b.sc) b = { sc, cx, cy, r };
        }
      prof.push(b);
    }
    const peaks = prof.filter((p, i) => isFinite(p.sc) && (i === 0 || p.sc >= prof[i - 1].sc) && (i === prof.length - 1 || p.sc >= prof[i + 1].sc)).sort((a, b) => b.sc - a.sc);
    for (const b0 of peaks.slice(0, 4)) {
      let best = b0;
      for (let cy = b0.cy - 2; cy <= b0.cy + 2; cy += 0.5)
        for (let cx = b0.cx - 2; cx <= b0.cx + 2; cx += 0.5)
          for (let r = b0.r - 1.5; r <= b0.r + 1.5; r += 0.5) {
            const sc = score(cx, cy, r);
            if (sc > best.sc) best = { sc, cx, cy, r };
          }
      const zi = zone(best, 0.2, 0.8), zo = zone(best, 1.2, 1.6);
      if (!(best.sc >= 4) || !zi || !zo || !(zi.m < zo.m - 6) || !(zi.sd < Math.max(4, 1.2 * zo.sd))) continue;
      let worst = 0;
      for (const q of [0.3, 0.5, 0.65]) {
        const v = [];
        for (const [cs, sn] of ANG) {
          const u = at(best.cx + q * best.r * cs, best.cy + q * best.r * sn);
          if (isFinite(u)) v.push(u);
        }
        if (v.length >= 8) {
          const m = medianOf(v);
          worst = Math.max(worst, medianOf(v.map((u) => Math.abs(u - m))));
        }
      }
      if (!(worst < Math.max(4, 1.2 * zo.sd))) continue;
      const out = { cx: ix + (best.cx - S) / s, cy: iy + (best.cy - S) / s, r: best.r / s, sc: best.sc, scN: best.sc / spread };
      return refinePupil(img, out, wl, wc, thr) || out;
    }
    return null;
  }
  function refinePupil(img, p, wl, wc, thr) {
    const { width: W, height: H, data: D } = img, s = 40 / p.r;
    const S = Math.ceil(p.r * 1.6 * s), N = 2 * S + 1, f = new Float32Array(N * N), lum = new Float32Array(N * N), oob = new Uint8Array(N * N);
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const X0 = Math.round(p.cx + (x - S) / s), Y0 = Math.round(p.cy + (y - S) / s);
        if (X0 < 0 || Y0 < 0 || X0 >= W || Y0 >= H) oob[y * N + x] = 1;
        const X = Math.min(W - 1, Math.max(0, X0)), Y = Math.min(H - 1, Math.max(0, Y0)), o = (Y * W + X) * 4;
        const r = D[o], g = D[o + 1], b = D[o + 2];
        lum[y * N + x] = 0.299 * r + 0.587 * g + 0.114 * b;
        f[y * N + x] = wl * lum[y * N + x] + wc * (Math.max(r, g, b) - Math.min(r, g, b));
      }
    const fb = blur(f, N, N, 1.2), lb = blur(lum, N, N, 1.2), spec = new Uint8Array(N * N);
    for (let i = 0; i < spec.length; i++) spec[i] = lb[i] > thr || oob[i] ? 1 : 0;
    const sp = dilateDisk(spec, N, N, 2);
    const at = (x, y) => {
      const xi = Math.round(x), yi = Math.round(y);
      if (xi < 0 || yi < 0 || xi >= N || yi >= N || sp[yi * N + xi]) return NaN;
      return fb[yi * N + xi];
    };
    const score = (cx, cy, r) => {
      const d = [];
      for (let k = 0; k < 64; k++) {
        const c = Math.cos(k * Math.PI / 32), sn = Math.sin(k * Math.PI / 32);
        const v = (at(cx + (r + 1) * c, cy + (r + 1) * sn) + at(cx + (r + 2) * c, cy + (r + 2) * sn) - at(cx + (r - 1) * c, cy + (r - 1) * sn) - at(cx + (r - 2) * c, cy + (r - 2) * sn)) / 2;
        if (isFinite(v)) d.push(v);
      }
      if (d.length < 32) return -Infinity;
      d.sort((x, y) => x - y);
      return d[Math.floor(d.length * 0.3)];
    };
    let best = { sc: score(S, S, 40), cx: S, cy: S, r: 40 };
    for (let cy = S - 3; cy <= S + 3; cy += 0.5)
      for (let cx = S - 3; cx <= S + 3; cx += 0.5)
        for (let r = 37; r <= 43; r += 0.5) {
          const sc = score(cx, cy, r);
          if (sc > best.sc) best = { sc, cx, cy, r };
        }
    if (!isFinite(best.sc)) return null;
    return { ...p, cx: p.cx + (best.cx - S) / s, cy: p.cy + (best.cy - S) / s, r: best.r / s };
  }
  function ray(f, w, h, cx, cy, t, r0, r1, border = 0) {
    const n = Math.max(0, Math.floor(r1 - r0)), rs = new Float32Array(n), v = new Float32Array(n), c = Math.cos(t), s = Math.sin(t);
    for (let i = 0; i < n; i++) {
      const r = r0 + i;
      rs[i] = r;
      v[i] = sample(f, w, h, cx + r * c, cy + r * s, border);
    }
    return { rs, v };
  }
  function boxSmooth(v, k) {
    const out = new Float32Array(v.length), r = k >> 1;
    for (let i = 0; i < v.length; i++) {
      let s = 0;
      for (let j = i - r; j <= i + r; j++) if (j >= 0 && j < v.length) s += v[j];
      out[i] = s / k;
    }
    return out;
  }
  function closeRing(ro, fallback) {
    const idx = [];
    for (let a = 0; a < NA; a++) if (isFinite(ro[a])) idx.push(a);
    const f = new Float32Array(NA);
    if (idx.length <= 10) return f.fill(fallback);
    for (let a = 0; a < NA; a++) {
      if (isFinite(ro[a])) {
        f[a] = ro[a];
        continue;
      }
      let lo = idx[idx.length - 1] - NA, hi = idx[0] + NA;
      for (const j of idx) {
        if (j < a) lo = j;
        else {
          hi = j;
          break;
        }
      }
      const vlo = ro[(lo + NA) % NA], vhi = ro[hi % NA], t = (a - lo) / (hi - lo);
      f[a] = vlo + (vhi - vlo) * t;
    }
    const out = new Float32Array(NA);
    for (let a = 0; a < NA; a++) {
      const win = [];
      for (let d = -6; d <= 6; d++) win.push(f[(a + d + NA) % NA]);
      out[a] = medianOf(win);
    }
    return out;
  }
  async function segmentIris(img, { onStep = () => {
  } } = {}) {
    const W = img.width, H = img.height, k = Math.min(WORK, Math.max(600, Math.max(W, H))) / Math.max(W, H), w = Math.round(W * k), h = Math.round(H * k);
    onStep("Préparation de l'image");
    const sm = resize(img, w, h), g = gray(sm);
    await yieldNow();
    let white = new Uint8Array(w * h);
    for (let i = 0; i < white.length; i++) white[i] = g[i] >= 232 ? 1 : 0;
    white = openSquare(white, w, h, 7);
    let wf = 0;
    for (const v of white) wf += v;
    wf /= white.length;
    let ix, iy, R0, mode2 = "photo";
    if (wf >= 0.15) {
      const nz = white.map((v) => 1 - v), { best: best2 } = components(nz, w, h, true);
      const bw = best2.maxx - best2.minx + 1, bh = best2.maxy - best2.miny + 1, fill = best2.area / (Math.PI / 4 * bw * bh);
      if (best2.area > w * h * 0.03 && bw / bh > 0.6 && bw / bh < 1.7 && fill > 0.6) {
        mode2 = "detoure";
        ix = best2.cx;
        iy = best2.cy;
        R0 = Math.sqrt(best2.area / Math.PI);
      }
    }
    if (mode2 === "photo") {
      onStep("Recherche du bord de l'iris");
      const cn = new Float32Array(w * h);
      for (let i = 0, j = 0; i < cn.length; i++, j += 4) {
        const r = sm.data[j], gg = sm.data[j + 1], b = sm.data[j + 2], mx = Math.max(r, gg, b);
        cn[i] = (mx - Math.min(r, gg, b)) / (mx + 40);
      }
      const d = await daugman(g, cn, w, h);
      if (!isFinite(d.R0) || !(d.contrast >= 2)) return null;
      ({ ix, iy, R0 } = d);
    }
    await yieldNow();
    onStep("Effacement des reflets");
    let spec = new Uint8Array(w * h), nIn = 0, nSpec = 0;
    const r7 = R0 * 0.7;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const inR = Math.hypot(x - ix, y - iy) < r7;
        if (inR) nIn++;
        if (inR && g[y * w + x] > 150) {
          spec[y * w + x] = 1;
          nSpec++;
        }
      }
    if (nSpec > nIn * 0.25) {
      for (let i = 0; i < spec.length; i++) spec[i] = spec[i] && g[i] > 215 ? 1 : 0;
    }
    spec = dilateDisk(spec, w, h, 4);
    const clean = inpaint(sm, spec);
    await yieldNow();
    onStep("Recherche de la pupille");
    let pupil = null;
    if (mode2 === "photo") {
      let pd = null, pdS = -Infinity;
      for (const [wl, wc] of [[1, 0], [1, 2], [0, 3]]) {
        const p = pupilCircle(img, ix / k, iy / k, R0 / k, wl, wc);
        if (!p) continue;
        const adj = p.scN * (1 - 2 * Math.hypot(p.cx - ix / k, p.cy - iy / k) / (R0 / k));
        if (adj > pdS) {
          pd = p;
          pdS = adj;
        }
      }
      if (pd) pupil = { name: "cercle", cx: pd.cx * k, cy: pd.cy * k, rp: pd.r * k };
    }
    const L = new Float32Array(pupil ? 0 : w * h), C = new Float32Array(pupil ? 0 : w * h);
    for (let i = 0, j = 0; i < L.length; i++, j += 4) {
      const [l, a, b] = lab(clean.data[j], clean.data[j + 1], clean.data[j + 2]);
      L[i] = l;
      C[i] = Math.hypot(a - 128, b - 128);
    }
    const LC = L.map((v, i) => v + 3 * C[i]);
    let best = pupil;
    if (!best) for (const [name, ch] of [["clarté", L], ["clarté+couleur", LC], ["couleur", C]]) {
      const chb = blur(ch, w, h, 2);
      let cx = ix, cy = iy, rp2 = 0, nk = 0, pts = [], con = [];
      for (let pass = 0; pass < 2; pass++) {
        pts = [];
        con = [];
        for (let i = 0; i < 180; i++) {
          const t = i / 180 * 2 * Math.PI, { rs, v: raw } = ray(chb, w, h, cx, cy, t, 2, r7);
          if (rs.length < 12) continue;
          const v = boxSmooth(raw, 9), n = v.length;
          const lo = medianOf(v.subarray(0, Math.max(1, Math.floor(n * 0.12)))), hi = medianOf(v.subarray(Math.floor(n * 0.6)));
          if (hi - lo < 6) continue;
          for (let j = 4; j < n; j++)
            if (v[j] > lo + 0.5 * (hi - lo)) {
              pts.push([cx + rs[j] * Math.cos(t), cy + rs[j] * Math.sin(t)]);
              con.push(hi - lo);
              break;
            }
        }
        if (pts.length < 40) break;
        ({ cx, cy, r: rp2, n: nk } = fitCircle(pts));
      }
      if (pts.length >= 40) {
        let s = 0, s2 = 0, n = 0;
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++)
            if (Math.hypot(x - ix, y - iy) < R0 * 0.9) {
              const v = ch[y * w + x];
              s += v;
              s2 += v * v;
              n++;
            }
        const sd = Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2)) + 1e-6, sc = nk / 180 * (medianOf(con) / sd);
        if (!best || sc > best.sc) best = { sc, name, cx, cy, rp: rp2, nk };
      }
      await yieldNow();
    }
    if (!best || !(best.rp > 2) || best.rp > R0 * 0.85 || best.rp < R0 * 0.12) return null;
    const { cx: px, cy: py, rp } = best;
    onStep("Suivi du bord de l'iris");
    const ro = new Float32Array(NA).fill(NaN), seenMask = new Uint8Array(NA).fill(1);
    if (mode2 === "detoure") {
      const wf32 = Float32Array.from(white);
      for (let a = 0; a < NA; a++) {
        const t = a / NA * 2 * Math.PI, c = Math.cos(t), s = Math.sin(t);
        let run4 = 0;
        for (let r = rp * 1.5; r < R0 * 1.8; r++) {
          const x = Math.round(px + r * c), y = Math.round(py + r * s);
          const v = x < 0 || y < 0 || x >= w || y >= h ? -1 : wf32[y * w + x];
          run4 = v === 1 ? run4 + 1 : 0;
          if (run4 >= 12) {
            ro[a] = r - 11;
            break;
          }
        }
      }
    } else {
      const gb = blur(g, w, h, 2), dmax = new Float32Array(NA), rbest = new Float32Array(NA);
      for (let a = 0; a < NA; a++) {
        const t = a / NA * 2 * Math.PI, c = Math.cos(t), s = Math.sin(t), ox = px - ix, oy = py - iy;
        const bq = ox * c + oy * s, rexp = -bq + Math.sqrt(Math.max(0, bq * bq - (ox * ox + oy * oy - R0 * R0)));
        const { rs, v } = ray(gb, w, h, px, py, t, Math.max(rp * 1.3, rexp * 0.88), rexp * 1.12, NaN);
        let bd = -Infinity, br = NaN;
        for (let j = 2; j < v.length - 2; j++) {
          const d = (v[j + 1] + v[j + 2] - v[j - 1] - v[j - 2]) / 2;
          if (d > bd) {
            bd = d;
            br = rs[j];
          }
        }
        dmax[a] = isFinite(bd) ? bd : 0;
        rbest[a] = br;
      }
      const side = [];
      for (let a = 0; a < NA; a++) if (a < 45 || a >= 315 || a >= 135 && a < 225) side.push(dmax[a]);
      const thr = 0.4 * medianOf(side);
      for (let a = 0; a < NA; a++) if (dmax[a] > Math.max(thr, 2)) ro[a] = rbest[a];
      const pts = [];
      for (let a = 0; a < NA; a++) if (isFinite(ro[a])) pts.push([px + ro[a] * Math.cos(a / NA * 2 * Math.PI), py + ro[a] * Math.sin(a / NA * 2 * Math.PI)]);
      if (pts.length >= 20) {
        const fc = fitCircle(pts, 6, 1.8);
        for (let a = 0; a < NA; a++) {
          if (!isFinite(ro[a])) continue;
          const x = px + ro[a] * Math.cos(a / NA * 2 * Math.PI), y = py + ro[a] * Math.sin(a / NA * 2 * Math.PI);
          if (Math.abs(Math.hypot(x - fc.cx, y - fc.cy) - fc.r) > fc.r * 0.05) ro[a] = NaN;
        }
        for (let a = 0; a < NA; a++) {
          if (isFinite(ro[a])) continue;
          const t = a / NA * 2 * Math.PI, c = Math.cos(t), s2 = Math.sin(t), ox = px - fc.cx, oy = py - fc.cy, bq = ox * c + oy * s2;
          ro[a] = -bq + Math.sqrt(Math.max(0, bq * bq - (ox * ox + oy * oy - fc.r * fc.r)));
          seenMask[a] = 0;
        }
      }
    }
    let seen = 0;
    for (let a = 0; a < NA; a++) if (isFinite(ro[a]) && seenMask[a]) seen++;
    const roF = closeRing(ro, R0);
    const out = new Float32Array(NA);
    for (let a = 0; a < NA; a++) out[a] = roF[a] / k;
    return { cx: px / k, cy: py / k, rp: rp / k, ro: out, mode: mode2, channel: best.name, seen: seen / NA, auto: true, limbus: { cx: ix / k, cy: iy / k, r: R0 / k } };
  }
  var irisRadius = (lm) => medianOf(lm.ro);
  function validLandmarks(lm, W, H) {
    if (!lm || !(lm.rp > 1) || !lm.ro || lm.ro.length !== NA || !isFinite(lm.cx) || !isFinite(lm.cy)) return false;
    for (const v of lm.ro) if (!(isFinite(v) && v >= lm.rp * 1.2)) return false;
    const ri = irisRadius(lm);
    for (const v of lm.ro) if (v > ri * 1.6) return false;
    return lm.cx > -ri && lm.cy > -ri && lm.cx < W + ri && lm.cy < H + ri;
  }

  // src/js/engine/iris/unwrap.js
  var RN = 400;
  var SHEET_A = 720;
  var SHEET_R = 128;
  function normalizeIris(img, lm, { room = false, fast = false } = {}) {
    const ri = medianOf(lm.ro), s = RN / ri;
    let rmax = 0;
    for (const v of lm.ro) rmax = Math.max(rmax, v);
    const S = Math.max(64, Math.round(2 * 1.12 * rmax * s)), half = S / (2 * s);
    const N = resize(img, S, S, { x: lm.cx - half, y: lm.cy - half, w: 2 * half, h: 2 * half });
    const lmN = { cx: S / 2, cy: S / 2, rp: lm.rp * s, ro: Float32Array.from(lm.ro, (v) => v * s) };
    const g = gray(N), local = blur(g, S, S, 8), zone = new Uint8Array(S * S), D4 = N.data;
    let spec = new Uint8Array(S * S), nIn = 0, nSp = 0;
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const dx = x - lmN.cx, dy = y - lmN.cy, i = y * S + x, r = Math.hypot(dx, dy), e = edgeAt(lmN.ro, Math.atan2(dy, dx));
        if (r > e * 1.02) continue;
        const inZone = r >= lmN.rp * 1.08 && r <= e * 0.97;
        if (inZone) {
          zone[i] = 1;
          nIn++;
        }
        if (g[i] >= 230 || g[i] >= 200 && g[i] - local[i] > 40) {
          spec[i] = 1;
          if (inZone) nSp++;
        }
      }
    if (nSp > 0.15 * nIn) {
      const big = new Uint8Array(S * S);
      for (let i = 0; i < big.length; i++) big[i] = g[i] >= 225 && (zone[i] || spec[i]) ? 1 : 0;
      const keep = largeBlobs(big, S, S, Math.max(50, 5e-3 * nIn));
      for (let i = 0; i < spec.length; i++) spec[i] = spec[i] && (g[i] >= 240 || keep[i]) ? 1 : 0;
    }
    const zv = [];
    for (let i = 0; i < zone.length; i++) if (zone[i]) zv.push(g[i]);
    if (zv.length) {
      zv.sort((x, y) => x - y);
      const med = zv[zv.length >> 1], mad = Math.max(1, zv.map((v) => Math.abs(v - med)).sort((x, y) => x - y)[zv.length >> 1]);
      const thr = med + Math.max(20, 5 * mad), grey = new Uint8Array(S * S);
      const q = Math.ceil(S / 4), gq = new Float32Array(q * q);
      for (let y = 0; y < q; y++) for (let x = 0; x < q; x++) gq[y * q + x] = sample(g, S, S, Math.min(S - 1, x * 4 + 1.5), Math.min(S - 1, y * 4 + 1.5));
      const wq = blur(gq, q, q, 12), wideAt = (i) => sample(wq, q, q, Math.min(q - 1, i % S / 4), Math.min(q - 1, Math.floor(i / S) / 4));
      for (let i = 0; i < grey.length; i++) {
        if (!zone[i] || g[i] < thr || g[i] - wideAt(i) < 15 && !(room && g[i] - med >= 35)) continue;
        const r = N.data[i * 4], gg = N.data[i * 4 + 1], b = N.data[i * 4 + 2], mx = Math.max(r, gg, b), mnc = Math.min(r, gg, b);
        if (mx - mnc < 40) grey[i] = 1;
      }
      const narrow = (comp) => {
        let sx = 0, sy = 0;
        for (const p of comp) {
          const x = p % S;
          sx += Math.cos(Math.atan2((p - x) / S - lmN.cy, x - lmN.cx));
          sy += Math.sin(Math.atan2((p - x) / S - lmN.cy, x - lmN.cx));
        }
        const mean2 = Math.atan2(sy, sx);
        let span = 0;
        for (const p of comp) {
          const x = p % S, a = Math.atan2((p - x) / S - lmN.cy, x - lmN.cx);
          span = Math.max(span, Math.abs(Math.atan2(Math.sin(a - mean2), Math.cos(a - mean2))));
        }
        if (span * 2 <= 90 * Math.PI / 180) return true;
        if (!room) return false;
        let r0 = Infinity, r1 = 0;
        for (const p of comp) {
          const x = p % S, r = Math.hypot(x - lmN.cx, (p - x) / S - lmN.cy);
          r0 = Math.min(r0, r);
          r1 = Math.max(r1, r);
        }
        return r1 - r0 >= 0.35 * (medianOf(lmN.ro) - lmN.rp);
      };
      const keepG = largeBlobs(openSquare(grey, S, S, 5), S, S, Math.max(60, 4e-3 * nIn), narrow);
      let nG = 0;
      for (let i = 0; i < keepG.length; i++) if (keepG[i] && zone[i]) nG++;
      if (nG <= (room ? 0.3 : 0.12) * nIn) {
        for (let i = 0; i < spec.length; i++) if (keepG[i]) spec[i] = 1;
      }
      const chroma = (i) => {
        const mx = Math.max(D4[i * 4], D4[i * 4 + 1], D4[i * 4 + 2]);
        return (mx - Math.min(D4[i * 4], D4[i * 4 + 1], D4[i * 4 + 2])) / (mx + 20);
      };
      const cz = [];
      for (let i = 0; i < zone.length; i += 7) if (zone[i]) cz.push(chroma(i));
      const cMed = medianOf(cz);
      if (room && cMed >= 0.25) {
        const roomM = new Uint8Array(S * S);
        for (let i = 0; i < room.length; i++) if (zone[i] && wideAt(i) - med >= 20 && g[i] - med >= 15 && chroma(i) < 0.6 * cMed) roomM[i] = 1;
        const keepR = largeBlobs(openSquare(roomM, S, S, 5), S, S, Math.max(200, 0.01 * nIn));
        let nR = 0;
        for (let i = 0; i < keepR.length; i++) if (keepR[i] && zone[i]) nR++;
        if (nR <= 0.4 * nIn) {
          for (let i = 0; i < spec.length; i++) if (keepR[i]) spec[i] = 1;
        }
      }
    }
    spec = dilateDisk(largeBlobs(spec, S, S, 12), S, S, 3);
    const lid = eyelids(N, lmN, S, zone);
    let hR = 0, hL = 0;
    for (let i = 0; i < spec.length; i++) {
      if (zone[i]) {
        if (lid[i]) hL++;
        else if (spec[i]) hR++;
      }
      if (lid[i]) spec[i] = 1;
    }
    return { N: fast ? N : inpaint(N, spec), lmN, spec, lid, scale: s, hidden: { lid: nIn ? hL / nIn : 0, refl: nIn ? hR / nIn : 0 } };
  }
  function largeBlobs(m, w, h, minArea, keep = null) {
    const out = new Uint8Array(w * h), seen = new Uint8Array(w * h), stack = new Int32Array(w * h), comp = [];
    for (let s = 0; s < m.length; s++) {
      if (!m[s] || seen[s]) continue;
      let sp = 0;
      comp.length = 0;
      stack[sp++] = s;
      seen[s] = 1;
      while (sp) {
        const p = stack[--sp], x = p % w, y = (p - x) / w;
        comp.push(p);
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx, yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            const q = yy * w + xx;
            if (m[q] && !seen[q]) {
              seen[q] = 1;
              stack[sp++] = q;
            }
          }
      }
      if (comp.length >= minArea && (!keep || keep(comp))) for (const p of comp) out[p] = 1;
    }
    return out;
  }
  function edgeAt(ro, t) {
    const u = (t / (2 * Math.PI) * NA % NA + NA) % NA, a0 = Math.floor(u), a1 = (a0 + 1) % NA, f = u - a0;
    return ro[a0] * (1 - f) + ro[a1] * f;
  }
  function unwrap(img, lm, { mirror = false, nA = SHEET_A, nR = SHEET_R } = {}) {
    const out = new Uint8ClampedArray(nA * nR * 4);
    for (let i = 0; i < nA; i++) {
      const ti = i / nA * 2 * Math.PI, t = mirror ? Math.PI - ti : ti, c = Math.cos(t), s = Math.sin(t);
      const rIn = lm.rp * 1.08, rOut = edgeAt(lm.ro, t) * 0.97;
      for (let j = 0; j < nR; j++) {
        const r = rIn + (rOut - rIn) * j / (nR - 1), x = lm.cx + r * c, y = lm.cy + r * s, o = (i * nR + j) * 4;
        for (let k = 0; k < 3; k++) out[o + k] = sampleRGBA(img, x, y, k);
        out[o + 3] = 255;
      }
    }
    return { width: nR, height: nA, data: out };
  }
  function unwrapMask(mask, S, lm, { mirror = false, nA = SHEET_A, nR = SHEET_R } = {}) {
    const out = new Uint8Array(nA * nR);
    for (let i = 0; i < nA; i++) {
      const ti = i / nA * 2 * Math.PI, t = mirror ? Math.PI - ti : ti, c = Math.cos(t), s = Math.sin(t);
      const rIn = lm.rp * 1.08, rOut = edgeAt(lm.ro, t) * 0.97;
      for (let j = 0; j < nR; j++) {
        const r = rIn + (rOut - rIn) * j / (nR - 1), x = Math.round(lm.cx + r * c), y = Math.round(lm.cy + r * s);
        out[i * nR + j] = x >= 0 && y >= 0 && x < S && y < S ? mask[y * S + x] : 0;
      }
    }
    return out;
  }
  function bandImage(sheet) {
    const { width: nR, height: nA, data: d } = sheet, out = new Uint8ClampedArray(nA * nR * 4);
    for (let i = 0; i < nA; i++)
      for (let j = 0; j < nR; j++) {
        const s = (i * nR + j) * 4, o = (j * nA + i) * 4;
        out[o] = d[s];
        out[o + 1] = d[s + 1];
        out[o + 2] = d[s + 2];
        out[o + 3] = 255;
      }
    return { width: nA, height: nR, data: out };
  }
  function eyelids(N, lmN, S, zone) {
    const lid = new Uint8Array(S * S), D = N.data, at = (i) => [D[i * 4], D[i * 4 + 1], D[i * 4 + 2]];
    const med3 = (list) => [0, 1, 2].map((c) => medianOf(list.map((v) => v[c])));
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const irisRef = [], skinUp = [], skinDown = [];
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const dx = x - lmN.cx, dy = y - lmN.cy, r = Math.hypot(dx, dy), t = Math.atan2(dy, dx), e = edgeAt(lmN.ro, t), i = y * S + x;
        const lat = Math.abs(Math.cos(t)) > 0.87;
        if (lat && r > lmN.rp * 1.3 && r < e * 0.9) irisRef.push(at(i));
        if (r > e * 1.03 && r < e * 1.11 && Math.abs(Math.sin(t)) > 0.77) (dy < 0 ? skinUp : skinDown).push(at(i));
      }
    if (irisRef.length < 50) return lid;
    const iris = med3(irisRef);
    for (const [list, up] of [[skinUp, true], [skinDown, false]]) {
      if (list.length < 30) continue;
      const skin = med3(list), mx = Math.max(...skin);
      if (dist(skin, iris) < 30) continue;
      if (mx > 235 || (mx - Math.min(...skin)) / (mx + 20) < 0.12) continue;
      const cand = new Uint8Array(S * S);
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const i = y * S + x;
          if (!zone[i] || y < lmN.cy !== up) continue;
          const c = at(i), ds = dist(c, skin), di = dist(c, iris);
          if (ds < 0.6 * di && ds < 45) cand[i] = 1;
        }
      const blobs = largeBlobs(cand, S, S, 40, (comp) => comp.some((p) => {
        const x = p % S, y = (p - x) / S;
        return Math.hypot(x - lmN.cx, y - lmN.cy) > 0.9 * edgeAt(lmN.ro, Math.atan2(y - lmN.cy, x - lmN.cx));
      }));
      for (let i = 0; i < lid.length; i++) if (blobs[i]) lid[i] = 1;
    }
    return dilateDisk(lid, S, S, 2);
  }

  // src/js/engine/iris/motifs.js
  var yieldNow2 = () => new Promise((r) => setTimeout(r, 0));
  var TEXTURE_REL_MIN = 1.2;
  var SHARPNESS_MIN = 0.36;
  function countBlobs(m, w, h, minArea) {
    const lab2 = new Int32Array(w * h), stack = new Int32Array(w * h);
    let n = 0, kept = 0;
    for (let s = 0; s < m.length; s++) {
      if (!m[s] || lab2[s]) continue;
      n++;
      let sp = 0, area = 0;
      stack[sp++] = s;
      lab2[s] = n;
      while (sp) {
        const p = stack[--sp], x = p % w, y = (p - x) / w;
        area++;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx, yy = (y + dy + h) % h;
            if (xx < 0 || xx >= w) continue;
            const q = yy * w + xx;
            if (m[q] && !lab2[q]) {
              lab2[q] = n;
              stack[sp++] = q;
            }
          }
      }
      if (area >= minArea) kept++;
    }
    return kept;
  }
  async function irisMotifs(N, lmN, sheet, { mirror = false, spec = null, sheetSpec = null, stop: stop2 = () => false } = {}) {
    const nR = sheet.width, nA = sheet.height, sg = gray(sheet), ok = new Uint8Array(nR * nA);
    for (let y = 0; y < nA; y++)
      for (let x = 0; x < nR; x++) {
        const i = y * nR + x;
        let refl2 = false;
        if (sheetSpec) for (let d = -2; d <= 2 && !refl2; d++) refl2 = !!sheetSpec[(y + d + nA) % nA * nR + x];
        ok[i] = sg[i] < 232 && sg[i] > 8 && !refl2 ? 1 : 0;
      }
    const cover = (x0, x1) => {
      let n = 0;
      for (let y = 0; y < nA; y++) for (let x = x0; x < x1; x++) n += ok[y * nR + x];
      return n / ((x1 - x0) * nA);
    };
    const gry = clahe(sg, nR, nA, 2, 4, 8), { gx: sx, gy: sy } = sobel(gry, nR, nA);
    const lapAbs = [], sgb = blur(sg, nR, nA, 1.5), { gx: bx, gy: by } = sobel(sgb, nR, nA);
    let eTex = 0, nTex = 0;
    for (let y = 1; y < nA - 1; y++)
      for (let x = 1; x < nR - 1; x++) {
        const i = y * nR + x;
        if (!ok[i]) continue;
        lapAbs.push(Math.abs(4 * sg[i] - sg[i - 1] - sg[i + 1] - sg[i - nR] - sg[i + nR]));
        eTex += (bx[i] * bx[i] + by[i] * by[i]) / 64;
        nTex++;
      }
    const texG = nTex ? Math.sqrt(eTex / nTex) : 0, noiseSd = lapAbs.length ? medianOf(lapAbs) / 0.6745 / Math.sqrt(20) : 0;
    const okv = [];
    for (let i = 0; i < ok.length; i += 7) if (ok[i]) okv.push(sg[i]);
    const lum = okv.length ? medianOf(okv) : 100, texRel = texG * 100 / Math.max(lum, 30);
    const f1 = blur(sg, nR, nA, 1), f3 = blur(sg, nR, nA, 3), f9 = blur(sg, nR, nA, 9);
    const NSH = 16, rat = [], xs0 = Math.round(nR * 0.15), xs1 = Math.round(nR * 0.85);
    for (let k = 0; k < NSH; k++) {
      const y0 = Math.floor(k * nA / NSH), y1 = Math.floor((k + 1) * nA / NSH);
      let eF = 0, eC = 0, n = 0;
      for (let y = y0; y < y1; y++)
        for (let x = xs0; x < xs1; x++) {
          const i = y * nR + x;
          if (!ok[i]) continue;
          eF += (f1[i] - f3[i]) ** 2;
          eC += (f3[i] - f9[i]) ** 2;
          n++;
        }
      if (n >= (y1 - y0) * (xs1 - xs0) * 0.3 && eC > 0) rat.push(Math.sqrt(eF / eC));
    }
    const sharpness = rat.length ? medianOf(rat) : 0;
    const texSNR = texG / Math.max(noiseSd, 0.5), plain = texRel < TEXTURE_REL_MIN || sharpness < SHARPNESS_MIN;
    const prof = new Float32Array(nR);
    let pm = 0, pn = 0;
    for (let x = 0; x < nR; x++) {
      let s = 0, n = 0;
      for (let y = 0; y < nA; y++)
        if (ok[y * nR + x]) {
          s += gry[y * nR + x];
          n++;
        }
      prof[x] = n ? s / n : NaN;
      if (n) {
        pm += prof[x];
        pn++;
      }
    }
    for (let x = 0; x < nR; x++) if (!isFinite(prof[x])) prof[x] = pn ? pm / pn : 0;
    const ps = blur1d(prof, 2), grad = new Float32Array(nR);
    for (let x = 1; x < nR - 1; x++) grad[x] = Math.abs((ps[x + 1] - ps[x - 1]) / 2);
    const x0c = Math.round(nR * 0.15), x1c = Math.round(nR * 0.55);
    let collar = x0c, gbest = -1;
    for (let x = x0c; x <= x1c; x++)
      if (grad[x] > gbest) {
        gbest = grad[x];
        collar = x;
      }
    const typical = medianOf(grad.subarray(4, nR - 4));
    const sharp = gbest >= Math.max(0.6, 2 * typical);
    let off = 0;
    if (collar > 0 && collar < nR - 1) {
      const a = grad[collar - 1], b = grad[collar], c = grad[collar + 1], den = a - 2 * b + c;
      if (den < 0) off = Math.max(-0.5, Math.min(0.5, 0.5 * (a - c) / den));
    }
    const collSect = collarSectors(gry, ok, nR, nA, x0c, x1c), collPos = collSect ?? (collar + off) / nR, collX = Math.round(collPos * nR);
    const share = (x0, x1, exclColl = true) => {
      let a = 0, b = 0, n = 0;
      for (let y = 0; y < nA; y++)
        for (let x = x0; x < x1; x++) {
          const i = y * nR + x;
          if (!ok[i] || exclColl && Math.abs(x - collX) <= 4) continue;
          a += sy[i] * sy[i];
          b += sx[i] * sx[i];
          n++;
        }
      return n && a + b > 0 ? a / (a + b) : NaN;
    };
    const third = Math.round(nR / 3), two = Math.round(2 * nR / 3);
    const F = {}, why = {};
    const put = (key, val, cov, reason, motif = true) => {
      if (motif && plain) {
        F[key] = null;
        why[key] = "iris flou ou sans motif visible";
      } else if (cov < 0.5 || !isFinite(val)) {
        F[key] = null;
        why[key] = reason;
      } else F[key] = val;
    };
    put("filaments_coeur", share(0, third), cover(0, third), "cœur de l'iris peu visible");
    put("filaments_milieu", share(third, two), cover(third, two), "milieu de l'iris peu visible");
    put("sillons_bord", 1 - share(two, nR, false), cover(two, nR), "pourtour peu visible");
    await yieldNow2();
    if (stop2()) throw new Error("annulé");
    const b1 = blur(gry, nR, nA, 1.5), b5 = blur(gry, nR, nA, 5), cm = new Uint8Array(nR * nA);
    for (let i = 0; i < cm.length; i++) cm[i] = b1[i] - b5[i] < -12 && ok[i] ? 1 : 0;
    const all = cover(0, nR);
    put("cryptes_densite", countBlobs(cm, nR, nA, 6) / 7.2, all, "iris peu visible");
    put("collerette", sharp ? collPos : NaN, all, "collerette peu nette");
    const Lin = [], Lout = [];
    for (let y = 0; y < nA; y++)
      for (let x = 3; x < nR - 3; x++) {
        const i = y * nR + x;
        if (!ok[i] || x >= third && x < two) continue;
        const L = lab(sheet.data[i * 4], sheet.data[i * 4 + 1], sheet.data[i * 4 + 2])[0];
        (x < third ? Lin : Lout).push(L);
      }
    const cIn = Lin.length / Math.max(1, (third - 3) * nA), cOut = Lout.length / Math.max(1, (nR - 3 - two) * nA);
    put("clarte_coeur_bord", medianOf(Lout) - medianOf(Lin), Math.min(cIn, cOut), "cœur ou pourtour peu visible", false);
    await yieldNow2();
    if (stop2()) throw new Error("annulé");
    const S = N.width, gN = gray(N), gc = clahe(gN, S, S, 2, 8, 8), gb = blur(gc, S, S, 1.5), { gx, gy } = sobel(gb, S, S);
    const n2 = S * S, xx = new Float32Array(n2), yy = new Float32Array(n2), xy = new Float32Array(n2);
    for (let i = 0; i < n2; i++) {
      xx[i] = gx[i] * gx[i];
      yy[i] = gy[i] * gy[i];
      xy[i] = gx[i] * gy[i];
    }
    await yieldNow2();
    if (stop2()) throw new Error("annulé");
    const Jxx = blur(xx, S, S, 4), Jyy = blur(yy, S, S, 4), Jxy = blur(xy, S, S, 4);
    await yieldNow2();
    if (stop2()) throw new Error("annulé");
    let tot = 0, wsp = 0, wci = 0, wra = 0, wpos = 0, wneg = 0, ringN = 0, ringExp = 0, eRing = 0, eMid = 0, nMid = 0;
    const rin = lmN.rp * 1.08;
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const dx = x - lmN.cx, dy = y - lmN.cy, rpx = Math.hypot(dx, dy), ang = Math.atan2(dy, dx), rob = edgeAt(lmN.ro, ang);
        const tf = (rpx - rin) / (rob * 0.95 - rin);
        if (!(tf > 0 && tf < 1)) continue;
        const i = y * S + x, trace = Jxx[i] + Jyy[i], lam = Math.sqrt((Jxx[i] - Jyy[i]) ** 2 + 4 * Jxy[i] ** 2), coh = (lam / (trace + 1e-6)) ** 2;
        const e = coh * trace;
        if (tf > 0.33 && tf < 0.66) {
          eMid += e;
          nMid++;
        }
        if (tf <= 0.66) continue;
        ringExp++;
        if (gN[i] >= 232 || spec?.[i]) continue;
        ringN++;
        eRing += e;
        const tg = 0.5 * Math.atan2(2 * Jxy[i], Jxx[i] - Jyy[i]);
        let al = ((tg - ang + Math.PI / 2) % Math.PI + Math.PI) % Math.PI - Math.PI / 2;
        al = al * 180 / Math.PI;
        const aa = Math.abs(al);
        tot += e;
        if (aa >= 25 && aa <= 65) {
          wsp += e;
          if (al > 0) wpos += e;
          else wneg += e;
        }
        if (aa < 20) wci += e;
        if (aa > 70) wra += e;
      }
    tot += 1e-6;
    const ringE = ringN ? eRing / ringN : 0, midE = nMid ? eMid / nMid : 0;
    const flat = ringN > 0 && (ringE < 0.15 * midE || ringE < 1);
    put("spirales_bord", wsp / tot, flat ? 0 : ringN / Math.max(1, ringExp), flat ? "pourtour lissé ou retouché" : "pourtour peu visible");
    if (flat && F.sillons_bord != null) {
      F.sillons_bord = null;
      why.sillons_bord = "pourtour lissé ou retouché";
    }
    const extra = {
      cercles_bord: wci / tot,
      rayons_bord: wra / tot,
      sens_spirales: (wpos - wneg) / (wsp + 1e-6) * (mirror ? -1 : 1),
      pupille_iris: lmN.rp / medianOf(lmN.ro),
      texture: texG,
      texture_rel: texRel,
      nettete: sharpness,
      texture_snr: texSNR,
      rayon_norm: RN
    };
    return { F, why, extra };
  }
  function collarSectors(gry, ok, nR, nA, x0c, x1c) {
    const NS = 16, pos = [], prof = new Float32Array(nR);
    for (let k = 0; k < NS; k++) {
      const y0 = Math.floor(k * nA / NS), y1 = Math.floor((k + 1) * nA / NS);
      let bad = 0;
      for (let x = 0; x < nR; x++) {
        let s = 0, n = 0;
        for (let y = y0; y < y1; y++)
          if (ok[y * nR + x]) {
            s += gry[y * nR + x];
            n++;
          }
        if (n < (y1 - y0) * 0.5) bad++;
        prof[x] = n ? s / n : NaN;
      }
      if (bad > nR * 0.2) continue;
      let hole = false;
      for (let x = Math.max(0, x0c - 3); x <= Math.min(nR - 1, x1c + 3); x++) if (!isFinite(prof[x])) hole = true;
      if (hole) continue;
      const first = prof.findIndex((v) => isFinite(v));
      for (let x = 0; x < nR; x++) if (!isFinite(prof[x])) prof[x] = x < first ? prof[first] : prof[x - 1];
      const ps = blur1d(prof, 2), gr = new Float32Array(nR);
      for (let x = 1; x < nR - 1; x++) gr[x] = Math.abs(ps[x + 1] - ps[x - 1]) / 2;
      let best = -1, at = -1;
      for (let x = Math.max(2, x0c); x <= Math.min(nR - 3, x1c); x++)
        if (gr[x] > best) {
          best = gr[x];
          at = x;
        }
      if (at < 0 || best < Math.max(0.6, 2 * medianOf(gr.subarray(4, nR - 4)))) continue;
      const a = gr[at - 1], c = gr[at + 1], den = a - 2 * best + c;
      pos.push(at + (den < 0 ? Math.max(-0.5, Math.min(0.5, 0.5 * (a - c) / den)) : 0));
    }
    if (pos.length < 6) return null;
    pos.sort((u, v) => u - v);
    const m = pos.length >> 1;
    return (pos.length % 2 ? pos[m] : (pos[m - 1] + pos[m]) / 2) / nR;
  }

  // src/js/engine/iris/cotes.js
  var EGALITE = 0.1;
  var MOTIFS = [
    { key: "filaments_coeur", label: "Filaments du cœur", scale: 0.075, what: "les fines lignes qui partent de la pupille, dans le tiers intérieur de l'iris" },
    { key: "filaments_milieu", label: "Filaments du milieu", scale: 0.194, what: "les lignes rayonnantes du tiers central" },
    { key: "sillons_bord", label: "Sillons du pourtour", scale: 0.29, what: "les plis en cercle qui font le tour de l'iris, dans le tiers extérieur" },
    { key: "spirales_bord", label: "Spirales du pourtour", scale: 0.36, what: "les motifs obliques du tiers extérieur, ni rayons ni cercles" },
    { key: "cryptes_densite", label: "Cryptes", scale: 21, what: "les petits creux sombres en forme de losange, surtout près de la collerette" },
    { key: "collerette", label: "Position de la collerette", scale: 0.15, what: "l'anneau en zigzag qui sépare le cœur du pourtour : plus ou moins loin de la pupille" },
    { key: "clarte_coeur_bord", label: "Contraste cœur / pourtour", scale: 25, what: "la différence de clarté entre le cœur et le pourtour de l'iris" }
  ];
  function gap(m, fa, fb) {
    const a = fa?.[m.key], b = fb?.[m.key];
    if (a == null || b == null) return null;
    return Math.abs(a - b) / m.scale;
  }
  function pairWords(d) {
    if (d == null) return "non mesurable";
    return d < 0.1 ? "très proches" : d < 0.25 ? "proches" : d < 0.5 ? "assez différents" : "différents";
  }
  function trio(fc, fa, fb) {
    return MOTIFS.map((m) => {
      const da = gap(m, fc, fa), db = gap(m, fc, fb);
      if (da == null || db == null) return { key: m.key, side: null, da, db };
      return { key: m.key, side: Math.abs(da - db) < EGALITE ? "egalite" : da < db ? "a" : "b", da, db };
    });
  }
  function describe2(key, v) {
    if (v == null) return "non mesurable";
    const f2 = (x) => x.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
    switch (key) {
      case "filaments_coeur":
      case "filaments_milieu":
        return `${v >= 0.6 ? "filaments marqués" : v >= 0.45 ? "filaments présents" : "peu de filaments"} (${f2(v)})`;
      case "sillons_bord":
        return `${v >= 0.55 ? "sillons marqués" : v >= 0.4 ? "quelques sillons" : "peu de sillons"} (${f2(v)})`;
      case "spirales_bord":
        return `${v >= 0.35 ? "spirales marquées" : v >= 0.2 ? "quelques spirales" : "peu de spirales"} (${f2(v)})`;
      case "cryptes_densite":
        return `${v >= 15 ? "nombreuses cryptes" : v >= 6 ? "quelques cryptes" : "peu de cryptes"} (${f2(v)})`;
      case "collerette":
        return `à ${Math.round(v * 100)} % du chemin entre la pupille et le bord`;
      case "clarte_coeur_bord":
        return v > 5 ? `cœur plus foncé que le pourtour (${f2(v)})` : v < -5 ? `cœur plus clair que le pourtour (${f2(v)})` : `cœur et pourtour de même clarté (${f2(v)})`;
      default:
        return f2(v);
    }
  }

  // src/js/engine/iris/index.js
  var MIN_IRIS_PX = 80;
  var MIN_MEASURE_PX = 300;
  var irisDiameter = (lm) => 2 * medianOf(lm.ro);
  async function analyzeIris(img, lm, { mirror = false, onStep = () => {
  }, stop: stop2 = () => false } = {}) {
    const check = () => {
      if (stop2()) throw new Error("annulé");
    };
    const d = irisDiameter(lm);
    if (d < MIN_MEASURE_PX) {
      const F = {}, why = {};
      for (const k of ["filaments_coeur", "filaments_milieu", "sillons_bord", "cryptes_densite", "collerette", "clarte_coeur_bord", "spirales_bord"]) {
        F[k] = null;
        why[k] = `iris trop petit pour mesurer les motifs (${Math.round(d)} px de diamètre, minimum ${MIN_MEASURE_PX})`;
      }
      onStep("Déroulé de l'iris");
      return { F, why, extra: {}, band: bandImage(unwrap(img, lm, { mirror })) };
    }
    onStep("Mise à l'échelle de l'iris");
    const { N, lmN, spec } = normalizeIris(img, lm);
    await new Promise((r) => setTimeout(r, 0));
    check();
    onStep("Déroulé de l'iris");
    const sheet = unwrap(N, lmN, { mirror }), sheetSpec = unwrapMask(spec, N.width, lmN, { mirror });
    check();
    onStep("Mesure des motifs");
    const m = await irisMotifs(N, lmN, sheet, { mirror, spec, sheetSpec, stop: stop2 });
    return { ...m, band: bandImage(sheet) };
  }
  function previewBand(img, lm, { mirror = false } = {}) {
    return bandImage(unwrap(img, lm, { mirror, nA: 360, nR: 64 }));
  }
  function irisCrop(img, lm, maxSide = 1200) {
    let rmax = 0;
    for (const v of lm.ro) rmax = Math.max(rmax, v);
    const half = rmax * 1.06, side = 2 * half, S = Math.max(32, Math.min(maxSide, Math.round(side))), s = S / side;
    const c = resize(img, S, S, { x: lm.cx - half, y: lm.cy - half, w: side, h: side });
    const lc = { cx: S / 2, cy: S / 2, rp: lm.rp * s, ro: Float32Array.from(lm.ro, (v) => v * s) };
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const dx = x + 0.5 - lc.cx, dy = y + 0.5 - lc.cy;
        const r = Math.hypot(dx, dy), o = (y * S + x) * 4;
        const g = 0.299 * c.data[o] + 0.587 * c.data[o + 1] + 0.114 * c.data[o + 2];
        if (r <= edgeAt(lc.ro, Math.atan2(dy, dx)) * 1.02 && r > lc.rp * 1.02 && g < 225) continue;
        c.data[o] = c.data[o + 1] = c.data[o + 2] = 128;
        c.data[o + 3] = 255;
      }
    return { img: c, lm: lc };
  }
  var packLandmarks = (lm) => ({ cx: +lm.cx.toFixed(2), cy: +lm.cy.toFixed(2), rp: +lm.rp.toFixed(2), ro: Array.from(lm.ro, (v) => +v.toFixed(2)), auto: !!lm.auto });
  var unpackLandmarks = (o) => o && Array.isArray(o.ro) && o.ro.length === NA ? { cx: +o.cx, cy: +o.cy, rp: +o.rp, ro: Float32Array.from(o.ro, Number), auto: !!o.auto } : null;
  function photoQuality(img, lm) {
    const nA = 360, nR = 64, sh = unwrap(img, lm, { nA, nR }), g = gray(sh), ok = new Uint8Array(nA * nR);
    for (let i = 0; i < ok.length; i++) ok[i] = g[i] < 230 && g[i] > 8 ? 1 : 0;
    const f1 = blur(g, nR, nA, 1), f3 = blur(g, nR, nA, 3), f9 = blur(g, nR, nA, 9), rat = [];
    const x0 = Math.round(nR * 0.15), x1 = Math.round(nR * 0.85);
    for (let k = 0; k < 16; k++) {
      const y0 = Math.floor(k * nA / 16), y1 = Math.floor((k + 1) * nA / 16);
      let eF = 0, eC = 0, n = 0;
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const i = y * nR + x;
          if (!ok[i]) continue;
          eF += (f1[i] - f3[i]) ** 2;
          eC += (f3[i] - f9[i]) ** 2;
          n++;
        }
      if (n >= (y1 - y0) * (x1 - x0) * 0.3 && eC > 0) rat.push(Math.sqrt(eF / eC));
    }
    const { hidden } = normalizeIris(img, lm, { room: true, fast: true });
    return { sharp: rat.length ? medianOf(rat) : 0, reflets: hidden.refl, paupieres: hidden.lid };
  }

  // src/js/ui/iris.js
  var MAX_SIDE = 2400;
  var MAX_BYTES = 20 * 1024 * 1024;
  var ROLES = ["La personne", "Un parent", "L'autre parent"];
  var blank2 = (i) => ({ i, name: "", eye: "", src: null, img: null, lm: null, lmAuto: null, status: "empty", msg: "", warn: "", baseRef: null, gen: 0, cache: null, native: null, map: null, opening: null });
  var islots = [0, 1, 2].map(blank2);
  var nameOf = (s) => {
    const n = s.name.trim();
    if (!n) return `Iris ${s.i + 1}`;
    return islots.some((o) => o !== s && o.src && o.name.trim().toLowerCase() === n.toLowerCase()) ? `${n} (iris ${s.i + 1})` : n;
  };
  var EYE = { G: "œil gauche", D: "œil droit" };
  var say3 = (t) => {
    const r = $("#srStatus");
    if (r) r.textContent = t;
  };
  var run3 = { gen: 0, busy: false, res: null };
  function invalidate() {
    if (run3.res && !run3.busy) $("#irisStatus").textContent = "Un iris a changé : relancez la comparaison.";
    if (run3.busy) {
      run3.gen++;
      run3.busy = false;
      $("#irisCancel").hidden = true;
      $("#irisStatus").textContent = "Comparaison interrompue : un iris a changé.";
      say3("Comparaison interrompue : un iris a changé.");
    }
    run3.res = null;
    $("#irisResults").hidden = true;
  }
  function slotHtml(s) {
    const n = s.i + 1;
    return `<div class="islot" data-i="${s.i}">
    <div class="ihead"><span class="badge">${n}</span><h3>${ROLES[s.i]}</h3></div>
    <div class="imedia"><canvas width="240" height="240" hidden></canvas><p class="ph" aria-hidden="true">Iris ${n}</p></div>
    <label class="ilabel">Prénom <input class="name" type="text" autocomplete="off" maxlength="40" data-f="name"></label>
    <fieldset class="ieye"><legend>Œil photographié</legend>
      <label class="check"><input type="radio" name="ieye${s.i}" value="G"> Gauche</label>
      <label class="check"><input type="radio" name="ieye${s.i}" value="D"> Droit</label>
    </fieldset>
    <div class="iact">
      <button type="button" class="btn small" data-act="pick" aria-label="Importer une photo, iris ${n}">Importer une photo</button>
      <button type="button" class="btn small" data-act="burst" aria-label="Plusieurs photos (rafale), iris ${n}">Plusieurs photos (rafale)</button>
      <button type="button" class="btn small" data-act="fix" aria-label="Corriger les repères, iris ${n}" hidden>Corriger les repères</button>
      <button type="button" class="btn small" data-act="frombase" aria-label="Depuis ma base, iris ${n}" hidden>Depuis ma base</button>
      <button type="button" class="btn small" data-act="keep" aria-label="Garder dans ma base, iris ${n}" hidden>Garder dans ma base</button>
      <button type="button" class="btn small" data-act="clear" aria-label="Retirer l'iris ${n}" hidden>Retirer</button>
    </div>
    <p class="hint istate"></p>
    <input type="file" accept="image/*" hidden data-f="file">
    <input type="file" accept="image/*" multiple hidden data-f="burst">
  </div>`;
  }
  var el2 = (s) => $(`.islot[data-i="${s.i}"]`);
  var agreed = () => $("#irisAgree").checked;
  function drawThumb(s) {
    const cv = $("canvas", el2(s));
    if (!s.src) {
      cv.hidden = true;
      return;
    }
    cv.hidden = false;
    const g = cv.getContext("2d"), W = cv.width;
    g.fillStyle = "#808080";
    g.fillRect(0, 0, W, W);
    if (!s.lm) {
      const k = Math.min(W / s.src.width, W / s.src.height);
      g.drawImage(s.src, (W - s.src.width * k) / 2, (W - s.src.height * k) / 2, s.src.width * k, s.src.height * k);
    } else {
      let rmax = 0;
      for (const v of s.lm.ro) rmax = Math.max(rmax, v);
      const half = rmax * 1.25, k = W / (2 * half);
      g.drawImage(s.src, s.lm.cx - half, s.lm.cy - half, 2 * half, 2 * half, 0, 0, W, W);
      g.beginPath();
      g.rect(0, 0, W, W);
      for (let a = 0; a <= NA; a += 2) {
        const t = a / NA * 2 * Math.PI, r = edgeAt(s.lm.ro, t), x = (s.lm.cx + r * Math.cos(t) - (s.lm.cx - half)) * k, y = (s.lm.cy + r * Math.sin(t) - (s.lm.cy - half)) * k;
        a ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.fillStyle = "rgba(128,128,128,.75)";
      g.fill("evenodd");
      drawMarks(g, s.lm, (x) => (x - (s.lm.cx - half)) * k, (y) => (y - (s.lm.cy - half)) * k, k);
    }
    cv.setAttribute("role", "img");
    cv.setAttribute("aria-label", s.lm ? `Iris ${s.i + 1} : repères placés (pupille et bord de l'iris), hors de l'iris grisé` : `Iris ${s.i + 1} : photo sans repères`);
  }
  function drawMarks(g, lm, X, Y, k) {
    const path = () => {
      g.beginPath();
      for (let a = 0; a <= NA; a += 2) {
        const t = a / NA * 2 * Math.PI, r = edgeAt(lm.ro, t);
        const x = X(lm.cx + r * Math.cos(t)), y = Y(lm.cy + r * Math.sin(t));
        a ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.closePath();
    };
    const circle = () => {
      g.beginPath();
      g.arc(X(lm.cx), Y(lm.cy), lm.rp * k, 0, 2 * Math.PI);
    };
    for (const [w, c] of [[4, "rgba(0,0,0,.75)"], [2, "#fff"]]) {
      g.lineWidth = w;
      g.strokeStyle = c;
      g.setLineDash([]);
      path();
      g.stroke();
      g.setLineDash(w === 2 ? [6, 4] : []);
      circle();
      g.stroke();
    }
    g.setLineDash([]);
  }
  function renderSlot2(s) {
    const e = el2(s);
    if (!e) return;
    const has = !!s.src;
    $(".ph", e).hidden = has;
    drawThumb(s);
    const name = $("[data-f=name]", e);
    if (document.activeElement !== name) name.value = s.name;
    name.readOnly = !!s.baseRef;
    if (s.baseRef) name.setAttribute("aria-describedby", "lockedHint");
    else name.removeAttribute("aria-describedby");
    for (const r of $$(`input[name=ieye${s.i}]`, e)) r.checked = r.value === s.eye;
    e.dataset.status = s.status;
    $("[data-act=pick]", e).disabled = !agreed() || s.status === "busy";
    $("[data-act=burst]", e).disabled = !agreed() || s.status === "busy";
    $("[data-act=fix]", e).hidden = !has || s.status === "busy";
    $("[data-act=fix]", e).classList.toggle("primary", s.status === "tofix");
    $("[data-act=clear]", e).hidden = !has;
    const irisItems = base.on ? base.items.filter((i) => i.kind === "iris") : [];
    $("[data-act=frombase]", e).hidden = !irisItems.length || s.status === "busy";
    $("[data-act=frombase]", e).disabled = !agreed();
    $("[data-act=keep]", e).hidden = !base.on || !s.lm || !!s.baseRef || s.status !== "ready";
    $(".istate", e).textContent = s.baseRef ? `${s.msg ? s.msg + " " : ""}Gardé dans ma base.` : s.msg;
    $(".istate", e).classList.toggle("warn", !!s.warn);
    e.classList.toggle("filled", has);
    updateGo();
    emit2("iris");
  }
  function readyOf() {
    return islots.filter((s) => s.lm && s.status === "ready");
  }
  function updateGo() {
    const ready = readyOf(), need = [];
    if (!agreed()) need.push("Cochez l'accord des personnes photographiées.");
    for (const s of islots) if (s.status === "tofix") need.push(`Placez et validez les repères de ${nameOf(s)}.`);
    if (ready.length < 2) need.push("Ajoutez au moins deux iris.");
    for (const s of ready) if (!s.eye) need.push(`Indiquez l'œil (gauche ou droit) de ${nameOf(s)}.`);
    $("#irisGo").disabled = !agreed() || run3.busy || ready.length < 2 || ready.some((s) => !s.eye);
    $("#irisNeed").textContent = need.join(" ");
    $("#irisNoBase").hidden = base.on;
  }
  async function setImage(s, canvas, { lm = null, name, eye, baseRef = null, native = null, map = null } = {}) {
    s.gen++;
    invalidate();
    Object.assign(s, { src: canvas, img: ctx2d(canvas).getImageData(0, 0, canvas.width, canvas.height), lm: null, lmAuto: null, lmSmall: null, cache: null, msg: "", warn: "", baseRef, native, map, opening: null });
    if (name != null) s.name = name;
    if (eye != null) s.eye = eye;
    if (lm && validLandmarks(lm, canvas.width, canvas.height) && irisDiameter(lm) >= MIN_IRIS_PX) {
      s.lm = lm;
      s.status = "ready";
      s.msg = "Repères repris de ma base." + smallNote(lm);
      renderSlot2(s);
      return;
    }
    if (lm) {
      s.lm = validLandmarks(lm, canvas.width, canvas.height) ? lm : defaultLandmarks(s.img);
      s.status = "tofix";
      s.msg = "Repères de ma base à vérifier : « Corriger les repères », puis validez.";
      s.warn = "1";
      renderSlot2(s);
      return;
    }
    await locate(s);
  }
  async function locate(s, { open: open2 = true } = {}) {
    const gen = ++s.gen, t0 = performance.now();
    s.status = "busy";
    s.msg = "Repérage de l'iris…";
    s.warn = "";
    renderSlot2(s);
    let lm = null;
    try {
      lm = await segmentIris(s.img, { onStep: (t) => gen === s.gen && ($(".istate", el2(s)).textContent = `${t}…`) });
    } catch (e) {
      console.error(e);
    }
    if (gen !== s.gen) return;
    if (lm && s.native) {
      try {
        const done = await recropNative(s, lm, gen);
        if (gen !== s.gen) return;
        if (done) {
          Object.assign(s, { src: done.src, img: done.img, map: done.map, cache: null });
          lm = done.lm;
        }
      } catch (e) {
        console.warn(e);
      }
    }
    const secs = ((performance.now() - t0) / 1e3).toFixed(1).replace(".", ",");
    if (!lm) {
      s.status = "tofix";
      s.lm = defaultLandmarks(s.img);
      s.msg = "Iris non trouvé automatiquement : placez les repères (« Corriger les repères »), puis validez.";
      s.warn = "1";
      renderSlot2(s);
      say3(`${nameOf(s)} : iris non trouvé, repères à placer à la main.`);
      if (open2 && canAutoOpen()) openFix(s);
      return;
    }
    const d = irisDiameter(lm) / (s.map?.f || 1);
    if (d < MIN_IRIS_PX) {
      s.status = "error";
      s.lm = null;
      s.lmSmall = lm;
      s.msg = `Iris trop petit (${Math.round(d)} px de diamètre, minimum ${MIN_IRIS_PX}) : prenez la photo de plus près, ou corrigez les repères si le bord est mal placé.`;
      s.warn = "1";
      renderSlot2(s);
      return;
    }
    s.lm = lm;
    s.lmAuto = lm;
    s.status = "ready";
    s.msg = (lm.seen < 0.4 ? `Repérage incertain (bord de l'iris peu visible) : vérifiez les repères.` : `Iris repéré en ${secs} s.`) + smallNote(lm);
    s.warn = lm.seen < 0.4 ? "1" : "";
    renderSlot2(s);
    say3(`${nameOf(s)} : ${s.msg}`);
  }
  async function recropNative(s, lm, gen) {
    const m = s.map || { ox: 0, oy: 0, f: 1 };
    let rmax = 0;
    for (const v of lm.ro) rmax = Math.max(rmax, v);
    const roomy = lm.cx - 1.6 * rmax >= 0 && lm.cy - 1.6 * rmax >= 0 && lm.cx + 1.6 * rmax <= s.img.width && lm.cy + 1.6 * rmax <= s.img.height;
    const whole = m.ox === 0 && m.oy === 0 && s.img.width === s.native.W;
    if (m.f >= 0.999 && (roomy || whole)) return null;
    const cx = m.ox + lm.cx / m.f, cy = m.oy + lm.cy / m.f, R = rmax / m.f, half = Math.round(R * 2), side = 2 * half;
    const out = Math.round(Math.min(side, MAX_SIDE)), f = out / side, ox = Math.round(cx) - half, oy = Math.round(cy) - half;
    const full = await decodeFull(s.native.file);
    try {
      if (gen !== s.gen) return null;
      const crop = makeCanvas(out, out), g = ctx2d(crop);
      g.fillStyle = "#808080";
      g.fillRect(0, 0, out, out);
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = "high";
      g.drawImage(full, ox, oy, side, side, 0, 0, out, out);
      const lmC = { ...lm, cx: (cx - ox) * f, cy: (cy - oy) * f, rp: lm.rp / m.f * f, ro: Float32Array.from(lm.ro, (v) => v / m.f * f) };
      return { src: crop, img: g.getImageData(0, 0, out, out), map: { ox, oy, f }, lm: lmC };
    } finally {
      full.close?.();
    }
  }
  var smallNote = (lm) => irisDiameter(lm) < MIN_MEASURE_PX ? ` Iris de moins de ${MIN_MEASURE_PX} px : comparaison à l'œil seulement, motifs non mesurés.` : "";
  var canAutoOpen = () => !dialogOpen() && !$("#iris").hidden;
  function defaultLandmarks(img) {
    const m = Math.min(img.width, img.height), ri = m * 0.35;
    return { cx: img.width / 2, cy: img.height / 2, rp: ri * 0.3, ro: new Float32Array(NA).fill(ri), auto: false };
  }
  async function loadFile(s, file) {
    if (!file) return;
    if (!agreed()) return toast("Cochez d'abord l'accord des personnes photographiées.");
    if (!file.size) return toast("Fichier vide.");
    if (file.size > MAX_BYTES) return toast("Photo trop lourde (plus de 20 Mo).");
    if (file.type && !file.type.startsWith("image/")) return toast("Ce fichier n'est pas une image.");
    let full;
    const gen = ++s.gen, prev = s.opening || { status: s.status, msg: s.msg, warn: s.warn };
    s.status = "busy";
    s.msg = "Ouverture de la photo…";
    s.opening = prev;
    renderSlot2(s);
    const fail = (t) => {
      if (gen === s.gen) {
        Object.assign(s, prev, { opening: null });
        renderSlot2(s);
      }
      toast(t);
    };
    try {
      full = await decodeFull(file);
    } catch {
      return fail("Image illisible par ce navigateur (format HEIC ?) : exportez-la en JPEG puis réessayez.");
    }
    if (gen !== s.gen) return full.close?.();
    const W = full.width || full.naturalWidth, H = full.height || full.naturalHeight;
    if (W < 40 || H < 40) {
      full.close?.();
      return fail("Image trop petite pour contenir un iris mesurable.");
    }
    const k = Math.min(1, MAX_SIDE / Math.max(W, H)), c = makeCanvas(W * k, H * k), g = ctx2d(c);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    g.drawImage(full, 0, 0, c.width, c.height);
    full.close?.();
    await setImage(s, c, { baseRef: null, native: { file, W, H }, map: { ox: 0, oy: 0, f: k } });
  }
  async function decodeFull(file) {
    if (window.createImageBitmap)
      try {
        return await createImageBitmap(file, { imageOrientation: "from-image" });
      } catch {
      }
    return await new Promise((res, rej) => {
      const url = URL.createObjectURL(file), im = new Image();
      im.onload = () => {
        URL.revokeObjectURL(url);
        res(im);
      };
      im.onerror = () => {
        URL.revokeObjectURL(url);
        rej(new Error("image illisible"));
      };
      im.src = url;
    });
  }
  function clearSlot2(s) {
    Object.assign(s, blank2(s.i), { gen: s.gen + 1 });
    invalidate();
    renderSlot2(s);
  }
  function clearIris() {
    stopBurst();
    if (fix.s) {
      fix.s = null;
      if (!$("#irisFixSheet").hidden) closeDialog();
    }
    if (!$("#irisBurstSheet").hidden) closeDialog();
    islots.forEach(clearSlot2);
  }
  var irisHasContent = () => islots.some((s) => s.src);
  var snapshotIris = () => islots.map((s) => ({ ...s }));
  function restoreIris(snap) {
    invalidate();
    const refs = new Set(base.items.map((i) => i.ref));
    snap.forEach((o, i) => {
      const s = islots[i];
      Object.assign(s, o, { gen: s.gen + 1, baseRef: o.baseRef && refs.has(o.baseRef) ? o.baseRef : null });
      if (o.opening) Object.assign(s, o.opening, { opening: null });
      else if (o.status === "busy" && s.img) locate(s, { open: false });
    });
    islots.forEach(renderSlot2);
  }
  var fix = { s: null, lm: null, cont: null, sel: "c", half: 0, ox: 0, oy: 0, k: 1, drag: null, pan: null, ptrs: /* @__PURE__ */ new Map(), pinch: null };
  var copyLm = (lm) => ({ cx: lm.cx, cy: lm.cy, rp: lm.rp, ro: Float32Array.from(lm.ro), auto: lm.auto });
  function initContour() {
    const lm = fix.lm, pts = [];
    for (let a = 0; a < NA; a++) {
      const t = a / NA * 2 * Math.PI;
      pts.push([lm.cx + lm.ro[a] * Math.cos(t), lm.cy + lm.ro[a] * Math.sin(t)]);
    }
    fix.cont = pts;
  }
  function irisCircle() {
    const c = fitCircle(fix.cont, 3, 3);
    return isFinite(c.r) && c.r > 0 ? c : { cx: fix.lm.cx, cy: fix.lm.cy, r: edgeAt(fix.lm.ro, Math.PI) || 1 };
  }
  function syncRo() {
    const lm = fix.lm, P = fix.cont, n = P.length;
    for (let a = 0; a < NA; a++) {
      const t = a / NA * 2 * Math.PI, dx = Math.cos(t), dy = Math.sin(t);
      let best = Infinity;
      for (let j = 0; j < n; j++) {
        const [x1, y1] = P[j], [x2, y2] = P[(j + 1) % n], ex = x2 - x1, ey = y2 - y1, den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-9) continue;
        const qx = x1 - lm.cx, qy = y1 - lm.cy, r = (qx * ey - qy * ex) / den, u = (qx * dy - qy * dx) / den;
        if (r > 0 && u >= 0 && u <= 1 && r < best) best = r;
      }
      lm.ro[a] = isFinite(best) ? best : NaN;
    }
  }
  async function fullView(s) {
    const bm = await decodeFull(s.native.file);
    try {
      const W = bm.width || bm.naturalWidth, H = bm.height || bm.naturalHeight, k = Math.min(1, MAX_SIDE / Math.max(W, H)), c = makeCanvas(W * k, H * k), g = ctx2d(c);
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = "high";
      g.drawImage(bm, 0, 0, c.width, c.height);
      return { src: c, img: g.getImageData(0, 0, c.width, c.height), k };
    } finally {
      bm.close?.();
    }
  }
  function toFull(lm, m, k) {
    const q = k / m.f;
    return { ...lm, cx: (m.ox + lm.cx / m.f) * k, cy: (m.oy + lm.cy / m.f) * k, rp: lm.rp * q, ro: Float32Array.from(lm.ro, (v) => v * q) };
  }
  function openFix(s) {
    if (!s.src) return;
    fix.seq = (fix.seq || 0) + 1;
    fix.s = s;
    fix.src = s.src;
    fix.img = s.img;
    fix.kFull = 0;
    fix.lm = copyLm(s.lm || s.lmSmall || defaultLandmarks(s.img));
    initContour();
    fix.errAt = 0;
    focusIris();
    $("#irisFixWho").textContent = ` : ${nameOf(s)}`;
    $("#irisFixAuto").hidden = !!s.baseRef && !s.lmAuto;
    selectHandle("c");
    openDialog($("#irisFixSheet"), () => {
      if (fix.s === s) fix.s = null;
      if (fix.kFull && fix.src && fix.src !== s.src) fix.src.width = 0;
      fix.src = fix.img = null;
    });
    drawFix();
    const m = s.map, whole = m && m.ox === 0 && m.oy === 0 && Math.abs(s.img.width / m.f - s.native?.W) < 2;
    if (s.native && m && !whole) {
      const gen = s.gen, seq2 = fix.seq;
      fullView(s).then((v) => {
        if (fix.s !== s || gen !== s.gen || fix.seq !== seq2 || fix.kFull) return void (v.src.width = 0);
        const X = (x) => (m.ox + x / m.f) * v.k, Y = (y) => (m.oy + y / m.f) * v.k, q = v.k / m.f;
        fix.lm = toFull(fix.lm, m, v.k);
        fix.cont = fix.cont.map(([x, y]) => [X(x), Y(y)]);
        fix.ox = X(fix.ox);
        fix.oy = Y(fix.oy);
        fix.half *= q;
        if (fix.pan) fix.pan.ox = X(fix.pan.ox), fix.pan.oy = Y(fix.pan.oy);
        if (fix.next) fix.next = [X(fix.next[0]), Y(fix.next[1])];
        fix.src = v.src;
        fix.img = v.img;
        fix.kFull = v.k;
        drawFix();
        say3("Photo entière chargée : dézoomez pour la voir.");
      }).catch((e) => console.warn(e));
    }
  }
  function focusIris() {
    const c = irisCircle();
    fix.half = Math.max(c.r * 1.45, 40);
    fix.ox = c.cx - fix.half;
    fix.oy = c.cy - fix.half;
  }
  function fitAll() {
    const { width: W, height: H } = fix.img;
    fix.half = Math.max(W, H) / 2 * 1.02;
    fix.ox = W / 2 - fix.half;
    fix.oy = H / 2 - fix.half;
  }
  function zoomAt(f, px, py) {
    const { width: W, height: H } = fix.img, nh = Math.max(12, Math.min(Math.max(W, H) * 0.6, fix.half / f)), q = nh / fix.half;
    fix.ox = px - (px - fix.ox) * q;
    fix.oy = py - (py - fix.oy) * q;
    fix.half = nh;
    drawFix();
  }
  var viewCenter = () => [fix.ox + fix.half, fix.oy + fix.half];
  function selectHandle(h) {
    fix.sel = h;
    for (const b of $$("#irisFixSel button")) b.setAttribute("aria-pressed", String(b.dataset.sel === h));
    $("#irisPadMove").hidden = h !== "c" && h !== "ic";
    $("#irisPadSize").hidden = h === "c" || h === "ic";
  }
  function handlePos(h) {
    const lm = fix.lm;
    if (h === "c") return [lm.cx, lm.cy];
    if (h === "p") return [lm.cx + lm.rp, lm.cy];
    const c = irisCircle();
    return h === "ic" ? [c.cx, c.cy] : [c.cx - c.r, c.cy];
  }
  function drawFix() {
    const cv = $("#irisFixCanvas"), W = cv.width, g = cv.getContext("2d"), lm = fix.lm;
    fix.k = W / (2 * fix.half);
    g.fillStyle = "#808080";
    g.fillRect(0, 0, W, W);
    g.drawImage(fix.src, fix.ox, fix.oy, 2 * fix.half, 2 * fix.half, 0, 0, W, W);
    const X = (x) => (x - fix.ox) * fix.k, Y = (y) => (y - fix.oy) * fix.k;
    for (const [w, col] of [[4, "rgba(0,0,0,.75)"], [2, "#fff"]]) {
      g.lineWidth = w;
      g.strokeStyle = col;
      g.setLineDash([]);
      g.beginPath();
      fix.cont.forEach(([x, y], j) => j ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)));
      g.closePath();
      g.stroke();
      g.setLineDash(w === 2 ? [6, 4] : []);
      g.beginPath();
      g.arc(X(lm.cx), Y(lm.cy), lm.rp * fix.k, 0, 2 * Math.PI);
      g.stroke();
    }
    g.setLineDash([]);
    for (const b of $$("#irisFixWrap .hdl")) {
      const [x, y] = handlePos(b.dataset.h), sx = X(x) / W, sy = Y(y) / W, inView = sx >= 0 && sx <= 1 && sy >= 0 && sy <= 1;
      const keep = b.dataset.h === fix.sel || document.activeElement === b, cl = (v) => Math.max(0, Math.min(1, v));
      b.hidden = !inView && !keep;
      b.style.left = `${(inView ? sx : cl(sx)) * 100}%`;
      b.style.top = `${(inView ? sy : cl(sy)) * 100}%`;
      b.setAttribute("aria-pressed", String(b.dataset.h === fix.sel));
    }
    $("#irisZoomVal").textContent = `${Math.round(fix.k * 100)} %`;
    paintBand();
    announce();
  }
  var paintBand = debounce(() => {
    if (!fix.s) return;
    if (!validLandmarks(fix.lm, fix.img.width, fix.img.height)) {
      const cv2 = $("#irisFixBand");
      cv2.getContext("2d").clearRect(0, 0, cv2.width, cv2.height);
      return;
    }
    const b = previewBand(fix.img, fix.lm, { mirror: fix.s.eye === "G" }), cv = $("#irisFixBand");
    cv.width = b.width;
    cv.height = b.height;
    cv.getContext("2d").putImageData(new ImageData(b.data, b.width, b.height), 0, 0);
  }, 80);
  var announce = debounce(() => {
    if (!fix.s || performance.now() - (fix.errAt || 0) < 1500) return;
    const c = irisCircle(), lm = fix.lm, off = Math.hypot(lm.cx - c.cx, lm.cy - c.cy);
    $("#irisFixVals").textContent = `Pupille : ${Math.round(2 * lm.rp)} px de diamètre (${Math.round(lm.rp / c.r * 100)} % de l'iris). Iris : ${Math.round(2 * c.r)} px de diamètre. Écart entre les deux centres : ${Math.round(off)} px.`;
  }, 300);
  function applyMove(h, x, y) {
    const lm = fix.lm;
    if (h === "c") {
      lm.cx = x;
      lm.cy = y;
    } else if (h === "p") {
      let minR = Infinity;
      for (const v of lm.ro) if (isFinite(v)) minR = Math.min(minR, v);
      lm.rp = Math.max(2, Math.min(minR / 1.2 - 1, Math.hypot(x - lm.cx, y - lm.cy)));
    } else if (h === "ic") {
      const c = irisCircle(), dx = x - c.cx, dy = y - c.cy;
      for (const p of fix.cont) p[0] += dx, p[1] += dy;
    } else {
      const c = irisCircle(), f = Math.max(lm.rp * 1.25, Math.hypot(x - c.cx, y - c.cy)) / c.r;
      for (const p of fix.cont) p[0] = c.cx + (p[0] - c.cx) * f, p[1] = c.cy + (p[1] - c.cy) * f;
    }
    if (h !== "p") syncRo();
    lm.auto = false;
    drawFix();
  }
  function nudge(h, dx, dy, big, size = null) {
    const step2 = Math.max(0.25, 2 / fix.k) * (big === true ? 10 : big === "btn" ? 4 : 1), [x, y] = handlePos(h);
    if (h === "c" || h === "ic") return applyMove(h, x + dx * step2, y + dy * step2);
    const grow = size ?? (dy < 0 ? 1 : dy > 0 ? -1 : h === "p" ? Math.sign(dx) : -Math.sign(dx));
    if (h === "p") return applyMove("p", fix.lm.cx + fix.lm.rp + grow * step2, fix.lm.cy);
    const c = irisCircle();
    applyMove("i", c.cx - (c.r + grow * step2), c.cy);
  }
  function pointerToImage(e) {
    const r = $("#irisFixCanvas").getBoundingClientRect(), W = $("#irisFixCanvas").width;
    return [fix.ox + (e.clientX - r.left) / r.width * W / fix.k, fix.oy + (e.clientY - r.top) / r.height * W / fix.k];
  }
  function initFix() {
    const wrap = $("#irisFixWrap");
    wrap.addEventListener("pointerdown", (e) => {
      const b = e.target.closest(".hdl");
      if (b) {
        e.preventDefault();
        selectHandle(b.dataset.h);
        fix.drag = b.dataset.h;
        fix.dragId = e.pointerId;
        b.setPointerCapture?.(e.pointerId);
        b.focus();
        return;
      }
      fix.ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      wrap.setPointerCapture?.(e.pointerId);
      if (fix.ptrs.size === 1) fix.pan = { x: e.clientX, y: e.clientY, ox: fix.ox, oy: fix.oy };
      else if (fix.ptrs.size === 2) {
        const [p1, p2] = [...fix.ptrs.values()];
        fix.pan = null;
        fix.pinch = { d: Math.hypot(p1[0] - p2[0], p1[1] - p2[1]) || 1 };
      }
    });
    wrap.addEventListener("pointermove", (e) => {
      if (fix.drag) {
        if (e.pointerId !== fix.dragId) return;
        fix.next = pointerToImage(e);
        if (!fix.raf)
          fix.raf = requestAnimationFrame(() => {
            fix.raf = 0;
            if (fix.drag && fix.next) applyMove(fix.drag, ...fix.next);
          });
        return;
      }
      if (!fix.ptrs.has(e.pointerId)) return;
      fix.ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      const r = $("#irisFixCanvas").getBoundingClientRect(), sc = $("#irisFixCanvas").width / r.width / fix.k;
      if (fix.pinch && fix.ptrs.size === 2) {
        const [p1, p2] = [...fix.ptrs.values()], d = Math.hypot(p1[0] - p2[0], p1[1] - p2[1]) || 1;
        const [mx, my] = pointerToImage({ clientX: (p1[0] + p2[0]) / 2, clientY: (p1[1] + p2[1]) / 2 });
        zoomAt(d / fix.pinch.d, mx, my);
        fix.pinch.d = d;
      } else if (fix.pan) {
        fix.ox = fix.pan.ox - (e.clientX - fix.pan.x) * sc;
        fix.oy = fix.pan.oy - (e.clientY - fix.pan.y) * sc;
        drawFix();
      }
    });
    const end = (e) => {
      if (e.pointerId === fix.dragId) fix.drag = fix.dragId = null;
      fix.ptrs.delete(e.pointerId);
      if (fix.ptrs.size < 2) fix.pinch = null;
      if (fix.ptrs.size === 1) {
        const [p] = [...fix.ptrs.values()];
        fix.pan = { x: p[0], y: p[1], ox: fix.ox, oy: fix.oy };
      } else if (!fix.ptrs.size) fix.pan = null;
    };
    wrap.addEventListener("pointerup", end);
    wrap.addEventListener("pointercancel", end);
    wrap.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const [x, y] = pointerToImage(e);
        zoomAt(Math.exp(-e.deltaY * 15e-4), x, y);
      },
      { passive: false }
    );
    wrap.addEventListener("keydown", (e) => {
      if (e.key === "+" || e.key === "=" || e.key === "-" || e.key === "0") {
        e.preventDefault();
        if (e.key === "0") return fitAll(), drawFix();
        const [cx, cy] = viewCenter();
        return zoomAt(e.key === "-" ? 1 / 1.5 : 1.5, cx, cy);
      }
      const b = e.target.closest(".hdl"), d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!b || !d) return;
      e.preventDefault();
      selectHandle(b.dataset.h);
      nudge(b.dataset.h, d[0], d[1], e.shiftKey);
    });
    wrap.addEventListener("click", (e) => {
      const b = e.target.closest(".hdl");
      if (b) selectHandle(b.dataset.h);
    });
    $("#irisFixSel").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-sel]");
      if (!b) return;
      selectHandle(b.dataset.sel);
      drawFix();
    });
    $("#irisZoom").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-zoom]");
      if (!b || !fix.s) return;
      const z = b.dataset.zoom, [cx, cy] = viewCenter();
      if (z === "in") zoomAt(1.5, cx, cy);
      else if (z === "out") zoomAt(1 / 1.5, cx, cy);
      else {
        z === "all" ? fitAll() : focusIris();
        drawFix();
      }
    });
    for (const b of $$("#irisFixSheet [data-nudge]"))
      b.addEventListener("click", () => {
        const [dx, dy] = b.dataset.nudge.split(",").map(Number);
        nudge(fix.sel === "ic" ? "ic" : "c", dx, dy, "btn");
      });
    for (const b of $$("#irisFixSheet [data-size]")) b.addEventListener("click", () => nudge(fix.sel, 0, 0, "btn", Number(b.dataset.size)));
    $("#irisFixOk").addEventListener("click", async () => {
      const s = fix.s;
      if (!s) return;
      if (fix.lm.ro.some((v) => !isFinite(v))) {
        fix.errAt = performance.now();
        $("#irisFixVals").textContent = "Le centre de la pupille est hors de l'iris : rapprochez Cp et Ci.";
        return;
      }
      if (!validLandmarks(fix.lm, fix.img.width, fix.img.height)) {
        fix.errAt = performance.now();
        $("#irisFixVals").textContent = "Repères incohérents : le bord de l'iris doit entourer la pupille d'au moins 20 %. Agrandissez le bord ou réduisez la pupille.";
        return;
      }
      const dNat = irisDiameter(fix.lm) / (fix.kFull || s.map?.f || 1);
      if (dNat < MIN_IRIS_PX) {
        fix.errAt = performance.now();
        $("#irisFixVals").textContent = `Iris trop petit (${Math.round(dNat)} px, minimum ${MIN_IRIS_PX}) : prenez la photo de plus près.`;
        return;
      }
      let lmV = copyLm(fix.lm);
      if (s.native) {
        const g0 = s.gen, seq2 = fix.seq, kF = fix.kFull, fSrc = fix.src, fImg = fix.img;
        $("#irisFixOk").disabled = true;
        $("#irisFixVals").textContent = "Découpe de l'iris dans la photo d'origine…";
        let done = null;
        try {
          done = await recropNative(kF ? { native: s.native, get gen() {
            return s.gen;
          }, img: fImg, map: { ox: 0, oy: 0, f: kF } } : s, lmV, g0);
        } catch (e) {
          console.warn(e);
        } finally {
          $("#irisFixOk").disabled = false;
        }
        if (!done && kF) done = { src: fSrc, img: fImg, map: { ox: 0, oy: 0, f: kF }, lm: lmV };
        if (g0 !== s.gen || fix.s !== s || fix.seq !== seq2) return;
        if (done) {
          Object.assign(s, { src: done.src, img: done.img, map: done.map });
          lmV = done.lm;
          s.lmAuto = null;
        }
      }
      s.lm = lmV;
      s.cache = null;
      s.status = "ready";
      s.msg = (s.lm.auto ? "Repérage automatique." : "Repères corrigés à la main.") + smallNote(s.lm);
      s.warn = "";
      s.lmSmall = null;
      s.gen++;
      invalidate();
      fix.s = null;
      closeDialog();
      renderSlot2(s);
      if (s.baseRef) {
        const it = base.items.find((i) => i.ref === s.baseRef);
        try {
          const ok = it && await updateIfExists({ ...it, lm: packLandmarks(s.lm) });
          if (!ok) {
            s.baseRef = null;
            toast("Cet iris n'est plus dans ma base (supprimé ailleurs) : les repères restent ici seulement.");
          }
          await refreshBase();
        } catch (e) {
          console.error(e);
          toast("Repères non mis à jour dans ma base.");
        }
        renderSlot2(s);
      }
      $("[data-act=fix]", el2(s))?.focus();
    });
    $("#irisFixAuto").addEventListener("click", async () => {
      const s = fix.s;
      if (!s) return;
      if (!s.lmAuto) {
        $("#irisFixVals").textContent = "Repérage automatique en cours…";
        const gen = s.gen, img = s.img, lm = await segmentIris(img).catch(() => null);
        if (fix.s !== s || gen !== s.gen || img !== s.img) return;
        if (!lm || !validLandmarks(lm, img.width, img.height) || irisDiameter(lm) / (s.map?.f || 1) < MIN_IRIS_PX) {
          $("#irisFixVals").textContent = "Le repérage automatique ne trouve pas l'iris sur cette photo : gardez la correction à la main.";
          return;
        }
        s.lmAuto = lm;
      }
      fix.lm = copyLm(fix.kFull ? toFull(s.lmAuto, s.map, fix.kFull) : s.lmAuto);
      initContour();
      drawFix();
      $("#irisFixOk").focus();
    });
  }
  var yieldNow3 = () => new Promise((r) => setTimeout(r, 0));
  async function compareIris() {
    const list = readyOf().filter((s) => s.eye);
    if (list.length < 2 || run3.busy) return;
    run3.busy = true;
    const gen = ++run3.gen, t0 = performance.now();
    let step2 = "";
    const st = $("#irisStatus"), paint = () => gen === run3.gen && (st.textContent = `${step2} (${Math.round((performance.now() - t0) / 1e3)} s)`);
    const tick = setInterval(paint, 1e3);
    $("#irisCancel").hidden = false;
    updateGo();
    say3("Comparaison des iris : analyse en cours.");
    try {
      for (const [n, s] of list.entries()) {
        const key = `${JSON.stringify(packLandmarks(s.lm))}|${s.eye}`;
        if (s.cache?.key === key) continue;
        const res = await analyzeIris(s.img, s.lm, {
          mirror: s.eye === "G",
          stop: () => gen !== run3.gen,
          onStep: (t) => {
            step2 = `Iris ${n + 1} sur ${list.length} : ${t}…`;
            paint();
          }
        });
        if (gen !== run3.gen) return;
        s.cache = { key, res };
        await yieldNow3();
      }
      if (gen !== run3.gen) return;
      run3.res = list.map((s) => ({ s, eye: s.eye, ...s.cache.res }));
      renderResults2();
      st.textContent = `Comparaison terminée en ${Math.round((performance.now() - t0) / 1e3)} s.`;
      say3(`Comparaison des iris terminée.${$("#irisSmallWarn").hidden ? "" : " " + $("#irisSmallWarn").textContent}`);
    } catch (e) {
      if (gen !== run3.gen) return;
      console.error(e);
      st.textContent = "La comparaison n'a pas abouti.";
    } finally {
      clearInterval(tick);
      if (gen === run3.gen) {
        $("#irisCancel").hidden = true;
        run3.busy = false;
        updateGo();
      }
    }
  }
  var sideLine = (t, A, B) => t.side == null ? "Non mesurable" : t.side === "egalite" ? `Égalité entre ${A} et ${B}` : `Plus proche de : ${t.side === "a" ? A : B}`;
  var nm2 = (r) => nameOf(r.s);
  function bandDesc(r) {
    const parts = MOTIFS.map((m) => `${m.label.toLowerCase()} : ${r.F[m.key] == null ? `non mesurable (${r.why[m.key]})` : describe2(m.key, r.F[m.key])}`);
    return `Iris de ${nm2(r)}, ${EYE[r.eye]}, déroulé de la pupille (en haut) au bord (en bas), sur un tour complet en partant du côté du nez. ${parts.join(" ; ")}.`;
  }
  function drawBand(cv, r) {
    const { width: w, height: h } = r.band, g = cv.getContext("2d");
    cv.width = w;
    cv.height = h;
    g.putImageData(new ImageData(r.band.data, w, h), 0, 0);
    const line = (y, dash) => {
      for (const [lw, c] of [[3, "rgba(0,0,0,.7)"], [1.5, "#fff"]]) {
        g.lineWidth = lw;
        g.strokeStyle = c;
        g.setLineDash(dash);
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(w, y);
        g.stroke();
      }
    };
    line(h / 3, [6, 6]);
    line(2 * h / 3, [6, 6]);
    if (r.F.collerette != null) line(r.F.collerette * h, []);
    g.setLineDash([]);
  }
  function renderResults2() {
    const R = run3.res;
    if (!R) return;
    $("#irisResults").hidden = false;
    const box = $("#irisBands");
    box.innerHTML = R.map((r, k) => `<figure class="iband"><figcaption><strong>${esc(nm2(r))}</strong> · ${EYE[r.eye]}</figcaption>
      <div class="bandrow"><div class="bandaxis" aria-hidden="true"><span>pupille</span><span>bord</span></div><canvas data-k="${k}" role="img" aria-label="${esc(bandDesc(r))}"></canvas></div></figure>`).join("");
    for (const cv of $$("canvas", box)) drawBand(cv, R[cv.dataset.k]);
    const small = R.filter(tooSmall);
    $("#irisSmallWarn").hidden = !small.length;
    $("#irisSmallWarn").textContent = small.length ? `${small.map((r) => `Iris de ${nm2(r)} : ${Math.round(irisDiameter(r.s.lm))} px de diamètre`).join(" ; ")}. Il en faut au moins ${MIN_MEASURE_PX} pour mesurer les motifs : comparez à l'œil, ou importez une photo plus rapprochée.` : "";
    const eyes = new Set(R.map((r) => r.eye));
    $("#irisEyeWarn").hidden = eyes.size < 2;
    const trioMode = R.length === 3 && R[0].s.i === 0;
    const vals = (m) => `<ul class="ivals">${R.map((r) => `<li><strong>${esc(nm2(r))}</strong> : ${esc(cellText(r, m))}</li>`).join("")}</ul>`;
    let cards;
    if (trioMode) {
      const T2 = trio(R[0].F, R[1].F, R[2].F);
      $("#irisTableIntro").textContent = `Pour chaque motif : de quel parent ${nm2(R[0])} est le plus proche, ou égalité. Il n'y a pas de total.`;
      cards = MOTIFS.map((m, k) => `<li class="imotif"><h3>${esc(m.label)}</h3><p class="hint">${esc(m.what)}</p>${vals(m)}<p class="iside">${esc(sideLine(T2[k], nm2(R[1]), nm2(R[2])))}</p></li>`);
    } else {
      $("#irisTableIntro").textContent = R.length === 2 ? `Pour chaque motif : à quel point les deux iris se ressemblent. Il n'y a pas de total.` : `Pour comparer une personne à ses deux parents, placez-la en iris 1. Ici : proximité de chaque paire, motif par motif.`;
      const pairs = [];
      for (let a = 0; a < R.length; a++) for (let b = a + 1; b < R.length; b++) pairs.push([a, b]);
      cards = MOTIFS.map((m) => `<li class="imotif"><h3>${esc(m.label)}</h3><p class="hint">${esc(m.what)}</p>${vals(m)}${pairs.map(([a, b]) => `<p class="iside">${esc(nm2(R[a]))} et ${esc(nm2(R[b]))} : ${esc(pairWords(gap(m, R[a].F, R[b].F)))}</p>`).join("")}</li>`);
    }
    $("#irisTable").innerHTML = cards.join("");
    $("#irisShare").hidden = !navigator.share;
  }
  var tooSmall = (r) => Object.values(r.why || {}).some((w) => /trop petit/.test(w));
  var cellText = (r, m) => r.F[m.key] == null ? tooSmall(r) ? "non mesuré (iris trop petit)" : `non mesurable (${r.why[m.key]})` : describe2(m.key, r.F[m.key]);
  function resultText() {
    const R = run3.res;
    if (!R) return "";
    const L = [`Air de famille, comparaison d'iris (${R.map((r) => `${nm2(r)}, ${EYE[r.eye]}`).join(" ; ")})`];
    const trioMode = R.length === 3 && R[0].s.i === 0;
    if (trioMode) {
      const T2 = trio(R[0].F, R[1].F, R[2].F);
      MOTIFS.forEach((m, k) => L.push(`- ${m.label} : ${sideLine(T2[k], nm2(R[1]), nm2(R[2]))}`));
    } else
      for (let a = 0; a < R.length; a++)
        for (let b = a + 1; b < R.length; b++) {
          L.push(`${nm2(R[a])} et ${nm2(R[b])} :`);
          for (const m of MOTIFS) L.push(`- ${m.label} : ${pairWords(gap(m, R[a].F, R[b].F))}`);
        }
    L.push("Indice, pas une preuve : l'iris de chacun est unique. Aucune image n'est partagée.");
    return L.join("\n");
  }
  var keepPending = null;
  function askKeep(s) {
    if (!s.lm || !base.on) return;
    const person = s.name.trim();
    if (!person) {
      toast("Indiquez d'abord le prénom pour garder cet iris.");
      $("[data-f=name]", el2(s)).focus();
      return;
    }
    if (!s.eye) {
      toast("Indiquez d'abord l'œil photographié.");
      return;
    }
    keepPending = { s, person, eye: s.eye, gen: s.gen };
    $("#irisKeepWho").innerHTML = `J'ai l'accord de <strong>${esc(person)}</strong> (pour un enfant : de ses parents) pour garder la photo de son iris (${EYE[s.eye]}) sur ce téléphone.`;
    $("#irisKeepOk").checked = false;
    $("#irisKeepGo").disabled = true;
    openDialog($("#irisKeepSheet"));
  }
  async function doKeep() {
    const p = keepPending;
    keepPending = null;
    closeDialog();
    if (!p || p.gen !== p.s.gen || !base.on) return;
    const s = p.s;
    try {
      const { img, lm } = irisCrop(s.img, s.lm);
      const c = makeCanvas(img.width, img.height);
      c.getContext("2d").putImageData(new ImageData(img.data, img.width, img.height), 0, 0);
      const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.92));
      if (!blob?.size) throw new Error("image vide");
      const ref = `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
      await addItem({ kind: "iris", ref, person: p.person, eye: p.eye, added: (/* @__PURE__ */ new Date()).toISOString(), lm: packLandmarks(lm), jpeg: blob });
      await refreshBase();
      if (p.gen !== s.gen) {
        toast(`Iris de ${p.person} gardé dans ma base.`);
        return;
      }
      invalidate();
      Object.assign(s, { src: c, img: ctx2d(c).getImageData(0, 0, c.width, c.height), lm, lmAuto: null, cache: null, baseRef: ref, name: p.person, eye: p.eye, native: null, map: null, opening: null });
      s.gen++;
      await refreshBase();
      toast(`Iris de ${p.person} gardé dans ma base.`);
    } catch (e) {
      console.error(e);
      toast("L'iris n'a pas pu être gardé (stockage plein ou base supprimée ?).");
    }
    renderSlot2(s);
    $("[data-act=fix]", el2(s))?.focus();
  }
  var baseTarget = null;
  async function openFromBase(s) {
    if (!agreed()) return;
    baseTarget = s;
    await renderBaseList();
    $("#irisBaseTitle").textContent = `Choisir un iris de ma base (${ROLES[s.i].toLowerCase()})`;
    openDialog($("#irisBaseSheet"));
  }
  async function renderBaseList() {
    const items = base.items.filter((i) => i.kind === "iris");
    const list = $("#irisBaseList");
    list.innerHTML = items.map((it) => `<button type="button" class="ibitem" data-ref="${esc(it.ref)}"><canvas width="64" height="64" aria-hidden="true"></canvas><span>Iris de ${esc(it.person)}, ${EYE[it.eye] || "œil non précisé"}</span></button>`).join("") || `<p class="hint">Aucun iris dans ma base.</p>`;
    for (const b of $$(".ibitem", list)) {
      const it = items.find((i) => i.ref === b.dataset.ref);
      try {
        const bmp = await createImageBitmap(it.jpeg);
        $("canvas", b).getContext("2d").drawImage(bmp, 0, 0, 64, 64);
        bmp.close?.();
      } catch {
      }
    }
  }
  async function useFromBase(ref) {
    const s = baseTarget, it = base.items.find((i) => i.ref === ref);
    baseTarget = null;
    closeDialog();
    if (s && !it) toast("Cet iris n'est plus dans ma base (supprimé ailleurs).");
    if (!s || !it) return;
    try {
      const bmp = await createImageBitmap(it.jpeg), c = makeCanvas(bmp.width, bmp.height);
      c.getContext("2d").drawImage(bmp, 0, 0);
      bmp.close?.();
      await setImage(s, c, { lm: unpackLandmarks(it.lm), name: it.person, eye: it.eye || "", baseRef: it.ref });
      toast(`Iris de ${it.person} chargé depuis ma base (mesures recalculées).`);
    } catch (e) {
      console.error(e);
      toast("Cet iris n'a pas pu être relu.");
    }
    $("[data-act=fix]", el2(s))?.focus();
  }
  function initIris() {
    $("#irisSlots").innerHTML = islots.map(slotHtml).join("");
    const box = $("#irisSlots");
    box.addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]");
      if (!b) return;
      const s = islots[Number(b.closest(".islot").dataset.i)], act = b.dataset.act;
      if (act === "pick") $("[data-f=file]", el2(s)).click();
      else if (act === "burst") $("[data-f=burst]", el2(s)).click();
      else if (act === "fix") openFix(s);
      else if (act === "clear") {
        clearSlot2(s);
        $("[data-act=pick]", el2(s)).focus();
      } else if (act === "keep") askKeep(s);
      else if (act === "frombase") openFromBase(s);
    });
    box.addEventListener("change", (e) => {
      const s = islots[Number(e.target.closest(".islot").dataset.i)];
      if (e.target.dataset.f === "file") {
        const f = e.target.files?.[0];
        e.target.value = "";
        loadFile(s, f);
      } else if (e.target.dataset.f === "burst") {
        const fs = [...e.target.files || []];
        e.target.value = "";
        runBurst(s, fs);
      } else if (e.target.type === "radio") {
        s.eye = e.target.value;
        invalidate();
        renderSlot2(s);
      }
    });
    box.addEventListener("input", (e) => {
      if (e.target.dataset.f !== "name") return;
      const s = islots[Number(e.target.closest(".islot").dataset.i)];
      if (s.baseRef) return;
      s.name = e.target.value;
      updateGo();
      if (run3.res) renderResults2();
    });
    $("#irisAgree").addEventListener("change", () => islots.forEach(renderSlot2));
    $("#irisGo").addEventListener("click", compareIris);
    $("#irisCancel").addEventListener("click", () => {
      run3.gen++;
      run3.busy = false;
      $("#irisStatus").textContent = "Comparaison annulée.";
      say3("Comparaison annulée.");
      $("#irisCancel").hidden = true;
      updateGo();
      $("#irisGo").focus();
    });
    $("#irisCopy").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(resultText());
        toast("Résultats copiés (texte seul, aucune image).");
      } catch {
        toast("Copie impossible sur ce navigateur.");
      }
    });
    $("#irisShare").addEventListener("click", () => navigator.share?.({ title: "Air de famille : iris", text: resultText() }).catch(() => {
    }));
    $("#irisKeepOk").addEventListener("change", () => $("#irisKeepGo").disabled = !$("#irisKeepOk").checked);
    $("#irisKeepGo").addEventListener("click", doKeep);
    $("#irisBaseList").addEventListener("click", (e) => {
      const b = e.target.closest(".ibitem");
      if (b) useFromBase(b.dataset.ref);
    });
    on("base", () => {
      const refs = new Set(base.items.map((i) => i.ref));
      for (const s of islots) if (s.baseRef && !refs.has(s.baseRef)) s.baseRef = null;
      islots.forEach(renderSlot2);
      if (!$("#irisBaseSheet").hidden) base.on && base.items.some((i) => i.kind === "iris") ? renderBaseList() : closeDialog();
      if (!$("#irisKeepSheet").hidden && !base.on) closeDialog();
    });
    initFix();
    initBurst();
    islots.forEach(renderSlot2);
  }
  var MAX_BURST = 20;
  var burst = { s: null, gen: 0, status: "idle", done: 0, total: 0, top: [], why: "" };
  var burstKey = (c) => [c.found ? 1 : 0, c.measurable ? 1 : 0, c.found ? c.sharp * c.seen * Math.max(0, 1 - c.reflets - c.paupieres) : 0];
  var better = (a, b) => {
    const A = burstKey(a), B = burstKey(b);
    for (let i = 0; i < 3; i++) if (A[i] !== B[i]) return A[i] > B[i];
    return false;
  };
  function stopBurst() {
    burst.gen++;
    if (burst.status === "busy" || burst.status === "done") burst.status = "idle";
    burst.top = [];
    $("#irisBurstList").innerHTML = "";
  }
  async function runBurst(s, files) {
    if (!agreed()) return toast("Cochez d'abord l'accord des personnes photographiées.");
    const n0 = files.length;
    files = files.filter((f) => f.size && f.size <= MAX_BYTES && (!f.type || f.type.startsWith("image/")));
    if (!files.length) return toast("Aucune photo utilisable dans la sélection.");
    if (files.length < n0) toast(`${n0 - files.length} fichier(s) écarté(s) : vide, plus de 20 Mo ou pas une image.`);
    if (files.length === 1) return loadFile(s, files[0]);
    if (files.length > MAX_BURST) {
      toast(`Seules les ${MAX_BURST} premières photos sont analysées.`);
      files = files.slice(0, MAX_BURST);
    }
    const gen = ++burst.gen;
    Object.assign(burst, { s, status: "busy", done: 0, total: files.length, top: [], why: "" });
    $("#irisBurstList").innerHTML = "";
    $("#irisBurstMsg").textContent = `Analyse de ${files.length} photos…`;
    $("#irisBurstProg").hidden = false;
    openDialog($("#irisBurstSheet"), () => {
      if (burst.gen === gen) stopBurst();
    });
    const fails = { notfound: 0, small: 0 };
    for (let n = 0; n < files.length; n++) {
      if (burst.gen !== gen) return;
      $("#irisBurstProg").value = n / files.length;
      $("#irisBurstStep").textContent = `Photo ${n + 1} sur ${files.length}`;
      const c = { file: files[n], name: files[n].name || `Photo ${n + 1}`, found: false, measurable: false, sharp: 0, seen: 0, reflets: 0, paupieres: 0, d: 0, thumb: null };
      try {
        const full = await decodeFull(files[n]);
        let cv, g, k;
        try {
          const W = full.width || full.naturalWidth, H = full.height || full.naturalHeight;
          k = Math.min(1, MAX_SIDE / Math.max(W, H));
          cv = makeCanvas(W * k, H * k);
          g = ctx2d(cv);
          g.imageSmoothingEnabled = true;
          g.imageSmoothingQuality = "high";
          g.drawImage(full, 0, 0, cv.width, cv.height);
        } finally {
          full.close?.();
        }
        const img = g.getImageData(0, 0, cv.width, cv.height), lm = await segmentIris(img);
        if (burst.gen !== gen) return;
        if (lm && validLandmarks(lm, img.width, img.height)) {
          c.found = true;
          c.d = irisDiameter(lm) / k;
          c.measurable = c.d >= MIN_MEASURE_PX;
          c.seen = lm.seen ?? 1;
          Object.assign(c, photoQuality(img, lm));
          const half = irisDiameter(lm) / 2 * 1.3, t = makeCanvas(160, 160);
          ctx2d(t).drawImage(cv, lm.cx - half, lm.cy - half, 2 * half, 2 * half, 0, 0, 160, 160);
          c.thumb = t;
        } else fails.notfound++;
        if (c.found && !c.measurable) fails.small++;
        cv.width = cv.height = 0;
      } catch (e) {
        console.warn(e);
        fails.notfound++;
      }
      burst.done = n + 1;
      if (c.found) {
        burst.top.push(c);
        burst.top.sort((a, b) => better(a, b) ? -1 : better(b, a) ? 1 : 0);
        for (const x of burst.top.splice(3)) x.file = x.thumb = null;
      }
      await yieldNow3();
    }
    if (burst.gen !== gen) return;
    burst.status = "done";
    $("#irisBurstProg").value = 1;
    $("#irisBurstProg").hidden = true;
    $("#irisBurstStep").textContent = "";
    renderBurst(fails);
  }
  function burstReason(c, i) {
    const net = c.sharp >= 0.5 ? "nette" : c.sharp >= SHARPNESS_MIN ? "un peu floue" : "floue";
    const parts = [i === 0 ? "Meilleure photo" : `N° ${i + 1}`, net, `iris ${Math.round(c.d)} px${c.measurable ? "" : " (trop petit pour mesurer)"}`, `bord vu à ${Math.round(c.seen * 100)} %`];
    if (c.paupieres >= 0.03) parts.push(`paupière ${Math.round(c.paupieres * 100)} %`);
    if (c.reflets >= 0.03) parts.push(`reflets ${Math.round(c.reflets * 100)} %`);
    return parts.join(" · ");
  }
  function renderBurst(fails) {
    const T2 = burst.top, box = $("#irisBurstList");
    if (!T2.length) {
      burst.why = "Iris trouvé sur aucune photo : rapprochez-vous (iris d'au moins un tiers de la largeur), lumière du jour de côté, sans flash.";
      $("#irisBurstMsg").textContent = burst.why;
      return;
    }
    const allSmall = T2.every((c) => !c.measurable), allBlur = T2.every((c) => c.sharp < SHARPNESS_MIN);
    burst.why = allSmall ? "Aucune photo assez rapprochée pour mesurer les motifs : vous pouvez en choisir une pour comparer à l'œil, ou refaire la rafale plus près." : allBlur ? "Toutes les photos sont floues : stabilisez le téléphone (appui), lumière du jour, puis refaites la rafale." : "";
    $("#irisBurstMsg").textContent = `${burst.total} photos analysées : ${T2.length === 1 ? "la meilleure" : `les ${T2.length} meilleures`} ci-dessous. Choisissez-en une.${burst.why ? " " + burst.why : ""}`;
    box.innerHTML = T2.map((c, i) => `<figure><span class="hint">${esc(c.name)}</span><p class="hint">${esc(burstReason(c, i))}</p><button type="button" class="btn small${i === 0 ? " primary" : ""}" data-pick="${i}">Choisir la photo ${i + 1}</button></figure>`).join("");
    T2.forEach((c, i) => $$("figure", box)[i].prepend(c.thumb));
    T2.forEach((c) => c.thumb && (c.thumb.setAttribute("role", "img"), c.thumb.setAttribute("aria-label", `Iris de ${c.name}`)));
    $("[data-pick]", box)?.focus();
  }
  function initBurst() {
    $("#irisBurstList").addEventListener("click", (e) => {
      const b = e.target.closest("[data-pick]");
      if (!b || burst.status !== "done") return;
      const c = burst.top[Number(b.dataset.pick)], s = burst.s;
      if (!c?.file || !s) return;
      const f = c.file;
      closeDialog();
      stopBurst();
      loadFile(s, f);
    });
  }
  var irisState = () => ({
    fix: fix.s ? { ox: +fix.ox.toFixed(1), oy: +fix.oy.toFixed(1), half: +fix.half.toFixed(1), full: !!fix.kFull } : null,
    burst: { status: burst.status, done: burst.done, total: burst.total, why: burst.why, top: burst.top.map((c) => ({ name: c.name, d: Math.round(c.d), measurable: c.measurable, sharp: +c.sharp.toFixed(3), seen: +c.seen.toFixed(2), reflets: +c.reflets.toFixed(3), paupieres: +c.paupieres.toFixed(3) })) },
    slots: islots.map((s) => ({ gen: s.gen, status: s.status, has: !!s.src, echelle: s.map ? +s.map.f.toFixed(3) : null, lm: s.lm ? { cx: s.lm.cx, cy: s.lm.cy, rp: s.lm.rp, ri: irisDiameter(s.lm) / 2, auto: !!s.lm.auto } : null, eye: s.eye, kept: !!s.baseRef, msg: s.msg })),
    results: run3.res ? run3.res.map((r) => ({ name: r.name, F: r.F })) : null,
    text: resultText()
  });

  // src/js/main.js
  var MODES = ["comparer", "album", "vieillir", "fusion", "iris"];
  var mode = "comparer";
  function setMode(m, { focus = false, push = true } = {}) {
    if (!MODES.includes(m)) m = "comparer";
    mode = m;
    for (const x of MODES) {
      const tab = $(`#tab-${x}`), sel = x === m;
      tab.setAttribute("aria-selected", sel);
      tab.tabIndex = sel ? 0 : -1;
      $(`#${x}`).hidden = !sel;
    }
    if (focus) $(`#tab-${m}`).focus();
    if (push)
      try {
        history.replaceState(null, "", `#${m}`);
      } catch {
      }
    emit2("mode", m);
    if (m === "comparer") drawOverlay();
  }
  function initModes() {
    const nav = $(".modes");
    nav.addEventListener("click", (e) => {
      const b = e.target.closest(".mode");
      if (b) setMode(b.dataset.mode);
    });
    nav.addEventListener("keydown", (e) => {
      const d = { ArrowRight: 1, ArrowLeft: -1, Home: -99, End: 99 }[e.key];
      if (!d) return;
      e.preventDefault();
      const i = MODES.indexOf(mode), n = Math.max(0, Math.min(MODES.length - 1, Math.abs(d) > 1 ? d > 0 ? 99 : 0 : (i + d + MODES.length) % MODES.length));
      setMode(MODES[n], { focus: true });
    });
    on("mode", (m) => {
      if (m !== mode) setMode(m);
    });
    setMode(location.hash.slice(1) || "comparer", { push: false });
  }
  function initPaste() {
    document.addEventListener("paste", (e) => {
      const items = [...e.clipboardData?.items || []].filter((i) => i.type.startsWith("image/"));
      if (!items.length) return;
      e.preventDefault();
      const files = items.map((i) => i.getAsFile()).filter(Boolean);
      if (mode === "album") {
        addAlbumFiles(files);
        return;
      }
      const target2 = slots.find((x) => !x.canvas && x.status === "empty") || slots[lastSlot()];
      if (mode !== "comparer") setMode("comparer");
      loadInto(target2, files[0]);
      toast(`Image collée en photo ${"ABC"[target2.i]}.`);
    });
  }
  function initMisc() {
    let rz;
    window.addEventListener("resize", () => {
      clearTimeout(rz);
      rz = setTimeout(() => drawOverlay(), 150);
    });
    const themeChanged = () => emit2("theme");
    try {
      matchMedia("(prefers-color-scheme: dark)").addEventListener("change", themeChanged);
    } catch {
    }
    try {
      new MutationObserver(themeChanged).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    } catch {
    }
    let deferred = null;
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferred = e;
      $("#installBtn").hidden = false;
    });
    $("#installBtn").addEventListener("click", async () => {
      if (!deferred) return;
      deferred.prompt();
      try {
        await deferred.userChoice;
      } catch {
      }
      deferred = null;
      $("#installBtn").hidden = true;
    });
    if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {
    });
    onQueueChange((n) => {
      $("#queueTxt").textContent = n > 1 ? `${n} analyses en attente` : "";
    });
    const showReset = () => {
      $("#resetBtn").hidden = !slots.some((s) => s.canvas || s.status !== "empty") && !album.faces.length && !irisHasContent();
    };
    on("faces", showReset);
    on("iris", showReset);
    $("#resetBtn").addEventListener("click", () => {
      const slotsBackup = snapshotSlots(), albumBackup = [...album.faces], irisBackup = snapshotIris();
      clearAll();
      clearAlbum();
      clearIris();
      clearCompareCache();
      toast(baseState().on ? "Comparaisons, album et iris effacés. Votre base sur ce téléphone est conservée (Album, « Gérer ma base »)." : "Tout est effacé.", {
        label: "Annuler",
        run: () => {
          restoreSlots(slotsBackup);
          restoreAlbum(albumBackup);
          restoreIris(irisBackup);
        }
      });
    });
    on("clear-slot", (i) => clearSlot(slots[i]));
  }
  async function boot() {
    initCssAttrs();
    buildSlots();
    initPicker();
    initMasks();
    initCapture();
    $("#privacyBtn").addEventListener("click", () => openDialog($("#privacySheet")));
    initResults();
    initAlbum();
    initBase();
    setBirthLookup(birthOf);
    initAging();
    initFusion();
    initIris();
    initModes();
    initPaste();
    initMisc();
    slots.forEach(renderSlot);
    renderResults();
    const t0 = Date.now();
    let step2 = "Chargement du moteur d’analyse (13 Mo, une seule fois)…";
    const show = () => {
      if (engine.ready) return;
      const s = Math.round((Date.now() - t0) / 1e3);
      const slow = s >= 40 ? " Connexion lente : patientez, le téléchargement continue." : "";
      $("#engineTxt").textContent = `${step2} (${s} s)${slow}`;
    };
    show();
    const tick = setInterval(show, 1e3);
    try {
      await loadEngine((text) => {
        step2 = text;
        show();
      });
      engine.ready = true;
      clearInterval(tick);
      $("#engine").className = "status ok";
      $("#engineTxt").textContent = "Moteur prêt";
      analyzeQueued();
    } catch (err) {
      clearInterval(tick);
      engine.failed = true;
      console.error(err);
      $("#engine").className = "status err";
      $("#engineTxt").textContent = "Moteur d'analyse introuvable. Vérifiez la connexion puis rechargez la page.";
    }
  }
  window.AirDeFamille = {
    slots,
    album,
    compare,
    record,
    TRAITS,
    ageSimulate,
    prepareMorph,
    morph,
    pairScore,
    faceSources,
    setMode,
    engine,
    $$,
    putCanvas,
    addExtra,
    gate,
    guide,
    GUIDE,
    camState,
    baseState,
    albumInject: (canvas, det, meta) => {
      albumFace(canvas, det, meta);
      albumRefresh();
    },
    // Cadres des visages de l'album (coordonnées du recadrage), pour vérifier le masquage (AdF-044).
    albumBoxes: () => album.faces.map((f) => ({ x: f.det.box.x, y: f.det.box.y, w: f.det.box.width, h: f.det.box.height, kept: !!f.baseRef })),
    live: { detectLive, liveMeasure, lumStats },
    iris: { state: irisState },
    moteur: { normalize, measures, symmetrize, appearance, sampleColors, quality }
  };
  boot();
})();
