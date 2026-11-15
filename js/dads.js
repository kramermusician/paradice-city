// Dad's place on Cutter Lane (2026-11-15): his house from the Street View photos, his dock on the canal
// behind it with his Grady-White (the player's boat), his bigger boat and two pedal kayaks.
// Plus docks with boats behind every canal-front house on the islands (world.canalLots).
import * as THREE from 'three';
import { PLACES } from './config.js';
import { makeTrafficBoat, mergeGroup, rectPoly } from './models.js';
import { PROPS } from './props.js';

const L = (color, opts = {}) => new THREE.MeshLambertMaterial({ color, ...opts });
function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  return m;
}
function cyl(r0, r1, h, mat, x, y, z, seg = 8) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat);
  m.position.set(x, y, z); m.castShadow = true;
  return m;
}

// ------------------------------------------------------------- where the lot is
// Runs before the generated houses so none lands on Dad's lot. Sets G.dad, G.dockCar, G.dockBoat.
export function placeDadsPlace(W, G) {
  const cfg = PLACES.dadsPlace;
  const rd = W.roads.filter((r) => r.n === cfg.road).sort((a, b) => b.p.length - a.p.length)[0];
  if (!rd) return null;
  const p = rd.p, n = p.length / 3, cum = [0];
  for (let i = 0; i < n - 1; i++) cum.push(cum[i] + Math.hypot(p[i * 3 + 3] - p[i * 3], p[i * 3 + 4] - p[i * 3 + 1]));
  const at = cum[n - 1] * (cfg.at ?? 0.5);
  let i = 0; while (i < n - 2 && cum[i + 1] < at) i++;
  const u = (at - cum[i]) / (cum[i + 1] - cum[i] || 1);
  const rx = p[i * 3] + (p[i * 3 + 3] - p[i * 3]) * u, rz = p[i * 3 + 1] + (p[i * 3 + 4] - p[i * 3 + 1]) * u;
  const sl = cum[i + 1] - cum[i] || 1, tx = (p[i * 3 + 3] - p[i * 3]) / sl, tz = (p[i * 3 + 4] - p[i * 3 + 1]) / sl;
  const side = cfg.side ?? 1, nx = -tz * side, nz = tx * side;   // n points from the street to the canal
  // walk out the back to the seawall
  let S = 60;
  for (let d = 8; d < 90; d += 1) if (!W.isLand(rx + nx * d, rz + nz * d)) { S = d - 1; break; }
  const edge = rd.w / 2;
  const hc = edge + SETBACK;         // house center: the front yard is about 13 m deep, the house about 12 m
  const dad = {
    rx, rz, tx, tz, nx, nz, S, edge,
    hx: rx + nx * hc, hz: rz + nz * hc,
    ang: Math.atan2(-nx, -nz),       // house local +z faces the street
    sx: rx + nx * S, sz: rz + nz * S,  // seawall
  };
  // the boat slip: alongside the dock, a few meters into the canal, bow pointing along the canal
  // toward whichever end opens out (more water ahead)
  const reach = (s) => { let k = 0; for (; k < 400; k += 10) if (W.isLand(dad.sx + nx * 8 + tx * s * k, dad.sz + nz * 8 + tz * s * k)) break; return k; };
  dad.along = reach(1) >= reach(-1) ? 1 : -1;
  const ax = tx * dad.along, az = tz * dad.along;
  dad.ax = ax; dad.az = az;
  G.dad = dad;
  G.dockCar = { x: rx + nx * (edge - 1), z: rz + nz * (edge - 1) };
  G.dockBoat = { x: dad.sx + nx * 5.2 + ax * 5, z: dad.sz + nz * 5.2 + az * 5, h: Math.atan2(-az, ax) };
  G.dadsPlace = { x: G.dockCar.x, z: G.dockCar.z };
  W.exclusions.push([dad.hx, dad.hz, 24]);
  return dad;
}

