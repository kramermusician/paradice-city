// Causeway pass (2026-11-23): the opening drive. Downtown Sarasota towers as seen from the Ringling bridge
// (pale cream, white and peach condo towers with glass bands, a few crowned tops), the Ringling bridge itself
// (smooth light concrete parapet with a pipe rail, box girder soffit, round columns, twin-arm lamps), the
// causeway shoulders and park strips (sand, riprap, sea grape, sabal palms, sandy paths, picnic shelters,
// bay beaches, a few people fishing) and moored boats off the bayfront.
// Lambert only (Safari rule), vertex colours, merged: 2 tower meshes + 1 solid mesh + 1 flat mesh. No shadows.
// Exports: hookTowers(W) before world.load, buildCauseway(scene, W, G) from buildSetPieces. Skip with ?nocw=1.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const DT_BOX = [6740, 2300, 8100, 4000];          // downtown towers visible from the causeway and the bayfront
const CW_BOX = [5380, 3180, 7240, 4520];          // John Ringling Boulevard, Bird Key to US 41
const PARK_BOX = [6480, 3180, 6960, 3460];        // the causeway park strip at the east foot of the bridge
const MARINA = [7470, 3480];                      // off Island Park / Marina Jack

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const inBox = (b, x, z) => x > b[0] && x < b[2] && z > b[1] && z < b[3];

class Bucket {
  constructor() { this.geos = []; }
  add(geo, color, x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz)));
    const c = new THREE.Color(color), n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.geos.push(g);
  }
  quad(a, b, c, d, color) {
    let p = [...a, ...b, ...c, ...a, ...c, ...d];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.computeVertexNormals();
    if (g.attributes.normal.getY(0) < 0) { p = [...a, ...c, ...b, ...a, ...d, ...c]; g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.computeVertexNormals(); }
    this.add(g, color, 0, 0, 0);
  }
  mesh(mat) { if (!this.geos.length) return null; const m = new THREE.Mesh(mergeGeometries(this.geos), mat); m.matrixAutoUpdate = false; m.updateMatrix(); return m; }
}

// raw tower walls: position, normal, colour, uv (u = metres along the wall, v = metres up; roofs get v = -1)
class Raw {
  constructor() { this.p = []; this.n = []; this.c = []; this.u = []; }
  tri(a, b, c, col, ua, ub, uc) {
    const e1 = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), e2 = new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    const nn = e1.cross(e2).normalize();
    for (const [v, uv] of [[a, ua], [b, ub], [c, uc]]) { this.p.push(...v); this.n.push(nn.x, nn.y, nn.z); this.c.push(col.r, col.g, col.b); this.u.push(...uv); }
  }
  quad(a, b, c, d, col, ua, ub, uc, ud) { this.tri(a, b, c, col, ua, ub, uc); this.tri(a, c, d, col, ua, uc, ud); }
  mesh(mat) {
    if (!this.p.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    const m = new THREE.Mesh(g, mat); m.matrixAutoUpdate = false; return m;
  }
}

