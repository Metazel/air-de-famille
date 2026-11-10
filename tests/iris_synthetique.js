// Iris de synthèse pour les tests publics (AdF-039) : aucune vraie photo, motifs générés à paramètres connus.
// Module sans DOM : renvoie { width, height, data } (RVBA). Utilisable sous Node et dans le navigateur.
// Paramètres : fond « blanc » (iris détouré) ou « oeil » (peau, blanc de l'œil, paupières) ; position et rayons ;
// couleur ; filaments du cœur et du milieu (nombre, intensité) ; sillons du pourtour ; spirales ; cryptes ;
// position de la collerette ; contraste cœur / pourtour ; anneau clair à la collerette ; reflet ; flou (rayon en px).
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
export function irisSynthetique(o = {}) {
  const p = Object.assign(
    { w: 900, h: 700, fond: "blanc", cx: 450, cy: 350, ri: 260, rp: 70, couleur: [120, 82, 50], coeur: 18, coeurAmp: 26, milieu: 30, milieuAmp: 16,
      sillons: 7, sillonsAmp: 0, spirales: 0, spiralesAmp: 0, cryptes: 6, collerette: 0.36, contraste: -22, anneau: 0, reflet: true, graine: 7, bruit: 4, flou: 0 },
    o
  );
  const R = rng(p.graine), d = new Uint8ClampedArray(p.w * p.h * 4);
  const crypts = [];
  for (let i = 0; i < p.cryptes; i++) crypts.push({ t: R() * 2 * Math.PI, f: p.collerette + (R() - 0.3) * 0.2, s: 0.025 + R() * 0.02 });
  const phase1 = R() * 6.28, phase2 = R() * 6.28, phase3 = R() * 6.28;
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const dx = x - p.cx, dy = y - p.cy, r = Math.hypot(dx, dy), t = Math.atan2(dy, dx), o4 = (y * p.w + x) * 4;
      let c;
      if (r <= p.rp) c = [14, 14, 16];
      else if (r <= p.ri) {
        const f = (r - p.rp) / (p.ri - p.rp), zig = p.collerette + 0.025 * Math.sin(12 * t + phase3);
        let v = f < zig ? p.contraste / 2 : -p.contraste / 2;
        if (p.anneau) v += p.anneau * Math.exp(-(((f - zig) / 0.03) ** 2));
        if (f < zig) v += p.coeurAmp * Math.cos(p.coeur * t + phase1);
        else if (f < 0.66) v += p.milieuAmp * Math.cos(p.milieu * t + phase2);
        else {
          v += p.sillonsAmp * Math.cos(2 * Math.PI * p.sillons * f);
          v += p.spiralesAmp * Math.cos(p.spirales * t + 40 * f);
        }
        for (const k of crypts) {
          const dt = Math.atan2(Math.sin(t - k.t), Math.cos(t - k.t)) * (p.rp + (p.ri - p.rp) * k.f), dr = (f - k.f) * (p.ri - p.rp);
          const s = k.s * (p.ri - p.rp);
          v -= 55 * Math.exp(-(dt * dt + dr * dr) / (2 * s * s));
        }
        v += (R() - 0.5) * p.bruit * 2;
        c = p.couleur.map((u) => u + v);
      } else if (p.fond === "blanc") c = [255, 255, 255];
      else {
        const inEye = (dx / (p.ri * 2.3)) ** 2 + (dy / (p.ri * 0.95)) ** 2 <= 1;
        c = inEye ? [232, 228, 222] : [196, 150, 128];
      }
      // Paupières (fond « oeil ») : le haut et le bas de l'iris sont couverts.
      if (p.fond === "oeil" && r <= p.ri && (dx / (p.ri * 2.3)) ** 2 + (dy / (p.ri * 0.95)) ** 2 > 1) c = [196, 150, 128];
      d[o4] = c[0]; d[o4 + 1] = c[1]; d[o4 + 2] = c[2]; d[o4 + 3] = 255;
    }
  if (p.reflet) {
    const rx = p.cx + p.rp * 0.35, ry = p.cy - p.rp * 0.4, rr = p.rp * 0.32;
    for (let y = Math.floor(ry - rr); y <= ry + rr; y++)
      for (let x = Math.floor(rx - rr); x <= rx + rr; x++) {
        if (x < 0 || y < 0 || x >= p.w || y >= p.h || Math.hypot(x - rx, y - ry) > rr) continue;
        const o4 = (y * p.w + x) * 4;
        d[o4] = d[o4 + 1] = d[o4 + 2] = 252;
      }
  }
  // Flou : moyennes glissantes horizontales puis verticales (trois passes ≈ flou gaussien).
  if (p.flou > 0) {
    const r = Math.round(p.flou), tmp = new Float32Array(p.w * p.h);
    for (let c = 0; c < 3; c++)
      for (let pass = 0; pass < 3; pass++) {
        for (let y = 0; y < p.h; y++) {
          let acc = 0;
          for (let x = -r; x <= r; x++) acc += d[(y * p.w + Math.min(p.w - 1, Math.max(0, x))) * 4 + c];
          for (let x = 0; x < p.w; x++) {
            tmp[y * p.w + x] = acc / (2 * r + 1);
            acc += d[(y * p.w + Math.min(p.w - 1, x + r + 1)) * 4 + c] - d[(y * p.w + Math.max(0, x - r)) * 4 + c];
          }
        }
        for (let x = 0; x < p.w; x++) {
          let acc = 0;
          for (let y = -r; y <= r; y++) acc += tmp[Math.min(p.h - 1, Math.max(0, y)) * p.w + x];
          for (let y = 0; y < p.h; y++) {
            d[(y * p.w + x) * 4 + c] = acc / (2 * r + 1);
            acc += tmp[Math.min(p.h - 1, y + r + 1) * p.w + x] - tmp[Math.max(0, y - r) * p.w + x];
          }
        }
      }
  }
  return { width: p.w, height: p.h, data: d, params: p };
}
