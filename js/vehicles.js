// Vehicles: arcade car physics, boat physics, and the articulated cranberry truck.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { makePinwheel, makeTractor, makeTrailer, makeCrate } from './models.js';

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
        for (const m of mats) if (m && m.envMapIntensity !== undefined) m.envMapIntensity = 1.0;
      }
    });
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
    this.wheelbase = this.len * 0.6;
    return this;
  }
  corners(x, z, h, shrink = 0.9) {
    const c = Math.cos(h), s = Math.sin(h), hl = this.len / 2 * shrink, hw = this.wid / 2 * shrink;
    return [[hl, hw], [hl, -hw], [-hl, hw], [-hl, -hw], [hl, 0], [-hl, 0]].map(([lx, lz]) => [x + lx * c + lz * s, z - lx * s + lz * c]);
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
    const why = this.blocked(world, nx, nz, this.heading);
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
    if (ty < this.y - 0.5) this.y = Math.max(ty, this.y - 9.8 * dt * 2); else this.y += (ty - this.y) * Math.min(1, dt * 15);
    // pitch from slope plus a little from accel, roll from cornering
    const [fx, fz] = this.fwd();
    const hl = this.len * 0.45;
    const rf = world.roadAt(this.pos.x + fx * hl, this.pos.z + fz * hl, this.y);
    const rb = world.roadAt(this.pos.x - fx * hl, this.pos.z - fz * hl, this.y);
    const slope = (rf && rb) ? Math.atan2(rf.y - rb.y, hl * 2) : 0;
    const accPitch = THREE.MathUtils.clamp(-this.decel * 0.004, -0.04, 0.04);
    this.pitch += (slope + accPitch - this.pitch) * Math.min(1, dt * 8);
    const latAcc = this.speed * this.steer;
    this.roll += (THREE.MathUtils.clamp(-latAcc * 0.004, -0.06, 0.06) - this.roll) * Math.min(1, dt * 6);
    this.pos.y = this.y;
    this.spinPinwheel(dt);
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
    const canopy = model.getObjectByName('canopy');
    let top = 2.75;
    if (canopy) { const cb = new THREE.Box3().setFromObject(canopy); top = cb.max.y; }
    this.pin = makePinwheel();
    this.pin.position.set(-0.4, top - 0.02, 0.45);
    this.body.add(this.pin);
    this.hood = new THREE.Vector3(-0.6, 2.1, 0);
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
    super.update(dt, inp, world);
    // trailer follows the kingpin
    const [kx, kz] = this.kingpin();
    let ax = kx - Math.cos(this.tHeading) * this.axle, az = kz + Math.sin(this.tHeading) * this.axle;
    let th = Math.atan2(-(kz - az), kx - ax);
    let rel = Math.atan2(Math.sin(th - this.heading), Math.cos(th - this.heading));
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

export async function createVehicle(def) {
  const V = def.kind === 'boat' ? Boat : def.kind === 'truck' ? Truck : Car;
  const v = new V(def);
  await v.init();
  return v;
}
