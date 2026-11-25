// Greenery pass (2026-11-25): the keys are lush in every reference photo (banyans and sea grapes along Gulf of
// Mexico Drive, clipped hedges and flowering shrubs at every house, mangroves on the bay shore) and the game was
// bare lawn with palms. This plants broadleaf trees, tall pines, shrubs, hedges and mangroves:
//   - around every house (front beds, a yard tree, side hedges) and every small OSM building
//   - in thick bands along Gulf of Mexico Drive and the other main island roads, street trees on the mainland
//   - clumps in parks and on the golf courses, scattered trees on open island land
//   - a mangrove fringe on undeveloped bay shores
// Per 1 km tile: one InstancedMesh for trees, one for pines, one for shrubs (per-instance colour for the greens and
// the flowers). Lambert, flat shaded, no textures. Trees show within 2 km, shrubs within 800 m.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const NO_GMD = [2240, 2560, 3730, 3480];      // js/streetview.js already plants this stretch of Gulf of Mexico Drive
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function colored(geo, hex, jitter = 0, seed = 1) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
  const c = new THREE.Color(hex), n = g.attributes.position.count, col = new Float32Array(n * 3), r = rng(seed);
  for (let i = 0; i < n; i += 3) { const j = 1 + (r() - 0.5) * jitter; for (let k = 0; k < 3; k++) { col[(i + k) * 3] = c.r * j; col[(i + k) * 3 + 1] = c.g * j; col[(i + k) * 3 + 2] = c.b * j; } }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
function blob(r, sx, sy, sz, x, y, z, hex, seed) {
  const g = new THREE.IcosahedronGeometry(r, 0); const p = g.attributes.position, q = rng(seed);
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * sx, p.getY(i) * sy, p.getZ(i) * sz);
  g.rotateY(q() * 6.28); g.translate(x, y, z);
  return colored(g, hex, 0.22, seed);
}
// unit geometries (about 1 m tall; scaled per instance)
function treeGeo() {
  const trunk = colored(new THREE.CylinderGeometry(0.035, 0.06, 0.5, 4, 1, true).translate(0, 0.25, 0), 0x8a735c);
  return mergeGeometries([trunk, blob(0.38, 1.25, 0.72, 1.25, 0, 0.68, 0, 0xffffff, 3), blob(0.28, 1.25, 0.7, 1.25, 0.27, 0.57, 0.12, 0xdcebd2, 5)]);
}
function pineGeo() {
  const trunk = colored(new THREE.CylinderGeometry(0.02, 0.04, 0.5, 4, 1, true).translate(0, 0.25, 0), 0x6b5a48);
  const cone = (r, h, y, hex, s) => colored(new THREE.ConeGeometry(r, h, 6, 1, true).translate(0, y, 0), hex, 0.2, s);
  return mergeGeometries([trunk, cone(0.2, 0.5, 0.5, 0xffffff, 2), cone(0.15, 0.42, 0.74, 0xe4eedd, 4)]);
}
function shrubGeo() {
  const g = new THREE.IcosahedronGeometry(0.5, 0); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, Math.max(0, p.getY(i) * 1.1 + 0.42));
  return colored(g, 0xffffff, 0.25, 9);
}

const GREENS = [0x5c8f3e, 0x6a9c46, 0x4f8440, 0x77a34a, 0x4a7d44, 0x6b9454, 0x86ac50].map((h) => new THREE.Color(h));
const SHRUBS = [0x66994a, 0x578a42, 0x76a650, 0x5f944c, 0x88b058].map((h) => new THREE.Color(h));
const FLOWERS = [0xc93a6a, 0xd9445a, 0xe86a3a, 0xd9c23a, 0xf2f0ea, 0xb24cc0].map((h) => new THREE.Color(h));
const MANGROVE = [0x3f6e40, 0x487540, 0x3a653c].map((h) => new THREE.Color(h));

