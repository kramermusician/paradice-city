// Vehicles: arcade car physics, boat physics, and the articulated cranberry truck.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { makePinwheel, makeTractor, makeTrailer, makeCrate, makeJetpackPilot, makeFighterJet, makeHelicopter } from './models.js';

const loader = new GLTFLoader();
const cache = new Map();
const WATER_Y = -0.35;

export async function loadModel(def) {
  if (!def.file) return null;
  if (!cache.has(def.file)) cache.set(def.file, loader.loadAsync(def.file).then((g) => {
    g.scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = false;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (m && m.envMapIntensity !== undefined) m.envMapIntensity = 1.0;
          // No reflection map (broken in some Safari builds): metal with nothing to reflect is black.
          if (m && window.G && G.envBroken && m.metalness > 0.35) { m.metalness = 0.35; m.roughness = Math.max(m.roughness, 0.35); }
        }
      }
    });
    if (window.G && G.fixMaterials) G.fixMaterials(g.scene);   // Safari: lambert/standard car materials (main.js)
    return g.scene;
  }));
  const src = await cache.get(def.file);
  return src.clone(true);
}

// Find the roof height at a local x along the car's center line (for the pinwheel).
function roofAt(model, x, maxY) {
  const rc = new THREE.Raycaster(new THREE.Vector3(x, maxY + 2, 0), new THREE.Vector3(0, -1, 0));
  model.updateMatrixWorld(true);
  const hits = rc.intersectObject(model, true);
  return hits.length ? hits[0].point.y : maxY;
}

class Vehicle {
  constructor(def) {
    this.def = def;
    this.kind = def.kind;
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector2(); // world x, z
    this.heading = 0;
    this.y = 0;
    this.steer = 0;
    this.pitch = 0; this.roll = 0;
    this.speed = 0; // signed forward speed m/s
    this.top = def.top / 2.23694;
    this.accel = def.accel;
    this.grip = def.grip;
    this.events = [];
    this.lastRoad = null;
    this.prevSpeed = 0;
    this.decel = 0;
    this.t = 0;
  }
  fwd() { return [Math.cos(this.heading), -Math.sin(this.heading)]; }
  side() { return [Math.sin(this.heading), Math.cos(this.heading)]; }
  place(x, z, heading, y = 0) {
    this.pos.set(x, y, z); this.y = y; this.heading = heading; this.vel.set(0, 0); this.speed = 0; this.steer = 0;
    this.sync();
  }
  sync() {
    this.root.position.set(this.pos.x, this.y, this.pos.z);
    this.root.rotation.set(0, this.heading, 0);
    this.body.rotation.set(this.roll, 0, this.pitch, 'YXZ');
    this.body.rotation.order = 'YXZ';
  }
  spinPinwheel(dt) {
    if (this.pin) this.pin.userData.hub.rotation.x += dt * (2 + Math.abs(this.speed) * 1.6);
  }
  emit(type, data = {}) { this.events.push({ type, ...data }); }
}

// A plain cockpit seen from the driver's eyes at the origin: dash, steering wheel, hood, windshield frame.
// +X is forward, +Z is the passenger side; mid is how far the car's center line is from the driver.
function makeCockpit(wid, mid, paint) {
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x17171b, roughness: 0.85 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x2c2c33, roughness: 0.6 });
  const body = new THREE.MeshStandardMaterial({ color: paint, roughness: 0.3, metalness: 0.75 });
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  add(new THREE.BoxGeometry(0.5, 0.2, wid * 0.96), dark, 0.95, -0.5, mid);                 // dash
  add(new THREE.BoxGeometry(0.25, 0.07, 0.36), trim, 0.85, -0.38, 0);                         // gauge hood
  const hood = add(new THREE.BoxGeometry(1.7, 0.05, wid * 0.84), body, 2.05, -0.5, mid);     // hood
  hood.rotation.z = -0.05;
  add(new THREE.BoxGeometry(0.08, 0.07, wid * 0.96), dark, 0.75, 0.47, mid);                 // windshield header
  add(new THREE.BoxGeometry(0.03, 0.055, 0.2), trim, 0.75, 0.39, mid);                        // mirror
  for (const s of [-1, 1]) {                                                                 // A-pillars
    const p = add(new THREE.BoxGeometry(0.045, 1.1, 0.045), dark, 0.86, 0.0, mid + s * wid * 0.48);
    p.rotation.z = 0.5;
  }
  const col = new THREE.Group(); col.position.set(0.66, -0.36, 0); col.rotation.z = -0.35;    // steering column, tilted back
  const wheel = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.016, 8, 28), dark); rim.rotation.y = Math.PI / 2;
  const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.33), trim);
  const spoke2 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.165, 0.03), trim); spoke2.position.y = -0.082;
  wheel.add(rim, spoke, spoke2); col.add(wheel); g.add(col);
  g.userData.wheel = wheel;
  return g;
}

