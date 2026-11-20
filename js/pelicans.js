// Brown pelicans (2026-11-20): perched on dock pilings (canal docks and Dad's dock), gliding lines
// along the beach and bay, plunge-dives with a splash, and flushing when a car or boat gets within
// about 15 m. Four InstancedMeshes (body, head, left wing, right wing) = four draw calls for the
// whole flock, Lambert vertex colors (Safari needs Lambert). Only ~30 birds exist, near the player.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const N = 30, PERCH_MAX = 10, FLOCK_SIZES = [6, 5, 5, 4];
const RANGE = 400, FLEE = 15, WATER_Y = -0.35, FLAP_W = 8;
const TAU = Math.PI * 2;
const angDiff = (a, b) => ((a - b + Math.PI) % TAU + TAU) % TAU - Math.PI;
const rnd = (a, b) => a + Math.random() * (b - a);

// ------------------------------------------------------------- geometry (forward +X, feet at y 0)
const NECK = new THREE.Vector3(0.43, 0.74, 0), SHOULDER = new THREE.Vector3(0.08, 0.46, 0.12);
function part(g, color, m) {
  g = g.index ? g.toNonIndexed() : g;
  if (m) g.applyMatrix4(m);
  g.deleteAttribute('uv');
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    c.set(typeof color === 'function' ? color(pos.getX(i), pos.getY(i), pos.getZ(i)) : color);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
const S = (x, y, z) => new THREE.Matrix4().makeScale(x, y, z);
const sphere = (sx, sy, sz, x, y, z, color, seg = 7) => part(new THREE.SphereGeometry(1, seg, Math.max(4, seg - 2)), color, T(x, y, z).multiply(S(sx, sy, sz)));
function flip(g) { // swap winding of a non-indexed geometry (used after mirroring)
  for (const k of Object.keys(g.attributes)) {
    const a = g.attributes[k], s = a.itemSize, arr = a.array;
    for (let t = 0; t < a.count; t += 3) for (let j = 0; j < s; j++) { const i1 = (t + 1) * s + j, i2 = (t + 2) * s + j; const v = arr[i1]; arr[i1] = arr[i2]; arr[i2] = v; }
  }
  return g;
}
function bodyGeo() {
  const rz = (a) => new THREE.Matrix4().makeRotationZ(a);
  const parts = [
    sphere(0.5, 0.2, 0.19, 0, 0.38, 0, (x, y) => (y < 0.33 ? 0x9a8f80 : 0x6d6254), 8),
    part(new THREE.BoxGeometry(0.3, 0.03, 0.16), 0x4a4239, T(-0.54, 0.38, 0)),
    part(new THREE.CylinderGeometry(0.05, 0.075, 0.3, 6), 0x4a3a2d, T(0.4, 0.6, 0).multiply(rz(-0.35))),
  ];
  for (const s of [-1, 1]) {
    parts.push(part(new THREE.CylinderGeometry(0.025, 0.025, 0.22, 5), 0x2b2b2b, T(0.02, 0.11, s * 0.09)));
    parts.push(part(new THREE.BoxGeometry(0.13, 0.02, 0.07), 0x2b2b2b, T(0.06, 0.01, s * 0.09)));
  }
  return mergeGeometries(parts);
}
function headGeo() { // pivot at the top of the neck
  const bill = new THREE.ConeGeometry(0.04, 0.42, 5);
  const parts = [
    sphere(0.1, 0.085, 0.08, 0.03, 0.03, 0, (x, y) => (y > 0.07 ? 0xe9c95a : 0xf4f0e0), 7),
    part(bill, 0xb7a47f, T(0.3, 0, 0).multiply(new THREE.Matrix4().makeRotationZ(-Math.PI / 2)).multiply(S(1, 1, 1.4))),
    sphere(0.22, 0.05, 0.055, 0.2, -0.055, 0, 0x8f7f66, 6),
    sphere(0.03, 0.03, 0.03, 0.5, -0.01, 0, 0x4a3a2d, 4),
  ];
  for (const s of [-1, 1]) parts.push(sphere(0.016, 0.016, 0.016, 0.07, 0.06, s * 0.065, 0x111111, 4));
  return mergeGeometries(parts);
}
function wingGeo(side) { // right wing extends +z from the shoulder; left is a mirrored copy
  const inner = part(new THREE.BoxGeometry(0.55, 0.04, 0.55), 0x756a5c, T(-0.05, 0, 0.275));
  let outer = new THREE.BoxGeometry(0.42, 0.03, 0.6);
  outer = part(outer, (x, y, z) => (z > 0.95 ? 0x2f2a25 : 0x5f564b), T(-0.22, 0.05, 0.85));
  const g = mergeGeometries([inner, outer]);
  if (side < 0) { g.applyMatrix4(S(1, 1, -1)); flip(g); }
  return g;
}

// ------------------------------------------------------------- the flock
export class Pelicans {
  constructor(scene, world, G) {
    this.world = world; this.G = G; this.enabled = true; this.t = 0; this.scanT = 0; this.cand = [];
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const mk = (g) => { const m = new THREE.InstancedMesh(g, mat, N); m.frustumCulled = false; m.count = 0; m.castShadow = false; m.receiveShadow = false; scene.add(m); return m; };
    this.mBody = mk(bodyGeo()); this.mHead = mk(headGeo()); this.mWL = mk(wingGeo(-1)); this.mWR = mk(wingGeo(1));
    this.buildSites();
    this.birds = [];
    for (let i = 0; i < N; i++) this.birds.push({ id: i, role: i < PERCH_MAX ? 'perch' : 'flock', mode: 'idle', site: -1, x: 0, y: 0, z: 0, h: Math.random() * TAU, pitch: 0, roll: 0, hy: 0, hyT: 0, hp: 0, hT: 1, fold: 1, amp: 0, ph: Math.random() * 6, delay: Math.random() * 0.5, t: 0, tgt: -1, dyJ: Math.random() * 6 });
    this.flocks = [];
    let k = PERCH_MAX;
    for (const n of FLOCK_SIZES) {
      const f = { members: this.birds.slice(k, k + n), live: false, x: 0, y: 2, z: 0, h: 0, want: 0, speed: 10, turnT: 0, probeT: 0, seek: null, flapT: 2, flap: false, ph: 0, amp: 0, skimT: rnd(4, 9), skim: false, diveT: rnd(6, 12), vee: Math.random() < 0.6, dh: 0 };
      k += n; this.flocks.push(f);
      f.members.forEach((b, i) => {
        const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
        b.off = i === 0 ? [0, 0] : [-row * 4.5 + rnd(-1.2, 1.2), side * row * (f.vee ? 4.0 : 1.1) + rnd(-1, 1)];
        b.oy = i === 0 ? 0 : rnd(-0.3, 0.3);
      });
    }
  }
  // perch sites: tops of dock pilings. flat arrays; dad = Dad's dock gets extra weight
  buildSites() {
    const xs = [], zs = [], ys = [], dad = [];
    const W = this.world, G = this.G;
    for (const l of W.canalLots || []) {
      if (G.dad && Math.hypot(l.x - G.dad.sx, l.z - G.dad.sz) < 30) continue;
      const len = 8 + Math.round(l.r * 4) * 1.5, n = Math.max(1, Math.round(len / 3)), step = len / n;
      for (const i of [0, n, Math.max(1, Math.round(l.r * 9) % n)]) {
        const u = -len / 2 + i * step;
        xs.push(l.x + l.nx * 3 + l.tx * u); zs.push(l.z + l.nz * 3 + l.tz * u); ys.push(1.1); dad.push(0);
      }
    }
    const d = G.dad;
    if (d) {
      const len = 26, n = Math.round(len / 3), step = len / n;
      for (let i = 0; i <= n; i++) for (const s of [1.2, -1.2]) {
        if (i % 2 && s < 0) continue;
        const u = -len / 2 + i * step;
        xs.push(d.sx + d.nx * (2 + s) + d.tx * u); zs.push(d.sz + d.nz * (2 + s) + d.tz * u); ys.push(1.1); dad.push(1);
      }
    }
    this.sx = Float32Array.from(xs); this.sz = Float32Array.from(zs); this.sy = Float32Array.from(ys); this.sdad = Uint8Array.from(dad);
    this.owner = new Int16Array(xs.length).fill(-1);
  }
  isWater(x, z) { return !this.world.isLand(x, z) && this.world.inBounds(x, z, 120); }

  // ---- perched birds
  rescan(px, pz) {
    const c = this.cand; c.length = 0;
    for (let i = 0; i < this.sx.length; i++) {
      if (this.owner[i] >= 0) continue;
      const d = Math.hypot(this.sx[i] - px, this.sz[i] - pz);
      if (d > RANGE || d < 30) continue;
      c.push(i); if (this.sdad[i]) c.push(i, i);
    }
  }
  perchAt(b, s, face) {
    b.mode = 'perch'; b.site = s; this.owner[s] = b.id; b.tgt = -1;
    b.x = this.sx[s]; b.y = this.sy[s]; b.z = this.sz[s]; b.h = face ?? rnd(0, TAU); b.pitch = 0; b.roll = 0;
  }
  assignPerch(px, pz) {
    for (const b of this.birds) {
      if (b.role !== 'perch' || b.mode !== 'idle' || !this.cand.length) continue;
      for (let tries = 0; tries < 4; tries++) {
        const s = this.cand[(Math.random() * this.cand.length) | 0];
        if (this.owner[s] >= 0) continue;
        this.perchAt(b, s); break;
      }
    }
  }
  pickTarget(b, px, pz) { // somewhere else to settle, 80 to 300 m from the bird
    const c = this.cand;
    for (let tries = 0; tries < 20 && c.length; tries++) {
      const s = c[(Math.random() * c.length) | 0];
      if (this.owner[s] >= 0) continue;
      const d = Math.hypot(this.sx[s] - b.x, this.sz[s] - b.z);
      if (d < 70 || d > 320 || Math.hypot(this.sx[s] - px, this.sz[s] - pz) < 30) continue;
      this.owner[s] = b.id; return s;
    }
    return -1;
  }
  flush(b, px, pz) {
    const away = Math.atan2(-(b.z - pz), b.x - px);
    if (b.site >= 0) { this.owner[b.site] = -1; b.site = -1; }
    b.mode = 'fly'; b.t = 0; b.h = away + rnd(-0.5, 0.5); b.vy = 3.5; b.speed = 3; b.fl = 0.1 + Math.random() * 0.2;
    b.tgt = this.pickTarget(b, px, pz);
  }
  updatePerch(b, dt, px, pz) {
    const d = Math.hypot(b.x - px, b.z - pz);
    if (d > RANGE + 60) { this.owner[b.site] = -1; b.site = -1; b.mode = 'idle'; return; }
    if (d < FLEE) { this.flush(b, px, pz); return; }
    b.hT -= dt;
    if (b.hT <= 0) { b.hT = rnd(1.5, 5); b.hyT = Math.random() < 0.3 ? 0 : rnd(-1.3, 1.3); b.hpT = Math.random() < 0.15 ? -0.9 : 0; }
    b.hy += (b.hyT - b.hy) * Math.min(1, dt * 5); b.hp += ((b.hpT || 0) - b.hp) * Math.min(1, dt * 6);
    b.fold = 1; b.amp = 0; b.pitch = 0.4 + Math.sin(this.t * 1.7 + b.ph) * 0.02;
  }
  updateFly(b, dt, px, pz) { // flushed or relocating bird
    b.t += dt;
    const tg = b.tgt;
    let wantH = b.h, dist = 1e9;
    if (tg >= 0) { dist = Math.hypot(this.sx[tg] - b.x, this.sz[tg] - b.z); wantH = Math.atan2(-(this.sz[tg] - b.z), this.sx[tg] - b.x); }
    const turn = tg >= 0 && b.t > 1.5 ? 1.8 : 0.3;
    b.h += Math.max(-turn * dt, Math.min(turn * dt, -angDiff(b.h, wantH)));
    let ty, sp = 9;
    if (tg >= 0 && b.t > 1.5) {
      ty = this.sy[tg] + Math.min(dist * 0.13, 9);
      if (dist < 14) sp = 3 + dist * 0.4;
      if (dist < 1.3) { this.perchAt(b, tg, b.h); b.fold = 1; return; }
      if (dist < 3 && Math.abs(b.y - this.sy[tg]) < 1.0) { this.perchAt(b, tg, b.h); return; }
    } else ty = b.y + 4;
    if (tg < 0 && b.t > 6) { b.mode = 'idle'; return; }
    b.speed += (sp - b.speed) * Math.min(1, dt * 1.5);
    const vyT = Math.max(-3.5, Math.min(4.5, (ty - b.y) * 1.2));
    b.vy += (vyT - b.vy) * Math.min(1, dt * 2);
    b.x += Math.cos(b.h) * b.speed * dt; b.z -= Math.sin(b.h) * b.speed * dt; b.y = Math.max(this.sy[tg >= 0 ? tg : 0] * 0 + 0.6, b.y + b.vy * dt);
    b.pitch = Math.atan2(b.vy, Math.max(2, b.speed)) * 0.8;
    b.roll = -Math.max(-0.5, Math.min(0.5, angDiff(wantH, b.h) * 0.4));
    b.fold = 0; b.amp += (0.8 - b.amp) * Math.min(1, dt * 4); b.ph += dt * (FLAP_W + 2);
    b.hy = 0; b.hp = 0;
  }

  // ---- flocks
  spawnFlock(f, px, pz, near) {
    const W = this.world;
    for (let tries = 0; tries < 40; tries++) {
      const a = Math.random() * TAU, r = near ? rnd(90, 250) : rnd(180, 380);
      const x = px + Math.cos(a) * r, z = pz - Math.sin(a) * r;
      if (!this.isWater(x, z)) continue;
      let shore = false;
      for (let k = 0; k < 8 && !shore; k++) shore = W.isLand(x + Math.cos(k * 0.785) * 140, z - Math.sin(k * 0.785) * 140);
      if (!shore && tries < 30) continue;
      let h = Math.random() * TAU;
      for (let k = 0; k < 8 && !this.isWater(x + Math.cos(h) * 70, z - Math.sin(h) * 70); k++) h += 0.785;
      Object.assign(f, { live: true, x, z, h, want: h, y: 2, speed: rnd(9, 11), turnT: 3, seek: null, probeT: 0, flapT: rnd(1, 3), flap: Math.random() < 0.5, skim: false, skimT: rnd(4, 9), diveT: rnd(8, 16) });
      this.placeMembers(f, true);
      return;
    }
    f.live = false; f.members.forEach((b) => { b.mode = 'idle'; });
  }
  slot(f, b, out) {
    const ch = Math.cos(f.h), sh = Math.sin(f.h);
    out.x = f.x + b.off[0] * ch + b.off[1] * sh; out.z = f.z - b.off[0] * sh + b.off[1] * ch;
    out.y = Math.max(0.5, f.y + b.oy + Math.sin(this.t * 0.9 + b.dyJ) * 0.25);
  }
  placeMembers(f, snap) {
    const o = {};
    for (const b of f.members) { this.slot(f, b, o); b.mode = 'glide'; b.x = o.x; b.y = o.y; b.z = o.z; b.h = f.h; b.fold = 0; b.amp = 0.05; }
  }
  updateFlock(f, dt, px, pz, first) {
    if (!f.live) { this.spawnFlock(f, px, pz, first); return; }
    const W = this.world;
    if (Math.hypot(f.x - px, f.z - pz) > RANGE + 70) { f.live = false; return; }
    // steer: wander, keep water ahead, drift toward a shoreline when none is near
    f.turnT -= dt; if (f.turnT <= 0) { f.want = f.h + rnd(-0.4, 0.4); f.turnT = rnd(4, 10); }
    const ahead = (d) => W.isLand(f.x + Math.cos(f.h) * d, f.z - Math.sin(f.h) * d);
    let rate = 0.3, emergency = false;
    if (ahead(70) || ahead(35) || !W.inBounds(f.x + Math.cos(f.h) * 70, f.z - Math.sin(f.h) * 70, 100)) {
      emergency = true; rate = 1.0;
      for (const o of [0.6, -0.6, 1.2, -1.2, 1.9, -1.9, 2.6]) {
        const a = f.h + o;
        if (this.isWater(f.x + Math.cos(a) * 70, f.z - Math.sin(a) * 70) && this.isWater(f.x + Math.cos(a) * 35, f.z - Math.sin(a) * 35)) { f.want = a; break; }
      }
    }
    f.probeT -= dt;
    if (f.probeT <= 0) {
      f.probeT = 2;
      let near = false; for (let k = 0; k < 8 && !near; k++) near = W.isLand(f.x + Math.cos(k * 0.785) * 140, f.z - Math.sin(k * 0.785) * 140);
      f.seek = null;
      if (!near) for (let k = 0; k < 16 && f.seek == null; k++) for (const d of [220, 320, 450]) if (W.isLand(f.x + Math.cos(k * 0.3927) * d, f.z - Math.sin(k * 0.3927) * d)) { f.seek = k * 0.3927; break; }
    }
    if (!emergency && f.seek != null) f.want = f.h + angDiff(f.seek, f.h) * 0.3;
    const dh = Math.max(-rate * dt, Math.min(rate * dt, -angDiff(f.h, f.want)));
    f.h += dh; f.dh += (dh / Math.max(dt, 1e-3) - f.dh) * Math.min(1, dt * 2);
    f.x += Math.cos(f.h) * f.speed * dt; f.z -= Math.sin(f.h) * f.speed * dt;
    // altitude: glide low, sometimes skim the surface
    f.skimT -= dt; if (f.skimT <= 0) { f.skim = !f.skim; f.skimT = f.skim ? rnd(5, 9) : rnd(8, 18); }
    const ty = (f.skim ? 0.7 : 2.6) + Math.sin(this.t * 0.4 + f.x * 0.01) * 0.6;
    f.y += (ty - f.y) * Math.min(1, dt * 0.8);
    // flap bursts: a few slow flaps, then a long glide (skimming stays flat)
    f.flapT -= dt; if (f.flapT <= 0) { f.flap = !f.flap && !f.skim; f.flapT = f.flap ? rnd(2, 3.5) : rnd(3, 6); }
    f.ph += dt * (f.flap ? FLAP_W : 1.2);
    const diveReady = Math.hypot(f.x - px, f.z - pz) < 330;
    f.diveT -= dt;
    if (f.diveT <= 0) {
      f.diveT = diveReady ? rnd(12, 24) : 8;
      const cands = f.members.filter((b) => b.mode === 'glide');
      if (diveReady && cands.length > 2) this.startDive(cands[(Math.random() * cands.length) | 0], f);
    }
    const o = {};
    for (const b of f.members) {
      if (b.mode === 'glide') {
        this.slot(f, b, o);
        b.vy = (o.y - b.y) / Math.max(dt, 1e-3);
        b.x = o.x; b.y = o.y; b.z = o.z; b.h = f.h;
        b.pitch = Math.max(-0.2, Math.min(0.25, Math.atan2(b.vy, f.speed) * 0.8));
        b.roll = -Math.max(-0.45, Math.min(0.45, f.dh * 1.4));
        b.fold = 0; b.amp += ((f.flap ? 0.7 : 0.05) - b.amp) * Math.min(1, dt * 2);
        b.ph = f.ph + b.delay; b.hy = 0; b.hp = 0;
      } else this.updateDiver(b, f, dt);
    }
  }
  startDive(b, f) {
    b.mode = 'climb'; b.t = 0; b.h = f.h; b.vy = 0; b.speed = f.speed;
  }
  updateDiver(b, f, dt) {
    b.t += dt; b.hy = 0; b.hp = 0;
    if (b.mode === 'climb') { // rise and slow, flapping hard
      b.speed += (8 - b.speed) * Math.min(1, dt); b.vy += (6 - b.vy) * Math.min(1, dt * 3);
      this.move(b, dt); b.fold = 0; b.amp += (0.85 - b.amp) * Math.min(1, dt * 5); b.ph += dt * (FLAP_W + 2);
      b.pitch = 0.3; b.roll = 0;
      if (b.y >= 9 || b.t > 2.6) {
        const tx = b.x + Math.cos(b.h) * 7, tz = b.z - Math.sin(b.h) * 7;
        if (!this.isWater(tx, tz) || !this.isWater(b.x, b.z)) { b.mode = 'return'; return; }
        b.mode = 'plunge'; b.t = 0; b.speed = 10; b.vy = -(b.y + 0.35) / 0.7;
      }
    } else if (b.mode === 'plunge') {
      this.move(b, dt); b.fold = 0.85; b.amp = 0; b.pitch = -Math.atan2(-b.vy, b.speed);
      if (b.y <= WATER_Y + 0.15) { this.splash(b.x, b.z); b.mode = 'float'; b.t = 0; b.y = WATER_Y + 0.05; b.pitch = 0.05; b.fold = 1; }
    } else if (b.mode === 'float') {
      b.fold = 1; b.pitch = 0.1; b.y = WATER_Y + 0.05 + Math.sin(this.t * 3 + b.ph) * 0.04;
      b.h = f.h; b.speed = 0;
      if (b.t > 1.6) { b.mode = 'return'; b.t = 0; b.vy = 2; }
    } else if (b.mode === 'return') { // beat back to its slot in the line
      const o = {}; this.slot(f, b, o);
      const dx = o.x - b.x, dz = o.z - b.z, d = Math.hypot(dx, dz);
      if (d < 3 && Math.abs(o.y - b.y) < 1.5) { b.mode = 'glide'; return; }
      const wantH = Math.atan2(-dz, dx);
      b.h += Math.max(-2.2 * dt, Math.min(2.2 * dt, -angDiff(b.h, wantH)));
      b.speed += (Math.min(22, f.speed + 6 + d * 0.15) - b.speed) * Math.min(1, dt * 2);
      b.vy += (Math.max(-2, Math.min(4, (o.y - b.y) * 1.5)) - b.vy) * Math.min(1, dt * 3);
      this.move(b, dt); b.y = Math.max(WATER_Y + 0.4, b.y);
      b.fold = 0; b.amp += (0.8 - b.amp) * Math.min(1, dt * 4); b.ph += dt * (FLAP_W + 2); b.pitch = 0.1; b.roll = 0;
    }
  }
  move(b, dt) { b.x += Math.cos(b.h) * b.speed * dt; b.z -= Math.sin(b.h) * b.speed * dt; b.y += b.vy * dt; }
  splash(x, z) {
    const sp = this.G.fx && this.G.fx.splash; if (!sp) return;
    for (let i = 0; i < 36; i++) sp.emit(x + rnd(-0.4, 0.4), WATER_Y + 0.1, z + rnd(-0.4, 0.4), rnd(-1.6, 1.6), rnd(2.5, 5.5), rnd(-1.6, 1.6), { life: 1.0, s0: 0.25, s1: 0.7, grav: 9.8, alpha: 0.9 });
    for (let i = 0; i < 14; i++) { const a = Math.random() * TAU; sp.emit(x, WATER_Y + 0.05, z, Math.cos(a) * 3, 0.4, Math.sin(a) * 3, { life: 0.8, s0: 0.3, s1: 0.9, grav: 0, alpha: 0.45 }); }
  }

  // ---- per frame
  update(dt, player, on = true) {
    const px = player.pos.x, pz = player.pos.z;
    if (!on || !this.enabled) { if (this.mBody.count) this.hide(); return; }
    dt = Math.min(dt, 0.1); this.t += dt;
    this.scanT -= dt;
    if (this.scanT <= 0) { this.scanT = 1; this.rescan(px, pz); this.assignPerch(px, pz); }
    const first = !this.seeded; this.seeded = true;
    for (const f of this.flocks) this.updateFlock(f, dt, px, pz, first);
    for (const b of this.birds) {
      if (b.mode === 'perch') this.updatePerch(b, dt, px, pz);
      else if (b.mode === 'fly') this.updateFly(b, dt, px, pz);
    }
    this.draw();
  }
  hide() { for (const m of [this.mBody, this.mHead, this.mWL, this.mWR]) m.count = 0; for (const f of this.flocks) f.live = false; for (const b of this.birds) { if (b.site >= 0) this.owner[b.site] = -1; b.site = -1; b.mode = 'idle'; } }
  draw() {
    const M = this.M || (this.M = { b: new THREE.Matrix4(), t: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), p: new THREE.Vector3(), one: new THREE.Vector3(1, 1, 1), s: new THREE.Vector3(), r: new THREE.Matrix4() });
    let k = 0;
    for (const b of this.birds) {
      if (b.mode === 'idle') continue;
      const perched = b.mode === 'perch', flying = !perched && b.mode !== 'float';
      M.e.set(b.roll, b.h, b.pitch, 'YZX'); M.q.setFromEuler(M.e); M.p.set(b.x, b.y, b.z);
      M.b.compose(M.p, M.q, M.one);
      this.mBody.setMatrixAt(k, M.b);
      // head: turns on a perch, tucked back in flight
      const hx = flying ? -0.1 : 0, hy = flying ? -0.14 : 0;
      M.t.makeTranslation(NECK.x + hx, NECK.y + hy, 0);
      M.r.makeRotationY(b.hy); M.t.multiply(M.r);
      M.r.makeRotationZ(flying ? -0.45 : b.hp - 0.1); M.t.multiply(M.r);
      this.mHead.setMatrixAt(k, M.r.copy(M.b).multiply(M.t));
      // wings: flap about the shoulder, fold = swept back and shortened
      const up = 0.1 * (1 - b.fold) + b.amp * Math.sin(b.ph) * (1 - b.fold * 0.6) - b.fold * 0.25;
      const sweep = b.fold * 1.4, zs = 1 - b.fold * 0.55;
      for (const side of [1, -1]) {
        M.t.makeTranslation(SHOULDER.x, SHOULDER.y, SHOULDER.z * side);
        M.r.makeRotationY(-sweep * side); M.t.multiply(M.r);
        M.r.makeRotationX(-up * side); M.t.multiply(M.r);
        M.r.makeScale(1, 1, zs); M.t.multiply(M.r);
        (side > 0 ? this.mWR : this.mWL).setMatrixAt(k, M.r.copy(M.b).multiply(M.t));
      }
      k++;
    }
    for (const m of [this.mBody, this.mHead, this.mWL, this.mWR]) { m.count = k; m.instanceMatrix.needsUpdate = true; }
    this.visible = k;
  }
}
