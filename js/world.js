// The world: OpenStreetMap land, water, roads, bridges, buildings and palms, plus the
// spatial queries the vehicles use (road height, land test, building collisions, area names).
// Map data (c) OpenStreetMap contributors, ODbL.
import * as THREE from 'three';
import { xz, ISLAND_LINE } from './config.js';
import { makeWaterMaterial } from './water.js';
import { armandsPlace } from './armands.js';
import { buildBuildings as drawBuildings, wallShader } from './buildings.js';
import { plantGreenery, greeneryMeshes, updateGreenery } from './greenery.js';

const TILE = 1000;
const RANK = { service: 0, residential: 1, unclassified: 1, living_street: 1, footway: 0, tertiary: 2, secondary: 3, primary: 4, trunk: 4, motorway: 4 };
const DEFAULT_LIMIT = { primary: 45, trunk: 45, secondary: 35, tertiary: 30, unclassified: 30, residential: 25, living_street: 15, service: 15 };

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

class Buf { // growable vertex + color + uv arrays for one merged mesh
  constructor() { this.p = []; this.c = []; this.u = []; this.s = []; this.cur = [0, 0]; }   // cur: [style, seed] for the wall shader (js/buildings.js)
  tri(a, b, c, col, ua, ub, uc) {
    this.p.push(...a, ...b, ...c);
    const cu = this.cur; this.s.push(cu[0], cu[1], cu[0], cu[1], cu[0], cu[1]);
    for (let i = 0; i < 3; i++) this.c.push(col[0], col[1], col[2]);
    if (ua) this.u.push(...ua, ...ub, ...uc); else this.u.push(0, 0, 0, 0, 0, 0);
  }
  quad(a, b, c, d, col, ua, ub, uc, ud) { this.tri(a, b, c, col, ua, ub, uc); this.tri(a, c, d, col, ua, uc, ud); }
  geometry() {
    if (!this.p.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setAttribute('st', new THREE.Float32BufferAttribute(this.s, 2));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

export class World {
  constructor() {
    this.tiles = new Map();
    this.group = new THREE.Group();
    this.exclusions = []; // [x, z, r] areas cleared of OSM buildings (our own models go there)
    this.extraColliders = [];
  }

  tile(x, z) {
    const k = Math.floor(x / TILE) + ',' + Math.floor(z / TILE);
    let t = this.tiles.get(k);
    if (!t) {
      t = { roads: new Buf(), lines: new Buf(), bridge: new Buf(), bld: new Buf(), cx: (Math.floor(x / TILE) + 0.5) * TILE, cz: (Math.floor(z / TILE) + 0.5) * TILE, group: new THREE.Group(), palms: [], poles: [], piers: [] };
      this.tiles.set(k, t);
    }
    return t;
  }

  async load(scene, progress = () => {}) {
    const get = (f) => fetch(f).then((r) => { if (!r.ok) throw new Error(f + ' ' + r.status); return r.json(); });
    progress('Loading map data');
    const [roads, areas, blds, wm] = await Promise.all([get('data/roads.json'), get('data/areas.json'), get('data/buildings.json'), get('data/world-meta.json')]);
    this.meta = roads.meta;
    this.roads = roads.roads;
    this.areas = areas;
    this.wm = wm;
    this.islandLine = ISLAND_LINE;
    progress('Painting the islands');
    await this.loadMask();
    this.buildGround(scene);
    progress('Paving Gulf of Mexico Drive');
    this.buildRoads();
    if (this.beforeBuildings) this.beforeBuildings(this);
    progress('Raising buildings');
    this.buildingsRaw = blds.b;
    this.indexBuildings();
    this.addHouses();
    this.buildBuildings();
    progress('Planting palms');
    this.buildPalms();
    progress('Planting trees and hedges');
    { const ac = armandsPlace(this); this.armandsCentre = ac; plantGreenery(this); }
    this.finishTiles();
    scene.add(this.group);
    this.islandLine = ISLAND_LINE;
  }

  // ------------------------------------------------------------- mask
  async loadMask() {
    const img = new Image();
    img.src = 'data/world.png';
    await img.decode();
    const { w: W, h: H } = this.wm;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    this.mask = ctx.getImageData(0, 0, W, H).data;
    this.maskImg = img;
  }
  px(x, z) {
    const { x0, z0, cell, w, h } = this.wm;
    const i = Math.floor((x - x0) / cell), j = Math.floor((z - z0) / cell);
    if (i < 0 || j < 0 || i >= w || j >= h) return -1;
    return (j * w + i) * 4;
  }
  isLand(x, z) { const p = this.px(x, z); return p < 0 ? true : this.mask[p] > 127; }
  inBounds(x, z, pad = 60) { const b = this.meta.bounds; return x > b[0] + pad && x < b[2] - pad && z > b[1] + pad && z < b[3] - pad; }
  // smooth landness 0..1 (bilinear), used for shoreline normals
  land01(x, z) {
    const { x0, z0, cell, w, h } = this.wm;
    const fx = (x - x0) / cell - 0.5, fz = (z - z0) / cell - 0.5;
    const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
    const s = (a, b) => (a < 0 || b < 0 || a >= w || b >= h) ? 1 : this.mask[(b * w + a) * 4] / 255;
    return (s(i, j) * (1 - tx) + s(i + 1, j) * tx) * (1 - tz) + (s(i, j + 1) * (1 - tx) + s(i + 1, j + 1) * tx) * tz;
  }
  shoreNormal(x, z) { // points from land toward water
    const e = 6;
    const gx = this.land01(x + e, z) - this.land01(x - e, z);
    const gz = this.land01(x, z + e) - this.land01(x, z - e);
    const l = Math.hypot(gx, gz) || 1;
    return [-gx / l, -gz / l];
  }

  buildGround(scene) {
    const { x0, z0, cell, w: W, h: H } = this.wm;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const out = ctx.createImageData(W, H);
    const m = this.mask, o = out.data;
    const r = rng(7);
    for (let i = 0; i < W * H; i++) {
      const p = i * 4;
      const land = m[p], g = m[p + 1], s = m[p + 2];
      let c;
      if (s > 127) c = [241, 233, 213];   // Longboat Key sand is nearly white
      else if (g > 200) c = [104, 158, 74];
      else if (g > 150) c = [92, 132, 66];
      else if (g > 90) c = [76, 108, 60];
      else c = [128, 150, 92];
      const n = (r() - 0.5) * 14;
      o[p] = c[0] + n; o[p + 1] = c[1] + n; o[p + 2] = c[2] + n * 0.6; o[p + 3] = land;
    }
    ctx.putImageData(out, 0, 0);
    this.groundCanvas = cv;
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const mat = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5 });
    const geo = new THREE.PlaneGeometry(W * cell, H * cell);
    geo.rotateX(-Math.PI / 2);
    const ground = new THREE.Mesh(geo, mat);
    ground.position.set(x0 + W * cell / 2, 0, z0 + H * cell / 2);
    ground.receiveShadow = true;
    scene.add(ground);
    this.ground = ground;

    // blurred low-res land mask for shallow-water color
    const sm = document.createElement('canvas');
    sm.width = Math.round(W / 4); sm.height = Math.round(H / 4);
    const sctx = sm.getContext('2d');
    sctx.filter = 'blur(3px)';
    sctx.drawImage(this.maskImg, 0, 0, sm.width, sm.height);
    const shallow = new THREE.CanvasTexture(sm);
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000, 1, 1).rotateX(-Math.PI / 2), makeWaterMaterial(shallow, [x0, z0, W * cell, H * cell]));
    this.water.position.y = -0.35;
    this.water.renderOrder = -1;
    scene.add(this.water);
  }

  // ------------------------------------------------------------- roads
  buildRoads() {
    const segs = [];
    this.segGrid = new Map();
    const C = 40;
    const lampPts = [], pierPts = [];
    this.roads.forEach((rd, ri) => {
      const p = rd.p, n = p.length / 3;
      if (n < 2) return;
      const hw = rd.w / 2;
      const rank = RANK[rd.k] ?? 1;
      const off = 0.06 + rank * 0.025;
      rd.off = off;   // how far the drawn surface sits above the map height (js/bikes.js rides on it)
      rd.limit = this.limitFor(rd);
      const t = this.tile(p[0], p[1]);
      const L = [], Rt = [];
      for (let i = 0; i < n; i++) {
        const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
        let tx = p[b * 3] - p[a * 3], tz = p[b * 3 + 1] - p[a * 3 + 1];
        const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
        L.push([p[i * 3] - tz * hw, p[i * 3 + 2] + off, p[i * 3 + 1] + tx * hw]);
        Rt.push([p[i * 3] + tz * hw, p[i * 3 + 2] + off, p[i * 3 + 1] - tx * hw]);
      }
      const shade = 0.2 + rank * 0.012 + (rd.k === 'service' ? 0.03 : 0);
      const col = [shade * 0.95, shade, shade * 1.12];
      for (let i = 0; i < n - 1; i++) t.roads.quad(L[i], L[i + 1], Rt[i + 1], Rt[i], col);

      // segments for physics
      for (let i = 0; i < n - 1; i++) {
        const ax = p[i * 3], az = p[i * 3 + 1], ay = p[i * 3 + 2], bx = p[i * 3 + 3], bz = p[i * 3 + 4], by = p[i * 3 + 5];
        const si = segs.length;
        segs.push([ax, az, ay + off, bx, bz, by + off, hw, ri]);
        const i0 = Math.floor((Math.min(ax, bx) - hw) / C), i1 = Math.floor((Math.max(ax, bx) + hw) / C);
        const j0 = Math.floor((Math.min(az, bz) - hw) / C), j1 = Math.floor((Math.max(az, bz) + hw) / C);
        for (let ii = i0; ii <= i1; ii++) for (let jj = j0; jj <= j1; jj++) {
          const k = ii * 100000 + jj;
          let a = this.segGrid.get(k); if (!a) this.segGrid.set(k, a = []); a.push(si);
        }
      }

      // markings
      const yellow = [0.85, 0.66, 0.12], white = [0.86, 0.86, 0.82];
      const strip = (lat, wdt, colr, dashed) => {
        let s = 0;
        for (let i = 0; i < n - 1; i++) {
          const ax = p[i * 3], az = p[i * 3 + 1], bx = p[i * 3 + 3], bz = p[i * 3 + 4];
          const len = Math.hypot(bx - ax, bz - az);
          if (len < 0.01) continue;
          const tx = (bx - ax) / len, tz = (bz - az) / len, nx = -tz, nz = tx;
          const steps = dashed ? Math.max(1, Math.round(len / 3)) : 1;
          for (let k = 0; k < steps; k++) {
            const u0 = k / steps, u1 = (k + 1) / steps;
            const sm = s + len * u0;
            if (dashed && Math.floor(sm / 3) % 3 !== 0) continue;
            const pa = [ax + (bx - ax) * u0, az + (bz - az) * u0], pb = [ax + (bx - ax) * u1, az + (bz - az) * u1];
            const ya = p[i * 3 + 2] + (p[i * 3 + 5] - p[i * 3 + 2]) * u0 + off + 0.03;
            const yb = p[i * 3 + 2] + (p[i * 3 + 5] - p[i * 3 + 2]) * u1 + off + 0.03;
            const o1 = lat + wdt / 2, o2 = lat - wdt / 2; // same winding as the road ribbon (faces up)
            t.lines.quad([pa[0] + nx * o1, ya, pa[1] + nz * o1], [pb[0] + nx * o1, yb, pb[1] + nz * o1], [pb[0] + nx * o2, yb, pb[1] + nz * o2], [pa[0] + nx * o2, ya, pa[1] + nz * o2], colr);
          }
          s += len;
        }
      };
      const major = rank >= 3, mid = rank === 2;
      if ((major || mid) && !rd.o && rd.w >= 6.5) {
        if (major) { strip(-0.18, 0.13, yellow, false); strip(0.18, 0.13, yellow, false); }
        else strip(0, 0.13, yellow, true);
      } else if (rd.o && major) strip(0, 0.13, white, true);
      if (major && rd.w >= 8) { strip(-(hw - 0.35), 0.14, white, false); strip(hw - 0.35, 0.14, white, false); }

      // bridge decks, railings, lamps, piers
      if (rd.b) {
        const con = [0.55, 0.54, 0.52], under = [0.32, 0.31, 0.3], rail = [0.46, 0.46, 0.47];
        let acc = 0, accP = 0, side = 0;
        for (let i = 0; i < n - 1; i++) {
          const ya = p[i * 3 + 2], yb = p[i * 3 + 5];
          if (Math.max(ya, yb) < 0.4) continue;
          const la = L[i], lb = L[i + 1], ra = Rt[i], rb = Rt[i + 1];
          const dn = (v, d) => [v[0], v[1] - d, v[2]];
          t.bridge.quad(la, dn(la, 1.2), dn(lb, 1.2), lb, con);
          t.bridge.quad(rb, dn(rb, 1.2), dn(ra, 1.2), ra, con);
          t.bridge.quad(dn(la, 1.2), dn(ra, 1.2), dn(rb, 1.2), dn(lb, 1.2), under);
          const up = (v, d) => [v[0], v[1] + d, v[2]];
          t.bridge.quad(up(la, 0.9), la, lb, up(lb, 0.9), rail);
          t.bridge.quad(up(lb, 0.9), lb, la, up(la, 0.9), rail);
          t.bridge.quad(up(ra, 0.9), ra, rb, up(rb, 0.9), rail);
          t.bridge.quad(up(rb, 0.9), rb, ra, up(ra, 0.9), rail);
          const sl = Math.hypot(lb[0] - la[0], lb[2] - la[2]);
          acc += sl; accP += sl;
          if (acc > 42 && rd.b > 4) {
            acc = 0; side ^= 1;
            const v = side ? lb : rb;
            const cx = (lb[0] + rb[0]) / 2, cz = (lb[2] + rb[2]) / 2;
            lampPts.push([v[0] + (v[0] - cx) * 0.04, v[1], v[2] + (v[2] - cz) * 0.04, Math.atan2(cx - v[0], cz - v[2])]);
          }
          if (accP > 36 && yb > 2.2) {
            accP = 0;
            pierPts.push([(lb[0] + rb[0]) / 2, yb + off - 1.2, (lb[2] + rb[2]) / 2, Math.atan2(rb[0] - lb[0], rb[2] - lb[2]), rd.w]);
          }
        }
      }
    });
    this.segs = segs;
    this.buildBridgeBits(lampPts, pierPts);
  }

  buildBridgeBits(lamps, piers) {
    if (lamps.length) {
      const pole = new THREE.CylinderGeometry(0.09, 0.14, 9, 6).translate(0, 4.5, 0);
      const head = new THREE.BoxGeometry(1.4, 0.22, 0.45).translate(0, 9, 0.6);
      const arm = new THREE.BoxGeometry(0.08, 0.08, 1.2).translate(0, 8.95, 0.3);
      const pm = new THREE.InstancedMesh(pole, new THREE.MeshLambertMaterial({ color: 0x8a8d90 }), lamps.length);
      const am = new THREE.InstancedMesh(arm, new THREE.MeshLambertMaterial({ color: 0x8a8d90 }), lamps.length);
      const hm = new THREE.InstancedMesh(head, new THREE.MeshBasicMaterial({ color: 0xffe2a8 }), lamps.length);
      const o = new THREE.Object3D();
      lamps.forEach(([x, y, z, a], i) => { o.position.set(x, y, z); o.rotation.set(0, a, 0); o.updateMatrix(); pm.setMatrixAt(i, o.matrix); am.setMatrixAt(i, o.matrix); hm.setMatrixAt(i, o.matrix); });
      this.group.add(pm, am, hm);
    }
    if (piers.length) {
      const g = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
      const im = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ color: 0x9a968e }), piers.length * 2);
      const o = new THREE.Object3D();
      let k = 0;
      for (const [x, top, z, a, w] of piers) {
        for (const s of [-1, 1]) {
          o.position.set(x + Math.sin(a) * s * w * 0.28, -3, z + Math.cos(a) * s * w * 0.28);
          o.rotation.set(0, a, 0);
          o.scale.set(1.6, top + 3, 1.6);
          o.updateMatrix(); im.setMatrixAt(k++, o.matrix);
        }
      }
      this.group.add(im);
    }
  }

  limitFor(rd) {
    const n = rd.n || '';
    if (/Saint Armands Circle|St\.? Armands Circle/i.test(n)) return 20;
    if (/Bay Isles Parkway/i.test(n)) return 25;
    if (/Gulf of Mexico Drive/i.test(n)) return rd.s || 45;
    if (rd.s) return rd.s;
    return DEFAULT_LIMIT[rd.k] || 25;
  }

  // Road under (x, z) closest in height to yRef. Returns {y, road, hw, d, dir, cx, cz} (cx, cz: nearest centerline point) or null.
  roadAt(x, z, yRef = 0) {
    const C = 40;
    const cell = this.segGrid.get(Math.floor(x / C) * 100000 + Math.floor(z / C));
    if (!cell) return null;
    let best = null, bestDy = 1e9;
    for (const si of cell) {
      const s = this.segs[si];
      const dx = s[3] - s[0], dz = s[4] - s[1];
      const l2 = dx * dx + dz * dz || 1e-6;
      let u = ((x - s[0]) * dx + (z - s[1]) * dz) / l2;
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      const px = s[0] + dx * u, pz = s[1] + dz * u;
      const d = Math.hypot(x - px, z - pz);
      if (d > s[6] + 0.6) continue;
      const y = s[2] + (s[5] - s[2]) * u;
      if (y > yRef + 2.6) continue;
      // Same level (a deck and its ramps): nearest centreline wins, so a bend never hands the car to a
      // segment further along with a different height. A different level only wins on height.
      const dy = Math.abs(y - yRef) < 1.5 ? d * 0.01 : 100 + Math.abs(y - yRef);
      if (dy < bestDy) { bestDy = dy; best = { y, road: this.roads[s[7]], hw: s[6], d, dir: Math.atan2(-dz, dx), cx: px, cz: pz }; }
    }
    return best;
  }

  // Nearest point on any road (optionally filtered). Brute force; used for respawns and setup.
  nearestRoadPoint(x, z, filter = {}) {
    let best = null, bd = 1e18;
    for (const s of this.segs) {
      const rd = this.roads[s[7]];
      if (filter.name && rd.n !== filter.name) continue;
      if (filter.ground && (s[2] > 0.5 || s[5] > 0.5)) continue;
      if (filter.major && (RANK[rd.k] ?? 0) < 2) continue;
      const dx = s[3] - s[0], dz = s[4] - s[1];
      const l2 = dx * dx + dz * dz || 1e-6;
      let u = ((x - s[0]) * dx + (z - s[1]) * dz) / l2;
      u = Math.max(0, Math.min(1, u));
      const px = s[0] + dx * u, pz = s[1] + dz * u;
      const d = (x - px) ** 2 + (z - pz) ** 2;
      if (d < bd) { bd = d; best = { x: px, z: pz, y: s[2] + (s[5] - s[2]) * u, heading: Math.atan2(-dz, dx), road: rd, dist: Math.sqrt(d) }; }
    }
    return best;
  }

  nearestWater(x, z, maxR = 400) {
    if (!this.isLand(x, z)) return [x, z];
    for (let r = 5; r < maxR; r += 5) for (let a = 0; a < 24; a++) {
      const px = x + Math.cos(a / 24 * Math.PI * 2) * r, pz = z + Math.sin(a / 24 * Math.PI * 2) * r;
      if (!this.isLand(px, pz)) return [px, pz];
    }
    return [x, z];
  }

  // ------------------------------------------------------------- buildings
  indexBuildings() {
    this.bGrid = new Map();
    this.bList = [];
    const C = 50;
    const keep = (cx, cz) => !this.exclusions.some(([ex, ez, er]) => (cx - ex) ** 2 + (cz - ez) ** 2 < er * er);
    for (const b of this.buildingsRaw) {
      const n = (b.length - 1) / 2;
      if (n < 3) continue;
      let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9, cx = 0, cz = 0;
      for (let i = 0; i < n; i++) {
        const x = b[1 + i * 2], z = b[2 + i * 2];
        minx = Math.min(minx, x); maxx = Math.max(maxx, x); minz = Math.min(minz, z); maxz = Math.max(maxz, z); cx += x; cz += z;
      }
      cx /= n; cz /= n;
      if (!keep(cx, cz)) continue;
      this.addCollider(b.slice(1), b[0], [minx, minz, maxx, maxz], cx, cz);
    }
  }
  addCollider(poly, h, bb, cx, cz) {
    const C = 50;
    const idx = this.bList.length;
    if (!bb) {
      let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9; cx = 0; cz = 0;
      for (let i = 0; i < poly.length; i += 2) { minx = Math.min(minx, poly[i]); maxx = Math.max(maxx, poly[i]); minz = Math.min(minz, poly[i + 1]); maxz = Math.max(maxz, poly[i + 1]); cx += poly[i]; cz += poly[i + 1]; }
      cx /= poly.length / 2; cz /= poly.length / 2; bb = [minx, minz, maxx, maxz];
    }
    this.bList.push({ poly, h, bb, cx, cz });
    for (let i = Math.floor(bb[0] / C); i <= Math.floor(bb[2] / C); i++)
      for (let j = Math.floor(bb[1] / C); j <= Math.floor(bb[3] / C); j++) {
        const k = i * 100000 + j;
        let a = this.bGrid.get(k); if (!a) this.bGrid.set(k, a = []); a.push(idx);
      }
    return idx;
  }
  // Is (x, z) inside a building? Returns the building or null.
  buildingAt(x, z) {
    const a = this.bGrid.get(Math.floor(x / 50) * 100000 + Math.floor(z / 50));
    if (!a) return null;
    for (const i of a) {
      const b = this.bList[i];
      if (x < b.bb[0] || x > b.bb[2] || z < b.bb[1] || z > b.bb[3]) continue;
      const p = b.poly, n = p.length / 2;
      let inside = false;
      for (let k = 0, l = n - 1; k < n; l = k++) {
        const xk = p[k * 2], zk = p[k * 2 + 1], xl = p[l * 2], zl = p[l * 2 + 1];
        if ((zk > z) !== (zl > z) && x < (xl - xk) * (z - zk) / (zl - zk) + xk) inside = !inside;
      }
      if (inside) return b;
    }
    return null;
  }

  // OSM has few house footprints on the islands: line residential streets with simple houses.
  addHouses() {
    const r = rng(1234);
    const boxes = [[27.335, -82.700, 27.447, -82.585], [27.295, -82.592, 27.340, -82.553], [27.322, -82.556, 27.350, -82.528]].map(([s, w, n, e]) => {
      const [x0, z1] = xz(s, w), [x1, z0] = xz(n, e); return [x0, z0, x1, z1];
    });
    const inBox = (x, z) => boxes.some((b) => x > b[0] && x < b[2] && z > b[1] && z < b[3]);
    let n = 0;
    this.canalLots = [];
    for (const rd of this.roads) {
      if (!/residential|living_street|unclassified/.test(rd.k)) continue;
      const p = rd.p, np = p.length / 3;
      for (let i = 0; i < np - 1; i++) {
        if (p[i * 3 + 2] > 0.2) continue;
        const ax = p[i * 3], az = p[i * 3 + 1], bx = p[i * 3 + 3], bz = p[i * 3 + 4];
        const len = Math.hypot(bx - ax, bz - az);
        if (len < 18) continue;
        const tx = (bx - ax) / len, tz = (bz - az) / len, ang = Math.atan2(-tz, tx);
        for (let sd = 9; sd < len - 9; sd += 22 + r() * 6) {
          for (const side of [-1, 1]) {
            if (r() < 0.12) continue;
            const W = 12 + r() * 5, D = 10 + r() * 4, off = rd.w / 2 + 6 + D / 2;
            const cx = ax + tx * sd - tz * off * side, cz = az + tz * sd + tx * off * side;
            if (!inBox(cx, cz)) continue;
            const poly = [];
            const c = Math.cos(ang), s2 = Math.sin(ang);
            for (const [lx, lz] of [[-W / 2, -D / 2], [W / 2, -D / 2], [W / 2, D / 2], [-W / 2, D / 2]]) poly.push(cx + lx * c + lz * s2, cz - lx * s2 + lz * c);
            let ok = true;
            for (let k = 0; k < 8 && ok; k += 2) {
              const qx = poly[k], qz = poly[k + 1];
              if (!this.isLand(qx, qz) || this.buildingAt(qx, qz) || this.roadAt(qx, qz, 0)) ok = false;
            }
            if (!ok || this.buildingAt(cx, cz) || this.roadAt(cx, cz, 0)) continue;
            if (this.exclusions.some(([ex, ez, er]) => (cx - ex) ** 2 + (cz - ez) ** 2 < er * er)) continue;
            let hh = r() < 0.3 ? 6.8 : 3.8 + r() * 0.8;
            const lbk = /^(Cutter|Channel) Lane$/.test(rd.n || '');   // Street View: single-storey white houses, pale metal roofs
            if (lbk) hh = 3.4 + (hh % 1) * 0.6;
            const idx = this.addCollider(poly, hh);
            this.bList[idx].hip = true; if (lbk) this.bList[idx].lbk = true;
            // the house's own frame for js/buildings.js: t along the street, n from the street toward the back yard
            this.bList[idx].house = { cx, cz, tx, tz, nx: -tz * side, nz: tx * side, W, D };
            n++;
            // canal-front lot? walk out the back of the house to the seawall (bay side only, no Gulf beach docks)
            const nx = -tz * side, nz = tx * side;
            for (let d = 2; d <= 30; d += 2) {
              const qx = cx + nx * (D / 2 + d), qz = cz + nz * (D / 2 + d);
              if (this.roadAt(qx, qz, 0) || this.buildingAt(qx, qz)) break;
              if (!this.isLand(qx, qz)) {
                if (this.westOfIslands(qx, qz)) break;
                // need real water out there (a canal at least ~14 m wide), not a pond corner
                if (this.isLand(qx + nx * 12, qz + nz * 12)) break;
                this.canalLots.push({ x: cx + nx * (D / 2 + d - 2), z: cz + nz * (D / 2 + d - 2), nx, nz, tx, tz, r: Math.abs(Math.sin(cx * 12.9898 + cz * 78.233) * 43758.5453) % 1 });
                break;
              }
            }
          }
        }
      }
    }
    this.houseCount = n;
  }

  buildBuildings() { drawBuildings(this); }   // js/buildings.js

  // ------------------------------------------------------------- palms
  buildPalms() {
    const r = rng(9);
    const pts = [];
    // no code-built palms within 100 m of St. Armands Circle: js/armands.js plants its own trees there
    const ac = armandsPlace(this);
    const ok = (x, z) => this.isLand(x, z) && !this.buildingAt(x, z) && !this.roadAt(x, z, 0) && this.inBounds(x, z, 100) && Math.hypot(x - ac.x, z - ac.z) > ac.palms;
    for (const rd of this.roads) {
      const rank = RANK[rd.k] ?? 0;
      if (rank < 2 && !(rank === 1 && r() < 0.25)) continue;
      const p = rd.p, n = p.length / 3;
      let acc = r() * 20;
      const step = rank >= 3 ? 19 : 34;
      for (let i = 0; i < n - 1; i++) {
        if (p[i * 3 + 2] > 0.2) continue;
        const ax = p[i * 3], az = p[i * 3 + 1], bx = p[i * 3 + 3], bz = p[i * 3 + 4];
        const len = Math.hypot(bx - ax, bz - az);
        if (len < 0.01) continue;
        const tx = (bx - ax) / len, tz = (bz - az) / len;
        for (let s = acc; s < len; s += step) {
          for (const side of [-1, 1]) {
            if (rank < 3 && r() < 0.5) continue;
            const off = rd.w / 2 + 2.5 + r() * 2.5;
            const x = ax + tx * s - tz * off * side + (r() - 0.5) * 3, z = az + tz * s + tx * off * side + (r() - 0.5) * 3;
            if (ok(x, z)) pts.push([x, z]);
          }
        }
        acc = (acc - len) % step; if (acc < 0) acc += step;
      }
    }
    // clumps in parks and along beaches
    const { x0, z0, cell, w, h } = this.wm;
    for (let k = 0; k < 60000 && pts.length < 14000; k++) {
      const i = Math.floor(r() * w), j = Math.floor(r() * h), q = (j * w + i) * 4;
      if (this.mask[q] < 128) continue;
      const g = this.mask[q + 1], s = this.mask[q + 2];
      if (!((g > 150 && r() < 0.35) || (s > 127 && r() < 0.5))) continue;
      const x = x0 + (i + 0.5) * cell, z = z0 + (j + 0.5) * cell;
      if (ok(x, z)) pts.push([x, z]);
    }
    for (const [x, z] of pts) this.tile(x, z).palms.push([x, z, 6 + r() * 6, r() * 6.28, r()]);
    this.palmCount = pts.length;

    // geometry shared by all tiles
    this.trunkGeo = new THREE.CylinderGeometry(0.16, 0.26, 1, 6, 1).translate(0, 0.5, 0);
    const fronds = [];
    for (let k = 0; k < 9; k++) {
      const a = k / 9 * Math.PI * 2 + (k % 2) * 0.2;
      const pos = [];
      const segsN = 4, L = 3.4;
      for (let s = 0; s < segsN; s++) {
        const u0 = s / segsN, u1 = (s + 1) / segsN;
        const pt = (u) => [Math.cos(a) * u * L, 0.3 + u * 1.0 - u * u * 2.4, Math.sin(a) * u * L];
        const wdt = (u) => 0.55 * Math.sin(Math.PI * Math.min(1, u * 1.1 + 0.08));
        const p0 = pt(u0), p1 = pt(u1), w0 = wdt(u0), w1 = wdt(u1);
        const nx = -Math.sin(a), nz = Math.cos(a);
        const A = [p0[0] + nx * w0, p0[1] - w0 * 0.25, p0[2] + nz * w0], B = [p0[0] - nx * w0, p0[1] - w0 * 0.25, p0[2] - nz * w0];
        const Cc = [p1[0] - nx * w1, p1[1] - w1 * 0.25, p1[2] - nz * w1], D = [p1[0] + nx * w1, p1[1] - w1 * 0.25, p1[2] + nz * w1];
        pos.push(...A, ...p0, ...p1, ...A, ...p1, ...D, ...p0, ...B, ...Cc, ...p0, ...Cc, ...p1);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      fronds.push(g);
    }
    const merged = mergeSimple(fronds);
    merged.computeVertexNormals();
    this.crownGeo = merged;
    this.trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a7458 });
    this.crownMat = new THREE.MeshLambertMaterial({ color: 0x4f7a34, side: THREE.DoubleSide });
  }

  finishTiles() {
    const road = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    const lines = new THREE.MeshBasicMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8, fog: true });
    const bridge = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const bld = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, shadowSide: THREE.BackSide });
    bld.onBeforeCompile = wallShader;
    const o = new THREE.Object3D();
    for (const t of this.tiles.values()) {
      t.casters = []; t.detail = [];
      const add = (buf, mat, shadow) => {
        const g = buf.geometry(); if (!g) return null;
        const m = new THREE.Mesh(g, mat);
        m.receiveShadow = true; m.castShadow = !!shadow;
        if (shadow) t.casters.push(m);
        t.group.add(m);
        return m;
      };
      add(t.roads, road);
      const lm = add(t.lines, lines); if (lm) t.detail.push(lm);
      const bm = add(t.bridge, bridge, true); if (bm) bm.receiveShadow = false;
      add(t.bld, bld, true);
      if (t.palms.length) {
        const tm = new THREE.InstancedMesh(this.trunkGeo, this.trunkMat, t.palms.length);
        const cm = new THREE.InstancedMesh(this.crownGeo, this.crownMat, t.palms.length);
        t.palms.forEach(([x, z, h, a, k], i) => {
          const lean = (k - 0.5) * 0.12;
          o.position.set(x, 0, z); o.rotation.set(lean, a, 0); o.scale.set(1, h, 1); o.updateMatrix(); tm.setMatrixAt(i, o.matrix);
          o.position.set(x + Math.sin(a) * h * lean * 0, h, z - Math.cos(a) * h * lean); o.rotation.set(0, a, 0); const s = 0.85 + k * 0.4; o.scale.set(s, s, s); o.updateMatrix(); cm.setMatrixAt(i, o.matrix);
        });
        tm.computeBoundingSphere(); cm.computeBoundingSphere();
        tm.castShadow = cm.castShadow = true;
        t.casters.push(tm, cm);
        t.palmMeshes = [tm, cm];
        t.group.add(tm, cm);
      }
      greeneryMeshes(this, t);
      t.roads = t.lines = t.bridge = t.bld = null;
      this.group.add(t.group);
    }
  }

  update(cam) {
    for (const t of this.tiles.values()) {
      const d = Math.hypot(t.cx - cam.x, t.cz - cam.z);
      t.group.visible = d < (this.viewDist || 4300);
      const near = d < 900;
      for (const m of t.casters) m.castShadow = near;
      for (const m of t.detail) m.visible = d < 1600;
      if (t.palmMeshes) for (const m of t.palmMeshes) m.visible = d < 2600;
      updateGreenery(t, d);
    }
  }

  // ------------------------------------------------------------- names
  lineX(z) {
    const L = this.islandLine;
    for (let i = 0; i < L.length - 1; i++) {
      const [ax, az] = L[i], [bx, bz] = L[i + 1];
      if (z >= az && z <= bz) return ax + (bx - ax) * (z - az) / (bz - az || 1);
    }
    return z < L[0][1] ? L[0][0] : L[L.length - 1][0];
  }
  westOfIslands(x, z) { return x < this.lineX(z); }
  westOfIslandsOld(x, z) {
    const L = this.islandLine;
    for (let i = 0; i < L.length - 1; i++) {
      const [ax, az] = L[i], [bx, bz] = L[i + 1];
      if ((z >= az && z <= bz) || (z <= az && z >= bz)) {
        const u = (z - az) / (bz - az || 1);
        return x < ax + (bx - ax) * u;
      }
    }
    return x < L[0][0];
  }
  areaName(x, z, onRoad) {
    const ll = (la, lo) => xz(la, lo);
    const near = (la, lo, r) => { const [px, pz] = ll(la, lo); return Math.hypot(px - x, pz - z) < r; };
    if (onRoad && onRoad.b && /John Ringling Parkway|Gulf of Mexico Drive/.test(onRoad.n || '')) return 'New Pass Bridge';
    if (onRoad && /John Ringling/.test(onRoad.n || '') && onRoad.b) return 'Ringling Causeway';
    if (!this.isLand(x, z)) return this.westOfIslands(x, z) ? 'Gulf of Mexico' : 'Sarasota Bay';
    if (near(27.3185, -82.5772, 380)) return 'St. Armands';
    if (near(27.3185, -82.5615, 750)) return 'Bird Key';
    const lx = this.lineX(z);
    // New Pass divides the keys. It runs on a slant, so the test is which side of the pass a point is on,
    // measured along the bridge (2026-11-25: the south tip of Longboat Key used to read as Lido Key).
    const north = (x - 3780) * 0.596 + (z - 3566) * 0.803 < 0;
    if (north && x < lx + 900) return 'Longboat Key';
    if (!north && x < lx + 700) return 'Lido Key';
    if (near(27.3331, -82.5780, 480)) return 'City Island';   // Mote Aquarium and the bait shop, at the foot of the New Pass bridge
    const [xDT] = ll(0, -82.557);
    if (x > xDT && z > ll(27.355, 0)[1]) return 'Downtown Sarasota';
    if (x > xDT) return z < ll(27.39, 0)[1] ? 'Bradenton' : 'Sarasota';
    return 'Ringling Causeway';
  }
}

function mergeSimple(geos) {
  let n = 0; for (const g of geos) n += g.attributes.position.count;
  const arr = new Float32Array(n * 3); let o = 0;
  for (const g of geos) { arr.set(g.attributes.position.array, o); o += g.attributes.position.array.length; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  return g;
}
