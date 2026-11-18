// St. Armands Circle (2026-11-16): the shop ring, the centre park, statues, crosswalks and parked cars,
// all built in code from research/st-armands-visual-spec.md and st-armands-geometry.json.
// Exports: buildArmands(scene, W, G) and armandsPlace(W) (centre + radii, fitted from the "Saint Armands Circle" roads,
// config.js ARMANDS as the fallback). main.js clears the six merged OSM blocks first with W.exclusions.push([x, z, clear])
// and world.js buildPalms skips palms within `palms` m of the centre; both read armandsPlace().
// Everything is merged per material (MeshLambertMaterial only, Safari turns Standard black):
//   shops (casts shadows), solid props, foliage, ground, crosswalk texture, Three Graces lettering, parked cars.
// Frame: game x east, z south; bearing th = compass angle from the centre (0 north, 90 east),
// P(th, r) = centre + r * (sin th, -cos th). Every part is placed from the real road data at load time
// (ring radius, spoke polylines), so shops leave a gap wherever any road meets the ring.
import * as THREE from 'three';
import { ARMANDS } from './config.js';

// the one definition of where the Circle is: centre fitted to the ring road points, fallback to config.js
export function armandsPlace(W) {
  if (W._armandsPlace) return W._armandsPlace;
  const pts = [];
  for (const rd of W.roads || []) {
    if (!/Saint Armands Circle|St\.? Armands Circle/i.test(rd.n || '')) continue;
    for (let i = 0; i < rd.p.length; i += 3) if (Math.hypot(rd.p[i] - ARMANDS.x, rd.p[i + 1] - ARMANDS.z) < 150) pts.push([rd.p[i], rd.p[i + 1]]);
  }
  let x = ARMANDS.x, z = ARMANDS.z;
  if (pts.length >= 8) {
    let cx = pts.reduce((a, q) => a + q[0], 0) / pts.length, cz = pts.reduce((a, q) => a + q[1], 0) / pts.length;
    for (let k = 0; k < 100; k++) {
      const rs = pts.map((q) => Math.hypot(q[0] - cx, q[1] - cz)), m = rs.reduce((a, b) => a + b, 0) / rs.length;
      cx += pts.reduce((a, q, i) => a + (q[0] - cx) / rs[i], 0) / pts.length * m; cz += pts.reduce((a, q, i) => a + (q[1] - cz) / rs[i], 0) / pts.length * m;
    }
    if (Math.hypot(cx - ARMANDS.x, cz - ARMANDS.z) < 30) { x = cx; z = cz; }
  }
  return (W._armandsPlace = { x, z, clear: ARMANDS.clear, palms: ARMANDS.palms });
}
let CX = ARMANDS.x, CZ = ARMANDS.z;
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const P = (th, r) => [CX + r * Math.sin(th), CZ - r * Math.cos(th)];

// ------------------------------------------------------------- small helpers
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hash2 = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return (a + (b - a) * sx) * (1 - sz) + (c + (d - c) * sx) * sz;
}
const colCache = new Map();
function C(hex) { let c = colCache.get(hex); if (!c) { c = new THREE.Color(hex); colCache.set(hex, c); } return c; }
const shade = (hex, k) => { const c = C(hex); return new THREE.Color(Math.min(1, c.r * k), Math.min(1, c.g * k), Math.min(1, c.b * k)); };
const mix = (h1, h2, t) => C(h1).clone().lerp(C(h2), t);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

// Triangle soup with flat normals and vertex colours. All materials are DoubleSide, so winding does not matter.
class MB {
  constructor() { this.p = []; this.n = []; this.c = []; }
  get tris() { return this.p.length / 9; }
  tri(a, b, c, col, up) {
    let nn = norm(cross(sub(b, a), sub(c, a)));
    if (up) { if (nn[1] < 0) { const t = b; b = c; c = t; } nn = [0, 1, 0]; }   // flat-up faces: wind them upward so DoubleSide never flips the normal
    const k = col.isColor ? col : C(col);
    for (const v of [a, b, c]) { this.p.push(v[0], v[1], v[2]); this.n.push(nn[0], nn[1], nn[2]); this.c.push(k.r, k.g, k.b); }
  }
  quad(a, b, c, d, col, up) { this.tri(a, b, c, col, up); this.tri(a, c, d, col, up); }
  // axis-aligned-in-plan box turned by ang about y; (x, y0, z) is the middle of the base
  box(x, y0, z, w, h, d, ang, col, topCol) {
    const c = Math.cos(ang), s = Math.sin(ang);
    const q = (lx, lz) => [lx * c + lz * s, -lx * s + lz * c];
    const bp = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([lx, lz]) => { const [a, b] = q(lx, lz); return [x + a, z + b]; });
    const B = bp.map((p) => [p[0], y0, p[1]]), T = bp.map((p) => [p[0], y0 + h, p[1]]);
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; this.quad(B[i], B[j], T[j], T[i], col); }
    this.quad(T[0], T[1], T[2], T[3], topCol || col, true);
  }
  // frustum between two points, seg sides, with end caps; phase turns the polygon
  tube(p0, p1, r0, r1, seg, col, phase = 0, capTop = true) {
    const ax = norm(sub(p1, p0));
    const ref = Math.abs(ax[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0];
    const u = norm(cross(ax, ref)), v = cross(ax, u);
    const ring = (p, r) => { const o = []; for (let i = 0; i < seg; i++) { const a = phase + i / seg * TAU; o.push([p[0] + (u[0] * Math.cos(a) + v[0] * Math.sin(a)) * r, p[1] + (u[1] * Math.cos(a) + v[1] * Math.sin(a)) * r, p[2] + (u[2] * Math.cos(a) + v[2] * Math.sin(a)) * r]); } return o; };
    const A = ring(p0, r0), B = ring(p1, r1);
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg;
      if (r1 > 0.001) this.quad(A[i], A[j], B[j], B[i], col); else this.tri(A[i], A[j], p1, col);
      if (i > 0 && i < seg - 1) { if (capTop && r1 > 0.001) this.tri(B[0], B[i], B[i + 1], col); }
    }
  }
  cyl(x, y0, z, r0, r1, h, seg, col, phase = 0) { this.tube([x, y0, z], [x, y0 + h, z], r0, r1, seg, col, phase); }
  ico(x, y, z, rx, ry, rz, detail, col, geoCache) {
    const key = detail; let g = geoCache.get(key);
    if (!g) { g = new THREE.IcosahedronGeometry(1, detail).toNonIndexed(); geoCache.set(key, g); }
    const pa = g.attributes.position.array;
    for (let i = 0; i < pa.length; i += 9) {
      const t = [0, 1, 2].map((k) => [x + pa[i + k * 3] * rx, y + pa[i + k * 3 + 1] * ry, z + pa[i + k * 3 + 2] * rz]);
      this.tri(t[0], t[1], t[2], col);
    }
  }
  mesh(mat, shadow = false, receive = false) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.castShadow = shadow; m.receiveShadow = receive; m.frustumCulled = true;
    return m;
  }
}

// ------------------------------------------------------------- the real road data around the circle
function readRoads(W) {
  const ring = [], segs = [], spokes = [], others = [];
  for (const rd of W.roads) {
    const p = rd.p, n = p.length / 3, hw = rd.w / 2;
    let near = false;
    for (let i = 0; i < n; i++) if (Math.hypot(p[i * 3] - CX, p[i * 3 + 1] - CZ) < 230) { near = true; break; }
    if (!near) continue;
    if (/Saint Armands Circle|St\.? Armands Circle/i.test(rd.n || '')) {
      for (let i = 0; i < n; i++) ring.push({ a: Math.atan2(p[i * 3] - CX, -(p[i * 3 + 1] - CZ)), r: Math.hypot(p[i * 3] - CX, p[i * 3 + 1] - CZ), hw });
      continue;
    }
    for (let i = 0; i < n - 1; i++) segs.push([p[i * 3], p[i * 3 + 1], p[i * 3 + 3], p[i * 3 + 4], hw]);
    if (rd.n && !/footway|path|cycleway|pedestrian|steps|service/.test(rd.k)) others.push(p);
    if (rd.n && !/service/.test(rd.k)) spokes.push({ rd, hw });
  }
  ring.sort((a, b) => a.a - b.a);
  const dd = [];
  for (const q of ring) { const l = dd[dd.length - 1]; if (l && Math.abs(q.a - l.a) < 0.004) { l.r = Math.max(l.r, q.r); l.hw = Math.max(l.hw, q.hw); } else dd.push({ ...q }); }
  const ext = [...dd.slice(-2).map((q) => ({ ...q, a: q.a - TAU })), ...dd, ...dd.slice(0, 2).map((q) => ({ ...q, a: q.a + TAU }))];
  const at = (th) => {
    let a = th; while (a >= Math.PI) a -= TAU; while (a < -Math.PI) a += TAU;
    let i = 0; while (i < ext.length - 2 && ext[i + 1].a < a) i++;
    const u = Math.min(1, Math.max(0, (a - ext[i].a) / ((ext[i + 1].a - ext[i].a) || 1)));
    return { rc: ext[i].r + (ext[i + 1].r - ext[i].r) * u, hw: Math.max(ext[i].hw, ext[i + 1].hw) };
  };
  const segDist = (x, z, s) => {
    const dx = s[2] - s[0], dz = s[3] - s[1], l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - s[0]) * dx + (z - s[1]) * dz) / l2));
    return Math.hypot(x - s[0] - dx * t, z - s[1] - dz * t);
  };
  const clearance = (x, z) => { let m = 1e9; for (const s of segs) { const d = segDist(x, z, s) - s[4]; if (d < m) m = d; } return m; };
  // spoke mouths: where any road meets or crosses the ring. A spoke stops at the ring road's centre line, so the mouth on the
  // park side is the inner ring edge at that bearing (a straight-through spoke gives two mouths, one each side of the park).
  const mouths = [];
  const addMouth = (x, z) => {
    const th = Math.atan2(x - CX, -(z - CZ)), q = at(th), mx = CX + (q.rc - q.hw) * Math.sin(th), mz = CZ - (q.rc - q.hw) * Math.cos(th);
    if (!mouths.some((m) => Math.hypot(m[0] - mx, m[1] - mz) < 3)) mouths.push([mx, mz]);
  };
  const fr = (x, z) => Math.hypot(x - CX, z - CZ) - at(Math.atan2(x - CX, -(z - CZ))).rc;
  for (const p of others) {
    const n = p.length / 3;
    for (let i = 0; i < n; i++) if (Math.abs(fr(p[i * 3], p[i * 3 + 1])) < 6) addMouth(p[i * 3], p[i * 3 + 1]);
    for (let i = 0; i < n - 1; i++) {
      const f0 = fr(p[i * 3], p[i * 3 + 1]), f1 = fr(p[i * 3 + 3], p[i * 3 + 4]);
      if (f0 * f1 >= 0) continue;
      const u = f0 / (f0 - f1);
      addMouth(p[i * 3] + (p[i * 3 + 3] - p[i * 3]) * u, p[i * 3 + 1] + (p[i * 3 + 4] - p[i * 3 + 1]) * u);
    }
  }
  return { at, clearance, spokes, mouths, rin: (th) => { const q = at(th); return q.rc - q.hw; }, rout: (th) => { const q = at(th); return q.rc + q.hw; } };
}

