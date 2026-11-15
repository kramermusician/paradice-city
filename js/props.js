// Props from Kramer's Dropbox "3d assets" set (2026-11-13): police Explorer, yacht, LNG tanker,
// sea turtles, real palms and bushes. build/prep_dropbox_assets.py makes the web copies in assets/props/.
// Everything here is optional: if a file fails to load the game falls back to its code-built model.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const PROPS = {};
const FILES = { police: 'police-explorer', yacht: 'yacht', lng: 'lng-ship', turtle: 'sea-turtle', palms: 'palms', bush: 'bush',
  bigboat: 'dad-big-boat', kayak: 'pedal-kayak' };   // Dad's dock (2026-11-15), built in Blender for this game
const COMPACT = new Set(['police', 'yacht', 'lng', 'bigboat', 'kayak']);

export async function loadProps() {
  const loader = new GLTFLoader();
  await Promise.all(Object.entries(FILES).map(async ([k, f]) => {
    try {
      const g = await loader.loadAsync(`assets/props/${f}.glb`);
      g.scene.traverse((o) => {
        if (!o.isMesh) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (!m) continue;
          // the Sketchfab exports use alpha "hashed"; cut-out alpha is cheaper and sorts cleanly
          if (m.transparent && m.map && k !== 'police') { m.transparent = false; m.alphaTest = 0.45; m.depthWrite = true; }
        }
      });
      PROPS[k] = COMPACT.has(k) ? compact(g.scene) : g.scene;
    } catch (e) { console.warn('prop failed to load', f, e); }
  }));
  return PROPS;
}

// Merge a Sketchfab prop's dozens of meshes into a handful (one per textured material, one for every
// plain-colored opaque part using vertex colors, one for plain see-through parts), so each police car
// or yacht costs a few draw calls instead of 40 to 60.
export function compact(root) {
  root.updateMatrixWorld(true);
  const groups = new Map();
  const put = (key, mat, geo) => { if (!groups.has(key)) groups.set(key, { mat, geos: [] }); groups.get(key).geos.push(geo); };
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.length > 1) return;   // never happens with these exports; skip rather than guess
    const m = mats[0];
    let g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
    if (g.index) g = g.toNonIndexed();
    if (!g.attributes.normal) g.computeVertexNormals();
    if (m.map) {
      for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a);
      // the vertex-color channel was dropped above, so the material must not ask for it (it reads as black)
      if (m.vertexColors) { m.vertexColors = false; m.needsUpdate = true; }
      put(m.uuid, m, g);
    } else {
      for (const a of Object.keys(g.attributes)) if (!['position', 'normal'].includes(a)) g.deleteAttribute(a);
      const n = g.attributes.position.count, col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { col[i * 3] = m.color.r; col[i * 3 + 1] = m.color.g; col[i * 3 + 2] = m.color.b; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const see = m.transparent && m.opacity < 0.95;
      put(see ? 'glass' : 'plain', see ? m : null, g);
    }
  });
  const out = new THREE.Group();
  for (const [key, { mat, geos }] of groups) {
    const geo = mergeGeometries(geos); if (!geo) continue;
    let material = mat;
    if (key === 'plain') material = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.3, roughness: 0.5 });
    if (key === 'glass') material = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.45, metalness: 0.5, roughness: 0.1, depthWrite: false });
    out.add(new THREE.Mesh(geo, material));
  }
  return out;
}

// One geometry + material per mesh, baked into the prop's own frame (for InstancedMesh use).
export function partsOf(root, filter = () => true) {
  const out = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh || !filter(o)) return;
    const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
    out.push({ name: o.name, geo: g, mat: o.material });
  });
  return out;
}

// ------------------------------------------------------------- sea turtles
// A few turtles near the player in open water: they paddle slowly, surface to breathe and dive again.
export class Turtles {
  constructor(scene, world, n = 6) {
    this.world = world; this.list = [];
    if (!PROPS.turtle) return;
    for (let i = 0; i < n; i++) {
      const m = PROPS.turtle.clone(true);
      m.traverse((o) => { if (o.isMesh) { o.castShadow = false; } });
      m.scale.setScalar(0.9 + Math.random() * 0.5);
      m.visible = false; scene.add(m);
      this.list.push({ m, live: false, h: 0, ph: Math.random() * 20, sp: 0.5 + Math.random() * 0.5, wait: Math.random() * 2 });
    }
  }
  water(x, z) { const W = this.world; return !W.isLand(x, z) && W.inBounds(x, z, 150) && !W.isLand(x + 12, z) && !W.isLand(x - 12, z) && !W.isLand(x, z + 12) && !W.isLand(x, z - 12); }
  update(dt, player) {
    const px = player.pos.x, pz = player.pos.z;
    for (const t of this.list) {
      const p = t.m.position;
      if (!t.live) {
        t.wait -= dt; if (t.wait > 0) continue;
        for (let k = 0; k < 10; k++) {
          const a = Math.random() * 6.283, r = 60 + Math.random() * 260, x = px + Math.cos(a) * r, z = pz + Math.sin(a) * r;
          if (this.water(x, z)) { p.set(x, -0.6, z); t.h = Math.random() * 6.283; t.live = true; t.m.visible = true; break; }
        }
        if (!t.live) { t.wait = 1; continue; }
      }
      if (Math.hypot(p.x - px, p.z - pz) > 420) { t.live = false; t.m.visible = false; t.wait = 0.5; continue; }
      t.ph += dt;
      // swim: gentle weave, turn back from land, slip away from a fast boat
      t.h += Math.sin(t.ph * 0.3) * 0.15 * dt;
      const fx = Math.cos(t.h), fz = -Math.sin(t.h);
      if (!this.water(p.x + fx * 15, p.z + fz * 15)) t.h += 1.5 * dt;
      const close = player.kind === 'boat' && Math.hypot(p.x - px, p.z - pz) < 18;
      const sp = t.sp * (close ? 3 : 1);
      p.x += fx * sp * dt; p.z += fz * sp * dt;
      // a 24 s cycle: about 8 s at the surface (shell just breaking the water), the rest a little deeper
      const c = (t.ph % 24) / 24, up = c < 0.33 || close ? 1 : 0;
      const target = up ? -0.42 : -1.3;
      p.y += (target - p.y) * Math.min(1, dt * 0.8);
      t.m.rotation.set(0, t.h, Math.sin(t.ph * 1.7) * 0.05, 'YXZ');
    }
  }
}