// ------------------------------------------------------------------------- car
export class Car extends Vehicle {
  async init() {
    const model = await loadModel(this.def);
    const bb = new THREE.Box3().setFromObject(model);
    this.len = bb.max.x - bb.min.x; this.wid = bb.max.z - bb.min.z; this.hgt = bb.max.y;
    model.position.y = -bb.min.y;
    this.body.add(model);
    this.model = model;
    const px = bb.min.x + this.len * 0.27;
    this.pin = makePinwheel();
    this.pin.position.set(px, roofAt(model, px, bb.max.y) - 0.02 - bb.min.y, -this.wid * 0.12);
    this.pin.scale.setScalar(1.1);
    this.body.add(this.pin);
    this.hood = new THREE.Vector3(bb.max.x * 0.15, this.hgt * 0.82, 0);
    // driver's eyes: left seat, a little behind the middle of the car. The scanned and decimated
    // models have no clean cabin, so the driver view hides the body and shows this simple cockpit.
    this.seat = new THREE.Vector3(bb.max.x - this.len * 0.52, (this.hgt - bb.min.y) * 0.8, -this.wid * 0.2);
    this.cockpit = makeCockpit(this.wid, -this.seat.z, /black/.test(this.def.note || '') ? 0x1b1b1f : 0xb9bdc4);
    this.cockpit.position.copy(this.seat);
    this.cockpit.visible = false;
    this.body.add(this.cockpit);
    this.wheelbase = this.len * 0.6;
    return this;
  }
  corners(x, z, h, shrink = 0.9) {
    const c = Math.cos(h), s = Math.sin(h), hl = this.len / 2 * shrink, hw = this.wid / 2 * shrink;
    return [[hl, hw], [hl, -hw], [-hl, hw], [-hl, -hw], [hl, 0], [-hl, 0]].map(([lx, lz]) => [x + lx * c + lz * s, z - lx * s + lz * c]);
  }
  // How far into a wall, railing or building a pose is: 0 means clear. Counted per corner so a
  // car already wedged into a railing can still move as long as the move does not make it worse.
  penetration(world, x, z, h) {
    let n = 0;
    for (const [cx, cz] of this.corners(x, z, h)) {
      if (this.y < 3 && world.buildingAt(cx, cz)) n++;
      if (!world.inBounds(cx, cz)) n += 100;
    }
    if (this.y > 1.4) {
      const r = world.roadAt(x, z, this.y);
      if (!r || Math.abs(r.y - this.y) > 1.6) n += 10;
      // keep the whole body on the deck
      for (const [cx, cz] of this.corners(x, z, h, 0.8).slice(0, 4)) {
        const rc = world.roadAt(cx, cz, this.y);
        if (!rc || Math.abs(rc.y - this.y) > 2.0) n++;
      }
    }
    return n;
  }
  blocked(world, x, z, h) {
    for (const [cx, cz] of this.corners(x, z, h)) {
      if (this.y < 3 && world.buildingAt(cx, cz)) return 'building';
      if (!world.inBounds(cx, cz)) return 'edge';
    }
    if (this.y > 1.4) {
      const r = world.roadAt(x, z, this.y);
      if (!r || Math.abs(r.y - this.y) > 1.6) return 'rail';
      // keep the whole body on the deck
      for (const [cx, cz] of this.corners(x, z, h, 0.8).slice(0, 4)) {
        const rc = world.roadAt(cx, cz, this.y);
        if (!rc || Math.abs(rc.y - this.y) > 2.0) return 'rail';
      }
    }
    return null;
  }
  // Pinned against a railing, wall or building for a moment with the player still pressing keys:
  // slide back to the middle of the lane, squared up with the road, so the car can always drive off.
  unwedge(world, dt) {
    const wrap = (q) => Math.atan2(Math.sin(q), Math.cos(q));
    let r = world.roadAt(this.pos.x, this.pos.z, this.y);
    let tx, tz, dir;
    if (r) { tx = r.cx; tz = r.cz; dir = r.dir; }
    else {
      const n = world.nearestRoadPoint(this.pos.x, this.pos.z, this.y < 1.4 ? { ground: true } : {});
      if (!n || n.dist > 80) return;
      tx = n.x; tz = n.z; dir = n.heading;
    }
    let d = wrap(dir - this.heading);
    if (Math.abs(d) > Math.PI / 2) d = wrap(d + Math.PI);
    const k = Math.min(1, dt * 4);
    this.pos.x += (tx - this.pos.x) * k; this.pos.z += (tz - this.pos.z) * k;
    this.heading += d * k;
    this.vel.set(0, 0); this.speed = 0;
    return Math.hypot(tx - this.pos.x, tz - this.pos.z) < 0.3 && Math.abs(d) < 0.05;
  }
  update(dt, inp, world) {
    this.t += dt;
    let [fx, fz] = this.fwd();
    let vf = this.vel.x * fx + this.vel.y * fz;
    const sp = Math.abs(vf);
    // steering, speed sensitive
    const maxSteer = 0.58 / (1 + sp / 8);
    this.steer += (inp.steer * maxSteer - this.steer) * Math.min(1, dt * 7);
    let yaw = vf * Math.tan(this.steer) / this.wheelbase;
    if (inp.handbrake && sp > 4) yaw *= 1.55;
    this.heading += yaw * dt;
    [fx, fz] = this.fwd();
    const [sx, sz] = this.side();
    vf = this.vel.x * fx + this.vel.y * fz;
    let vl = this.vel.x * sx + this.vel.y * sz;
    const offroad = !this.lastRoad;
    // engine and brakes
    if (inp.throttle > 0) {
      if (vf < -0.5) vf += 14 * inp.throttle * dt;
      else vf += this.accel * inp.throttle * Math.max(0, 1 - (vf / this.top) ** 2) * dt * (offroad ? 0.7 : 1);
    }
    if (inp.brake > 0) {
      if (vf > 0.6) vf -= 13 * inp.brake * dt;
      else vf -= 5 * inp.brake * dt;
      vf = Math.max(vf, -9);
    }
    if (inp.handbrake) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 5 * dt);
    if (!inp.throttle && !inp.brake) vf -= Math.sign(vf) * Math.min(Math.abs(vf), (0.6 + vf * vf * 0.0012) * dt);
    if (offroad) vf -= Math.sign(vf) * Math.min(Math.abs(vf), vf * vf * 0.004 * dt);
    const grip = inp.handbrake ? 1.3 : this.grip * (sp > 30 ? 0.8 : 1);
    vl *= Math.exp(-grip * dt);
    this.vel.set(fx * vf + sx * vl, fz * vf + sz * vl);
    this.decel = (this.prevSpeed - vf) / Math.max(dt, 1e-3);
    this.prevSpeed = vf;
    this.speed = vf;
    this.drift = Math.abs(vl);

