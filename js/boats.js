// Ambient boats on the bay and the gulf near the player. They cruise, steer away from
// land by probing ahead, give the player's boat room, and respawn out of sight.
import { makeTrafficBoat, mergeGroup } from './models.js';
import { PROPS } from './props.js';
import { ISLAND_LINE } from './config.js';

const WATER_Y = -0.35;

export class BoatTraffic {
  constructor(scene, world, n = 18) {
    this.world = world;
    this.boats = [];
    for (let i = 0; i < n; i++) {
      let src, ud, m;
      if (PROPS.yacht && (i === 4 || i === 12)) {
        // two big motor yachts from the Dropbox set (32 m), sitting about 1.4 m deep
        const y = PROPS.yacht.clone(true); y.position.y = -1.05;
        m = new y.constructor(); m.add(y);
        ud = { kind: 'yacht', len: 32, wid: 7, speed: 5.5 };
      } else {
        src = makeTrafficBoat(i);
        ud = src.userData;
        m = mergeGroup(src);
      }
      m.traverse((o) => { o.castShadow = false; });
      m.visible = false;
      scene.add(m);
      this.boats.push({ m, kind: ud.kind, len: ud.len, rad: Math.max(ud.len * 0.5, ud.wid), cruise: ud.speed * (0.8 + Math.random() * 0.4), speed: 0, h: 0, want: 0, live: false, wait: Math.random(), turnT: 0, foam: 0, ph: Math.random() * 6 });
    }
    this.enabled = true;
    this.t = 0;
  }
  water(x, z, pad = 0) {
    const W = this.world;
    if (W.isLand(x, z) || !W.inBounds(x, z, 120)) return false;
    if (!pad) return true;
    for (let a = 0; a < 6; a++) if (W.isLand(x + Math.cos(a * 1.047) * pad, z + Math.sin(a * 1.047) * pad)) return false;
    return true;
  }
  respawn(b, px, pz, near = false) {
    for (let tries = 0; tries < 24; tries++) {
      const ang = Math.random() * Math.PI * 2, r = near ? 120 + Math.random() * 700 : 450 + Math.random() * 500;
      const x = px + Math.cos(ang) * r, z = pz + Math.sin(ang) * r;
      if (!this.water(x, z, b.kind === 'yacht' ? 40 : 18)) continue;
      // head somewhere open
      let h = Math.random() * Math.PI * 2;
      for (let k = 0; k < 8 && !this.water(x + Math.cos(h) * 60, z - Math.sin(h) * 60); k++) h += Math.PI / 4;
      Object.assign(b, { live: true, h, want: h, speed: b.cruise * 0.7, turnT: 4 + Math.random() * 8 });
      b.m.position.set(x, WATER_Y, z); b.m.rotation.set(0, h, 0);
      b.m.visible = true;
      return;
    }
    b.live = false; b.m.visible = false; b.wait = 0.5 + Math.random();
  }
  update(dt, player, fx, first = false) {
    this.t += dt;
    const px = player.pos.x, pz = player.pos.z;
    for (const b of this.boats) {
      if (!this.enabled) { b.m.visible = false; b.live = false; continue; }
      if (!b.live) { b.wait -= dt; if (b.wait <= 0) this.respawn(b, px, pz, first || this.t < 3); if (!b.live) continue; }
      const p = b.m.position;
      const dp = Math.hypot(p.x - px, p.z - pz);
      if (dp > 1400 || this.world.isLand(p.x, p.z)) { b.live = false; b.m.visible = false; b.wait = 0.3; continue; }
      // steering: wander, then dodge land ahead and the player
      b.turnT -= dt;
      if (b.turnT <= 0) { b.want = b.h + (Math.random() - 0.5) * 1.2; b.turnT = 5 + Math.random() * 10; }
      const look = 25 + b.speed * 4;
      const free = (a, d = look) => this.water(p.x + Math.cos(a) * d, p.z - Math.sin(a) * d) && this.water(p.x + Math.cos(a) * d * 0.5, p.z - Math.sin(a) * d * 0.5);
      let target = b.cruise;
      if (!free(b.h)) {
        let pick = null;
        for (const off of [0.5, -0.5, 1.0, -1.0, 1.6, -1.6, 2.3, -2.3]) {
          const o = b.ph > 3 ? off : -off;
          if (free(b.h + o)) { pick = b.h + o; break; }
        }
        b.want = pick == null ? b.h + Math.PI * 0.75 : pick;
        target = b.cruise * 0.5;
      }
      const fxh = Math.cos(b.h), fzh = -Math.sin(b.h);
      const dx = px - p.x, dz = pz - p.z;
      const ahead = dx * fxh + dz * fzh, lat = dx * fzh - dz * fxh;
      if (player.kind === 'boat' && ahead > 0 && ahead < 40 && Math.abs(lat) < 10) { b.want = b.h + (lat > 0 ? -0.7 : 0.7); target = b.cruise * 0.4; }
      let dh = Math.atan2(Math.sin(b.want - b.h), Math.cos(b.want - b.h));
      const rate = (b.kind === 'sail' ? 0.25 : 0.45) * Math.min(1, b.speed / 3 + 0.3);
      b.h += Math.max(-rate * dt, Math.min(rate * dt, dh));
      b.speed += Math.max(-3 * dt, Math.min(1.5 * dt, target - b.speed));
      p.x += Math.cos(b.h) * b.speed * dt; p.z -= Math.sin(b.h) * b.speed * dt;
      const t = this.t + b.ph;
      p.y = WATER_Y + Math.sin(t * 1.3) * 0.08 + (b.kind === 'console' ? Math.min(0.25, b.speed * 0.02) : 0);
      b.m.rotation.set(Math.sin(t * 1.1) * (b.kind === 'sail' ? 0.12 : 0.03) + (b.kind === 'sail' ? 0.12 : 0), b.h, Math.sin(t * 0.9) * 0.025 + (b.kind === 'console' ? b.speed * 0.006 : 0), 'YXZ');
      // light wake foam when close enough to see it
      if (fx && dp < 500 && b.speed > 2 && b.kind !== 'sail') {
        b.foam -= dt;
        if (b.foam <= 0) {
          b.foam = 0.12;
          const sx = p.x - fxh * b.len * 0.5, sz = p.z - fzh * b.len * 0.5;
          for (const s of [-1, 1]) fx.wake.emit(sx, WATER_Y + 0.05, sz, -fzh * s * 1.2 - fxh * 0.5, 0, fxh * s * 1.2 - fzh * 0.5, { life: 2.6, s0: 0.5, s1: 2.2 + b.speed * 0.08, alpha: 0.25 });
        }
      }
    }
  }
  // bump the player's boat off traffic boats; returns impact speed
  collide(player) {
    if (player.kind !== 'boat') return 0;
    let hit = 0;
    for (const b of this.boats) {
      if (!b.live) continue;
      const p = b.m.position, dx = player.pos.x - p.x, dz = player.pos.z - p.z, d = Math.hypot(dx, dz);
      const r = b.rad + 2.2;
      if (d < r) {
        const nx = dx / (d || 1), nz = dz / (d || 1);
        const into = player.vel.x * nx + player.vel.y * nz;
        if (into < 0) { player.vel.x -= nx * into * 1.3; player.vel.y -= nz * into * 1.3; hit = Math.max(hit, -into); }
        player.pos.x += nx * (r - d) * 0.5; player.pos.z += nz * (r - d) * 0.5;
        b.speed *= 0.5;
      }
    }
    return hit;
  }
}