// ------------------------------------------------------------- royal palm
// Smooth pale-gray trunk with a swollen base, glossy green crownshaft, arching fronds.
const palmMats = { trunk: L(0xcdc8bd), shaft: L(0x6f8c3c), frond: L(0x4c7a2c, { side: THREE.DoubleSide }), dead: L(0xb59a6a, { side: THREE.DoubleSide }) };
export function makeRoyalPalm(h = 13, seed = 1) {
  const g = new THREE.Group();
  g.add(cyl(0.24, 0.42, 2.2, palmMats.trunk, 0, 1.1, 0, 10));
  g.add(cyl(0.22, 0.24, h - 4.2, palmMats.trunk, 0, 2.2 + (h - 4.2) / 2, 0, 10));
  g.add(cyl(0.2, 0.25, 2.0, palmMats.shaft, 0, h - 1, 0, 10));
  const top = h;
  for (let k = 0; k < 11; k++) {
    const a = k / 11 * Math.PI * 2 + seed;
    const len = 4.2 + ((k * 7 + seed * 3) % 5) * 0.25;
    const dead = k === 3 && seed % 2 === 0;
    // three bent segments per frond, each a thin leaf blade (two crossed quads for a V section)
    let px = 0, py = top, pz = 0, pitch = 0.9 - (k % 3) * 0.25;
    for (let s = 0; s < 3; s++) {
      const sl = len / 3, wdt = 1.3 - s * 0.3;
      const dx = Math.cos(a) * Math.cos(pitch) * sl, dy = Math.sin(pitch) * sl, dz = Math.sin(a) * Math.cos(pitch) * sl;
      const geo = new THREE.PlaneGeometry(sl, wdt);
      const m = new THREE.Mesh(geo, dead ? palmMats.dead : palmMats.frond);
      m.position.set(px + dx / 2, py + dy / 2, pz + dz / 2);
      m.rotation.order = 'YZX';
      m.rotation.y = -a; m.rotation.z = pitch; m.rotation.x = 0.5;
      g.add(m);
      px += dx; py += dy; pz += dz; pitch -= dead ? 1.1 : 0.55;
    }
  }
  return g;
}