// ------------------------------------------------------------- canvas textures
function brickCanvas() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#d8c8b8'; g.fillRect(0, 0, 128, 128);
  const tones = ['#b05a4a', '#a65a4a', '#bd6a56', '#9f5244', '#c4705a'];
  let k = 0;
  for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {   // 16 px cells; herringbone-style 2x1 pavers, turned every other cell
    const x = i * 16, y = j * 16, horiz = (i + j) % 2 === 0;
    for (let q = 0; q < 2; q++) {
      g.fillStyle = tones[(k++ * 7 + i * 3 + j) % tones.length];
      if (horiz) g.fillRect(x + 1, y + q * 8 + 1, 14, 6); else g.fillRect(x + q * 8 + 1, y + 1, 6, 14);
    }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function gracesCanvas() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 140;
  const g = c.getContext('2d');
  g.fillStyle = '#e6e3da'; g.fillRect(0, 0, 1024, 140);
  g.fillStyle = '#2b2b2e'; g.font = 'bold 92px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('ST. ARMANDS KEY', 512, 74, 980);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// ------------------------------------------------------------- build
export function buildArmands(scene, W, G) {
  const AP = armandsPlace(W); CX = AP.x; CZ = AP.z;
  const R = readRoads(W);
  const EXCL = AP.clear;
  const rand = rng(2026);
  const rr = (a, b) => a + (b - a) * rand();
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const icoCache = new Map();
  const shops = new MB(), solid = new MB(), leaf = new MB(), ground = new MB(), cars = new MB();
  // colliders go straight into the world (custom flag keeps them out of the OSM-only checks); the minimap and big map
  // draw every bList polygon, so each shop and back building shows there as its own footprint
  const add = (poly, h, bld = false) => { const i = W.addCollider(poly, h); const b = W.bList[i]; b.custom = true; if (bld) b.armandsBld = true; else b.tiny = true; info.colliders++; return i; };   // armandsBld: drawn on the maps in a stronger tone; tiny: not drawn there
  const addSq = (x, z, s, h) => { const hs = s / 2; add([x - hs, z - hs, x + hs, z - hs, x + hs, z + hs, x - hs, z + hs], h); };
  const addBox = (x, z, w, d, ang, h, bld = false) => {   // same turn as MB.box
    const c = Math.cos(ang), sn = Math.sin(ang), o = [];
    for (const [lx, lz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]]) o.push(x + lx * c + lz * sn, z - lx * sn + lz * c);
    add(o, h, bld);
  };
  const mouthD = (x, z) => { let m = 1e9; for (const q of R.mouths) m = Math.min(m, Math.hypot(q[0] - x, q[1] - z)); return m; };
  const nearMouth = (x, z, d = 10) => mouthD(x, z) < d;
  // windows along a wall from ground point a to ground point b; (ox, oz) is the outward unit normal. Frame plus glass, pitch about 3.4 m.
  const wallWindows = (mb, a, b, ox, oz, floors, skipDoor = false) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), tx = (b[0] - a[0]) / len, tz = (b[1] - a[1]) / len, n = Math.max(2, Math.floor(len / 3.4));
    const V = (s, y, o) => [a[0] + tx * s + ox * o, y, a[1] + tz * s + oz * o];
    for (let i = 0; i < n; i++) {
      const sc = (i + 0.5) * len / n;
      if (skipDoor && i === Math.floor(n / 2)) { mb.quad(V(sc - 0.6, 0, 0.06), V(sc + 0.6, 0, 0.06), V(sc + 0.6, 2.3, 0.06), V(sc - 0.6, 2.3, 0.06), 0x5a4636); continue; }
      for (let fl = 0; fl < floors; fl++) {
        const y0 = 1.3 + fl * 3.4, y1 = y0 + 1.6, w = 0.7;
        mb.quad(V(sc - w - 0.1, y0 - 0.1, 0.06), V(sc + w + 0.1, y0 - 0.1, 0.06), V(sc + w + 0.1, y1 + 0.1, 0.06), V(sc - w - 0.1, y1 + 0.1, 0.06), 0xf4f4f2);
        mb.quad(V(sc - w, y0, 0.08), V(sc + w, y0, 0.08), V(sc + w, y1, 0.08), V(sc - w, y1, 0.08), 0x56707d);
      }
    }
  };
  const info = { backBuildings: 0, lots: 0, shops: 0, runs: 0, gaps: 0, trees: 0, palms: 0, statues: 0, crosswalks: 0, cars: 0, colliders: 0 };

  // ---- shop frontage radius: a fixed offset beyond the real ring outer edge (the ring is out of round)
  const FRONT = 6.6;
  const rf = (th) => R.rout(th) + FRONT;
  const DEPTH_MAX = 38;

  // ---- which bearings are free for shops: no road within 3.6 m of the footprint (front to back)
  const N = 3600, dth = TAU / N;
  const blocked = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const th = -Math.PI + (i + 0.5) * dth, f = rf(th);
    for (let k = 0; k <= 12; k++) {
      const [x, z] = P(th, f + DEPTH_MAX * k / 12);
      if (R.clearance(x, z) < 3.6) { blocked[i] = 1; break; }
    }
  }
  let start = blocked.indexOf(1); if (start < 0) start = 0;
  const runs = [];
  for (let k = 0, run = null; k <= N; k++) {
    const i = (start + k) % N, free = !blocked[i] && k < N;
    if (free) { if (!run) run = { i0: k, i1: k }; else run.i1 = k; } else if (run) { runs.push(run); run = null; }
  }
  const ang = (k) => -Math.PI + (((start + k) % N)) * dth;   // bearing of the start edge of cell k (relative to start)
  const runAngles = (run) => { const a0 = -Math.PI + start * dth + run.i0 * dth, a1 = -Math.PI + start * dth + (run.i1 + 1) * dth; return [a0, a1]; };

  // ---- palettes
  const WALLS = [0xf0ece0, 0xe8e0cc, 0xd8c9a8, 0xc9b69a, 0xeed9c8, 0xd98f8a, 0x62b3b0, 0x4b8fc9, 0xf4f4f2, 0x6aa18a, 0xe8e0cc, 0xf0ece0, 0xeed9c8];
  const AWN = [0xb8362f, 0xc46a3a, 0x1f3a5f, 0x2aa39b, 0xf2b925, 0x2f7a4f, 0x24503a, 0xb8362f, 0x1f3a5f];
  const SIGNS = [0x2c4560, 0x6e1f2a, 0xf0e8d4, 0x2f4a3a, 0x4a3426, 0x6e1f2a];
  const TILE = [0xc8643f, 0xb8562f], TAN = 0xc4a272;
  const GREEN = 0x2d4a3c;

  // ================================================================= SHOPS
  const arcSpan = (a0, a1) => (a1 - a0) * rf((a0 + a1) / 2);
  let turretShop = null, bestTurret = 1e9;
  const shopList = [];
  for (const run of runs) {
    const [a0, a1] = runAngles(run);
    const L = arcSpan(a0, a1);
    if (L < 5.6) continue;
    const nShops = Math.max(1, Math.round(L / 7.4));
    const w = []; let tot = 0;
    for (let i = 0; i < nShops; i++) { const v = rr(0.8, 1.25); w.push(v); tot += v; }
    let a = a0, lastCol = -1;
    const poly = [];
    const front = [], back = [];
    for (let i = 0; i < nShops; i++) {
      const b = i === nShops - 1 ? a1 : a + (a1 - a0) * w[i] / tot;
      let ci; do { ci = Math.floor(rand() * WALLS.length); } while (ci === lastCol); lastCol = ci;
      const sh = { a, b, D: rr(17, 31), wall: WALLS[ci], floors: rand() < 0.45 ? 2 : 1, kind: rand(), idx: shopList.length };
      shopList.push(sh);
      const cen = (a + b) / 2, off = Math.abs(((cen * 180 / Math.PI) + 360) % 360 - 315);
      if (off < bestTurret) { bestTurret = off; turretShop = sh; }
      a = b;
    }
    const mine = shopList.slice(shopList.length - nShops);
    mine[0].endA = true; mine[mine.length - 1].endB = true;
    info.runs++;
  }
  if (turretShop) { turretShop.turret = true; turretShop.floors = 2; }

  for (const sh of shopList) {
    const { a, b, D } = sh;
    const ra = rf(a), rb = rf(b);
    const F0 = P(a, ra), F1 = P(b, rb), B0 = P(a, ra + D), B1 = P(b, rb + D);
    const fx = F1[0] - F0[0], fz = F1[1] - F0[1], wid = Math.hypot(fx, fz);
    const tx = fx / wid, tz = fz / wid;
    let nx = -tz, nz = tx;                          // n points from the facade out to the street (toward the centre)
    const mx = (F0[0] + F1[0]) / 2, mz = (F0[1] + F1[1]) / 2;
    if (nx * (CX - mx) + nz * (CZ - mz) < 0) { nx = -nx; nz = -nz; }
    const pt = (s, o, y) => [F0[0] + tx * s + nx * o, y, F0[1] + tz * s + nz * o];
    const bk = (s, o, y) => [F0[0] + tx * s - nx * o, y, F0[1] + tz * s - nz * o];   // o metres behind the facade
    const H = sh.floors === 2 ? 8.6 : 5.3;
    const tileRoof = sh.kind >= 0.62 && sh.kind < 0.74 && !sh.turret;   // low tan hip
    // one collider per shop at that shop's own roof height (a hip roof peaks 1.9 m up, take the middle)
    add([F0[0], F0[1], F1[0], F1[1], B1[0], B1[1], B0[0], B0[1]], tileRoof ? H + 0.9 : H, true);
    const wall = sh.wall, wallD = mix(wall, 0xf0ece0, 0.4),   // back and end walls: lifted toward cream so a blue or teal shop is not near-black in the evening shade
     ba = Math.atan2(-tz, tx);   // ba: box angle with local x along the facade
    // body: front, back, two ends, roof
    const f0 = [F0[0], 0, F0[1]], f1 = [F1[0], 0, F1[1]], b0 = [B0[0], 0, B0[1]], b1 = [B1[0], 0, B1[1]];
    const up = (p) => [p[0], H, p[2]];
    const roofCol = sh.kind < 0.3 ? 0x9d9a94 : sh.kind < 0.6 ? 0xb9b4a6 : 0xa8a49a;
    shops.quad(f0, f1, up(f1), up(f0), wall);
    shops.quad(b0, b1, up(b1), up(b0), wallD);
    shops.quad(f0, b0, up(b0), up(f0), wallD);
    shops.quad(f1, b1, up(b1), up(f1), wallD);
    const gable = sh.kind >= 0.3 && sh.kind < 0.5;                        // barrel-tile gable accent over the facade
    if (!tileRoof) shops.quad(up(f0), up(f1), up(b1), up(b0), roofCol, true);
    else {
      const i1 = Math.min(1.8, wid * 0.25), i2 = Math.min(7, D * 0.3), hh = 1.9;
      const ridge = [[i1, i2], [wid - i1, i2], [wid - i1, D - i2], [i1, D - i2]].map(([s, d]) => bk(s, d, H + hh));
      const rim = [up(f0), up(f1), up(b1), up(b0)];
      shops.quad(rim[0], rim[1], ridge[1], ridge[0], TAN);
      shops.quad(rim[1], rim[2], ridge[2], ridge[1], shade(TAN, 0.9));
      shops.quad(rim[2], rim[3], ridge[3], ridge[2], shade(TAN, 0.95));
      shops.quad(rim[3], rim[0], ridge[0], ridge[3], shade(TAN, 0.9));
      shops.quad(ridge[0], ridge[1], ridge[2], ridge[3], shade(TAN, 1.05));
    }
    // windows on a side wall that faces a gap (run ends), so the gaps do not show a blank slab
    for (const [flag, F, B, dir] of [[sh.endA, F0, B0, -1], [sh.endB, F1, B1, 1]]) {
      if (!flag) continue;
      const L = (d, y) => [F[0] + (B[0] - F[0]) * d / D + tx * dir * 0.06, y, F[1] + (B[1] - F[1]) * d / D + tz * dir * 0.06];
      const nw = Math.max(2, Math.floor(D / 4.2));
      for (let fl = 0; fl < sh.floors; fl++) for (let i = 0; i < nw; i++) {
        const d0 = 1.8 + i * (D - 3.2) / nw, d1 = d0 + 1.5, y0 = 1.2 + fl * 3.4, y1 = y0 + 1.7;
        shops.quad(L(d0 - 0.1, y0 - 0.1), L(d1 + 0.1, y0 - 0.1), L(d1 + 0.1, y1 + 0.1), L(d0 - 0.1, y1 + 0.1), 0xf4f4f2);
        const M = (d, y) => { const q = L(d, y); return [q[0] + tx * dir * 0.02, q[1], q[2] + tz * dir * 0.02]; };
        shops.quad(M(d0, y0), M(d1, y0), M(d1, y1), M(d0, y1), 0x4d6572);
      }
    }
    // back wall: a row of windows and a service door, so it never reads as a blank slab
    wallWindows(shops, [B0[0], B0[1]], [B1[0], B1[1]], -nx, -nz, sh.floors, true);
    // cornice + plinth
    shops.quad(pt(-0.05, 0.3, H - 0.55), pt(wid + 0.05, 0.3, H - 0.55), pt(wid + 0.05, 0.3, H + 0.05), pt(-0.05, 0.3, H + 0.05), shade(wall, 1.06));
    shops.quad(pt(-0.05, 0.3, H + 0.05), pt(wid + 0.05, 0.3, H + 0.05), pt(wid + 0.05, 0, H + 0.05), pt(-0.05, 0, H + 0.05), shade(wall, 1.08));
    shops.quad(pt(0, 0.05, 0), pt(wid, 0.05, 0), pt(wid, 0.05, 0.45), pt(0, 0.05, 0.45), 0x8f8b82);
    // storefront glass, door, sign board
    const gl = 0x4d6572, gl2 = 0x83a0ad;
    const nWin = wid > 8 ? 3 : 2;
    const winW = (wid - 1.0 - 0.5 * nWin) / nWin;
    for (let i = 0; i < nWin; i++) {
      const s0 = 0.5 + i * (winW + 0.5), isDoor = (i === (nWin > 2 ? 1 : 0)) && sh.kind > 0.2;
      if (isDoor) { shops.quad(pt(s0, 0.04, 0.45), pt(s0 + winW, 0.04, 0.45), pt(s0 + winW, 0.04, 3.1), pt(s0, 0.04, 3.1), 0x3c2a22); shops.quad(pt(s0 + 0.15, 0.06, 0.6), pt(s0 + winW - 0.15, 0.06, 0.6), pt(s0 + winW - 0.15, 0.06, 2.9), pt(s0 + 0.15, 0.06, 2.9), 0x6e8c98); }
      else { shops.quad(pt(s0, 0.04, 0.55), pt(s0 + winW, 0.04, 0.55), pt(s0 + winW, 0.04, 3.0), pt(s0, 0.04, 3.0), gl); shops.quad(pt(s0 + 0.1, 0.06, 1.7), pt(s0 + winW - 0.1, 0.06, 1.7), pt(s0 + winW - 0.1, 0.06, 2.9), pt(s0 + 0.1, 0.06, 2.9), gl2); }
    }
    const signC = pick(SIGNS), sw0 = wid * 0.12, sw1 = wid * 0.88;
    shops.quad(pt(sw0, 0.13, 3.55), pt(sw1, 0.13, 3.55), pt(sw1, 0.13, 4.5), pt(sw0, 0.13, 4.5), signC);
    shops.quad(pt(sw0 + 0.25, 0.15, 3.8), pt(sw1 - 0.25, 0.15, 3.8), pt(sw1 - 0.25, 0.15, 4.25), pt(sw0 + 0.25, 0.15, 4.25), signC === 0xf0e8d4 ? 0x2b2b2e : 0xe8e0cc);   // blank lettering band
    if (sh.floors === 2) {
      const n2 = Math.max(2, Math.round(wid / 2.6)), ww = wid / n2;
      for (let i = 0; i < n2; i++) {
        const s0 = i * ww + ww * 0.22, s1 = i * ww + ww * 0.78;
        shops.quad(pt(s0 - 0.12, 0.04, 5.4), pt(s1 + 0.12, 0.04, 5.4), pt(s1 + 0.12, 0.04, 7.7), pt(s0 - 0.12, 0.04, 7.7), 0xf4f4f2);
        shops.quad(pt(s0, 0.06, 5.55), pt(s1, 0.06, 5.55), pt(s1, 0.06, 7.55), pt(s0, 0.06, 7.55), 0x4d6572);
      }
    }
    // awning (stripes or solid), or an arcade of slim columns under a flat black awning
    const arcade = sh.kind >= 0.9;
    if (arcade) {
      const arcCol = sh.idx % 2 ? 0x24503a : 0x7a2430;   // dark green or deep red, never black (a black awning reads as a hole)
      shops.quad(pt(0.2, 0, 3.05), pt(wid - 0.2, 0, 3.05), pt(wid - 0.2, 2.2, 3.05), pt(0.2, 2.2, 3.05), arcCol);
      shops.quad(pt(0.2, 2.2, 3.05), pt(wid - 0.2, 2.2, 3.05), pt(wid - 0.2, 2.2, 3.35), pt(0.2, 2.2, 3.35), arcCol);
      const nc = Math.max(2, Math.round(wid / 3));
      for (let i = 0; i <= nc; i++) { const s = 0.2 + (wid - 0.4) * i / nc, p = pt(s, 2.1, 0); shops.box(p[0], 0, p[2], 0.25, 3.05, 0.25, 0, 0xf3f1ea); }
    } else {
      const ac = pick(AWN), striped = rand() < 0.62, ac2 = 0xf4f1ea;
      const aw = wid - 0.8, d = 2.0, y0 = 3.45, y1 = 2.75, ns = striped ? Math.max(4, Math.round(aw / 0.55)) : 1;
      for (let i = 0; i < ns; i++) {
        const s0 = 0.4 + aw * i / ns, s1 = 0.4 + aw * (i + 1) / ns, col = striped && i % 2 ? ac2 : ac;
        shops.quad(pt(s0, 0, y0), pt(s1, 0, y0), pt(s1, d, y1), pt(s0, d, y1), col);
        shops.quad(pt(s0, d, y1), pt(s1, d, y1), pt(s1, d + 0.04, y1 - 0.3), pt(s0, d + 0.04, y1 - 0.3), col);
      }
      shops.tri(pt(0.4, 0, y0), pt(0.4, d, y1), pt(0.4, d, y1 - 0.3), ac);
      shops.tri(pt(0.4 + aw, 0, y0), pt(0.4 + aw, d, y1), pt(0.4 + aw, d, y1 - 0.3), ac);
    }
    // blade sign on a bracket at one end
    if (rand() < 0.5) {
      const p = pt(wid - 0.15, 1.15, 3.2);
      shops.box(p[0], 3.15, p[2], 0.08, 0.8, 0.7, ba, pick(SIGNS));
      const q = pt(wid - 0.15, 0.55, 3.9); shops.box(q[0], 3.9, q[2], 0.05, 0.05, 1.1, ba, 0x222222);
    }
    // barrel-tile gable accent
    if (gable) {
      const g0 = wid * 0.12, g1 = wid * 0.88, gh = 2.6, ridgeLen = Math.min(D * 0.55, 13);
      const apex0 = pt((g0 + g1) / 2, 0.2, H + gh), apexB = bk((g0 + g1) / 2, ridgeLen, H + gh);
      const eL0 = pt(g0, 0.2, H), eR0 = pt(g1, 0.2, H), eLB = bk(g0, ridgeLen, H), eRB = bk(g1, ridgeLen, H);
      shops.tri(eL0, eR0, apex0, wall);
      shops.quad(pt(g0 - 0.15, 0.45, H - 0.1), pt(g1 + 0.15, 0.45, H - 0.1), pt(g1 + 0.15, 0.45, H + 0.2), pt(g0 - 0.15, 0.45, H + 0.2), 0xf4f1ea);
      const ns = 6;
      for (let i = 0; i < ns; i++) {
        const t0 = i / ns, t1 = (i + 1) / ns, col = TILE[i % 2];
        const lp = (e, ap, t) => [e[0] + (ap[0] - e[0]) * t, e[1] + (ap[1] - e[1]) * t, e[2] + (ap[2] - e[2]) * t];
        shops.quad(lp(eL0, apex0, t0), lp(eL0, apex0, t1), lp(eLB, apexB, t1), lp(eLB, apexB, t0), col);
        shops.quad(lp(eR0, apex0, t0), lp(eR0, apex0, t1), lp(eRB, apexB, t1), lp(eRB, apexB, t0), col);
      }
      const med = pt((g0 + g1) / 2, 0.24, H + 1.0); shops.box(med[0], med[1] - 0.3, med[2], 0.9, 0.6, 0.05, ba, 0x3a2a24);
    }
    // the one small white turret
    if (sh.turret) {
      const p = pt(Math.min(2.2, wid * 0.3), -1.6, H); shops.cyl(p[0], H, p[2], 1.55, 1.55, 3.3, 8, 0xeeeeee);
      shops.cyl(p[0], H + 3.3, p[2], 1.85, 0.0, 2.4, 8, 0xe8e6e0);
      shops.cyl(p[0], H + 5.5, p[2], 0.08, 0.0, 1.1, 5, 0x2a2a2e);
      addSq(p[0], p[2], 3.6, H + 5.7);   // the turret is taller than the shop under it, so it gets its own collider
    }
    // planter at the shop front now and then
    if (rand() < 0.45) {
      const s = rand() < 0.5 ? 0.45 : wid - 0.45, p = pt(s, 1.1, 0);
      solid.box(p[0], 0, p[2], 0.75, 0.5, 0.75, ba, 0xf4f1ea);
      leaf.ico(p[0], 0.65, p[2], 0.45, 0.32, 0.45, 0, 0x3b6b3a, icoCache);
      leaf.ico(p[0] + 0.15, 0.9, p[2] + 0.05, 0.14, 0.12, 0.14, 0, 0xd95f8a, icoCache);
      leaf.ico(p[0] - 0.12, 0.85, p[2] - 0.1, 0.12, 0.1, 0.12, 0, 0xd95f8a, icoCache);
    }
    info.shops++;
  }
  info.gaps = runs.length;

  // ================================================================= GROUND (y levels: lawn 0.04, path 0.07, walks 0.14)
  const Y_LAWN = 0.04, Y_PATH = 0.07, Y_WALK = 0.14, Y_BAY = 0.12, Y_CURB = 0.16;
  const stepsDeg = 1;
  const ringStep = (th0, th1, ra0, ra1, y, colFn, minClear = 0.4) => {
    // an annular quad from bearing th0..th1 between two radius functions; skipped if a (non-ring) road lies under it
    const tm = (th0 + th1) / 2;
    const pts = [P(th0, ra0(th0)), P(th1, ra0(th1)), P(th1, ra1(th1)), P(th0, ra1(th0)), P(tm, (ra0(tm) + ra1(tm)) / 2)];
    for (const p of pts) if (R.clearance(p[0], p[1]) < minClear) return false;
    ground.quad([pts[0][0], y, pts[0][1]], [pts[1][0], y, pts[1][1]], [pts[2][0], y, pts[2][1]], [pts[3][0], y, pts[3][1]], colFn(tm), true);
    return true;
  };
  for (let d = 0; d < 360; d += stepsDeg) {
    const th0 = -Math.PI + d * DEG, th1 = th0 + stepsDeg * DEG;
    const ro = (t) => R.rout(t);
    ringStep(th0, th1, (t) => ro(t) + 0.4, (t) => ro(t) + 2.5, Y_BAY, () => 0x8d8d8f);                       // parking bay (road grey)
    ringStep(th0, th1, (t) => ro(t) + 2.5, (t) => ro(t) + 2.95, Y_CURB, () => 0xcfcabf);                      // curb
    ringStep(th0, th1, (t) => ro(t) + 2.95, (t) => rf(t) + 0.05, Y_WALK, (t) => { const k = 0.97 + 0.06 * hash2(Math.floor(t * 200), 3); return shade(0xd5d0c4, k); });   // wide sidewalk
    ringStep(th0, th1, (t) => ro(t) + 4.4, (t) => ro(t) + 5.0, Y_WALK + 0.02, () => 0xb86a58);               // brick paver strip
    const ri = (t) => R.rin(t);
    ringStep(th0, th1, (t) => ri(t) - 0.45, (t) => ri(t) - 0.02, Y_CURB, () => 0xcfcabf);                     // inner curb
    ringStep(th0, th1, (t) => ri(t) - 2.45, (t) => ri(t) - 0.45, Y_WALK, () => 0xd0cdc4);                     // park-side walk
  }

  // ---- the park lawn: patchy sage and dry grass, sandy mulch under trees (filled in after the trees are placed)
  const rlawn = (t) => R.rin(t) - 2.45;
  const trees = [], palmsP = [];
  const pathB = [-2, 58, 108, 181, 245, 284, 322].map((b) => b * DEG);
  const nearPath = (x, z) => {
    let m = 1e9;
    for (const b of pathB) { const dx = Math.sin(b), dz = -Math.cos(b), px = x - CX, pz = z - CZ; const along = px * dx + pz * dz; if (along < 0) { m = Math.min(m, Math.hypot(px, pz)); continue; } m = Math.min(m, Math.abs(px * dz - pz * dx)); }
    return m;
  };
  // statues and features at the park edge (positions first so trees keep clear)
  const features = [];   // [x, z, radius]
  const edgeR = (th) => R.rin(th) - 4.4;
  // nearest bearing to b0 (within 25 degrees) whose park-edge point is at least dmin from every spoke mouth
  const clearBearing = (b0, rOff, dmin) => {
    for (let k = 0; k <= 50; k++) for (const sg of k ? [1, -1] : [1]) {
      const b = b0 + sg * k * 0.5 * DEG, [x, z] = P(b, R.rin(b) - rOff);
      if (mouthD(x, z) >= dmin) return b;
    }
    return null;
  };
  const ringlingB = clearBearing(146 * DEG, 2.5, 16) ?? 146 * DEG, gracesB = clearBearing(282 * DEG, 4.6, 15) ?? 282 * DEG;
  const statueB = [];
  for (const b0 of [14, 38, 76, 96, 122, 166, 196, 222, 262, 304, 338, 352]) {   // slide a statue along the edge until it is 14 m from every mouth (so plinth and hedge are over 10 m), drop it if none fits
    let got = null;
    for (let k = 0; k <= 16 && got === null; k++) for (const sg of k ? [1, -1] : [1]) {
      const b = (b0 + sg * k * 1.5) * DEG, [x, z] = P(b, edgeR(b));
      if (mouthD(x, z) < 14) continue;
      if (statueB.some((q) => Math.abs(q - b) < 7 * DEG)) continue;
      if (Math.abs(b - ringlingB) < 12 * DEG || Math.abs(b - gracesB) < 14 * DEG) continue;
      got = b; break;
    }
    if (got !== null) statueB.push(got);
  }
  // trees: poisson-ish scatter, 6 m clear in the middle, off the paths, inside the edge features
  for (let tries = 0; tries < 6000 && trees.length + palmsP.length < 31; tries++) {
    const th = rr(-Math.PI, Math.PI), rmax = R.rin(th) - 8.0;
    const rad = 10 + rand() * (rmax - 10);
    const [x, z] = P(th, rad);
    if (nearPath(x, z) < 3.2 || nearMouth(x, z, 10)) continue;
    if ([...trees, ...palmsP].some((q) => Math.hypot(q.x - x, q.z - z) < 5.2)) continue;
    const isPalm = (trees.length + palmsP.length) % 2 === 1;
    (isPalm ? palmsP : trees).push({ x, z });
  }
  // lawn: one smooth canvas texture (soft patches of green, dry grass and sandy mulch under the trees) on a fan of triangles
  const lawn = { geo: null, tex: null };
  {
    const SEG = 96, TS = 1024;
    let lmax = 0; for (let j = 0; j < SEG; j++) lmax = Math.max(lmax, rlawn(-Math.PI + j / SEG * TAU));
    const size = lmax * 2 + 2, x0 = CX - size / 2, z0 = CZ - size / 2, k = TS / size;
    const c = document.createElement('canvas'); c.width = c.height = TS;
    const g = c.getContext('2d');
    g.fillStyle = '#8c9b55'; g.fillRect(0, 0, TS, TS);
    const blob = (x, z, r, rgb, a) => {
      const px = (x - x0) * k, py = (z - z0) * k, pr = r * k, gr = g.createRadialGradient(px, py, 0, px, py, pr);
      gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(0.55, `rgba(${rgb},${a * 0.5})`); gr.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = gr; g.fillRect(px - pr, py - pr, pr * 2, pr * 2);
    };
    const GREENS = ['112,140,66', '132,150,74', '104,128,70', '150,160,86', '176,168,98', '120,146,84'];
    for (let i = 0; i < 380; i++) blob(x0 + rand() * size, z0 + rand() * size, rr(2.5, 9), pick(GREENS), rr(0.25, 0.5));   // big soft patches
    for (let i = 0; i < 700; i++) blob(x0 + rand() * size, z0 + rand() * size, rr(0.6, 2.2), pick(GREENS), rr(0.2, 0.45));   // small tufts
    for (let i = 0; i < 14; i++) blob(x0 + rand() * size, z0 + rand() * size, rr(3, 6), '212,198,160', rr(0.35, 0.6));       // bare sandy patches
    for (const q of trees) { blob(q.x, q.z, 5.4, '196,178,140', 0.8); blob(q.x + rr(-1, 1), q.z + rr(-1, 1), 3.2, '170,146,112', 0.55); }   // mulch beds
    for (const q of palmsP) { blob(q.x, q.z, 3.8, '206,190,150', 0.8); blob(q.x, q.z, 2.0, '176,152,116', 0.5); }
    lawn.tex = new THREE.CanvasTexture(c); lawn.tex.colorSpace = THREE.SRGBColorSpace; lawn.tex.anisotropy = 4;
    const pos = [CX, Y_LAWN, CZ], uv = [(CX - x0) / size, 1 - (CZ - z0) / size], idx = [];
    for (let j = 0; j < SEG; j++) { const t = -Math.PI + j / SEG * TAU, [x, z] = P(t, rlawn(t)); pos.push(x, Y_LAWN, z); uv.push((x - x0) / size, 1 - (z - z0) / size); }
    for (let j = 0; j < SEG; j++) { const a = 1 + j, b = 1 + (j + 1) % SEG; const cr = (pos[b * 3 + 2] - pos[2]) * (pos[a * 3] - pos[0]) - (pos[b * 3] - pos[0]) * (pos[a * 3 + 2] - pos[2]); if (cr >= 0) idx.push(0, b, a); else idx.push(0, a, b); }
    lawn.geo = new THREE.BufferGeometry();
    lawn.geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); lawn.geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    lawn.geo.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3)); lawn.geo.setIndex(idx); lawn.geo.computeBoundingSphere();
  }
  // paths and the little centre plaza ring (the exact centre stays open: the checkpoint marker draws there)
  for (const b of pathB) {
    const dx = Math.sin(b), dz = -Math.cos(b), px = -dz, pz = dx, r0 = 8.2, r1 = rlawn(b) + 0.4, hw = 1.0;
    ground.quad([CX + dx * r0 + px * hw, Y_PATH, CZ + dz * r0 + pz * hw], [CX + dx * r1 + px * hw, Y_PATH, CZ + dz * r1 + pz * hw], [CX + dx * r1 - px * hw, Y_PATH, CZ + dz * r1 - pz * hw], [CX + dx * r0 - px * hw, Y_PATH, CZ + dz * r0 - pz * hw], 0xd0cdc4, true);
  }
  for (let k = 0; k < 40; k++) {
    const t0 = k / 40 * TAU, t1 = (k + 1) / 40 * TAU, col = k % 2 ? 0xb86a58 : 0xc4705a;
    const A = P(t0, 6.4), B = P(t1, 6.4), Cc = P(t1, 8.6), D = P(t0, 8.6), v = (p) => [p[0], Y_PATH + 0.03, p[1]];
    ground.quad(v(A), v(B), v(Cc), v(D), col, true);
  }

  // ================================================================= PARK TREES
  const trunkCol = 0x9a8f82, palmTrunk = 0xa49784;
  for (const t of trees) {
    const lean = rr(-0.9, 0.9), lean2 = rr(-0.9, 0.9), hgt = rr(5, 7.5), y = hash2(t.x, t.z);
    const top = [t.x + lean * 1.5, hgt, t.z + lean2 * 1.5], mid = [t.x + lean * 0.2, hgt * 0.5, t.z + lean2 * 0.2];
    leaf.tube([t.x, 0, t.z], mid, 0.42, 0.3, 5, trunkCol);
    leaf.tube(mid, top, 0.3, 0.2, 5, trunkCol);
    const br = [top[0] + rr(-1.5, 1.5), hgt * 0.8, top[2] + rr(-1.5, 1.5)];
    leaf.tube([mid[0], mid[1] * 1.3, mid[2]], br, 0.18, 0.1, 4, trunkCol);
    const flower = y < 0.12 ? 0xe8c828 : y < 0.2 ? 0xc8403a : 0;
    const base = pick([0x3f5a35, 0x46623a, 0x4d6b3c, 0x3b5632]);
    leaf.ico(top[0], hgt + 0.6, top[2], rr(2.6, 3.3), 1.3, rr(2.6, 3.3), 1, base, icoCache);
    leaf.ico(br[0], br[1] + 0.9, br[2], rr(1.8, 2.4), 1.0, rr(1.8, 2.4), 1, shade(base, 0.9), icoCache);
    if (flower) leaf.ico(top[0] + 0.8, hgt + 1.9, top[2] - 0.6, 1.5, 0.8, 1.5, 0, flower, icoCache);
    addSq(t.x, t.z, 0.8, 1.8);
    info.trees++;
  }
  const palm = (x, z, h, seed, trunk, frondCol) => {
    const lx = Math.cos(seed * 12.9) * 0.9, lz = Math.sin(seed * 7.7) * 0.9;
    const p1 = [x + lx * 0.3, h * 0.38, z + lz * 0.3], p2 = [x + lx * 0.8, h * 0.72, z + lz * 0.8], p3 = [x + lx * 1.5, h, z + lz * 1.5];
    leaf.tube([x, 0, z], p1, 0.26, 0.2, 6, trunk); leaf.tube(p1, p2, 0.2, 0.17, 6, trunk); leaf.tube(p2, p3, 0.17, 0.14, 6, trunk);
    const nf = 9;
    for (let k = 0; k < nf; k++) {
      const a = k / nf * TAU + seed, L = rr(2.7, 3.5), dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx;
      const base = [p3[0], p3[1] - 0.1, p3[2]], mid = [base[0] + dx * L * 0.55, base[1] + 0.55, base[2] + dz * L * 0.55], tip = [base[0] + dx * L, base[1] - 0.7, base[2] + dz * L];
      const m1 = [mid[0] + px * 0.32, mid[1], mid[2] + pz * 0.32], m2 = [mid[0] - px * 0.32, mid[1], mid[2] - pz * 0.32];
      const col = shade(frondCol, rr(0.88, 1.1));
      leaf.tri(base, m1, m2, col); leaf.tri(m1, tip, m2, col);
    }
  };
  for (const t of palmsP) { palm(t.x, t.z, rr(8, 13), rand() * 6, palmTrunk, 0x5c7f3a); addSq(t.x, t.z, 0.6, 1.8); info.palms++; }

  // ---- slim palms along the shop-side sidewalk, about every 9 m, and dark green globe lamps every 15 m
  const lampAt = (x, z, h = 4.5) => {
    solid.cyl(x, 0, z, 0.32, 0.22, 0.7, 8, GREEN);
    solid.cyl(x, 0.7, z, 0.1, 0.08, h - 0.7, 6, GREEN);
    solid.cyl(x, h - 0.1, z, 0.2, 0.08, 0.25, 8, GREEN);
    solid.ico(x, h + 0.25, z, 0.24, 0.3, 0.24, 1, 0xfff1c9, icoCache);
    solid.cyl(x, h + 0.5, z, 0.2, 0.0, 0.25, 8, GREEN);
    addSq(x, z, 0.5, 2.5);
  };
  const sideStep = (arcM, offsetFn, fn, minClear) => {
    for (let th = -Math.PI; th < Math.PI;) {
      const r = R.rout(th) + offsetFn(th);
      const [x, z] = P(th, r);
      if (R.clearance(x, z) > minClear) fn(x, z, th);
      th += arcM / r;
    }
  };
  let pi = 0;
  sideStep(9.2, () => 3.9, (x, z) => { palm(x, z, rr(11, 15), rand() * 6, 0x9b8d7a, 0x5c7f3a); addSq(x, z, 0.6, 1.8); pi++; info.palms++; }, 3.0);
  sideStep(15, () => 3.2, (x, z, th) => {
    // alternate with the palms: nudge along the ring half a step so a lamp is never inside a trunk
    const th2 = th + 4.6 / (R.rout(th) + 3.2), [lx, lz] = P(th2, R.rout(th2) + 3.2);
    if (R.clearance(lx, lz) > 3.0) lampAt(lx, lz);
  }, 3.0);
  // a few lamps on the park side
  for (const d of [20, 60, 100, 140, 180, 220, 260, 300, 340]) { const th = d * DEG; const [x, z] = P(th, R.rin(th) - 1.3); if (!nearMouth(x, z, 10)) lampAt(x, z, 4.2); }


  // ================================================================= BACK BAND: town between the shop backs and the OSM edge
  // Rows of low back buildings, a few service lots with parked cars and some trees, all kept off every road (same
  // clearance test as the shops), off water, off the shops and the OSM buildings (W.buildingAt sees every collider).
  const BACKR = EXCL - 3;
  const CARC = [0xf2f2f0, 0xc8cacc, 0x1c1c1e, 0x7a1f26, 0x2c4a7a, 0xe8e8e6, 0xc8cacc, 0x1c1c1e, 0xd01f26, 0x3b4b3d];
  const makeCar = (cx, cz, head, col) => {
    cars.box(cx, 0.28, cz, 4.4, 0.72, 1.8, head, col);
    cars.box(cx + Math.cos(head) * -0.1, 1.0, cz + Math.sin(head) * 0.1, 2.3, 0.55, 1.62, head, 0x26323b, shade(col, 1.0));
    const cc = Math.cos(head), ss = Math.sin(head);
    for (const [lx, lz] of [[1.4, 0.82], [1.4, -0.82], [-1.4, 0.82], [-1.4, -0.82]]) cars.box(cx + lx * cc + lz * ss, 0, cz - lx * ss + lz * cc, 0.7, 0.6, 0.22, head, 0x111111);
    addBox(cx, cz, 4.4, 1.8, head, 1.5);
    info.cars++;
  };
  const lots = [];
  const inLot = (x, z, m) => lots.some((l) => { const dx = x - l.x, dz = z - l.z, c = Math.cos(l.ang), sn = Math.sin(l.ang); return Math.abs(dx * c - dz * sn) < l.w / 2 + m && Math.abs(dx * sn + dz * c) < l.d / 2 + m; });
  const spotFree = (x, z) => W.isLand(x, z) && !W.buildingAt(x, z) && R.clearance(x, z) > 4.0 && Math.hypot(x - CX, z - CZ) <= BACKR && !inLot(x, z, 1.5);
  const rectFree = (x, z, w, d, ang, m) => {   // every 2.5 m over the footprint grown by m, same turn as MB.box
    const c = Math.cos(ang), sn = Math.sin(ang), ex = w / 2 + m, ez = d / 2 + m;
    const nx = Math.max(2, Math.ceil(ex * 2 / 2.5)), nz = Math.max(2, Math.ceil(ez * 2 / 2.5));
    for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) {
      const lx = -ex + 2 * ex * i / nx, lz = -ez + 2 * ez * j / nz;
      if (!spotFree(x + lx * c + lz * sn, z - lx * sn + lz * c)) return false;
    }
    return true;
  };
  // service lots: grey asphalt pad with two rows of parked cars
  for (let tries = 0; tries < 800 && lots.length < 4; tries++) {
    const th = rr(-Math.PI, Math.PI), r = rr(rf(th) + 8, 106), w = 20, d = 12, [x, z] = P(th, r), ang = -th;
    if (lots.some((l) => Math.hypot(l.x - x, l.z - z) < 40) || !rectFree(x, z, w, d, ang, 2)) continue;
    lots.push({ x, z, ang, w, d });
    const c = Math.cos(ang), sn = Math.sin(ang), L = (lx, lz, y) => [x + lx * c + lz * sn, y, z - lx * sn + lz * c];
    ground.quad(L(-w / 2, -d / 2, 0.1), L(w / 2, -d / 2, 0.1), L(w / 2, d / 2, 0.1), L(-w / 2, d / 2, 0.1), 0x6f6f73, true);
    let ci = 0;
    for (const lz of [-d / 4 - 0.3, d / 4 + 0.3]) for (let k = 0; k < 5; k++) {
      if (rand() < 0.4) continue;
      const lx = -w / 2 + 2.5 + k * 4.2 + 2.1, p = L(lx, lz, 0);
      makeCar(p[0], p[2], ang - Math.PI / 2, CARC[(ci++ + lots.length * 3) % CARC.length]);
    }
    info.lots++;
  }
  // back buildings: rows following the circle, plain stucco boxes with windows, some with a tan hip roof
  const backBuilding = (x, z, w, d, ang, h, wall, hip) => {
    const c = Math.cos(ang), sn = Math.sin(ang), C4 = (lx, lz, y) => [x + lx * c + lz * sn, y, z - lx * sn + lz * c];
    shops.box(x, 0, z, w, h, d, ang, wall, 0x9d9a94);
    if (hip) { const ap = [x, h + 1.7, z];
      const cs = [C4(-w / 2, -d / 2, h), C4(w / 2, -d / 2, h), C4(w / 2, d / 2, h), C4(-w / 2, d / 2, h)];
      for (let i = 0; i < 4; i++) shops.tri(cs[i], cs[(i + 1) % 4], ap, shade(TAN, 0.9 + 0.05 * i)); }
    const fl = h > 7 ? 2 : 1;
    let first = true;
    for (const s of [1, -1]) {
      const a = C4(-w / 2, s * d / 2, 0), b = C4(w / 2, s * d / 2, 0);
      wallWindows(shops, [a[0], a[2]], [b[0], b[2]], s * sn, s * c, fl, first); first = false;
    }
    addBox(x, z, w, d, ang, hip ? h + 0.8 : h, true);
    info.backBuildings++;
  };
  const rows = [70, 83.5, 97, 110.5];
  for (const r0 of rows) {
    for (let th = -Math.PI; th < Math.PI;) {
      const w = rr(9, 17), d = rr(8, 11), h = rand() < 0.22 ? 8.4 : rand() < 0.5 ? 5.2 : 4.0;
      const tc = th + (w / 2) / r0, [x, z] = P(tc, r0 + d / 2 + 1), ang = -tc;
      if (rand() > 0.82 || !rectFree(x, z, w, d, ang, 1.5)) { th += (rand() > 0.82 ? w : 3) / r0; continue; }
      const wc = pick(WALLS);
      backBuilding(x, z, w, d, ang, h, shade(wc, 1.02), rand() < 0.3);
      th += (w + rr(2.5, 5)) / r0;
    }
  }
  // infill: smaller buildings dropped wherever a gap is left (right up behind the shops, out to the edge), until the band reads as town
  for (let tries = 0; tries < 9000 && info.backBuildings < 110; tries++) {
    const th = rr(-Math.PI, Math.PI), r = rr(rf(th) + 14, BACKR - 4), w = rr(6, 13), d = rr(6, 10), [x, z] = P(th, r), ang = -th;
    if (!rectFree(x, z, w, d, ang, 1.2)) continue;
    backBuilding(x, z, w, d, ang, rand() < 0.15 ? 8.4 : rand() < 0.5 ? 5.2 : 4.0, shade(pick(WALLS), 1.02), rand() < 0.3);
  }
  // trees and palms in the yards
  const shadeTree = (x, z, hgt) => {
    const top = [x + rr(-0.6, 0.6), hgt, z + rr(-0.6, 0.6)], base = pick([0x3f5a35, 0x46623a, 0x4d6b3c, 0x3b5632]);
    leaf.tube([x, 0, z], top, 0.4, 0.22, 5, trunkCol);
    leaf.ico(top[0], hgt + 0.8, top[2], rr(2.8, 3.4), 1.7, rr(2.8, 3.4), 1, base, icoCache);
    leaf.ico(top[0] + rr(-1.2, 1.2), hgt + 0.2, top[2] + rr(-1.2, 1.2), 2.0, 1.2, 2.0, 0, shade(base, 0.9), icoCache);
    addSq(x, z, 0.8, 1.8); info.trees++;
  };
  const yard = [];
  for (let tries = 0, nS = 0, nP = 0; tries < 4000 && nS + nP < 46; tries++) {
    const th = rr(-Math.PI, Math.PI), r = rr(rf(th) + 6, BACKR - 1), [x, z] = P(th, r);
    if (!rectFree(x, z, 1.6, 1.6, 0, 1.0) || yard.some((q) => Math.hypot(q[0] - x, q[1] - z) < 6)) continue;
    yard.push([x, z]);
    if ((nS + nP) % 3 === 2) { palm(x, z, rr(8, 12), rand() * 6, palmTrunk, 0x5c7f3a); addSq(x, z, 0.6, 1.8); info.palms++; nP++; } else { shadeTree(x, z, rr(4.5, 6.5)); nS++; }
  }

  // ================================================================= STATUES, PLAZA, ALCOVE, MARKERS, PLAQUES
  const MARBLE = 0xece9df, MARBLE_D = 0xd6d2c6, CREAM = 0xd6ccb6, BRONZE = 0x4a3f36, BRONZE_G = 0x5b5f55;
  const statue = (x, z, faceAng, kind) => {
    // square plinth + a low-poly figure (robe, torso, head, one raised or bent arm) facing faceAng (a bearing-style angle)
    const body = kind === 'cream' ? CREAM : MARBLE;
    solid.box(x, 0, z, 1.0, 0.18, 1.0, 0, MARBLE_D);
    solid.box(x, 0.18, z, 0.7, 1.0, 0.7, 0, 0xe8e6e0);
    solid.box(x + Math.sin(faceAng) * 0.36, 0.7, z - Math.cos(faceAng) * 0.36, 0.3, 0.2, 0.03, -faceAng, 0xa07a3a);   // bronze plate
    const y0 = 1.18, fx = Math.sin(faceAng), fz = -Math.cos(faceAng), sx = fz, sz = -fx;
    solid.cyl(x, y0, z, 0.33, 0.2, 0.95, 8, body);                                   // robe
    solid.cyl(x, y0 + 0.9, z, 0.22, 0.17, 0.5, 8, body);                             // torso
    solid.ico(x, y0 + 1.58, z, 0.13, 0.16, 0.13, 0, body, icoCache);                 // head
    if (kind === 'raised') solid.tube([x + sx * 0.2, y0 + 1.3, z + sz * 0.2], [x + sx * 0.32 + fx * 0.15, y0 + 1.85, z + sz * 0.32 + fz * 0.15], 0.06, 0.05, 5, body);
    else solid.tube([x + sx * 0.2, y0 + 1.3, z + sz * 0.2], [x + fx * 0.3 + sx * 0.12, y0 + 1.0, z + fz * 0.3 + sz * 0.12], 0.06, 0.05, 5, body);
    solid.tube([x - sx * 0.2, y0 + 1.3, z - sz * 0.2], [x - sx * 0.22, y0 + 0.85, z - sz * 0.22], 0.06, 0.05, 5, body);
    addSq(x, z, 1.0, 3);
    info.statues++;
  };
  // 12 white statues around the park edge (some at spoke entrances), each with a clipped hedge behind it
  const hedgeArc = (th, r, span, hh, col) => {   // a clipped hedge as a few boxes along the ring
    const n = Math.max(2, Math.round(span * r / 1.6));
    for (let i = 0; i < n; i++) { const t = th + (i / (n - 1) - 0.5) * span, [x, z] = P(t, r); leaf.box(x, 0, z, 1.5, hh, 1.0, -t, col, shade(col, 1.15)); }
  };
  statueB.forEach((b, i) => {
    const r = edgeR(b), [x, z] = P(b, r);
    statue(x, z, b, ['raised', 'bend', 'cream'][i % 3]);
    hedgeArc(b, r - 1.9, 6.5 / r, 1.0, i % 4 === 0 ? 0x8a2f35 : 0x3b6b3a);
    for (const s of [-1, 1]) { const [qx, qz] = P(b + s * 1.9 / r, r + 0.3); leaf.ico(qx, 0.3, qz, 0.5, 0.3, 0.5, 0, i % 2 ? 0xd95f8a : 0xe8c828, icoCache); }
  });
  // Ringling: bronze statue on a red-brown sloped plinth, on a small brick plaza, hedge behind (park side)
  {
    const b = ringlingB, r = R.rin(b) - 2.5, [x, z] = P(b, r), tx = Math.cos(b), tz = Math.sin(b);
    for (let i = -4; i < 4; i++) for (let j = -4; j < 4; j++) {   // 4 m brick plaza, 0.5 m pavers in two tones
      const o = (a, c) => [x + tx * a + Math.sin(b) * c, Y_WALK + 0.006, z + tz * a - Math.cos(b) * c];
      const k = hash2(i * 3.1, j * 7.7) < 0.5 ? 0xb05a4a : 0xc4705a;
      ground.quad(o(i * 0.5, j * 0.5), o(i * 0.5 + 0.5, j * 0.5), o(i * 0.5 + 0.5, j * 0.5 + 0.5), o(i * 0.5, j * 0.5 + 0.5), k, true);
    }
    solid.tube([x, Y_WALK, z], [x, Y_WALK + 0.9, z], 0.95, 0.66, 4, 0xb0705e, Math.PI / 4);
    solid.box(x, Y_WALK + 0.9, z, 1.1, 0.08, 1.1, 0, 0x8f6b64);
    const y0 = Y_WALK + 0.98, f = [Math.sin(b), -Math.cos(b)];      // faces the road (outward)
    solid.box(x + f[0] * 0.5, Y_WALK + 0.45, z + f[1] * 0.5, 0.6, 0.35, 0.03, -b, 0xa07a3a);
    solid.box(x - 0.15 * Math.cos(b), y0, z - 0.15 * Math.sin(b), 0.24, 0.9, 0.2, -b, BRONZE);          // legs
    solid.box(x + 0.15 * Math.cos(b), y0, z + 0.15 * Math.sin(b), 0.24, 0.9, 0.2, -b, BRONZE);
    solid.box(x, y0 + 0.85, z, 0.62, 0.78, 0.34, -b, 0x3f362f);                                  // double-breasted suit
    solid.ico(x, y0 + 1.82, z, 0.14, 0.17, 0.14, 0, 0x5b4a3c, icoCache);
    solid.tube([x + Math.cos(b) * 0.36, y0 + 1.5, z + Math.sin(b) * 0.36], [x + Math.cos(b) * 0.5 + f[0] * 0.15, y0 + 0.75, z + Math.sin(b) * 0.5 + f[1] * 0.15], 0.07, 0.06, 5, BRONZE);   // arm and cane
    solid.tube([x + Math.cos(b) * 0.55 + f[0] * 0.15, y0 + 0.0, z + Math.sin(b) * 0.55 + f[1] * 0.15], [x + Math.cos(b) * 0.5 + f[0] * 0.15, y0 + 0.78, z + Math.sin(b) * 0.5 + f[1] * 0.15], 0.025, 0.025, 4, 0x2a2420);
    solid.tube([x - Math.cos(b) * 0.36, y0 + 1.5, z - Math.sin(b) * 0.36], [x - Math.cos(b) * 0.4 + f[0] * 0.2, y0 + 1.1, z - Math.sin(b) * 0.4 + f[1] * 0.2], 0.07, 0.06, 5, BRONZE);
    const [hx0, hz0] = P(b, r - 2.7);
    for (let i = -3; i <= 3; i++) leaf.box(hx0 + tx * i * 1.2, 0, hz0 + tz * i * 1.2, 1.3, 1.2, 1.0, -b, 0x3b6b3a, 0x4a7d44);
    addSq(x, z, 1.8, 3);
    // two black historical markers on posts at the plaza edge, one more beside a bench
    const marker = (mx, mz, face, col = 0x1c1c1e) => {
      if (nearMouth(mx, mz, 10)) return;
      solid.cyl(mx, 0, mz, 0.06, 0.06, 1.0, 5, 0x8a8c8e);
      solid.box(mx, 0.9, mz, 1.2, 1.0, 0.1, -face, col);
      for (let k = 0; k < 4; k++) solid.box(mx + Math.sin(face) * 0.06, 1.0 + k * 0.17, mz - Math.cos(face) * 0.06, 0.8, 0.05, 0.03, -face, 0xe8e6e0);
      solid.box(mx + Math.sin(face) * 0.06, 1.8, mz - Math.cos(face) * 0.06, 0.28, 0.14, 0.03, -face, 0xd0a040);
      addSq(mx, mz, 0.5, 2);
    };
    marker(...P(b + 3.2 / r, r + 0.5), b, 0x1c1c1e);
    marker(...P(b - 3.2 / r, r + 0.5), b, 0x1f3a2c);
    const bb = 40 * DEG; marker(...P(bb, R.rin(bb) - 2.0), bb);
    const b3 = 232 * DEG; marker(...P(b3, R.rin(b3) - 2.0), b3, 0x1f3a2c);
    const b4 = 336 * DEG; marker(...P(b4, R.rin(b4) - 2.0), b4);
  }
  // Three Graces alcove: curved white scroll walls, hedge behind, lettering, facing the road toward Lido
  const gr = { mesh: null };
  {
    const b = gracesB, r = R.rin(b) - 4.6, [x, z] = P(b, r);
    const ux = Math.sin(b), uz = -Math.cos(b), vx = uz, vz = -ux;       // u out toward the road, v the viewer's right
    const WR = 3.3, WH = 1.25, steps = 14;
    const arc = (phi, rad) => [x + (-ux * Math.cos(phi) + vx * Math.sin(phi)) * rad, z + (-uz * Math.cos(phi) + vz * Math.sin(phi)) * rad];
    for (let i = 0; i < steps; i++) {
      const p0 = (-75 + 150 * i / steps) * DEG, p1 = (-75 + 150 * (i + 1) / steps) * DEG;
      const a0 = arc(p0, WR - 0.17), a1 = arc(p1, WR - 0.17), o0 = arc(p0, WR + 0.17), o1 = arc(p1, WR + 0.17);
      const v = (p, y) => [p[0], y, p[1]];
      solid.quad(v(a0, 0.1), v(a1, 0.1), v(a1, WH), v(a0, WH), 0xe6e3da);
      solid.quad(v(o0, 0.1), v(o1, 0.1), v(o1, WH), v(o0, WH), 0xdcd8cd);
      solid.quad(v(a0, WH), v(a1, WH), v(o1, WH), v(o0, WH), 0xf0ede4);
      const h0 = arc(p0, WR + 0.9), h1 = arc(p1, WR + 0.9);          // hedge behind
      leaf.quad(v(o0, 0), v(o1, 0), v(h1, 0), v(h0, 0), 0x3b6b3a);
      leaf.quad(v(h0, 0.05), v(h1, 0.05), v(h1, 1.2), v(h0, 1.2), 0x3b6b3a);
      leaf.quad(v(o0, 1.1), v(o1, 1.1), v(h1, 1.2), v(h0, 1.2), 0x4a7d44);
    }
    for (const s of [-1, 1]) { const e = arc(s * 75 * DEG, WR); solid.cyl(e[0], 0.1, e[1], 0.42, 0.42, WH + 0.1, 8, 0xece9df); solid.cyl(e[0], WH + 0.2, e[1], 0.5, 0.5, 0.12, 8, 0xf0ede4); }
    // curved paving slab in front
    for (let i = 0; i < 12; i++) {
      const p0 = (-80 + 160 * i / 12) * DEG, p1 = (-80 + 160 * (i + 1) / 12) * DEG;
      const A = [x + (ux * Math.cos(p0) + vx * Math.sin(p0)) * 0.6, z + (uz * Math.cos(p0) + vz * Math.sin(p0)) * 0.6], B = [x + (ux * Math.cos(p1) + vx * Math.sin(p1)) * 0.6, z + (uz * Math.cos(p1) + vz * Math.sin(p1)) * 0.6];
      const Cc = [x + (ux * Math.cos(p1) + vx * Math.sin(p1)) * 3.2, z + (uz * Math.cos(p1) + vz * Math.sin(p1)) * 3.2], Dd = [x + (ux * Math.cos(p0) + vx * Math.sin(p0)) * 3.2, z + (uz * Math.cos(p0) + vz * Math.sin(p0)) * 3.2];
      ground.quad([A[0], Y_PATH + 0.01, A[1]], [B[0], Y_PATH + 0.01, B[1]], [Cc[0], Y_PATH + 0.01, Cc[1]], [Dd[0], Y_PATH + 0.01, Dd[1]], 0xd8d5ca, true);
    }
    // the group: one long white plinth with three standing draped figures side by side, arms linked across each other's shoulders
    // (u out toward the road, v the viewer's right). Each figure: robe, hips, torso, shoulders, head with a bun, two arms.
    solid.box(x, 0, z, 2.9, 0.22, 1.5, -b, 0xe2dfd4);
    solid.box(x, 0.22, z, 2.5, 1.0, 1.1, -b, 0xf0ede4);
    solid.box(x + ux * 0.56, 0.62, z + uz * 0.56, 0.5, 0.3, 0.03, -b, 0xa07a3a);
    const base = 1.22, off = 0.62;
    const at3 = (k, du, y) => [x + vx * (k - 1) * off + ux * du, y, z + vz * (k - 1) * off + uz * du];
    for (let k = 0; k < 3; k++) {
      const turn = k === 1 ? -0.14 : 0.0;   // the middle figure leans a little the other way, as in the group
      const fu = (du, y) => at3(k, du, y);
      solid.tube(fu(0, base), fu(0, base + 0.95), 0.29, 0.2, 8, MARBLE);                 // robe, flaring at the hem
      solid.tube(fu(0, base + 0.9), fu(0, base + 1.25), 0.2, 0.2, 8, MARBLE);            // hips
      solid.tube(fu(0, base + 1.2), fu(turn, base + 1.62), 0.19, 0.15, 8, MARBLE);       // torso
      solid.tube(fu(turn, base + 1.58), fu(turn, base + 1.7), 0.16, 0.1, 8, MARBLE);     // shoulders and neck
      const hp = fu(turn, base + 1.9); solid.ico(hp[0], hp[1], hp[2], 0.12, 0.15, 0.12, 0, MARBLE, icoCache);   // head
      const hd = fu(turn - 0.05, base + 2.05); solid.ico(hd[0], hd[1], hd[2], 0.07, 0.06, 0.07, 0, MARBLE, icoCache);   // hair knot
      // arms: the outer ones hang, the inner ones reach across to the next figure's far shoulder
      const sh = (sgn) => [x + vx * ((k - 1) * off + sgn * 0.17) + ux * turn, base + 1.55, z + vz * ((k - 1) * off + sgn * 0.17) + uz * turn];
      if (k < 2) solid.tube(sh(1), [x + vx * ((k - 1) * off + off + 0.12) + ux * -0.12, base + 1.52, z + vz * ((k - 1) * off + off + 0.12) + uz * -0.12], 0.05, 0.045, 5, MARBLE);
      if (k > 0) solid.tube(sh(-1), [x + vx * ((k - 1) * off - off - 0.12) + ux * -0.12, base + 1.52, z + vz * ((k - 1) * off - off - 0.12) + uz * -0.12], 0.05, 0.045, 5, MARBLE);
      if (k === 0) solid.tube(sh(-1), [sh(-1)[0] - vx * 0.08 + ux * 0.1, base + 0.95, sh(-1)[2] - vz * 0.08 + uz * 0.1], 0.05, 0.045, 5, MARBLE);
      if (k === 2) solid.tube(sh(1), [sh(1)[0] + vx * 0.08 + ux * 0.1, base + 0.95, sh(1)[2] + vz * 0.08 + uz * 0.1], 0.05, 0.045, 5, MARBLE);
    }
    addBox(x, z, 2.9, 1.5, -b, 3);
    // lettering strip on the left wall (inner face), from a canvas texture
    const gpos = [], guv = [], gidx = [];
    const ls = 10, p0 = -66 * DEG, p1 = -14 * DEG;
    for (let i = 0; i <= ls; i++) {
      const p = p0 + (p1 - p0) * i / ls, a = arc(p, WR - 0.2);
      gpos.push(a[0], 0.4, a[1], a[0], 0.9, a[1]); guv.push(i / ls, 0, i / ls, 1);
      if (i) { const k = i * 2; gidx.push(k - 2, k, k + 1, k - 2, k + 1, k - 1); }
    }
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(gpos, 3)); gg.setAttribute('uv', new THREE.Float32BufferAttribute(guv, 2)); gg.setIndex(gidx); gg.computeVertexNormals();
    gr.geo = gg;
  }
  // Circus Ring of Fame plaques: concrete slab, bronze wheel medallion, text plate, along the park-side walk
  for (let k = 0; k < 14; k++) {
    const th = (-170 + k * 23.5 + rr(-3, 3)) * DEG;
    if (Math.abs(th - ringlingB) < 10 * DEG) continue;
    const [x, z] = P(th, R.rin(th) - 1.4), tc = Math.cos(th), ts = Math.sin(th);
    if (R.clearance(x, z) < 1) continue;
    solid.box(x, Y_WALK, z, 0.95, 0.05, 1.2, -th, 0xc4bfb0);
    solid.cyl(x - ts * 0.0 + tc * 0, Y_WALK + 0.05, z, 0.25, 0.25, 0.02, 8, 0x6b5d3f);
    solid.box(x, Y_WALK + 0.05, z - 0.0, 0.7, 0.02, 0.3, -th, 0x7a6a45);
  }

  // ================================================================= BENCHES, HEDGES in the park
  const bench = (x, z, face, kind) => {
    // face: bearing-style angle the sitter looks along; the seat runs across it
    const fx = Math.sin(face), fz = -Math.cos(face), ax = Math.cos(face), az = Math.sin(face);
    if (kind === 'stone') { for (const s of [-0.55, 0.55]) solid.box(x + ax * s, 0, z + az * s, 0.3, 0.38, 0.5, -face, 0xb9b4a6); solid.box(x, 0.38, z, 1.5, 0.1, 0.5, -face, 0xb9b4a6); return; }
    solid.box(x, 0.42, z, 1.8, 0.07, 0.5, -face, 0x2f4a3a);
    solid.box(x - fx * 0.24, 0.5, z - fz * 0.24, 1.8, 0.5, 0.06, -face, 0x2f4a3a);
    for (const s of [-0.75, 0.75]) solid.box(x + ax * s, 0, z + az * s, 0.07, 0.42, 0.46, -face, 0x232b27);
  };
  for (const b of [-2, 58, 181, 284]) {
    for (const r of [20, 34]) for (const side of [-1, 1]) {
      const dx = Math.sin(b * DEG), dz = -Math.cos(b * DEG), px = -dz, pz = dx;
      bench(CX + dx * r + px * 2.1 * side, CZ + dz * r + pz * 2.1 * side, Math.atan2(-side * px, side * pz), r === 20 ? 'green' : 'stone');
    }
  }
  // flagpole: tall plain silver-white pole, no flag, a little off the centre
  { const [x, z] = P(30 * DEG, 14); solid.cyl(x, 0, z, 0.1, 0.06, 9, 6, 0xd8dadc); }

  // ================================================================= CROSSWALKS (canvas brick, white bars) at each spoke
  const cwPos = [], cwUv = [], cwIdx = [];
  const spokeSeen = [];
  for (const { rd, hw } of R.spokes) {
    const p = rd.p, n = p.length / 3;
    if (hw < 1.9) continue;
    const f = (i) => { const th = Math.atan2(p[i * 3] - CX, -(p[i * 3 + 1] - CZ)); return Math.hypot(p[i * 3] - CX, p[i * 3 + 1] - CZ) - (R.rout(th) + 2.9); };
    for (let i = 0; i < n - 1; i++) {
      if (Math.hypot(p[i * 3] - CX, p[i * 3 + 1] - CZ) > 120) continue;
      const f0 = f(i), f1 = f(i + 1);
      if (f0 * f1 > 0 && !(f0 === 0)) continue;
      const u = f0 / (f0 - f1 || 1);
      const x = p[i * 3] + (p[i * 3 + 3] - p[i * 3]) * u, z = p[i * 3 + 1] + (p[i * 3 + 4] - p[i * 3 + 1]) * u;
      const dl = Math.hypot(p[i * 3 + 3] - p[i * 3], p[i * 3 + 4] - p[i * 3 + 1]) || 1, dx = (p[i * 3 + 3] - p[i * 3]) / dl, dz = (p[i * 3 + 4] - p[i * 3 + 1]) / dl;
      if (spokeSeen.some((q) => Math.hypot(q[0] - x, q[1] - z) < 0.5)) continue;
      spokeSeen.push([x, z]);
      const lat = hw + 0.3, len = 1.6, y = 0.17 + spokeSeen.length * 0.004, ex = -dz, ez = dx;
      const v = (a, c) => [x + dx * a + ex * c, y, z + dz * a + ez * c];
      const base = cwPos.length / 3, q4 = [v(-len, -lat), v(len, -lat), v(len, lat), v(-len, lat)];
      for (const q of q4) cwPos.push(q[0], q[1], q[2]);
      cwUv.push(-len / 2, -lat / 2, len / 2, -lat / 2, len / 2, lat / 2, -len / 2, lat / 2);
      const cn = cross(sub(q4[1], q4[0]), sub(q4[2], q4[0]));   // wind upward so the lit side faces the sky
      if (cn[1] >= 0) cwIdx.push(base, base + 1, base + 2, base, base + 2, base + 3); else cwIdx.push(base, base + 2, base + 1, base, base + 3, base + 2);
      for (const s of [-1, 1]) {   // 0.3 m white bars along both long edges
        const a0 = s * (len - 0.3), a1 = s * len, vb = (a, c) => [x + dx * a + ex * c, y + 0.03, z + dz * a + ez * c];
        ground.quad(vb(a0, -lat), vb(a1, -lat), vb(a1, lat), vb(a0, lat), 0xf4f4f2, true);
      }
      info.crosswalks++;
    }
  }

  // ================================================================= PARKED CARS along the outer edge (inside the bay, road untouched)
  for (let th = -Math.PI, k = 0; th < Math.PI; k++) {
    const r = R.rout(th) + 1.65, [x, z] = P(th, r);
    const ok = [-3.2, 0, 3.2].every((d) => { const [qx, qz] = P(th + d / r, r); return R.clearance(qx, qz) > 3.6; });
    const step = 5.5 / r;
    if (ok && rand() > 0.12) {
      const [x2, z2] = P(th + 2.75 / r, r), head = -th;   // car long axis along the ring tangent
      makeCar(x2, z2, head, CARC[k % CARC.length]);
    }
    th += step;
    void x; void z;
  }

  // ================================================================= MESHES
  const mkMat = (extra = {}) => new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, ...extra });
  const group = new THREE.Group(); group.name = 'armands';
  const mShops = shops.mesh(mkMat(), true, true), mSolid = solid.mesh(mkMat(), false, false), mLeaf = leaf.mesh(mkMat(), false, false);
  const gm = mkMat({ polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const mGround = ground.mesh(gm, false, true), mCars = cars.mesh(mkMat(), false, false);
  group.add(mShops, mSolid, mLeaf, mGround, mCars);
  // crosswalk brick plane(s)
  {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(cwPos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(cwUv.map((u) => u * 0.5), 2));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(cwPos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3)); g.setIndex(cwIdx); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: brickCanvas(), side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    group.add(m);
  }
  if (lawn.geo) group.add(new THREE.Mesh(lawn.geo, new THREE.MeshLambertMaterial({ map: lawn.tex, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })));
  if (gr.geo) group.add(new THREE.Mesh(gr.geo, new THREE.MeshLambertMaterial({ map: gracesCanvas(), side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })));
  scene.add(group);

  const tris = [shops, solid, leaf, ground, cars].reduce((s, m) => s + m.tris, 0) + cwIdx.length / 3 + (gr.geo ? gr.geo.index.count / 3 : 0);
  const onRing = (x, z) => { const th = Math.atan2(x - CX, -(z - CZ)), d = Math.hypot(x - CX, z - CZ); return d > R.rin(th) - 1.0 && d < R.rout(th) + 3.0; };
  G.armands = { group, gracesB, ringlingB, mouths: R.mouths, onRing, centre: AP, ...info, tris, calls: group.children.length, rin: R.rin, rout: R.rout, clearance: R.clearance, runs };
  return G.armands;
}