    // move with collisions
    const nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.y * dt;
    let why = this.blocked(world, nx, nz, this.heading);
    if (why) {
      // already into the wall here? then any move that does not dig in deeper is allowed,
      // otherwise the car freezes against the railing with no way out
      const here = this.penetration(world, this.pos.x, this.pos.z, this.heading);
      if (here > 0) {
        if (this.penetration(world, nx, nz, this.heading) <= here) why = null;
      }
    }
    if (why) {
      const impact = this.vel.length();
      if (why === 'rail') {
        // slide along the railing: keep only the along-road part
        const r = world.roadAt(this.pos.x, this.pos.z, this.y);
        if (r) {
          const dx = Math.cos(r.dir), dz = -Math.sin(r.dir);
          const along = this.vel.x * dx + this.vel.y * dz;
          this.vel.set(dx * along * 0.8, dz * along * 0.8);
        } else this.vel.multiplyScalar(-0.2);
      } else {
        this.vel.multiplyScalar(-0.25);
      }
      if (impact > 3) this.emit('crash', { impact });
    } else {
      this.pos.x = nx; this.pos.z = nz;
    }
    // stuck detector: blocked while the player keeps trying to drive
    const trying = inp.throttle || inp.brake;
    if (this.rescuing > 0) { this.rescuing -= dt; if (this.unwedge(world, dt) !== false) this.rescuing = 0; }
    else if (why && trying) { this.pinnedT = (this.pinnedT || 0) + dt; if (this.pinnedT > 1.0) { this.rescuing = 1.2; this.pinnedT = 0; } }
    else this.pinnedT = Math.max(0, (this.pinnedT || 0) - dt * 2);
    this.afterMove(dt, world);
  }
  afterMove(dt, world) {
    // height from roads and bridges
    const r = world.roadAt(this.pos.x, this.pos.z, this.y);
    this.lastRoad = r ? r.road : null;
    let ty;
    if (r) ty = r.y;
    else if (world.isLand(this.pos.x, this.pos.z)) ty = 0;
    else if (this.y < 1.2) { this.emit('water'); ty = this.y; }
    else ty = this.y;
    // On a deck or a ramp the wheels ride the surface exactly; the old lag let the car sink up to 0.3 m
    // into a climbing bridge and float over a falling one, which read as a glitch (bridges.cjs).
    if (r && Math.abs(ty - this.y) < 1.2) this.y = ty;
    else if (ty < this.y - 0.5) this.y = Math.max(ty, this.y - 9.8 * dt * 2); else this.y += (ty - this.y) * Math.min(1, dt * 15);
    // pitch from slope plus a little from accel, roll from cornering
    const [fx, fz] = this.fwd();
    const hl = this.len * 0.45;
    const rf = world.roadAt(this.pos.x + fx * hl, this.pos.z + fz * hl, this.y);
    const rb = world.roadAt(this.pos.x - fx * hl, this.pos.z - fz * hl, this.y);
    // slope only from the same deck the car is on (a lookup can land on the road under the bridge), clamped
    let slope = (rf && rb && Math.abs(rf.y - this.y) < 1.5 && Math.abs(rb.y - this.y) < 1.5) ? Math.atan2(rf.y - rb.y, hl * 2) : (this.slopeHeld || 0);
    slope = THREE.MathUtils.clamp(slope, -0.15, 0.15);
    this.slopeHeld = slope;
    const accPitch = THREE.MathUtils.clamp(-this.decel * 0.004, -0.04, 0.04);
    this.accPitchS = (this.accPitchS || 0) + (accPitch - (this.accPitchS || 0)) * Math.min(1, dt * 3);
    this.pitch += (slope + this.accPitchS - this.pitch) * Math.min(1, dt * 5);
    const latAcc = this.speed * this.steer;
    this.roll += (THREE.MathUtils.clamp(-latAcc * 0.004, -0.06, 0.06) - this.roll) * Math.min(1, dt * 6);
    this.pos.y = this.y;
    this.spinPinwheel(dt);
    if (this.cockpit) this.cockpit.userData.wheel.rotation.x = -this.steer * 4.5;
    this.sync();
  }
}