// ------------------------------------------------------------- Dad's house
// From the May 2026 Street View photos: peach stucco, pale terracotta tile hip roofs, white trim, one-story
// wings with a two-story middle, a front-gable garage wing with white quoins and an oval ornament,
// a curved paver drive around an island bed of three royal palms, red ti plants and an agave.
// Local frame: +z faces the street, x runs along the street (a viewer on the street sees +x on their right).
export const SETBACK = 19;   // curb to house center, in the house's local z
const C = {
  wall: 0xe6a985, roof: 0xd49a7c, trim: 0xf3efe6, glass: 0x34504a, door: 0x6a4630, garage: 0x9b6a4c,
  paver: 0xd9d3c8, lawn: 0x5f9a3a, mulch: 0x5a3f2a, ti: 0xb3203f, agave: 0x8fa79a, shrub: 0x3f7a35, wood: 0x9b7a55, piling: 0x6e5338,
};
function hipRoof(w, d, h, y, x, z, mat, ridgeAlongX = true) {
  // a simple hip roof as a squashed 4-sided pyramid stretched to a ridge
  const g = new THREE.BufferGeometry();
  const o = 0.6, W2 = w / 2 + o, D2 = d / 2 + o, r = ridgeAlongX ? Math.max(0, (w - d) / 2) : 0, rz = ridgeAlongX ? 0 : Math.max(0, (d - w) / 2);
  const v = [[-W2, 0, -D2], [W2, 0, -D2], [W2, 0, D2], [-W2, 0, D2], [-r, h, -rz], [r, h, rz]];
  const idx = ridgeAlongX ? [0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 3, 3, 5, 4, 3, 4, 0] : [0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 3, 3, 5, 4, 3, 4, 0];
  const pos = [];
  for (const k of idx) pos.push(...v[k]);
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.castShadow = true;
  // ensure outward winding regardless: draw both sides
  m.material = mat.clone(); m.material.side = THREE.DoubleSide;
  return m;
}
function gableRoof(w, d, h, y, x, z, mat) {
  // ridge runs along z (gable end faces the street)
  const o = 0.5, W2 = w / 2 + o, D2 = d / 2 + o;
  const pos = [
    -W2, 0, -D2, 0, h, -D2, 0, h, D2, -W2, 0, -D2, 0, h, D2, -W2, 0, D2,
    W2, 0, -D2, W2, 0, D2, 0, h, D2, W2, 0, -D2, 0, h, D2, 0, h, -D2,
  ];
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat.clone()); m.material.side = THREE.DoubleSide; m.position.set(x, y, z); m.castShadow = true;
  return m;
}
function gableEnd(w, h, y, x, z, mat) {
  const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
  const m = new THREE.Mesh(new THREE.ShapeGeometry(s), mat.clone()); m.material.side = THREE.DoubleSide; m.position.set(x, y, z);
  return m;
}
function windowAt(g, x, y, z, w, h, face = 1) {
  const trim = L(C.trim), glass = L(C.glass);
  g.add(box(w + 0.3, h + 0.3, 0.08, trim, x, y, z + face * 0.02));
  g.add(box(w, h, 0.1, glass, x, y, z + face * 0.05));
  g.add(box(0.08, h, 0.12, trim, x, y, z + face * 0.06));   // white mullion
}
export function makeDadsHouse() {
  const g = new THREE.Group();
  const wall = L(C.wall), roof = L(C.roof), trim = L(C.trim);
  const X = (xv) => xv;    // viewer-right is local +x
  // left wing (bedrooms): one story
  g.add(box(11, 3.3, 11, wall, X(-8.5), 1.65, -0.5));
  g.add(hipRoof(11, 11, 2.2, 3.3, X(-8.5), -0.5, roof));
  windowAt(g, X(-11.5), 1.7, 5.0, 1.5, 1.4); windowAt(g, X(-6.5), 1.7, 5.0, 1.5, 1.4);
  // middle: entry, one story in front, two-story block behind it
  g.add(box(7, 3.3, 9, wall, X(0.5), 1.65, -1.5));
  g.add(box(7.5, 6.6, 7, wall, X(1.5), 3.3, -2.5));
  g.add(hipRoof(7.5, 7, 2.0, 6.6, X(1.5), -2.5, roof, false));
  g.add(box(7.6, 0.25, 9.6, roof, X(0.5), 3.4, -1.0));            // low roof skirt over the entry
  windowAt(g, X(1.5), 5.0, 1.02, 1.4, 1.2);                          // upstairs window
  g.add(box(2.3, 2.5, 0.12, trim, X(-1.2), 1.25, 3.02));            // door surround
  g.add(box(1.9, 2.3, 0.16, L(C.door), X(-1.2), 1.15, 3.05));        // double front door
  windowAt(g, X(2.0), 1.6, 3.0, 2.2, 1.6);                           // big entry window
  // garage wing: front gable toward the street, white quoins at the corners
  const gw = 10, gd = 12, gx = X(9), gz = 0;
  g.add(box(gw, 3.5, gd, wall, gx, 1.75, gz));
  g.add(gableRoof(gw, gd, 2.6, 3.5, gx, gz, roof));
  g.add(gableEnd(gw, 2.6, 3.5, gx, gz + gd / 2 + 0.01, wall));
  g.add(gableEnd(gw, 2.6, 3.5, gx, gz - gd / 2 - 0.01, wall));
  const orn = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.09, 6, 16), trim); orn.scale.set(0.75, 1.25, 1); orn.position.set(gx, 4.55, gz + gd / 2 + 0.06); g.add(orn);
  for (const sx of [-1, 1]) for (let k = 0; k < 6; k++) g.add(box(0.5 + (k % 2) * 0.25, 0.45, 0.5 + (k % 2) * 0.25, trim, gx + sx * (gw / 2 - 0.15), 0.3 + k * 0.58, gz + gd / 2 - 0.15));
  g.add(box(5.2, 2.4, 0.14, L(C.garage), gx + 0.8, 1.2, gz + gd / 2 + 0.03));   // garage door
  for (let k = 1; k < 4; k++) g.add(box(5.2, 0.05, 0.16, L(0x7f553b), gx + 0.8, k * 0.6, gz + gd / 2 + 0.05));
  windowAt(g, gx - 3.4, 1.7, gz + gd / 2, 1.0, 1.3);
  // white fascia lines under the roofs
  g.add(box(11.4, 0.18, 0.12, trim, X(-8.5), 3.25, 5.12)); g.add(box(10.3, 0.18, 0.12, trim, gx, 3.45, gz + gd / 2 + 0.08));
  // gutter downspout by the garage
  g.add(box(0.12, 3.3, 0.12, trim, gx - gw / 2 - 0.1, 1.65, gz + gd / 2 - 0.4));
  // back: a paver patio and a screened lanai frame
  g.add(box(16, 0.06, 6, L(C.paver), X(-2), 0.03, -9));
  // ---- front yard: curved paver drive (half ring) and the island bed
  const roadZ = SETBACK;
  const drive = new THREE.Mesh(new THREE.RingGeometry(6.5, 10.2, 28, 1, Math.PI, Math.PI), L(C.paver, { side: THREE.DoubleSide }));
  drive.rotation.x = -Math.PI / 2; drive.position.set(X(0.5), 0.04, roadZ); drive.receiveShadow = true; g.add(drive);
  g.add(box(6, 0.07, 7.5, L(C.paver), gx + 0.8, 0.035, gz + gd / 2 + 3.6));   // garage apron
  g.add(box(2.2, 0.07, 3, L(C.paver), X(-1.2), 0.035, 4.6));                   // walk to the door
  const bed = new THREE.Mesh(new THREE.CircleGeometry(5.6, 24), L(C.mulch)); bed.scale.set(1.0, 0.62, 1);
  bed.rotation.x = -Math.PI / 2; bed.position.set(X(0.5), 0.05, roadZ - 4); g.add(bed);
  // three royal palms in a loose triangle, the tallest at the back
  [[X(-0.8), 14.2, 15.5], [X(1.8), 15.4, 14.5], [X(3.0), 14.6, 16.5]].forEach(([x, z, h], k) => { const pm = makeRoyalPalm(h, k + 2); pm.position.set(x, 0, z); g.add(pm); });
  // red ti plants, an agave and low green shrubs around the bed
  const ti = L(C.ti), shrub = L(C.shrub), agv = L(C.agave);
  for (let k = 0; k < 7; k++) {
    const a = k / 7 * Math.PI * 2, x = X(0.5) + Math.cos(a) * 4.3, z = roadZ - 4 + Math.sin(a) * 2.2;
    for (let j = 0; j < 5; j++) { const lf = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.1, 4), ti); lf.position.set(x + Math.cos(j * 1.3) * 0.2, 0.55, z + Math.sin(j * 1.3) * 0.2); lf.rotation.set(Math.cos(j * 1.3) * 0.5, 0, Math.sin(j * 1.3) * 0.5); g.add(lf); }
  }
  for (let j = 0; j < 12; j++) { const lf = new THREE.Mesh(new THREE.ConeGeometry(0.09, 1.2, 3), agv); const a = j / 12 * Math.PI * 2; lf.position.set(X(0.0) + Math.cos(a) * 0.35, 0.5, roadZ - 4.8 + Math.sin(a) * 0.35); lf.rotation.set(Math.sin(a) * 0.8, 0, -Math.cos(a) * 0.8); g.add(lf); }
  for (let k = 0; k < 14; k++) { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6 + (k % 3) * 0.15, 0), shrub); s.scale.y = 0.7; const a = k / 14 * Math.PI * 2; s.position.set(X(0.5) + Math.cos(a) * 5.0, 0.35, roadZ - 4 + Math.sin(a) * 3.1); g.add(s); }
  // foundation shrubs along the front of the house
  for (let k = 0; k < 10; k++) { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), shrub); s.scale.y = 0.75; s.position.set(X(-13.5 + k * 1.3), 0.35, 5.7); g.add(s); }
  // two more palms framing the lot (a foxtail at the left, a Bismarck by the garage)
  const fox = makeRoyalPalm(8, 5); fox.position.set(X(-15), 0, 9); fox.scale.set(0.8, 1, 0.8); g.add(fox);
  return mergeByMaterial(g);
}