export function plantGreenery(W) {
  const r = rng(77);
  const add = (kind, x, z, s, sy, col) => { const t = W.tile(x, z); (t[kind] || (t[kind] = [])).push([x, z, s, sy, r() * 6.28, col]); };
  const clear = (x, z, m = 0) => W.isLand(x, z) && !W.buildingAt(x, z) && !W.roadAt(x, z, 0) && W.inBounds(x, z, 100)
    && (!m || (!W.roadAt(x + m, z, 0) && !W.roadAt(x - m, z, 0) && !W.roadAt(x, z + m, 0) && !W.roadAt(x, z - m, 0) && !W.buildingAt(x + m, z) && !W.buildingAt(x - m, z) && !W.buildingAt(x, z + m) && !W.buildingAt(x, z - m)));
  const ac = W.armandsCentre || null;
  const far = (x, z) => !ac || Math.hypot(x - ac.x, z - ac.z) > ac.clear + 5;
  const tree = (x, z, big = 1) => { if (!clear(x, z, 1.6) || !far(x, z)) return; const pine = r() < 0.12; const h = (pine ? 9 + r() * 7 : 5 + r() * 5.5) * big; add(pine ? 'pines' : 'trees', x, z, h * (pine ? 1 : 0.72), h * (pine ? 1 : 0.85 + r() * 0.3), GREENS[Math.floor(r() * GREENS.length)]); };
  const shrub = (x, z, w = 1.2 + r() * 1.3, h = 0.8 + r() * 0.9, flower = 0.1) => { if (!clear(x, z) || !far(x, z)) return; const fl = r() < flower; add('shrubs', x, z, fl ? Math.min(w, 1.3) : w, fl ? Math.min(h, 0.9) : h, fl ? FLOWERS[Math.floor(r() * FLOWERS.length)] : SHRUBS[Math.floor(r() * SHRUBS.length)]); };
  let nT = 0;

  // ---- houses and small buildings
  for (const b of W.bList) {
    if (b.custom) continue;
    if (b.yard) {
      const { P, W: w, D } = b.yard;
      const n = 1 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) { const [x, z] = P.g((r() - 0.5) * w * 0.9, -0.9 - r() * 0.8); shrub(x, z, 1.0 + r() * 0.9, 0.7 + r() * 0.7, 0.3); }
      if (r() < 0.6) { const [x, z] = P.g((r() < 0.5 ? -1 : 1) * w * (0.3 + r() * 0.15), -3.2 - r() * 1.5); tree(x, z, 0.8); }
      if (r() < 0.65) { const [x, z] = P.g((r() - 0.5) * w, D + 3 + r() * 4); tree(x, z); }
      if (r() < 0.45) { const sd = r() < 0.5 ? -1 : 1; for (let v = -1; v < D; v += 2.1) { const [x, z] = P.g(sd * (w / 2 + 1.6), v); shrub(x, z, 1.7, 1.3 + (b.cx % 1) * 0.3, 0); } }
    } else if (b.bb[2] - b.bb[0] < 45 && b.bb[3] - b.bb[1] < 45) {
      const p = b.poly, n = p.length / 2;
      for (let i = 0; i < n; i++) {
        if (r() < 0.45) continue;
        const dx = p[i * 2] - b.cx, dz = p[i * 2 + 1] - b.cz, l = Math.hypot(dx, dz) || 1;
        shrub(p[i * 2] + dx / l * 1.8, p[i * 2 + 1] + dz / l * 1.8, 1.2 + r(), 0.8 + r() * 0.8, 0.22);
        if (r() < 0.3) tree(p[i * 2] + dx / l * (5 + r() * 4), p[i * 2 + 1] + dz / l * (5 + r() * 4));
      }
    }
  }
  // ---- roadsides
  for (const rd of W.roads) {
    const island = rd.p[0] < 6300;
    const gmd = /Gulf of Mexico Drive/.test(rd.n || ''), major = /primary|secondary|tertiary|trunk/.test(rd.k);
    if (!gmd && !major && !(island && /residential|unclassified/.test(rd.k) && r() < 0.5)) continue;
    const p = rd.p, n = p.length / 3;
    const step = gmd ? 7 : major ? (island ? 11 : 20) : 26;
    let acc = r() * step;
    for (let i = 0; i < n - 1; i++) {
      if (p[i * 3 + 2] > 0.2) continue;
      const ax = p[i * 3], az = p[i * 3 + 1], bx = p[i * 3 + 3], bz = p[i * 3 + 4];
      const len = Math.hypot(bx - ax, bz - az); if (len < 0.01) continue;
      const tx = (bx - ax) / len, tz = (bz - az) / len;
      for (let s = acc; s < len; s += step) {
        for (const side of [-1, 1]) {
          const cx = ax + tx * s, cz = az + tz * s;
          if (gmd && cx > NO_GMD[0] && cx < NO_GMD[2] && cz > NO_GMD[1] && cz < NO_GMD[3]) continue;
          if (gmd) {
            // a thick band: low shrubs near the verge, trees behind, more trees deeper in
            if (r() < 0.55) { const o = rd.w / 2 + 4.5 + r() * 2; shrub(cx - tz * o * side + (r() - 0.5) * 3, cz + tx * o * side + (r() - 0.5) * 3, 1.6 + r() * 1.6, 1.0 + r() * 1.2, 0.12); }
            if (r() < 0.7) { const o = rd.w / 2 + 8 + r() * 6; tree(cx - tz * o * side + (r() - 0.5) * 4, cz + tx * o * side + (r() - 0.5) * 4, 1.1); nT++; }
            if (r() < 0.45) { const o = rd.w / 2 + 16 + r() * 14; tree(cx - tz * o * side + (r() - 0.5) * 6, cz + tx * o * side + (r() - 0.5) * 6, 1.2); }
          } else if (r() < (island ? 0.6 : 0.4)) {
            const o = rd.w / 2 + 3.5 + r() * (island ? 6 : 2);
            if (r() < 0.6) tree(cx - tz * o * side, cz + tx * o * side, island ? 1 : 0.85); else shrub(cx - tz * o * side, cz + tx * o * side);
          }
        }
      }
      acc = (acc - len) % step; if (acc < 0) acc += step;
    }
  }
  // ---- parks, golf courses and open island land (from the baked mask)
  const { x0, z0, cell, w, h } = W.wm;
  let placed = 0;
  for (let k = 0; k < 300000 && placed < 15000; k++) {
    const i = Math.floor(r() * w), j = Math.floor(r() * h), q = (j * w + i) * 4;
    if (W.mask[q] < 128) continue;
    const g = W.mask[q + 1], sand = W.mask[q + 2] > 127;
    if (sand) continue;
    const x = x0 + (i + 0.5) * cell, z = z0 + (j + 0.5) * cell, island = x < 6300;
    const park = g > 150;
    if (!(park ? r() < 0.5 : island ? r() < 0.3 : r() < 0.035)) continue;
    const before = (W.tile(x, z).trees || []).length + (W.tile(x, z).pines || []).length;
    tree(x, z, park ? 1.15 : 1);
    if ((W.tile(x, z).trees || []).length + (W.tile(x, z).pines || []).length > before) {
      placed++;
      if (r() < 0.5) { const a = r() * 6.28, d = 3 + r() * 5; tree(x + Math.cos(a) * d, z + Math.sin(a) * d); }
      if (r() < 0.6) { const a = r() * 6.28, d = 2 + r() * 4; shrub(x + Math.cos(a) * d, z + Math.sin(a) * d, 1.5 + r() * 2, 0.9 + r()); }
    }
  }
  // ---- mangroves: bay-side shores with nothing built near them
  let mg = 0;
  const built = (x, z) => { for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++) if (W.bGrid.get((Math.floor(x / 50) + a) * 100000 + Math.floor(z / 50) + c)) return true; return false; };
  for (let k = 0; k < 400000 && mg < 9000; k++) {
    const i = Math.floor(r() * w), j = Math.floor(r() * h), q = (j * w + i) * 4;
    if (W.mask[q] < 128 || W.mask[q + 2] > 127) continue;
    const x = x0 + (i + 0.5) * cell, z = z0 + (j + 0.5) * cell;
    if (W.westOfIslands(x - 60, z) || !W.inBounds(x, z, 100)) continue;
    const a = r() * 6.28, wx = x + Math.cos(a) * 7, wz = z + Math.sin(a) * 7;
    if (W.isLand(wx, wz) || W.westOfIslands(wx, wz)) continue;
    if (built(x, z) || W.roadAt(x, z, 0) || W.roadAt(wx, wz, 3) || !far(x, z)) continue;
    let near = false; for (let d = 6; d <= 30 && !near; d += 8) for (let b2 = 0; b2 < 6.28; b2 += 1.05) if (W.roadAt(x + Math.cos(b2) * d, z + Math.sin(b2) * d, 0)) { near = true; break; }
    if (near) continue;
    add('shrubs', x + Math.cos(a) * 2.5, z + Math.sin(a) * 2.5, 4 + r() * 4, 2.4 + r() * 1.8, MANGROVE[Math.floor(r() * 3)]);
    if (r() < 0.5) add('shrubs', x - Math.cos(a) * 2, z - Math.sin(a) * 2, 4 + r() * 3, 3 + r() * 2, MANGROVE[Math.floor(r() * 3)]);
    mg++;
  }
  let t = 0, s = 0; for (const tl of W.tiles.values()) { t += (tl.trees || []).length + (tl.pines || []).length; s += (tl.shrubs || []).length; }
  W.greenCount = { trees: t, shrubs: s, mangroves: mg };
}