// ------------------------------------------------------------------------- boat
export class Boat extends Vehicle {
  async init() {
    const model = await loadModel(this.def);
    this.body.add(model);
    this.model = model;
    const bb = new THREE.Box3().setFromObject(model);
    this.len = 6.6; this.wid = 2.4; this.hgt = bb.max.y;
    this.prop = model.getObjectByName('prop');
    const b = this.def.boat;
    if (b) {
      // a small craft from the Dropbox set (jet ski): sits a little lower in the water than Dad's hull
      this.len = b.len; this.wid = b.wid;
      model.position.y = 0.12;
      this.pin = makePinwheel();
      this.pin.position.set(...b.pin); this.pin.scale.setScalar(0.7);
      this.body.add(this.pin);
      this.hood = new THREE.Vector3(...b.seat);
      this.seat = this.hood;
      this.trim = 0; this.wakeT = 0;
      return this;
    }
    const canopy = model.getObjectByName('canopy');
    let top = 2.75;
    if (canopy) { const cb = new THREE.Box3().setFromObject(canopy); top = cb.max.y; }
    this.pin = makePinwheel();
    this.pin.position.set(-0.4, top - 0.02, 0.45);
    // Suzanne's Grady-White (2026-11-15) marks the pinwheel spot and the standing helm eye with empties
    const pm = model.getObjectByName('pin_mount'), eye = model.getObjectByName('driver_eye');
    model.updateMatrixWorld(true);
    if (pm) this.pin.position.copy(model.worldToLocal(pm.getWorldPosition(new THREE.Vector3())));
    this.body.add(this.pin);
    this.hood = eye ? model.worldToLocal(eye.getWorldPosition(new THREE.Vector3())) : new THREE.Vector3(-0.6, 2.1, 0);
    this.ladder = model.getObjectByName('ladder');
    this.seat = this.hood;
    this.trim = 0;
    this.wakeT = 0;
    return this;
  }
  update(dt, inp, world, fx_) {
    this.t += dt;
    let [fx, fz] = this.fwd();
    let vf = this.vel.x * fx + this.vel.y * fz;
    const sp = Math.abs(vf);
    const turn = inp.steer * 0.85 * Math.min(1, sp / 3 + 0.15) / (1 + sp / 22);
    this.steer += (turn - this.steer) * Math.min(1, dt * 3);
    this.heading += this.steer * dt * Math.sign(vf || 1);
    [fx, fz] = this.fwd();
    const [sx, sz] = this.side();
    vf = this.vel.x * fx + this.vel.y * fz;
    let vl = this.vel.x * sx + this.vel.y * sz;
    const plane = THREE.MathUtils.smoothstep(sp, 6, 13);
    if (inp.throttle > 0) vf += this.accel * inp.throttle * Math.max(0, 1 - (vf / this.top) ** 2) * (0.75 + 0.5 * plane) * dt;
    if (inp.brake > 0) { if (vf > 0.3) vf -= 4 * inp.brake * dt; else vf = Math.max(-4, vf - 2 * inp.brake * dt); }
    // water drag: heavy when off plane
    vf -= Math.sign(vf) * Math.min(Math.abs(vf), (0.25 + (1 - plane) * 0.04 * vf * vf + 0.001 * vf * vf) * dt * (inp.throttle ? 0.6 : 1.4));
    vl *= Math.exp(-this.grip * dt);
    this.vel.set(fx * vf + sx * vl, fz * vf + sz * vl);
    this.speed = vf;

    // shoreline: stop at the land, slide along it
    let nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.y * dt;
    const bowX = nx + fx * 3.0, bowZ = nz + fz * 3.0, sternX = nx - fx * 3.0, sternZ = nz - fz * 3.0;
    const hit = world.isLand(bowX, bowZ) ? [bowX, bowZ] : world.isLand(nx, nz) ? [nx, nz] : world.isLand(sternX, sternZ) ? [sternX, sternZ] : null;
    if (hit) {
      const [ux, uz] = world.shoreNormal(hit[0], hit[1]);
      const into = this.vel.x * ux + this.vel.y * uz;
      if (into < 0) this.vel.set(this.vel.x - ux * into * 1.2, this.vel.y - uz * into * 1.2);
      this.vel.multiplyScalar(0.96);
      nx = this.pos.x + this.vel.x * dt; nz = this.pos.z + this.vel.y * dt;
      if (world.isLand(nx + fx * 2.6, nz + fz * 2.6) || world.isLand(nx, nz)) { nx = this.pos.x + ux * 0.3; nz = this.pos.z + uz * 0.3; }
      if (Math.abs(into) > 4) this.emit('bump', { impact: Math.abs(into) });
    }
    this.pos.x = nx; this.pos.z = nz;

    // trim: the bow rises with throttle, then settles when on plane or slowing
    const hump = (inp.throttle || 0) * (1 - plane) * THREE.MathUtils.smoothstep(sp, 0.8, 5);
    const target = hump * 0.17 + plane * 0.045 * (inp.throttle ? 1 : 0.4) - (inp.brake && sp > 4 ? 0.03 : 0);
    this.trim += (target - this.trim) * Math.min(1, dt * (target > this.trim ? 1.6 : 1.0));
    const bobAmp = 1 - plane * 0.6;
    const bob = (Math.sin(this.t * 1.3) * 0.07 + Math.sin(this.t * 0.73 + 1.1) * 0.05) * bobAmp;
    this.y = WATER_Y + bob + plane * 0.12 + 0.04;
    this.pitch = this.trim + Math.sin(this.t * 1.1 + 0.4) * 0.018 * bobAmp;
    this.roll = Math.sin(this.t * 0.9) * 0.035 * bobAmp - this.steer * 0.12 * Math.min(1, sp / 8);
    if (this.ladder) this.ladder.visible = sp < 2;   // the stern ladder is down only when drifting or tied up
    if (this.prop) this.prop.rotation.x += dt * (6 + (inp.throttle || 0) * 60 + sp * 2) * Math.sign(vf || 1);
    this.pos.y = this.y;
    this.spinPinwheel(dt);
    this.sync();

    // wake and spray
    const fxp = fx_;
    if (fxp && sp > 1) {
      this.wakeT += dt;
      const every = 0.05;
      while (this.wakeT > every) {
        this.wakeT -= every;
        for (const s of [-1, 1]) {
          const ox = this.pos.x - fx * 3.2 + sx * s * 0.9, oz = this.pos.z - fz * 3.2 + sz * s * 0.9;
          const out = 0.9 + sp * 0.12;
          fxp.wake.emit(ox, WATER_Y + 0.05, oz, sx * s * out - fx * 0.5, 0, sz * s * out - fz * 0.5, { life: 3.5 + plane * 3, s0: 0.6, s1: 3.0 + sp * 0.1, alpha: 0.32 });
        }
        fxp.wake.emit(this.pos.x - fx * 3.6, WATER_Y + 0.06, this.pos.z - fz * 3.6, -fx * 0.6, 0, -fz * 0.6, { life: 2.5 + plane * 3, s0: 1.0, s1: 2.6, alpha: 0.3 });
        if (sp > 4) {
          for (const s of [-1, 1]) {
            const k = 0.4 + Math.random() * 0.6;
            fxp.spray.emit(this.pos.x + fx * (1.2 - plane * 1.2) + sx * s * 1.1, WATER_Y + 0.3, this.pos.z + fz * (1.2 - plane * 1.2) + sz * s * 1.1,
              sx * s * (2 + sp * 0.18) * k + this.vel.x * 0.4, 1.5 + sp * 0.12 * k, sz * s * (2 + sp * 0.18) * k + this.vel.y * 0.4,
              { life: 0.9, s0: 0.25, s1: 0.7, grav: 9.8, alpha: 0.75 });
          }
        }
      }
    }
  }
}

