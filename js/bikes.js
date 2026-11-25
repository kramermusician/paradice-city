// Cyclists: small groups of road riders (pace lines of one to four) on the island streets and
// Gulf of Mexico Drive, riding the right-hand edge. They pedal, slow behind you, and if you
// clip one they tip over, sit a moment and get back on. Nobody is hurt.
import * as THREE from 'three';
import { makeCyclist, mergeGroup } from './models.js';

const SHIRTS = [0xe63946, 0x1d6fd8, 0xffc93c, 0x2ec4b6, 0xff7a45, 0x7b4bd8, 0xffffff, 0x111111, 0x2ea86b, 0xff5fa2];
const BIKES = [0x222222, 0xd8d8d8, 0xb3122e, 0x1f3f7a, 0x2a7a4a];
const SKIN = [0xc68e6b, 0x8d5a3b, 0xf0c8a8, 0x5c3a24, 0xe0ac85];
const GROUPS = 16, MAX_RIDERS = 40, SPACING = 2.3;

export class Bikes {
  constructor(scene, world) {
    this.world = world;
    this.ways = world.roads.filter((r) => /primary|secondary|tertiary|residential|unclassified/.test(r.k) && r.p.length >= 6 && !r.o);
    this.ends = new Map();
    const key = this.key = (x, z) => Math.round(x / 4) + ',' + Math.round(z / 4);
    this.ways.forEach((r, i) => {
      for (const end of [0, r.p.length - 3]) {
        const k = key(r.p[end], r.p[end + 1]);
        let a = this.ends.get(k); if (!a) this.ends.set(k, a = []); a.push([i, end === 0 ? 1 : -1]);
      }
    });
    // Gulf of Mexico Drive is where the real pace lines ride: weight it up
    this.gmd = this.ways.map((r, i) => /Gulf of Mexico Drive/.test(r.n) ? i : -1).filter((i) => i >= 0);
    this.riders = [];
    for (let i = 0; i < MAX_RIDERS; i++) {
      const { body, legs } = makeCyclist(SHIRTS[i % SHIRTS.length], BIKES[(i * 3) % BIKES.length], SKIN[(i * 7) % SKIN.length]);
      const m = new THREE.Group();
      const merged = mergeGroup(body);
      merged.traverse((o) => { o.castShadow = false; });
      m.add(merged, ...legs);
      m.visible = false;
      scene.add(m);
      this.riders.push({ m, legs, ph: Math.random() * 6, fall: 0, group: null });
    }
    this.groups = [];
    for (let g = 0; g < GROUPS; g++) this.groups.push({ way: -1, seg: 0, dir: 1, u: 0, speed: 0, cruise: 5, hist: [], riders: [] });
    // hand out riders: sizes 1 to 4
    let k = 0;
    for (const g of this.groups) { const n = [1, 1, 2, 2, 3, 4][Math.floor(Math.random() * 6)]; for (let j = 0; j < n && k < MAX_RIDERS; j++) { g.riders.push(this.riders[k]); this.riders[k].group = g; k++; } }
    this.enabled = true;
    this.sample = this.riders[0].m;
    this.toastT = 0;
  }
  prewarmList() { return [this.riders[0].m]; }
  respawn(g, px, pz) {
    for (let tries = 0; tries < 30; tries++) {
      const wi = Math.random() < 0.45 && this.gmd.length ? this.gmd[Math.floor(Math.random() * this.gmd.length)] : Math.floor(Math.random() * this.ways.length);
      const r = this.ways[wi], n = r.p.length / 3;
      const s = Math.floor(Math.random() * (n - 1));
      const d = Math.hypot(r.p[s * 3] - px, r.p[s * 3 + 1] - pz);
      if (d < 120 || d > 750) continue;
      Object.assign(g, { way: wi, seg: s, dir: Math.random() < 0.5 ? 1 : -1, u: 0, speed: 4, cruise: 5 + Math.random() * 3.5, hist: [] });
      for (const rd of g.riders) rd.m.visible = true;
      return;
    }
    g.way = -1; for (const rd of g.riders) rd.m.visible = false;
  }
  update(dt, player) {
    const px = player.pos.x, pz = player.pos.z;
    this.toastT -= dt;
    for (const g of this.groups) {
      if (!g.riders.length) continue;
      if (!this.enabled) { for (const rd of g.riders) rd.m.visible = false; g.way = -1; continue; }
      const lead = g.riders[0].m;
      if (g.way < 0 || Math.hypot(lead.position.x - px, lead.position.z - pz) > 950) { this.respawn(g, px, pz); if (g.way < 0) continue; }
      const r = this.ways[g.way], p = r.p, n = p.length / 3;
      // slow down behind the player, and wait for anyone who fell over
      const fx = Math.cos(lead.rotation.y), fz = -Math.sin(lead.rotation.y);
      const dx = px - lead.position.x, dz = pz - lead.position.z;
      const ahead = dx * fx + dz * fz, lateral = Math.abs(dx * fz - dz * fx);
      let target = g.cruise;
      if ((ahead > 0 && ahead < 10 && lateral < 2.5 && Math.abs(player.y - lead.position.y) < 3) || g.riders.some((rd) => rd.fall > 0)) target = 0;
      g.speed += Math.max(-6 * dt, Math.min(1.5 * dt, target - g.speed));
      let i0 = g.seg, i1 = g.seg + 1;
      if (g.dir < 0) { i0 = g.seg + 1; i1 = g.seg; }
      const ax = p[i0 * 3], az = p[i0 * 3 + 1], bx = p[i1 * 3], bz = p[i1 * 3 + 1];
      const len = Math.hypot(bx - ax, bz - az) || 0.01;
      g.u += g.speed * dt / len;
      if (g.u >= 1) {
        g.u = 0; g.seg += g.dir;
        if (g.seg < 0 || g.seg >= n - 1) {
          const endIdx = g.dir > 0 ? (n - 1) * 3 : 0;
          const opts = (this.ends.get(this.key(p[endIdx], p[endIdx + 1])) || []).filter(([wi]) => wi !== g.way);
          if (opts.length) { const [wi, d] = opts[Math.floor(Math.random() * opts.length)]; g.way = wi; g.dir = d; g.seg = d > 0 ? 0 : this.ways[wi].p.length / 3 - 2; }
          else { g.dir = -g.dir; g.seg = Math.max(0, Math.min(n - 2, g.seg + g.dir)); }
        }
        continue;
      }
      const tx = (bx - ax) / len, tz = (bz - az) / len;
      // right-hand edge, outside the traffic lane
      const off = Math.max(r.w / 2 - 0.7, Math.min(2.2, r.w * 0.25) + 1.7);
      const x = ax + (bx - ax) * g.u - tz * off, z = az + (bz - az) * g.u + tx * off;
      const y = p[i0 * 3 + 2] + (p[i1 * 3 + 2] - p[i0 * 3 + 2]) * g.u + (r.off || 0.1) + 0.03;   // on the drawn road surface (2026-11-25: the tires used to sit 13 cm into it)
      const h = Math.atan2(-tz, tx);
      const last = g.hist[g.hist.length - 1];
      if (!last || Math.hypot(last[0] - x, last[2] - z) > 0.4) { g.hist.push([x, y, z, h]); if (g.hist.length > 60) g.hist.shift(); }
      // the leader rides the path; each follower sits SPACING meters back along it
      g.riders.forEach((rd, i) => {
        let pos = [x, y, z, h];
        if (i > 0) {
          let need = i * SPACING, j = g.hist.length - 1;
          while (j > 0 && need > 0) { need -= Math.hypot(g.hist[j][0] - g.hist[j - 1][0], g.hist[j][2] - g.hist[j - 1][2]); j--; }
          pos = g.hist[Math.max(0, j)] || pos;
          if (g.hist.length < 3) pos = [x - tx * i * SPACING, y, z - tz * i * SPACING, h];
        }
        const m = rd.m;
        if (rd.fall > 0) {
          rd.fall -= dt;
          const k = rd.fall > 3 ? Math.min(1, (3.6 - rd.fall) * 3) : rd.fall > 0.6 ? 1 : rd.fall / 0.6;
          m.rotation.set(-1.35 * k, m.rotation.y, 0, 'YXZ');
          return;
        }
        m.position.set(pos[0], pos[1], pos[2]);
        let dh = pos[3] - m.rotation.y; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
        m.rotation.set(0, m.rotation.y + dh * Math.min(1, dt * 8), 0, 'YXZ');
        rd.ph += dt * g.speed * 1.6;
        rd.legs[0].rotation.z = Math.sin(rd.ph) * 0.55 - 0.35; rd.legs[1].rotation.z = Math.sin(rd.ph + Math.PI) * 0.55 - 0.35;
      });
    }
  }
  // clip a rider and they tip over (and get back on); the car loses a little speed
  collide(v) {
    if (v.kind === 'air' && v.y > 2.5) return 0;
    let hit = 0;
    const R = v.kind === 'truck' ? 2.6 : 2.0;
    for (const rd of this.riders) {
      if (!rd.m.visible || rd.fall > 0) continue;
      const d = Math.hypot(v.pos.x - rd.m.position.x, v.pos.z - rd.m.position.z);
      if (d < R && Math.abs(v.y - rd.m.position.y) < 2 && Math.abs(v.speed) > 1.5) {
        rd.fall = 3.6;
        v.vel.multiplyScalar(0.85);
        hit = Math.max(hit, 1);
        if (this.toastT <= 0 && window.G && G.hud) { G.hud.toast('Sorry! (the cyclist is fine, just annoyed)', 2); this.toastT = 6; }
      }
    }
    return hit;
  }
}
