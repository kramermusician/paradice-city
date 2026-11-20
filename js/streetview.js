// Street View pass (2026-11-20): roadside dressing on Dad's drive home, matched to Kramer's Street View
// screenshots (~/Dropbox/Paradice City Looks/). New Pass bridge (blue bascule leaf, tender house, pipe rail,
// fender walls, DRAW BRIDGE AHEAD sign, guardrails), South Gulf of Mexico Drive from the bridge to Cutter Lane
// (mown verges, sidewalk on the bay side, sea grape thickets, sabal palms, the Longboat Key welcome sign) and
// Cutter Lane (lawns, mailboxes, flower beds, shrubs, palms).
// Everything is merged into a few vertex-coloured Lambert meshes (Safari needs Lambert): solid props, flat
// ground patches, and two small textured signs. No shadows. Export: buildStreetView(scene, W, G).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { xz } from './config.js';

const SIGN_LL = [27.3352, -82.5843];          // 260 Gulf of Mexico Dr, the "Welcome to the Town of Longboat Key" sign
const ROUTE_BOX = [2240, 2560, 3730, 3480];  // x0, z0, x1, z1: bridge north end to Cutter Lane
const BRIDGE_BOX = [3640, 3390, 3870, 3680];

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

class Bucket {
  constructor() { this.geos = []; }
  add(geo, color, x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));
    g.applyMatrix4(m);
    const c = new THREE.Color(color), n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.geos.push(g);
  }
  // flat quad on the ground, corners in order, y per corner
  quad(a, b, c, d, color) {
    const p = [...a, ...b, ...c, ...a, ...c, ...d];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.computeVertexNormals();
    if (g.attributes.normal.getY(0) < 0) { const q = [...a, ...c, ...b, ...a, ...d, ...c]; g.setAttribute('position', new THREE.Float32BufferAttribute(q, 3)); g.computeVertexNormals(); }
    this.add(g, color, 0, 0, 0);
  }
  mesh(mat) { if (!this.geos.length) return null; const m = new THREE.Mesh(mergeGeometries(this.geos), mat); m.matrixAutoUpdate = false; return m; }
}

const BOX = new THREE.BoxGeometry(1, 1, 1);
const BLOB = new THREE.IcosahedronGeometry(1, 0);
const BLOB1 = new THREE.IcosahedronGeometry(1, 1);
const TRUNK = new THREE.CylinderGeometry(0.2, 0.26, 1, 6, 1).translate(0, 0.5, 0);
const FAN = new THREE.CircleGeometry(1.7, 7, -0.5, 1.0).rotateZ(Math.PI / 2);   // flat fan leaf pointing +y
const GREENS = [0x3f6a2c, 0x4b7832, 0x355f2a, 0x58823a, 0x46703a];