// ------------------------------------------------------------------------- truck
export class Truck extends Car {
  async init() {
    const tractor = makeTractor();
    this.body.add(tractor);
    this.model = tractor;
    this.len = 7.0; this.wid = 2.5; this.hgt = 3.9;
    this.wheelbase = 4.6;
    this.pin = makePinwheel();
    this.pin.position.set(-1.6, 3.2, 0.6);
    this.pin.scale.setScalar(1.6);
    this.body.add(this.pin);
    this.hood = new THREE.Vector3(1.0, 3.0, 0.3);
    this.seat = new THREE.Vector3(1.52, 2.9, -0.55); // just ahead of the windshield glass, driver's side
    this.hitchX = tractor.userData.hitch;
    this.trailer = makeTrailer();
    this.trailerRoot = new THREE.Group();
    this.trailerBody = new THREE.Group();
    this.trailerRoot.add(this.trailerBody);
    this.trailerBody.add(this.trailer);
    this.tLen = this.trailer.userData.length;
    this.axle = this.tLen - 2.0;
    this.tHeading = 0;
    this.crates = this.trailer.userData.slots.length;
    this.maxCrates = this.crates;
    this.flying = [];
    return this;
  }
  setCrates(n) { this.crates = n; this.trailer.userData.setCount(n); }
  place(x, z, heading, y = 0) {
    super.place(x, z, heading, y);
    this.tHeading = heading;
    this.syncTrailer(null, 0);
  }
  kingpin() { const [fx, fz] = this.fwd(); return [this.pos.x + fx * this.hitchX, this.pos.z + fz * this.hitchX]; }
  trailerCorners(h = this.tHeading) {
    const [kx, kz] = this.kingpin();
    const c = Math.cos(h), s = Math.sin(h), hw = 1.15;
    return [[-this.tLen + 0.3, hw], [-this.tLen + 0.3, -hw], [-this.tLen * 0.5, hw], [-this.tLen * 0.5, -hw]].map(([lx, lz]) => [kx + lx * c + lz * s, kz - lx * s + lz * c]);
  }
  update(dt, inp, world) {
    const prev = [this.pos.x, this.pos.z, this.heading, this.tHeading];
    // where the trailer axle sits before the tractor moves: the trailer pivots around it
    const [k0x, k0z] = this.kingpin();
    const ax = k0x - Math.cos(this.tHeading) * this.axle, az = k0z + Math.sin(this.tHeading) * this.axle;
    super.update(dt, inp, world);
    // the kingpin has moved with the tractor; the trailer now points from its old axle spot to it
    const [kx, kz] = this.kingpin();
    let th = Math.atan2(-(kz - az), kx - ax);
    const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    if (this.speed < -0.2) {
      // backing up: a real trailer jackknifes fast, so swing it at under half speed and ease it
      // back in line with the tractor. Keeps the dock doable without a trucking license.
      th = prev[3] + wrap(th - prev[3]) * 0.45;
      th = this.heading + wrap(th - this.heading) * Math.exp(-dt * 0.5);
    }
    let rel = wrap(th - this.heading);
    rel = THREE.MathUtils.clamp(rel, -1.35, 1.35);
    th = this.heading + rel;
    // trailer hitting a building stops the rig
    let hit = false;
    const c = this.trailerCorners(th);
    for (const [cx, cz] of c) if (world.buildingAt(cx, cz)) { hit = true; break; }
    if (hit) {
      this.pos.x = prev[0]; this.pos.z = prev[1]; this.heading = prev[2]; th = prev[3];
      const impact = this.vel.length();
      this.vel.multiplyScalar(-0.15);
      if (impact > 2) this.emit('crash', { impact });
      this.sync();
    }
    this.tHeading = th;
    this.syncTrailer(world, dt);
    this.updateFlying(dt, world);
  }
  syncTrailer(world, dt) {
    const [kx, kz] = this.kingpin();
    let y0 = this.y, y1 = this.y;
    if (world) {
      const rx = kx - Math.cos(this.tHeading) * this.tLen * 0.85, rz = kz + Math.sin(this.tHeading) * this.tLen * 0.85;
      const r = world.roadAt(rx, rz, this.y);
      y1 = r ? r.y : (world.isLand(rx, rz) ? 0 : this.y);
    }
    this.trailerRoot.position.set(kx, y0, kz);
    this.trailerRoot.rotation.set(0, this.tHeading, 0);
    this.trailerBody.rotation.set(0, 0, Math.atan2(y0 - y1, this.tLen * 0.85));
  }
  spill(n, world) {
    for (let i = 0; i < n && this.crates > 0; i++) {
      const slot = this.trailer.userData.slots[this.crates - 1];
      this.setCrates(this.crates - 1);
      const p = slot.clone().applyMatrix4(this.trailer.matrixWorld);
      const m = makeCrate(1.1);
      m.position.copy(p);
      this.root.parent.add(m);
      const side = Math.random() < 0.5 ? -1 : 1;
      const s = Math.sin(this.tHeading), c = Math.cos(this.tHeading);
      this.flying.push({ m, v: new THREE.Vector3(s * side * (3 + Math.random() * 3) + this.vel.x * 0.6, 4 + Math.random() * 3, c * side * (3 + Math.random() * 3) + this.vel.y * 0.6), spin: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6), t: 0 });
    }
  }
  updateFlying(dt, world) {
    for (const f of this.flying) {
      f.t += dt;
      if (f.rest) continue;
      f.v.y -= 9.8 * dt;
      f.m.position.addScaledVector(f.v, dt);
      f.m.rotation.x += f.spin.x * dt; f.m.rotation.y += f.spin.y * dt; f.m.rotation.z += f.spin.z * dt;
      const r = world.roadAt(f.m.position.x, f.m.position.z, f.m.position.y);
      const gy = r ? r.y : (world.isLand(f.m.position.x, f.m.position.z) ? 0 : WATER_Y - 0.2);
      if (f.m.position.y < gy + 0.45) { f.m.position.y = gy + 0.45; f.rest = true; f.m.rotation.x = 0; f.m.rotation.z = 0; }
    }
    this.flying = this.flying.filter((f) => { if (f.t > 40) { f.m.removeFromParent(); return false; } return true; });
  }
  clearFlying() { for (const f of this.flying) f.m.removeFromParent(); this.flying = []; }
}