function towerMat(glassy) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x4c4a46 });   // shade sides stay pale, like the photos
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vT;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvT = uv;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vT;').replace('#include <color_fragment>', `#include <color_fragment>
      if (vT.y >= 0.0) {
        float f = fract(vT.y / 3.2), g = fract(vT.x / 2.6);
        vec3 glass = mix(vec3(0.42, 0.56, 0.64), vec3(0.66, 0.78, 0.84), clamp(f * 1.2, 0.0, 1.0));
        ${glassy ? `
        float slab = step(0.86, f), fin = step(g, 0.07);
        diffuseColor.rgb = mix(glass, diffuseColor.rgb, max(slab, fin * 0.7));` : `
        float win = step(0.2, f) * step(f, 0.72) * step(0.1, g) * step(g, 0.9);
        float slab = step(0.8, f) * step(0.02, g);
        diffuseColor.rgb = mix(diffuseColor.rgb, glass, win * 0.78);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.98, 0.97, 0.95), slab * 0.8);`}
        if (vT.y < 5.0) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.36, 0.44, 0.48), 0.55);
      }`);
  };
  return m;
}

// Called before world.load: once the OSM footprints are indexed, take the tall downtown ones away from the
// generic builder (colliders stay) so buildCauseway can draw them as condo towers.
export function hookTowers(W) {
  const orig = W.addHouses.bind(W);
  W.addHouses = () => {
    W.cwTowers = [];
    for (const b of W.bList) {
      if (b.custom || b.h < 20 || !inBox(DT_BOX, b.cx, b.cz)) continue;
      b.custom = true; b.cwTower = true; W.cwTowers.push(b);
    }
    return orig();
  };
}

const BOX = new THREE.BoxGeometry(1, 1, 1);
const BLOB = new THREE.IcosahedronGeometry(1, 0);
const TRUNK = new THREE.CylinderGeometry(0.2, 0.26, 1, 6, 1).translate(0, 0.5, 0);
const COL = new THREE.CylinderGeometry(1, 1, 1, 10, 1).translate(0, 0.5, 0);
const PYR = new THREE.ConeGeometry(1, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0);
const DOME = new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2);
const FAN = new THREE.CircleGeometry(1.7, 7, -0.5, 1.0).rotateZ(Math.PI / 2);
const GREENS = [0x4f7f36, 0x5b8c3c, 0x46753a, 0x67944a, 0x55843f];

function sabal(S, r, x, z, h) {
  S.add(TRUNK, 0x8a7f6c, x, 0, z, 0, 1, h, 1);
  S.add(BLOB, 0x5d7f37, x, h + 0.15, z, r() * 6, 0.9, 0.7, 0.9);
  for (let k = 0; k < 9; k++) S.add(FAN, k % 2 ? 0x6a8c3e : 0x5b7d34, x, h + 0.2, z, k / 9 * 6.283 + r() * 0.3, 1, 1, 1, k % 3 === 0 ? 0.7 : 1.25 + r() * 0.35);
}
function seagrape(S, r, x, z, size) {
  const n = 2 + Math.floor(r() * 3);
  for (let k = 0; k < n; k++) {
    const w = size * (0.6 + r() * 0.5), h = size * (0.5 + r() * 0.4);
    S.add(BLOB, GREENS[Math.floor(r() * GREENS.length)], x + (r() - 0.5) * size * 1.4, h * 0.7, z + (r() - 0.5) * size * 1.4, r() * 6, w, h, w);
  }
}
function person(S, r, x, y, z, face, rod) {
  const shirt = [0xf2f2ee, 0x3d7fb8, 0xe0a33a, 0xc8553d, 0x6aa36b][Math.floor(r() * 5)];
  S.add(BOX, 0x3b4656, x, y + 0.45, z, face, 0.34, 0.9, 0.24);
  S.add(BOX, shirt, x, y + 1.2, z, face, 0.44, 0.62, 0.28);
  S.add(BOX, 0xc99a74, x, y + 1.66, z, face, 0.22, 0.26, 0.22);
  S.add(BOX, 0xe8dcc0, x, y + 1.82, z, face, 0.36, 0.06, 0.36);   // sun hat
  if (rod) { const fx = Math.cos(face), fz = -Math.sin(face); S.add(BOX, 0x2a2a2a, x + fx * 1.6, y + 2.2, z + fz * 1.6, face, 3.6, 0.04, 0.04, 0, 0.5); }
}

export function buildCauseway(scene, W, G) {
  const S = new Bucket(), F = new Bucket(), P = new Bucket(), r = rng(1123);
  const free = (x, z) => W.isLand(x, z) && !W.buildingAt(x, z) && !W.roadAt(x, z, 0);
  const nearWater = (x, z, d) => { for (let a = 0; a < 8; a++) if (!W.isLand(x + Math.cos(a * 0.785) * d, z + Math.sin(a * 0.785) * d)) return true; return false; };
  let tris = 0;

  // ------------------------------------------------ downtown towers
  const glassW = new Raw(), balcW = new Raw();
  const PAL = [0xf3ead8, 0xf6f4ee, 0xf1dcc6, 0xeadcc2, 0xe6e4de, 0xf4e4cf, 0xefe9e0];
  for (const b of W.cwTowers || []) {
    const p = b.poly, n = p.length / 2;
    const glassy = r() < 0.32, R = glassy ? glassW : balcW;
    const h = b.h * (0.95 + r() * 0.2);
    const col = new THREE.Color(glassy ? 0xf2f2ee : PAL[Math.floor(r() * PAL.length)]);
    let area = 0;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; area += p[i * 2] * p[j * 2 + 1] - p[j * 2] * p[i * 2 + 1]; }
    const flip = area > 0;
    let u = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      let ax = p[i * 2], az = p[i * 2 + 1], bx = p[j * 2], bz = p[j * 2 + 1];
      if (flip) { [ax, bx] = [bx, ax]; [az, bz] = [bz, az]; }
      const len = Math.hypot(bx - ax, bz - az);
      R.quad([ax, 0, az], [bx, 0, bz], [bx, h, bz], [ax, h, az], col, [u, 0], [u + len, 0], [u + len, h], [u, h]);
      u += len;
    }
    const contour = []; for (let i = 0; i < n; i++) contour.push(new THREE.Vector2(p[i * 2], p[i * 2 + 1]));
    const roof = new THREE.Color(0xe9e7e1);
    for (const [a, bq, c] of THREE.ShapeUtils.triangulateShape(contour, [])) {
      const va = [p[a * 2], h, p[a * 2 + 1]], vb = [p[bq * 2], h, p[bq * 2 + 1]], vc = [p[c * 2], h, p[c * 2 + 1]];
      const cross = (vb[0] - va[0]) * (vc[2] - va[2]) - (vb[2] - va[2]) * (vc[0] - va[0]);
      if (cross > 0) R.tri(va, vc, vb, roof, [-1, -1], [-1, -1], [-1, -1]); else R.tri(va, vb, vc, roof, [-1, -1], [-1, -1], [-1, -1]);
    }
    // crown: penthouse box on every tower, signature tops (terracotta hip, white dome, open frame) on the tall ones
    let bb = b.bb || [b.cx - 10, b.cz - 10, b.cx + 10, b.cz + 10];
    const w = Math.max(6, Math.min(bb[2] - bb[0], bb[3] - bb[1]) * 0.5);
    S.add(BOX, col.getHex(), b.cx, h + 2, b.cz, 0, w, 4, w);
    S.add(BOX, 0xfafaf7, b.cx, h + 4.15, b.cz, 0, w + 0.8, 0.3, w + 0.8);
    if (h > 45) {
      const kind = Math.floor(r() * 3);
      if (kind === 0) S.add(PYR, 0xb8664a, b.cx, h + 4.3, b.cz, 0, w * 0.78, w * 0.55, w * 0.78);
      else if (kind === 1) { S.add(COL, 0xf4f1ea, b.cx, h + 4.3, b.cz, 0, w * 0.3, 2.5, w * 0.3); S.add(DOME, 0xe9e3d6, b.cx, h + 6.8, b.cz, 0, w * 0.3, w * 0.3, w * 0.3); }
      else for (const s of [-1, 1]) S.add(BOX, 0xf8f8f4, b.cx + s * w * 0.42, h + 7, b.cz, 0, 0.6, 6, w * 0.9);
    }
  }
  const mats = [towerMat(true), towerMat(false)];
  for (const [R, m] of [[glassW, mats[0]], [balcW, mats[1]]]) { const mesh = R.mesh(m); if (mesh) { scene.add(mesh); tris += R.p.length / 9; } }

  // ------------------------------------------------ the Ringling bridge
  const isCw = (s) => /John Ringling Boulevard/.test(W.roads[s[7]].n || '') && inBox(CW_BOX, (s[0] + s[3]) / 2, (s[1] + s[4]) / 2);
  const deck = W.segs.filter((s) => isCw(s) && Math.max(s[2], s[5]) >= 0.4);
  const ground = W.segs.filter((s) => isCw(s) && Math.max(s[2], s[5]) < 0.4);
  let accL = 0, accC = 0;
  for (const s of deck) {
    const [ax, az, ay, bx, bz, by, hw] = s;
    const len = Math.hypot(bx - ax, bz - az); if (len < 0.3) continue;
    const tx = (bx - ax) / len, tz = (bz - az) / len, ry = Math.atan2(-tz, tx), nx = -tz, nz = tx;
    const mx = (ax + bx) / 2, mz = (az + bz) / 2, my = (ay + by) / 2, pitch = Math.atan2(by - ay, len);
    for (const sd of [-1, 1]) {
      const ex = mx + nx * sd * (hw - 0.02), ez = mz + nz * sd * (hw - 0.02);   // parapet swallows the world's thin rail (no z-fight)
      P.add(BOX, 0xa9a69f, ex, my + 0.45, ez, ry, len + 0.06, 1.15, 0.62, 0, pitch);                 // smooth parapet
      S.add(BOX, 0xd9d6ce, ex + nx * sd * 0.45, my - 0.8, ez + nz * sd * 0.45, ry, len + 0.06, 1.5, 0.3, 0, pitch);   // light fascia
      S.add(BOX, 0xb7bcc0, ex, my + 1.2, ez, ry, len + 0.06, 0.09, 0.09, 0, pitch);              // pipe rail
    }
    if (my > 2.5) S.add(BOX, 0xd2cfc7, mx, my - 2.2, mz, ry, len + 0.06, 2.2, hw * 1.4, 0, pitch);   // box girder soffit
    accL += len; accC += len;
    if (accC > 48 && my > 4) { accC = 0; S.add(COL, 0xdedbd3, mx, -1, mz, 0, 2.1, my - 2.2, 2.1); }
    if (accL > 44) {
      accL = 0;
      let ox = nx, oz = nz;                                     // outer edge: away from the twin deck
      const twin = W.roadAt(mx + nx * (hw + 6), mz + nz * (hw + 6), my);
      if (twin && twin.y > 0.4) { ox = -nx; oz = -nz; }
      const px = mx + ox * (hw + 0.25), pz = mz + oz * (hw + 0.25), y0 = my + 1.0;
      S.add(TRUNK, 0xc4c8cb, px, y0, pz, 0, 0.8, 10, 0.8);
      for (const a of [-1, 1]) {                                // twin arms curving out along the road
        S.add(BOX, 0xc4c8cb, px + tx * a * 1.0, y0 + 10.4, pz + tz * a * 1.0, ry, 2.2, 0.1, 0.1, 0, a * 0.35);
        S.add(BOX, 0xc4c8cb, px + tx * a * 2.2 - ox * 0.5, y0 + 10.8, pz + tz * a * 2.2 - oz * 0.5, ry + 1.2 * a, 0.9, 0.1, 0.1);
        S.add(BOX, 0xfff3d6, px + tx * a * 2.6 - ox * 0.9, y0 + 10.7, pz + tz * a * 2.6 - oz * 0.9, ry, 0.8, 0.18, 0.36);
      }
    }
  }
  // the world's generic bridge lamps and square piers on this bridge give way to the ones above
  const near = (x, z) => deck.some((s) => Math.hypot(x - (s[0] + s[3]) / 2, z - (s[1] + s[4]) / 2) < 20);
  const m4 = new THREE.Matrix4(), v = new THREE.Vector3(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (const im of W.group.children) {
    if (!im.isInstancedMesh) continue;
    for (let i = 0; i < im.count; i++) { im.getMatrixAt(i, m4); v.setFromMatrixPosition(m4); if (inBox(CW_BOX, v.x, v.z) && near(v.x, v.z)) im.setMatrixAt(i, zero); }
    im.instanceMatrix.needsUpdate = true;
  }

  // ------------------------------------------------ causeway shoulders: sand, riprap, sea grape, palms, anglers
  for (const s of ground) {
    const [ax, az, , bx, bz, , hw] = s;
    const len = Math.hypot(bx - ax, bz - az); if (len < 0.5) continue;
    const tx = (bx - ax) / len, tz = (bz - az) / len, nx = -tz, nz = tx;
    const steps = Math.ceil(len / 5);
    for (let k = 0; k < steps; k++) {
      const u0 = k / steps * len, u1 = (k + 1) / steps * len;
      for (const sd of [-1, 1]) {
        const at = (o, u) => [ax + tx * u + nx * sd * o, az + tz * u + nz * sd * o];
        const [mx, mz] = at(hw + 2, (u0 + u1) / 2);
        if (!W.isLand(mx, mz)) continue;
        const band = (o0, o1, y, c) => { const A = at(o0, u0), B = at(o0, u1), C = at(o1, u1), D = at(o1, u0); F.quad([A[0], y, A[1]], [B[0], y, B[1]], [C[0], y, C[1]], [D[0], y, D[1]], c); };
        band(hw + 0.1, hw + 1.8, 0.04, (k & 1) ? 0xe4d6b2 : 0xdfd0aa);                          // sandy shoulder
        // riprap where the fill meets the bay
        for (let o = hw + 4; o < hw + 34; o += 3) {
          const [qx, qz] = at(o, (u0 + u1) / 2);
          if (W.isLand(qx, qz)) continue;
          for (let q = 0; q < 3; q++) S.add(BLOB, [0xa9a49a, 0x8e8a82, 0xbdb7aa][q], qx + (r() - 0.5) * 3, -0.1, qz + (r() - 0.5) * 3, r() * 6, 0.9 + r() * 0.6, 0.6 + r() * 0.4, 0.9 + r() * 0.6);
          if (r() < 0.05) person(S, r, qx - nx * sd * 1.5, 0.3, qz - nz * sd * 1.5, Math.atan2(-nz * sd, nx * sd), true);
          break;
        }
        if (r() < 0.35) { const [x, z] = at(hw + 4 + r() * 6, u0 + r() * 5); if (free(x, z)) (r() < 0.4 ? sabal(S, r, x, z, 5 + r() * 4) : seagrape(S, r, x, z, 1.4 + r() * 1.2)); }
      }
    }
  }
  // anglers on the bridge walkway near the east foot (the causeway's fishing crowd)
  for (const s of deck) {
    const my = Math.max(s[2], s[5]);
    if (my > 7 || r() > 0.12) continue;
    const len = Math.hypot(s[3] - s[0], s[4] - s[1]) || 1, nx = -(s[4] - s[1]) / len, nz = (s[3] - s[0]) / len;
    for (const sd of [-1, 1]) {
      const x = (s[0] + s[3]) / 2 + nx * sd * (s[6] + 0.9), z = (s[1] + s[4]) / 2 + nz * sd * (s[6] + 0.9);
      if (W.roadAt(x, z, my) && W.roadAt(x, z, my).d < s[6]) continue;
      if (!W.isLand(x + nx * sd * 8, z + nz * sd * 8)) { person(S, r, x - nx * sd * 0.6, my - 0.2, z - nz * sd * 0.6, Math.atan2(-nz * sd, nx * sd), true); break; }
    }
  }

  // ------------------------------------------------ park strips: bay beaches, sandy paths, shelters, palms
  for (let x = PARK_BOX[0]; x < PARK_BOX[2]; x += 4) for (let z = PARK_BOX[1]; z < PARK_BOX[3]; z += 4) {
    if (!W.isLand(x + 2, z + 2) || W.roadAt(x + 2, z + 2, 0) || W.buildingAt(x + 2, z + 2)) continue;
    if (nearWater(x + 2, z + 2, 9)) F.quad([x, 0.03, z], [x + 4, 0.03, z], [x + 4, 0.03, z + 4], [x, 0.03, z + 4], nearWater(x + 2, z + 2, 4) ? 0xeadfc4 : 0xe2d4b0);
  }
  const park = ground.filter((s) => inBox(PARK_BOX, s[0], s[1]));
  let accS = 0;
  for (const s of park) {
    const [ax, az, , bx, bz, , hw] = s;
    const len = Math.hypot(bx - ax, bz - az); if (len < 0.5) continue;
    const tx = (bx - ax) / len, tz = (bz - az) / len, nx = -tz, nz = tx, ry = Math.atan2(-tz, tx);
    for (const sd of [-1, 1]) {                                  // a sandy footpath 14 m off the road
      const o = hw + 14, A = [ax + nx * sd * o, az + nz * sd * o], B = [bx + nx * sd * o, bz + nz * sd * o];
      if (!W.isLand(A[0], A[1]) || !W.isLand(B[0], B[1])) continue;
      F.quad([A[0] - nx * 1.2, 0.045, A[1] - nz * 1.2], [B[0] - nx * 1.2, 0.045, B[1] - nz * 1.2], [B[0] + nx * 1.2, 0.045, B[1] + nz * 1.2], [A[0] + nx * 1.2, 0.045, A[1] + nz * 1.2], 0xd9c9a2);
    }
    accS += len;
    if (accS > 70) {
      accS = 0;
      const sd = r() < 0.5 ? -1 : 1, x = (ax + bx) / 2 + nx * sd * (hw + 22), z = (az + bz) / 2 + nz * sd * (hw + 22);
      if (free(x, z) && free(x + 4, z + 4) && free(x - 4, z - 4)) {           // picnic shelter: 4 posts, teal hip roof, a table
        for (const [px, pz] of [[-2.6, -1.8], [2.6, -1.8], [2.6, 1.8], [-2.6, 1.8]]) S.add(BOX, 0xf2efe8, x + tx * px + nx * pz, 1.25, z + tz * px + nz * pz, ry, 0.22, 2.5, 0.22);
        S.add(PYR, 0x3f8a8c, x, 2.5, z, ry, 4.6, 1.6, 3.4);
        S.add(BOX, 0x8a6a4a, x, 0.75, z, ry, 2.4, 0.1, 0.9);
        S.add(BOX, 0x8a6a4a, x, 0.4, z, ry, 2.4, 0.08, 2.0);
        for (let q = 0; q < 3; q++) sabal(S, r, x + (r() - 0.5) * 16, z + (r() - 0.5) * 16, 6 + r() * 4);
      }
    }
  }
  for (let k = 0; k < 160; k++) {                                // scattered palms and sea grape over the park
    const x = PARK_BOX[0] + r() * (PARK_BOX[2] - PARK_BOX[0]), z = PARK_BOX[1] + r() * (PARK_BOX[3] - PARK_BOX[1]);
    if (!free(x, z)) continue;
    const rd = W.nearestRoadPoint(x, z, {}); if (rd && Math.hypot(rd.x - x, rd.z - z) < 7) continue;
    if (nearWater(x, z, 6)) { if (r() < 0.6) seagrape(S, r, x, z, 1.5 + r()); }
    else if (r() < 0.5) sabal(S, r, x, z, 5 + r() * 5);
  }
  // a few people on the beaches
  for (let k = 0, placed = 0; k < 400 && placed < 10; k++) {
    const x = PARK_BOX[0] + r() * (PARK_BOX[2] - PARK_BOX[0]), z = PARK_BOX[1] + r() * (PARK_BOX[3] - PARK_BOX[1]);
    if (W.isLand(x, z) && nearWater(x, z, 3) && !W.roadAt(x, z, 0)) { person(S, r, x, 0, z, r() * 6, r() < 0.5); placed++; }
  }

  // ------------------------------------------------ moored boats off the bayfront (Marina Jack)
  for (let k = 0, placed = 0; k < 600 && placed < 46; k++) {
    const a = r() * 6.283, d = 30 + r() * 260, x = MARINA[0] + Math.cos(a) * d, z = MARINA[1] + Math.sin(a) * d;
    if (W.isLand(x, z)) continue;
    if (W.isLand(x + 8, z) || W.isLand(x - 8, z) || W.isLand(x, z + 8) || W.isLand(x, z - 8)) continue;
    const ry = r() * 6.283, L = 8 + r() * 8, sail = r() < 0.6;
    S.add(BOX, 0xf7f7f4, x, 0.1, z, ry, L, 1.4, L * 0.32);
    S.add(PYR, 0xf7f7f4, x + Math.cos(ry) * L * 0.5, -0.6, z - Math.sin(ry) * L * 0.5, ry, L * 0.16, 1.4, L * 0.16, 0, -Math.PI / 2);
    S.add(BOX, 0x2f5f86, x, -0.45, z, ry, L * 1.01, 0.25, L * 0.33);
    if (sail) S.add(TRUNK, 0xdedede, x, 0.7, z, 0, 0.35, L * 1.3, 0.35);
    else S.add(BOX, 0xe9eef0, x - Math.cos(ry) * L * 0.08, 1.4, z + Math.sin(ry) * L * 0.08, ry, L * 0.4, 1.3, L * 0.26);
    placed++;
  }

  const solid = S.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x2a2a27 }));
  const flat = F.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
  const para = P.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x7a7872 }));   // parapets: bright on the shade side too
  for (const m of [solid, flat, para]) if (m) { scene.add(m); tris += m.geometry.attributes.position.count / 3; }
  G.causeway = { tris: Math.round(tris), towers: (W.cwTowers || []).length };
  console.log('causeway pass', G.causeway);
}
