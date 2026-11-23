// Birthday opening (2026-11-22): the Extra 330sc stunt plane dives past the car, climbs away and writes
// HAPPY BIRTHDAY / DAD in white smoke in the sky ahead of the spawn heading. Runs once per page load.
// Smoke: one instanced billboard draw call; puffs grow and fade out over about 75 s.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Stroke font: polylines in a box 0.6 wide and 1 tall (I is narrow). Bowls are half circles.
function bowl(yt, yb, w) {
  const h = yt - yb, r = h / 2, cx = w - r, cy = yb + r, pts = [[0, yt], [cx, yt]];
  for (let k = 1; k < 8; k++) { const a = Math.PI / 2 - (k / 8) * Math.PI; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  pts.push([cx, yb], [0, yb]);
  return pts;
}
const GLYPHS = {
  H: { w: 0.6, s: [[[0, 1], [0, 0]], [[0, 0.5], [0.6, 0.5]], [[0.6, 1], [0.6, 0]]] },
  A: { w: 0.6, s: [[[0, 0], [0.3, 1], [0.6, 0]], [[0.12, 0.36], [0.48, 0.36]]] },
  P: { w: 0.55, s: [[[0, 0], [0, 1]], bowl(1, 0.5, 0.55).slice(1)] },
  Y: { w: 0.6, s: [[[0, 1], [0.3, 0.5], [0.6, 1]], [[0.3, 0.5], [0.3, 0]]] },
  B: { w: 0.58, s: [[[0, 0], [0, 1]], bowl(1, 0.52, 0.5).slice(1), bowl(0.52, 0, 0.58).slice(1)] },
  I: { w: 0.1, s: [[[0.05, 1], [0.05, 0]]] },
  R: { w: 0.58, s: [[[0, 0], [0, 1]], bowl(1, 0.5, 0.55).slice(1), [[0.2, 0.5], [0.58, 0]]] },
  T: { w: 0.6, s: [[[0, 1], [0.6, 1]], [[0.3, 1], [0.3, 0]]] },
  D: { w: 0.6, s: [[[0, 0], [0, 1]], bowl(1, 0, 0.6).slice(1)] },
};
function layout(text) {
  // strokes in letter units, x from 0, plus the total width
  const out = []; let x = 0;
  for (const ch of text) {
    if (ch === ' ') { x += 0.45; continue; }
    const g = GLYPHS[ch];
    for (const st of g.s) out.push(st.map(([u, v]) => [x + u, v]));
    x += g.w + 0.28;
  }
  return { strokes: out, width: x - 0.28 };
}

const MAXP = 6000;
export class SkyWriter {
  constructor(scene, opts = {}) {
    this.scene = scene; this.t = -1; this.on = false; this.done = false; this.opts = opts;
    // smoke
    const base = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index; g.setAttribute('position', base.getAttribute('position')); g.setAttribute('uv', base.getAttribute('uv'));
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(MAXP * 3), 3);
    this.aBirth = new THREE.InstancedBufferAttribute(new Float32Array(MAXP * 2), 2); // birth time, size
    g.setAttribute('aPos', this.aPos); g.setAttribute('aBirth', this.aBirth);
    g.instanceCount = 0;
    this.geo = g; this.n = 0;
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      uniforms: { uTime: { value: 0 }, uLife: { value: 75 } },
      vertexShader: `attribute vec3 aPos; attribute vec2 aBirth; uniform float uTime, uLife; varying vec2 vUv; varying float vA;
        void main(){ float age = max(0.0, uTime - aBirth.x);
          float sz = aBirth.y * (1.0 + age * 0.035);
          vA = (1.0 - smoothstep(uLife * 0.55, uLife, age)) * mix(1.0, 0.75, smoothstep(0.0, 20.0, age));
          if (uTime < aBirth.x) vA = 0.0;
          vec3 drift = vec3(0.0, age * 0.25, 0.0);
          vec4 mv = modelViewMatrix * vec4(aPos + drift, 1.0); mv.xy += position.xy * sz; vUv = uv;
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec2 vUv; varying float vA;
        void main(){ float d = length(vUv - 0.5) * 2.0; float a = (1.0 - smoothstep(0.35, 1.0, d)) * vA; if (a < 0.01) discard;
          gl_FragColor = vec4(vec3(1.0, 0.99, 0.97), a * 0.92);
          #include <colorspace_fragment>
        }`,
    });
    this.smoke = new THREE.Mesh(g, this.mat); this.smoke.frustumCulled = false; this.smoke.renderOrder = 5;
    scene.add(this.smoke);
    // plane
    this.plane = new THREE.Group(); this.plane.visible = false;
    const inner = new THREE.Group(); inner.rotation.y = -Math.PI / 2; this.plane.add(inner); this.inner = inner;
    scene.add(this.plane);
    this.ready = new GLTFLoader().loadAsync('assets/props/stunt-plane.glb').then((gl) => {
      inner.add(gl.scene);
      gl.scene.traverse((o) => { if (o.isMesh && opts.fixMaterial) o.material = opts.fixMaterial(o.material); });
      this.prop = gl.scene.getObjectByName('prop');
    }).catch((e) => console.warn('stunt plane failed to load', e));
  }
  // x, z, y: car start; h: heading (forward = cos h, -sin h)
  start(x, z, y, h, car) {
    this.on = true; this.t = 0; this.car = car;
    const f = new THREE.Vector3(Math.cos(h), 0, -Math.sin(h)), r = new THREE.Vector3(-f.z, 0, f.x), up = new THREE.Vector3(0, 1, 0);
    this.f = f; this.r = r;
    const D = this.opts.dist || 1700, H = this.opts.height || 115;
    const C = new THREE.Vector3(x, 0, z).addScaledVector(f, D);
    const lines = [[layout('HAPPY BIRTHDAY'), H, 240], [layout('DAD'), H * 1.35, 65]];
    // one flight path through every stroke, pen up between strokes
    const path = []; // {p: Vector3, pen}
    for (const [L, LH, base] of lines) {
      for (const st of L.strokes) st.forEach(([u, v], k) => {
        const p = C.clone().addScaledVector(r, (u - L.width / 2) * LH).addScaledVector(up, base + v * LH);
        path.push({ p, pen: k > 0 });
      });
    }
    // arclength
    let s = 0; path[0].s = 0;
    for (let i = 1; i < path.length; i++) { s += path[i].p.distanceTo(path[i - 1].p); path[i].s = s; }
    this.path = path; this.len = s;
    this.p0 = new THREE.Vector3(x, y, z).addScaledVector(f, -260).addScaledVector(r, -30).addScaledVector(up, 150);
    this.lastPos = this.p0.clone(); this.emitS = 0; this.plane.visible = true; this.whooshed = false;
    this.T = { pass: 3.0, climb: 5.2, write: 12.6, gone: 19 };
  }
  pathAt(s) {
    const P = this.path; let lo = 0, hi = P.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P[m].s < s) lo = m; else hi = m; }
    const a = P[lo], b = P[hi], k = b.s > a.s ? (s - a.s) / (b.s - a.s) : 0;
    return { p: a.p.clone().lerp(b.p, THREE.MathUtils.clamp(k, 0, 1)), pen: b.pen, i: hi };
  }
  puff(p, size, t) {
    if (this.n >= MAXP) return;
    const i = this.n++;
    this.aPos.setXYZ(i, p.x + (Math.random() - 0.5) * 2, p.y + (Math.random() - 0.5) * 2, p.z + (Math.random() - 0.5) * 2);
    this.aBirth.setXY(i, t, size * (0.85 + Math.random() * 0.3));
  }
  update(dt, time, onWhoosh) {
    this.mat.uniforms.uTime.value = time;
    if (!this.on) return;
    this.t += dt; const t = this.t, T = this.T, f = this.f, r = this.r;
    const bez = (a, c, b, k) => a.clone().multiplyScalar((1 - k) * (1 - k)).addScaledVector(c, 2 * k * (1 - k)).addScaledVector(b, k * k);
    let pos, pen = false;
    if (t < T.pass) {
      const c = this.car, cy = (c.y || 0);
      const P1 = new THREE.Vector3(c.pos.x, cy + 6, c.pos.z).addScaledVector(f, 14).addScaledVector(r, 10);
      const Pc = P1.clone().addScaledVector(f, -140).add(new THREE.Vector3(0, 12, 0));
      const k = t / T.pass; pos = bez(this.p0, Pc, P1, k * k * (3 - 2 * k) * 0.5 + k * 0.5);
      this.passPt = P1;
      if (!this.whooshed && t > T.pass - 0.9) { this.whooshed = true; onWhoosh && onWhoosh(); }
    } else if (t < T.climb) {
      const k = (t - T.pass) / (T.climb - T.pass), W0 = this.path[0].p;
      pos = bez(this.passPt, this.passPt.clone().addScaledVector(f, 260).add(new THREE.Vector3(0, 30, 0)), W0, k);
    } else if (t < T.write) {
      const k = (t - T.climb) / (T.write - T.climb);
      const s1 = k * this.len, step = 2.2;
      // smoke every 2.2 m along the pen-down parts covered this frame
      for (let s = this.emitS; s < s1; s += step) { const q = this.pathAt(s); if (q.pen) this.puff(q.p, 11, time - (s1 - s) / (this.len / (T.write - T.climb))); }
      this.emitS = Math.ceil(s1 / step) * step;
      pos = this.pathAt(s1).p;
      this.aPos.needsUpdate = true; this.aBirth.needsUpdate = true; this.geo.instanceCount = this.n;
    } else if (t < T.gone) {
      const k = (t - T.write) / (T.gone - T.write), E = this.path[this.path.length - 1].p;
      pos = bez(E, E.clone().addScaledVector(r, 300).add(new THREE.Vector3(0, 80, 0)), E.clone().addScaledVector(r, 900).addScaledVector(f, 900).add(new THREE.Vector3(0, 500, 0)), k);
    } else { this.on = false; this.done = true; this.plane.visible = false; return; }
    // face the direction of travel; scale up far away so it stays a readable dot
    const vel = pos.clone().sub(this.lastPos);
    if (vel.lengthSq() > 1e-4) this.plane.lookAt(pos.clone().add(vel));
    this.plane.position.copy(pos); this.lastPos.copy(pos);
    const dCar = pos.distanceTo(new THREE.Vector3(this.car.pos.x, this.car.y || 0, this.car.pos.z));
    this.plane.scale.setScalar(THREE.MathUtils.clamp(dCar / 120, 1, 5));
    if (this.prop) this.prop.rotation.x += dt * 70;
  }
}