// ------------------------------------------------------------------------- flying: jetpack, helicopter, fighter jet
// kind 'air', def.fly says which. Arcade flight: Space climbs, Shift descends (jet: Space pulls up,
// Shift dives), W/S throttle, A/D turn. You can land on roads, ground and rooftops; the jet bounces
// back up off anything it hits ("Pull up!") instead of crashing. Unarmed, like everything else.
const MAX_ALT = 600;
export class Flyer extends Vehicle {
  async init() {
    const f = this.fly = this.def.fly;
    let model;
    if (f === 'jet') model = makeFighterJet();
    else if (f === 'heli') { model = makeHelicopter({ color: 0xf4f4f4, stripe: 0xff7a45, spot: false }); model.position.y = 1.68; model.scale.setScalar(0.85); model.position.y = 1.43; }
    else model = makeJetpackPilot();
    this.body.add(model);
    this.model = model;
    this.ud = model.userData;
    const bb = new THREE.Box3().setFromObject(model);
    this.len = bb.max.x - bb.min.x; this.wid = bb.max.z - bb.min.z; this.hgt = bb.max.y;
    this.pin = makePinwheel();
    if (f === 'jet') { this.pin.position.copy(this.ud.tailTop); this.pin.scale.setScalar(2.2); }
    else if (f === 'heli') { this.pin.position.set(-5.9, 2.5, 0.2); this.pin.scale.setScalar(1.5); }
    else { this.pin.position.copy(this.ud.packTop); this.pin.scale.setScalar(0.8); }
    this.body.add(this.pin);
    // the driver view hides the body: first-person flying
    this.cockpit = new THREE.Group(); this.cockpit.visible = false; this.body.add(this.cockpit);
    this.seat = f === 'jet' ? new THREE.Vector3(4.6, 2.9, 0) : f === 'heli' ? new THREE.Vector3(1.4, 1.9, -0.35) : new THREE.Vector3(0.25, 1.7, 0);
    this.hood = this.seat;
    this.vy = 0; this.gamma = 0; this.bank = 0; this.thrust = 0; this.grounded = true; this.pullUpT = 0;
    this.radius = f === 'jet' ? 5 : f === 'heli' ? 4 : 0.6;
    return this;
  }
  place(x, z, heading, y = 0) {
    super.place(x, z, heading, y);
    this.vy = 0; this.gamma = 0; this.bank = 0; this.thrust = 0;
  }
  // takeoff: start in the air (jet at cruise, the others a few meters up)
  launch(x, z, heading, world) {
    const g = this.groundAt(world, x, z, 999);
    if (this.fly === 'jet') { this.place(x, z, heading, Math.max(g, 0) + 160); this.speed = 75; this.thrust = 0.6; this.vel.set(Math.cos(heading) * 75, -Math.sin(heading) * 75); this.grounded = false; }
    else { this.place(x, z, heading, g + 3); this.grounded = false; }
  }
  groundAt(world, x, z, yRef = this.y) {
    const r = world.roadAt(x, z, yRef);
    let g = r ? r.y : world.isLand(x, z) ? 0 : WATER_Y + 0.25;
    const b = world.buildingAt(x, z);
    if (b) g = Math.max(g, b.h);
    return g;
  }
  update(dt, inp, world, fx_) {
    this.t += dt;
    const f = this.fly, lift = inp.lift || 0;
    let nx, nz;
    if (f === 'jet') {
      const top = this.top, stall = 38;
      this.thrust += ((inp.throttle ? 1 : inp.brake ? 0 : 0.55) - this.thrust) * Math.min(1, dt * 1.2);
      let sp = this.speed;
      let want = inp.brake ? Math.max(this.grounded ? 0 : stall * 0.9, sp - 30 * dt) : top * this.thrust;
      if (this.grounded && !inp.throttle) want = 0; // rolling on the ground: no throttle, it slows to a stop
      sp += (want - sp) * Math.min(1, dt * (inp.brake ? 1.2 : this.grounded && !inp.throttle ? 0.3 : 0.45));
      // bank into the turn; turn rate grows with bank
      this.bank += (inp.steer * 1.1 * (this.grounded ? 0 : 1) - this.bank) * Math.min(1, dt * 3);
      const yaw = this.grounded ? inp.steer * 0.5 * Math.min(1, sp / 8) : inp.steer * 0.75 + this.bank * 0.25;
      this.heading += yaw * dt;
      // climb angle
      let gWant = lift * 0.55;
      if (!this.grounded && sp < stall) gWant = Math.min(gWant, -0.25 * (1 - sp / stall)); // too slow: the nose drops
      if (this.grounded) gWant = (lift > 0 && sp > 42) ? 0.25 : 0;
      this.gamma += (gWant - this.gamma) * Math.min(1, dt * 2.2);
      this.speed = sp;
      const h = Math.cos(this.gamma) * sp;
      this.vel.set(Math.cos(this.heading) * h, -Math.sin(this.heading) * h);
      this.vy = Math.sin(this.gamma) * sp;
      nx = this.pos.x + this.vel.x * dt; nz = this.pos.z + this.vel.y * dt;
      let ny = Math.min(MAX_ALT, this.y + this.vy * dt);
      const g = this.groundAt(world, nx, nz, ny + 3);
      if (ny <= g + 0.05) {
        // a gentle touchdown on a road or flat ground rolls; anything else bounces back up
        const soft = this.vy > -6 && Math.abs(this.bank) < 0.35 && (g - this.y) < 1.5 && world.isLand(nx, nz);
        if (soft) { ny = g; this.grounded = true; this.gamma = Math.max(0, this.gamma); this.vy = 0; }
        else { this.pullUp(g); return this.finish(dt, fx_); }
      } else if (ny > g + 0.6) this.grounded = false;
      this.pos.x = nx; this.pos.z = nz; this.y = ny;
      if (!world.inBounds(nx, nz, 200)) { this.heading += Math.PI * dt * 0.8; }
      this.pitch = this.gamma; this.roll = -this.bank * 0.9;
      const ab = Math.max(0, this.thrust - 0.75) * 4;
      if (this.ud.flame) { this.ud.flame.scale.set(0.4 + this.thrust + ab, 1, 1); this.ud.flame.material.opacity = 0.3 + 0.6 * this.thrust; this.ud.core.scale.set(0.5 + this.thrust, 1, 1); }
      if (this.ud.gear) this.ud.gear.visible = this.y - g < 30;
      return this.finish(dt, fx_);
    }
    // hovering: jetpack and helicopter
    const heli = f === 'heli';
    const top = this.top, acc = heli ? 9 : 12, turn = heli ? 1.25 : 2.4;
    const [fx, fz] = this.fwd();
    let vf = this.vel.x * fx + this.vel.y * fz;
    const [sx, sz] = this.side();
    let vl = this.vel.x * sx + this.vel.y * sz;
    this.steer += (inp.steer - this.steer) * Math.min(1, dt * 5);
    this.heading += this.steer * turn * dt / (1 + Math.abs(vf) / 60);
    if (inp.throttle) vf += acc * inp.throttle * Math.max(0, 1 - (vf / top) ** 2) * dt;
    else if (inp.brake) vf -= acc * inp.brake * dt * (vf > 0 ? 1.4 : 0.6);
    else vf -= Math.sign(vf) * Math.min(Math.abs(vf), (1.2 + Math.abs(vf) * 0.15) * dt);
    vf = Math.max(vf, -top * 0.3);
    vl *= Math.exp(-3 * dt);
    const [hx, hz] = this.fwd();
    this.vel.set(hx * vf + sx * vl, hz * vf + sz * vl);
    this.speed = vf;
    this.vy += ((lift * (heli ? 11 : 9)) - this.vy) * Math.min(1, dt * 2.5);
    nx = this.pos.x + this.vel.x * dt; nz = this.pos.z + this.vel.y * dt;
    let ny = Math.min(MAX_ALT, this.y + this.vy * dt);
    const gHere = this.groundAt(world, this.pos.x, this.pos.z, this.y + 1);
    const gNext = this.groundAt(world, nx, nz, ny + 1);
    if (gNext > ny + 0.8 && gNext > gHere + 1) {
      // a wall (building side): stop and slide off
      const impact = Math.abs(vf);
      this.vel.multiplyScalar(-0.2); this.speed *= -0.2;
      nx = this.pos.x; nz = this.pos.z;
      if (impact > 4) this.emit('crash', { impact });
    }
    const g = this.groundAt(world, nx, nz, ny + 1);
    if (ny <= g) { ny = g; this.vy = Math.max(0, this.vy); }
    if (!world.inBounds(nx, nz, 200)) { nx = this.pos.x; nz = this.pos.z; this.vel.set(0, 0); }
    this.grounded = ny <= g + 0.05;
    this.pos.x = nx; this.pos.z = nz; this.y = ny;
    const lean = heli ? 0.0045 : 0.012;
    this.pitch += (-vf * lean - this.pitch) * Math.min(1, dt * 3);
    this.roll += (-this.steer * Math.min(1, Math.abs(vf) / 15) * (heli ? 0.22 : 0.35) - this.roll) * Math.min(1, dt * 3);
    if (heli) { this.ud.rotor.rotation.y += dt * (this.grounded && !lift ? 14 : 32); this.ud.tail.rotation.z += dt * 40; }
    else for (const fl of this.ud.flames) { const k = this.grounded && !lift && !inp.throttle ? 0.25 : 0.7 + Math.max(0, lift) * 0.6 + (inp.throttle || 0) * 0.3; fl.scale.set(1, k * (0.85 + Math.random() * 0.3), 1); }
    return this.finish(dt, fx_);
  }
  pullUp(g) {
    this.y = g + 25; this.gamma = 0.35; this.vy = 0; this.grounded = false;
    this.speed = Math.max(this.speed, 60);
    this.emit('crash', { impact: 8 });
    this.emit('pullup');
  }
  finish(dt, fx_) {
    this.pos.y = this.y;
    this.spinPinwheel(dt);
    this.sync();
    // thruster or jet wash over water
    if (fx_ && this.y < 12 && !this.grounded && this.t % 0.06 < dt) {
      fx_.spray.emit(this.pos.x + (Math.random() - 0.5) * 2, Math.max(WATER_Y + 0.2, this.y - 2), this.pos.z + (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 3, 0.5, (Math.random() - 0.5) * 3, { life: 0.8, s0: 0.4, s1: 1.4, grav: 2, alpha: 0.35 });
    }
  }
}

export async function createVehicle(def) {
  const V = def.kind === 'boat' ? Boat : def.kind === 'truck' ? Truck : def.kind === 'air' ? Flyer : Car;
  const v = new V(def);
  await v.init();
  return v;
}
