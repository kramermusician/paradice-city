// Stops on Dad's drive home (2026-11-25): the Mobil station on Longboat Key, the bait shop by Mote Aquarium
// at the south foot of the New Pass bridge, and the "Drive home" objective that ties the opening together:
// St. Armands Circle, bait at the crab shack, then over the bridge to Cutter Lane.
// Both buildings sit on their real OpenStreetMap footprints (the pump lanes and the shop's loop are in the map
// data); placeStops() clears the plain OSM boxes, buildStops() puts these in. Lambert only, merged, no shadows.
import * as THREE from 'three';
import { mergeGroup, makeMarker, rectPoly, canvasTex } from './models.js';
import { chime } from './audio.js';

// centre (local metres) and the unit vector along the building's long side
const GAS = { x: 2932.4, z: 2974.2, ux: 0.928, uz: 0.372 };     // 400 Gulf of Mexico Drive, the only gas on the key
const BAIT = { x: 3915.0, z: 3649.5, ux: 0.966, uz: -0.258 };   // 1505 Ken Thompson Parkway, by the New Pass bridge
const ang = (s) => Math.atan2(-s.uz, s.ux);
// local (u along the front, v toward the road) to world
const at = (s, u, v) => ({ x: s.x + s.ux * u - s.uz * v, z: s.z + s.uz * u + s.ux * v });