// Bake the house into a few meshes (one per material color) so it costs a handful of draw calls.
function mergeByMaterial(group) {
  const merged = mergeGroup(group);
  const m = merged.children[0];
  m.material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  m.receiveShadow = true;
  return merged;
}

// ------------------------------------------------------------- docks
function makeDockGeo(len, wid = 2.0) {
  const g = new THREE.Group();
  const wood = L(C.wood), pil = L(C.piling);
  g.add(box(len, 0.2, wid, wood, 0, 0.85, 0));
  for (let i = -len / 2; i <= len / 2 + 0.01; i += len / Math.max(1, Math.round(len / 3))) for (const s of [-wid / 2, wid / 2]) g.add(cyl(0.14, 0.14, 3.0, pil, i, -0.4, s, 6));
  return mergeGroup(g).children[0].geometry;
}
function makeLiftGeo(len) {
  const g = new THREE.Group();
  const post = L(0xd8d8d8), beam = L(0x8a8f96);
  for (const x of [-len * 0.35, len * 0.35]) for (const z of [-1.7, 1.7]) g.add(cyl(0.14, 0.14, 4.2, post, x, 0.6, z, 6));
  for (const x of [-len * 0.35, len * 0.35]) g.add(box(0.25, 0.25, 3.6, beam, x, 1.1, 0));
  for (const z of [-1.7, 1.7]) g.add(box(len * 0.7 + 0.3, 0.2, 0.2, beam, 0, 2.7, z));
  return mergeGroup(g).children[0].geometry;
}

