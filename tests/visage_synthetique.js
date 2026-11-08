// Visage synthétique (aucune photo réelle) : 68 repères de face dessinés sur un canevas, mesures calculées par le moteur.
window.__fakeFace = (seed = 1, opt = {}) => {
  const A = window.AirDeFamille, M = A.moteur;
  let r = seed * 9301 + 49297;
  const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280) - 0.5;
  const j = (v, k = 3) => v + rnd() * k;
  const P = [];
  for (let t = 0; t <= 16; t++) { const th = Math.PI * t / 16, z = opt.zigzag ? (t % 2 ? 9 : -9) : 0; P.push([j(200 - (80 + z) * Math.cos(th)), j(180 + (140 + z) * Math.sin(th))]); }
  for (const [x0, x1] of [[135, 185], [215, 265]]) for (let k = 0; k < 5; k++) { const x = x0 + (x1 - x0) * k / 4; P.push([j(x), j(150 - 8 * Math.sin(Math.PI * k / 4))]); }
  const nx = 200 + (opt.yaw || 0);
  for (let k = 0; k < 4; k++) P.push([j(nx, 1), 160 + k * 18]);
  for (let k = 0; k < 5; k++) P.push([j(185 + k * 7.5, 1), j(225 + (k === 2 ? 3 : 0), 1)]);
  const eye = (cx) => [[cx - 15, 175], [cx - 5, 169], [cx + 5, 169], [cx + 15, 175], [cx + 5, 181], [cx - 5, 181]].map(([x, y]) => [j(x, 1.5), j(y, 1)]);
  P.push(...eye(160), ...eye(240));
  P.push(...[[175, 260], [183, 253], [192, 250], [200, 252], [208, 250], [217, 253], [225, 260], [217, 266], [208, 269], [200, 270], [192, 269], [183, 266]].map(([x, y]) => [j(x, 1.5), j(y, 1)]));
  P.push(...[[178, 260], [192, 257], [200, 258], [208, 257], [222, 260], [208, 262], [200, 263], [192, 262]].map(([x, y]) => [x, y]));
  const c = document.createElement("canvas"); c.width = c.height = 400;
  const g = c.getContext("2d");
  g.fillStyle = "#9db4c8"; g.fillRect(0, 0, 400, 400);
  g.fillStyle = `rgb(${220 + rnd() * 20},${180 + rnd() * 20},${150 + rnd() * 20})`;
  g.beginPath(); g.ellipse(200, 210, 95, 130, 0, 0, 7); g.fill();
  g.fillStyle = "#fff"; for (const cx of [160, 240]) { g.beginPath(); g.ellipse(cx, 175, 15, 6, 0, 0, 7); g.fill(); }
  g.fillStyle = "#4a6a8a"; for (const cx of [160, 240]) { g.beginPath(); g.arc(cx, 175, 5, 0, 7); g.fill(); }
  g.strokeStyle = "#5a3a2a"; g.lineWidth = 4; for (const [x0, x1] of [[135, 185], [215, 265]]) { g.beginPath(); g.moveTo(x0, 150); g.quadraticCurveTo((x0 + x1) / 2, 140, x1, 150); g.stroke(); }
  g.fillStyle = "#b5555a"; g.beginPath(); g.ellipse(200, 260, 25, 8, 0, 0, 7); g.fill();
  const { norm, frame } = M.normalize(P);
  const box = { x: 120, y: 140, width: opt.width || 160, height: 180 };
  const occ = { beard: !!opt.beard, fringe: false, glasses: !!opt.glasses };
  const { warn, q } = M.quality(norm, box, occ, opt.age ?? 30);
  const desc = new Float32Array(128); for (let i = 0; i < 128; i++) desc[i] = Math.sin(i * 1.7 + (opt.family || 0)) * 0.09 + rnd() * 0.05;
  const det = { id: 0, pts: P, norm, frame, box, occ, warn, q, age: opt.age ?? 30, desc, m: M.measures(M.symmetrize(norm)), app: M.appearance(c, norm, frame), col: M.sampleColors(c, P), img: { sharp: opt.sharp ?? 10, light: opt.light ?? 130 } };
  return { canvas: c, det };
};