const L = (color) => new THREE.MeshLambertMaterial({ color });
function box(g, w, h, d, color, x, y, z, ry = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), L(color));
  m.position.set(x, y, z); m.rotation.y = ry; g.add(m); return m;
}
function sign(tex, w, h, x, y, z, ry = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: tex }));
  m.position.set(x, y, z); m.rotation.y = ry; return m;
}
// flat pad just above the ground, drawn over the grass and under the cars
function pad(w, d, color, x, z) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2),
    new THREE.MeshLambertMaterial({ color, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
  m.position.set(x, 0.02, z); return m;
}

export function placeStops(W) {
  W.exclusions.push([2932, 2981, 7], [3915, 3650, 11]);
}

function buildGas(scene, W) {
  const s = GAS, root = new THREE.Group(), g = new THREE.Group();
  // store: white box, blue band, dark glass front
  box(g, 24, 4.2, 11, 0xf2f0ea, 0, 2.1, 0);
  box(g, 24.3, 0.9, 11.3, 0x1f4fa3, 0, 4.2, 0);
  box(g, 24.3, 0.18, 11.3, 0xd8232a, 0, 3.68, 0);
  box(g, 15, 2.5, 0.2, 0x25323d, -1, 1.35, 5.5);
  box(g, 2.2, 2.6, 0.24, 0x3c4b57, -1, 1.3, 5.52);
  box(g, 4.2, 3.2, 0.2, 0x58636c, 9, 1.6, 5.5);            // car wash door
  // canopy over the two pump islands (lanes at v 7, 15 and 21 in the map data)
  const cu = 3, cv = 14.5, top = 5.4;
  box(g, 17, 0.9, 15, 0xf7f6f2, cu, top, cv);
  box(g, 17.2, 0.3, 15.2, 0x1f4fa3, cu, top - 0.15, cv);
  box(g, 17.25, 0.12, 15.25, 0xd8232a, cu, top + 0.32, cv);
  for (const iv of [11, 18]) {
    box(g, 11, 0.22, 1.3, 0xb9b6ae, cu, 0.11, iv);          // island kerb
    for (const cuo of [-5, 5]) box(g, 0.45, top - 0.4, 0.45, 0xe9e7e1, cu + cuo, (top - 0.4) / 2, iv);
    for (const pu of [-2.4, 2.4]) {
      box(g, 0.95, 1.75, 0.6, 0xf2f0ea, cu + pu, 1.1, iv);
      box(g, 0.97, 0.38, 0.62, 0x1f4fa3, cu + pu, 1.78, iv);
      box(g, 0.7, 0.45, 0.64, 0x1a1c20, cu + pu, 1.3, iv);
      box(g, 0.5, 0.9, 0.5, 0x8d1b20, cu + pu + 1.0, 0.45, iv);   // bin
    }
  }
  // price pylon on the verge, between the two driveways
  for (const o of [-1.2, 1.2]) box(g, 0.28, 6.4, 0.28, 0xdedcd6, 5, 3.2, 30 + o);
  box(g, 0.4, 4.6, 3.4, 0xf7f6f2, 5, 5.0, 30);
  box(g, 0.44, 0.3, 3.44, 0x1f4fa3, 5, 7.3, 30);
  const merged = mergeGroup(g);
  merged.children[0].castShadow = false;
  root.add(pad(34, 20, 0x8f8d88, 4.5, 14.5), merged);
  const brand = canvasTex(512, 160, (c, w, h) => {
    c.fillStyle = '#f7f6f2'; c.fillRect(0, 0, w, h);
    c.font = 'bold 120px Helvetica, Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const word = 'Mobil', tw = c.measureText(word).width; let x = w / 2 - tw / 2;
    c.textAlign = 'left';
    for (const ch of word) { c.fillStyle = ch === 'o' ? '#d8232a' : '#1f4fa3'; c.fillText(ch, x, h / 2 + 6); x += c.measureText(ch).width; }
  });
  const price = canvasTex(360, 480, (c, w, h) => {
    c.fillStyle = '#f7f6f2'; c.fillRect(0, 0, w, h);
    c.textAlign = 'left'; c.textBaseline = 'middle'; c.font = 'bold 96px Helvetica, Arial';
    let x = 52; for (const ch of 'Mobil') { c.fillStyle = ch === 'o' ? '#d8232a' : '#1f4fa3'; c.fillText(ch, x, 70); x += c.measureText(ch).width; }
    c.fillStyle = '#1f4fa3'; c.font = 'bold 34px Helvetica, Arial'; c.textAlign = 'center'; c.fillText('LONGBOAT KEY', w / 2, 150);
    const rows = [['Regular', '3.19'], ['Plus', '3.59'], ['Supreme', '3.99']];
    rows.forEach(([n, p], i) => {
      const y = 215 + i * 78;
      c.fillStyle = '#16181c'; c.fillRect(24, y - 30, w - 48, 62);
      c.fillStyle = '#fff'; c.font = 'bold 30px Helvetica, Arial'; c.textAlign = 'left'; c.fillText(n, 40, y + 2);
      c.fillStyle = '#ffd34d'; c.font = 'bold 46px Helvetica, Arial'; c.textAlign = 'right'; c.fillText(p, w - 40, y + 2);
    });
    c.fillStyle = '#d8232a'; c.font = 'bold 30px Helvetica, Arial'; c.textAlign = 'center'; c.fillText('CAR WASH', w / 2, 450);
  });
  const mart = canvasTex(512, 96, (c, w, h) => {
    c.fillStyle = '#1f4fa3'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff'; c.font = 'bold 60px Helvetica, Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('MART  .  CAR WASH', w / 2, h / 2 + 4);
  });
  root.add(
    sign(brand, 4.4, 0.8, cu, top, cv + 7.52),                        // canopy, road side
    sign(brand, 4.4, 0.8, cu, top, cv - 7.52, Math.PI),               // canopy, store side
    sign(brand, 4.4, 0.8, cu + 8.52, top, cv, Math.PI / 2), sign(brand, 4.4, 0.8, cu - 8.52, top, cv, -Math.PI / 2),
    sign(mart, 4.8, 0.86, -1, 4.2, 5.67),
    sign(price, 3.3, 4.4, 5.21, 5.0, 30, Math.PI / 2), sign(price, 3.3, 4.4, 4.79, 5.0, 30, -Math.PI / 2),
  );
  root.position.set(s.x, 0, s.z); root.rotation.y = ang(s);
  scene.add(root);
  const a = ang(s);
  W.bList[W.addCollider(rectPoly(s.x, s.z, 24, 11, a), 5)].custom = true;
  for (const iv of [11, 18]) { const p = at(s, cu, iv), b = W.bList[W.addCollider(rectPoly(p.x, p.z, 11, 1.3, a), 2)]; b.custom = true; b.tiny = true; }
  { const p = at(s, 5, 30), b = W.bList[W.addCollider(rectPoly(p.x, p.z, 0.6, 3.4, a), 7)]; b.custom = true; b.tiny = true; }
  const c = at(s, cu, cv);
  return { x: c.x, z: c.z, r: 9 };
}

function buildBait(scene, W) {
  const s = BAIT, root = new THREE.Group(), g = new THREE.Group();
  const wood = 0x9a7b55, woodDark = 0x6f573b, tin = 0xb9c2c6, teal = 0x2f8f8c;
  // shack: weathered boards, teal trim, tin gable roof with a deep porch
  box(g, 16, 3.2, 8, wood, 0, 1.6, -0.5);
  box(g, 16.2, 0.25, 8.2, teal, 0, 3.2, -0.5);
  for (const sd of [-1, 1]) {
    const r = box(g, 16.8, 0.14, 6.6, tin, 0, 4.25, -0.5 + sd * 2.9); r.rotation.x = sd * 0.42;
  }
  box(g, 16.8, 0.2, 0.3, 0x8f989c, 0, 5.55, -0.5);                 // ridge cap
  for (const ex of [-8, 8]) { box(g, 0.2, 1.3, 5, wood, ex, 3.85, -0.5); box(g, 0.2, 0.55, 2.3, wood, ex, 4.75, -0.5); }   // gable ends
  const porch = box(g, 16.8, 0.12, 4.4, tin, 0, 3.0, 5.4); porch.rotation.x = 0.16;
  box(g, 16.4, 0.3, 4, woodDark, 0, 0.15, 5.4);                     // porch deck
  for (const px of [-7.8, -2.6, 2.6, 7.8]) box(g, 0.2, 2.6, 0.2, woodDark, px, 1.5, 7.2);
  box(g, 1.3, 2.3, 0.15, teal, -2, 1.25, 3.56);                     // door
  box(g, 3.6, 1.3, 0.15, 0x2b3840, 3.4, 1.9, 3.56);                 // serving window
  box(g, 4.0, 0.12, 0.7, woodDark, 3.4, 1.2, 3.9);                  // counter
  // bait cooler, ice chest, stacked stone crab traps, a rack of rods
  box(g, 2.2, 1.0, 0.9, 0xf2f2ee, -5.6, 0.8, 4.3); box(g, 2.24, 0.12, 0.94, 0x2a63b8, -5.6, 1.36, 4.3);
  box(g, 1.1, 0.7, 0.7, 0xd8232a, 7.0, 0.65, 4.4);
  for (let i = 0; i < 6; i++) {
    const row = i < 3 ? 0 : 1, col = i < 3 ? i : i - 3;
    box(g, 0.95, 0.5, 0.95, 0x30342f, -11 + col * 1.02 + row * 0.5, 0.25 + row * 0.52, 5.2, 0.05 * i);
    box(g, 0.97, 0.06, 0.97, 0xc7b27a, -11 + col * 1.02 + row * 0.5, 0.53 + row * 0.52, 5.2, 0.05 * i);
  }
  for (let i = 0; i < 4; i++) { const r = box(g, 0.05, 2.6, 0.05, i % 2 ? 0x222222 : 0x9a2f2f, 9.4 + i * 0.3, 1.5, 4.0); r.rotation.x = -0.12; }
  // a soccer-ball buoy on a post, like Dad's traps
  box(g, 0.14, 1.6, 0.14, woodDark, 10.2, 0.8, 8.4);
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), L(0xf4f4f0)); ball.position.set(10.2, 1.95, 8.4); g.add(ball);
  // small dock out the back, over the water of New Pass
  box(g, 2.4, 0.2, 9, woodDark, 5, 0.45, -9);
  for (const dz of [-6, -9.5, -13]) for (const dx of [3.9, 6.1]) box(g, 0.24, 1.7, 0.24, 0x5a4833, dx, 0.2, dz);
  const merged = mergeGroup(g);
  merged.children[0].castShadow = false;
  root.add(pad(34, 9, 0xcbbf9f, 0, 11.5), merged);      // shell lot out front
  const board = canvasTex(1024, 256, (c, w, h) => {
    c.fillStyle = '#f3ead2'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#2f8f8c'; c.lineWidth = 14; c.strokeRect(10, 10, w - 20, h - 20);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#c8322c'; c.font = 'bold 132px Georgia, serif'; c.fillText('LIVE BAIT', w / 2 + 60, 100);
    c.fillStyle = '#2f5d5b'; c.font = 'bold 46px Helvetica, Arial'; c.fillText('NEW PASS GRILL & BAIT SHOP', w / 2 + 60, 200);
    // a stone crab: body, two claws with black tips, legs
    c.save(); c.translate(120, 128);
    c.strokeStyle = '#b5532a'; c.lineWidth = 9; c.lineCap = 'round';
    for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(sd * 40, 6 + k * 14); c.lineTo(sd * 78, 22 + k * 20); c.stroke(); }
    c.fillStyle = '#d0703a'; c.beginPath(); c.ellipse(0, 10, 56, 38, 0, 0, 7); c.fill();
    for (const sd of [-1, 1]) {
      c.fillStyle = '#d0703a'; c.beginPath(); c.ellipse(sd * 62, -40, 30, 22, sd * 0.5, 0, 7); c.fill();
      c.fillStyle = '#1b1b1b'; c.beginPath(); c.ellipse(sd * 80, -58, 13, 9, sd * 0.5, 0, 7); c.fill();
      c.fillStyle = '#111'; c.beginPath(); c.arc(sd * 16, -22, 5, 0, 7); c.fill();
    }
    c.restore();
  });
  const small = canvasTex(512, 128, (c, w, h) => {
    c.fillStyle = '#2f8f8c'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff'; c.font = 'bold 54px Helvetica, Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('SHRIMP  .  PINFISH  .  ICE', w / 2, h / 2 + 3);
  });
  root.add(
    sign(board, 10.4, 2.6, 0, 6.2, 3.3),                    // on the roof, facing the lane
    sign(board, 10.4, 2.6, 0, 6.2, 3.2, Math.PI),
    sign(small, 4.4, 1.1, 3.4, 2.95, 3.6),
  );
  for (const px of [-4.6, 4.6]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.6, 0.2), L(0x6f573b)); p.position.set(px, 4.4, 3.25); root.add(p); }
  root.position.set(s.x, 0, s.z); root.rotation.y = ang(s);
  scene.add(root);
  W.bList[W.addCollider(rectPoly(s.x + -s.uz * 1.0, s.z + s.ux * 1.0, 16.6, 12, ang(s)), 4)].custom = true;
  // the stop: on the shop's loop off Ken Thompson Parkway, right in front of the porch
  const lane = W.nearestRoadPoint(...Object.values(at(s, 1, 12.3)), { ground: true });
  return { x: lane.x, z: lane.z, r: 9 };
}