// Docks and boats behind the canal-front houses. Instanced per 1 km tile per model, shown within ~1.6 km.
export class CanalDocks {
  constructor(scene, world, G) {
    this.world = world; this.G = G;
    this.circles = new Map();   // 50 m grid of boat collision circles [x, z, r]
    const lots = (world.canalLots || []).filter((l) => !G.dad || Math.hypot(l.x - G.dad.sx, l.z - G.dad.sz) > 30);
    // boat models: console x3 colors, cruiser, pontoon, sailboat, skiff, plus a kayak
    const kinds = [0, 1, 5, 4, 3, 2, 7].map((i) => { const b = makeTrafficBoat(i); return { geo: mergeGroup(b).children[0].geometry, ud: b.userData }; });
    const pick = (r) => r < 0.42 ? (r * 100 | 0) % 3 : r < 0.6 ? 3 : r < 0.72 ? 4 : r < 0.8 ? 5 : 6;
    const docks = new Map(), lifts = new Map(), boats = new Map();
    const add = (map, key, k, m) => { let a = map.get(key + '|' + k); if (!a) map.set(key + '|' + k, a = []); a.push(m); };
    const M4 = (x, y, z, h) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), h), new THREE.Vector3(1, 1, 1));
    let nb = 0;
    for (const l of lots) {
      const key = Math.floor(l.x / 1000) + ',' + Math.floor(l.z / 1000);
      const h = Math.atan2(-l.tz, l.tx);   // along the seawall
      const dlen = 8 + Math.round(l.r * 4) * 1.5;
      const dx = l.x + l.nx * 2.0, dz = l.z + l.nz * 2.0;
      add(docks, key, dlen, M4(dx, 0, dz, h));
      const r2 = (l.r * 7.31) % 1;
      if (r2 < 0.22) continue;                    // empty dock
      const k = pick((l.r * 13.7) % 1), ud = kinds[k].ud;
      const off = 2.0 + 1.0 + ud.wid / 2 + 0.3;
      const bx = l.x + l.nx * off, bz = l.z + l.nz * off;
      const lifted = r2 < 0.45 && ud.kind !== 'sail';
      const bh = h + ((l.r * 31) % 1 < 0.5 ? 0 : Math.PI);
      if (this.world.isLand(bx + l.nx * 3, bz + l.nz * 3)) continue;   // canal too narrow here
      add(boats, key, k, M4(bx, lifted ? 1.6 : 0, bz, bh));
      if (lifted) add(lifts, key, Math.round(ud.len), M4(bx, 0, bz, bh));
      for (const s of [-0.3, 0.3]) this.addCircle(bx + Math.cos(bh) * ud.len * s, bz - Math.sin(bh) * ud.len * s, ud.wid * 0.6 + 0.4);
      nb++;
    }
    this.count = { lots: lots.length, boats: nb };
    // build the instanced meshes
    this.meshes = [];
    const dockGeos = new Map(), liftGeos = new Map();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const build = (map, geoFor) => {
      for (const [k2, list] of map) {
        const [key, k] = k2.split('|');
        const im = new THREE.InstancedMesh(geoFor(+k), mat, list.length);
        list.forEach((m, j) => im.setMatrixAt(j, m));
        im.computeBoundingSphere(); im.castShadow = false; im.receiveShadow = true;
        const [tx, tz] = key.split(',').map(Number);
        im.userData.c = [(tx + 0.5) * 1000, (tz + 0.5) * 1000];
        scene.add(im); this.meshes.push(im);
      }
    };
    build(docks, (len) => { if (!dockGeos.has(len)) dockGeos.set(len, makeDockGeo(len)); return dockGeos.get(len); });
    build(lifts, (len) => { if (!liftGeos.has(len)) liftGeos.set(len, makeLiftGeo(len)); return liftGeos.get(len); });
    build(boats, (k) => kinds[k].geo);
  }
  addCircle(x, z, r) {
    const k = Math.floor(x / 50) * 100000 + Math.floor(z / 50);
    let a = this.circles.get(k); if (!a) this.circles.set(k, a = []); a.push([x, z, r]);
  }
  update(pos) {
    for (const m of this.meshes) m.visible = Math.hypot(m.userData.c[0] - pos.x, m.userData.c[1] - pos.z) < 1600;
  }
  // bump the player's boat off docked boats; returns impact speed
  collide(player) {
    if (player.kind !== 'boat') return 0;
    let hit = 0;
    const px = player.pos.x, pz = player.pos.z, pr = (player.def.boat?.wid || 2.6) * 0.6;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const a = this.circles.get((Math.floor(px / 50) + i) * 100000 + Math.floor(pz / 50) + j);
      if (!a) continue;
      for (const [x, z, r] of a) {
        const dx = player.pos.x - x, dz = player.pos.z - z, d = Math.hypot(dx, dz), R = r + pr;
        if (d >= R || d < 1e-3) continue;
        const nx = dx / d, nz = dz / d, into = player.vel.x * nx + player.vel.y * nz;
        if (into < 0) { player.vel.x -= nx * into * 1.3; player.vel.y -= nz * into * 1.3; hit = Math.max(hit, -into); }
        player.pos.x += nx * (R - d); player.pos.z += nz * (R - d);
      }
    }
    return hit;
  }
}