// ------------------------------------------------------------- palms and bushes up close
// The island has about 14,000 code-built palms. Within NEAR meters of the player the nearest ones
// are swapped for the real palm models (three kinds) with a bush or two at their feet; the
// code-built copy of each swapped palm is hidden by zeroing its instance matrix.
const NEAR = 240, MAX = 700;
export class Flora {
  constructor(scene, world) {
    this.world = world; this.ok = !!PROPS.palms;
    if (!this.ok) return;
    // grid of every palm: [tile, index, x, z, h, a, k]
    this.grid = new Map(); this.cell = 100;
    for (const t of world.tiles.values()) {
      if (!t.palmMeshes) continue;
      t.palms.forEach(([x, z, h, a, k], i) => {
        const key = Math.floor(x / this.cell) + ',' + Math.floor(z / this.cell);
        if (!this.grid.has(key)) this.grid.set(key, []);
        this.grid.get(key).push({ t, i, x, z, h, a, k, v: i % 3 });
      });
    }
    // three palm kinds, each a trunk and a crown mesh
    this.kinds = [0, 1, 2].map((n) => {
      const parts = partsOf(PROPS.palms, (o) => o.name.startsWith(`palm${n}-`) || (o.parent && o.parent.name.startsWith(`palm${n}-`)));
      return parts.map((p) => {
        const mat = p.mat.clone(); mat.side = THREE.DoubleSide;
        const im = new THREE.InstancedMesh(p.geo, mat, MAX);
        im.count = 0; im.castShadow = true; im.frustumCulled = false;
        scene.add(im);
        return im;
      });
    });
    this.bushes = [];
    if (PROPS.bush) {
      this.bushes = partsOf(PROPS.bush).map((p) => {
        const mat = p.mat.clone(); mat.side = THREE.DoubleSide;
        const im = new THREE.InstancedMesh(p.geo, mat, MAX);
        im.count = 0; im.castShadow = false; im.frustumCulled = false;
        scene.add(im);
        return im;
      });
    }
    this.hidden = []; this.last = null; this.t = 0;
    this.zero = new THREE.Matrix4().makeScale(0, 0, 0);
    this.tmp = new THREE.Matrix4(); this.o = new THREE.Object3D();
  }
  update(dt, pos) {
    if (!this.ok) return;
    this.t -= dt;
    if (this.t > 0 && this.last && Math.hypot(pos.x - this.last.x, pos.z - this.last.z) < 40) return;
    this.t = 0.5; this.last = { x: pos.x, z: pos.z };
    // put back the code-built palms swapped out last time
    const dirty = new Set();
    for (const s of this.hidden) { for (const [mi, m] of s.t.palmMeshes.entries()) m.setMatrixAt(s.i, s.saved[mi]); dirty.add(s.t); }
    this.hidden.length = 0;
    // nearest palms first
    const near = [], c = this.cell, R = Math.ceil(NEAR / c);
    const cx = Math.floor(pos.x / c), cz = Math.floor(pos.z / c);
    for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) {
      const arr = this.grid.get((cx + i) + ',' + (cz + j)); if (!arr) continue;
      for (const p of arr) { const d = Math.hypot(p.x - pos.x, p.z - pos.z); if (d < NEAR) near.push([d, p]); }
    }
    near.sort((a, b) => a[0] - b[0]);
    const counts = [0, 0, 0]; let nb = 0;
    const o = this.o;
    for (const [, p] of near) {
      if (counts[p.v] >= MAX) continue;
      const n = counts[p.v]++;
      const s = p.h * (0.95 + p.k * 0.2);
      o.position.set(p.x, 0, p.z); o.rotation.set(0, p.a, 0); o.scale.setScalar(s); o.updateMatrix();
      for (const im of this.kinds[p.v]) im.setMatrixAt(n, o.matrix);
      if (this.bushes.length && p.k > 0.35 && nb < MAX) {
        o.position.set(p.x + Math.cos(p.a * 3) * 2.2, 0, p.z + Math.sin(p.a * 3) * 2.2); o.rotation.set(0, p.a * 5, 0); o.scale.setScalar(0.55 + p.k * 0.5); o.updateMatrix();
        for (const im of this.bushes) im.setMatrixAt(nb, o.matrix);
        nb++;
      }
      const saved = p.t.palmMeshes.map((m) => { const mm = new THREE.Matrix4(); m.getMatrixAt(p.i, mm); m.setMatrixAt(p.i, this.zero); return mm; });
      this.hidden.push({ t: p.t, i: p.i, saved }); dirty.add(p.t);
    }
    this.kinds.forEach((ims, v) => ims.forEach((im) => { im.count = counts[v]; im.instanceMatrix.needsUpdate = true; }));
    for (const im of this.bushes) { im.count = nb; im.instanceMatrix.needsUpdate = true; }
    for (const t of dirty) for (const m of t.palmMeshes) m.instanceMatrix.needsUpdate = true;
  }
}