// One LNG tanker (290 m) steaming slowly up and down the Gulf a few kilometers off the beach,
// on a line parallel to the island. Always out there, so it reads as part of the horizon.
export class Tanker {
  constructor(scene, world) {
    this.ok = !!PROPS.lng;
    if (!this.ok) return;
    this.m = PROPS.lng.clone(true);
    this.m.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    this.m.children.forEach((c) => { c.position.y -= 11; });   // about 11 m draft
    scene.add(this.m);
    // offset the island line toward the Gulf (left of the north-to-south direction)
    const pts = [];
    for (let i = 0; i < ISLAND_LINE.length; i++) {
      const [x, z] = ISLAND_LINE[i], [ax, az] = ISLAND_LINE[Math.max(0, i - 1)], [bx, bz] = ISLAND_LINE[Math.min(ISLAND_LINE.length - 1, i + 1)];
      const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1;
      let off = 3200, px, pz;
      do { px = x + (dz / l) * off; pz = z - (dx / l) * off; off += 400; } while (world.isLand(px, pz) && off < 8000);
      if (world.inBounds(px, pz, 300)) pts.push([px, pz]);
    }
    this.pts = pts; this.d = Math.random() * 0.6 + 0.2; this.dir = 1; this.speed = 6.5;
    this.len = 0; this.seg = [];
    for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); this.seg.push(l); this.len += l; }
    this.s = this.len * this.d; this.h = 0; this.t = 0;
    if (pts.length < 2) { this.ok = false; this.m.visible = false; }
  }
  at(s) {
    let i = 0; while (i < this.seg.length - 1 && s > this.seg[i]) { s -= this.seg[i]; i++; }
    const [ax, az] = this.pts[i], [bx, bz] = this.pts[i + 1], f = Math.min(1, s / this.seg[i]);
    return [ax + (bx - ax) * f, az + (bz - az) * f, Math.atan2(-(bz - az), bx - ax)];
  }
  update(dt) {
    if (!this.ok) return;
    this.t += dt;
    this.s += this.dir * this.speed * dt;
    if (this.s > this.len - 200) { this.s = this.len - 200; this.dir = -1; }
    if (this.s < 200) { this.s = 200; this.dir = 1; }
    // it turns around only at the far ends of the map, where nobody is watching
    const [x, z, h] = this.at(this.s);
    this.h = this.dir > 0 ? h : h + Math.PI;
    this.m.position.set(x, WATER_Y + Math.sin(this.t * 0.3) * 0.15, z);
    this.m.rotation.set(0, this.h, Math.sin(this.t * 0.21) * 0.005, 'YXZ');
  }
}