let GEO = null, MAT = null;
// called per tile from World.finishTiles
export function greeneryMeshes(W, t) {
  if (!GEO) { GEO = { trees: treeGeo(), pines: pineGeo(), shrubs: shrubGeo() }; MAT = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }); }
  const o = new THREE.Object3D(); t.green = {};
  for (const kind of ['trees', 'pines', 'shrubs']) {
    const list = t[kind]; if (!list || !list.length) continue;
    const m = new THREE.InstancedMesh(GEO[kind], MAT, list.length);
    list.forEach(([x, z, s, sy, a, col], i) => {
      o.position.set(x, kind === 'shrubs' ? -0.05 : 0, z); o.rotation.set(0, a, 0);
      if (kind === 'shrubs') o.scale.set(s, sy, s * (0.8 + (i % 5) * 0.1)); else o.scale.set(s, sy, s);
      o.updateMatrix(); m.setMatrixAt(i, o.matrix); m.setColorAt(i, col);
    });
    m.instanceColor.needsUpdate = true; m.computeBoundingSphere();
    m.castShadow = kind !== 'shrubs'; m.receiveShadow = false;
    t.group.add(m); t.green[kind] = m; t[kind] = null;
  }
}
export function updateGreenery(t, d) {
  const g = t.green; if (!g) return;
  if (g.trees) { g.trees.visible = d < 1900; g.trees.castShadow = d < 620; }
  if (g.pines) g.pines.castShadow = d < 620;
  if (g.pines) g.pines.visible = d < 1900;
  if (g.shrubs) g.shrubs.visible = d < 950;
}
