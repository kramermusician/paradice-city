// Birthday opening (2026-11-22): the Extra 330sc stunt plane dives past the car, climbs away and writes
// Happy Birthday / Dad in cursive white smoke in the sky ahead of the spawn heading. Runs once per page load.
// Smoke: one instanced billboard draw call; puffs grow and fade out over about 75 s.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Cursive: Hershey 'cursive' single-stroke script (public domain, A. V. Hershey, US NBS 1967), baked by
// build/bake_skyscript.py. Units: cap height 1, baseline 0; w is the word width. Each word is a few long
// connected strokes, so the plane flies one continuous line of smoke per stroke.
const SCRIPT = {"Happy Birthday":{"w":10.19,"s":[[[0.286,0.667],[0.19,0.714],[0.143,0.81],[0.143,0.857],[0.19,0.952],[0.286,1.0],[0.333,1.0],[0.429,0.952],[0.476,0.857],[0.476,0.762],[0.429,0.571],[0.333,0.286],[0.238,0.095],[0.143,0.0],[0.048,0.0],[0.0,0.048],[0.0,0.143]],[[0.286,0.429],[0.714,0.571],[0.81,0.619],[0.952,0.714],[1.048,0.81],[1.095,0.905],[1.095,0.952],[1.048,1.0],[1.0,1.0],[0.905,0.905],[0.81,0.714],[0.714,0.429],[0.667,0.19],[0.667,0.048],[0.714,0.0],[0.762,0.0],[0.857,0.048],[0.905,0.095],[1.0,0.238]],[[1.524,0.286],[1.476,0.381],[1.381,0.429],[1.286,0.429],[1.19,0.381],[1.143,0.333],[1.095,0.238],[1.095,0.143],[1.143,0.048],[1.238,0.0],[1.333,0.0],[1.429,0.048],[1.476,0.143],[1.571,0.429],[1.524,0.19],[1.524,0.048],[1.571,0.0],[1.619,0.0],[1.714,0.048],[1.762,0.095],[1.857,0.238],[1.952,0.381],[2.0,0.476],[1.952,0.286],[1.667,-0.571]],[[1.952,0.286],[2.0,0.381],[2.095,0.429],[2.19,0.429],[2.286,0.381],[2.333,0.286],[2.333,0.19],[2.286,0.095],[2.238,0.048],[2.143,0.0]],[[1.952,0.048],[2.048,0.0],[2.19,0.0],[2.333,0.048],[2.429,0.095],[2.571,0.238],[2.667,0.381],[2.714,0.476],[2.667,0.286],[2.381,-0.571]],[[2.667,0.286],[2.714,0.381],[2.81,0.429],[2.905,0.429],[3.0,0.381],[3.048,0.286],[3.048,0.19],[3.0,0.095],[2.952,0.048],[2.857,0.0]],[[2.667,0.048],[2.762,0.0],[2.905,0.0],[3.048,0.048],[3.143,0.095],[3.286,0.238],[3.381,0.429],[3.286,0.143],[3.286,0.048],[3.333,0.0],[3.429,0.0],[3.524,0.048],[3.619,0.143],[3.714,0.286]],[[3.762,0.429],[3.476,-0.429],[3.429,-0.524],[3.333,-0.571],[3.286,-0.524],[3.286,-0.429],[3.333,-0.286],[3.476,-0.143],[3.619,-0.048],[3.714,0.0],[3.857,0.095],[4.0,0.238]],[[5.381,0.905],[5.429,0.857],[5.429,0.714],[5.381,0.524],[5.333,0.381],[5.286,0.286],[5.19,0.143],[5.095,0.048],[5.0,0.0],[4.952,0.0],[4.905,0.048],[4.905,0.19],[4.952,0.429],[5.0,0.571],[5.048,0.667],[5.143,0.81],[5.238,0.905],[5.333,0.952],[5.476,1.0],[5.619,1.0],[5.714,0.952],[5.762,0.857],[5.762,0.762],[5.714,0.667],[5.667,0.619],[5.571,0.571],[5.429,0.524]],[[5.381,0.524],[5.429,0.524],[5.571,0.476],[5.619,0.429],[5.667,0.333],[5.667,0.19],[5.619,0.095],[5.571,0.048],[5.476,0.0],[5.333,0.0],[5.238,0.048],[5.19,0.143]],[[6.0,0.667],[6.0,0.619],[6.048,0.619],[6.048,0.667],[6.0,0.667]],[[5.857,0.238],[5.952,0.429],[5.857,0.143],[5.857,0.048],[5.905,0.0],[5.952,0.0],[6.048,0.048],[6.095,0.095],[6.19,0.238],[6.286,0.381],[6.333,0.476],[6.333,0.381],[6.476,0.381],[6.524,0.333],[6.524,0.238],[6.476,0.095],[6.476,0.048],[6.524,0.0],[6.571,0.0],[6.667,0.048],[6.714,0.095],[6.81,0.238],[6.905,0.381],[7.0,0.571]],[[7.143,1.0],[6.857,0.143],[6.857,0.048],[6.905,0.0],[7.0,0.0],[7.095,0.048],[7.143,0.095],[7.238,0.238]],[[6.857,0.619],[7.19,0.619]],[[7.238,0.238],[7.333,0.381],[7.476,0.619],[7.524,0.714],[7.571,0.857],[7.571,0.952],[7.524,1.0],[7.429,0.952],[7.381,0.857],[7.333,0.667],[7.286,0.381],[7.238,0.0],[7.286,0.143],[7.333,0.238],[7.429,0.381],[7.524,0.429],[7.619,0.429],[7.667,0.381],[7.667,0.286],[7.619,0.143],[7.619,0.048],[7.667,0.0],[7.714,0.0],[7.81,0.048],[7.857,0.095],[7.952,0.238]],[[8.381,0.286],[8.333,0.381],[8.238,0.429],[8.143,0.429],[8.048,0.381],[8.0,0.333],[7.952,0.238],[7.952,0.143],[8.0,0.048],[8.095,0.0],[8.19,0.0],[8.286,0.048],[8.333,0.143],[8.619,1.0]],[[8.429,0.429],[8.381,0.19],[8.381,0.048],[8.429,0.0],[8.476,0.0],[8.571,0.048],[8.619,0.095],[8.714,0.238]],[[9.143,0.286],[9.095,0.381],[9.0,0.429],[8.905,0.429],[8.81,0.381],[8.762,0.333],[8.714,0.238],[8.714,0.143],[8.762,0.048],[8.857,0.0],[8.952,0.0],[9.048,0.048],[9.095,0.143],[9.19,0.429],[9.143,0.19],[9.143,0.048],[9.19,0.0],[9.238,0.0],[9.333,0.048],[9.381,0.095],[9.476,0.238],[9.571,0.429],[9.476,0.143],[9.476,0.048],[9.524,0.0],[9.619,0.0],[9.714,0.048],[9.81,0.143],[9.905,0.286]],[[9.952,0.429],[9.667,-0.429],[9.619,-0.524],[9.524,-0.571],[9.476,-0.524],[9.476,-0.429],[9.524,-0.286],[9.667,-0.143],[9.81,-0.048],[9.905,0.0],[10.048,0.095],[10.19,0.238]]]},"Dad":{"w":2.667,"s":[[[0.667,1.0],[0.571,0.952],[0.524,0.857],[0.476,0.667],[0.429,0.381],[0.381,0.238],[0.333,0.143],[0.238,0.048],[0.143,0.0],[0.048,0.0],[0.0,0.048],[0.0,0.143],[0.048,0.19],[0.143,0.19],[0.238,0.143],[0.333,0.048],[0.476,0.0],[0.619,0.0],[0.762,0.048],[0.857,0.143],[0.952,0.333],[1.0,0.571],[1.0,0.762],[0.952,0.905],[0.905,0.952],[0.81,1.0],[0.667,1.0],[0.571,0.905],[0.571,0.81],[0.619,0.667],[0.714,0.524],[0.81,0.429],[0.952,0.333],[1.048,0.286]],[[1.571,0.286],[1.524,0.381],[1.429,0.429],[1.333,0.429],[1.238,0.381],[1.19,0.333],[1.143,0.238],[1.143,0.143],[1.19,0.048],[1.286,0.0],[1.381,0.0],[1.476,0.048],[1.524,0.143],[1.619,0.429],[1.571,0.19],[1.571,0.048],[1.619,0.0],[1.667,0.0],[1.762,0.048],[1.81,0.095],[1.905,0.238]],[[2.333,0.286],[2.286,0.381],[2.19,0.429],[2.095,0.429],[2.0,0.381],[1.952,0.333],[1.905,0.238],[1.905,0.143],[1.952,0.048],[2.048,0.0],[2.143,0.0],[2.238,0.048],[2.286,0.143],[2.571,1.0]],[[2.381,0.429],[2.333,0.19],[2.333,0.048],[2.381,0.0],[2.429,0.0],[2.524,0.048],[2.571,0.095],[2.667,0.238]]]}};
function layout(word) { const g = SCRIPT[word]; return { strokes: g.s, width: g.w }; }