// sabal (cabbage) palm: straight grey-brown trunk, round fan crown
function sabal(S, r, x, z, h) {
  S.add(TRUNK, 0x8a7f6c, x, 0, z, 0, 1, h, 1);
  S.add(BLOB, 0x5d7f37, x, h + 0.15, z, r() * 6, 0.9, 0.7, 0.9);
  for (let k = 0; k < 11; k++) { const a = k / 11 * 6.283 + r() * 0.3, up = k % 3 === 0; S.add(FAN, k % 2 ? 0x6a8c3e : 0x5b7d34, x, h + 0.2, z, a, 1, 1, 1, up ? 0.7 : 1.25 + r() * 0.35); }
}
// sea grape / buttonwood thicket: a few overlapping round blobs
function thicket(S, r, x, z, size) {
  const n = 2 + Math.floor(r() * 3);
  for (let k = 0; k < n; k++) {
    const w = size * (0.6 + r() * 0.5), h = size * (0.55 + r() * 0.45);
    S.add(BLOB, GREENS[Math.floor(r() * GREENS.length)], x + (r() - 0.5) * size * 1.4, h * 0.75, z + (r() - 0.5) * size * 1.4, r() * 6, w, h, w);
  }
}
function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export function buildStreetView(scene, W, G) {
  const S = new Bucket(), F = new Bucket(), r = rng(2611);
  const inBox = (b, x, z) => x > b[0] && x < b[2] && z > b[1] && z < b[3];
  const dad = G.dad;
  const nearDad = (x, z, rad = 22) => dad && Math.hypot(x - dad.hx, z - dad.hz) < rad;
  const free = (x, z) => W.isLand(x, z) && !W.buildingAt(x, z) && !W.roadAt(x, z, 0) && !nearDad(x, z);
  const byName = (re, box, ground) => W.segs.filter((s) => { const rd = W.roads[s[7]]; return re.test(rd.n || '') && inBox(box, (s[0] + s[3]) / 2, (s[1] + s[4]) / 2) && (ground ? Math.max(s[2], s[5]) < 0.5 : Math.max(s[2], s[5]) >= 0.4); });

  // ------------------------------------------------ the welcome sign
  const [sx0, sz0] = xz(...SIGN_LL);
  const sp = W.nearestRoadPoint(sx0, sz0, { name: 'South Gulf of Mexico Drive', ground: true }) || W.nearestRoadPoint(sx0, sz0, { ground: true, major: true });
  let sign = null;
  if (sp) {
    const tx = Math.cos(sp.heading), tz = -Math.sin(sp.heading);
    let nx = -tz, nz = tx;                                             // pick the bay (east) side if it is land
    if (nx < 0) { nx = -nx; nz = -nz; }
    const off = 4.25 + 11;
    if (!W.isLand(sp.x + nx * off, sp.z + nz * off)) { nx = -nx; nz = -nz; }
    const x = sp.x + nx * off, z = sp.z + nz * off, ry = Math.atan2(-nx, -nz);   // panel faces the road
    sign = { x, z, nx, nz, tx, tz, ry };
    const ax = Math.cos(ry), az = -Math.sin(ry);                       // along the panel
    for (const s of [-1, 1]) S.add(BOX, 0xd8d2c4, x + ax * s * 2.05, 1.3, z + az * s * 2.05, ry, 0.7, 2.6, 0.7);   // coquina pillars
    for (const s of [-1, 1]) S.add(BOX, 0xe6e1d6, x + ax * s * 2.05, 2.66, z + az * s * 2.05, ry, 0.82, 0.12, 0.82);
    S.add(BOX, 0xf4f2ec, x, 1.55, z, ry, 3.45, 1.45, 0.16);           // white frame behind the panel
    // stone edging and white gravel bed in an arc, with low green shrubs and white oleanders behind
    F.quad([x - ax * 7 - nx * 2.5, 0.05, z - az * 7 - nz * 2.5], [x + ax * 7 - nx * 2.5, 0.05, z + az * 7 - nz * 2.5], [x + ax * 7 + nx * 3.5, 0.05, z + az * 7 + nz * 3.5], [x - ax * 7 + nx * 3.5, 0.05, z - az * 7 + nz * 3.5], 0xe9e5dc);
    for (let k = -8; k <= 8; k++) S.add(BOX, 0xcfc8ba, x + ax * k * 0.85 - nx * (2.6 - Math.abs(k) * 0.04), 0.1, z + az * k * 0.85 - nz * (2.6 - Math.abs(k) * 0.04), ry + 0.3 * (k % 2), 0.6, 0.2, 0.4);
    for (let k = 0; k < 9; k++) {
      const u = (k - 4) * 1.6 + (r() - 0.5), b = 2.2 + r() * 2.2;
      const bx = x + ax * u + nx * b, bz = z + az * u + nz * b;
      const big = Math.abs(u) > 3;
      S.add(BLOB, big ? 0x3e6a2e : 0x4f7d36, bx, big ? 1.4 : 0.5, bz, r() * 6, big ? 1.7 : 0.9, big ? 1.9 : 0.6, big ? 1.7 : 0.9);
      if (big) for (let f = 0; f < 7; f++) S.add(BLOB, 0xf6f4ee, bx + (r() - 0.5) * 2.6, 0.9 + r() * 2.3, bz + (r() - 0.5) * 2.6, r() * 6, 0.32, 0.28, 0.32);
    }
    for (let k = 0; k < 6; k++) { const u = (k - 2.5) * 2.4 + (r() - 0.5), b = 5 + r() * 3; sabal(S, r, x + ax * u + nx * b, z + az * u + nz * b, 6.5 + r() * 4); }
    for (let k = 0; k < 6; k++) { const u = (k - 2.5) * 3.2, b = 8.5 + r() * 2; thicket(S, r, x + ax * u + nx * b, z + az * u + nz * b, 2.6); }
    W.bList[W.addCollider([x - ax * 2.6 - nx * 0.6, z - az * 2.6 - nz * 0.6, x + ax * 2.6 - nx * 0.6, z + az * 2.6 - nz * 0.6, x + ax * 2.6 + nx * 0.6, z + az * 2.6 + nz * 0.6, x - ax * 2.6 + nx * 0.6, z - az * 2.6 + nz * 0.6], 2.7)].custom = true;
  }
  G.lbkSign = sign;
  const nearSign = (x, z) => sign && Math.hypot(x - sign.x, z - sign.z) < 16;

  // ------------------------------------------------ South Gulf of Mexico Drive
  const gmd = byName(/Gulf of Mexico Drive|John Ringling Parkway/, ROUTE_BOX, true);
  const bridgeEnd = [3671, 3420];
  for (const s of gmd) {
    const [ax, az, , bx, bz, , hw] = s;
    const len = Math.hypot(bx - ax, bz - az); if (len < 0.5) continue;
    let tx = (bx - ax) / len, tz = (bz - az) / len;
    const west = tx < 0;                        // travel NW: right hand = bay side
    const rx = west ? -tz : tz, rz = west ? tx : -tx;
    const steps = Math.ceil(len / 4);
    for (let k = 0; k < steps; k++) {
      const u0 = k / steps * len, u1 = (k + 1) / steps * len;
      const p0x = ax + tx * u0, p0z = az + tz * u0, p1x = ax + tx * u1, p1z = az + tz * u1;
      const dEnd = Math.hypot(p0x - bridgeEnd[0], p0z - bridgeEnd[1]);
      for (const sd of [-1, 1]) {
        const nx = rx * sd, nz = rz * sd;
        const at = (o, px, pz) => [px + nx * o, pz + nz * o];
        const [mx, mz] = at(hw + 4, (p0x + p1x) / 2, (p0z + p1z) / 2);
        if (!W.isLand(mx, mz)) continue;
        const band = (o0, o1, y, col) => { const A = at(o0, p0x, p0z), B = at(o0, p1x, p1z), C = at(o1, p1x, p1z), D = at(o1, p0x, p0z); F.quad([A[0], y, A[1]], [B[0], y, B[1]], [C[0], y, C[1]], [D[0], y, D[1]], col); };
        const mown = (Math.floor(u0 / 8) % 2) ? 0x74a548 : 0x6c9c43;
        if (sd > 0) {                           // bay side: grass strip, concrete sidewalk / bike path, grass
          band(hw + 0.1, hw + 2.2, 0.035, mown);
          band(hw + 2.2, hw + 4.6, 0.05, 0xcfccc3);
          band(hw + 4.6, hw + 9, 0.035, mown);
        } else band(hw + 0.1, hw + 8, 0.035, mown);
        // guardrail for the first 160 m past the bridge, both sides (101 Gulf of Mexico Dr photo)
        if (dEnd < 160) {
          const [gx, gz] = at(hw + 1.2, (p0x + p1x) / 2, (p0z + p1z) / 2);
          S.add(BOX, 0xb9bdc0, gx, 0.72, gz, Math.atan2(-tz, tx), u1 - u0 + 0.05, 0.32, 0.08);
          const [qx, qz] = at(hw + 1.35, p0x, p0z); S.add(BOX, 0x9a9a92, qx, 0.4, qz, 0, 0.16, 0.8, 0.16);
        }
      }
      // vegetation every ~4 m: dense sea grape and sabal palms near the bridge, lawns with palm groups further on
      for (const sd of [-1, 1]) {
        const dense = dEnd < 650 ? 0.85 : 0.45;
        if (r() > dense) continue;
        const nx = rx * sd, nz = rz * sd, o = hw + (sd > 0 ? 10 : 8.5) + r() * 9;
        const x = p0x + nx * o + tx * r() * 4, z = p0z + nz * o + tz * r() * 4;
        if (!free(x, z) || nearSign(x, z)) continue;
        if (r() < 0.32) sabal(S, r, x, z, 5.5 + r() * 5);
        else if (dense > 0.5 || r() < 0.35) thicket(S, r, x, z, 1.6 + r() * 1.6);
        else S.add(BOX, 0x456f31, x, 0.55, z, Math.atan2(-tz, tx), 4 + r() * 3, 1.1, 1.2);   // clipped hedge
      }
    }
  }

  // ------------------------------------------------ New Pass bridge
  const deck = byName(/Gulf of Mexico Drive|John Ringling Parkway/, BRIDGE_BOX, false);
  let peak = null;
  for (const s of deck) { const y = Math.max(s[2], s[5]); if (!peak || y > peak.y) peak = { x: (s[0] + s[3]) / 2, z: (s[1] + s[4]) / 2, y, s }; }
  for (const s of deck) {
    const [ax, az, ay, bx, bz, by, hw] = s;
    const len = Math.hypot(bx - ax, bz - az); if (len < 0.3) continue;
    const tx = (bx - ax) / len, tz = (bz - az) / len, ry = Math.atan2(-tz, tx), nx = -tz, nz = tx;
    const mx = (ax + bx) / 2, mz = (az + bz) / 2, my = (ay + by) / 2 + 0.1;
    const pitch = Math.atan2(by - ay, len);
    const blue = peak && Math.hypot(mx - peak.x, mz - peak.z) < 22;
    for (const sd of [-1, 1]) {
      const ex = mx + nx * sd * (hw + 0.02), ez = mz + nz * sd * (hw + 0.02);
      S.add(BOX, 0x8f969b, ex, my + 1.22, ez, ry, len + 0.05, 0.08, 0.1, 0, pitch);               // pipe rail on the parapet
      for (let u = 0; u < len; u += 2.5) S.add(BOX, 0x8f969b, ax + tx * u + nx * sd * (hw + 0.02), ay + (by - ay) * u / len + 1.05, az + tz * u + nz * sd * (hw + 0.02), ry, 0.07, 0.36, 0.07);
      if (blue) S.add(BOX, 0x3c9cc8, mx + nx * sd * (hw + 0.12), my - 0.7, mz + nz * sd * (hw + 0.12), ry, len + 0.05, 1.25, 0.12, 0, pitch);   // blue bascule leaf
    }
  }
  if (peak) {
    const [ax, az, , bx, bz] = peak.s;
    const len = Math.hypot(bx - ax, bz - az), tx = (bx - ax) / len, tz = (bz - az) / len, ry = Math.atan2(-tz, tx);
    let nx = -tz, nz = tx; if (nx > 0) { nx = -nx; nz = -nz; }        // tender house on the west (Gulf) side
    const hw = peak.s[6], hx = peak.x + nx * (hw + 3.2) - tx * 14, hz = peak.z + nz * (hw + 3.2) - tz * 14;
    S.add(BOX, 0xbdb8ae, hx, peak.y / 2 - 1, hz, ry, 2.6, peak.y + 1, 2.6);                                     // pier column
    S.add(BOX, 0xe9e6df, hx, peak.y + 1.2, hz, ry, 5.6, 3.0, 4.2);                                              // control house
    S.add(BOX, 0x33434d, hx, peak.y + 2.0, hz, ry, 5.7, 1.0, 4.3);                                              // window band
    S.add(BOX, 0xf2f0ea, hx, peak.y + 2.85, hz, ry, 6.2, 0.3, 4.8);                                             // roof slab
    // fender walls: two long curved timber walls either side of the channel under the leaf
    for (const side of [-1, 1]) {
      const pts = [];
      for (let k = -7; k <= 7; k++) {
        const along = k * 5, flare = Math.max(0, Math.abs(k) - 4) ** 1.4 * 1.8;
        pts.push([peak.x + tx * side * (hw * 0.5 + 9 + flare) + nx * along, peak.z + tz * side * (hw * 0.5 + 9 + flare) + nz * along]);
      }
      for (let k = 0; k < pts.length - 1; k++) {
        const [x0, z0] = pts[k], [x1, z1] = pts[k + 1], L = Math.hypot(x1 - x0, z1 - z0), rot = Math.atan2(-(z1 - z0), x1 - x0);
        S.add(BOX, 0x6e6152, (x0 + x1) / 2, 0.2, (z0 + z1) / 2, rot, L + 0.9, 1.4, 0.9);
        S.add(BOX, 0xd3cec3, (x0 + x1) / 2, 1.05, (z0 + z1) / 2, rot, L + 0.9, 0.3, 1.0);
      }
    }
  }
  // the south foot: guardrail on the right and the yellow DRAW BRIDGE AHEAD diamond
  const foot = byName(/John Ringling Parkway/, [3820, 3640, 3990, 3820], true);
  for (const s of foot) {
    const [ax, az, , bx, bz, , hw] = s, len = Math.hypot(bx - ax, bz - az); if (len < 0.5) continue;
    const tx = (bx - ax) / len, tz = (bz - az) / len, west = tx < 0, rx = west ? -tz : tz, rz = west ? tx : -tx;
    for (let u = 0; u < len; u += 2) {
      const x = ax + tx * u + rx * (hw + 1.3), z = az + tz * u + rz * (hw + 1.3);
      if (!W.isLand(x, z) || Math.hypot(x - 3848, z - 3657) > 140) continue;
      S.add(BOX, 0xb9bdc0, x, 0.72, z, Math.atan2(-tz, tx), 2.05, 0.32, 0.08);
      S.add(BOX, 0x9a9a92, x, 0.4, z, 0, 0.16, 0.8, 0.16);
    }
  }
  const signMeshes = [];
  {
    const tex = canvasTex(256, 256, (c, w, h) => {
      c.fillStyle = 'rgba(0,0,0,0)'; c.clearRect(0, 0, w, h);
      c.save(); c.translate(w / 2, h / 2); c.rotate(Math.PI / 4); c.fillStyle = '#1b1b1b'; c.fillRect(-88, -88, 176, 176); c.fillStyle = '#f2a516'; c.fillRect(-82, -82, 164, 164); c.restore();
      c.fillStyle = '#1b1b1b'; c.font = 'bold 30px Arial'; c.textAlign = 'center';
      c.fillText('DRAW', w / 2, 100); c.fillText('BRIDGE', w / 2, 136); c.fillText('AHEAD', w / 2, 172);
    });
    const fx = 3856, fz = 3664, ry = Math.atan2(0.6, 0.8) ;
    const px = fx + 0.8 * 7.5, pz = fz - 0.6 * 7.5;
    S.add(BOX, 0x8f8f8f, px, 1.4, pz, 0, 0.08, 2.8, 0.08);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }));
    m.position.set(px, 3.1, pz); m.rotation.y = Math.atan2(-0.6, -0.8) + Math.PI * 0 + ry * 0;   // faces drivers heading NW onto the bridge
    m.lookAt(px + 0.6, 3.1, pz + 0.8);
    signMeshes.push(m);
  }
  if (sign) {
    const tex = canvasTex(512, 200, (c, w, h) => {
      c.fillStyle = '#f5f3ee'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#1f3fb8'; c.fillRect(14, 14, w - 28, h - 28);
      c.strokeStyle = '#f5f3ee'; c.lineWidth = 3; c.strokeRect(26, 26, w - 52, h - 52);
      c.fillStyle = '#ffffff'; c.textAlign = 'center';
      c.font = 'italic bold 34px Georgia'; c.fillText('Welcome To', w / 2, 66);
      c.font = 'bold 30px Georgia'; c.fillText('THE TOWN OF', w / 2, 100);
      c.font = 'bold 64px Georgia'; c.fillText('Longboat Key', w / 2, 160);
      c.font = '30px Georgia'; c.fillText('❀', 52, 112); c.fillText('❀', w - 52, 112);
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 1.3), new THREE.MeshLambertMaterial({ map: tex }));
    m.position.set(sign.x - sign.nx * 0.09, 1.55, sign.z - sign.nz * 0.09); m.rotation.y = sign.ry;
    signMeshes.push(m);
  }

  // ------------------------------------------------ Cutter Lane
  const cutter = W.segs.filter((s) => W.roads[s[7]].n === 'Cutter Lane');
  let mb = 0;
  for (const s of cutter) {
    const [ax, az, , bx, bz, , hw] = s, len = Math.hypot(bx - ax, bz - az); if (len < 0.5) continue;
    const tx = (bx - ax) / len, tz = (bz - az) / len, ry = Math.atan2(-tz, tx);
    const steps = Math.ceil(len / 4);
    for (let k = 0; k < steps; k++) {
      const u0 = k / steps * len, u1 = (k + 1) / steps * len;
      for (const sd of [-1, 1]) {
        const nx = -tz * sd, nz = tx * sd;
        const p = (u, o) => [ax + tx * u + nx * o, az + tz * u + nz * o];
        const [cx, cz] = p((u0 + u1) / 2, hw + 4);
        if (!W.isLand(cx, cz)) continue;
        const A = p(u0, hw + 0.1), B = p(u1, hw + 0.1), C = p(u1, hw + 11), D = p(u0, hw + 11);
        F.quad([A[0], 0.03, A[1]], [B[0], 0.03, B[1]], [C[0], 0.03, C[1]], [D[0], 0.03, D[1]], (k + (sd > 0 ? 1 : 0)) % 2 ? 0x79b04a : 0x70a845);
      }
    }
    for (let u = 3; u < len; u += 6) {
      for (const sd of [-1, 1]) {
        const nx = -tz * sd, nz = tx * sd;
        const pick = r();
        const o = hw + 2 + r() * 8, x = ax + tx * u + nx * o, z = az + tz * u + nz * o;
        if (!free(x, z)) continue;
        if (pick < 0.16) sabal(S, r, x, z, 6 + r() * 5);
        else if (pick < 0.5) S.add(BLOB1, GREENS[Math.floor(r() * 5)], x, 1.1, z, r() * 6, 1.6 + r(), 1.4 + r() * 0.8, 1.6 + r());
        else if (pick < 0.7) { S.add(BOX, 0x4f3a2a, x, 0.04, z, ry, 3.2, 0.08, 1.6); for (let f = 0; f < 4; f++) S.add(BLOB, f % 2 ? 0xd85a8a : 0xc2384a, x + (f - 1.5) * 0.7 * tx, 0.35, z + (f - 1.5) * 0.7 * tz, r() * 6, 0.45, 0.35, 0.45); }
      }
      // a mailbox at the curb every ~18 m, alternating sides
      if (u % 18 < 6) {
        const sd = (mb++ % 2) ? 1 : -1, nx = -tz * sd, nz = tx * sd, x = ax + tx * u + nx * (hw + 0.7), z = az + tz * u + nz * (hw + 0.7);
        if (!nearDad(x, z, 14) && W.isLand(x, z)) { S.add(BOX, 0xeeeeea, x, 0.55, z, 0, 0.1, 1.1, 0.1); S.add(BOX, 0xf4f4f0, x, 1.2, z, ry, 0.5, 0.26, 0.24); }
      }
    }
  }

  const solid = S.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  const flat = F.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
  const out = new THREE.Group(); out.name = 'streetview';
  for (const m of [solid, flat, ...signMeshes]) if (m) { m.receiveShadow = true; m.updateMatrix(); out.add(m); }
  scene.add(out);
  let tris = 0; out.traverse((o) => { if (o.isMesh) tris += o.geometry.attributes.position.count / 3; });
  console.log(`streetview pass: ${Math.round(tris)} tris, ${out.children.length} meshes`);
  return out;
}