export function buildStops(scene, W, G) {
  G.gas = buildGas(scene, W);
  G.bait = buildBait(scene, W);
}

// ------------------------------------------------------------------ the drive home
// A free-roam objective, not a mission: it never turns the patrol cars off and any mission can run on top
// of it (it waits). Three stops in order; driving straight to a later stop skips the earlier ones.
const MI = 1609.34;
export class HomeTrip {
  constructor(G) {
    this.G = G;
    this.stage = 0;            // 0 circle, 1 bait, 2 home, 3 done
    this.hold = 0; this.briefed = false; this.gasT = 0; this.gasDone = false;
    const c = G.missions.circle;
    this.stops = [
      { x: c.x, z: c.z, r: c.r + 18, short: 'St. Armands Circle', line: 'Pass through St. Armands Circle' },
      { x: G.bait.x, z: G.bait.z, r: G.bait.r, short: 'the crab shack', line: 'Pick up bait at the crab shack by Mote Aquarium' },
      { x: G.dadsPlace.x, z: G.dadsPlace.z, r: 12, short: 'home', line: 'Cross the bridge to Longboat Key and drive home' },
    ];
    this.ring = makeMarker(0xffe04d, ''); this.ring.scale.set(3, 1, 3); this.ring.position.set(c.x, 0, c.z);
    this.baitMarker = makeMarker(0xffe04d, 'Bait'); this.baitMarker.position.set(G.bait.x, 0, G.bait.z);
    G.scene.add(this.ring, this.baitMarker);
    // the bait bucket that rides home on the roof
    const b = new THREE.Group();
    const pail = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.36, 12), L(0xf2f2ee)); pail.position.y = 0.18;
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.05, 12), L(0x2a63b8)); lid.position.y = 0.38;
    b.add(pail, lid);
    this.bucket = b;
  }
  get on() { return this.stage < 3 && !this.G.missions.active; }
  stop() { return this.stage < 3 ? this.stops[this.stage] : null; }
  navTarget() { const s = this.on && this.G.active.kind !== 'boat' ? this.stop() : null; return s ? { x: s.x, z: s.z, y: 0 } : null; }
  minimapMarkers() {
    if (!this.on) return [];
    return this.stops.map((s, i) => ({ x: s.x, z: s.z, color: i === this.stage ? '#ffe04d' : '#c9b46a', big: i === this.stage, letter: String(i + 1) })).slice(this.stage);
  }
  // one line for the pause menu
  summary() {
    if (this.stage >= 3) return 'You are home with the bait. Cruise anywhere, or pick a mission below.';
    return `Drive home, stop ${this.stage + 1} of 3: ${this.stops[this.stage].line.toLowerCase()}.`;
  }
  panel(v) {
    const rows = this.stops.map((s, i) => {
      const done = i < this.stage, now = i === this.stage;
      return `<div style="opacity:${done ? 0.55 : now ? 1 : 0.8};${now ? 'font-weight:700;color:#ffe04d' : ''}">${done ? '&#10003;' : i + 1 + '.'} ${s.line}</div>`;
    }).join('');
    const s = this.stop(), d = Math.hypot(s.x - v.pos.x, s.z - v.pos.z) / MI;
    return `<span class="big">Drive home</span>${rows}<small>${d.toFixed(1)} miles to ${s.short}. Follow the arrows on the road.</small>`;
  }
  update(dt, v) {
    const G = this.G, hud = G.hud;
    // the pumps: stop under the canopy and the tank is full
    if (G.gas && v.kind === 'car') {
      const d = Math.hypot(v.pos.x - G.gas.x, v.pos.z - G.gas.z);
      if (d > 40) this.gasDone = false;
      this.gasT = d < G.gas.r && Math.abs(v.speed) < 1.2 && !this.gasDone ? this.gasT + dt : 0;
      if (this.gasT > 1.2) { this.gasDone = true; chime('good'); hud.toast('Tank is full. This is the only gas station on Longboat Key.', 3.5); }
    }
    const show = this.on;
    this.ring.visible = show && this.stage === 0;
    this.baitMarker.visible = show && this.stage <= 1;
    this.ring.userData.ring.rotation.z += dt; this.baitMarker.userData.ring.rotation.z += dt * 2;
    if (!show) { if (this.wasOn) { this.wasOn = false; if (!G.missions.active) hud.mission(''); } return; }
    this.wasOn = true;
    const land = v.kind === 'car' || v.kind === 'truck';
    if (!land) { hud.mission(''); return; }
    if (!this.briefed) { this.briefed = true; this.brief(); }
    const near = (s) => Math.hypot(v.pos.x - s.x, v.pos.z - s.z) < s.r && v.y < 4;
    const [circle, bait, home] = this.stops;
    if (this.stage === 0 && near(circle)) {
      this.stage = 1; chime('good');
      hud.toast('St. Armands Circle. Next: bait at the crab shack by Mote Aquarium, just before the bridge.', 4.5);
    }
    if (this.stage <= 1 && near(bait)) {
      if (Math.abs(v.speed) < 2.5) {
        this.hold += dt; hud.hint('Loading the bait'); hud.progress(Math.min(1, this.hold / 1.5));
        if (this.hold >= 1.5) {
          this.stage = 2; this.hold = 0; hud.progress(0); hud.hint(''); chime('win');
          if (v.kind === 'car') { this.bucket.position.set(-v.len * 0.08, v.hgt - 0.02, 0.25); v.body.add(this.bucket); this.bucketOn = v; }
          hud.toast('Bait is on board. Now over the New Pass bridge to Longboat Key, and home.', 4.5);
        }
      } else { this.hold = 0; hud.progress(0); hud.hint('Stop here to pick up the bait'); }
    } else if (this.hold > 0 || this.atBait) { this.hold = 0; hud.progress(0); }
    this.atBait = this.stage <= 1 && near(bait);
    if (this.stage === 2 && near(home)) { this.finish(); return; }
    if (this.stage === 2 && this.bucketOn && this.bucketOn !== v) { this.bucket.removeFromParent(); this.bucketOn = null; }
    hud.mission(this.panel(v));
  }
  brief() {
    const e = document.getElementById('brief');
    if (!e) return;
    e.innerHTML = '<b>Drive home, Dad.</b> Pass through St. Armands Circle, pick up bait by Mote Aquarium, then cross the bridge to Longboat Key.<small>W or Up arrow is the gas. Follow the arrows on the road.</small>';
    e.classList.add('show');
    setTimeout(() => e.classList.remove('show'), 11000);
  }
  finish() {
    const G = this.G;
    this.stage = 3;
    this.bucket.removeFromParent(); this.bucketOn = null;
    G.hud.mission(''); chime('win');
    G.paused = true;
    G.hud.card('Home with the bait', 'The bait is on the dock for the stone crab traps. Next: press E here at the gold marker to take the boat, then drive it into the blue Check the Traps marker.', [['Keep cruising', () => { G.paused = false; }]]);
  }
}