const MAXP = 16000;
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
      uniforms: { uTime: { value: 0 }, uLife: { value: 150 } },
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
    const D = this.opts.dist || 4200, H = this.opts.height || 270;
    const C = new THREE.Vector3(x, 0, z).addScaledVector(f, D);
    const lines = [[layout('Happy Birthday'), H, 750], [layout('Dad'), H * 1.3, 230]];
    // one flight path through every stroke, pen up between strokes
    // one flight path through every stroke. Pen-down strokes are smoothed (Catmull-Rom); between strokes the
    // plane swings through a slow looping curve (smoke off) instead of jumping straight to the next letter.
    const strokes = [];
    for (const [L, LH, base] of lines) for (const st of L.strokes) {
      const pts = st.map(([u, v]) => C.clone().addScaledVector(r, (u - L.width / 2) * LH).addScaledVector(up, base + v * LH));
      if (pts.length > 2) { const cr = new THREE.CatmullRomCurve3(pts, false, 'centripetal'); strokes.push(cr.getSpacedPoints(Math.max(8, Math.round(cr.getLength() / 6)))); }
      else strokes.push(pts);
    }
    const path = []; // {p: Vector3, pen}
    strokes.forEach((pts, si) => {
      if (si > 0) {
        const prev = strokes[si - 1], A = prev[prev.length - 1], B = pts[0];
        const tA = A.clone().sub(prev[Math.max(0, prev.length - 3)]).normalize(), tB = pts[Math.min(2, pts.length - 1)].clone().sub(B).normalize();
        const L = Math.max(60, A.distanceTo(B) * 0.9);
        // carry on out of the stroke, loop up and over toward the viewer side, come into the next stroke along its direction
        const c1 = A.clone().addScaledVector(tA, L).addScaledVector(up, L * 0.6).addScaledVector(f, -L * 0.5);
        const c2 = B.clone().addScaledVector(tB, -L).addScaledVector(up, L * 0.6).addScaledVector(f, -L * 0.5);
        const bz = new THREE.CubicBezierCurve3(A, c1, c2, B), m = Math.max(10, Math.round(bz.getLength() / 8));
        for (let k = 1; k < m; k++) path.push({ p: bz.getPoint(k / m), pen: false });
      }
      pts.forEach((p, k) => path.push({ p, pen: k > 0 }));
    });
    // arclength
    let s = 0; path[0].s = 0;
    for (let i = 1; i < path.length; i++) { s += path[i].p.distanceTo(path[i - 1].p); path[i].s = s; }
    this.path = path; this.len = s;
    this.p0 = new THREE.Vector3(x, y, z).addScaledVector(f, -260).addScaledVector(r, -30).addScaledVector(up, 150);
    this.lastPos = this.p0.clone(); this.emitS = 0; this.plane.visible = true; this.whooshed = false;
    this.T = { pass: 3.0, climb: 5.2, write: 50.0, gone: 58 };
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
      for (let s = this.emitS; s < s1; s += step) { const q = this.pathAt(s); if (q.pen) this.puff(q.p, 24, time - (s1 - s) / (this.len / (T.write - T.climb))); }
      this.emitS = Math.ceil(s1 / step) * step;
      const here = this.pathAt(s1); pos = here.p;
      // fresh thick smoke right at the tail, so the trail is visibly coming out of the plane
      if (here.pen) for (let j = 0; j < 1; j++) this.puff(pos.clone().addScaledVector(this.dir || f, -4 - j * 5), 30, time);
      this.aPos.needsUpdate = true; this.aBirth.needsUpdate = true; this.geo.instanceCount = this.n;
    } else if (t < T.gone) {
      const k = (t - T.write) / (T.gone - T.write), E = this.path[this.path.length - 1].p;
      pos = bez(E, E.clone().addScaledVector(r, 300).add(new THREE.Vector3(0, 80, 0)), E.clone().addScaledVector(r, 900).addScaledVector(f, 900).add(new THREE.Vector3(0, 500, 0)), k);
    } else { this.on = false; this.done = true; this.plane.visible = false; return; }
    // face the direction of travel; scale up far away so it stays a readable dot
    const vel = pos.clone().sub(this.lastPos);
    if (vel.lengthSq() > 1e-4) this.plane.lookAt(pos.clone().add(vel));
    if (vel.lengthSq() > 1e-4) {
      const d = vel.clone().normalize();
      if (this.dir) { const turn = new THREE.Vector3().crossVectors(this.dir, d).dot(this.f) / Math.max(dt, 1e-3); this.bank = THREE.MathUtils.lerp(this.bank || 0, THREE.MathUtils.clamp(-turn * 0.5, -1.2, 1.2), Math.min(1, dt * 3)); this.plane.rotateZ(this.bank); }
      this.dir = d;
    }
    this.plane.position.copy(pos); this.lastPos.copy(pos);
    const dCar = pos.distanceTo(new THREE.Vector3(this.car.pos.x, this.car.y || 0, this.car.pos.z));
    this.plane.scale.setScalar(THREE.MathUtils.clamp(dCar / 110, 1, 11));
    if (this.prop) this.prop.rotation.x += dt * 70;
  }
}
