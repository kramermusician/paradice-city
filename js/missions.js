// Missions: Sunset Run, Check the Traps, Cranberry Delivery, Cranberry Run.
// Started by driving into a marker (or from the pause menu). Non-violent throughout.
import * as THREE from 'three';
import { xz, PLACES, MPH } from './config.js';
import { mergeGroup, makeMarker, makeBuoy, makeCrate, makeGolfCart, makeCartSign, makeSpeedSign, makePoliceSUV, makeHelicopter, canvasTex } from './models.js';
import { chime, setSiren, setRotor } from './audio.js';

const fmt = (s) => { s = Math.max(0, s); const m = Math.floor(s / 60), ss = Math.floor(s % 60); return m + ':' + String(ss).padStart(2, '0'); };
const P = (pl) => pl.xz ? pl.xz : xz(...pl.ll);

export class Missions {
  constructor(G) {
    this.G = G;
    this.active = null;
    this.carts = [];
  }

  setup() {
    const G = this.G, W = G.world, scene = G.scene;
    // --- key positions
    const gmd = (pl) => W.nearestRoadPoint(...P(pl), { name: 'Gulf of Mexico Drive', ground: true });
    this.sunStart = gmd(PLACES.sunsetStart);
    const np = W.nearestRoadPoint(...P(PLACES.newPass), { name: 'Gulf of Mexico Drive' });
    let crest = null;
    for (const r of W.roads) if (/John Ringling/.test(r.n)) for (let i = 0; i < r.p.length; i += 3) if (!crest || r.p[i + 2] > crest.y) crest = { x: r.p[i], z: r.p[i + 1], y: r.p[i + 2] };
    let npTop = np;
    for (const r of W.roads) if (r.n === 'Gulf of Mexico Drive' && r.b) for (let i = 0; i < r.p.length; i += 3) if (Math.hypot(r.p[i] - np.x, r.p[i + 1] - np.z) < 400 && r.p[i + 2] > (npTop.y || 0)) npTop = { x: r.p[i], z: r.p[i + 1], y: r.p[i + 2] };
    // St. Armands Circle: centroid and radius of the circle road
    let sx = 0, sz = 0, sn = 0;
    for (const r of W.roads) if (/Saint Armands Circle/.test(r.n)) for (let i = 0; i < r.p.length; i += 3) { sx += r.p[i]; sz += r.p[i + 1]; sn++; }
    const [ax, az] = P(PLACES.stArmands);
    this.circle = sn ? { x: sx / sn, z: sz / sn } : { x: ax, z: az };
    let rad = 0; for (const r of W.roads) if (/Saint Armands Circle/.test(r.n)) for (let i = 0; i < r.p.length; i += 3) rad += Math.hypot(r.p[i] - this.circle.x, r.p[i + 1] - this.circle.z) / sn;
    this.circle.r = rad || 90;
    const bay = W.nearestRoadPoint(...P(PLACES.bayfront), { ground: true });
    this.sunsetCps = [
      { x: npTop.x, z: npTop.z, y: npTop.y, r: 25, name: 'New Pass Bridge' },
      { x: this.circle.x, z: this.circle.z, y: 0, r: this.circle.r + 18, name: 'St. Armands Circle' },
      { x: crest.x, z: crest.z, y: crest.y, r: 28, name: 'Ringling Bridge' },
      { x: bay.x, z: bay.z, y: 0, r: 25, name: 'Sarasota bayfront' },
    ];
    // --- start markers
    // the traps mission starts in the canal a little way from Dad's dock, toward open water
    const db = this.G.dockBoat, dad = this.G.dad;
    const dockB = P(PLACES.dockBoat);
    const trapStart = dad ? { x: db.x + dad.ax * 35, z: db.z + dad.az * 35, heading: db.h } : { x: dockB[0] + 45, z: dockB[1] + 10, heading: 0 };
    this.defs = [
      { id: 'sunset', name: 'Sunset Run', need: 'car', color: 0xff8a3d, pos: this.sunStart,
        desc: 'Beat the sunset from Longboat Key over New Pass and the Ringling Bridge to the Sarasota bayfront.' },
      { id: 'traps', name: 'Check the Traps', need: 'boat', color: 0x35c3ff, pos: trapStart,
        desc: 'Take the boat down the bay side of Longboat Key to five soccer-ball buoys and pull each stone crab trap. The last one is off Cutter Lane.' },
      { id: 'delivery', name: 'Cranberry Delivery', need: 'car', color: 0xe0284a, pos: G.warehouse.front,
        desc: 'Carry cranberry crates on the roof from the Sarasota warehouse to St. Armands Circle. Easy on the brakes.' },
      { id: 'run', name: 'Cranberry Run', need: 'land', color: 0xff3355, pos: G.warehouse.side,
        desc: 'Drive the reefer rig to the Longboat Key grocery dock. Obey every speed limit. Watch for golf carts.' },
    ];
    for (const d of this.defs) {
      d.marker = makeMarker(d.color, d.name);
      d.marker.position.set(d.pos.x, (d.pos.y || 0), d.pos.z);
      scene.add(d.marker);
    }
    this.cpMarker = makeMarker(0xffe04d, '');
    this.cpMarker.visible = false;
    scene.add(this.cpMarker);

    // --- buoys
    this.buoys = PLACES.buoys.map((pl) => {
      const [x, z] = W.nearestWater(...P(pl));
      const b = makeBuoy(); b.position.set(x, -0.35, z);
      b.userData.glow.visible = false;
      scene.add(b);
      const cage = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.9), new THREE.MeshLambertMaterial({ color: 0x3a4f3a, wireframe: true }));
      cage.position.set(x + 0.8, -2, z); cage.visible = false; scene.add(cage);
      return { x, z, m: b, cage, pulled: false, t: 0 };
    });

    // --- golf carts and crossing signs near Harbourside and Bay Isles
    const [gx, gz] = P(PLACES.golf);
    const cands = [];
    for (const s of W.segs) {
      const rd = W.roads[s[7]];
      if (!/Bay Isles Parkway|Gulf of Mexico Drive|Harbourside Drive|Longboat Club Road/.test(rd.n)) continue;
      const d = Math.hypot(s[0] - gx, s[1] - gz);
      if (d < 750 && s[2] < 0.3) cands.push({ x: s[0], z: s[1], dir: Math.atan2(-(s[4] - s[1]), s[3] - s[0]), hw: s[6], d, n: rd.n });
    }
    cands.sort((a, b) => a.d - b.d);
    const picked = [];
    for (const c of cands) if (picked.every((p) => Math.hypot(p.x - c.x, p.z - c.z) > 130)) { picked.push(c); if (picked.length >= 6) break; }
    const cartColors = [0xffffff, 0xf3e3a0, 0x9fd3a8, 0xff9f80, 0xbcd4ff, 0xffffff];
    const shirts = [0xd84b6b, 0x3a7bd5, 0x2ea86b, 0xf2a03d, 0x7b4bd8, 0x222222];
    picked.forEach((c, i) => {
      const rx = Math.sin(c.dir), rz = Math.cos(c.dir); // right of the road direction
      const off = c.hw + 4.5;
      const A = new THREE.Vector3(c.x + rx * off, 0, c.z + rz * off), B = new THREE.Vector3(c.x - rx * off, 0, c.z - rz * off);
      const m = mergeGroup(makeGolfCart(cartColors[i], shirts[i]));
      m.position.copy(A);
      scene.add(m);
      this.carts.push({ m, A, B, from: A, to: B, state: 'idle', t: 2 + i * 1.7, v: new THREE.Vector3(), spin: 0 });
      for (const s of [1, -1]) {
        const sg = makeCartSign();
        const fx = Math.cos(c.dir), fz = -Math.sin(c.dir);
        sg.position.set(c.x + rx * s * (c.hw + 2) + fx * 35 * s, 0, c.z + rz * s * (c.hw + 2) + fz * 35 * s);
        sg.rotation.y = c.dir - Math.PI / 2 + (s < 0 ? Math.PI : 0);
        scene.add(sg);
      }
    });

    // --- speed limit signs along the Cranberry Run route
    const routeRe = /Gulf of Mexico Drive|John Ringling|Saint Armands Circle|Bay Isles Parkway|Boulevard of the Presidents/;
    const signs = [];
    for (const r of W.roads) {
      if (!routeRe.test(r.n) || r.b) continue;
      const p = r.p, n = p.length / 3;
      let len = 0; for (let i = 0; i < n - 1; i++) len += Math.hypot(p[i * 3 + 3] - p[i * 3], p[i * 3 + 4] - p[i * 3 + 1]);
      if (len < 120 && !/Bay Isles|Armands/.test(r.n)) continue;
      const k = Math.min(1, n - 1);
      const h = Math.atan2(-(p[k * 3 + 1] - p[1]), p[k * 3] - p[0]);
      const x = p[0] + Math.sin(h) * (r.w / 2 + 1.6), z = p[1] + Math.cos(h) * (r.w / 2 + 1.6);
      if (signs.some(([sx2, sz2, l]) => l === r.limit && Math.hypot(sx2 - x, sz2 - z) < 500)) continue;
      if (W.buildingAt(x, z) || !W.isLand(x, z)) continue;
      signs.push([x, z, r.limit]);
      const sg = makeSpeedSign(r.limit);
      sg.position.set(x, 0, z); sg.rotation.y = h - Math.PI / 2;
      scene.add(sg);
    }

    // --- police and helicopters (hidden until needed)
    this.police = makePoliceSUV(); this.police.visible = false; scene.add(this.police);
    // Lights live in the scene from the start at zero intensity. Adding or showing a light later
    // changes the light count and makes three.js recompile every shader, which froze the game
    // for a second or more when the police or a helicopter showed up.
    this.policeLight = new THREE.PointLight(0xff2020, 0, 30, 1.5); this.policeLight.position.set(0, -500, 0); scene.add(this.policeLight);
    this.heliSpot = new THREE.SpotLight(0xfff1c8, 0, 160, 0.18, 0.5, 1.6); this.heliSpot.position.set(0, -500, 0);
    scene.add(this.heliSpot, this.heliSpot.target);
    this.heliPool = [0, 1, 2].map(() => {
      const h = makeHelicopter();
      const sp = h.userData.spot; sp.target.removeFromParent(); sp.removeFromParent();
      h.visible = false; scene.add(h);
      return h;
    });
    this.helis = [];
    this.trail = [];
  }

  // ------------------------------------------------------------------ helpers
  minimapMarkers() {
    const out = [];
    if (!this.active) {
      for (const d of this.defs) out.push({ x: d.pos.x, z: d.pos.z, color: '#' + d.color.toString(16).padStart(6, '0'), big: true, letter: d.name[0] });
      if (this.G.dadsPlace) out.push({ x: this.G.dadsPlace.x, z: this.G.dadsPlace.z, color: '#ffd34d', letter: 'D' });
    } else {
      const a = this.active;
      if (a.cp) out.push({ x: a.cp.x, z: a.cp.z, color: '#ffe04d', big: true });
      if (a.id === 'traps') for (const b of this.buoys) if (!b.pulled) out.push({ x: b.x, z: b.z, color: '#ffffff' });
      if (a.id === 'run' && a.cp) for (const c of this.carts) out.push({ x: c.m.position.x, z: c.m.position.z, color: '#9fd3a8' });
    }
    return out;
  }
  // where the road arrows should lead right now (null: no arrows)
  navTarget() {
    const a = this.active;
    return a && !a.done && a.cp ? a.cp : null;
  }
  showStartMarkers(on) { for (const d of this.defs) d.marker.visible = on; }
  setCp(cp) {
    if (this.active) this.active.cp = cp;
    this.cpMarker.visible = !!cp;
    if (cp) this.cpMarker.position.set(cp.x, cp.y || 0, cp.z);
    if (cp && cp.r > 40) this.cpMarker.scale.set(3, 1, 3); else this.cpMarker.scale.set(1, 1, 1);
  }
  near(v, p, r) { return Math.hypot(v.pos.x - p.x, v.pos.z - p.z) < r; }

  limitAt(v) {
    const r = v.lastRoad;
    if (!r) return this.lastLimit || 25;
    let lim = r.limit;
    if (this.G.store && r.k === 'service' && Math.hypot(v.pos.x - this.G.store.cx, v.pos.z - this.G.store.cz) < 160) lim = 15;
    this.lastLimit = lim;
    return lim;
  }

  // ------------------------------------------------------------------ start / end
  tryStart(v) {
    if (this.active) return;
    for (const d of this.defs) {
      if (!d.marker.visible || !this.near(v, d.pos, 10)) continue;
      if (Math.abs((d.pos.y || 0) - v.y) > 4) continue;
      const ok = d.need === 'boat' ? v.kind === 'boat' : d.need === 'car' ? v.kind === 'car' : v.kind === 'car' || v.kind === 'truck';
      if (!ok && v.kind === 'air') { if (v.y < 12) this.G.hud.hint(d.name + ' needs ' + (d.need === 'boat' ? 'the boat' : 'one of Dad\'s cars') + '. V changes vehicle.'); continue; }
      if (!ok) { this.G.hud.hint(d.need === 'boat' ? 'Check the Traps needs the boat. Swap at the dock (E).' : d.name + ' needs one of Dad\'s cars.'); continue; }
      if (this.cooldown > 0) continue;
      this.begin(d.id);
      return;
    }
  }
  begin(id) {
    const G = this.G;
    this.showStartMarkers(false);
    const a = { id, t: 0 };
    this.active = a;
    G.hud.hint('');
    if (id === 'sunset') {
      a.i = 0; a.limit = 330;
      this.setCp(this.sunsetCps[0]);
      G.hud.toast('Sunset Run: beat the sun to the Sarasota bayfront', 3.5);
      chime('good');
    } else if (id === 'traps') {
      for (const b of this.buoys) { b.pulled = false; b.t = 0; b.m.userData.glow.visible = true; b.cage.visible = false; }
      a.claws = 0; a.count = 0;
      this.setCp(null);
      G.hud.toast('Five soccer-ball buoys down the bay side of Longboat Key. The last one is off Cutter Lane. Pull every trap.', 4.5);
      chime('good');
    } else if (id === 'delivery') {
      a.meter = 100;
      const v = G.active;
      a.roof = new THREE.Group();
      for (let i = 0; i < 4; i++) { const c = makeCrate(0.62); c.position.set(-0.55 + (i % 2) * 0.66, 0.31 + Math.floor(i / 2) * 0.5, (i % 2 ? 0.33 : -0.33)); c.rotation.y = (i * 0.37) % 0.3; a.roof.add(c); }
      a.roof.position.set(-v.len * 0.05, v.hgt - 0.04, 0);
      v.body.add(a.roof);
      a.car = v;
      this.setCp({ x: this.circle.x, z: this.circle.z, y: 0, r: this.circle.r + 18 });
      G.hud.toast('Cranberry Delivery: crates on the roof to St. Armands Circle. Hard braking spills them.', 4);
      chime('good');
    } else if (id === 'run') {
      this.active = null;
      G.startIntro(async () => {
        const truck = await G.useTruck();
        const s = G.warehouse.truckSpot;
        truck.place(s.x, s.z, s.heading, 0);
        truck.setCrates(truck.maxCrates);
        truck.clearFlying();
        this.active = a;
        a.t = 0; a.strikes = 0; a.police = null; a.grace = 0; a.prevLimit = 99; a.dockT = 0;
        this.trail = [];
        this.setCp({ x: G.store.dock.x, z: G.store.dock.z, y: 0, r: 6 });
        G.hud.toast('Cranberry Run: get the crates to the grocery dock on Longboat Key. Mind the limits.', 4.5);
      });
    }
  }
  end(title, body, again = true) {
    const G = this.G, a = this.active;
    if (!a) return;
    if (a.roof) a.roof.removeFromParent();
    this.active = null;
    this.setCp(null);
    for (const b of this.buoys) b.m.userData.glow.visible = false;
    this.clearPolice();
    G.setSun(G.defaultSun);
    G.hud.mission('');
    G.hud.progress(0);
    this.cooldown = 4;
    const id = a.id;
    const btns = [['Keep cruising', () => { this.afterEnd(id); }]];
    if (again) btns.push(['Try again', () => { this.afterEnd(id, true); }]);
    G.hud.card(title, body, btns);
    G.paused = true;
  }
  afterEnd(id, retry = false) {
    const G = this.G;
    G.paused = false;
    if (id === 'run' && G.active.kind === 'truck') {
      if (retry) { this.begin('run'); return; }
      G.leaveTruck();
    }
    if (G.store && G.store.group.userData.bday) G.store.group.userData.bday.visible = false;
    this.showStartMarkers(true);
    if (retry) { this.teleportTo(id); }
  }
  teleportTo(id) {
    const G = this.G, d = this.defs.find((x) => x.id === id);
    if (!d) return;
    if (d.need === 'boat') G.goBoat(d.pos.x - 20, d.pos.z, 0);
    else {
      if (G.active.kind === 'boat' || G.active.kind === 'truck' || G.active.kind === 'air') G.backToCar();
      const r = G.world.nearestRoadPoint(d.pos.x, d.pos.z, { ground: true });
      const back = 18;
      // face the way the mission goes
      const to = id === 'sunset' ? this.sunsetCps[0] : id === 'delivery' ? this.circle : null;
      let h = r.heading;
      if (to && Math.cos(h) * (to.x - r.x) - Math.sin(h) * (to.z - r.z) < 0) h += Math.PI;
      G.active.place(r.x - Math.cos(h) * back, r.z + Math.sin(h) * back, h, 0);
    }
    this.cooldown = 0;
  }

  // ------------------------------------------------------------------ per frame
  update(dt) {
    const G = this.G, v = G.active;
    this.cooldown = Math.max(0, (this.cooldown || 0) - dt);
    for (const d of this.defs) d.marker.userData.ring.rotation.z += dt;
    this.cpMarker.userData.ring.rotation.z += dt * 2;
    this.updateCarts(dt, v);
    if (!this.active) { this.tryStart(v); return; }
    const a = this.active;
    if (a.done) return;
    a.t += dt;
    if (a.id === 'sunset') this.updSunset(dt, v, a);
    else if (a.id === 'traps') this.updTraps(dt, v, a);
    else if (a.id === 'delivery') this.updDelivery(dt, v, a);
    else if (a.id === 'run') this.updRun(dt, v, a);
  }

  updSunset(dt, v, a) {
    const G = this.G;
    const left = a.limit - a.t;
    G.setSun(6.0 - 6.6 * Math.min(1, a.t / a.limit));
    const cp = this.sunsetCps[a.i];
    G.hud.mission(`<b>Sunset Run</b><br>Sun sets in <span class="big">${fmt(left)}</span><br>Next: ${cp.name} (${a.i + 1} of ${this.sunsetCps.length})`);
    if (this.near(v, cp, cp.r) && Math.abs(v.y - (cp.y || 0)) < 8) {
      a.i++;
      chime('good');
      if (a.i >= this.sunsetCps.length) {
        this.end('You beat the sunset', `Longboat Key to the Sarasota bayfront in ${fmt(a.t)}, with ${fmt(left)} of sun to spare.`);
        return;
      }
      G.hud.toast(cp.name + '. Next: ' + this.sunsetCps[a.i].name, 2.2);
      this.setCp(this.sunsetCps[a.i]);
    }
    if (left <= 0) this.end('The sun beat you', `The sun went into the Gulf before you reached the bayfront. You made ${a.i} of ${this.sunsetCps.length} checkpoints.`);
  }

  updTraps(dt, v, a) {
    const G = this.G;
    let near = null;
    for (const b of this.buoys) {
      b.m.position.y = -0.35 + Math.sin(G.time * 1.6 + b.x) * 0.08;
      b.m.rotation.y += dt * 0.3;
      if (b.pulled) {
        b.t += dt;
        b.cage.position.y = Math.min(0.9, -2 + b.t * 3);
        continue;
      }
      if (this.near(v, b, 11)) near = b;
    }
    G.hud.mission(`<b>Check the Traps</b><br>Traps pulled: <span class="big">${a.count} / 5</span><br>Stone crab claws: ${a.claws}`);
    if (v.kind !== 'boat') { G.hud.hint('Back to the boat to finish the traps'); return; }
    if (near) {
      if (Math.abs(v.speed) > 3) { G.hud.hint('Slow down to pull the trap'); a.hold = 0; G.hud.progress(0); return; }
      G.hud.hint('Hold E to pull the trap');
      if (G.input.interactHeld) {
        a.hold = (a.hold || 0) + dt;
        G.hud.progress(a.hold / 1.4);
        if (a.hold >= 1.4) {
          a.hold = 0; G.hud.progress(0);
          near.pulled = true; near.cage.visible = true; near.t = 0; near.m.userData.glow.visible = false;
          const claws = 3 + Math.floor(Math.random() * 10);
          a.claws += claws; a.count++;
          chime('good');
          G.hud.toast(`Trap ${a.count}: ${claws} stone crab claws`, 2.5);
          if (a.count === 5) setTimeout(() => this.end('All five traps pulled', `${a.claws} stone crab claws in ${fmt(a.t)}. Mustard sauce is on Dad.`), 1200);
        }
      } else { a.hold = 0; G.hud.progress(0); }
    } else { G.hud.hint(''); G.hud.progress(0); }
  }

  updDelivery(dt, v, a) {
    const G = this.G;
    if (v !== a.car) { this.end('Delivery stopped', 'You left the car with the crates.', true); return; }
    if (v.decel > 7.5 && v.speed > 2) a.meter -= (v.decel - 7.5) * 2.2 * dt * 10;
    for (const e of v.events) if (e.type === 'crash') a.meter -= Math.min(40, e.impact * 2.5);
    a.meter = Math.max(0, a.meter);
    const n = Math.ceil(a.meter / 25);
    a.roof.children.forEach((c, i) => { c.visible = i < n; });
    G.hud.mission(`<b>Cranberry Delivery</b><br>Crates: <span class="bar"><span style="width:${a.meter}%"></span></span><br>${fmt(a.t)} to St. Armands Circle`);
    if (a.meter <= 0) { this.end('Cranberries everywhere', 'Too much hard braking. The crates went over the side.'); return; }
    if (this.near(v, this.circle, this.circle.r + 18)) {
      chime('win');
      this.end('Delivered to St. Armands', `Crates intact: ${Math.round(a.meter)} percent. Time ${fmt(a.t)}.`);
    }
  }

  // ------------------------------------------------------------------ Cranberry Run
  updRun(dt, v, a) {
    const G = this.G;
    if (v.kind !== 'truck') return;
    const mph = Math.round(Math.abs(v.speed) * MPH);
    const lim = this.limitAt(v);
    if (lim < a.prevLimit) a.grace = 3.0;
    a.prevLimit = lim;
    a.grace = Math.max(0, a.grace - dt);
    // spills
    for (const e of v.events) if (e.type === 'crash') v.spill(Math.min(4, 1 + Math.floor(e.impact / 4)), G.world);
    if (v.decel > 6.5 && v.speed > 3) { a.brakeT = (a.brakeT || 0) + dt; if (a.brakeT > 0.25) { a.brakeT = 0; v.spill(1, G.world); G.hud.toast('Easy on the brakes. A crate went over.', 1.6); } }
    // trail for the police SUV
    const last = this.trail[this.trail.length - 1];
    if (!last || Math.hypot(last[0] - v.pos.x, last[1] - v.pos.z) > 1.5) { this.trail.push([v.pos.x, v.pos.z, v.y]); if (this.trail.length > 400) this.trail.shift(); }
    // police: over the limit means lights behind you right away
    if (!a.police && mph > lim && a.grace <= 0) { a.overT = (a.overT || 0) + dt; if (a.overT > 0.4) this.startPolice(a, mph, lim); }
    else if (!a.police) a.overT = 0;
    if (a.police) this.updPolice(dt, v, a);
    let html = `<b>Cranberry Run</b><br>Crates: <span class="big">${v.crates} / ${v.maxCrates}</span><br>Time ${fmt(a.t)}`;
    if (a.police) html += `<br><span class="warn">${a.police.phase === 'pull' ? 'Pull over and stop: ' + Math.ceil(10 - a.police.t) : 'Helicopters overhead. Stop the truck.'}</span>`;
    G.hud.mission(html);
    if (v.crates <= 0) { this.end('Out of cranberries', 'Every crate fell off along the way. Gentler on the brakes, and watch for golf carts.'); return; }
    // the dock: back the trailer in
    const dock = G.store.dock;
    const [kx, kz] = v.kingpin();
    const rx = kx - Math.cos(v.tHeading) * v.tLen, rz = kz + Math.sin(v.tHeading) * v.tLen;
    const dRear = Math.hypot(rx - dock.x, rz - dock.z);
    const away = Math.cos(v.tHeading - dock.heading); // trailer pointing away from the wall
    if (dRear < 40) G.hud.hint(dRear < 6 ? (away > 0.85 ? 'Hold still...' : 'Straighten out: back in square to the dock') : 'Back the trailer into the dock (S to reverse)');
    if (dRear < 6 && away > 0.85 && Math.abs(v.speed) < 0.6) {
      a.dockT += dt;
      if (a.dockT > 1.0) this.finishRun(a, v);
    } else a.dockT = 0;
  }
  startPolice(a, mph, lim) {
    const G = this.G;
    a.police = { phase: 'pull', t: 0, stillT: 0, mph, lim, n: 0 };
    this.police.visible = true;
    const v = G.active, [fx, fz] = v.fwd();
    if (this.trail.length < 30) this.police.position.set(v.pos.x - fx * 40, v.y, v.pos.z - fz * 40);
    else { const p = this.trail[this.trail.length - 28]; this.police.position.set(p[0], p[2], p[1]); }
    this.police.rotation.y = v.heading;
    this.policeLight.intensity = 60;
    this.policeLight.position.copy(this.police.position).y += 3;
    setSiren(true);
    G.hud.toast(`${mph} in a ${lim}. Lights behind you: pull over.`, 3);
  }
  updPolice(dt, v, a) {
    const P2 = a.police;
    P2.t += dt;
    // follow the trail about 20 m back
    const idx = Math.max(0, this.trail.length - 24);
    const p = this.trail[idx];
    if (p) {
      const target = new THREE.Vector3(p[0], p[2], p[1]);
      const prev = this.police.position.clone();
      this.police.position.lerp(target, Math.min(1, dt * 1.5));
      const d = this.police.position.clone().sub(prev);
      if (d.lengthSq() > 1e-4) this.police.rotation.y = Math.atan2(-d.z, d.x);
    }
    const flash = Math.floor(this.G.time * 6) % 2;
    this.police.userData.red.emissiveIntensity = flash ? 4 : 0.2;
    this.police.userData.blue.emissiveIntensity = flash ? 0.2 : 4;
    this.policeLight.color.set(flash ? 0xff2020 : 0x2050ff);
    this.policeLight.position.copy(this.police.position).y += 3;
    const stopped = Math.abs(v.speed) < 1.0 && !(this.G.input.brake > 0 && v.speed < -0.3);
    P2.stillT = stopped ? P2.stillT + dt : 0;
    if (P2.phase === 'pull') {
      if (P2.stillT > 1) { this.end('Pulled over', `Ticket: ${P2.mph} in a ${P2.lim}. The officer was nice about it. The run starts over.`, true); return; }
      if (P2.t > 10) { P2.phase = 'heli'; P2.ht = 0; this.addHeli(); }
    } else {
      P2.ht += dt;
      if (P2.ht > 15 * this.helis.length && this.helis.length < 3) this.addHeli();
      this.helis.forEach((h, i) => {
        const ang = this.G.time * 0.4 + i * 2.1;
        const tx = v.pos.x + Math.cos(ang) * 25, tz = v.pos.z + Math.sin(ang) * 25;
        h.position.lerp(new THREE.Vector3(tx, 55 + i * 8, tz), Math.min(1, dt * 0.8));
        h.lookAt(v.pos.x, h.position.y, v.pos.z); h.rotateY(-Math.PI / 2);
        h.userData.rotor.rotation.y += dt * 30;
        h.userData.tail.rotation.z += dt * 40;
        const s = h.userData.spot;
        const dir = h.worldToLocal(new THREE.Vector3(v.pos.x, v.y, v.pos.z)).sub(s.position);
        if (i === 0) {
          h.updateMatrixWorld();
          this.heliSpot.position.copy(h.localToWorld(s.position.clone()));
          this.heliSpot.target.position.set(v.pos.x, v.y, v.pos.z);
          this.heliSpot.intensity = 6000;
        }
        const cone = h.userData.cone;
        cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.clone().normalize());
        cone.scale.set(1, dir.length() / 60, 1);
      });
      setRotor(this.helis.length);
      if (P2.stillT > 1 || P2.ht > 50) { this.end('Busted', 'The helicopters followed you all the way. Nobody got hurt, but the cranberries are going back to the warehouse.', true); }
    }
  }
  addHeli() {
    const h = this.heliPool[this.helis.length];
    if (!h) return;
    const v = this.G.active;
    h.position.set(v.pos.x - 200, 80, v.pos.z - 100);
    h.visible = true;
    this.helis.push(h);
    this.G.hud.toast('A helicopter joins the chase', 2);
  }
  clearPolice() {
    this.police.visible = false; this.policeLight.intensity = 0;
    for (const h of this.helis) h.visible = false;
    this.helis = []; this.heliSpot.intensity = 0;
    setSiren(false); setRotor(0);
  }
  // compile the hidden chase models' shaders up front so they appear without a stall
  prewarm(renderer, camera, extra = []) {
    const hidden = [this.police, ...this.heliPool, ...extra];
    hidden.forEach((o) => { o.visible = true; });
    try { renderer.compile(this.G.scene, camera); } catch (e) { /* best effort */ }
    hidden.forEach((o) => { o.visible = false; });
  }
  finishRun(a, v) {
    const G = this.G;
    G.store.group.userData.bday.visible = true;
    chime('win');
    G.celebrate(G.store.front, () => {
      this.end('Happy birthday Kristian', `${v.crates} of ${v.maxCrates} crates delivered to the dock in ${fmt(a.t)}. Score ${v.crates * 100 + Math.max(0, 600 - Math.round(a.t))}.`, true);
    });
    a.done = true;
    this.setCp(null);
  }

  // ------------------------------------------------------------------ golf carts
  updateCarts(dt, v) {
    for (const c of this.carts) {
      const m = c.m;
      if (c.state === 'flung') {
        c.t -= dt;
        c.v.y -= 9.8 * dt;
        m.position.addScaledVector(c.v, dt);
        if (m.position.y < 0) { m.position.y = 0; c.v.multiplyScalar(0.5); c.v.y = Math.abs(c.v.y) * 0.3; }
        m.rotation.y += c.spin * dt; c.spin *= 0.98;
        if (c.t <= 0) { c.state = 'idle'; c.t = 6; m.position.copy(c.A); m.rotation.set(0, 0, 0); c.from = c.A; c.to = c.B; }
        continue;
      }
      const d = Math.hypot(v.pos.x - m.position.x, v.pos.z - m.position.z);
      if (c.state === 'idle') {
        c.t -= dt;
        const dirx = c.to.x - c.from.x, dirz = c.to.z - c.from.z;
        m.rotation.y = Math.atan2(-dirz, dirx);
        if (c.t <= 0 && d < 140) { c.state = 'cross'; c.u = 0; }
      } else if (c.state === 'cross') {
        const L = c.from.distanceTo(c.to);
        c.u += 3.0 * dt / L;
        m.position.lerpVectors(c.from, c.to, Math.min(1, c.u));
        if (c.u >= 1) { c.state = 'idle'; c.t = 5 + Math.random() * 8; [c.from, c.to] = [c.to, c.from]; }
      }
      // collisions with the player's vehicle (and the trailer)
      if (v.kind === 'boat' || (v.kind === 'air' && v.y > 2.5)) continue;
      let hit = d < (v.kind === 'truck' ? 3.2 : 2.6);
      if (!hit && v.kind === 'truck') for (const [x, z] of v.trailerCorners()) if (Math.hypot(x - m.position.x, z - m.position.z) < 2.0) hit = true;
      if (hit && Math.abs(v.speed) > 1.2) {
        c.state = 'flung'; c.t = 4;
        const nx = (m.position.x - v.pos.x) / (d || 1), nz = (m.position.z - v.pos.z) / (d || 1);
        c.v.set(nx * 5 + v.vel.x * 0.5, 3.5, nz * 5 + v.vel.y * 0.5); c.spin = 4;
        v.vel.multiplyScalar(0.6);
        this.G.hud.toast('Whoa! Sorry! (the golfer is fine, just annoyed)', 2.2);
        if (this.active && this.active.id === 'run' && v.kind === 'truck') v.spill(3, this.G.world);
        if (this.active && this.active.id === 'delivery') this.active.meter -= 25;
      }
    }
  }
}
