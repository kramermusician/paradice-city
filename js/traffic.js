// Light ambient traffic on the main roads near the player. Cars keep right, follow a road
// way to its end, then pick a connected way. They slow for the player and never chase anyone.
import * as THREE from 'three';
import { makeTrafficCar, mergeGroup } from './models.js';

const COLORS = [0xd8d8d8, 0x2a2a2a, 0x8b1e2a, 0x1f3f7a, 0xf0f0f0, 0x6b7a52, 0xc9b28a, 0x4a6e8f, 0xbfc3c7];

export class Traffic {
  constructor(scene, world, n = 20) {
    this.world = world;
    this.ways = world.roads.filter((r) => /primary|secondary|tertiary/.test(r.k) && r.p.length >= 6);
    this.ends = new Map();
    const key = (x, z) => Math.round(x / 4) + ',' + Math.round(z / 4);
    this.ways.forEach((r, i) => {
      for (const end of [0, r.p.length - 3]) {
        const k = key(r.p[end], r.p[end + 1]);
        let a = this.ends.get(k); if (!a) this.ends.set(k, a = []); a.push([i, end === 0 ? 1 : -1]);
      }
    });
    this.key = key;
    this.cars = [];
    for (let i = 0; i < n; i++) {
      const m = mergeGroup(makeTrafficCar(COLORS[i % COLORS.length]));
      m.traverse((o) => { o.castShadow = false; });
      scene.add(m);
      this.cars.push({ m, way: -1, seg: 0, dir: 1, u: 0, speed: 0, wait: 0 });
    }
    this.enabled = true;
  }
  respawn(c, px, pz) {
    for (let tries = 0; tries < 30; tries++) {
      const wi = Math.floor(Math.random() * this.ways.length);
      const r = this.ways[wi], n = r.p.length / 3;
      const s = Math.floor(Math.random() * (n - 1));
      const d = Math.hypot(r.p[s * 3] - px, r.p[s * 3 + 1] - pz);
      if (d < 150 || d > 1300) continue;
      Object.assign(c, { way: wi, seg: s, dir: Math.random() < 0.5 ? 1 : -1, u: 0, speed: 0 });
      c.m.visible = true;
      return;
    }
    c.m.visible = false; c.way = -1;
  }
  update(dt, player) {
    const px = player.pos.x, pz = player.pos.z;
    for (const c of this.cars) {
      if (!this.enabled) { c.m.visible = false; continue; }
      if (c.way < 0 || Math.hypot(c.m.position.x - px, c.m.position.z - pz) > 1500) { this.respawn(c, px, pz); if (c.way < 0) continue; }
      const r = this.ways[c.way], p = r.p, n = p.length / 3;
      const limit = (r.limit || 35) / 2.237;
      // slow down if the player is ahead and close
      const fx = Math.cos(c.m.rotation.y), fz = -Math.sin(c.m.rotation.y);
      const dx = px - c.m.position.x, dz = pz - c.m.position.z;
      const ahead = dx * fx + dz * fz, lateral = Math.abs(dx * fz - dz * fx);
      let target = limit;
      if (ahead > 0 && ahead < 22 && lateral < 3.5) target = 0;
      c.speed += Math.max(-10 * dt, Math.min(3 * dt, target - c.speed));
      let i0 = c.seg, i1 = c.seg + 1;
      if (c.dir < 0) { i0 = c.seg + 1; i1 = c.seg; }
      const ax = p[i0 * 3], az = p[i0 * 3 + 1], bx = p[i1 * 3], bz = p[i1 * 3 + 1];
      const len = Math.hypot(bx - ax, bz - az) || 0.01;
      c.u += c.speed * dt / len;
      if (c.u >= 1) {
        c.u = 0;
        c.seg += c.dir;
        if (c.seg < 0 || c.seg >= n - 1) {
          const endIdx = c.dir > 0 ? (n - 1) * 3 : 0;
          const opts = (this.ends.get(this.key(p[endIdx], p[endIdx + 1])) || []).filter(([wi]) => wi !== c.way);
          if (opts.length) {
            const [wi, d] = opts[Math.floor(Math.random() * opts.length)];
            c.way = wi; c.dir = d; c.seg = d > 0 ? 0 : this.ways[wi].p.length / 3 - 2;
          } else { c.dir = -c.dir; c.seg = Math.max(0, Math.min(n - 2, c.seg + c.dir)); }
        }
        continue;
      }
      const tx = (bx - ax) / len, tz = (bz - az) / len;
      const off = Math.min(2.2, r.w * 0.25);
      const x = ax + (bx - ax) * c.u + tz * -off * -1, z = az + (bz - az) * c.u - tx * off;
      const y = p[i0 * 3 + 2] + (p[i1 * 3 + 2] - p[i0 * 3 + 2]) * c.u + 0.1;
      // right-hand lane: right of travel direction (tx, tz) is (-tz, tx)
      c.m.position.set(ax + (bx - ax) * c.u - tz * off, y, az + (bz - az) * c.u + tx * off);
      const h = Math.atan2(-tz, tx);
      let dh = h - c.m.rotation.y; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      c.m.rotation.y += dh * Math.min(1, dt * 8);
    }
  }
  // push the player back if they hit a traffic car; returns impact speed
  collide(player) {
    let hit = 0;
    for (const c of this.cars) {
      if (!c.m.visible) continue;
      const dx = player.pos.x - c.m.position.x, dz = player.pos.z - c.m.position.z;
      const d = Math.hypot(dx, dz);
      const r = (player.kind === 'truck' ? 3.2 : 2.6);
      if (d < r && Math.abs(player.y - c.m.position.y) < 2) {
        const nx = dx / (d || 1), nz = dz / (d || 1);
        const into = player.vel.x * nx + player.vel.y * nz;
        if (into < 0) { player.vel.x -= nx * into * 1.4; player.vel.y -= nz * into * 1.4; hit = Math.max(hit, -into); }
        player.pos.x += nx * (r - d) * 0.6; player.pos.z += nz * (r - d) * 0.6;
        c.speed = 0;
      }
    }
    return hit;
  }
}
