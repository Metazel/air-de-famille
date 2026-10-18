(() => {
  // src/js/util.js
  var $ = (sel, root = document) => root.querySelector(sel);
  var $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
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
    const run2 = tail.then(job, job);
    tail = run2.catch(() => {
    }).finally(() => {
      pending--;
      emit();
    });
    return run2;
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
    const open = (a, b, c, d, e, f) => (D(b, f) + D(c, e)) / 2 / D(a, d);
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
      open: (open(36, 37, 38, 39, 40, 41) + open(42, 43, 44, 45, 46, 47)) / 2,
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
    const avg = (ids) => {
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
      const [x, y] = avg(ids), rr = iod * 0.11;
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
    const open = Math.hypot(P[62][0] - P[66][0], P[62][1] - P[66][1]) / Math.hypot(P[48][0] - P[54][0], P[48][1] - P[54][1]) > 0.12;
    const chin = patchStats(ctx, ...mid(57, 8, open ? 0.7 : 0.55), iod * (open ? 0.09 : 0.12));
    const lip = open ? null : patchStats(ctx, ...mid(33, 51), iod * 0.06);
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
      const dur = v.duration;
      if (!isFinite(dur) || dur <= 0) throw new Error("durée inconnue");
      const n = Math.min(12, Math.max(4, Math.round(dur * 3))), frames = [];
      for (let k = 0; k < n; k++) {
        await new Promise((r) => {
          v.onseeked = r;
          v.currentTime = Math.min(dur - 0.05, dur * (k + 0.5) / n);
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
  async function describe(canvas, d, colorCanvas = canvas) {
    const pts = await refineLandmarks(
      canvas,
      d.detection.box,
      d.landmarks.positions.map((p) => [p.x, p.y])
    );
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
      col: sampleColors(colorCanvas, pts)
    };
  }
  function requalify(det, age) {
    if (!det.occ) return det;
    const { warn, q } = quality(det.norm, det.box, det.occ, age ?? det.age);
    return { ...det, warn, q, id: nextDetId() };
  }
  async function findFaces(canvas) {
    let dets = await detectAll(canvas);
    if (!dets.length) return { work: canvas, faces: [] };
    dets.sort((a, b) => b.detection.box.area - a.detection.box.area);
    let work = exposeFace(canvas, dets[0].detection.box);
    if (work !== canvas) {
      const d2 = await detectAll(work);
      if (d2.length) dets = d2.sort((a, b) => b.detection.box.area - a.detection.box.area);
      else work = canvas;
    }
    return { work, faces: dets.slice(0, 8) };
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
        { k: "inner", label: "Coins internes", s: 67e-4, r: 0.1, u: "é" }
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
  function compare(A, B) {
    const key = `${A.key}|${B.key}|${A.age ?? ""}|${B.age ?? ""}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const qa = A.det.q, qb = B.det.q;
    const ageA = A.age ?? A.det.age, ageB = B.age ?? B.det.age;
    const ageGap = ageA != null && ageB != null ? Math.abs(ageA - ageB) : 0;
    const bigGap = ageGap > BIG_GAP;
    const traits = TRAITS.map((t) => {
      if (t.color) {
        const ca = A.det.col[t.color], cb = B.det.col[t.color];
        if (!ca || !cb) return { t, sim: null, wq: 0 };
        const de = deltaE(ca.lab, cb.lab);
        return { t, sim: toSim((de / t.s) ** 2), de, ca, cb, wq: 1 };
      }
      let sw2 = 0, sz = 0;
      const rows = t.items.map((it) => {
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
      return { t, rows, geo: geo2, app, sim, wq, why };
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
    const R = { traits, ia, dist, geo, total: wIA * ia + (1 - wIA) * geo, rel: Math.min(qa.overall, qb.overall), ageGap, bigGap, wIA };
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
    let T = N.map(([x, y]) => {
      const dx = x - C[0], dy = y - C[1], R = Math.hypot(dx, dy);
      if (R < 1e-6) return [x, y];
      const c = -dy / R, f = (1 + k2 * (1 - c)) / (1 + k1 * (1 - c));
      return [C[0] + dx * f, C[1] + dy * f];
    });
    const ds = sag(to) - sag(from);
    if (ds) {
      const mv = (ids, dx, dy) => ids.forEach((i) => {
        T[i] = [T[i][0] + Math.sign(T[i][0]) * dx * ds, T[i][1] + dy * ds];
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
        T[i] = [T[i][0] * (1 + 0.05 * dp), T[i][1] + (i >= 6 && i <= 10 ? 0.04 * dp : 0)];
      });
      [27, 28, 29, 30].forEach((i) => {
        T[i] = [T[i][0], T[i][1] + 0.01 * dp];
      });
    }
    if (P && w > 0) T = T.map((p, i) => [p[0] * (1 - w) + P[i][0] * w, p[1] * (1 - w) + P[i][1] * w]);
    return T;
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
    const T = agedShape(det.norm, from, to, sex, P, P && to >= 14 ? w : 0);
    const out = warp(head, det.norm.concat(ANCHORS).map(toPx), T.concat(ANCHORS).map(toPx));
    retouch(out, T.map(toPx), from, to);
    return { head, out, from, to, shape: T };
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

  // src/js/ui/common.js
  var handlers = {};
  var on = (ev, fn) => (handlers[ev] || (handlers[ev] = /* @__PURE__ */ new Set())).add(fn);
  var emit2 = (ev, data) => handlers[ev]?.forEach((fn) => fn(data));
  var engine = { ready: false };
  function toast(text, action = null, { ms = action ? 12e3 : 5e3, after = null } = {}) {
    const el2 = document.createElement("div");
    el2.className = "toast";
    el2.setAttribute("role", "status");
    const span = document.createElement("span");
    span.textContent = text;
    el2.appendChild(span);
    if (action) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = action.label;
      b.addEventListener("click", () => {
        action.run();
        el2.remove();
      });
      el2.appendChild(b);
    }
    $("#toasts").appendChild(el2);
    Promise.resolve(after).catch(() => {
    }).then(() => setTimeout(() => el2.remove(), ms));
    return el2;
  }
  var openSheet = null;
  var returnFocus = null;
  function openDialog(el2, onClose) {
    returnFocus = document.activeElement;
    openSheet = { el: el2, onClose };
    el2.hidden = false;
    (el2.querySelector("[data-autofocus]") || el2.querySelector("[data-close]"))?.focus();
  }
  function closeDialog() {
    if (!openSheet) return;
    const { el: el2, onClose } = openSheet;
    openSheet = null;
    el2.hidden = true;
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
  function fillSelect(sel, options, keep = true) {
    const prev = sel.value;
    sel.innerHTML = options.map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join("");
    if (keep && options.some((o) => o.value === prev)) sel.value = prev;
    return sel.value;
  }

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
    gen: 0
  });
  var slots = [0, 1, 2].map(blank);
  var slotName = (s) => s.name || `Photo ${LET[s.i]}`;
  var nm = (i) => esc(slotName(slots[i]));
  var record = (s) => ({ key: `s${s.i}:${s.det.id}`, det: s.det, age: s.realAge });
  var birthLookup = () => null;
  var setBirthLookup = (fn) => {
    birthLookup = fn;
  };
  var camIcon = '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.6"/></svg>';
  var el = (s) => $(`.slot[data-i="${s.i}"]`);
  var lastTouched = 0;
  var lastSlot = () => lastTouched;
  function buildSlots() {
    $("#slots").innerHTML = slots.map(
      (s) => `
    <div class="slot" data-i="${s.i}">
      <div class="mwrap">
        <button class="media" type="button" aria-label="Choisir la photo ${LET[s.i]}">
          <span class="badge" aria-hidden="true">${LET[s.i]}</span>
          <span class="ph">${camIcon}<span>${s.i < 2 ? "Ajouter une photo" : "3ᵉ photo<br>(facultative)"}</span></span>
        </button>
        <button class="x" type="button" aria-label="Retirer la photo ${LET[s.i]}" hidden>✕</button>
      </div>
      <input class="name" id="name${s.i}" aria-label="Prénom, photo ${LET[s.i]}" maxlength="24" placeholder="Prénom" autocomplete="off" list="peopleList">
      <label class="agewrap">Âge <input class="age" id="age${s.i}" type="text" inputmode="decimal" placeholder="ex. 4 mois" title="En années (10 ou 10,5) ou en mois (4 mois)" aria-label="Âge réel sur la photo ${LET[s.i]}"></label>
      <div class="chips"></div>
      <input type="file" accept="image/*,video/*" id="file${s.i}" hidden>
    </div>`
    ).join("");
    for (const s of slots) {
      const root = el(s), file = $("input[type=file]", root);
      root.addEventListener("pointerdown", () => {
        lastTouched = s.i;
      });
      $(".media", root).addEventListener("click", () => file.click());
      $(".x", root).addEventListener("click", () => clearSlot(s));
      $(".chips", root).addEventListener("click", (e) => {
        if (e.target.closest("[data-act=pick]")) openPicker(s);
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
    } else if (a == null && !s.ageTyped) {
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
    Object.assign(s, { canvas: null, orig: null, work: null, faces: [], det: null, status: "loading", photoDate: null });
    renderSlot(s);
    const isVideo = file.type.startsWith("video/");
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
        s.canvas = null;
        s.status = isVideo ? "badvideo" : "badfile";
        renderSlot(s);
        renderResults();
      }
    }
  }
  async function putCanvas(s, canvas, { name, age = null, det = null } = {}) {
    const gen = ++s.gen;
    Object.assign(s, { canvas, orig: null, work: null, faces: [], det: null, status: "loading", photoDate: null, ageTyped: age != null });
    if (name != null) {
      s.name = name;
      $(`#name${s.i}`).value = name;
    }
    s.realAge = age;
    $(`#age${s.i}`).value = age != null ? String(Math.round(age * 10) / 10).replace(".", ",") : "";
    if (det) {
      s.det = { ...requalify(det, age), id: nextDetId() };
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
      s.status = "queued";
      s.pendingFrames = frames;
      renderSlot(s);
      return;
    }
    s.status = "busy";
    renderSlot(s);
    try {
      await enqueue(async () => {
        if (gen !== s.gen) return;
        if (frames) {
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
        const { work, faces } = await findFaces(s.canvas);
        if (gen !== s.gen) return;
        s.work = work;
        s.faces = faces;
        s.faceIdx = 0;
        if (!faces.length) {
          s.status = "noface";
          s.det = null;
          return;
        }
        const det = await describe(work, faces[0], s.canvas);
        if (gen !== s.gen) return;
        s.det = s.realAge != null ? requalify(det, s.realAge) : det;
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
    s.pendingFrames = null;
    renderSlot(s);
    renderResults();
    emit2("faces");
  }
  function analyzeQueued() {
    for (const s of slots) if (s.status === "queued") analyzeSlot(s, s.pendingFrames || null);
  }
  async function chooseFace(s, idx) {
    if (!s.faces[idx] || idx === s.faceIdx) return;
    const gen = ++s.gen;
    s.faceIdx = idx;
    s.status = "busy";
    renderSlot(s);
    const det = await enqueue(() => describe(s.work || s.canvas, s.faces[idx], s.canvas));
    if (gen !== s.gen) return;
    s.det = s.realAge != null ? requalify(det, s.realAge) : det;
    s.status = "ok";
    renderSlot(s);
    renderResults();
    emit2("faces");
  }
  function clearSlot(s, quiet = false) {
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
  var snapshot = (s) => ({ ...s, faces: [...s.faces], nameVal: $(`#name${s.i}`).value, ageVal: $(`#age${s.i}`).value });
  function restore(snap) {
    const s = slots[snap.i];
    const { nameVal, ageVal, ...data } = snap;
    Object.assign(s, data, { gen: s.gen + 1 });
    $(`#name${s.i}`).value = nameVal;
    $(`#age${s.i}`).value = ageVal;
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
    if (replaced) toast(`Photo ${LET[s.i]} remplacée.`, { label: "Annuler", run: () => restore(replaced) }, { after: done });
    else toast(`Placé en photo ${LET[s.i]}.`);
    return s;
  }
  function renderSlot(s) {
    const root = el(s), media = $(".media", root);
    $$("canvas,.busy", media).forEach((n) => n.remove());
    root.classList.toggle("filled", !!s.canvas);
    $(".ph", media).hidden = !!s.canvas;
    $(".x", root).hidden = !s.canvas && s.status === "empty";
    media.setAttribute("aria-label", `${s.canvas ? "Changer" : "Choisir"} la photo ${LET[s.i]}`);
    if (s.canvas) media.appendChild(thumb(s, 360));
    const busyText = { busy: "Analyse…", loading: "Ouverture…", queued: "En attente du moteur…" }[s.status];
    if (busyText) {
      const b = document.createElement("div");
      b.className = "busy";
      b.textContent = busyText;
      media.appendChild(b);
    }
    let h = "";
    if (s.status === "ok") {
      h += s.det.frames ? `<span class="chip ok">Vidéo · ${s.det.frames} images de face</span>` : '<span class="chip ok">Visage détecté</span>';
      if (!s.det.frames)
        h += `<button type="button" class="chip act" data-act="pick">${s.faces.length > 1 ? `Visage ${s.faceIdx + 1}/${s.faces.length} · choisir` : "Recadrer"}</button>`;
    }
    const bad = {
      noface: "Aucun visage trouvé",
      badfile: "Image illisible",
      badvideo: "Vidéo illisible sur cet appareil",
      error: "Erreur d'analyse"
    }[s.status];
    if (bad) h += `<span class="chip bad">${bad}</span>`;
    if (s.status === "noface") h += '<button type="button" class="chip act" data-act="pick">Recadrer à la main</button>';
    if (s.det) for (const w of s.det.warn) h += `<span class="chip warn">${w}</span>`;
    if (s.status === "ok") h += ageInfo(s);
    $(".chips", root).innerHTML = h;
    if (refocus === s.i && s.status !== "busy") {
      refocus = null;
      ($("[data-act=pick]", root) || $(".media", root)).focus();
    }
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
      Object.assign(s, { orig, canvas: c, work: null, det: null, faces: [] });
      analyzeSlot(s);
    });
    $("#cropUndo").addEventListener("click", () => {
      const s = picker.s;
      if (!s?.orig) return;
      closeDialog();
      s.gen++;
      Object.assign(s, { canvas: s.orig, orig: null, work: null, det: null, faces: [] });
      analyzeSlot(s);
    });
  }
  var activePair = null;
  var refIdx = 0;
  var lastRes = null;
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
    for (const [a2, b2] of pairs) res[`${a2}${b2}`] = compare(record(slots[a2]), record(slots[b2]));
    if (!activePair || !res[activePair]) activePair = pairs[0].join("");
    $("#tabs").innerHTML = pairs.map(([a2, b2]) => {
      const k = `${a2}${b2}`, sel = k === activePair;
      return `<button class="tab" role="tab" id="tab${k}" aria-selected="${sel}" tabindex="${sel ? 0 : -1}" aria-controls="pairPanel" data-k="${k}"><span class="pdots"><i style="background:var(${CVAR[a2]})"></i><i style="background:var(${CVAR[b2]})"></i></span>${nm(a2)} · ${nm(b2)}<span class="num">${Math.round(res[k].total)} %</span></button>`;
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
      <div class="g-band" style="left:${pos(st.lo)};width:${st.hi - st.lo}%" title="${st.label} : ${st.lo} à ${st.hi} %"></div>
      <div class="g-band same" style="left:${pos(sm.lo)};width:${sm.hi - sm.lo}%" title="${sm.label} : ${sm.lo} à ${sm.hi} %"></div>`;
    const labels = R.bigGap ? `<span style="left:50%">Grand écart d'âge : repères non applicables</span>` : `<span style="left:${(st.lo + st.hi) / 2}%">${st.label}<br>${st.lo}–${st.hi} %</span><span style="left:${(sm.lo + sm.hi) / 2}%">${sm.label}<br>${sm.lo}–${sm.hi} %</span>`;
    return `<div class="gauge" role="img" aria-label="Score ${Math.round(R.total)} sur 100. Repères : ${st.label.toLowerCase()} ${st.lo} à ${st.hi} ; ${sm.label.toLowerCase()} ${sm.lo} à ${sm.hi}.">
      <div class="g-track"><div class="g-line"></div>${bands}<div class="g-mark" style="left:${pos(R.total)}"></div></div>
      <div class="g-axis" aria-hidden="true"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div>
      <div class="g-labels" aria-hidden="true">${labels}</div></div>`;
  }
  function renderScore(a, b, R) {
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
    <p class="hint">Ce n'est pas un test de parenté : une famille se situe souvent entre les deux zones, mais pas toujours.</p>
    <div class="actions"><button type="button" class="btn" id="copyBtn">Copier le résumé</button><button type="button" class="btn" id="shareBtn">Créer une image</button></div>`;
  }
  function summaryText() {
    if (!lastRes) return "";
    const { a, b, R } = lastRes;
    const lines = [
      `Air de famille — ${slotName(slots[a])} / ${slotName(slots[b])} : ${Math.round(R.total)} % (${level(R.total).toLowerCase()})`,
      `Impression globale ${Math.round(R.ia)} % · traits mesurés ${Math.round(R.geo)} % · fiabilité ${relLabel(R.rel)[0].toLowerCase()}`
    ];
    for (const r of R.traits) lines.push(`- ${r.t.name} : ${r.sim == null ? "non mesurable" : `${Math.round(r.sim)} %`}`);
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
  function renderTraits(a, b, R) {
    const open = new Set($$("#traits details[open]").map((d) => d.dataset.id));
    const unit = (it) => it.u === "°" ? "°" : "";
    $("#traits").innerHTML = R.traits.map((r) => {
      const t = r.t, na = r.sim == null, p = na ? 0 : Math.round(r.sim);
      let body;
      if (na) body = `<p class="hint">Non mesurable sur l'une des photos (zone trop petite, sombre ou masquée).</p>`;
      else if (t.color) {
        const row = (i, c, cls) => `<tr><th>${nm(i)}</th><td class="${cls}">L ${fmt(c.lab[0], 0)} · a ${fmt(c.lab[1], 0)} · b ${fmt(c.lab[2], 0)}<span class="sw" style="background:rgb(${c.rgb})"></span></td></tr>`;
        body = `<table class="mtable" style="--a:var(${CVAR[a]});--b:var(${CVAR[b]})">${row(a, r.ca, "ca")}${row(b, r.cb, "cb")}<tr><th>Écart de couleur (ΔE)</th><td>${fmt(r.de, 1)}</td></tr></table>
        <p class="hint">${t.color === "skin" ? "Mesuré sur les deux joues" : "Mesuré au centre de chaque œil, hors pupille et reflets"}, après correction de la lumière par le blanc des yeux. Reste sensible aux éclairages colorés et au maquillage.</p>`;
      } else {
        body = `<table class="mtable" style="--a:var(${CVAR[a]});--b:var(${CVAR[b]})"><tr><th></th><td class="ca">${nm(a)}</td><td class="cb">${nm(b)}</td></tr>${r.rows.map(
          (x) => x.it.shape ? `<tr><th>${x.it.label}</th><td colspan="2">écart moyen ${fmt(x.rms * 100, 1)} %</td></tr>` : `<tr><th>${x.it.label}</th><td class="ca">${fmt(x.va, x.it.d ?? 2)}${unit(x.it)}</td><td class="cb">${fmt(x.vb, x.it.d ?? 2)}${unit(x.it)}</td></tr>`
        ).join("")}</table>`;
        if (r.app != null)
          body += `<div class="sub"><span>Texture de la zone</span><b>${Math.round(r.app)} %</b><span>Mesures</span><b>${Math.round(r.geo)} %</b></div>`;
        if (r.wq < 1 && r.why)
          body += `<p class="hint">Zone peu fiable sur l'une des photos (${r.why}) : son poids dans le score est réduit.</p>`;
        if (t.id === "visage")
          body += '<p class="hint">Le contour du visage est le repère le moins stable : il varie avec la pose, la coiffure et la barbe.</p>';
        if (r.rows.some((x) => x.it.u === "é")) body += '<p class="hint">Longueurs en écarts inter-yeux (centre à centre = 1).</p>';
      }
      return `<details class="trait" data-id="${t.id}"${open.has(t.id) ? " open" : ""}>
      <summary><span class="tname">${t.name}${t.tag ? `<em>${t.tag}</em>` : ""}</span><span class="bar${na ? " na" : ""}"><b style="width:${p}%"></b></span><span class="pct">${na ? "—" : `${p} %`}</span></summary>
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
    const step = 0.25 * k;
    for (let v = X(0) % step; v < W; v += step) {
      g.beginPath();
      g.moveTo(v, 0);
      g.lineTo(v, W);
      g.stroke();
    }
    for (let v = Y(0) % step; v < W; v += step) {
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
    $("#legend").innerHTML = `${[a, b].map((i) => `<span><i style="background:var(${CVAR[i]})"></i>${nm(i)}</span>`).join("")}<span class="hint">quadrillage = ¼ d'écart inter-yeux</span>`;
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
    const RX = compare(record(slots[refIdx]), record(slots[x])), RY = compare(record(slots[refIdx]), record(slots[y]));
    $("#heritageIntro").innerHTML = `Pour chaque trait de <strong>${nm(refIdx)}</strong>, la barre penche vers le visage le plus proche.`;
    const rows = TRAITS.map((t, n) => {
      const sx = RX.traits[n].sim, sy = RY.traits[n].sim, name = `<span class="tname">${t.name}${t.tag ? `<em>${t.tag}</em>` : ""}</span>`;
      if (sx == null || sy == null)
        return `<div class="hrow">${name}<div class="tugwrap"><div class="tug"></div></div><span class="verdict muted">non mesurable</span></div>`;
      const wx = sx / (sx + sy || 1) * 100;
      const v = Math.abs(sx - sy) < 6 ? '<span class="muted">à égalité</span>' : `<span style="color:var(${CVAR[sx > sy ? x : y]})">côté ${nm(sx > sy ? x : y)}</span>`;
      return `<div class="hrow">${name}<div class="tugwrap"><div class="tug"><b style="width:${wx}%;background:var(${CVAR[x]})"></b><b style="flex:1;background:var(${CVAR[y]})"></b></div><div class="hnums"><span>${Math.round(sx)} %</span><span>${Math.round(sy)} %</span></div></div><span class="verdict">${v}</span></div>`;
    }).join("");
    const lead = Math.abs(RX.total - RY.total) < 3 ? `${nm(refIdx)} ressemble autant à ${nm(x)} qu'à ${nm(y)}.` : `Au total, ${nm(refIdx)} ressemble davantage à <strong>${nm(RX.total > RY.total ? x : y)}</strong> (${Math.round(Math.max(RX.total, RY.total))} % contre ${Math.round(Math.min(RX.total, RY.total))} %).`;
    $("#hrows").innerHTML = `${rows}<p class="summary" style="margin-top:10px">${lead}</p>`;
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
    g.fillText(`${Math.round(R.total)} %`, W / 2, 900);
    g.fillStyle = C("--accent");
    g.font = '700 50px "Familjen Grotesk", system-ui, sans-serif';
    g.fillText(`Ressemblance ${level(R.total).toLowerCase()}`, W / 2, 975);
    const main = R.traits.filter((r) => r.sim != null && !r.t.tag);
    main.forEach((r, n) => {
      const y = 1050 + n * 46, x0 = 330, bw = 560;
      g.textAlign = "right";
      g.fillStyle = C("--muted");
      g.font = '500 32px "Familjen Grotesk", system-ui, sans-serif';
      g.fillText(r.t.name, x0 - 24, y + 12);
      g.fillStyle = C("--sunk");
      g.beginPath();
      g.roundRect(x0, y - 8, bw, 22, 11);
      g.fill();
      g.fillStyle = C("--accent");
      g.beginPath();
      g.roundRect(x0, y - 8, Math.max(22, bw * r.sim / 100), 22, 11);
      g.fill();
      g.textAlign = "left";
      g.fillStyle = C("--ink");
      g.fillText(`${Math.round(r.sim)} %`, x0 + bw + 20, y + 12);
    });
    g.textAlign = "center";
    g.fillStyle = C("--muted");
    g.font = '400 28px "Familjen Grotesk", system-ui, sans-serif';
    g.fillText("Simulation de ressemblance · analyse sur l'appareil · pas un test de parenté", W / 2, H - 50);
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
  var keyOf = (name) => name.trim().replace(/\s+/g, " ").toLowerCase();
  var personOf = (f) => f.person ? album.people[keyOf(f.person)] : null;
  var birthOf = (name) => name ? album.people[keyOf(name)]?.birth || null : null;
  function ageOf(f) {
    const birth = personOf(f)?.birth;
    const fromDates = birth && f.date ? yearsBetween(birth, f.date) : null;
    if (fromDates != null) return { age: fromDates, src: "dates" };
    if (f.typed != null) return { age: f.typed, src: "saisi" };
    return { age: f.det.age, src: "estimé" };
  }
  var record2 = (f) => {
    const a = ageOf(f);
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
          const { work, faces } = await findFaces(canvas);
          for (let n = 0; n < faces.length; n++) {
            const det = await describe(work, faces[n], canvas);
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
        const af = ageOf(f), ag = ageOf(g);
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
    });
    card.addEventListener("click", (e) => {
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
    const a = ageOf(f);
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
      const ages = p.faces.map((f) => ageOf(f).age).sort((x, y) => x - y);
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
        for (const f of album.faces) if (f.person && keyOf(f.person) === k) f.det = requalify(f.det, ageOf(f).age);
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
        const r = S[`${i}-${j}`], v = Math.round(r.score), pct = Math.round(Math.max(0, Math.min(100, v)) * 0.85);
        const far = r.gap > 20, key = `${Math.min(i, j)}-${Math.max(i, j)}`;
        return `<td><button type="button" class="cell${pct > 50 ? " dark" : ""}${far ? " far" : ""}" style="--p:${pct}%" data-k="${key}" aria-pressed="${selectedCell === key}"
      aria-label="${esc(p.name)} et ${esc(q.name)} : ${v} %, écart d'âge ${Math.round(r.gap)} ans"><b>${v}</b><small>Δ ${Math.round(r.gap)} an${Math.round(r.gap) > 1 ? "s" : ""}</small></button></td>`;
      }).join("")}</tr>`
    ).join("");
    $("#matrix").innerHTML = head + `<tbody>${body}</tbody>`;
    $("#nearest").innerHTML = ps.map((p, i) => {
      let best = null;
      ps.forEach((q, j) => {
        if (i !== j && (!best || S[`${i}-${j}`].score > best.r.score)) best = { q, r: S[`${i}-${j}`] };
      });
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
      <div class="pv"><b>${Math.round(p.R.total)} %</b><br>${esc(ps[i].name)} ${ageLabel(p.af.age, p.af.src === "estimé")}${p.af.src === "estimé" ? " (est.)" : ""}<br>${esc(ps[j].name)} ${ageLabel(p.ag.age, p.ag.src === "estimé")}${p.ag.src === "estimé" ? " (est.)" : ""}</div></div>`
    ).join("");
    box.innerHTML = `<h3 style="margin-top:14px">${esc(ps[i].name)} et ${esc(ps[j].name)} : photos comparées</h3><div class="pairs" style="margin-top:8px">${items}</div>
    <div class="actions" style="margin-top:10px"><button type="button" class="btn" id="pairOpen">Voir le détail trait par trait</button></div>`;
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
      const to = (s, f) => putCanvas(s, f.crop, { name: f.person, age: ageOf(f).src === "estimé" ? null : ageOf(f).age, det: f.det });
      to(slots[0], best.f);
      to(slots[1], best.g);
      if (slots[2].canvas) emit2("clear-slot", 2);
      emit2("mode", "comparer");
    });
  }
  var albumSources = () => album.faces.map((f) => {
    const a = ageOf(f);
    return {
      id: `a${f.id}`,
      label: `Album · ${f.person || `visage ${f.id}`} (${a.src === "estimé" ? "≈ " : ""}${ageLabel(a.age, a.src === "estimé")})`,
      canvas: f.crop,
      det: f.det,
      age: a.src === "estimé" ? null : a.age,
      name: f.person
    };
  });
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
  function refresh() {
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
    run();
  }
  function run() {
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
    $("#agCapB").textContent = `Simulation · ${ageLabel(r.to)}`;
    $("#agOut").hidden = false;
    $("#agUse").hidden = false;
  }
  function initAging() {
    $("#agTarget").addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      target = +b.dataset.age;
      $$("#agTarget button").forEach((x) => x.setAttribute("aria-pressed", x === b));
      run();
    });
    ["agSrc", "agSex", "agModel"].forEach((id) => $(`#${id}`).addEventListener("change", refresh));
    $("#agW").addEventListener("input", (e) => {
      $("#agWv").textContent = `${e.target.value} %`;
      run();
    });
    $("#agUse").addEventListener("click", () => {
      if (!last) return;
      const { r, s } = last, c = makeCanvas(r.out.width * 2, r.out.height * 2), g = c.getContext("2d");
      g.imageSmoothingQuality = "high";
      g.drawImage(r.out, 0, 0, c.width, c.height);
      sendToSlot(c, { name: `${s.name} ${Math.round(r.to)} ans (simulé)`.slice(0, 24), age: r.to }, s.slot != null ? [s.slot] : []);
    });
    on("faces", refresh);
    on("theme", () => {
      memo = "";
      refresh();
    });
    refresh();
  }

  // src/js/ui/fusion.js
  var prep = null;
  var prepKey = "";
  var renderKey = "";
  var result = null;
  var playing = 0;
  var reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  function refresh2() {
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
    $("#fuCapM").textContent = `${Math.round((1 - t) * 100)} / ${Math.round(t * 100)}${$("#fuAge").value ? ` · ${ageLabel(result.age)}` : ""}`;
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
    const step = (now) => {
      if (!playing) return;
      const t = 0.5 - 0.5 * Math.cos((now - t0) / 4e3 * 2 * Math.PI);
      const r = compute(t, true);
      if (r) draw("#fuCm", r.out);
      $("#fuTv").textContent = `${Math.round(t * 100)} %`;
      playing = requestAnimationFrame(step);
    };
    playing = requestAnimationFrame(step);
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
        { name, age: result.age },
        [result.A.slot, result.B.slot].filter((x) => x != null)
      );
    });
    on("faces", () => {
      if (!playing) refresh2();
    });
    on("theme", () => {
      prepKey = "";
      renderKey = "";
      refresh2();
    });
    on("mode", (m) => {
      if (m !== "fusion" && playing) stop();
    });
    refresh2();
  }

  // src/js/main.js
  var MODES = ["comparer", "album", "vieillir", "fusion"];
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
      $("#resetBtn").hidden = !slots.some((s) => s.canvas || s.status !== "empty") && !album.faces.length;
    };
    on("faces", showReset);
    $("#resetBtn").addEventListener("click", () => {
      const slotsBackup = snapshotSlots(), albumBackup = [...album.faces];
      clearAll();
      clearAlbum();
      clearCompareCache();
      toast("Tout est effacé.", {
        label: "Annuler",
        run: () => {
          restoreSlots(slotsBackup);
          restoreAlbum(albumBackup);
        }
      });
    });
    on("clear-slot", (i) => clearSlot(slots[i]));
  }
  async function boot() {
    buildSlots();
    initPicker();
    initResults();
    initAlbum();
    setBirthLookup(birthOf);
    initAging();
    initFusion();
    initModes();
    initPaste();
    initMisc();
    slots.forEach(renderSlot);
    renderResults();
    const t0 = Date.now();
    let step = "Chargement du moteur d’analyse (13 Mo, une seule fois)…";
    const show = () => {
      if (engine.ready) return;
      const s = Math.round((Date.now() - t0) / 1e3);
      const slow = s >= 40 ? " Connexion lente : patientez, le téléchargement continue." : "";
      $("#engineTxt").textContent = `${step} (${s} s)${slow}`;
    };
    show();
    const tick = setInterval(show, 1e3);
    try {
      await loadEngine((text) => {
        step = text;
        show();
      });
      engine.ready = true;
      clearInterval(tick);
      $("#engine").className = "status ok";
      $("#engineTxt").textContent = "Moteur prêt";
      analyzeQueued();
    } catch (err) {
      clearInterval(tick);
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
    $$
  };
  boot();
})();