// ------------------------------------------------------------- Dad's place set piece
function kayakFallback(color) {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 6), L(color)); hull.scale.set(1.85, 0.22, 0.42); hull.position.y = 0.15; g.add(hull);
  g.add(box(0.5, 0.45, 0.5, L(0x2a2e33), -0.15, 0.45, 0));    // frame seat
  g.add(box(0.2, 0.3, 0.2, L(0x333333), 0.45, 0.35, 0));      // pedal drive
  return g;
}
export function buildDadsPlace(scene, W, G) {
  const d = G.dad; if (!d) return;
  // house
  const house = makeDadsHouse();
  house.position.set(d.hx, 0, d.hz); house.rotation.y = d.ang;
  scene.add(house); G.dadsHouse = house;
  W.bList[W.addCollider(rectPoly(d.hx, d.hz, 30, 13, d.ang), 6.6)].custom = true;
  // seawall cap and the dock along it
  const h = Math.atan2(-d.tz, d.tx);
  const cap = box(36, 0.5, 0.6, L(0xd9d6cf), 0, 0, 0); cap.position.set(d.sx + d.nx * 0.3, 0.3, d.sz + d.nz * 0.3); cap.rotation.y = h; scene.add(cap);
  const dock = new THREE.Mesh(makeDockGeo(26, 2.4), new THREE.MeshLambertMaterial({ vertexColors: true }));
  dock.position.set(d.sx + d.nx * 2.0, 0, d.sz + d.nz * 2.0); dock.rotation.y = h; scene.add(dock);
  // the bigger boat tied up behind the Grady, along the dock
  const bx = d.sx + d.nx * 5.8 - d.ax * 8, bz = d.sz + d.nz * 5.8 - d.az * 8, bh = G.dockBoat.h;
  const big = PROPS.bigboat ? PROPS.bigboat.clone() : makeTrafficBoat(4);
  big.position.set(bx, PROPS.bigboat ? 0 : 0, bz); big.rotation.y = bh; scene.add(big); G.dadsBigBoat = big;
  // two pedal kayaks on the dock, side by side
  for (const s of [-0.5, 0.5]) {
    const k = PROPS.kayak ? PROPS.kayak.clone() : kayakFallback(0x2fa58a);
    const kx = d.sx + d.nx * (2.0 + s * 1.05) + d.ax * 9.5, kz = d.sz + d.nz * (2.0 + s * 1.05) + d.az * 9.5;
    k.position.set(kx, 0.96, kz); k.rotation.y = h; scene.add(k);
  }
  G.dadsDockCircles = [[bx + Math.cos(bh) * 3, bz - Math.sin(bh) * 3, 2.6], [bx - Math.cos(bh) * 3, bz + Math.sin(bh) * 3, 2.6]];
}
