// Police: patrol cruisers in traffic, speed traps on the shoulder, and free-roam chases.
// Speed past a cruiser (15 mph or more over the limit) or bump one and its lights come on.
// Stars climb the longer you run: one cruiser, then two more, then a helicopter with a searchlight.
// Stop for a warning, or outrun them (cruisers top out near 105 mph) to get away. Nobody rams,
// nobody shoots, nobody gets hurt. Off during missions (the Cranberry Run has its own police).
import * as THREE from 'three';
import { Traffic } from './traffic.js';
import { makePoliceCar, makeHelicopter } from './models.js';
import { MPH } from './config.js';
import { setSiren, chime } from './audio.js';

const COP_MAX = 47;          // m/s, about 105 mph
const SPOT_RANGE = 110;      // a cruiser sees you speeding inside this many meters
const OVER = 15;             // mph over the limit before they care
const $ = (id) => document.getElementById(id);
const lightMat = (c) => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: c, emissiveIntensity: 0.15 });

export class Police {
  constructor(scene, world, G) {
    this.G = G; this.world = world; this.scene = scene;
    this.mats = { offR: lightMat(0xff1a1a), offB: lightMat(0x1a4dff), onR: lightMat(0xff1a1a), onB: lightMat(0x1a4dff) };
    // patrol cruisers drive with the traffic code, a little closer in than ordinary cars
    this.patrol = new Traffic(scene, world, 0);
    this.patrol.near = 120; this.patrol.far = 900;
    for (let i = 0; i < 6; i++) {
      const m = this.makeCar();
      scene.add(m);
      this.patrol.cars.push({ m, way: -1, seg: 0, dir: 1, u: 0, speed: 0, wait: 0, cop: true });
    }
    // speed traps: cruisers parked on the shoulder of Gulf of Mexico Drive and the Ringling Causeway
    this.traps = [];
    const spots = [];
    for (const r of world.roads) {
      if (r.b || !/Gulf of Mexico Drive|John Ringling Causeway|John Ringling Boulevard/.test(r.n)) continue;
      const p = r.p;
      for (let i = 0; i < p.length - 3; i += 3) {
        const x = p[i], z = p[i + 1], h = Math.atan2(-(p[i + 4] - z), p[i + 3] - x);
        if (Math.hypot(p[i + 3] - x, p[i + 4] - z) < 20) continue;
        if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < 2600)) continue;
        const off = r.w / 2 + 3.2, sx = x + Math.sin(h) * off, sz = z + Math.cos(h) * off;
        if (!world.isLand(sx, sz) || world.buildingAt(sx, sz) || world.roadAt(sx, sz, 0)) continue;
        spots.push({ x: sx, z: sz, h: h + Math.PI }); // parked facing oncoming traffic
      }
    }
    for (const s of spots.slice(0, 7)) {
      const m = this.makeCar();
      m.position.set(s.x, 0.05, s.z); m.rotation.y = s.h;
      scene.add(m);
      this.traps.push({ m, home: s, trap: true });
    }
    // the chase helicopter: no real light (a new light mid-game recompiles every shader), just a cone
    this.heli = makeHelicopter({ spot: false });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(9, 60, 24, 1, true).translate(0, -30, 0),
      new THREE.MeshBasicMaterial({ color: 0xfff6d0, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    cone.position.set(1.0, -1.2, 0);
    this.heli.add(cone); this.heli.userData.cone = cone;
    this.heli.visible = false; scene.add(this.heli);
    this.trail = []; this.D = 0;
    this.chase = null; this.cooldown = 0; this.callT = 12; this.escapes = 0;
    this.sample = this.makeCar(true); this.sample.visible = false; scene.add(this.sample);
  }
  makeCar(on = false) {
    const m = makePoliceCar();
    this.setLights(m, on);
    return m;
  }
  setLights(m, on) {
    m.userData.red.material = on ? this.mats.onR : this.mats.offR;
    m.userData.blue.material = on ? this.mats.onB : this.mats.offB;
    m.userData.on = on;
  }
  setAgency(m, id) {
    const u = m.userData; if (!u.livery || u.agency === id) return;
    for (const k in u.livery) u.livery[k].visible = k === id;
    u.agency = id;
  }
  agencyName(m) { return m && m.userData.agency === 'lbk' ? 'Longboat Key Police' : 'Sarasota Police'; }
  prewarmList() { return [this.sample, this.heli]; }
  heliCount() { return this.heli.visible ? 1 : 0; }
  allCops() { return [...this.patrol.cars.filter((c) => c.m.visible && c.way >= 0 || c.chase), ...this.traps]; }
  minimapMarkers() {
    if (!this.chase) return [];
    const flash = Math.floor(this.G.time * 4) % 2;
    return this.chase.cops.map((c) => ({ x: c.m.position.x, z: c.m.position.z, color: flash ? '#ff3030' : '#3060ff' }));
  }

  // bump off cruisers (patrol, chasing and parked); bumping one starts a chase
  collide(v) {
    let hit = this.patrol.enabled ? this.patrol.collide(v) : 0;
    if (!this.patrol.enabled) return 0;
    for (const t of this.traps) {
      if (t.chase) continue;
      const dx = v.pos.x - t.m.position.x, dz = v.pos.z - t.m.position.z, d = Math.hypot(dx, dz);
      if (d < 2.8 && Math.abs(v.y - t.m.position.y) < 2) {
        const nx = dx / (d || 1), nz = dz / (d || 1), into = v.vel.x * nx + v.vel.y * nz;
        if (into < 0) { v.vel.x -= nx * into * 1.4; v.vel.y -= nz * into * 1.4; hit = Math.max(hit, -into); }
        v.pos.x += nx * (2.8 - d) * 0.6; v.pos.z += nz * (2.8 - d) * 0.6;
        if (-into > 3) this.patrol.copHit = t;
      }
    }
    return hit;
  }

  // ---------------------------------------------------------------- trail of the player
  record(v) {
    const last = this.trail[this.trail.length - 1];
    if (last) {
      const d = Math.hypot(last.x - v.pos.x, last.z - v.pos.z);
      if (d > 60) { this.trail = []; this.D = 0; if (this.chase) this.stop(false, 'They lost you.'); }
      else if (d > 2) { this.D += d; this.trail.push({ x: v.pos.x, z: v.pos.z, y: v.y, d: this.D }); }
    } else this.trail.push({ x: v.pos.x, z: v.pos.z, y: v.y, d: this.D });
    if (this.trail.length > 1500) this.trail.shift();
  }
  trailAt(s) {
    const T = this.trail;
    if (!T.length) return null;
    if (s <= T[0].d) return { ...T[0], h: T.length > 1 ? Math.atan2(-(T[1].z - T[0].z), T[1].x - T[0].x) : 0 };
    let lo = 0, hi = T.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T[m].d < s) lo = m; else hi = m; }
    const a = T[lo], b = T[hi], u = Math.min(1, (s - a.d) / (b.d - a.d || 1));
    return { x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u, y: a.y + (b.y - a.y) * u, h: Math.atan2(-(b.z - a.z), b.x - a.x) };
  }

  // ---------------------------------------------------------------- per frame
  update(dt, v, enabled) {
    const G = this.G;
    this.patrol.enabled = enabled;
    for (const t of this.traps) t.m.visible = enabled;
    if (!enabled) { if (this.chase) this.stop(true); this.heli.visible = false; return; }
    this.patrol.update(dt, v);
    // Longboat Key cars on the key, Sarasota cars everywhere else (a car swaps decals when it crosses)
    this.liveryT = (this.liveryT || 0) - dt;
    if (this.liveryT <= 0) {
      this.liveryT = 0.5;
      for (const c of [...this.patrol.cars, ...this.traps]) this.setAgency(c.m, this.world.areaName(c.m.position.x, c.m.position.z) === 'Longboat Key' ? 'lbk' : 'spd');
    }
    this.cooldown = Math.max(0, this.cooldown - dt);
    // the whole fleet's lights flash in step
    const f = Math.floor(G.time * 6) % 2;
    this.mats.onR.emissiveIntensity = f ? 4 : 0.2; this.mats.onB.emissiveIntensity = f ? 0.2 : 4;
    if (v.kind !== 'car') { if (this.chase) this.stop(false, 'They lost you.'); this.trail = []; this.ambient(dt, v); return; }
    this.record(v);
    this.ambient(dt, v);
    if (this.chase) { this.updChase(dt, v); return; }
    if (this.cooldown > 0) { this.patrol.copHit = null; return; }
    // bumped a cruiser
    if (this.patrol.copHit) { const c = this.patrol.copHit; this.patrol.copHit = null; this.start(c, `You bumped a ${this.agencyName(c.m)} car. Lights are on.`); return; }
    // speeding near a cruiser or a trap
    if (!v.lastRoad) return;
    if (G.sky && G.sky.on) return; // no speeding stops while the birthday plane is writing
    const mph = Math.abs(v.speed) * MPH, lim = G.missions.limitAt(v);
    if (mph < lim + OVER) { this.overT = 0; return; }
    this.overT = (this.overT || 0) + dt;
    if (this.overT < 0.4) return;
    for (const c of this.allCops()) {
      if (Math.hypot(c.m.position.x - v.pos.x, c.m.position.z - v.pos.z) < SPOT_RANGE) {
        this.start(c, `${c.trap ? 'Speed trap! ' : ''}${this.agencyName(c.m)}: ${Math.round(mph)} in a ${lim}. Lights behind you: pull over or lose them.`, Math.round(mph), lim);
        return;
      }
    }
  }
  // a patrol car now and then answers a call: lights on, a bit faster than traffic
  ambient(dt, v) {
    this.callT -= dt;
    for (const c of this.patrol.cars) if (c.callT > 0 && !c.chase) { c.callT -= dt; if (c.callT <= 0) { c.mul = 1; this.setLights(c.m, false); } }
    if (this.callT > 0) return;
    this.callT = 18 + Math.random() * 20;
    const near = this.patrol.cars.filter((c) => !c.chase && c.m.visible && c.way >= 0 && Math.hypot(c.m.position.x - v.pos.x, c.m.position.z - v.pos.z) < 700);
    if (!near.length) return;
    const c = near[Math.floor(Math.random() * near.length)];
    c.mul = 1.45; c.callT = 22; this.setLights(c.m, true);
  }
  start(c, msg, mph, lim) {
    const G = this.G, D = this.D;
    this.chase = { t: 0, stars: 1, cops: [], lostT: 0, stillT: 0, mph, lim };
    this.addCop(c, true);
    setSiren(true);
    G.hud.toast(msg, 3.2);
    $('wanted').style.display = 'block';
  }
  addCop(c, join) {
    const ch = this.chase, i = ch.cops.length;
    c.chase = true; c.callT = 0; c.mul = 1;
    this.setLights(c.m, true);
    c.m.visible = true;
    const gap = 16 + i * 11;
    c.s = Math.max(this.trail.length ? this.trail[0].d : 0, this.D - (join ? Math.max(gap, 45) : 130));
    c.sp = 25;
    const p = this.trailAt(c.s);
    c.from = c.m.position.clone(); c.fromH = c.m.rotation.y;
    c.join = join && p ? 0 : 1;
    c.joinT = p ? THREE.MathUtils.clamp(Math.hypot(p.x - c.from.x, p.z - c.from.z) / 30, 1, 3.5) : 1;
    ch.cops.push(c);
  }
  nextCop(v) {
    // the nearest free patrol car, put on the road well behind you
    const free = this.patrol.cars.filter((c) => !c.chase).sort((a, b) =>
      Math.hypot(a.m.position.x - v.pos.x, a.m.position.z - v.pos.z) - Math.hypot(b.m.position.x - v.pos.x, b.m.position.z - v.pos.z));
    if (free[0]) this.addCop(free[0], false);
  }
  updChase(dt, v) {
    const G = this.G, ch = this.chase;
    ch.t += dt;
    if (ch.t > 18 && ch.stars < 2) { ch.stars = 2; this.nextCop(v); G.hud.toast('Two stars: more cruisers on the way', 2); }
    if (ch.t > 40 && ch.stars < 3) { ch.stars = 3; this.nextCop(v); this.heli.visible = true; this.heli.position.set(v.pos.x - 220, 90, v.pos.z - 120); G.hud.toast('Three stars: a helicopter joins the chase', 2.2); }
    const ps = Math.abs(v.speed);
    let nearest = 1e9;
    ch.cops.forEach((c, i) => {
      const gap = 16 + i * 11;
      const target = this.D - gap;
      c.sp = THREE.MathUtils.clamp((target - c.s) * 1.2 + ps * 0.9, 0, COP_MAX);
      c.s = Math.min(target, c.s + c.sp * dt);
      if (this.trail.length && c.s < this.trail[0].d) c.s = this.trail[0].d;
      const p = this.trailAt(c.s);
      if (!p) return;
      let x = p.x, z = p.z, y = p.y, h = p.h;
      if (c.join < 1) {
        c.join = Math.min(1, c.join + dt / c.joinT);
        const k = THREE.MathUtils.smoothstep(c.join, 0, 1);
        x = c.from.x + (p.x - c.from.x) * k; z = c.from.z + (p.z - c.from.z) * k; y = c.from.y + (p.y + 0.05 - c.from.y) * k;
        const mh = Math.atan2(-(p.z - c.from.z), p.x - c.from.x);
        h = k < 0.85 ? mh : p.h;
      }
      c.m.position.set(x, y + 0.05, z);
      let dh = h - c.m.rotation.y; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      c.m.rotation.y += dh * Math.min(1, dt * 6);
      nearest = Math.min(nearest, this.D - c.s);
    });
    // helicopter circles overhead with its searchlight on you
    if (this.heli.visible) {
      const h = this.heli, ang = G.time * 0.35;
      h.position.lerp(new THREE.Vector3(v.pos.x + Math.cos(ang) * 30, 60, v.pos.z + Math.sin(ang) * 30), Math.min(1, dt * 0.9));
      h.lookAt(v.pos.x, h.position.y, v.pos.z); h.rotateY(-Math.PI / 2);
      h.userData.rotor.rotation.y += dt * 30; h.userData.tail.rotation.z += dt * 40;
      const cone = h.userData.cone;
      h.updateMatrixWorld();
      const dir = h.worldToLocal(new THREE.Vector3(v.pos.x, v.y, v.pos.z)).sub(cone.position);
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.clone().normalize());
      cone.scale.set(1, dir.length() / 60, 1);
    }
    // stopped with a cruiser right behind: a warning, and everyone goes home
    ch.stillT = ps < 1 ? ch.stillT + dt : 0;
    if (ch.stillT > 1.8 && nearest < 50) {
      const tk = ch.mph ? `${ch.mph} in a ${ch.lim}. ` : '';
      chime('good');
      this.stop(false, `Pulled over. ${tk}The officer lets you off with a warning. Happy birthday.`);
      return;
    }
    // far enough ahead for long enough: you lost them
    ch.lostT = nearest > 320 ? ch.lostT + dt : Math.max(0, ch.lostT - dt * 2);
    const need = this.heli.visible ? 10 : 5;
    if (ch.lostT > need) { this.escapes++; chime('win'); this.stop(false, `You lost them! Escapes: ${this.escapes}`); return; }
    $('wanted').innerHTML = '<span>' + '★'.repeat(ch.stars) + '<i>' + '★'.repeat(3 - ch.stars) + '</i></span><small>' +
      (ch.lostT > 0.5 ? 'Losing them... ' + Math.ceil(need - ch.lostT) : nearest < 60 ? 'Pull over (stop) or lose them' : 'Keep going to lose them') + '</small>';
  }
  stop(quiet, msg) {
    const ch = this.chase;
    if (!ch) return;
    this.chase = null;
    for (const c of ch.cops) {
      this.setLights(c.m, false);
      if (c.trap) { c.chase = false; c.m.position.set(c.home.x, 0.05, c.home.z); c.m.rotation.y = c.home.h; }
      else { c.chase = false; c.way = -1; c.m.visible = false; }
    }
    this.heli.visible = false;
    setSiren(false);
    this.cooldown = 12;
    $('wanted').style.display = 'none';
    if (!quiet && msg) this.G.hud.toast(msg, 3.5);
  }
}
